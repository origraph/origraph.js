'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var sha1 = _interopDefault(require('sha1'));
var FileReader = _interopDefault(require('filereader'));

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
  constructor(FileReader$$1, localStorage) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node

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

let mure = new Mure(FileReader, null);
mure.version = pkg.version;

module.exports = mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdC5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GaWx0ZXJlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Db25uZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9JbmRleGVzL0luTWVtb3J5SW5kZXguanMiLCIuLi9zcmMvTXVyZS5qcyIsIi4uL3NyYy9tYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuXG5jbGFzcyBUYWJsZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX211cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5fbXVyZSB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG11cmUgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5hdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcyA9IHt9O1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgaWYgKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuX2F0dHJpYnV0ZXMsXG4gICAgICBkZXJpdmVkVGFibGVzOiB0aGlzLl9kZXJpdmVkVGFibGVzLFxuICAgICAgdXNlZEJ5Q2xhc3NlczogdGhpcy5fdXNlZEJ5Q2xhc3NlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9XG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgcmVzdWx0LmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKG9wdGlvbnMgPSB7IHJlc2V0OiBmYWxzZSwgbGltaXQ6IEluZmluaXR5IH0pIHtcbiAgICAvLyBHZW5lcmljIGNhY2hpbmcgc3R1ZmY7IHRoaXMgaXNuJ3QganVzdCBmb3IgcGVyZm9ybWFuY2UuIENvbm5lY3RlZFRhYmxlJ3NcbiAgICAvLyBhbGdvcml0aG0gcmVxdWlyZXMgdGhhdCBpdHMgcGFyZW50IHRhYmxlcyBoYXZlIHByZS1idWlsdCBpbmRleGVzICh3ZVxuICAgIC8vIHRlY2huaWNhbGx5IGNvdWxkIGltcGxlbWVudCBpdCBkaWZmZXJlbnRseSwgYnV0IGl0IHdvdWxkIGJlIGV4cGVuc2l2ZSxcbiAgICAvLyByZXF1aXJlcyB0cmlja3kgbG9naWMsIGFuZCB3ZSdyZSBhbHJlYWR5IGJ1aWxkaW5nIGluZGV4ZXMgZm9yIHNvbWUgdGFibGVzXG4gICAgLy8gbGlrZSBBZ2dyZWdhdGVkVGFibGUgYW55d2F5KVxuICAgIGlmIChvcHRpb25zLnJlc2V0KSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgZm9yIChjb25zdCBmaW5pc2hlZEl0ZW0gb2YgT2JqZWN0LnZhbHVlcyh0aGlzLl9jYWNoZSkpIHtcbiAgICAgICAgeWllbGQgZmluaXNoZWRJdGVtO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHlpZWxkICogYXdhaXQgdGhpcy5fYnVpbGRDYWNoZShvcHRpb25zKTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGU7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0O1xuICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZShvcHRpb25zKTtcbiAgICBsZXQgY29tcGxldGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gaXRlcmF0aW9uIHdhcyBjYW5jZWxsZWQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGNvbXBsZXRlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKTtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3RlbXAudmFsdWUuaW5kZXhdID0gdGVtcC52YWx1ZTtcbiAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbXBsZXRlZCkge1xuICAgICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIG9mIE9iamVjdC5rZXlzKHdyYXBwZWRJdGVtLnJvdykpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbmlzaCcpO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIHJldHVybiBjbGFzc09iaiA/IGNsYXNzT2JqLl93cmFwKG9wdGlvbnMpIDogbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX2dldEFsbEF0dHJpYnV0ZXMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2dldEFsbEF0dHJpYnV0ZXMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGVJZCA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZUlkICYmIHRoaXMuX211cmUudGFibGVzW2V4aXN0aW5nVGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgZGVsaW1pdGVyXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmlsdGVyZWRUYWJsZScsXG4gICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgdmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAob3B0aW9ucykge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGNvbnN0IGF0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGRlbGV0ZSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgdmFsdWUgPSB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmlsdGVyZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKHsgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJyB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9tdXJlLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDAgfHwgdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbShpdGVtKTtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljRGljdCBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSk7XG4gICAgICB5aWVsZCBpdGVtO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdDtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWllcmQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgQWdncmVnYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBpZiAob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuX2RlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpic7XG4gIH1cbiAgZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSAoYXR0ciwgZnVuYykge1xuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIF91cGRhdGVJdGVtIChvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyhvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0udHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucykge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugc28gdGhhdCBBZ2dyZWdhdGVkVGFibGUgY2FuIHRha2UgYWR2YW50YWdlXG4gICAgLy8gb2YgdGhlIHBhcnRpYWxseS1idWlsdCBjYWNoZSBhcyBpdCBnb2VzLCBhbmQgcG9zdHBvbmUgZmluaXNoaW5nIGl0ZW1zXG4gICAgLy8gdW50aWwgYWZ0ZXIgdGhlIHBhcmVudCB0YWJsZSBoYXMgYmVlbiBmdWxseSBpdGVyYXRlZFxuXG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5faXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3dyYXBwZWRJdGVtLmluZGV4XSA9IHdyYXBwZWRJdGVtO1xuICAgICAgLy8gR28gYWhlYWQgYW5kIHlpZWxkIHRoZSB1bmZpbmlzaGVkIGl0ZW07IHRoaXMgbWFrZXMgaXQgcG9zc2libGUgZm9yXG4gICAgICAvLyBjbGllbnQgYXBwcyB0byBiZSBtb3JlIHJlc3BvbnNpdmUgYW5kIHJlbmRlciBwYXJ0aWFsIHJlc3VsdHMsIGJ1dCBhbHNvXG4gICAgICAvLyBtZWFucyB0aGF0IHRoZXkgbmVlZCB0byB3YXRjaCBmb3Igd3JhcHBlZEl0ZW0ub24oJ3VwZGF0ZScpIGV2ZW50c1xuICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgfVxuXG4gICAgLy8gU2Vjb25kIHBhc3M6IG5vdyB0aGF0IHdlJ3ZlIGNvbXBsZXRlZCB0aGUgZnVsbCBpdGVyYXRpb24gb2YgdGhlIHBhcmVudFxuICAgIC8vIHRhYmxlLCB3ZSBjYW4gZmluaXNoIGVhY2ggaXRlbVxuICAgIGZvciAoY29uc3QgaW5kZXggaW4gdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICB0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMucGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgaW5kZXggPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlW2luZGV4XSkge1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGNvbm5lY3RlZFJvd3M6IHsgd3JhcHBlZFBhcmVudCB9XG4gICAgICAgIH0pO1xuICAgICAgICAvLyBSZWR1Y2Ugb3BlcmF0aW9ucyBzdGlsbCBuZWVkIHRvIGJlIGFwcGxpZWQgdG8gdGhlIGZpcnN0IGl0ZW1cbiAgICAgICAgdGhpcy5fdXBkYXRlSXRlbShuZXdJdGVtLCBuZXdJdGVtKTtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgX2dldEFsbEF0dHJpYnV0ZXMgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl9nZXRBbGxBdHRyaWJ1dGVzKCk7XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgcmVzdWx0W2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQWdncmVnYXRlZFRhYmxlO1xuIiwiY29uc3QgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuZHVwbGljYXRlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgfVxuICAgIF90b1Jhd09iamVjdCAoKSB7XG4gICAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICAgIG9iai5kdXBsaWNhdGVkQXR0cmlidXRlcyA9IHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgZHVwbGljYXRlQXR0cmlidXRlIChwYXJlbnRJZCwgYXR0cmlidXRlKSB7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzW3BhcmVudElkXSA9IHRoaXMuX2R1cGxpY2F0ZUF0dHJpYnV0ZXNbcGFyZW50SWRdIHx8IFtdO1xuICAgICAgdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXNbcGFyZW50SWRdLnB1c2goYXR0cmlidXRlKTtcbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICB9XG4gICAgX2R1cGxpY2F0ZUF0dHJpYnV0ZXMgKHdyYXBwZWRJdGVtLCBjb25uZWN0ZWRSb3dzKSB7XG4gICAgICBmb3IgKGNvbnN0IFtwYXJlbnRJZCwgYXR0cl0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXMpKSB7XG4gICAgICAgIHdyYXBwZWRJdGVtLnJvd1tgJHtwYXJlbnRJZH0uJHthdHRyfWBdID0gY29ubmVjdGVkUm93c1twYXJlbnRJZF1bYXR0cl07XG4gICAgICB9XG4gICAgfVxuICAgIF9nZXRBbGxBdHRyaWJ1dGVzICgpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl9nZXRBbGxBdHRyaWJ1dGVzKCk7XG4gICAgICBmb3IgKGNvbnN0IFtwYXJlbnRJZCwgYXR0cl0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXMpKSB7XG4gICAgICAgIHJlc3VsdFtgJHtwYXJlbnRJZH0uJHthdHRyfWBdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuaW1wb3J0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiBmcm9tICcuL0R1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLmF0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLmRlbGltaXRlciA9IG9wdGlvbnMuZGVsaW1pdGVyIHx8ICcsJztcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqQnO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlSWQgPSB0aGlzLnBhcmVudFRhYmxlLnRhYmxlSWQ7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMucGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgdmFsdWVzID0gKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuYXR0cmlidXRlXSB8fCAnJykuc3BsaXQodGhpcy5kZWxpbWl0ZXIpO1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICAgICAgY29uc3Qgcm93ID0ge307XG4gICAgICAgIHJvd1t0aGlzLmF0dHJpYnV0ZV0gPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgY29ubmVjdGVkUm93cyA9IHt9O1xuICAgICAgICBjb25uZWN0ZWRSb3dzW3BhcmVudFRhYmxlSWRdID0gd3JhcHBlZFBhcmVudDtcbiAgICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdywgY29ubmVjdGVkUm93cyB9KTtcbiAgICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlcyh3cmFwcGVkSXRlbSwgY29ubmVjdGVkUm93cyk7XG4gICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZpbHRlcmVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuYXR0cmlidXRlIHx8ICF0aGlzLnZhbHVlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIHRvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiAn4oqCJyArIHRoaXMucGFyZW50VGFibGUubmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5wYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBpZiAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3c6IHdyYXBwZWRQYXJlbnQucm93LFxuICAgICAgICAgIGNvbm5lY3RlZFJvd3M6IHsgd3JhcHBlZFBhcmVudCB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGaWx0ZXJlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiBmcm9tICcuL0R1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbi5qcyc7XG5cbmNsYXNzIENvbm5lY3RlZFRhYmxlIGV4dGVuZHMgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluKFRhYmxlKSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBTcGluIHRocm91Z2ggYWxsIG9mIHRoZSBwYXJlbnRUYWJsZXMgc28gdGhhdCB0aGVpciBfY2FjaGUgaXMgcHJlLWJ1aWx0XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiBwYXJlbnRUYWJsZXMpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICAgIGNvbnN0IGl0ZXJhdG9yID0gcGFyZW50VGFibGUuaXRlcmF0ZSgpO1xuICAgICAgICBsZXQgdGVtcDtcbiAgICAgICAgd2hpbGUgKCF0ZW1wIHx8ICF0ZW1wLmRvbmUpIHtcbiAgICAgICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlLl9jYWNoZSkge1xuICAgICAgICAvLyBPbmUgb2YgdGhlIHBhcmVudCB0YWJsZXMgd2FzIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBpbmRleCBpbiBwYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdKSB7XG4gICAgICAgICAgY29uc3QgY29ubmVjdGVkUm93cyA9IHt9O1xuICAgICAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUyIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgICAgICAgY29ubmVjdGVkUm93c1twYXJlbnRUYWJsZTIudGFibGVJZF0gPSBwYXJlbnRUYWJsZTIuX2NhY2hlW2luZGV4XTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLndyYXAoeyBpbmRleCwgY29ubmVjdGVkUm93cyB9KTtcbiAgICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKHdyYXBwZWRJdGVtLCBjb25uZWN0ZWRSb3dzKTtcbiAgICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fbXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5fbXVyZSB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgX211cmUsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9uID0gb3B0aW9ucy5hbm5vdGF0aW9uIHx8ICcnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGNsYXNzTmFtZTogdGhpcy5fY2xhc3NOYW1lLFxuICAgICAgYW5ub3RhdGlvbjogdGhpcy5hbm5vdGF0aW9uXG4gICAgfTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lICE9PSBudWxsO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHwgdGhpcy50YWJsZS5uYW1lO1xuICB9XG4gIGdldEhhc2hUYWJsZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIGF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpO1xuICB9XG4gIGdldCB0YWJsZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RoaXMudGFibGVJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnXG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5fbXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcjtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMSB8fCBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgICBvcHRpb25zLnNvdXJjZU5vZGVJZCA9IHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VOb2RlSWQ7XG4gICAgICAgIG9wdGlvbnMuc291cmNlTm9kZUF0dHIgPSBzb3VyY2VFZGdlQ2xhc3Muc291cmNlTm9kZUF0dHI7XG4gICAgICAgIG9wdGlvbnMuc291cmNlRWRnZUF0dHIgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Tm9kZUF0dHI7XG4gICAgICAgIHNvdXJjZUVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAgIGNvbnN0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICBvcHRpb25zLnRhcmdldE5vZGVJZCA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXROb2RlSWQ7XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0Tm9kZUF0dHIgPSB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Tm9kZUF0dHI7XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0RWRnZUF0dHIgPSB0YXJnZXRFZGdlQ2xhc3Muc291cmNlTm9kZUF0dHI7XG4gICAgICAgIHRhcmdldEVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICBkZWxldGUgb3B0aW9ucy5jbGFzc0lkO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgZGlyZWN0ZWQsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGNvbnN0IHRoaXNIYXNoID0gdGhpcy5nZXRIYXNoVGFibGUoYXR0cmlidXRlKTtcbiAgICBjb25zdCBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy5nZXRIYXNoVGFibGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBkaXJlY3RlZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZU5vZGVBdHRyOiBhdHRyaWJ1dGUsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0Tm9kZUF0dHI6IG90aGVyQXR0cmlidXRlXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMuX211cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG5cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZU5vZGVBdHRyID0gb3B0aW9ucy5zb3VyY2VOb2RlQXR0ciB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlRWRnZUF0dHIgPSBvcHRpb25zLnNvdXJjZUVkZ2VBdHRyIHx8IG51bGw7XG5cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldE5vZGVBdHRyID0gb3B0aW9ucy50YXJnZXROb2RlQXR0ciB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0RWRnZUF0dHIgPSBvcHRpb25zLnRhcmdldEVkZ2VBdHRyIHx8IG51bGw7XG5cbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZU5vZGVBdHRyID0gdGhpcy5zb3VyY2VOb2RlQXR0cjtcbiAgICByZXN1bHQuc291cmNlRWRnZUF0dHIgPSB0aGlzLnNvdXJjZUVkZ2VBdHRyO1xuXG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldE5vZGVBdHRyID0gdGhpcy50YXJnZXROb2RlQXR0cjtcbiAgICByZXN1bHQudGFyZ2V0RWRnZUF0dHIgPSB0aGlzLnRhcmdldEVkZ2VBdHRyO1xuXG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIGRpcmVjdGlvbiwgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KSB7XG4gICAgaWYgKGRpcmVjdGlvbiAhPT0gJ3NvdXJjZScgJiYgZGlyZWN0aW9uICE9PSAndGFyZ2V0Jykge1xuICAgICAgZGlyZWN0aW9uID0gdGhpcy50YXJnZXRDbGFzc0lkID09PSBudWxsID8gJ3RhcmdldCcgOiAnc291cmNlJztcbiAgICB9XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldCh7IG5vZGVDbGFzcywgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jb25uZWN0U291cmNlKHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgdG9nZ2xlTm9kZURpcmVjdGlvbiAoc291cmNlQ2xhc3NJZCkge1xuICAgIGlmICghc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3Qgc3dhcCB0byB1bmNvbm5lY3RlZCBjbGFzcyBpZDogJHtzb3VyY2VDbGFzc0lkfWApO1xuICAgICAgICB9XG4gICAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IHRlbXA7XG4gICAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZU5vZGVBdHRyO1xuICAgICAgICB0aGlzLnNvdXJjZU5vZGVBdHRyID0gdGhpcy50YXJnZXROb2RlQXR0cjtcbiAgICAgICAgdGhpcy50YXJnZXROb2RlQXR0ciA9IHRlbXA7XG4gICAgICAgIHRlbXAgPSB0aGlzLmludGVybWVkaWF0ZVNvdXJjZXM7XG4gICAgICAgIHRoaXMuc291cmNlRWRnZUF0dHIgPSB0aGlzLnRhcmdldEVkZ2VBdHRyO1xuICAgICAgICB0aGlzLnRhcmdldEVkZ2VBdHRyID0gdGVtcDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGNvbm5lY3RTb3VyY2UgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc2tpcFNhdmUgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMuc291cmNlTm9kZUF0dHIgPSBub2RlQXR0cmlidXRlO1xuICAgIHRoaXMuc291cmNlRWRnZUF0dHIgPSBlZGdlQXR0cmlidXRlO1xuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7IG5vZGVDbGFzcywgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSwgc2tpcFNhdmUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMudGFyZ2V0Tm9kZUF0dHIgPSBub2RlQXR0cmlidXRlO1xuICAgIHRoaXMudGFyZ2V0RWRnZUF0dHIgPSBlZGdlQXR0cmlidXRlO1xuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0U291cmNlICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdKSB7XG4gICAgICBkZWxldGUgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMuc291cmNlTm9kZUF0dHIgPSBudWxsO1xuICAgIHRoaXMuc291cmNlRWRnZUF0dHIgPSBudWxsO1xuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoeyBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkge1xuICAgICAgZGVsZXRlIHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldE5vZGVBdHRyID0gbnVsbDtcbiAgICB0aGlzLnRhcmdldEVkZ2VBdHRyID0gbnVsbDtcbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkUm93cyA9IG9wdGlvbnMuY29ubmVjdGVkUm93cyB8fCB7fTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICBpZiAodGhpcy5lbnRyaWVzW2hhc2hdLmluZGV4T2YodmFsdWUpID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcbmxldCBORVhUX1RBQkxFX0lEID0gMTtcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRBQkxFUyA9IFRBQkxFUztcbiAgICB0aGlzLkNMQVNTRVMgPSBDTEFTU0VTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcbiAgICB0aGlzLklOREVYRVMgPSBJTkRFWEVTO1xuXG4gICAgLy8gRGVmYXVsdCBuYW1lZCBmdW5jdGlvbnNcbiAgICB0aGlzLk5BTUVEX0ZVTkNUSU9OUyA9IHtcbiAgICAgIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkgeyB5aWVsZCB3cmFwcGVkSXRlbS5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAoIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgICF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBHcmFuZHBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgaWYgKCEocGFyZW50VHlwZSA9PT0gJ251bWJlcicgfHwgcGFyZW50VHlwZSA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyZW50IGlzbid0IGEga2V5IC8gaW5kZXhgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0RmluaXNoOiBmdW5jdGlvbiAqICh0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgeWllbGQge1xuICAgICAgICAgIGxlZnQ6IHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLFxuICAgICAgICAgIHJpZ2h0OiBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW1cbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy50YWJsZXMgPSB0aGlzLmh5ZHJhdGUoJ211cmVfdGFibGVzJywgdGhpcy5UQUJMRVMpO1xuICAgIE5FWFRfVEFCTEVfSUQgPSBPYmplY3Qua2V5cyh0aGlzLnRhYmxlcylcbiAgICAgIC5yZWR1Y2UoKGhpZ2hlc3ROdW0sIHRhYmxlSWQpID0+IHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KGhpZ2hlc3ROdW0sIHBhcnNlSW50KHRhYmxlSWQubWF0Y2goL3RhYmxlKFxcZCopLylbMV0pKTtcbiAgICAgIH0sIDApICsgMTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMuaHlkcmF0ZSgnbXVyZV9jbGFzc2VzJywgdGhpcy5DTEFTU0VTKTtcbiAgICBORVhUX0NMQVNTX0lEID0gT2JqZWN0LmtleXModGhpcy5jbGFzc2VzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgY2xhc3NJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQoY2xhc3NJZC5tYXRjaCgvY2xhc3MoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuICB9XG5cbiAgc2F2ZVRhYmxlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ211cmVfdGFibGVzJywgdGhpcy50YWJsZXMpO1xuICAgIHRoaXMudHJpZ2dlcigndGFibGVVcGRhdGUnKTtcbiAgfVxuICBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ211cmVfY2xhc3NlcycsIHRoaXMuY2xhc3Nlcyk7XG4gICAgdGhpcy50cmlnZ2VyKCdjbGFzc1VwZGF0ZScpO1xuICB9XG5cbiAgaHlkcmF0ZSAoc3RvcmFnZUtleSwgVFlQRVMpIHtcbiAgICBsZXQgY29udGFpbmVyID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShzdG9yYWdlS2V5KTtcbiAgICBjb250YWluZXIgPSBjb250YWluZXIgPyBKU09OLnBhcnNlKGNvbnRhaW5lcikgOiB7fTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb250YWluZXIpKSB7XG4gICAgICBjb25zdCB0eXBlID0gdmFsdWUudHlwZTtcbiAgICAgIGRlbGV0ZSB2YWx1ZS50eXBlO1xuICAgICAgdmFsdWUubXVyZSA9IHRoaXM7XG4gICAgICBjb250YWluZXJba2V5XSA9IG5ldyBUWVBFU1t0eXBlXSh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cbiAgZGVoeWRyYXRlIChzdG9yYWdlS2V5LCBjb250YWluZXIpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlLl90b1Jhd09iamVjdCgpO1xuICAgICAgICByZXN1bHRba2V5XS50eXBlID0gdmFsdWUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oc3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gICAgfVxuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG5cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMudGFibGVJZCkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHtORVhUX1RBQkxFX0lEfWA7XG4gICAgICBORVhUX1RBQkxFX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLlRBQkxFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFR5cGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICBpZiAoIW9wdGlvbnMuY2xhc3NJZCkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLkNMQVNTRVNbb3B0aW9ucy50eXBlXTtcbiAgICBkZWxldGUgb3B0aW9ucy50eXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cblxuICBuZXdUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlT2JqID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGVPYmo7XG4gIH1cbiAgbmV3Q2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdDbGFzc09iaiA9IHRoaXMuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gICAgdGhpcy5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdDbGFzc09iajtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY1RhYmxlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNUYWJsZSgpIGluc3RlYWQuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljVGFibGUoe1xuICAgICAgbmFtZTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljVGFibGUgKHsgbmFtZSwgZXh0ZW5zaW9uID0gJ3R4dCcsIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBkYXRhID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBhdHRyaWJ1dGVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBkYXRhLmNvbHVtbnMpIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgZGF0YS5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY1RhYmxlKHsgbmFtZSwgZGF0YSwgYXR0cmlidXRlcyB9KTtcbiAgfVxuICBhZGRTdGF0aWNUYWJsZSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudHlwZSA9IG9wdGlvbnMuZGF0YSBpbnN0YW5jZW9mIEFycmF5ID8gJ1N0YXRpY1RhYmxlJyA6ICdTdGF0aWNEaWN0JztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLm5ld1RhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHsgdGhpcy50YWJsZXNbdGFibGVJZF0uZGVsZXRlKCk7IH0gY2F0Y2ggKGVycikge31cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZGVsZXRlQWxsQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzT2JqLmRlbGV0ZSgpO1xuICAgIH1cbiAgfVxuICBnZXRDbGFzc0RhdGEgKCkge1xuICAgIGNvbnN0IHJlc3VsdHMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgcmVzdWx0c1tjbGFzc09iai5jbGFzc0lkXSA9IGNsYXNzT2JqLmN1cnJlbnREYXRhO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCBGaWxlUmVhZGVyIGZyb20gJ2ZpbGVyZWFkZXInO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKEZpbGVSZWFkZXIsIG51bGwpO1xubXVyZS52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycyIsImluZGV4T2YiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImZvckVhY2giLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJPYmplY3QiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwiY29uZmlndXJhYmxlIiwiZ2V0IiwidGVtcCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIlRhYmxlIiwib3B0aW9ucyIsIl9tdXJlIiwibXVyZSIsInRhYmxlSWQiLCJFcnJvciIsIl9leHBlY3RlZEF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVzIiwiX29ic2VydmVkQXR0cmlidXRlcyIsIl9kZXJpdmVkVGFibGVzIiwiZGVyaXZlZFRhYmxlcyIsIl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImF0dHIiLCJzdHJpbmdpZmllZEZ1bmMiLCJlbnRyaWVzIiwiaHlkcmF0ZUZ1bmN0aW9uIiwiX3RvUmF3T2JqZWN0IiwicmVzdWx0IiwiX2F0dHJpYnV0ZXMiLCJ1c2VkQnlDbGFzc2VzIiwiX3VzZWRCeUNsYXNzZXMiLCJmdW5jIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJuYW1lIiwiaXRlcmF0ZSIsInJlc2V0IiwibGltaXQiLCJJbmZpbml0eSIsIl9jYWNoZSIsImZpbmlzaGVkSXRlbSIsInZhbHVlcyIsIl9idWlsZENhY2hlIiwiX3BhcnRpYWxDYWNoZSIsImRlcml2ZWRUYWJsZSIsIml0ZXJhdG9yIiwiX2l0ZXJhdGUiLCJjb21wbGV0ZWQiLCJuZXh0IiwiZG9uZSIsIl9maW5pc2hJdGVtIiwid3JhcHBlZEl0ZW0iLCJyb3ciLCJrZXlzIiwiX3dyYXAiLCJ0YWJsZSIsImNsYXNzT2JqIiwiV1JBUFBFUlMiLCJHZW5lcmljV3JhcHBlciIsIl9nZXRBbGxBdHRyaWJ1dGVzIiwiYWxsQXR0cnMiLCJjdXJyZW50RGF0YSIsImRhdGEiLCJjb21wbGV0ZSIsImRlcml2ZUF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsIl9kZXJpdmVUYWJsZSIsIm5ld1RhYmxlIiwiY3JlYXRlVGFibGUiLCJzYXZlVGFibGVzIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlSWQiLCJmaW5kIiwidGFibGVPYmoiLCJldmVyeSIsIm9wdGlvbk5hbWUiLCJvcHRpb25WYWx1ZSIsInRhYmxlcyIsImFnZ3JlZ2F0ZSIsImV4cGFuZCIsImRlbGltaXRlciIsImNsb3NlZEZhY2V0IiwibWFwIiwib3BlbkZhY2V0IiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0Iiwib3RoZXJUYWJsZSIsImNsYXNzZXMiLCJwYXJlbnRUYWJsZXMiLCJyZWR1Y2UiLCJhZ2ciLCJkZWxldGUiLCJsZW5ndGgiLCJwYXJlbnRUYWJsZSIsImV4ZWMiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJpdGVtIiwiU3RhdGljRGljdCIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIkFnZ3JlZ2F0ZWRUYWJsZSIsIl9hdHRyaWJ1dGUiLCJfcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIiwicmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIiwiX2RlaHlkcmF0ZUZ1bmN0aW9uIiwiZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSIsIl91cGRhdGVJdGVtIiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsIm5ld1dyYXBwZWRJdGVtIiwid3JhcHBlZFBhcmVudCIsIm5ld0l0ZW0iLCJjb25uZWN0ZWRSb3dzIiwiRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIiwiX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfZHVwbGljYXRlZEF0dHJpYnV0ZXMiLCJkdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZUF0dHJpYnV0ZSIsInBhcmVudElkIiwiX2R1cGxpY2F0ZUF0dHJpYnV0ZXMiLCJFeHBhbmRlZFRhYmxlIiwicGFyZW50VGFibGVJZCIsInNwbGl0IiwiRmlsdGVyZWRUYWJsZSIsIl92YWx1ZSIsInRvUmF3T2JqZWN0IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicGFyZW50VGFibGUyIiwid3JhcCIsIkdlbmVyaWNDbGFzcyIsImNsYXNzSWQiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbiIsInNldENsYXNzTmFtZSIsInNhdmVDbGFzc2VzIiwiaGFzQ3VzdG9tTmFtZSIsImdldEhhc2hUYWJsZSIsImludGVycHJldEFzTm9kZXMiLCJuZXdDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJOb2RlQ2xhc3MiLCJlZGdlQ2xhc3NJZHMiLCJXcmFwcGVyIiwiTm9kZVdyYXBwZXIiLCJkaXNjb25uZWN0QWxsRWRnZXMiLCJzb3VyY2VFZGdlQ2xhc3MiLCJzb3VyY2VOb2RlSWQiLCJzb3VyY2VOb2RlQXR0ciIsInNvdXJjZUVkZ2VBdHRyIiwidGFyZ2V0Tm9kZUF0dHIiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJ0YXJnZXROb2RlSWQiLCJ0YXJnZXRFZGdlQXR0ciIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwiZGlyZWN0ZWQiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJuZXdFZGdlQ2xhc3MiLCJjcmVhdGVDbGFzcyIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwiZWRnZUNsYXNzIiwibm9kZUNsYXNzIiwiZWRnZUNsYXNzSWQiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIkVkZ2VDbGFzcyIsIkVkZ2VXcmFwcGVyIiwiZGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJjb25uZWN0VGFyZ2V0IiwiY29ubmVjdFNvdXJjZSIsInRvZ2dsZU5vZGVEaXJlY3Rpb24iLCJpbnRlcm1lZGlhdGVTb3VyY2VzIiwic2tpcFNhdmUiLCJ1bmRlZmluZWQiLCJJbk1lbW9yeUluZGV4IiwiaXRlckVudHJpZXMiLCJoYXNoIiwidmFsdWVMaXN0IiwiaXRlckhhc2hlcyIsIml0ZXJWYWx1ZUxpc3RzIiwiZ2V0VmFsdWVMaXN0IiwiYWRkVmFsdWUiLCJORVhUX0NMQVNTX0lEIiwiTkVYVF9UQUJMRV9JRCIsIk11cmUiLCJGaWxlUmVhZGVyIiwibG9jYWxTdG9yYWdlIiwibWltZSIsImRlYnVnIiwiREFUQUxJQl9GT1JNQVRTIiwiVEFCTEVTIiwiQ0xBU1NFUyIsIklOREVYRVMiLCJOQU1FRF9GVU5DVElPTlMiLCJpZGVudGl0eSIsInJhd0l0ZW0iLCJrZXkiLCJUeXBlRXJyb3IiLCJwYXJlbnRUeXBlIiwiZGVmYXVsdEZpbmlzaCIsInRoaXNXcmFwcGVkSXRlbSIsIm90aGVyV3JhcHBlZEl0ZW0iLCJsZWZ0IiwicmlnaHQiLCJzaGExIiwiSlNPTiIsInN0cmluZ2lmeSIsIm5vb3AiLCJoeWRyYXRlIiwiaGlnaGVzdE51bSIsIk1hdGgiLCJtYXgiLCJwYXJzZUludCIsIm1hdGNoIiwiZGVoeWRyYXRlIiwic3RvcmFnZUtleSIsIlRZUEVTIiwiY29udGFpbmVyIiwiZ2V0SXRlbSIsInBhcnNlIiwic2V0SXRlbSIsIkZ1bmN0aW9uIiwidG9TdHJpbmciLCJUeXBlIiwic2VsZWN0b3IiLCJuZXdUYWJsZU9iaiIsIm5ld0NsYXNzT2JqIiwiYWRkRmlsZUFzU3RhdGljVGFibGUiLCJmaWxlT2JqIiwiZW5jb2RpbmciLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsImNvbnNvbGUiLCJ3YXJuIiwidGV4dCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicmVhZGVyIiwib25sb2FkIiwicmVhZEFzVGV4dCIsImFkZFN0cmluZ0FzU3RhdGljVGFibGUiLCJleHRlbnNpb24iLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNUYWJsZSIsIkFycmF5IiwiZGVsZXRlQWxsVW51c2VkVGFibGVzIiwiZXJyIiwiZGVsZXRlQWxsQ2xhc3NlcyIsImdldENsYXNzRGF0YSIsInJlc3VsdHMiLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FBSTtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FB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
