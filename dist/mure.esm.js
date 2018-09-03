import mime from 'mime-types';
import datalib from 'datalib';
import sha1 from 'sha1';

const TriggerableMixin = function (superclass) {
  return class extends superclass {
    constructor() {
      super(...arguments);
      this._instanceOfTriggerableMixin = true;
      this.eventHandlers = {};
      this.stickyTriggers = {};
    }

    on(eventName, callback, allowDuplicateListeners) {
      if (!this.eventHandlers[eventName]) {
        this.eventHandlers[eventName] = [];
      }

      if (!allowDuplicateListeners) {
        if (this.eventHandlers[eventName].indexOf(callback) !== -1) {
          return;
        }
      }

      this.eventHandlers[eventName].push(callback);
    }

    off(eventName, callback) {
      if (this.eventHandlers[eventName]) {
        if (!callback) {
          delete this.eventHandlers[eventName];
        } else {
          let index = this.eventHandlers[eventName].indexOf(callback);

          if (index >= 0) {
            this.eventHandlers[eventName].splice(index, 1);
          }
        }
      }
    }

    trigger(eventName, ...args) {
      if (this.eventHandlers[eventName]) {
        this.eventHandlers[eventName].forEach(callback => {
          setTimeout(() => {
            // Add timeout to prevent blocking
            callback.apply(this, args);
          }, 0);
        });
      }
    }

    stickyTrigger(eventName, argObj, delay = 10) {
      this.stickyTriggers[eventName] = this.stickyTriggers[eventName] || {
        argObj: {}
      };
      Object.assign(this.stickyTriggers[eventName].argObj, argObj);
      clearTimeout(this.stickyTriggers.timeout);
      this.stickyTriggers.timeout = setTimeout(() => {
        let argObj = this.stickyTriggers[eventName].argObj;
        delete this.stickyTriggers[eventName];
        this.trigger(eventName, argObj);
      }, delay);
    }

  };
};

Object.defineProperty(TriggerableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfTriggerableMixin
});

class Introspectable {
  get type() {
    return this.constructor.type;
  }

  get lowerCamelCaseType() {
    return this.constructor.lowerCamelCaseType;
  }

  get humanReadableType() {
    return this.constructor.humanReadableType;
  }

}

Object.defineProperty(Introspectable, 'type', {
  // This can / should be overridden by subclasses that follow a common string
  // pattern, such as RootToken, KeysToken, ParentToken, etc.
  configurable: true,

  get() {
    return this.type;
  }

});
Object.defineProperty(Introspectable, 'lowerCamelCaseType', {
  get() {
    const temp = this.type;
    return temp.replace(/./, temp[0].toLocaleLowerCase());
  }

});
Object.defineProperty(Introspectable, 'humanReadableType', {
  get() {
    // CamelCase to Sentence Case
    return this.type.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

});

class Table extends TriggerableMixin(Introspectable) {
  constructor(options) {
    super();
    this._mure = options.mure;
    this.tableId = options.tableId;

    if (!this._mure || !this.tableId) {
      throw new Error(`mure and tableId are required`);
    }

    this._expectedAttributes = options.attributes || {};
    this._observedAttributes = {};
    this._derivedTables = options.derivedTables || {};
    this._derivedAttributeFunctions = {};

    if (options.derivedAttributeFunctions) {
      for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions)) {
        this._derivedAttributeFunctions[attr] = this._mure.hydrateFunction(stringifiedFunc);
      }
    }
  }

  _toRawObject() {
    const result = {
      tableId: this.tableId,
      attributes: this._attributes,
      derivedTables: this._derivedTables,
      usedByClasses: this._usedByClasses,
      derivedAttributeFunctions: {}
    };

    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this._mure.dehydrateFunction(func);
    }

    return result;
  }

  async *iterate(options = {
    reset: false,
    limit: Infinity
  }) {
    // Generic caching stuff; this isn't just for performance. ConnectedTable's
    // algorithm requires that its parent tables have pre-built indexes (we
    // technically could implement it differently, but it would be expensive,
    // requires tricky logic, and we're already building indexes for some tables
    // like AggregatedTable anyway)
    if (options.reset) {
      this.reset();
    }

    if (this._cache) {
      for (const finishedItem of Object.values(this._cache)) {
        yield finishedItem;
      }

      return;
    }

    yield* await this._buildCache(options);
  }

  reset() {
    delete this._partialCache;
    delete this._cache;

    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }

    this.trigger('reset');
  }

  async *_buildCache(options) {
    // TODO: in large data scenarios, we should build the cache / index
    // externally on disk
    this._partialCache = {};
    const limit = options.limit;
    delete options.limit;

    const iterator = this._iterate(options);

    let completed = false;

    for (let i = 0; i < limit; i++) {
      const temp = await iterator.next();

      if (!this._partialCache) {
        // iteration was cancelled; return immediately
        return;
      }

      if (temp.done) {
        completed = true;
        break;
      } else {
        this._finishItem(temp.value);

        this._partialCache[temp.value.index] = temp.value;
        yield temp.value;
      }
    }

    if (completed) {
      this._cache = this._partialCache;
    }

    delete this._partialCache;
  }

  async *_iterate(options) {
    throw new Error(`this function should be overridden`);
  }

  _finishItem(wrappedItem) {
    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      wrappedItem.row[attr] = func(wrappedItem);
    }

    for (const attr of Object.keys(wrappedItem.row)) {
      this._observedAttributes[attr] = true;
    }

    wrappedItem.trigger('finish');
  }

  _wrap(options) {
    options.table = this;
    const classObj = this.classObj;
    return classObj ? classObj._wrap(options) : new this._mure.WRAPPERS.GenericWrapper(options);
  }

  _getAllAttributes() {
    const allAttrs = {};

    for (const attr in this._expectedAttributes) {
      allAttrs[attr] = true;
    }

    for (const attr in this._observedAttributes) {
      allAttrs[attr] = true;
    }

    for (const attr in this._derivedAttributeFunctions) {
      allAttrs[attr] = true;
    }

    return allAttrs;
  }

  get attributes() {
    return Object.keys(this._getAllAttributes());
  }

  deriveAttribute(attribute, func) {
    this._derivedAttributeFunctions[attribute] = func;
    this.reset();
  }

  _deriveTable(options) {
    const newTable = this._mure.createTable(options);

    this._derivedTables[newTable.tableId] = true;

    this._mure.saveTables();

    return newTable;
  }

  _getExistingTable(options) {
    // Check if the derived table has already been defined
    const existingTableId = Object.keys(this.derivedTables).find(tableId => {
      const tableObj = this._mure.tables[tableId];
      return Object.entries(options).every(([optionName, optionValue]) => {
        if (optionName === 'type') {
          return tableObj.constructor.name === optionValue;
        } else {
          return tableObj['_' + optionName] === optionValue;
        }
      });
    });
    return existingTableId && this._mure.tables[existingTableId] || null;
  }

  aggregate(attribute) {
    const options = {
      type: 'AggregatedTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  expand(attribute, delimiter) {
    const options = {
      type: 'ExpandedTable',
      attribute,
      delimiter
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  closedFacet(attribute, values) {
    return values.map(value => {
      const options = {
        type: 'FilteredTable',
        attribute,
        value
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }

  async *openFacet(options) {
    const values = {};
    const attribute = options.attribute;
    delete options.attribute;

    for await (const wrappedItem of this.iterate(options)) {
      const value = wrappedItem.row[attribute];

      if (!values[value]) {
        values[value] = true;
        const options = {
          type: 'FilteredTable',
          attribute,
          value
        };
        yield this._getExistingTable(options) || this._deriveTable(options);
      }
    }
  }

  connect(otherTableList) {
    const newTable = this._mure.createTable({
      type: 'ConnectedTable'
    });

    this._derivedTables[newTable.tableId] = true;

    for (const otherTable of otherTableList) {
      otherTable._derivedTables[newTable.tableId] = true;
    }

    this._mure.saveTables();

    return newTable;
  }

  get classObj() {
    return Object.values(this._mure.classes).find(classObj => {
      return classObj.table === this;
    });
  }

  get parentTables() {
    return Object.values(this._mure.tables).reduce((agg, tableObj) => {
      if (tableObj.derivedTables[this.tableId]) {
        agg.push(tableObj);
      }
    }, []);
  }

  get derivedTables() {
    return Object.keys(this.derivedTables).map(tableId => {
      return this._mure.tables[tableId];
    });
  }

  delete() {
    if (Object.keys(this.derivedTables).length > 0 || this.classObj) {
      throw new Error(`Can't delete in-use table ${this.tableId}`);
    }

    for (const parentTable of this.parentTables) {
      delete parentTable.derivedTables[this.tableId];
    }

    delete this._mure.tables[this.tableId];

    this._mure.saveTables();
  }

}

Object.defineProperty(Table, 'type', {
  get() {
    return /(.*)Table/.exec(this.name)[1];
  }

});

class StaticTable extends Table {
  constructor(options) {
    super(options);
    this._data = options.data || [];
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.data = this._data;
    return obj;
  }

  async *_iterate(options) {
    for (let index = 0; index < this._data.length; index++) {
      const item = this._wrap({
        index,
        row: this._data[index]
      });

      this._finishItem(item);

      yield item;
    }
  }

}

class StaticDict extends Table {
  constructor(options) {
    super(options);
    this._data = options.data || {};
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.data = this._data;
    return obj;
  }

  async *_iterate(options) {
    for (const [index, row] of Object.entries(this._data)) {
      const item = this._wrap({
        index,
        row
      });

      this._finishItem(item);

      yield item;
    }
  }

}

const SingleParentMixin = function (superclass) {
  return class extends superclass {
    constructor(options) {
      super(options);
      this._instanceOfSingleParentMixin = true;
    }

    get parentTable() {
      const parentTables = this.parentTables;

      if (parentTables.length === 0) {
        throw new Error(`Parent table is requierd for table of type ${this.type}`);
      } else if (parentTables.length > 1) {
        throw new Error(`Only one parent table allowed for table of type ${this.type}`);
      }

      return parentTables[0];
    }

  };
};

Object.defineProperty(SingleParentMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfSingleParentMixin
});

class AggregatedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }

    this._reduceAttributeFunctions = {};

    if (options.reduceAttributeFunctions) {
      for (const [attr, stringifiedFunc] of Object.entries(options.reduceAttributeFunctions)) {
        this._reduceAttributeFunctions[attr] = this._mure.hydrateFunction(stringifiedFunc);
      }
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.reduceAttributeFunctions = {};

    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      obj.reduceAttributeFunctions[attr] = this._mure._dehydrateFunction(func);
    }

    return obj;
  }

  _updateItem(originalWrappedItem, newWrappedItem) {
    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      originalWrappedItem.row[attr] = func(originalWrappedItem, newWrappedItem);
    }

    originalWrappedItem.trigger('update');
  }

  async *_buildCache(options) {
    // We override _buildCache because so that AggregatedTable can take advantage
    // of the partially-built cache as it goes, and postpone finishing items
    // until after the parent table has been fully iterated
    // TODO: in large data scenarios, we should build the cache / index
    // externally on disk
    this._partialCache = {};

    for await (const wrappedItem of this._iterate(options)) {
      this._partialCache[wrappedItem.index] = wrappedItem; // Go ahead and yield the unfinished item; this makes it possible for
      // client apps to be more responsive and render partial results, but also
      // means that they need to watch for wrappedItem.on('update') events

      yield wrappedItem;
    } // Second pass: now that we've completed the full iteration of the parent
    // table, we can finish each item


    for (const index in this._partialCache) {
      const wrappedItem = this._partialCache[index];

      this._finishItem(wrappedItem);
    }

    this._cache = this._partialCache;
    delete this._partialCache;
  }

  async *_iterate(options) {
    for await (const {
      wrappedParent
    } of this.parentTable.iterate(options)) {
      const index = wrappedParent.row[this._attribute];

      if (!this._partialCache) {
        // We were reset; return immediately
        return;
      } else if (this._partialCache[index]) {
        this._updateItem(this._partialCache[index], wrappedParent);
      } else {
        yield this._wrap({
          index,
          connectedRows: {
            wrappedParent
          }
        });
      }
    }
  }

  _getAllAttributes() {
    const result = super._getAllAttributes();

    for (const attr in this._reduceAttributeFunctions) {
      result[attr] = true;
    }

    return result;
  }

}

const DuplicatableAttributesMixin = function (superclass) {
  return class extends superclass {
    constructor(options) {
      super(options);
      this._instanceOfDuplicatableAttributesMixin = true;
      this._duplicatedAttributes = options.duplicatedAttributes || {};
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.duplicatedAttributes = this._duplicatedAttributes;
      return obj;
    }

    duplicateAttribute(parentId, attribute) {
      this._duplicateAttributes[parentId] = this._duplicateAttributes[parentId] || [];

      this._duplicatedAttributes[parentId].push(attribute);

      this.reset();
    }

    _duplicateAttributes(wrappedItem, connectedRows) {
      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        wrappedItem.row[`${parentId}.${attr}`] = connectedRows[parentId][attr];
      }
    }

    _getAllAttributes() {
      const result = super._getAllAttributes();

      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        result[`${parentId}.${attr}`] = true;
      }

      return result;
    }

  };
};

Object.defineProperty(DuplicatableAttributesMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfDuplicatableAttributesMixin
});

class ExpandedTable extends DuplicatableAttributesMixin(SingleParentMixin(Table)) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this.attribute) {
      throw new Error(`attribute is required`);
    }

    this.delimiter = options.delimiter || ',';
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    return obj;
  }

  async *_iterate(options) {
    let index = 0;
    const parentTableId = this.parentTable.tableId;

    for await (const {
      wrappedParent
    } of this.parentTable.iterate(options)) {
      const values = (wrappedParent.row[this.attribute] || '').split(this.delimiter);

      for (const value of values) {
        const row = {};
        row[this.attribute] = value;
        const connectedRows = {};
        connectedRows[parentTableId] = wrappedParent;

        const wrappedItem = this._wrap({
          index,
          row,
          connectedRows
        });

        this._duplicateAttributes(wrappedItem, connectedRows);

        this._finishItem(wrappedItem);

        yield wrappedItem;
        index++;
      }
    }
  }

}

class FilteredTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;
    this._value = options.value;

    if (!this.attribute || !this.value) {
      throw new Error(`attribute and value are required`);
    }
  }

  toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.value = this._value;
    return obj;
  }

  async *_iterate(options) {
    let index = 0;

    for await (const {
      wrappedParent
    } of this.parentTable.iterate(options)) {
      if (wrappedParent.row[this._attribute] === this._value) {
        const wrappedItem = this._wrap({
          index,
          row: wrappedParent.row,
          connectedRows: {
            wrappedParent
          }
        });

        this._finishItem(wrappedItem);

        yield wrappedItem;
        index++;
      }
    }
  }

}

class ConnectedTable extends DuplicatableAttributesMixin(Table) {
  async *_iterate(options) {
    const parentTables = this.parentTables; // Spin through all of the parentTables so that their _cache is pre-built

    for (const parentTable of parentTables) {
      if (!parentTable._cache) {
        const iterator = parentTable.iterate();
        let temp;

        while (!temp || !temp.done) {
          temp = await iterator.next();
        }
      }
    } // Now that the caches are built, just iterate their keys directly


    for (const parentTable of parentTables) {
      if (!parentTable._cache) {
        // One of the parent tables was reset; return immediately
        return;
      }

      for (const index in parentTable._cache) {
        if (!this._partialCache[index]) {
          const connectedRows = {};

          for (const parentTable2 of parentTables) {
            connectedRows[parentTable2.tableId] = parentTable2._cache[index];
          }

          const wrappedItem = this.wrap({
            index,
            connectedRows
          });

          this._duplicateAttributes(wrappedItem, connectedRows);

          this._finishItem(wrappedItem);

          yield wrappedItem;
        }
      }
    }
  }

}



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDict: StaticDict,
  AggregatedTable: AggregatedTable,
  ExpandedTable: ExpandedTable,
  FilteredTable: FilteredTable,
  ConnectedTable: ConnectedTable
});

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this._mure = options.mure;
    this.classId = options.classId;
    this.tableId = options.tableId;

    if (!this._mure || !this.classId || !this.tableId) {
      throw new Error(`_mure, classId, and tableId are required`);
    }

    this._className = options.className || null;
    this.annotation = options.annotation || '';
  }

  _toRawObject() {
    return {
      classId: this.classId,
      tableId: this.tableId,
      className: this._className,
      annotation: this.annotation
    };
  }

  setClassName(value) {
    this._className = value;

    this._mure.saveClasses();
  }

  get hasCustomName() {
    return this._customName !== null;
  }

  get className() {
    return this._customName || this._autoDeriveClassName();
  }

  getHashTable(attribute) {
    return attribute === null ? this.table : this.table.aggregate(attribute);
  }

  _autoDeriveClassName() {
    throw new Error(`this function should be overridden`);
  }

  get table() {
    return this._mure.tables[this.tableId];
  }

  interpretAsNodes() {
    const options = this._toRawObject();

    options.type = 'NodeClass';
    return this._mure.newClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    return this._mure.newClass(options);
  }

  _wrap(options) {
    return new this._mure.WRAPPERS.GenericWrapper(options);
  }

  delete() {
    delete this._mure.classes[this.classId];

    this._mure.saveClasses();
  }

}

Object.defineProperty(GenericClass, 'type', {
  get() {
    return /(.*)Class/.exec(this.name)[1];
  }

});

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.edgeClassIds = options.edgeClassIds || {};
    this.Wrapper = this._mure.WRAPPERS.NodeWrapper;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.edgeClassIds = this.edgeClassIds;
    return result;
  }

  interpretAsNodes() {
    return this;
  }

  interpretAsEdges() {
    throw new Error(`unimplemented`);
  }

  connectToNodeClass({
    otherNodeClass,
    directed,
    attribute,
    otherAttribute
  }) {
    const thisHash = this.getHashTable(attribute);
    const otherHash = otherNodeClass.getHashTable(otherAttribute);
    const connectedTable = thisHash.connect([otherHash]);
    return this._mure.newClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceNodeAttr: attribute,
      targetClassId: otherNodeClass.classId,
      targetNodeAttr: otherAttribute
    });
  }

  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    return edgeClass.connectToNodeClass(options);
  }

  disconnectAllEdges() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      const edgeClass = this._mure.classes[edgeClassId];

      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSources();
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTargets();
      }
    }
  }

  delete() {
    this.disconnectAllEdges();
    super.delete();
  }

}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this._mure.WRAPPERS.EdgeWrapper;
    this.sourceClassId = options.sourceClassId || null;
    this.sourceNodeAttr = options.sourceNodeAttr || null;
    this.sourceEdgeAttr = options.sourceEdgeAttr || null;
    this.targetClassId = options.targetClassId || null;
    this.targetNodeAttr = options.targetNodeAttr || null;
    this.targetEdgeAttr = options.targetEdgeAttr || null;
    this.directed = options.directed || false;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.sourceNodeAttr = this.sourceNodeAttr;
    result.sourceEdgeAttr = this.sourceEdgeAttr;
    result.targetClassId = this.targetClassId;
    result.targetNodeAttr = this.targetNodeAttr;
    result.targetEdgeAttr = this.targetEdgeAttr;
    result.directed = this.directed;
    return result;
  }

  interpretAsNodes() {
    throw new Error(`unimplemented`);
  }

  interpretAsEdges() {
    return this;
  }

  connectToNodeClass({
    nodeClass,
    direction,
    nodeAttribute,
    edgeAttribute
  }) {
    if (direction !== 'source' && direction !== 'target') {
      direction = this.targetClassId === null ? 'target' : 'source';
    }

    if (direction === 'target') {
      this.connectTarget({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    } else {
      this.connectSource({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    }

    this._mure.saveClasses();
  }

  toggleNodeDirection(sourceClassId) {
    if (!sourceClassId) {
      this.directed = false;
    } else {
      this.directed = true;

      if (sourceClassId !== this.sourceClassId) {
        if (sourceClassId !== this.targetClassId) {
          throw new Error(`Can't swap to unconnected class id: ${sourceClassId}`);
        }

        let temp = this.sourceClassId;
        this.sourceClassId = this.targetClassId;
        this.targetClassId = temp;
        temp = this.sourceNodeAttr;
        this.sourceNodeAttr = this.targetNodeAttr;
        this.targetNodeAttr = temp;
        temp = this.intermediateSources;
        this.sourceEdgeAttr = this.targetEdgeAttr;
        this.targetEdgeAttr = temp;
      }
    }

    this._mure.saveClasses();
  }

  connectSource({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null,
    skipSave = false
  }) {
    if (this.sourceClassId) {
      this.disconnectSource({
        skipSave: true
      });
    }

    this.sourceClassId = nodeClass.classId;
    this._mure.classes[this.sourceClassId].edgeClassIds[this.classId] = true;
    this.sourceNodeAttr = nodeAttribute;
    this.sourceEdgeAttr = edgeAttribute;

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  connectTarget({
    nodeClass,
    nodeAttribute,
    edgeAttribute,
    skipSave = false
  }) {
    if (this.targetClassId) {
      this.disconnectTarget({
        skipSave: true
      });
    }

    this.targetClassId = nodeClass.classId;
    this._mure.classes[this.targetClassId].edgeClassIds[this.classId] = true;
    this.targetNodeAttr = nodeAttribute;
    this.targetEdgeAttr = edgeAttribute;

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  disconnectSource({
    skipSave = false
  }) {
    if (this._mure.classes[this.sourceClassId]) {
      delete this._mure.classes[this.sourceClassId].edgeClassIds[this.classId];
    }

    this.sourceNodeAttr = null;
    this.sourceEdgeAttr = null;

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  disconnectTarget({
    skipSave = false
  }) {
    if (this._mure.classes[this.targetClassId]) {
      delete this._mure.classes[this.targetClassId].edgeClassIds[this.classId];
    }

    this.targetNodeAttr = null;
    this.targetEdgeAttr = null;

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  delete() {
    this.disconnectSource({
      skipSave: true
    });
    this.disconnectTarget({
      skipSave: true
    });
    super.delete();
  }

}



var CLASSES = /*#__PURE__*/Object.freeze({
  GenericClass: GenericClass,
  NodeClass: NodeClass,
  EdgeClass: EdgeClass
});

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor(options) {
    super();
    this.index = options.index;

    if (this.index === undefined) {
      throw new Error(`index is required`);
    }

    this.row = options.row || {};
    this.connectedRows = options.connectedRows || {};
  }

}

Object.defineProperty(GenericWrapper, 'type', {
  get() {
    return /(.*)Wrapper/.exec(this.name)[1];
  }

});

class NodeWrapper extends GenericWrapper {}

class EdgeWrapper extends GenericWrapper {}



var WRAPPERS = /*#__PURE__*/Object.freeze({
  GenericWrapper: GenericWrapper,
  NodeWrapper: NodeWrapper,
  EdgeWrapper: EdgeWrapper
});

class InMemoryIndex {
  constructor({
    entries = {},
    complete = false
  } = {}) {
    this.entries = entries;
    this.complete = complete;
  }

  async toRawObject() {
    return this.entries;
  }

  async *iterEntries() {
    for (const [hash, valueList] of Object.entries(this.entries)) {
      yield {
        hash,
        valueList
      };
    }
  }

  async *iterHashes() {
    for (const hash of Object.keys(this.entries)) {
      yield hash;
    }
  }

  async *iterValueLists() {
    for (const valueList of Object.values(this.entries)) {
      yield valueList;
    }
  }

  async getValueList(hash) {
    return this.entries[hash] || [];
  }

  async addValue(hash, value) {
    // TODO: add some kind of warning if this is getting big?
    this.entries[hash] = await this.getValueList(hash);

    if (this.entries[hash].indexOf(value) === -1) {
      this.entries[hash].push(value);
    }
  }

}



var INDEXES = /*#__PURE__*/Object.freeze({
  InMemoryIndex: InMemoryIndex
});

let NEXT_CLASS_ID = 1;
let NEXT_TABLE_ID = 1;

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader, localStorage) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node

    this.localStorage = localStorage; // either window.localStorage or null

    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set mure.debug to true to debug streams
    // extensions that we want datalib to handle

    this.DATALIB_FORMATS = {
      'json': 'json',
      'csv': 'csv',
      'tsv': 'tsv',
      'topojson': 'topojson',
      'treejson': 'treejson'
    }; // Access to core classes via the main library helps avoid circular imports

    this.TABLES = TABLES;
    this.CLASSES = CLASSES;
    this.WRAPPERS = WRAPPERS;
    this.INDEXES = INDEXES; // Default named functions

    this.NAMED_FUNCTIONS = {
      identity: function* (wrappedItem) {
        yield wrappedItem.rawItem;
      },
      key: function* (wrappedItem) {
        if (!wrappedItem.wrappedParent || !wrappedItem.wrappedParent.wrappedParent || typeof wrappedItem.wrappedParent.wrappedParent.rawItem !== 'object') {
          throw new TypeError(`Grandparent is not an object / array`);
        }

        const parentType = typeof wrappedItem.wrappedParent.rawItem;

        if (!(parentType === 'number' || parentType === 'string')) {
          throw new TypeError(`Parent isn't a key / index`);
        } else {
          yield wrappedItem.wrappedParent.rawItem;
        }
      },
      defaultFinish: function* (thisWrappedItem, otherWrappedItem) {
        yield {
          left: thisWrappedItem.rawItem,
          right: otherWrappedItem.rawItem
        };
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    }; // Object containing each of our data sources

    this.tables = this.hydrate('mure_tables'); // Object containing our class specifications

    this.classes = this.hydrate('mure_classes');
  }

  saveTables() {
    this.dehydrate('mure_tables', this.tables);
  }

  saveClasses() {
    this.dehydrate('mure_classes', this.classes);
  }

  hydrate(storageKey, TYPES) {
    let container = this.localStorage && this.localStorage.getItem(storageKey);
    container = container ? JSON.parse(container) : {};

    for (const [key, value] of Object.entries(container)) {
      const type = value.type;
      delete value.type;
      container[key] = new TYPES[type](value);
    }

    return container;
  }

  getRawObject(container) {
    const result = {};

    for (const [key, value] of Object.entries(container)) {
      result[key] = value._toRawObject();
      result[key].type = value.constructor.name;
    }

    return result;
  }

  dehydrate(storageKey, container) {
    if (this.localStorage) {
      this.localStorage.setItem(storageKey, JSON.stringify(this.getRawObject(container)));
    }
  }

  hydrateFunction(stringifiedFunc) {
    new Function(`return ${stringifiedFunc}`)(); // eslint-disable-line no-new-func
  }

  dehydrateFunction(func) {
    let stringifiedFunc = func.toString(); // Istanbul adds some code to functions for computing coverage, that gets
    // included in the stringification process during testing. See:
    // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022

    stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
    return stringifiedFunc;
  }

  createTable(options) {
    if (!options.tableId) {
      options.tableId = `table${NEXT_TABLE_ID}`;
      NEXT_TABLE_ID += 1;
    }

    const Type = this.TABLES[options.type];
    delete options.type;
    options.mure = this;
    this.tables[options.tableId] = new Type(options);
    return this.tables[options.tableId];
  }

  createClass(options = {
    selector: `empty`
  }) {
    if (!options.classId) {
      options.classId = `class${NEXT_CLASS_ID}`;
      NEXT_CLASS_ID += 1;
    }

    const Type = this.CLASSES[options.type];
    delete options.type;
    options.mure = this;
    this.classes[options.classId] = new Type(options);
    return this.classes[options.classId];
  }

  newTable(options) {
    const newTableObj = this.createTable(options);
    this.saveTables();
    return newTableObj;
  }

  newClass(options) {
    const newClassObj = this.createClass(options);
    this.saveClasses();
    return newClassObj;
  }

  async addFileAsStaticTable({
    fileObj,
    encoding = mime.charset(fileObj.type),
    extensionOverride = null,
    skipSizeCheck = false
  } = {}) {
    const fileMB = fileObj.size / 1048576;

    if (fileMB >= 30) {
      if (skipSizeCheck) {
        console.warn(`Attempting to load ${fileMB}MB file into memory`);
      } else {
        throw new Error(`${fileMB}MB file is too large to load statically; try addDynamicTable() instead.`);
      }
    } // extensionOverride allows things like topojson or treejson (that don't
    // have standardized mimeTypes) to be parsed correctly


    let text = await new Promise((resolve, reject) => {
      let reader = new this.FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.readAsText(fileObj, encoding);
    });
    return this.addStringAsStaticTable({
      name: fileObj.name,
      extension: extensionOverride || mime.extension(fileObj.type),
      text
    });
  }

  addStringAsStaticTable({
    name,
    extension = 'txt',
    text
  }) {
    let data, attributes;

    if (this.DATALIB_FORMATS[extension]) {
      data = datalib.read(text, {
        type: extension
      });

      if (extension === 'csv' || extension === 'tsv') {
        attributes = {};

        for (const attr of data.columns) {
          attributes[attr] = true;
        }

        delete data.columns;
      }
    } else if (extension === 'xml') {
      throw new Error('unimplemented');
    } else if (extension === 'txt') {
      throw new Error('unimplemented');
    } else {
      throw new Error(`Unsupported file extension: ${extension}`);
    }

    return this.addStaticTable({
      name,
      data,
      attributes
    });
  }

  addStaticTable(options) {
    options.type = options.data instanceof Array ? 'StaticTable' : 'StaticDict';
    let newTable = this.newTable(options);
    return this.newClass({
      type: 'GenericClass',
      tableId: newTable.tableId
    });
  }

  deleteAllUnusedTables() {
    for (const tableId in this.tables) {
      if (this.tables[tableId]) {
        try {
          this.tables[tableId].delete();
        } catch (err) {}
      }
    }
  }

  deleteAllClasses() {
    for (const classObj of Object.values(this.classes)) {
      classObj.delete();
    }
  }

}

var name = "mure";
var version = "0.4.10";
var description = "A library for flexible graph reshaping";
var main = "dist/mure.cjs.js";
var module$1 = "dist/mure.esm.js";
var browser = "dist/mure.umd.js";
var scripts = {
	build: "rollup -c --environment TARGET:all",
	watch: "rollup -c -w",
	watchcjs: "rollup -c -w --environment TARGET:cjs",
	watchumd: "rollup -c -w --environment TARGET:umd",
	watchesm: "rollup -c -w --environment TARGET:esm",
	test: "jest --runInBand",
	pretest: "rollup -c --environment TARGET:cjs",
	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && node --inspect-brk node_modules/.bin/jest --runInBand -t",
	coveralls: "cat ./coverage/lcov.info | node node_modules/.bin/coveralls"
};
var files = [
	"dist"
];
var repository = {
	type: "git",
	url: "git+https://github.com/mure-apps/mure-library.git"
};
var author = "Alex Bigelow";
var license = "MIT";
var bugs = {
	url: "https://github.com/mure-apps/mure-library/issues"
};
var homepage = "https://github.com/mure-apps/mure-library#readme";
var devDependencies = {
	"@babel/core": "^7.0.0",
	"@babel/preset-env": "^7.0.0",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.4.2",
	coveralls: "^3.0.2",
	filereader: "^0.10.3",
	jest: "^23.5.0",
	rollup: "^0.65.0",
	"rollup-plugin-babel": "^4.0.2",
	"rollup-plugin-commonjs": "^9.1.6",
	"rollup-plugin-json": "^3.0.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.2.1",
	"rollup-plugin-node-resolve": "^3.3.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.1",
	"mime-types": "^2.1.20",
	sha1: "^1.1.1"
};
var peerDependencies = {
	d3: "^5.4.0"
};
var pkg = {
	name: name,
	version: version,
	description: description,
	main: main,
	module: module$1,
	"jsnext:main": "dist/mure.esm.js",
	browser: browser,
	scripts: scripts,
	files: files,
	repository: repository,
	author: author,
	license: license,
	bugs: bugs,
	homepage: homepage,
	devDependencies: devDependencies,
	dependencies: dependencies,
	peerDependencies: peerDependencies
};

let mure = new Mure(window.FileReader, window.localStorage);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdC5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GaWx0ZXJlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Db25uZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9JbmRleGVzL0luTWVtb3J5SW5kZXguanMiLCIuLi9zcmMvTXVyZS5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICBpZiAoIXRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoIWFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKSAhPT0gLTEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudE5hbWUsIC4uLmFyZ3MpIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fbXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLl9tdXJlIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbXVyZSBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBpZiAob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgYXR0cmlidXRlczogdGhpcy5fYXR0cmlidXRlcyxcbiAgICAgIGRlcml2ZWRUYWJsZXM6IHRoaXMuX2Rlcml2ZWRUYWJsZXMsXG4gICAgICB1c2VkQnlDbGFzc2VzOiB0aGlzLl91c2VkQnlDbGFzc2VzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge31cbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChvcHRpb25zID0geyByZXNldDogZmFsc2UsIGxpbWl0OiBJbmZpbml0eSB9KSB7XG4gICAgLy8gR2VuZXJpYyBjYWNoaW5nIHN0dWZmOyB0aGlzIGlzbid0IGp1c3QgZm9yIHBlcmZvcm1hbmNlLiBDb25uZWN0ZWRUYWJsZSdzXG4gICAgLy8gYWxnb3JpdGhtIHJlcXVpcmVzIHRoYXQgaXRzIHBhcmVudCB0YWJsZXMgaGF2ZSBwcmUtYnVpbHQgaW5kZXhlcyAod2VcbiAgICAvLyB0ZWNobmljYWxseSBjb3VsZCBpbXBsZW1lbnQgaXQgZGlmZmVyZW50bHksIGJ1dCBpdCB3b3VsZCBiZSBleHBlbnNpdmUsXG4gICAgLy8gcmVxdWlyZXMgdHJpY2t5IGxvZ2ljLCBhbmQgd2UncmUgYWxyZWFkeSBidWlsZGluZyBpbmRleGVzIGZvciBzb21lIHRhYmxlc1xuICAgIC8vIGxpa2UgQWdncmVnYXRlZFRhYmxlIGFueXdheSlcbiAgICBpZiAob3B0aW9ucy5yZXNldCkge1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIGZvciAoY29uc3QgZmluaXNoZWRJdGVtIG9mIE9iamVjdC52YWx1ZXModGhpcy5fY2FjaGUpKSB7XG4gICAgICAgIHlpZWxkIGZpbmlzaGVkSXRlbTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB5aWVsZCAqIGF3YWl0IHRoaXMuX2J1aWxkQ2FjaGUob3B0aW9ucyk7XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGZvciAoY29uc3QgZGVyaXZlZFRhYmxlIG9mIHRoaXMuZGVyaXZlZFRhYmxlcykge1xuICAgICAgZGVyaXZlZFRhYmxlLnJlc2V0KCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncmVzZXQnKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zKSB7XG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdDtcbiAgICBkZWxldGUgb3B0aW9ucy5saW1pdDtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUob3B0aW9ucyk7XG4gICAgbGV0IGNvbXBsZXRlZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIGl0ZXJhdGlvbiB3YXMgY2FuY2VsbGVkOyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICBjb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSk7XG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt0ZW1wLnZhbHVlLmluZGV4XSA9IHRlbXAudmFsdWU7XG4gICAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjb21wbGV0ZWQpIHtcbiAgICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBvZiBPYmplY3Qua2V5cyh3cmFwcGVkSXRlbS5yb3cpKSB7XG4gICAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICByZXR1cm4gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyB0aGlzLl9tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIF9nZXRBbGxBdHRyaWJ1dGVzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHt9O1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9nZXRBbGxBdHRyaWJ1dGVzKCkpO1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGVJZCA9IE9iamVjdC5rZXlzKHRoaXMuZGVyaXZlZFRhYmxlcykuZmluZCh0YWJsZUlkID0+IHtcbiAgICAgIGNvbnN0IHRhYmxlT2JqID0gdGhpcy5fbXVyZS50YWJsZXNbdGFibGVJZF07XG4gICAgICByZXR1cm4gT2JqZWN0LmVudHJpZXMob3B0aW9ucykuZXZlcnkoKFtvcHRpb25OYW1lLCBvcHRpb25WYWx1ZV0pID0+IHtcbiAgICAgICAgaWYgKG9wdGlvbk5hbWUgPT09ICd0eXBlJykge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmpbJ18nICsgb3B0aW9uTmFtZV0gPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gKGV4aXN0aW5nVGFibGVJZCAmJiB0aGlzLl9tdXJlLnRhYmxlc1tleGlzdGluZ1RhYmxlSWRdKSB8fCBudWxsO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdBZ2dyZWdhdGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdFeHBhbmRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZSxcbiAgICAgIGRlbGltaXRlclxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHZhbHVlcy5tYXAodmFsdWUgPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ0ZpbHRlcmVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKG9wdGlvbnMpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBjb25zdCBhdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBkZWxldGUgb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZpbHRlcmVkVGFibGUnLFxuICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9O1xuICAgICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjb25uZWN0IChvdGhlclRhYmxlTGlzdCkge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5fbXVyZS5jcmVhdGVUYWJsZSh7IHR5cGU6ICdDb25uZWN0ZWRUYWJsZScgfSk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgZm9yIChjb25zdCBvdGhlclRhYmxlIG9mIG90aGVyVGFibGVMaXN0KSB7XG4gICAgICBvdGhlclRhYmxlLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5fbXVyZS5zYXZlVGFibGVzKCk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIGdldCBjbGFzc09iaiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5fbXVyZS5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZSA9PT0gdGhpcztcbiAgICB9KTtcbiAgfVxuICBnZXQgcGFyZW50VGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9tdXJlLnRhYmxlcykucmVkdWNlKChhZ2csIHRhYmxlT2JqKSA9PiB7XG4gICAgICBpZiAodGFibGVPYmouZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmRlcml2ZWRUYWJsZXMpLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9tdXJlLnRhYmxlc1t0YWJsZUlkXTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLmRlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDAgfHwgdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IFtdO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLl9kYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93OiB0aGlzLl9kYXRhW2luZGV4XSB9KTtcbiAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSk7XG4gICAgICB5aWVsZCBpdGVtO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3QgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbShpdGVtKTtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0O1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aWVyZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBBZ2dyZWdhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGlmIChvcHRpb25zLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5fZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgX3VwZGF0ZUl0ZW0gKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG5ld1dyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG5ld1dyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zKSB7XG4gICAgLy8gV2Ugb3ZlcnJpZGUgX2J1aWxkQ2FjaGUgYmVjYXVzZSBzbyB0aGF0IEFnZ3JlZ2F0ZWRUYWJsZSBjYW4gdGFrZSBhZHZhbnRhZ2VcbiAgICAvLyBvZiB0aGUgcGFydGlhbGx5LWJ1aWx0IGNhY2hlIGFzIGl0IGdvZXMsIGFuZCBwb3N0cG9uZSBmaW5pc2hpbmcgaXRlbXNcbiAgICAvLyB1bnRpbCBhZnRlciB0aGUgcGFyZW50IHRhYmxlIGhhcyBiZWVuIGZ1bGx5IGl0ZXJhdGVkXG5cbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbd3JhcHBlZEl0ZW0uaW5kZXhdID0gd3JhcHBlZEl0ZW07XG4gICAgICAvLyBHbyBhaGVhZCBhbmQgeWllbGQgdGhlIHVuZmluaXNoZWQgaXRlbTsgdGhpcyBtYWtlcyBpdCBwb3NzaWJsZSBmb3JcbiAgICAgIC8vIGNsaWVudCBhcHBzIHRvIGJlIG1vcmUgcmVzcG9uc2l2ZSBhbmQgcmVuZGVyIHBhcnRpYWwgcmVzdWx0cywgYnV0IGFsc29cbiAgICAgIC8vIG1lYW5zIHRoYXQgdGhleSBuZWVkIHRvIHdhdGNoIGZvciB3cmFwcGVkSXRlbS5vbigndXBkYXRlJykgZXZlbnRzXG4gICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICB9XG5cbiAgICAvLyBTZWNvbmQgcGFzczogbm93IHRoYXQgd2UndmUgY29tcGxldGVkIHRoZSBmdWxsIGl0ZXJhdGlvbiBvZiB0aGUgcGFyZW50XG4gICAgLy8gdGFibGUsIHdlIGNhbiBmaW5pc2ggZWFjaCBpdGVtXG4gICAgZm9yIChjb25zdCBpbmRleCBpbiB0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHsgd3JhcHBlZFBhcmVudCB9IG9mIHRoaXMucGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgaW5kZXggPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlW2luZGV4XSkge1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgeWllbGQgdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgY29ubmVjdGVkUm93czogeyB3cmFwcGVkUGFyZW50IH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF9nZXRBbGxBdHRyaWJ1dGVzICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fZ2V0QWxsQXR0cmlidXRlcygpO1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIHJlc3VsdFthdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEFnZ3JlZ2F0ZWRUYWJsZTtcbiIsImNvbnN0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmR1cGxpY2F0ZWRBdHRyaWJ1dGVzIHx8IHt9O1xuICAgIH1cbiAgICBfdG9SYXdPYmplY3QgKCkge1xuICAgICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgICBvYmouZHVwbGljYXRlZEF0dHJpYnV0ZXMgPSB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcztcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuICAgIGR1cGxpY2F0ZUF0dHJpYnV0ZSAocGFyZW50SWQsIGF0dHJpYnV0ZSkge1xuICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlc1twYXJlbnRJZF0gPSB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzW3BhcmVudElkXSB8fCBbXTtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzW3BhcmVudElkXS5wdXNoKGF0dHJpYnV0ZSk7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuICAgIF9kdXBsaWNhdGVBdHRyaWJ1dGVzICh3cmFwcGVkSXRlbSwgY29ubmVjdGVkUm93cykge1xuICAgICAgZm9yIChjb25zdCBbcGFyZW50SWQsIGF0dHJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICB3cmFwcGVkSXRlbS5yb3dbYCR7cGFyZW50SWR9LiR7YXR0cn1gXSA9IGNvbm5lY3RlZFJvd3NbcGFyZW50SWRdW2F0dHJdO1xuICAgICAgfVxuICAgIH1cbiAgICBfZ2V0QWxsQXR0cmlidXRlcyAoKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fZ2V0QWxsQXR0cmlidXRlcygpO1xuICAgICAgZm9yIChjb25zdCBbcGFyZW50SWQsIGF0dHJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICByZXN1bHRbYCR7cGFyZW50SWR9LiR7YXR0cn1gXSA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcbmltcG9ydCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gZnJvbSAnLi9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluKFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5kZWxpbWl0ZXIgPSBvcHRpb25zLmRlbGltaXRlciB8fCAnLCc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGVJZCA9IHRoaXMucGFyZW50VGFibGUudGFibGVJZDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHsgd3JhcHBlZFBhcmVudCB9IG9mIHRoaXMucGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgdmFsdWVzID0gKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuYXR0cmlidXRlXSB8fCAnJykuc3BsaXQodGhpcy5kZWxpbWl0ZXIpO1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICAgICAgY29uc3Qgcm93ID0ge307XG4gICAgICAgIHJvd1t0aGlzLmF0dHJpYnV0ZV0gPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgY29ubmVjdGVkUm93cyA9IHt9O1xuICAgICAgICBjb25uZWN0ZWRSb3dzW3BhcmVudFRhYmxlSWRdID0gd3JhcHBlZFBhcmVudDtcbiAgICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdywgY29ubmVjdGVkUm93cyB9KTtcbiAgICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlcyh3cmFwcGVkSXRlbSwgY29ubmVjdGVkUm93cyk7XG4gICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZpbHRlcmVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuYXR0cmlidXRlIHx8ICF0aGlzLnZhbHVlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIHRvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCB7IHdyYXBwZWRQYXJlbnQgfSBvZiB0aGlzLnBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogd3JhcHBlZFBhcmVudC5yb3csXG4gICAgICAgICAgY29ubmVjdGVkUm93czogeyB3cmFwcGVkUGFyZW50IH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZpbHRlcmVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oVGFibGUpIHtcbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIFNwaW4gdGhyb3VnaCBhbGwgb2YgdGhlIHBhcmVudFRhYmxlcyBzbyB0aGF0IHRoZWlyIF9jYWNoZSBpcyBwcmUtYnVpbHRcbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgaWYgKCFwYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgICAgY29uc3QgaXRlcmF0b3IgPSBwYXJlbnRUYWJsZS5pdGVyYXRlKCk7XG4gICAgICAgIGxldCB0ZW1wO1xuICAgICAgICB3aGlsZSAoIXRlbXAgfHwgIXRlbXAuZG9uZSkge1xuICAgICAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiBwYXJlbnRUYWJsZXMpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGluZGV4IGluIHBhcmVudFRhYmxlLl9jYWNoZSkge1xuICAgICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0pIHtcbiAgICAgICAgICBjb25zdCBjb25uZWN0ZWRSb3dzID0ge307XG4gICAgICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZTIgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICAgICAgICBjb25uZWN0ZWRSb3dzW3BhcmVudFRhYmxlMi50YWJsZUlkXSA9IHBhcmVudFRhYmxlMi5fY2FjaGVbaW5kZXhdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMud3JhcCh7IGluZGV4LCBjb25uZWN0ZWRSb3dzIH0pO1xuICAgICAgICAgIHRoaXMuX2R1cGxpY2F0ZUF0dHJpYnV0ZXMod3JhcHBlZEl0ZW0sIGNvbm5lY3RlZFJvd3MpO1xuICAgICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLl9tdXJlIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBfbXVyZSwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb24gPSBvcHRpb25zLmFubm90YXRpb24gfHwgJyc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uOiB0aGlzLmFubm90YXRpb25cbiAgICB9O1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jdXN0b21OYW1lICE9PSBudWxsO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jdXN0b21OYW1lIHx8IHRoaXMuX2F1dG9EZXJpdmVDbGFzc05hbWUoKTtcbiAgfVxuICBnZXRIYXNoVGFibGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiBhdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgfVxuICBfYXV0b0Rlcml2ZUNsYXNzTmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLl9tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBkaXJlY3RlZCwgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgY29uc3QgdGhpc0hhc2ggPSB0aGlzLmdldEhhc2hUYWJsZShhdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLmdldEhhc2hUYWJsZShvdGhlckF0dHJpYnV0ZSk7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzSGFzaC5jb25uZWN0KFtvdGhlckhhc2hdKTtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBzb3VyY2VOb2RlQXR0cjogYXR0cmlidXRlLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldE5vZGVBdHRyOiBvdGhlckF0dHJpYnV0ZVxuICAgIH0pO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlcygpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXRzKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLl9tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyO1xuXG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VOb2RlQXR0ciA9IG9wdGlvbnMuc291cmNlTm9kZUF0dHIgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZUVkZ2VBdHRyID0gb3B0aW9ucy5zb3VyY2VFZGdlQXR0ciB8fCBudWxsO1xuXG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXROb2RlQXR0ciA9IG9wdGlvbnMudGFyZ2V0Tm9kZUF0dHIgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldEVkZ2VBdHRyID0gb3B0aW9ucy50YXJnZXRFZGdlQXR0ciB8fCBudWxsO1xuXG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC5zb3VyY2VOb2RlQXR0ciA9IHRoaXMuc291cmNlTm9kZUF0dHI7XG4gICAgcmVzdWx0LnNvdXJjZUVkZ2VBdHRyID0gdGhpcy5zb3VyY2VFZGdlQXR0cjtcblxuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXROb2RlQXR0ciA9IHRoaXMudGFyZ2V0Tm9kZUF0dHI7XG4gICAgcmVzdWx0LnRhcmdldEVkZ2VBdHRyID0gdGhpcy50YXJnZXRFZGdlQXR0cjtcblxuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCBkaXJlY3Rpb24sIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSkge1xuICAgIGlmIChkaXJlY3Rpb24gIT09ICdzb3VyY2UnICYmIGRpcmVjdGlvbiAhPT0gJ3RhcmdldCcpIHtcbiAgICAgIGRpcmVjdGlvbiA9IHRoaXMudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCA/ICd0YXJnZXQnIDogJ3NvdXJjZSc7XG4gICAgfVxuICAgIGlmIChkaXJlY3Rpb24gPT09ICd0YXJnZXQnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RUYXJnZXQoeyBub2RlQ2xhc3MsIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZSh7IG5vZGVDbGFzcywgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KTtcbiAgICB9XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIHRvZ2dsZU5vZGVEaXJlY3Rpb24gKHNvdXJjZUNsYXNzSWQpIHtcbiAgICBpZiAoIXNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICBpZiAoc291cmNlQ2xhc3NJZCAhPT0gdGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IHN3YXAgdG8gdW5jb25uZWN0ZWQgY2xhc3MgaWQ6ICR7c291cmNlQ2xhc3NJZH1gKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgdGVtcCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSB0ZW1wO1xuICAgICAgICB0ZW1wID0gdGhpcy5zb3VyY2VOb2RlQXR0cjtcbiAgICAgICAgdGhpcy5zb3VyY2VOb2RlQXR0ciA9IHRoaXMudGFyZ2V0Tm9kZUF0dHI7XG4gICAgICAgIHRoaXMudGFyZ2V0Tm9kZUF0dHIgPSB0ZW1wO1xuICAgICAgICB0ZW1wID0gdGhpcy5pbnRlcm1lZGlhdGVTb3VyY2VzO1xuICAgICAgICB0aGlzLnNvdXJjZUVkZ2VBdHRyID0gdGhpcy50YXJnZXRFZGdlQXR0cjtcbiAgICAgICAgdGhpcy50YXJnZXRFZGdlQXR0ciA9IHRlbXA7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBjb25uZWN0U291cmNlICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNraXBTYXZlID0gZmFsc2VcbiAgfSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5zb3VyY2VOb2RlQXR0ciA9IG5vZGVBdHRyaWJ1dGU7XG4gICAgdGhpcy5zb3VyY2VFZGdlQXR0ciA9IGVkZ2VBdHRyaWJ1dGU7XG5cbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlLCBza2lwU2F2ZSA9IGZhbHNlIH0pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMudGFyZ2V0Tm9kZUF0dHIgPSBub2RlQXR0cmlidXRlO1xuICAgIHRoaXMudGFyZ2V0RWRnZUF0dHIgPSBlZGdlQXR0cmlidXRlO1xuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0U291cmNlICh7IHNraXBTYXZlID0gZmFsc2UgfSkge1xuICAgIGlmICh0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXSkge1xuICAgICAgZGVsZXRlIHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZU5vZGVBdHRyID0gbnVsbDtcbiAgICB0aGlzLnNvdXJjZUVkZ2VBdHRyID0gbnVsbDtcbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKHsgc2tpcFNhdmUgPSBmYWxzZSB9KSB7XG4gICAgaWYgKHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdKSB7XG4gICAgICBkZWxldGUgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Tm9kZUF0dHIgPSBudWxsO1xuICAgIHRoaXMudGFyZ2V0RWRnZUF0dHIgPSBudWxsO1xuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRSb3dzID0gb3B0aW9ucy5jb25uZWN0ZWRSb3dzIHx8IHt9O1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiY2xhc3MgSW5NZW1vcnlJbmRleCB7XG4gIGNvbnN0cnVjdG9yICh7IGVudHJpZXMgPSB7fSwgY29tcGxldGUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICB0aGlzLmVudHJpZXMgPSBlbnRyaWVzO1xuICAgIHRoaXMuY29tcGxldGUgPSBjb21wbGV0ZTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcztcbiAgfVxuICBhc3luYyAqIGl0ZXJFbnRyaWVzICgpIHtcbiAgICBmb3IgKGNvbnN0IFtoYXNoLCB2YWx1ZUxpc3RdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHsgaGFzaCwgdmFsdWVMaXN0IH07XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlckhhc2hlcyAoKSB7XG4gICAgZm9yIChjb25zdCBoYXNoIG9mIE9iamVjdC5rZXlzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIGhhc2g7XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlclZhbHVlTGlzdHMgKCkge1xuICAgIGZvciAoY29uc3QgdmFsdWVMaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgdmFsdWVMaXN0O1xuICAgIH1cbiAgfVxuICBhc3luYyBnZXRWYWx1ZUxpc3QgKGhhc2gpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzW2hhc2hdIHx8IFtdO1xuICB9XG4gIGFzeW5jIGFkZFZhbHVlIChoYXNoLCB2YWx1ZSkge1xuICAgIC8vIFRPRE86IGFkZCBzb21lIGtpbmQgb2Ygd2FybmluZyBpZiB0aGlzIGlzIGdldHRpbmcgYmlnP1xuICAgIHRoaXMuZW50cmllc1toYXNoXSA9IGF3YWl0IHRoaXMuZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgIGlmICh0aGlzLmVudHJpZXNbaGFzaF0uaW5kZXhPZih2YWx1ZSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbk1lbW9yeUluZGV4O1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgKiBhcyBUQUJMRVMgZnJvbSAnLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuaW1wb3J0ICogYXMgV1JBUFBFUlMgZnJvbSAnLi9XcmFwcGVycy9XcmFwcGVycy5qcyc7XG5pbXBvcnQgKiBhcyBJTkRFWEVTIGZyb20gJy4vSW5kZXhlcy9JbmRleGVzLmpzJztcblxubGV0IE5FWFRfQ0xBU1NfSUQgPSAxO1xubGV0IE5FWFRfVEFCTEVfSUQgPSAxO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoRmlsZVJlYWRlciwgbG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBlaXRoZXIgd2luZG93LmxvY2FsU3RvcmFnZSBvciBudWxsXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG4gICAgdGhpcy5EQVRBTElCX0ZPUk1BVFMgPSB7XG4gICAgICAnanNvbic6ICdqc29uJyxcbiAgICAgICdjc3YnOiAnY3N2JyxcbiAgICAgICd0c3YnOiAndHN2JyxcbiAgICAgICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICAgICAndHJlZWpzb24nOiAndHJlZWpzb24nXG4gICAgfTtcblxuICAgIC8vIEFjY2VzcyB0byBjb3JlIGNsYXNzZXMgdmlhIHRoZSBtYWluIGxpYnJhcnkgaGVscHMgYXZvaWQgY2lyY3VsYXIgaW1wb3J0c1xuICAgIHRoaXMuVEFCTEVTID0gVEFCTEVTO1xuICAgIHRoaXMuQ0xBU1NFUyA9IENMQVNTRVM7XG4gICAgdGhpcy5XUkFQUEVSUyA9IFdSQVBQRVJTO1xuICAgIHRoaXMuSU5ERVhFUyA9IElOREVYRVM7XG5cbiAgICAvLyBEZWZhdWx0IG5hbWVkIGZ1bmN0aW9uc1xuICAgIHRoaXMuTkFNRURfRlVOQ1RJT05TID0ge1xuICAgICAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7IHlpZWxkIHdyYXBwZWRJdGVtLnJhd0l0ZW07IH0sXG4gICAgICBrZXk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7XG4gICAgICAgIGlmICghd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEdyYW5kcGFyZW50IGlzIG5vdCBhbiBvYmplY3QgLyBhcnJheWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICBpZiAoIShwYXJlbnRUeXBlID09PSAnbnVtYmVyJyB8fCBwYXJlbnRUeXBlID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXJlbnQgaXNuJ3QgYSBrZXkgLyBpbmRleGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRGaW5pc2g6IGZ1bmN0aW9uICogKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkge1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgbGVmdDogdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0sXG4gICAgICAgICAgcmlnaHQ6IG90aGVyV3JhcHBlZEl0ZW0ucmF3SXRlbVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHNoYTE6IHJhd0l0ZW0gPT4gc2hhMShKU09OLnN0cmluZ2lmeShyYXdJdGVtKSksXG4gICAgICBub29wOiAoKSA9PiB7fVxuICAgIH07XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnRhYmxlcyA9IHRoaXMuaHlkcmF0ZSgnbXVyZV90YWJsZXMnKTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMuaHlkcmF0ZSgnbXVyZV9jbGFzc2VzJyk7XG4gIH1cblxuICBzYXZlVGFibGVzICgpIHtcbiAgICB0aGlzLmRlaHlkcmF0ZSgnbXVyZV90YWJsZXMnLCB0aGlzLnRhYmxlcyk7XG4gIH1cbiAgc2F2ZUNsYXNzZXMgKCkge1xuICAgIHRoaXMuZGVoeWRyYXRlKCdtdXJlX2NsYXNzZXMnLCB0aGlzLmNsYXNzZXMpO1xuICB9XG5cbiAgaHlkcmF0ZSAoc3RvcmFnZUtleSwgVFlQRVMpIHtcbiAgICBsZXQgY29udGFpbmVyID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShzdG9yYWdlS2V5KTtcbiAgICBjb250YWluZXIgPSBjb250YWluZXIgPyBKU09OLnBhcnNlKGNvbnRhaW5lcikgOiB7fTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb250YWluZXIpKSB7XG4gICAgICBjb25zdCB0eXBlID0gdmFsdWUudHlwZTtcbiAgICAgIGRlbGV0ZSB2YWx1ZS50eXBlO1xuICAgICAgY29udGFpbmVyW2tleV0gPSBuZXcgVFlQRVNbdHlwZV0odmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gY29udGFpbmVyO1xuICB9XG4gIGdldFJhd09iamVjdCAoY29udGFpbmVyKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge307XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHJlc3VsdFtrZXldLnR5cGUgPSB2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGRlaHlkcmF0ZSAoc3RvcmFnZUtleSwgY29udGFpbmVyKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKHN0b3JhZ2VLZXksIEpTT04uc3RyaW5naWZ5KHRoaXMuZ2V0UmF3T2JqZWN0KGNvbnRhaW5lcikpKTtcbiAgICB9XG4gIH1cbiAgaHlkcmF0ZUZ1bmN0aW9uIChzdHJpbmdpZmllZEZ1bmMpIHtcbiAgICBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cblxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy50YWJsZUlkKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke05FWFRfVEFCTEVfSUR9YDtcbiAgICAgIE5FWFRfVEFCTEVfSUQgKz0gMTtcbiAgICB9XG4gICAgY29uc3QgVHlwZSA9IHRoaXMuVEFCTEVTW29wdGlvbnMudHlwZV07XG4gICAgZGVsZXRlIG9wdGlvbnMudHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIGlmICghb3B0aW9ucy5jbGFzc0lkKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke05FWFRfQ0xBU1NfSUR9YDtcbiAgICAgIE5FWFRfQ0xBU1NfSUQgKz0gMTtcbiAgICB9XG4gICAgY29uc3QgVHlwZSA9IHRoaXMuQ0xBU1NFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIG5ld1RhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGVPYmogPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZU9iajtcbiAgfVxuICBuZXdDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld0NsYXNzT2JqID0gdGhpcy5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0NsYXNzT2JqO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljVGFibGUgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY1RhYmxlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24gPSAndHh0JywgdGV4dCB9KSB7XG4gICAgbGV0IGRhdGEsIGF0dHJpYnV0ZXM7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3QnO1xuICAgIGxldCBuZXdUYWJsZSA9IHRoaXMubmV3VGFibGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlQWxsVW51c2VkVGFibGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IHRhYmxlSWQgaW4gdGhpcy50YWJsZXMpIHtcbiAgICAgIGlmICh0aGlzLnRhYmxlc1t0YWJsZUlkXSkge1xuICAgICAgICB0cnkgeyB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTsgfSBjYXRjaCAoZXJyKSB7fVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBkZWxldGVBbGxDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgY2xhc3NPYmouZGVsZXRlKCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKHdpbmRvdy5GaWxlUmVhZGVyLCB3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsIm9mZiIsImluZGV4Iiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5Iiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiT2JqZWN0IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJUYWJsZSIsIm9wdGlvbnMiLCJfbXVyZSIsIm11cmUiLCJ0YWJsZUlkIiwiRXJyb3IiLCJfZXhwZWN0ZWRBdHRyaWJ1dGVzIiwiYXR0cmlidXRlcyIsIl9vYnNlcnZlZEF0dHJpYnV0ZXMiLCJfZGVyaXZlZFRhYmxlcyIsImRlcml2ZWRUYWJsZXMiLCJfZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImh5ZHJhdGVGdW5jdGlvbiIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwidXNlZEJ5Q2xhc3NlcyIsIl91c2VkQnlDbGFzc2VzIiwiZnVuYyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwiaXRlcmF0ZSIsInJlc2V0IiwibGltaXQiLCJJbmZpbml0eSIsIl9jYWNoZSIsImZpbmlzaGVkSXRlbSIsInZhbHVlcyIsIl9idWlsZENhY2hlIiwiX3BhcnRpYWxDYWNoZSIsImRlcml2ZWRUYWJsZSIsIml0ZXJhdG9yIiwiX2l0ZXJhdGUiLCJjb21wbGV0ZWQiLCJuZXh0IiwiZG9uZSIsIl9maW5pc2hJdGVtIiwid3JhcHBlZEl0ZW0iLCJyb3ciLCJrZXlzIiwiX3dyYXAiLCJ0YWJsZSIsImNsYXNzT2JqIiwiV1JBUFBFUlMiLCJHZW5lcmljV3JhcHBlciIsIl9nZXRBbGxBdHRyaWJ1dGVzIiwiYWxsQXR0cnMiLCJkZXJpdmVBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwic2F2ZVRhYmxlcyIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZUlkIiwiZmluZCIsInRhYmxlT2JqIiwidGFibGVzIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJuYW1lIiwiYWdncmVnYXRlIiwiZXhwYW5kIiwiZGVsaW1pdGVyIiwiY2xvc2VkRmFjZXQiLCJtYXAiLCJvcGVuRmFjZXQiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJvdGhlclRhYmxlIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImRlbGV0ZSIsImxlbmd0aCIsInBhcmVudFRhYmxlIiwiZXhlYyIsIlN0YXRpY1RhYmxlIiwiX2RhdGEiLCJkYXRhIiwib2JqIiwiaXRlbSIsIlN0YXRpY0RpY3QiLCJTaW5nbGVQYXJlbnRNaXhpbiIsIl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4iLCJBZ2dyZWdhdGVkVGFibGUiLCJfYXR0cmlidXRlIiwiX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsInJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsIl9kZWh5ZHJhdGVGdW5jdGlvbiIsIl91cGRhdGVJdGVtIiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsIm5ld1dyYXBwZWRJdGVtIiwid3JhcHBlZFBhcmVudCIsImNvbm5lY3RlZFJvd3MiLCJEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfaW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9kdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlQXR0cmlidXRlIiwicGFyZW50SWQiLCJfZHVwbGljYXRlQXR0cmlidXRlcyIsIkV4cGFuZGVkVGFibGUiLCJwYXJlbnRUYWJsZUlkIiwic3BsaXQiLCJGaWx0ZXJlZFRhYmxlIiwiX3ZhbHVlIiwidG9SYXdPYmplY3QiLCJDb25uZWN0ZWRUYWJsZSIsInBhcmVudFRhYmxlMiIsIndyYXAiLCJHZW5lcmljQ2xhc3MiLCJjbGFzc0lkIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsImFubm90YXRpb24iLCJzZXRDbGFzc05hbWUiLCJzYXZlQ2xhc3NlcyIsImhhc0N1c3RvbU5hbWUiLCJfY3VzdG9tTmFtZSIsIl9hdXRvRGVyaXZlQ2xhc3NOYW1lIiwiZ2V0SGFzaFRhYmxlIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm5ld0NsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc0lkcyIsIldyYXBwZXIiLCJOb2RlV3JhcHBlciIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwiZGlyZWN0ZWQiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJzb3VyY2VDbGFzc0lkIiwic291cmNlTm9kZUF0dHIiLCJ0YXJnZXRDbGFzc0lkIiwidGFyZ2V0Tm9kZUF0dHIiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJlZGdlQ2xhc3MiLCJub2RlQ2xhc3MiLCJkaXNjb25uZWN0QWxsRWRnZXMiLCJlZGdlQ2xhc3NJZCIsImRpc2Nvbm5lY3RTb3VyY2VzIiwiZGlzY29ubmVjdFRhcmdldHMiLCJFZGdlQ2xhc3MiLCJFZGdlV3JhcHBlciIsInNvdXJjZUVkZ2VBdHRyIiwidGFyZ2V0RWRnZUF0dHIiLCJkaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImNvbm5lY3RUYXJnZXQiLCJjb25uZWN0U291cmNlIiwidG9nZ2xlTm9kZURpcmVjdGlvbiIsImludGVybWVkaWF0ZVNvdXJjZXMiLCJza2lwU2F2ZSIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0IiwidW5kZWZpbmVkIiwiSW5NZW1vcnlJbmRleCIsImNvbXBsZXRlIiwiaXRlckVudHJpZXMiLCJoYXNoIiwidmFsdWVMaXN0IiwiaXRlckhhc2hlcyIsIml0ZXJWYWx1ZUxpc3RzIiwiZ2V0VmFsdWVMaXN0IiwiYWRkVmFsdWUiLCJORVhUX0NMQVNTX0lEIiwiTkVYVF9UQUJMRV9JRCIsIk11cmUiLCJGaWxlUmVhZGVyIiwibG9jYWxTdG9yYWdlIiwibWltZSIsImRlYnVnIiwiREFUQUxJQl9GT1JNQVRTIiwiVEFCTEVTIiwiQ0xBU1NFUyIsIklOREVYRVMiLCJOQU1FRF9GVU5DVElPTlMiLCJpZGVudGl0eSIsInJhd0l0ZW0iLCJrZXkiLCJUeXBlRXJyb3IiLCJwYXJlbnRUeXBlIiwiZGVmYXVsdEZpbmlzaCIsInRoaXNXcmFwcGVkSXRlbSIsIm90aGVyV3JhcHBlZEl0ZW0iLCJsZWZ0IiwicmlnaHQiLCJzaGExIiwiSlNPTiIsInN0cmluZ2lmeSIsIm5vb3AiLCJoeWRyYXRlIiwiZGVoeWRyYXRlIiwic3RvcmFnZUtleSIsIlRZUEVTIiwiY29udGFpbmVyIiwiZ2V0SXRlbSIsInBhcnNlIiwiZ2V0UmF3T2JqZWN0Iiwic2V0SXRlbSIsIkZ1bmN0aW9uIiwidG9TdHJpbmciLCJUeXBlIiwiY3JlYXRlQ2xhc3MiLCJzZWxlY3RvciIsIm5ld1RhYmxlT2JqIiwibmV3Q2xhc3NPYmoiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwiY29uc29sZSIsIndhcm4iLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJlcnIiLCJkZWxldGVBbGxDbGFzc2VzIiwid2luZG93IiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QkMsdUJBQXZCLEVBQWdEO1VBQzVDLENBQUMsS0FBS0wsYUFBTCxDQUFtQkcsU0FBbkIsQ0FBTCxFQUFvQzthQUM3QkgsYUFBTCxDQUFtQkcsU0FBbkIsSUFBZ0MsRUFBaEM7OztVQUVFLENBQUNFLHVCQUFMLEVBQThCO1lBQ3hCLEtBQUtMLGFBQUwsQ0FBbUJHLFNBQW5CLEVBQThCRyxPQUE5QixDQUFzQ0YsUUFBdEMsTUFBb0QsQ0FBQyxDQUF6RCxFQUE0RDs7Ozs7V0FJekRKLGFBQUwsQ0FBbUJHLFNBQW5CLEVBQThCSSxJQUE5QixDQUFtQ0gsUUFBbkM7OztJQUVGSSxHQUFHLENBQUVMLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNwQixLQUFLSixhQUFMLENBQW1CRyxTQUFuQixDQUFKLEVBQW1DO1lBQzdCLENBQUNDLFFBQUwsRUFBZTtpQkFDTixLQUFLSixhQUFMLENBQW1CRyxTQUFuQixDQUFQO1NBREYsTUFFTztjQUNETSxLQUFLLEdB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
