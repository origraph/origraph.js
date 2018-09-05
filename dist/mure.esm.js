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
      if (tableObj._derivedTables[this.tableId]) {
        agg.push(tableObj);
      }

      return agg;
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

  deriveReducedAttribute(attr, func) {
    this._reduceAttributeFunctions[attr] = func;
    this.reset();
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
    for await (const wrappedParent of this.parentTable.iterate(options)) {
      const index = wrappedParent.row[this._attribute];

      if (!this._partialCache) {
        // We were reset; return immediately
        return;
      } else if (this._partialCache[index]) {
        this._updateItem(this._partialCache[index], wrappedParent);
      } else {
        const newItem = this._wrap({
          index,
          connectedRows: {
            wrappedParent
          }
        }); // Reduce operations still need to be applied to the first item


        this._updateItem(newItem, newItem);

        yield newItem;
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

    for await (const wrappedParent of this.parentTable.iterate(options)) {
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

    for await (const wrappedParent of this.parentTable.iterate(options)) {
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
    return this._className !== null;
  }

  get className() {
    return this._className || this.table.name;
  }

  getHashTable(attribute) {
    return attribute === null ? this.table : this.table.aggregate(attribute);
  }

  get table() {
    return this._mure.tables[this.tableId];
  }

  _wrap(options) {
    return new this._mure.WRAPPERS.GenericWrapper(options);
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

  aggregate(attribute) {
    const newTable = this.table.aggregate(attribute);
    return this._mure.newClass({
      tableId: newTable.tableId,
      type: 'GenericClass'
    });
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
    const edgeClassIds = Object.keys(this.edgeClassIds);

    const options = super._toRawObject();

    if (edgeClassIds.length > 2) {
      this.disconnectAllEdges();
    } else {
      if (edgeClassIds.length === 1 || edgeClassIds.length === 2) {
        const sourceEdgeClass = this._mure.classes[edgeClassIds[0]];
        options.sourceNodeId = sourceEdgeClass.sourceNodeId;
        options.sourceNodeAttr = sourceEdgeClass.sourceNodeAttr;
        options.sourceEdgeAttr = sourceEdgeClass.targetNodeAttr;
        sourceEdgeClass.delete();
      }

      if (edgeClassIds.length === 2) {
        const targetEdgeClass = this._mure.classes[edgeClassIds[1]];
        options.targetNodeId = targetEdgeClass.targetNodeId;
        options.targetNodeAttr = targetEdgeClass.targetNodeAttr;
        options.targetEdgeAttr = targetEdgeClass.sourceNodeAttr;
        targetEdgeClass.delete();
      }
    }

    this.delete();
    delete options.classId;
    options.type = 'EdgeClass';
    return this._mure.newClass(options);
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

    this.tables = this.hydrate('mure_tables', this.TABLES);
    NEXT_TABLE_ID = Object.keys(this.tables).reduce((highestNum, tableId) => {
      return Math.max(highestNum, parseInt(tableId.match(/table(\d*)/)[1]));
    }, 0) + 1; // Object containing our class specifications

    this.classes = this.hydrate('mure_classes', this.CLASSES);
    NEXT_CLASS_ID = Object.keys(this.classes).reduce((highestNum, classId) => {
      return Math.max(highestNum, parseInt(classId.match(/class(\d*)/)[1]));
    }, 0) + 1;
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
var version = "0.5.3";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdC5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GaWx0ZXJlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Db25uZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9JbmRleGVzL0luTWVtb3J5SW5kZXguanMiLCIuLi9zcmMvTXVyZS5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICBpZiAoIXRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoIWFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKSAhPT0gLTEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudE5hbWUsIC4uLmFyZ3MpIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fbXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLl9tdXJlIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbXVyZSBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBpZiAob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgYXR0cmlidXRlczogdGhpcy5fYXR0cmlidXRlcyxcbiAgICAgIGRlcml2ZWRUYWJsZXM6IHRoaXMuX2Rlcml2ZWRUYWJsZXMsXG4gICAgICB1c2VkQnlDbGFzc2VzOiB0aGlzLl91c2VkQnlDbGFzc2VzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge31cbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAob3B0aW9ucyA9IHsgcmVzZXQ6IGZhbHNlLCBsaW1pdDogSW5maW5pdHkgfSkge1xuICAgIC8vIEdlbmVyaWMgY2FjaGluZyBzdHVmZjsgdGhpcyBpc24ndCBqdXN0IGZvciBwZXJmb3JtYW5jZS4gQ29ubmVjdGVkVGFibGUnc1xuICAgIC8vIGFsZ29yaXRobSByZXF1aXJlcyB0aGF0IGl0cyBwYXJlbnQgdGFibGVzIGhhdmUgcHJlLWJ1aWx0IGluZGV4ZXMgKHdlXG4gICAgLy8gdGVjaG5pY2FsbHkgY291bGQgaW1wbGVtZW50IGl0IGRpZmZlcmVudGx5LCBidXQgaXQgd291bGQgYmUgZXhwZW5zaXZlLFxuICAgIC8vIHJlcXVpcmVzIHRyaWNreSBsb2dpYywgYW5kIHdlJ3JlIGFscmVhZHkgYnVpbGRpbmcgaW5kZXhlcyBmb3Igc29tZSB0YWJsZXNcbiAgICAvLyBsaWtlIEFnZ3JlZ2F0ZWRUYWJsZSBhbnl3YXkpXG4gICAgaWYgKG9wdGlvbnMucmVzZXQpIHtcbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICBmb3IgKGNvbnN0IGZpbmlzaGVkSXRlbSBvZiBPYmplY3QudmFsdWVzKHRoaXMuX2NhY2hlKSkge1xuICAgICAgICB5aWVsZCBmaW5pc2hlZEl0ZW07XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgeWllbGQgKiBhd2FpdCB0aGlzLl9idWlsZENhY2hlKG9wdGlvbnMpO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBmb3IgKGNvbnN0IGRlcml2ZWRUYWJsZSBvZiB0aGlzLmRlcml2ZWRUYWJsZXMpIHtcbiAgICAgIGRlcml2ZWRUYWJsZS5yZXNldCgpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jlc2V0Jyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucykge1xuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQ7XG4gICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpO1xuICAgIGxldCBjb21wbGV0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBpdGVyYXRpb24gd2FzIGNhbmNlbGxlZDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgY29tcGxldGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHRlbXAudmFsdWUpO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGVtcC52YWx1ZS5pbmRleF0gPSB0ZW1wLnZhbHVlO1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgT2JqZWN0LmtleXMod3JhcHBlZEl0ZW0ucm93KSkge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgcmV0dXJuIGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBfZ2V0QWxsQXR0cmlidXRlcyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG4gIGdldCBhdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZ2V0QWxsQXR0cmlidXRlcygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMuX211cmUuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlVGFibGVzKCk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZUlkID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlSWQgJiYgdGhpcy5fbXVyZS50YWJsZXNbZXhpc3RpbmdUYWJsZUlkXSkgfHwgbnVsbDtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnQWdncmVnYXRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnRXhwYW5kZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBkZWxpbWl0ZXJcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGaWx0ZXJlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChvcHRpb25zKSB7XG4gICAgY29uc3QgdmFsdWVzID0ge307XG4gICAgY29uc3QgYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgZGVsZXRlIG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGaWx0ZXJlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMuX211cmUuY3JlYXRlVGFibGUoeyB0eXBlOiAnQ29ubmVjdGVkVGFibGUnIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5fbXVyZS50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fbXVyZS50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCB8fCB0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBpbi11c2UgdGFibGUgJHt0aGlzLnRhYmxlSWR9YCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9tdXJlLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICB0aGlzLl9maW5pc2hJdGVtKGl0ZW0pO1xuICAgICAgeWllbGQgaXRlbTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0IGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB7fTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbShpdGVtKTtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0O1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aWVyZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBBZ2dyZWdhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGlmIChvcHRpb25zLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5fZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAn4oamJztcbiAgfVxuICBkZXJpdmVSZWR1Y2VkQXR0cmlidXRlIChhdHRyLCBmdW5jKSB7XG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX3VwZGF0ZUl0ZW0gKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG5ld1dyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG5ld1dyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zKSB7XG4gICAgLy8gV2Ugb3ZlcnJpZGUgX2J1aWxkQ2FjaGUgYmVjYXVzZSBzbyB0aGF0IEFnZ3JlZ2F0ZWRUYWJsZSBjYW4gdGFrZSBhZHZhbnRhZ2VcbiAgICAvLyBvZiB0aGUgcGFydGlhbGx5LWJ1aWx0IGNhY2hlIGFzIGl0IGdvZXMsIGFuZCBwb3N0cG9uZSBmaW5pc2hpbmcgaXRlbXNcbiAgICAvLyB1bnRpbCBhZnRlciB0aGUgcGFyZW50IHRhYmxlIGhhcyBiZWVuIGZ1bGx5IGl0ZXJhdGVkXG5cbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbd3JhcHBlZEl0ZW0uaW5kZXhdID0gd3JhcHBlZEl0ZW07XG4gICAgICAvLyBHbyBhaGVhZCBhbmQgeWllbGQgdGhlIHVuZmluaXNoZWQgaXRlbTsgdGhpcyBtYWtlcyBpdCBwb3NzaWJsZSBmb3JcbiAgICAgIC8vIGNsaWVudCBhcHBzIHRvIGJlIG1vcmUgcmVzcG9uc2l2ZSBhbmQgcmVuZGVyIHBhcnRpYWwgcmVzdWx0cywgYnV0IGFsc29cbiAgICAgIC8vIG1lYW5zIHRoYXQgdGhleSBuZWVkIHRvIHdhdGNoIGZvciB3cmFwcGVkSXRlbS5vbigndXBkYXRlJykgZXZlbnRzXG4gICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICB9XG5cbiAgICAvLyBTZWNvbmQgcGFzczogbm93IHRoYXQgd2UndmUgY29tcGxldGVkIHRoZSBmdWxsIGl0ZXJhdGlvbiBvZiB0aGUgcGFyZW50XG4gICAgLy8gdGFibGUsIHdlIGNhbiBmaW5pc2ggZWFjaCBpdGVtXG4gICAgZm9yIChjb25zdCBpbmRleCBpbiB0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5wYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBXZSB3ZXJlIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdKSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0odGhpcy5fcGFydGlhbENhY2hlW2luZGV4XSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgY29ubmVjdGVkUm93czogeyB3cmFwcGVkUGFyZW50IH1cbiAgICAgICAgfSk7XG4gICAgICAgIC8vIFJlZHVjZSBvcGVyYXRpb25zIHN0aWxsIG5lZWQgdG8gYmUgYXBwbGllZCB0byB0aGUgZmlyc3QgaXRlbVxuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKG5ld0l0ZW0sIG5ld0l0ZW0pO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBfZ2V0QWxsQXR0cmlidXRlcyAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX2dldEFsbEF0dHJpYnV0ZXMoKTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICByZXN1bHRbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBBZ2dyZWdhdGVkVGFibGU7XG4iLCJjb25zdCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5kdXBsaWNhdGVkQXR0cmlidXRlcyB8fCB7fTtcbiAgICB9XG4gICAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgICAgb2JqLmR1cGxpY2F0ZWRBdHRyaWJ1dGVzID0gdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXM7XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICBkdXBsaWNhdGVBdHRyaWJ1dGUgKHBhcmVudElkLCBhdHRyaWJ1dGUpIHtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZUF0dHJpYnV0ZXNbcGFyZW50SWRdID0gdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlc1twYXJlbnRJZF0gfHwgW107XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0ucHVzaChhdHRyaWJ1dGUpO1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBfZHVwbGljYXRlQXR0cmlidXRlcyAod3JhcHBlZEl0ZW0sIGNvbm5lY3RlZFJvd3MpIHtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgd3JhcHBlZEl0ZW0ucm93W2Ake3BhcmVudElkfS4ke2F0dHJ9YF0gPSBjb25uZWN0ZWRSb3dzW3BhcmVudElkXVthdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gICAgX2dldEFsbEF0dHJpYnV0ZXMgKCkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX2dldEFsbEF0dHJpYnV0ZXMoKTtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgcmVzdWx0W2Ake3BhcmVudElkfS4ke2F0dHJ9YF0gPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgRXhwYW5kZWRUYWJsZSBleHRlbmRzIER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbihTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuZGVsaW1pdGVyID0gb3B0aW9ucy5kZWxpbWl0ZXIgfHwgJywnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpCc7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGVJZCA9IHRoaXMucGFyZW50VGFibGUudGFibGVJZDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5wYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCB2YWx1ZXMgPSAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5hdHRyaWJ1dGVdIHx8ICcnKS5zcGxpdCh0aGlzLmRlbGltaXRlcik7XG4gICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuICAgICAgICBjb25zdCByb3cgPSB7fTtcbiAgICAgICAgcm93W3RoaXMuYXR0cmlidXRlXSA9IHZhbHVlO1xuICAgICAgICBjb25zdCBjb25uZWN0ZWRSb3dzID0ge307XG4gICAgICAgIGNvbm5lY3RlZFJvd3NbcGFyZW50VGFibGVJZF0gPSB3cmFwcGVkUGFyZW50O1xuICAgICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93LCBjb25uZWN0ZWRSb3dzIH0pO1xuICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKHdyYXBwZWRJdGVtLCBjb25uZWN0ZWRSb3dzKTtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmlsdGVyZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5hdHRyaWJ1dGUgfHwgIXRoaXMudmFsdWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuICfiioInICsgdGhpcy5wYXJlbnRUYWJsZS5uYW1lO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLnBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogd3JhcHBlZFBhcmVudC5yb3csXG4gICAgICAgICAgY29ubmVjdGVkUm93czogeyB3cmFwcGVkUGFyZW50IH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZpbHRlcmVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIFNwaW4gdGhyb3VnaCBhbGwgb2YgdGhlIHBhcmVudFRhYmxlcyBzbyB0aGF0IHRoZWlyIF9jYWNoZSBpcyBwcmUtYnVpbHRcbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgaWYgKCFwYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgICAgY29uc3QgaXRlcmF0b3IgPSBwYXJlbnRUYWJsZS5pdGVyYXRlKCk7XG4gICAgICAgIGxldCB0ZW1wO1xuICAgICAgICB3aGlsZSAoIXRlbXAgfHwgIXRlbXAuZG9uZSkge1xuICAgICAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiBwYXJlbnRUYWJsZXMpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGluZGV4IGluIHBhcmVudFRhYmxlLl9jYWNoZSkge1xuICAgICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0pIHtcbiAgICAgICAgICBjb25zdCBjb25uZWN0ZWRSb3dzID0ge307XG4gICAgICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZTIgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICAgICAgICBjb25uZWN0ZWRSb3dzW3BhcmVudFRhYmxlMi50YWJsZUlkXSA9IHBhcmVudFRhYmxlMi5fY2FjaGVbaW5kZXhdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMud3JhcCh7IGluZGV4LCBjb25uZWN0ZWRSb3dzIH0pO1xuICAgICAgICAgIHRoaXMuX2R1cGxpY2F0ZUF0dHJpYnV0ZXMod3JhcHBlZEl0ZW0sIGNvbm5lY3RlZFJvd3MpO1xuICAgICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLl9tdXJlIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBfbXVyZSwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb24gPSBvcHRpb25zLmFubm90YXRpb24gfHwgJyc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uOiB0aGlzLmFubm90YXRpb25cbiAgICB9O1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgIT09IG51bGw7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fCB0aGlzLnRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0SGFzaFRhYmxlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyh7XG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcydcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLl9tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxIHx8IGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgIG9wdGlvbnMuc291cmNlTm9kZUlkID0gc291cmNlRWRnZUNsYXNzLnNvdXJjZU5vZGVJZDtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VOb2RlQXR0ciA9IHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VOb2RlQXR0cjtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VFZGdlQXR0ciA9IHNvdXJjZUVkZ2VDbGFzcy50YXJnZXROb2RlQXR0cjtcbiAgICAgICAgc291cmNlRWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0Tm9kZUlkID0gdGFyZ2V0RWRnZUNsYXNzLnRhcmdldE5vZGVJZDtcbiAgICAgICAgb3B0aW9ucy50YXJnZXROb2RlQXR0ciA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXROb2RlQXR0cjtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRFZGdlQXR0ciA9IHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VOb2RlQXR0cjtcbiAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmRlbGV0ZSgpO1xuICAgIGRlbGV0ZSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBkaXJlY3RlZCwgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgY29uc3QgdGhpc0hhc2ggPSB0aGlzLmdldEhhc2hUYWJsZShhdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLmdldEhhc2hUYWJsZShvdGhlckF0dHJpYnV0ZSk7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzSGFzaC5jb25uZWN0KFtvdGhlckhhc2hdKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIGRpcmVjdGVkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlTm9kZUF0dHI6IGF0dHJpYnV0ZSxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXROb2RlQXR0cjogb3RoZXJBdHRyaWJ1dGVcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5fbXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlTm9kZUF0dHIgPSBvcHRpb25zLnNvdXJjZU5vZGVBdHRyIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VFZGdlQXR0ciA9IG9wdGlvbnMuc291cmNlRWRnZUF0dHIgfHwgbnVsbDtcblxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0Tm9kZUF0dHIgPSBvcHRpb25zLnRhcmdldE5vZGVBdHRyIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRFZGdlQXR0ciA9IG9wdGlvbnMudGFyZ2V0RWRnZUF0dHIgfHwgbnVsbDtcblxuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQuc291cmNlTm9kZUF0dHIgPSB0aGlzLnNvdXJjZU5vZGVBdHRyO1xuICAgIHJlc3VsdC5zb3VyY2VFZGdlQXR0ciA9IHRoaXMuc291cmNlRWRnZUF0dHI7XG5cbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0Tm9kZUF0dHIgPSB0aGlzLnRhcmdldE5vZGVBdHRyO1xuICAgIHJlc3VsdC50YXJnZXRFZGdlQXR0ciA9IHRoaXMudGFyZ2V0RWRnZUF0dHI7XG5cbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgZGlyZWN0aW9uLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pIHtcbiAgICBpZiAoZGlyZWN0aW9uICE9PSAnc291cmNlJyAmJiBkaXJlY3Rpb24gIT09ICd0YXJnZXQnKSB7XG4gICAgICBkaXJlY3Rpb24gPSB0aGlzLnRhcmdldENsYXNzSWQgPT09IG51bGwgPyAndGFyZ2V0JyA6ICdzb3VyY2UnO1xuICAgIH1cbiAgICBpZiAoZGlyZWN0aW9uID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2UoeyBub2RlQ2xhc3MsIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSk7XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICB0b2dnbGVOb2RlRGlyZWN0aW9uIChzb3VyY2VDbGFzc0lkKSB7XG4gICAgaWYgKCFzb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBpZiAoc291cmNlQ2xhc3NJZCAhPT0gdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBzd2FwIHRvIHVuY29ubmVjdGVkIGNsYXNzIGlkOiAke3NvdXJjZUNsYXNzSWR9YCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgICAgdGVtcCA9IHRoaXMuc291cmNlTm9kZUF0dHI7XG4gICAgICAgIHRoaXMuc291cmNlTm9kZUF0dHIgPSB0aGlzLnRhcmdldE5vZGVBdHRyO1xuICAgICAgICB0aGlzLnRhcmdldE5vZGVBdHRyID0gdGVtcDtcbiAgICAgICAgdGVtcCA9IHRoaXMuaW50ZXJtZWRpYXRlU291cmNlcztcbiAgICAgICAgdGhpcy5zb3VyY2VFZGdlQXR0ciA9IHRoaXMudGFyZ2V0RWRnZUF0dHI7XG4gICAgICAgIHRoaXMudGFyZ2V0RWRnZUF0dHIgPSB0ZW1wO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbCxcbiAgICBza2lwU2F2ZSA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5zb3VyY2VOb2RlQXR0ciA9IG5vZGVBdHRyaWJ1dGU7XG4gICAgdGhpcy5zb3VyY2VFZGdlQXR0ciA9IGVkZ2VBdHRyaWJ1dGU7XG5cbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlLCBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy50YXJnZXROb2RlQXR0ciA9IG5vZGVBdHRyaWJ1dGU7XG4gICAgdGhpcy50YXJnZXRFZGdlQXR0ciA9IGVkZ2VBdHRyaWJ1dGU7XG5cbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKHsgc2tpcFNhdmUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHtcbiAgICAgIGRlbGV0ZSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VOb2RlQXR0ciA9IG51bGw7XG4gICAgdGhpcy5zb3VyY2VFZGdlQXR0ciA9IG51bGw7XG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdKSB7XG4gICAgICBkZWxldGUgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Tm9kZUF0dHIgPSBudWxsO1xuICAgIHRoaXMudGFyZ2V0RWRnZUF0dHIgPSBudWxsO1xuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRSb3dzID0gb3B0aW9ucy5jb25uZWN0ZWRSb3dzIHx8IHt9O1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiY2xhc3MgSW5NZW1vcnlJbmRleCB7XG4gIGNvbnN0cnVjdG9yICh7IGVudHJpZXMgPSB7fSwgY29tcGxldGUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICB0aGlzLmVudHJpZXMgPSBlbnRyaWVzO1xuICAgIHRoaXMuY29tcGxldGUgPSBjb21wbGV0ZTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcztcbiAgfVxuICBhc3luYyAqIGl0ZXJFbnRyaWVzICgpIHtcbiAgICBmb3IgKGNvbnN0IFtoYXNoLCB2YWx1ZUxpc3RdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHsgaGFzaCwgdmFsdWVMaXN0IH07XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlckhhc2hlcyAoKSB7XG4gICAgZm9yIChjb25zdCBoYXNoIG9mIE9iamVjdC5rZXlzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIGhhc2g7XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlclZhbHVlTGlzdHMgKCkge1xuICAgIGZvciAoY29uc3QgdmFsdWVMaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgdmFsdWVMaXN0O1xuICAgIH1cbiAgfVxuICBhc3luYyBnZXRWYWx1ZUxpc3QgKGhhc2gpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzW2hhc2hdIHx8IFtdO1xuICB9XG4gIGFzeW5jIGFkZFZhbHVlIChoYXNoLCB2YWx1ZSkge1xuICAgIC8vIFRPRE86IGFkZCBzb21lIGtpbmQgb2Ygd2FybmluZyBpZiB0aGlzIGlzIGdldHRpbmcgYmlnP1xuICAgIHRoaXMuZW50cmllc1toYXNoXSA9IGF3YWl0IHRoaXMuZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgIGlmICh0aGlzLmVudHJpZXNbaGFzaF0uaW5kZXhPZih2YWx1ZSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbk1lbW9yeUluZGV4O1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgKiBhcyBUQUJMRVMgZnJvbSAnLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuaW1wb3J0ICogYXMgV1JBUFBFUlMgZnJvbSAnLi9XcmFwcGVycy9XcmFwcGVycy5qcyc7XG5pbXBvcnQgKiBhcyBJTkRFWEVTIGZyb20gJy4vSW5kZXhlcy9JbmRleGVzLmpzJztcblxubGV0IE5FWFRfQ0xBU1NfSUQgPSAxO1xubGV0IE5FWFRfVEFCTEVfSUQgPSAxO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoRmlsZVJlYWRlciwgbG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBlaXRoZXIgd2luZG93LmxvY2FsU3RvcmFnZSBvciBudWxsXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG4gICAgdGhpcy5EQVRBTElCX0ZPUk1BVFMgPSB7XG4gICAgICAnanNvbic6ICdqc29uJyxcbiAgICAgICdjc3YnOiAnY3N2JyxcbiAgICAgICd0c3YnOiAndHN2JyxcbiAgICAgICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICAgICAndHJlZWpzb24nOiAndHJlZWpzb24nXG4gICAgfTtcblxuICAgIC8vIEFjY2VzcyB0byBjb3JlIGNsYXNzZXMgdmlhIHRoZSBtYWluIGxpYnJhcnkgaGVscHMgYXZvaWQgY2lyY3VsYXIgaW1wb3J0c1xuICAgIHRoaXMuVEFCTEVTID0gVEFCTEVTO1xuICAgIHRoaXMuQ0xBU1NFUyA9IENMQVNTRVM7XG4gICAgdGhpcy5XUkFQUEVSUyA9IFdSQVBQRVJTO1xuICAgIHRoaXMuSU5ERVhFUyA9IElOREVYRVM7XG5cbiAgICAvLyBEZWZhdWx0IG5hbWVkIGZ1bmN0aW9uc1xuICAgIHRoaXMuTkFNRURfRlVOQ1RJT05TID0ge1xuICAgICAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7IHlpZWxkIHdyYXBwZWRJdGVtLnJhd0l0ZW07IH0sXG4gICAgICBrZXk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7XG4gICAgICAgIGlmICghd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEdyYW5kcGFyZW50IGlzIG5vdCBhbiBvYmplY3QgLyBhcnJheWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICBpZiAoIShwYXJlbnRUeXBlID09PSAnbnVtYmVyJyB8fCBwYXJlbnRUeXBlID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXJlbnQgaXNuJ3QgYSBrZXkgLyBpbmRleGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRGaW5pc2g6IGZ1bmN0aW9uICogKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkge1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgbGVmdDogdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0sXG4gICAgICAgICAgcmlnaHQ6IG90aGVyV3JhcHBlZEl0ZW0ucmF3SXRlbVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHNoYTE6IHJhd0l0ZW0gPT4gc2hhMShKU09OLnN0cmluZ2lmeShyYXdJdGVtKSksXG4gICAgICBub29wOiAoKSA9PiB7fVxuICAgIH07XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnRhYmxlcyA9IHRoaXMuaHlkcmF0ZSgnbXVyZV90YWJsZXMnLCB0aGlzLlRBQkxFUyk7XG4gICAgTkVYVF9UQUJMRV9JRCA9IE9iamVjdC5rZXlzKHRoaXMudGFibGVzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgdGFibGVJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQodGFibGVJZC5tYXRjaCgvdGFibGUoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgb3VyIGNsYXNzIHNwZWNpZmljYXRpb25zXG4gICAgdGhpcy5jbGFzc2VzID0gdGhpcy5oeWRyYXRlKCdtdXJlX2NsYXNzZXMnLCB0aGlzLkNMQVNTRVMpO1xuICAgIE5FWFRfQ0xBU1NfSUQgPSBPYmplY3Qua2V5cyh0aGlzLmNsYXNzZXMpXG4gICAgICAucmVkdWNlKChoaWdoZXN0TnVtLCBjbGFzc0lkKSA9PiB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heChoaWdoZXN0TnVtLCBwYXJzZUludChjbGFzc0lkLm1hdGNoKC9jbGFzcyhcXGQqKS8pWzFdKSk7XG4gICAgICB9LCAwKSArIDE7XG4gIH1cblxuICBzYXZlVGFibGVzICgpIHtcbiAgICB0aGlzLmRlaHlkcmF0ZSgnbXVyZV90YWJsZXMnLCB0aGlzLnRhYmxlcyk7XG4gICAgdGhpcy50cmlnZ2VyKCd0YWJsZVVwZGF0ZScpO1xuICB9XG4gIHNhdmVDbGFzc2VzICgpIHtcbiAgICB0aGlzLmRlaHlkcmF0ZSgnbXVyZV9jbGFzc2VzJywgdGhpcy5jbGFzc2VzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NsYXNzVXBkYXRlJyk7XG4gIH1cblxuICBoeWRyYXRlIChzdG9yYWdlS2V5LCBUWVBFUykge1xuICAgIGxldCBjb250YWluZXIgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKHN0b3JhZ2VLZXkpO1xuICAgIGNvbnRhaW5lciA9IGNvbnRhaW5lciA/IEpTT04ucGFyc2UoY29udGFpbmVyKSA6IHt9O1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvbnRhaW5lcikpIHtcbiAgICAgIGNvbnN0IHR5cGUgPSB2YWx1ZS50eXBlO1xuICAgICAgZGVsZXRlIHZhbHVlLnR5cGU7XG4gICAgICB2YWx1ZS5tdXJlID0gdGhpcztcbiAgICAgIGNvbnRhaW5lcltrZXldID0gbmV3IFRZUEVTW3R5cGVdKHZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbnRhaW5lcjtcbiAgfVxuICBkZWh5ZHJhdGUgKHN0b3JhZ2VLZXksIGNvbnRhaW5lcikge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0ge307XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb250YWluZXIpKSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICAgIHJlc3VsdFtrZXldLnR5cGUgPSB2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShzdG9yYWdlS2V5LCBKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcbiAgICB9XG4gIH1cbiAgaHlkcmF0ZUZ1bmN0aW9uIChzdHJpbmdpZmllZEZ1bmMpIHtcbiAgICBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cblxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy50YWJsZUlkKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke05FWFRfVEFCTEVfSUR9YDtcbiAgICAgIE5FWFRfVEFCTEVfSUQgKz0gMTtcbiAgICB9XG4gICAgY29uc3QgVHlwZSA9IHRoaXMuVEFCTEVTW29wdGlvbnMudHlwZV07XG4gICAgZGVsZXRlIG9wdGlvbnMudHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIGlmICghb3B0aW9ucy5jbGFzc0lkKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke05FWFRfQ0xBU1NfSUR9YDtcbiAgICAgIE5FWFRfQ0xBU1NfSUQgKz0gMTtcbiAgICB9XG4gICAgY29uc3QgVHlwZSA9IHRoaXMuQ0xBU1NFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIG5ld1RhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGVPYmogPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZU9iajtcbiAgfVxuICBuZXdDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld0NsYXNzT2JqID0gdGhpcy5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0NsYXNzT2JqO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljVGFibGUgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY1RhYmxlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24gPSAndHh0JywgdGV4dCB9KSB7XG4gICAgbGV0IGRhdGEsIGF0dHJpYnV0ZXM7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3QnO1xuICAgIGxldCBuZXdUYWJsZSA9IHRoaXMubmV3VGFibGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlQWxsVW51c2VkVGFibGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IHRhYmxlSWQgaW4gdGhpcy50YWJsZXMpIHtcbiAgICAgIGlmICh0aGlzLnRhYmxlc1t0YWJsZUlkXSkge1xuICAgICAgICB0cnkgeyB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTsgfSBjYXRjaCAoZXJyKSB7fVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBkZWxldGVBbGxDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgY2xhc3NPYmouZGVsZXRlKCk7XG4gICAgfVxuICB9XG4gIGdldENsYXNzRGF0YSAoKSB7XG4gICAgY29uc3QgcmVzdWx0cyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICByZXN1bHRzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouY3VycmVudERhdGE7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKHdpbmRvdy5GaWxlUmVhZGVyLCB3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsIm9mZiIsImluZGV4Iiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5Iiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiT2JqZWN0IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJUYWJsZSIsIm9wdGlvbnMiLCJfbXVyZSIsIm11cmUiLCJ0YWJsZUlkIiwiRXJyb3IiLCJfZXhwZWN0ZWRBdHRyaWJ1dGVzIiwiYXR0cmlidXRlcyIsIl9vYnNlcnZlZEF0dHJpYnV0ZXMiLCJfZGVyaXZlZFRhYmxlcyIsImRlcml2ZWRUYWJsZXMiLCJfZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImh5ZHJhdGVGdW5jdGlvbiIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwidXNlZEJ5Q2xhc3NlcyIsIl91c2VkQnlDbGFzc2VzIiwiZnVuYyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwibmFtZSIsIml0ZXJhdGUiLCJyZXNldCIsImxpbWl0IiwiSW5maW5pdHkiLCJfY2FjaGUiLCJmaW5pc2hlZEl0ZW0iLCJ2YWx1ZXMiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJkZXJpdmVkVGFibGUiLCJpdGVyYXRvciIsIl9pdGVyYXRlIiwiY29tcGxldGVkIiwibmV4dCIsImRvbmUiLCJfZmluaXNoSXRlbSIsIndyYXBwZWRJdGVtIiwicm93Iiwia2V5cyIsIl93cmFwIiwidGFibGUiLCJjbGFzc09iaiIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJfZ2V0QWxsQXR0cmlidXRlcyIsImFsbEF0dHJzIiwiY3VycmVudERhdGEiLCJkYXRhIiwiY29tcGxldGUiLCJkZXJpdmVBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwic2F2ZVRhYmxlcyIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZUlkIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJ0YWJsZXMiLCJhZ2dyZWdhdGUiLCJleHBhbmQiLCJkZWxpbWl0ZXIiLCJjbG9zZWRGYWNldCIsIm1hcCIsIm9wZW5GYWNldCIsImNvbm5lY3QiLCJvdGhlclRhYmxlTGlzdCIsIm90aGVyVGFibGUiLCJjbGFzc2VzIiwicGFyZW50VGFibGVzIiwicmVkdWNlIiwiYWdnIiwiZGVsZXRlIiwibGVuZ3RoIiwicGFyZW50VGFibGUiLCJleGVjIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiaXRlbSIsIlN0YXRpY0RpY3QiLCJTaW5nbGVQYXJlbnRNaXhpbiIsIl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4iLCJBZ2dyZWdhdGVkVGFibGUiLCJfYXR0cmlidXRlIiwiX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsInJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsIl9kZWh5ZHJhdGVGdW5jdGlvbiIsImRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUiLCJfdXBkYXRlSXRlbSIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJuZXdXcmFwcGVkSXRlbSIsIndyYXBwZWRQYXJlbnQiLCJuZXdJdGVtIiwiY29ubmVjdGVkUm93cyIsIkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIiwiX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlZEF0dHJpYnV0ZXMiLCJkdXBsaWNhdGVBdHRyaWJ1dGUiLCJwYXJlbnRJZCIsIl9kdXBsaWNhdGVBdHRyaWJ1dGVzIiwiRXhwYW5kZWRUYWJsZSIsInBhcmVudFRhYmxlSWQiLCJzcGxpdCIsIkZpbHRlcmVkVGFibGUiLCJfdmFsdWUiLCJ0b1Jhd09iamVjdCIsIkNvbm5lY3RlZFRhYmxlIiwiam9pbiIsInBhcmVudFRhYmxlMiIsIndyYXAiLCJHZW5lcmljQ2xhc3MiLCJjbGFzc0lkIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsImFubm90YXRpb24iLCJzZXRDbGFzc05hbWUiLCJzYXZlQ2xhc3NlcyIsImhhc0N1c3RvbU5hbWUiLCJnZXRIYXNoVGFibGUiLCJpbnRlcnByZXRBc05vZGVzIiwibmV3Q2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiTm9kZUNsYXNzIiwiZWRnZUNsYXNzSWRzIiwiV3JhcHBlciIsIk5vZGVXcmFwcGVyIiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwic291cmNlRWRnZUNsYXNzIiwic291cmNlTm9kZUlkIiwic291cmNlTm9kZUF0dHIiLCJzb3VyY2VFZGdlQXR0ciIsInRhcmdldE5vZGVBdHRyIiwidGFyZ2V0RWRnZUNsYXNzIiwidGFyZ2V0Tm9kZUlkIiwidGFyZ2V0RWRnZUF0dHIiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsImRpcmVjdGVkIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY3JlYXRlQ2xhc3MiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsImVkZ2VDbGFzcyIsIm5vZGVDbGFzcyIsImVkZ2VDbGFzc0lkIiwiZGlzY29ubmVjdFNvdXJjZSIsImRpc2Nvbm5lY3RUYXJnZXQiLCJFZGdlQ2xhc3MiLCJFZGdlV3JhcHBlciIsImRpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiY29ubmVjdFRhcmdldCIsImNvbm5lY3RTb3VyY2UiLCJ0b2dnbGVOb2RlRGlyZWN0aW9uIiwiaW50ZXJtZWRpYXRlU291cmNlcyIsInNraXBTYXZlIiwidW5kZWZpbmVkIiwiSW5NZW1vcnlJbmRleCIsIml0ZXJFbnRyaWVzIiwiaGFzaCIsInZhbHVlTGlzdCIsIml0ZXJIYXNoZXMiLCJpdGVyVmFsdWVMaXN0cyIsImdldFZhbHVlTGlzdCIsImFkZFZhbHVlIiwiTkVYVF9DTEFTU19JRCIsIk5FWFRfVEFCTEVfSUQiLCJNdXJlIiwiRmlsZVJlYWRlciIsImxvY2FsU3RvcmFnZSIsIm1pbWUiLCJkZWJ1ZyIsIkRBVEFMSUJfRk9STUFUUyIsIlRBQkxFUyIsIkNMQVNTRVMiLCJJTkRFWEVTIiwiTkFNRURfRlVOQ1RJT05TIiwiaWRlbnRpdHkiLCJyYXdJdGVtIiwia2V5IiwiVHlwZUVycm9yIiwicGFyZW50VHlwZSIsImRlZmF1bHRGaW5pc2giLCJ0aGlzV3JhcHBlZEl0ZW0iLCJvdGhlcldyYXBwZWRJdGVtIiwibGVmdCIsInJpZ2h0Iiwic2hhMSIsIkpTT04iLCJzdHJpbmdpZnkiLCJub29wIiwiaHlkcmF0ZSIsImhpZ2hlc3ROdW0iLCJNYXRoIiwibWF4IiwicGFyc2VJbnQiLCJtYXRjaCIsImRlaHlkcmF0ZSIsInN0b3JhZ2VLZXkiLCJUWVBFUyIsImNvbnRhaW5lciIsImdldEl0ZW0iLCJwYXJzZSIsInNldEl0ZW0iLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiVHlwZSIsInNlbGVjdG9yIiwibmV3VGFibGVPYmoiLCJuZXdDbGFzc09iaiIsImFkZEZpbGVBc1N0YXRpY1RhYmxlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJjb25zb2xlIiwid2FybiIsInRleHQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJhZGRTdHJpbmdBc1N0YXRpY1RhYmxlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJBcnJheSIsImRlbGV0ZUFsbFVudXNlZFRhYmxlcyIsImVyciIsImRlbGV0ZUFsbENsYXNzZXMiLCJnZXRDbGFzc0RhdGEiLCJyZXN1bHRzIiwid2luZG93IiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztX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
