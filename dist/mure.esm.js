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

  get name() {
    throw new Error(`this function should be overridden`);
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

  get currentData() {
    return {
      data: this._cache || this._partialCache || {},
      complete: !!this._cache
    };
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
    const existingTableId = this.derivedTables.find(tableObj => {
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
    return Object.keys(this._derivedTables).map(tableId => {
      return this._mure.tables[tableId];
    });
  }

  delete() {
    if (Object.keys(this._derivedTables).length > 0 || this.classObj) {
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
    this._name = options.name;
    this._data = options.data || [];

    if (!this._name || !this._data) {
      throw new Error(`name and data are required`);
    }
  }

  get name() {
    return this._name;
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.name = this._name;
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
    this._name = options.name;
    this._data = options.data || {};

    if (!this._name || !this._data) {
      throw new Error(`name and data are required`);
    }
  }

  get name() {
    return this._name;
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.name = this._name;
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

  get name() {
    return this.parentTable.name + '↦';
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

  get name() {
    return this.parentTable.name + '↤';
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

  get name() {
    return '⊂' + this.parentTable.name;
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
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('⨯');
  }

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
    return this._customName || this.table.name;
  }

  getHashTable(attribute) {
    return attribute === null ? this.table : this.table.aggregate(attribute);
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

    const newEdgeClass = this._mure.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      directed,
      sourceClassId: this.classId,
      sourceNodeAttr: attribute,
      targetClassId: otherNodeClass.classId,
      targetNodeAttr: otherAttribute
    });

    this.edgeClassIds[newEdgeClass.classId] = true;
    otherNodeClass.edgeClassIds[newEdgeClass.classId] = true;

    this._mure.saveClasses();

    return newEdgeClass;
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
        edgeClass.disconnectSource();
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTarget();
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
  } = {}) {
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
  } = {}) {
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
  } = {}) {
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
  } = {}) {
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

    this.tables = this.hydrate('mure_tables', this.TABLES); // Object containing our class specifications

    this.classes = this.hydrate('mure_classes', this.CLASSES);
  }

  saveTables() {
    this.dehydrate('mure_tables', this.tables);
    this.trigger('tableUpdate');
  }

  saveClasses() {
    this.dehydrate('mure_classes', this.classes);
    this.trigger('classUpdate');
  }

  hydrate(storageKey, TYPES) {
    let container = this.localStorage && this.localStorage.getItem(storageKey);
    container = container ? JSON.parse(container) : {};

    for (const [key, value] of Object.entries(container)) {
      const type = value.type;
      delete value.type;
      value.mure = this;
      container[key] = new TYPES[type](value);
    }

    return container;
  }

  dehydrate(storageKey, container) {
    if (this.localStorage) {
      const result = {};

      for (const [key, value] of Object.entries(container)) {
        result[key] = value._toRawObject();
        result[key].type = value.constructor.name;
      }

      this.localStorage.setItem(storageKey, JSON.stringify(result));
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
      name: options.name,
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

  getClassData() {
    const results = {};

    for (const classObj of Object.values(this.classes)) {
      results[classObj.classId] = classObj.currentData;
    }
  }

}

var name = "mure";
var version = "0.5.2";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdC5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GaWx0ZXJlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Db25uZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9JbmRleGVzL0luTWVtb3J5SW5kZXguanMiLCIuLi9zcmMvTXVyZS5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICBpZiAoIXRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoIWFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKSAhPT0gLTEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudE5hbWUsIC4uLmFyZ3MpIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fbXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLl9tdXJlIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbXVyZSBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBpZiAob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgYXR0cmlidXRlczogdGhpcy5fYXR0cmlidXRlcyxcbiAgICAgIGRlcml2ZWRUYWJsZXM6IHRoaXMuX2Rlcml2ZWRUYWJsZXMsXG4gICAgICB1c2VkQnlDbGFzc2VzOiB0aGlzLl91c2VkQnlDbGFzc2VzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge31cbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAob3B0aW9ucyA9IHsgcmVzZXQ6IGZhbHNlLCBsaW1pdDogSW5maW5pdHkgfSkge1xuICAgIC8vIEdlbmVyaWMgY2FjaGluZyBzdHVmZjsgdGhpcyBpc24ndCBqdXN0IGZvciBwZXJmb3JtYW5jZS4gQ29ubmVjdGVkVGFibGUnc1xuICAgIC8vIGFsZ29yaXRobSByZXF1aXJlcyB0aGF0IGl0cyBwYXJlbnQgdGFibGVzIGhhdmUgcHJlLWJ1aWx0IGluZGV4ZXMgKHdlXG4gICAgLy8gdGVjaG5pY2FsbHkgY291bGQgaW1wbGVtZW50IGl0IGRpZmZlcmVudGx5LCBidXQgaXQgd291bGQgYmUgZXhwZW5zaXZlLFxuICAgIC8vIHJlcXVpcmVzIHRyaWNreSBsb2dpYywgYW5kIHdlJ3JlIGFscmVhZHkgYnVpbGRpbmcgaW5kZXhlcyBmb3Igc29tZSB0YWJsZXNcbiAgICAvLyBsaWtlIEFnZ3JlZ2F0ZWRUYWJsZSBhbnl3YXkpXG4gICAgaWYgKG9wdGlvbnMucmVzZXQpIHtcbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICBmb3IgKGNvbnN0IGZpbmlzaGVkSXRlbSBvZiBPYmplY3QudmFsdWVzKHRoaXMuX2NhY2hlKSkge1xuICAgICAgICB5aWVsZCBmaW5pc2hlZEl0ZW07XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgeWllbGQgKiBhd2FpdCB0aGlzLl9idWlsZENhY2hlKG9wdGlvbnMpO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBmb3IgKGNvbnN0IGRlcml2ZWRUYWJsZSBvZiB0aGlzLmRlcml2ZWRUYWJsZXMpIHtcbiAgICAgIGRlcml2ZWRUYWJsZS5yZXNldCgpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jlc2V0Jyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucykge1xuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQ7XG4gICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpO1xuICAgIGxldCBjb21wbGV0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBpdGVyYXRpb24gd2FzIGNhbmNlbGxlZDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgY29tcGxldGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHRlbXAudmFsdWUpO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGVtcC52YWx1ZS5pbmRleF0gPSB0ZW1wLnZhbHVlO1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgT2JqZWN0LmtleXMod3JhcHBlZEl0ZW0ucm93KSkge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgcmV0dXJuIGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBfZ2V0QWxsQXR0cmlidXRlcyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG4gIGdldCBhdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZ2V0QWxsQXR0cmlidXRlcygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMuX211cmUuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlVGFibGVzKCk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZUlkID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlSWQgJiYgdGhpcy5fbXVyZS50YWJsZXNbZXhpc3RpbmdUYWJsZUlkXSkgfHwgbnVsbDtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnQWdncmVnYXRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnRXhwYW5kZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBkZWxpbWl0ZXJcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGaWx0ZXJlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChvcHRpb25zKSB7XG4gICAgY29uc3QgdmFsdWVzID0ge307XG4gICAgY29uc3QgYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgZGVsZXRlIG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGaWx0ZXJlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMuX211cmUuY3JlYXRlVGFibGUoeyB0eXBlOiAnQ29ubmVjdGVkVGFibGUnIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5fbXVyZS50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLmRlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXSkge1xuICAgICAgICBhZ2cucHVzaCh0YWJsZU9iaik7XG4gICAgICB9XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDAgfHwgdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbShpdGVtKTtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljRGljdCBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSk7XG4gICAgICB5aWVsZCBpdGVtO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdDtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWllcmQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgQWdncmVnYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBpZiAob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuX2RlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpic7XG4gIH1cbiAgX3VwZGF0ZUl0ZW0gKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG5ld1dyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG5ld1dyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zKSB7XG4gICAgLy8gV2Ugb3ZlcnJpZGUgX2J1aWxkQ2FjaGUgYmVjYXVzZSBzbyB0aGF0IEFnZ3JlZ2F0ZWRUYWJsZSBjYW4gdGFrZSBhZHZhbnRhZ2VcbiAgICAvLyBvZiB0aGUgcGFydGlhbGx5LWJ1aWx0IGNhY2hlIGFzIGl0IGdvZXMsIGFuZCBwb3N0cG9uZSBmaW5pc2hpbmcgaXRlbXNcbiAgICAvLyB1bnRpbCBhZnRlciB0aGUgcGFyZW50IHRhYmxlIGhhcyBiZWVuIGZ1bGx5IGl0ZXJhdGVkXG5cbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbd3JhcHBlZEl0ZW0uaW5kZXhdID0gd3JhcHBlZEl0ZW07XG4gICAgICAvLyBHbyBhaGVhZCBhbmQgeWllbGQgdGhlIHVuZmluaXNoZWQgaXRlbTsgdGhpcyBtYWtlcyBpdCBwb3NzaWJsZSBmb3JcbiAgICAgIC8vIGNsaWVudCBhcHBzIHRvIGJlIG1vcmUgcmVzcG9uc2l2ZSBhbmQgcmVuZGVyIHBhcnRpYWwgcmVzdWx0cywgYnV0IGFsc29cbiAgICAgIC8vIG1lYW5zIHRoYXQgdGhleSBuZWVkIHRvIHdhdGNoIGZvciB3cmFwcGVkSXRlbS5vbigndXBkYXRlJykgZXZlbnRzXG4gICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICB9XG5cbiAgICAvLyBTZWNvbmQgcGFzczogbm93IHRoYXQgd2UndmUgY29tcGxldGVkIHRoZSBmdWxsIGl0ZXJhdGlvbiBvZiB0aGUgcGFyZW50XG4gICAgLy8gdGFibGUsIHdlIGNhbiBmaW5pc2ggZWFjaCBpdGVtXG4gICAgZm9yIChjb25zdCBpbmRleCBpbiB0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHsgd3JhcHBlZFBhcmVudCB9IG9mIHRoaXMucGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgaW5kZXggPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlW2luZGV4XSkge1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgeWllbGQgdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgY29ubmVjdGVkUm93czogeyB3cmFwcGVkUGFyZW50IH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF9nZXRBbGxBdHRyaWJ1dGVzICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fZ2V0QWxsQXR0cmlidXRlcygpO1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIHJlc3VsdFthdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEFnZ3JlZ2F0ZWRUYWJsZTtcbiIsImNvbnN0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmR1cGxpY2F0ZWRBdHRyaWJ1dGVzIHx8IHt9O1xuICAgIH1cbiAgICBfdG9SYXdPYmplY3QgKCkge1xuICAgICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgICBvYmouZHVwbGljYXRlZEF0dHJpYnV0ZXMgPSB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcztcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuICAgIGR1cGxpY2F0ZUF0dHJpYnV0ZSAocGFyZW50SWQsIGF0dHJpYnV0ZSkge1xuICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlc1twYXJlbnRJZF0gPSB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzW3BhcmVudElkXSB8fCBbXTtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzW3BhcmVudElkXS5wdXNoKGF0dHJpYnV0ZSk7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuICAgIF9kdXBsaWNhdGVBdHRyaWJ1dGVzICh3cmFwcGVkSXRlbSwgY29ubmVjdGVkUm93cykge1xuICAgICAgZm9yIChjb25zdCBbcGFyZW50SWQsIGF0dHJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICB3cmFwcGVkSXRlbS5yb3dbYCR7cGFyZW50SWR9LiR7YXR0cn1gXSA9IGNvbm5lY3RlZFJvd3NbcGFyZW50SWRdW2F0dHJdO1xuICAgICAgfVxuICAgIH1cbiAgICBfZ2V0QWxsQXR0cmlidXRlcyAoKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fZ2V0QWxsQXR0cmlidXRlcygpO1xuICAgICAgZm9yIChjb25zdCBbcGFyZW50SWQsIGF0dHJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICByZXN1bHRbYCR7cGFyZW50SWR9LiR7YXR0cn1gXSA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcbmltcG9ydCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gZnJvbSAnLi9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluKFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5kZWxpbWl0ZXIgPSBvcHRpb25zLmRlbGltaXRlciB8fCAnLCc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAn4oakJztcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZUlkID0gdGhpcy5wYXJlbnRUYWJsZS50YWJsZUlkO1xuICAgIGZvciBhd2FpdCAoY29uc3QgeyB3cmFwcGVkUGFyZW50IH0gb2YgdGhpcy5wYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCB2YWx1ZXMgPSAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5hdHRyaWJ1dGVdIHx8ICcnKS5zcGxpdCh0aGlzLmRlbGltaXRlcik7XG4gICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuICAgICAgICBjb25zdCByb3cgPSB7fTtcbiAgICAgICAgcm93W3RoaXMuYXR0cmlidXRlXSA9IHZhbHVlO1xuICAgICAgICBjb25zdCBjb25uZWN0ZWRSb3dzID0ge307XG4gICAgICAgIGNvbm5lY3RlZFJvd3NbcGFyZW50VGFibGVJZF0gPSB3cmFwcGVkUGFyZW50O1xuICAgICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93LCBjb25uZWN0ZWRSb3dzIH0pO1xuICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKHdyYXBwZWRJdGVtLCBjb25uZWN0ZWRSb3dzKTtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmlsdGVyZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5hdHRyaWJ1dGUgfHwgIXRoaXMudmFsdWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuICfiioInICsgdGhpcy5wYXJlbnRUYWJsZS5uYW1lO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3QgeyB3cmFwcGVkUGFyZW50IH0gb2YgdGhpcy5wYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBpZiAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3c6IHdyYXBwZWRQYXJlbnQucm93LFxuICAgICAgICAgIGNvbm5lY3RlZFJvd3M6IHsgd3JhcHBlZFBhcmVudCB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGaWx0ZXJlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiBmcm9tICcuL0R1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbi5qcyc7XG5cbmNsYXNzIENvbm5lY3RlZFRhYmxlIGV4dGVuZHMgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluKFRhYmxlKSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBTcGluIHRocm91Z2ggYWxsIG9mIHRoZSBwYXJlbnRUYWJsZXMgc28gdGhhdCB0aGVpciBfY2FjaGUgaXMgcHJlLWJ1aWx0XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiBwYXJlbnRUYWJsZXMpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICAgIGNvbnN0IGl0ZXJhdG9yID0gcGFyZW50VGFibGUuaXRlcmF0ZSgpO1xuICAgICAgICBsZXQgdGVtcDtcbiAgICAgICAgd2hpbGUgKCF0ZW1wIHx8ICF0ZW1wLmRvbmUpIHtcbiAgICAgICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlLl9jYWNoZSkge1xuICAgICAgICAvLyBPbmUgb2YgdGhlIHBhcmVudCB0YWJsZXMgd2FzIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBpbmRleCBpbiBwYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdKSB7XG4gICAgICAgICAgY29uc3QgY29ubmVjdGVkUm93cyA9IHt9O1xuICAgICAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUyIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgICAgICAgY29ubmVjdGVkUm93c1twYXJlbnRUYWJsZTIudGFibGVJZF0gPSBwYXJlbnRUYWJsZTIuX2NhY2hlW2luZGV4XTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLndyYXAoeyBpbmRleCwgY29ubmVjdGVkUm93cyB9KTtcbiAgICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKHdyYXBwZWRJdGVtLCBjb25uZWN0ZWRSb3dzKTtcbiAgICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fbXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5fbXVyZSB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgX211cmUsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9uID0gb3B0aW9ucy5hbm5vdGF0aW9uIHx8ICcnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGNsYXNzTmFtZTogdGhpcy5fY2xhc3NOYW1lLFxuICAgICAgYW5ub3RhdGlvbjogdGhpcy5hbm5vdGF0aW9uXG4gICAgfTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY3VzdG9tTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY3VzdG9tTmFtZSB8fCB0aGlzLnRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0SGFzaFRhYmxlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLl9tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBkaXJlY3RlZCwgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgY29uc3QgdGhpc0hhc2ggPSB0aGlzLmdldEhhc2hUYWJsZShhdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLmdldEhhc2hUYWJsZShvdGhlckF0dHJpYnV0ZSk7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzSGFzaC5jb25uZWN0KFtvdGhlckhhc2hdKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIGRpcmVjdGVkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlTm9kZUF0dHI6IGF0dHJpYnV0ZSxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXROb2RlQXR0cjogb3RoZXJBdHRyaWJ1dGVcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5fbXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlTm9kZUF0dHIgPSBvcHRpb25zLnNvdXJjZU5vZGVBdHRyIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VFZGdlQXR0ciA9IG9wdGlvbnMuc291cmNlRWRnZUF0dHIgfHwgbnVsbDtcblxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0Tm9kZUF0dHIgPSBvcHRpb25zLnRhcmdldE5vZGVBdHRyIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRFZGdlQXR0ciA9IG9wdGlvbnMudGFyZ2V0RWRnZUF0dHIgfHwgbnVsbDtcblxuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQuc291cmNlTm9kZUF0dHIgPSB0aGlzLnNvdXJjZU5vZGVBdHRyO1xuICAgIHJlc3VsdC5zb3VyY2VFZGdlQXR0ciA9IHRoaXMuc291cmNlRWRnZUF0dHI7XG5cbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0Tm9kZUF0dHIgPSB0aGlzLnRhcmdldE5vZGVBdHRyO1xuICAgIHJlc3VsdC50YXJnZXRFZGdlQXR0ciA9IHRoaXMudGFyZ2V0RWRnZUF0dHI7XG5cbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgZGlyZWN0aW9uLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pIHtcbiAgICBpZiAoZGlyZWN0aW9uICE9PSAnc291cmNlJyAmJiBkaXJlY3Rpb24gIT09ICd0YXJnZXQnKSB7XG4gICAgICBkaXJlY3Rpb24gPSB0aGlzLnRhcmdldENsYXNzSWQgPT09IG51bGwgPyAndGFyZ2V0JyA6ICdzb3VyY2UnO1xuICAgIH1cbiAgICBpZiAoZGlyZWN0aW9uID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2UoeyBub2RlQ2xhc3MsIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSk7XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICB0b2dnbGVOb2RlRGlyZWN0aW9uIChzb3VyY2VDbGFzc0lkKSB7XG4gICAgaWYgKCFzb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBpZiAoc291cmNlQ2xhc3NJZCAhPT0gdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBzd2FwIHRvIHVuY29ubmVjdGVkIGNsYXNzIGlkOiAke3NvdXJjZUNsYXNzSWR9YCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgICAgdGVtcCA9IHRoaXMuc291cmNlTm9kZUF0dHI7XG4gICAgICAgIHRoaXMuc291cmNlTm9kZUF0dHIgPSB0aGlzLnRhcmdldE5vZGVBdHRyO1xuICAgICAgICB0aGlzLnRhcmdldE5vZGVBdHRyID0gdGVtcDtcbiAgICAgICAgdGVtcCA9IHRoaXMuaW50ZXJtZWRpYXRlU291cmNlcztcbiAgICAgICAgdGhpcy5zb3VyY2VFZGdlQXR0ciA9IHRoaXMudGFyZ2V0RWRnZUF0dHI7XG4gICAgICAgIHRoaXMudGFyZ2V0RWRnZUF0dHIgPSB0ZW1wO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbCxcbiAgICBza2lwU2F2ZSA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5zb3VyY2VOb2RlQXR0ciA9IG5vZGVBdHRyaWJ1dGU7XG4gICAgdGhpcy5zb3VyY2VFZGdlQXR0ciA9IGVkZ2VBdHRyaWJ1dGU7XG5cbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlLCBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy50YXJnZXROb2RlQXR0ciA9IG5vZGVBdHRyaWJ1dGU7XG4gICAgdGhpcy50YXJnZXRFZGdlQXR0ciA9IGVkZ2VBdHRyaWJ1dGU7XG5cbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKHsgc2tpcFNhdmUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHtcbiAgICAgIGRlbGV0ZSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VOb2RlQXR0ciA9IG51bGw7XG4gICAgdGhpcy5zb3VyY2VFZGdlQXR0ciA9IG51bGw7XG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdKSB7XG4gICAgICBkZWxldGUgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Tm9kZUF0dHIgPSBudWxsO1xuICAgIHRoaXMudGFyZ2V0RWRnZUF0dHIgPSBudWxsO1xuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRSb3dzID0gb3B0aW9ucy5jb25uZWN0ZWRSb3dzIHx8IHt9O1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiY2xhc3MgSW5NZW1vcnlJbmRleCB7XG4gIGNvbnN0cnVjdG9yICh7IGVudHJpZXMgPSB7fSwgY29tcGxldGUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICB0aGlzLmVudHJpZXMgPSBlbnRyaWVzO1xuICAgIHRoaXMuY29tcGxldGUgPSBjb21wbGV0ZTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcztcbiAgfVxuICBhc3luYyAqIGl0ZXJFbnRyaWVzICgpIHtcbiAgICBmb3IgKGNvbnN0IFtoYXNoLCB2YWx1ZUxpc3RdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHsgaGFzaCwgdmFsdWVMaXN0IH07XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlckhhc2hlcyAoKSB7XG4gICAgZm9yIChjb25zdCBoYXNoIG9mIE9iamVjdC5rZXlzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIGhhc2g7XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlclZhbHVlTGlzdHMgKCkge1xuICAgIGZvciAoY29uc3QgdmFsdWVMaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgdmFsdWVMaXN0O1xuICAgIH1cbiAgfVxuICBhc3luYyBnZXRWYWx1ZUxpc3QgKGhhc2gpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzW2hhc2hdIHx8IFtdO1xuICB9XG4gIGFzeW5jIGFkZFZhbHVlIChoYXNoLCB2YWx1ZSkge1xuICAgIC8vIFRPRE86IGFkZCBzb21lIGtpbmQgb2Ygd2FybmluZyBpZiB0aGlzIGlzIGdldHRpbmcgYmlnP1xuICAgIHRoaXMuZW50cmllc1toYXNoXSA9IGF3YWl0IHRoaXMuZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgIGlmICh0aGlzLmVudHJpZXNbaGFzaF0uaW5kZXhPZih2YWx1ZSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbk1lbW9yeUluZGV4O1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgKiBhcyBUQUJMRVMgZnJvbSAnLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuaW1wb3J0ICogYXMgV1JBUFBFUlMgZnJvbSAnLi9XcmFwcGVycy9XcmFwcGVycy5qcyc7XG5pbXBvcnQgKiBhcyBJTkRFWEVTIGZyb20gJy4vSW5kZXhlcy9JbmRleGVzLmpzJztcblxubGV0IE5FWFRfQ0xBU1NfSUQgPSAxO1xubGV0IE5FWFRfVEFCTEVfSUQgPSAxO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoRmlsZVJlYWRlciwgbG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBlaXRoZXIgd2luZG93LmxvY2FsU3RvcmFnZSBvciBudWxsXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG4gICAgdGhpcy5EQVRBTElCX0ZPUk1BVFMgPSB7XG4gICAgICAnanNvbic6ICdqc29uJyxcbiAgICAgICdjc3YnOiAnY3N2JyxcbiAgICAgICd0c3YnOiAndHN2JyxcbiAgICAgICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICAgICAndHJlZWpzb24nOiAndHJlZWpzb24nXG4gICAgfTtcblxuICAgIC8vIEFjY2VzcyB0byBjb3JlIGNsYXNzZXMgdmlhIHRoZSBtYWluIGxpYnJhcnkgaGVscHMgYXZvaWQgY2lyY3VsYXIgaW1wb3J0c1xuICAgIHRoaXMuVEFCTEVTID0gVEFCTEVTO1xuICAgIHRoaXMuQ0xBU1NFUyA9IENMQVNTRVM7XG4gICAgdGhpcy5XUkFQUEVSUyA9IFdSQVBQRVJTO1xuICAgIHRoaXMuSU5ERVhFUyA9IElOREVYRVM7XG5cbiAgICAvLyBEZWZhdWx0IG5hbWVkIGZ1bmN0aW9uc1xuICAgIHRoaXMuTkFNRURfRlVOQ1RJT05TID0ge1xuICAgICAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7IHlpZWxkIHdyYXBwZWRJdGVtLnJhd0l0ZW07IH0sXG4gICAgICBrZXk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7XG4gICAgICAgIGlmICghd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEdyYW5kcGFyZW50IGlzIG5vdCBhbiBvYmplY3QgLyBhcnJheWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICBpZiAoIShwYXJlbnRUeXBlID09PSAnbnVtYmVyJyB8fCBwYXJlbnRUeXBlID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXJlbnQgaXNuJ3QgYSBrZXkgLyBpbmRleGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRGaW5pc2g6IGZ1bmN0aW9uICogKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkge1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgbGVmdDogdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0sXG4gICAgICAgICAgcmlnaHQ6IG90aGVyV3JhcHBlZEl0ZW0ucmF3SXRlbVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHNoYTE6IHJhd0l0ZW0gPT4gc2hhMShKU09OLnN0cmluZ2lmeShyYXdJdGVtKSksXG4gICAgICBub29wOiAoKSA9PiB7fVxuICAgIH07XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnRhYmxlcyA9IHRoaXMuaHlkcmF0ZSgnbXVyZV90YWJsZXMnLCB0aGlzLlRBQkxFUyk7XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBvdXIgY2xhc3Mgc3BlY2lmaWNhdGlvbnNcbiAgICB0aGlzLmNsYXNzZXMgPSB0aGlzLmh5ZHJhdGUoJ211cmVfY2xhc3NlcycsIHRoaXMuQ0xBU1NFUyk7XG4gIH1cblxuICBzYXZlVGFibGVzICgpIHtcbiAgICB0aGlzLmRlaHlkcmF0ZSgnbXVyZV90YWJsZXMnLCB0aGlzLnRhYmxlcyk7XG4gICAgdGhpcy50cmlnZ2VyKCd0YWJsZVVwZGF0ZScpO1xuICB9XG4gIHNhdmVDbGFzc2VzICgpIHtcbiAgICB0aGlzLmRlaHlkcmF0ZSgnbXVyZV9jbGFzc2VzJywgdGhpcy5jbGFzc2VzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NsYXNzVXBkYXRlJyk7XG4gIH1cblxuICBoeWRyYXRlIChzdG9yYWdlS2V5LCBUWVBFUykge1xuICAgIGxldCBjb250YWluZXIgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKHN0b3JhZ2VLZXkpO1xuICAgIGNvbnRhaW5lciA9IGNvbnRhaW5lciA/IEpTT04ucGFyc2UoY29udGFpbmVyKSA6IHt9O1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvbnRhaW5lcikpIHtcbiAgICAgIGNvbnN0IHR5cGUgPSB2YWx1ZS50eXBlO1xuICAgICAgZGVsZXRlIHZhbHVlLnR5cGU7XG4gICAgICB2YWx1ZS5tdXJlID0gdGhpcztcbiAgICAgIGNvbnRhaW5lcltrZXldID0gbmV3IFRZUEVTW3R5cGVdKHZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbnRhaW5lcjtcbiAgfVxuICBkZWh5ZHJhdGUgKHN0b3JhZ2VLZXksIGNvbnRhaW5lcikge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0ge307XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb250YWluZXIpKSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICAgIHJlc3VsdFtrZXldLnR5cGUgPSB2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShzdG9yYWdlS2V5LCBKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcbiAgICB9XG4gIH1cbiAgaHlkcmF0ZUZ1bmN0aW9uIChzdHJpbmdpZmllZEZ1bmMpIHtcbiAgICBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cblxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy50YWJsZUlkKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke05FWFRfVEFCTEVfSUR9YDtcbiAgICAgIE5FWFRfVEFCTEVfSUQgKz0gMTtcbiAgICB9XG4gICAgY29uc3QgVHlwZSA9IHRoaXMuVEFCTEVTW29wdGlvbnMudHlwZV07XG4gICAgZGVsZXRlIG9wdGlvbnMudHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIGlmICghb3B0aW9ucy5jbGFzc0lkKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke05FWFRfQ0xBU1NfSUR9YDtcbiAgICAgIE5FWFRfQ0xBU1NfSUQgKz0gMTtcbiAgICB9XG4gICAgY29uc3QgVHlwZSA9IHRoaXMuQ0xBU1NFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIG5ld1RhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGVPYmogPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZU9iajtcbiAgfVxuICBuZXdDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld0NsYXNzT2JqID0gdGhpcy5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0NsYXNzT2JqO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljVGFibGUgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY1RhYmxlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24gPSAndHh0JywgdGV4dCB9KSB7XG4gICAgbGV0IGRhdGEsIGF0dHJpYnV0ZXM7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3QnO1xuICAgIGxldCBuZXdUYWJsZSA9IHRoaXMubmV3VGFibGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlQWxsVW51c2VkVGFibGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IHRhYmxlSWQgaW4gdGhpcy50YWJsZXMpIHtcbiAgICAgIGlmICh0aGlzLnRhYmxlc1t0YWJsZUlkXSkge1xuICAgICAgICB0cnkgeyB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTsgfSBjYXRjaCAoZXJyKSB7fVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBkZWxldGVBbGxDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgY2xhc3NPYmouZGVsZXRlKCk7XG4gICAgfVxuICB9XG4gIGdldENsYXNzRGF0YSAoKSB7XG4gICAgY29uc3QgcmVzdWx0cyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICByZXN1bHRzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouY3VycmVudERhdGE7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKHdpbmRvdy5GaWxlUmVhZGVyLCB3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsIm9mZiIsImluZGV4Iiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5Iiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiT2JqZWN0IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJUYWJsZSIsIm9wdGlvbnMiLCJfbXVyZSIsIm11cmUiLCJ0YWJsZUlkIiwiRXJyb3IiLCJfZXhwZWN0ZWRBdHRyaWJ1dGVzIiwiYXR0cmlidXRlcyIsIl9vYnNlcnZlZEF0dHJpYnV0ZXMiLCJfZGVyaXZlZFRhYmxlcyIsImRlcml2ZWRUYWJsZXMiLCJfZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImh5ZHJhdGVGdW5jdGlvbiIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwidXNlZEJ5Q2xhc3NlcyIsIl91c2VkQnlDbGFzc2VzIiwiZnVuYyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwibmFtZSIsIml0ZXJhdGUiLCJyZXNldCIsImxpbWl0IiwiSW5maW5pdHkiLCJfY2FjaGUiLCJmaW5pc2hlZEl0ZW0iLCJ2YWx1ZXMiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJkZXJpdmVkVGFibGUiLCJpdGVyYXRvciIsIl9pdGVyYXRlIiwiY29tcGxldGVkIiwibmV4dCIsImRvbmUiLCJfZmluaXNoSXRlbSIsIndyYXBwZWRJdGVtIiwicm93Iiwia2V5cyIsIl93cmFwIiwidGFibGUiLCJjbGFzc09iaiIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJfZ2V0QWxsQXR0cmlidXRlcyIsImFsbEF0dHJzIiwiY3VycmVudERhdGEiLCJkYXRhIiwiY29tcGxldGUiLCJkZXJpdmVBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwic2F2ZVRhYmxlcyIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZUlkIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJ0YWJsZXMiLCJhZ2dyZWdhdGUiLCJleHBhbmQiLCJkZWxpbWl0ZXIiLCJjbG9zZWRGYWNldCIsIm1hcCIsIm9wZW5GYWNldCIsImNvbm5lY3QiLCJvdGhlclRhYmxlTGlzdCIsIm90aGVyVGFibGUiLCJjbGFzc2VzIiwicGFyZW50VGFibGVzIiwicmVkdWNlIiwiYWdnIiwiZGVsZXRlIiwibGVuZ3RoIiwicGFyZW50VGFibGUiLCJleGVjIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiaXRlbSIsIlN0YXRpY0RpY3QiLCJTaW5nbGVQYXJlbnRNaXhpbiIsIl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4iLCJBZ2dyZWdhdGVkVGFibGUiLCJfYXR0cmlidXRlIiwiX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsInJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsIl9kZWh5ZHJhdGVGdW5jdGlvbiIsIl91cGRhdGVJdGVtIiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsIm5ld1dyYXBwZWRJdGVtIiwid3JhcHBlZFBhcmVudCIsImNvbm5lY3RlZFJvd3MiLCJEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfaW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9kdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlQXR0cmlidXRlIiwicGFyZW50SWQiLCJfZHVwbGljYXRlQXR0cmlidXRlcyIsIkV4cGFuZGVkVGFibGUiLCJwYXJlbnRUYWJsZUlkIiwic3BsaXQiLCJGaWx0ZXJlZFRhYmxlIiwiX3ZhbHVlIiwidG9SYXdPYmplY3QiLCJDb25uZWN0ZWRUYWJsZSIsImpvaW4iLCJwYXJlbnRUYWJsZTIiLCJ3cmFwIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9jbGFzc05hbWUiLCJjbGFzc05hbWUiLCJhbm5vdGF0aW9uIiwic2V0Q2xhc3NOYW1lIiwic2F2ZUNsYXNzZXMiLCJoYXNDdXN0b21OYW1lIiwiX2N1c3RvbU5hbWUiLCJnZXRIYXNoVGFibGUiLCJpbnRlcnByZXRBc05vZGVzIiwibmV3Q2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiTm9kZUNsYXNzIiwiZWRnZUNsYXNzSWRzIiwiV3JhcHBlciIsIk5vZGVXcmFwcGVyIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJkaXJlY3RlZCIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNyZWF0ZUNsYXNzIiwic291cmNlQ2xhc3NJZCIsInNvdXJjZU5vZGVBdHRyIiwidGFyZ2V0Q2xhc3NJZCIsInRhcmdldE5vZGVBdHRyIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwiZWRnZUNsYXNzIiwibm9kZUNsYXNzIiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiZWRnZUNsYXNzSWQiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIkVkZ2VDbGFzcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlRWRnZUF0dHIiLCJ0YXJnZXRFZGdlQXR0ciIsImRpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiY29ubmVjdFRhcmdldCIsImNvbm5lY3RTb3VyY2UiLCJ0b2dnbGVOb2RlRGlyZWN0aW9uIiwiaW50ZXJtZWRpYXRlU291cmNlcyIsInNraXBTYXZlIiwidW5kZWZpbmVkIiwiSW5NZW1vcnlJbmRleCIsIml0ZXJFbnRyaWVzIiwiaGFzaCIsInZhbHVlTGlzdCIsIml0ZXJIYXNoZXMiLCJpdGVyVmFsdWVMaXN0cyIsImdldFZhbHVlTGlzdCIsImFkZFZhbHVlIiwiTkVYVF9DTEFTU19JRCIsIk5FWFRfVEFCTEVfSUQiLCJNdXJlIiwiRmlsZVJlYWRlciIsImxvY2FsU3RvcmFnZSIsIm1pbWUiLCJkZWJ1ZyIsIkRBVEFMSUJfRk9STUFUUyIsIlRBQkxFUyIsIkNMQVNTRVMiLCJJTkRFWEVTIiwiTkFNRURfRlVOQ1RJT05TIiwiaWRlbnRpdHkiLCJyYXdJdGVtIiwia2V5IiwiVHlwZUVycm9yIiwicGFyZW50VHlwZSIsImRlZmF1bHRGaW5pc2giLCJ0aGlzV3JhcHBlZEl0ZW0iLCJvdGhlcldyYXBwZWRJdGVtIiwibGVmdCIsInJpZ2h0Iiwic2hhMSIsIkpTT04iLCJzdHJpbmdpZnkiLCJub29wIiwiaHlkcmF0ZSIsImRlaHlkcmF0ZSIsInN0b3JhZ2VLZXkiLCJUWVBFUyIsImNvbnRhaW5lciIsImdldEl0ZW0iLCJwYXJzZSIsInNldEl0ZW0iLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiVHlwZSIsInNlbGVjdG9yIiwibmV3VGFibGVPYmoiLCJuZXdDbGFzc09iaiIsImFkZEZpbGVBc1N0YXRpY1RhYmxlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJjb25zb2xlIiwid2FybiIsInRleHQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJhZGRTdHJpbmdBc1N0YXRpY1RhYmxlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJBcnJheSIsImRlbGV0ZUFsbFVudXNlZFRhYmxlcyIsImVyciIsImRlbGV0ZUFsbENsYXNzZXMiLCJnZXRDbGFzc0RhdGEiLCJyZXN1bHRzIiwid2luZG93IiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QkMsdUJBQXZCLEVBQWdEO1VBQzVDLENBQUMsS0FBS0wsYUFBTCxDQUFtQkcsU0FBbkIsQ0FBTCxFQUFvQzthQUM3QkgsYUFBTCxDQUFtQkcsU0FBbkIsSUFB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
