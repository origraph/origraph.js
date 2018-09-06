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

  async *iterate(options = {}) {
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

  async countRows() {
    if (this._cache) {
      return Object.keys(this._cache).length;
    } else {
      let count = 0;

      const iterator = this._buildCache();

      let temp = await iterator.next();

      while (!temp.done) {
        count++;
        temp = await iterator.next();
      }

      return count;
    }
  }

  async *_buildCache(options = {}) {
    // TODO: in large data scenarios, we should build the cache / index
    // externally on disk
    this._partialCache = {};
    const limit = options.limit === undefined ? Infinity : options.limit;
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

  shortestPathToTable(otherTable) {
    // Dijkstra's algorithm...
    const visited = {};
    const distances = {};
    const prevTables = {};

    const visit = targetId => {
      const targetTable = this._mure.tables[targetId]; // Only check the unvisited derived and parent tables

      const neighborList = Object.keys(targetTable._derivedTables).concat(targetTable.parentTables.map(parentTable => parentTable.tableId)).filter(tableId => !visited[tableId]); // Check and assign (or update) tentative distances to each neighbor

      for (const neighborId of neighborList) {
        if (distances[neighborId] === undefined) {
          distances[neighborId] = Infinity;
        }

        if (distances[targetId] + 1 < distances[neighborId]) {
          distances[neighborId] = distances[targetId] + 1;
          prevTables[neighborId] = targetId;
        }
      } // Okay, this table is officially visited; take it out of the running
      // for future visits / checks


      visited[targetId] = true;
      delete distances[targetId];
    }; // Start with this table


    prevTables[this.tableId] = null;
    distances[this.tableId] = 0;
    let toVisit = Object.keys(distances);

    while (toVisit.length > 0) {
      // Visit the next table that has the shortest distance
      toVisit.sort((a, b) => distances[a] - distances[b]);
      let nextId = toVisit.shift();

      if (nextId === otherTable.tableId) {
        // Found otherTable! Send back the chain of connected tables
        const chain = [];

        while (prevTables[nextId] !== null) {
          chain.unshift(this._mure.tables[nextId]);
          nextId = prevTables[nextId];
        }

        return chain;
      } else {
        // Visit the table
        visit(nextId);
        toVisit = Object.keys(distances);
      }
    } // We didn't find it; there's no connection


    return null;
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
        type: 'FacetedTable',
        attribute,
        value
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }

  async *openFacet(attribute, limit = Infinity) {
    const values = {};

    for await (const wrappedItem of this.iterate({
      limit
    })) {
      const value = wrappedItem.row[attribute];

      if (!values[value]) {
        values[value] = true;
        const options = {
          type: 'FacetedTable',
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

class StaticDictTable extends Table {
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
    const parentTable = this.parentTable;

    for await (const wrappedParent of parentTable.iterate(options)) {
      const index = wrappedParent.row[this._attribute];

      if (!this._partialCache) {
        // We were reset; return immediately
        return;
      } else if (this._partialCache[index]) {
        const existingItem = this._partialCache[index];
        existingItem.connectItem(parentTable.tableId, wrappedParent);
        wrappedParent.connectItem(this.tableId, existingItem);

        this._updateItem(existingItem, wrappedParent);
      } else {
        const newItem = this._wrap({
          index
        });

        newItem.connectItem(parentTable.tableId, wrappedParent);
        wrappedParent.connectItem(this.tableId, newItem);

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
      this._duplicatedAttributes[parentId] = this._duplicatedAttributes[parentId] || [];

      this._duplicatedAttributes[parentId].push(attribute);

      this.reset();
    }

    _duplicateAttributes(wrappedItem) {
      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const parentName = this._mure.tables[parentId].name;
        wrappedItem.row[`${parentName}.${attr}`] = wrappedItem.connectedItems[parentId][0].row[attr];
      }
    }

    _getAllAttributes() {
      const result = super._getAllAttributes();

      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const parentName = this._mure.tables[parentId].name;
        result[`${parentName}.${attr}`] = true;
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

    if (!this._attribute) {
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
    const parentTable = this.parentTable;

    for await (const wrappedParent of parentTable.iterate(options)) {
      const values = (wrappedParent.row[this._attribute] || '').split(this.delimiter);

      for (const value of values) {
        const row = {};
        row[this._attribute] = value;

        const newItem = this._wrap({
          index,
          row
        });

        newItem.connectItem(parentTable.tableId, wrappedParent);
        wrappedParent.connectItem(this.tableId, newItem);

        this._duplicateAttributes(newItem);

        this._finishItem(newItem);

        yield newItem;
        index++;
      }
    }
  }

}

class FacetedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;
    this._value = options.value;

    if (!this._attribute === undefined || !this._value === undefined) {
      throw new Error(`attribute and value are required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.value = this._value;
    return obj;
  }

  get name() {
    return `${this.parentTable.name}[${this._value}]`;
  }

  async *_iterate(options) {
    let index = 0;
    const parentTable = this.parentTable;

    for await (const wrappedParent of parentTable.iterate(options)) {
      const includeItem = () => {
        const newItem = this._wrap({
          index,
          row: Object.assign({}, wrappedParent.row)
        });

        newItem.connectItem(parentTable.tableId, wrappedParent);
        wrappedParent.connectItem(this.tableId, newItem);

        this._finishItem(newItem);

        index++;
        return newItem;
      };

      if (this._attribute === null) {
        if (wrappedParent.index === this._value) {
          yield includeItem();
        }
      } else {
        if (wrappedParent.row[this._attribute] === this._value) {
          yield includeItem();
        }
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
      await parentTable.countRows();
    } // Now that the caches are built, just iterate their keys directly. We only
    // care about including rows that have exact matches across all tables, so
    // we can just pick one parent table to iterate


    const baseParentTable = parentTables[0];
    const otherParentTables = parentTables.slice(1);

    for (const index in baseParentTable._cache) {
      if (!parentTables.every(table => table._cache)) {
        // One of the parent tables was reset; return immediately
        return;
      }

      if (!otherParentTables.every(table => table._cache[index])) {
        // No match in one of the other tables; omit this item
        continue;
      } // TODO: add each parent tables' keys as attribute values


      const newItem = this._wrap({
        index
      });

      for (const table of parentTables) {
        newItem.connectItem(table.tableId, table._cache[index]);

        table._cache[index].connectItem(this.tableId, newItem);
      }

      this._duplicateAttributes(newItem);

      this._finishItem(newItem);

      yield newItem;
    }
  }

}



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDictTable: StaticDictTable,
  AggregatedTable: AggregatedTable,
  ExpandedTable: ExpandedTable,
  FacetedTable: FacetedTable,
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
    options.classObj = this;
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

  _deriveGenericClass(newTable) {
    return this._mure.newClass({
      tableId: newTable.tableId,
      type: 'GenericClass'
    });
  }

  aggregate(attribute) {
    return this._deriveGenericClass(this.table.aggregate(attribute));
  }

  expand(attribute, delimiter) {
    return this._deriveGenericClass(this.table.expand(attribute, delimiter));
  }

  closedFacet(attribute, values) {
    return this.table.closedFacet(attribute, values).map(newTable => {
      return this._deriveGenericClass(newTable);
    });
  }

  async *openFacet(attribute) {
    for await (const newTable of this.table.openFacet(attribute)) {
      yield this._deriveGenericClass(newTable);
    }
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
    this._cachedShortestEdgePaths = {};
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.edgeClassIds = this.edgeClassIds;
    return result;
  }

  _wrap(options) {
    options.classObj = this;
    return new this._mure.WRAPPERS.NodeWrapper(options);
  }

  async prepShortestEdgePath(edgeClassId) {
    if (this._cachedShortestEdgePaths[edgeClassId] !== undefined) {
      return this._cachedShortestEdgePaths[edgeClassId];
    } else {
      const edgeTable = this._mure.classes[edgeClassId].table;
      const idList = [];

      for (const table of this.table.shortestPathToTable(edgeTable)) {
        idList.push(table.tableId); // Spin through the table to make sure all its rows are wrapped and connected

        await table.countRows();
      }

      this._cachedShortestEdgePaths[edgeClassId] = idList;
      return this._cachedShortestEdgePaths[edgeClassId];
    }
  }

  interpretAsNodes() {
    return this;
  }

  interpretAsEdges() {
    const edgeClassIds = Object.keys(this.edgeClassIds);

    const options = super._toRawObject();

    if (edgeClassIds.length > 2) {
      // If there are more than two edges, break all connections and make
      // this a floating edge (for now, we're not dealing in hyperedges)
      this.disconnectAllEdges();
    } else if (edgeClassIds.length === 1) {
      // With only one connection, this node should become a self-edge
      // (or a floating edge if edgeClass.sourceClassId is null)
      const edgeClass = this._mure.classes[edgeClassIds[0]];
      options.sourceClassId = edgeClass.sourceClassId;
      options.targetClassId = edgeClass.sourceClassId;
      options.directed = edgeClass.directed;
      edgeClass.delete();
    } else if (edgeClassIds.length === 2) {
      let sourceEdgeClass = this._mure.classes[edgeClassIds[0]];
      let targetEdgeClass = this._mure.classes[edgeClassIds[1]]; // Figure out the direction, if there is one

      options.directed = false;

      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        if (sourceEdgeClass.targetClassId === this.classId && targetEdgeClass.sourceClassId === this.classId) {
          // We happened to get the edges in order; set directed to true
          options.directed = true;
        } else if (sourceEdgeClass.sourceClassId === this.classId && targetEdgeClass.targetClassId === this.classId) {
          // We got the edges backwards; swap them and set directed to true
          targetEdgeClass = this._mure.classes[edgeClassIds[0]];
          sourceEdgeClass = this._mure.classes[edgeClassIds[1]];
          options.directed = true;
        }
      } // Okay, now we know how to set source / target ids


      options.sourceClassId = sourceEdgeClass.classId;
      options.targetClassId = targetEdgeClass.classId; // Delete each of the edge classes

      sourceEdgeClass.delete();
      targetEdgeClass.delete();
    }

    this.delete();
    delete options.classId;
    delete options.edgeClassIds;
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
      targetClassId: otherNodeClass.classId
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
    this.sourceClassId = options.sourceClassId || null;
    this.targetClassId = options.targetClassId || null;
    this.directed = options.directed || false;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.targetClassId = this.targetClassId;
    result.directed = this.directed;
    return result;
  }

  _wrap(options) {
    options.classObj = this;
    return new this._mure.WRAPPERS.EdgeWrapper(options);
  }

  _pickEdgeTable(otherClass) {
    let edgeTable;
    let chain = this.table.shortestPathToTable(otherClass.table);

    if (chain === null) {
      throw new Error(`Underlying table chain between edge and node classes is broken`);
    } else if (chain.length <= 2) {
      // Weird corner case where we're trying to create an edge between
      // adjacent or identical tables... create a ConnectedTable
      edgeTable = this.table.connect(otherClass.table);
    } else {
      // Use a table in the middle; prioritize StaticTable and StaticDictTable
      let staticExists = false;
      chain = chain.slice(1, chain.length - 1).map((table, dist) => {
        staticExists = staticExists || table.type.startsWith('Static');
        return {
          table,
          dist
        };
      });

      if (staticExists) {
        chain = chain.filter(({
          table
        }) => {
          return table.type.startsWith('Static');
        });
      }

      edgeTable = chain[0].table;
    }

    return edgeTable;
  }

  async prepShortestSourcePath() {
    if (this._cachedShortestSourcePath !== undefined) {
      return this._cachedShortestSourcePath;
    } else if (this._sourceClassId === null) {
      return null;
    } else {
      const sourceTable = this._mure.classes[this.sourceClassId].table;
      const idList = [];

      for (const table of this.table.shortestPathToTable(sourceTable)) {
        idList.push(table.tableId); // Spin through the table to make sure all its rows are wrapped and connected

        await table.countRows();
      }

      this._cachedShortestSourcePath = idList;
      return this._cachedShortestSourcePath;
    }
  }

  async prepShortestTargetPath() {
    if (this._cachedShortestTargetPath !== undefined) {
      return this._cachedShortestTargetPath;
    } else if (this._targetClassId === null) {
      return null;
    } else {
      const targetTable = this._mure.classes[this.targetClassId].table;
      const idList = [];

      for (const table of this.table.shortestPathToTable(targetTable)) {
        idList.push(table.tableId); // Spin through the table to make sure all its rows are wrapped and connected

        await table.countRows();
      }

      this._cachedShortestTargetPath = idList;
      return this._cachedShortestTargetPath;
    }
  }

  interpretAsNodes() {
    const temp = this._toRawObject();

    this.delete();
    temp.type = 'NodeClass';
    delete temp.classId;

    const newNodeClass = this._mure.createClass(temp);

    if (temp.sourceClassId) {
      const sourceClass = this._mure.classes[this.sourceClassId];

      const edgeTable = this._pickEdgeTable(sourceClass);

      const sourceEdgeClass = this._mure.createClass({
        type: 'EdgeClass',
        tableId: edgeTable.tableId,
        directed: temp.directed,
        sourceClassId: temp.sourceClassId,
        targetClassId: newNodeClass.classId
      });

      sourceClass.edgeClassIds[sourceEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[sourceEdgeClass.classId] = true;
    }

    if (temp.targetClassId && temp.sourceClassId !== temp.targetClassId) {
      const targetClass = this._mure.classes[this.targetClassId];

      const edgeTable = this._pickEdgeTable(targetClass);

      const targetEdgeClass = this._mure.createClass({
        type: 'EdgeClass',
        tableId: edgeTable.tableId,
        directed: temp.directed,
        sourceClassId: newNodeClass.classId,
        targetClassId: temp.targetClassId
      });

      targetClass.edgeClassIds[targetEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[targetEdgeClass.classId] = true;
    }

    this._mure.saveClasses();

    return newNodeClass;
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
    if (direction) {
      this.directed = true;
    }

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
    const sourceClass = this._mure.classes[this.sourceClassId];
    sourceClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.getHashTable(nodeAttribute);
    edgeHash.connect([nodeHash]);

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  connectTarget({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null,
    skipSave = false
  } = {}) {
    if (this.targetClassId) {
      this.disconnectTarget({
        skipSave: true
      });
    }

    this.targetClassId = nodeClass.classId;
    const targetClass = this._mure.classes[this.targetClassId];
    targetClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.getHashTable(nodeAttribute);
    edgeHash.connect([nodeHash]);

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  disconnectSource({
    skipSave = false
  } = {}) {
    const existingSourceClass = this._mure.classes[this.sourceClassId];

    if (existingSourceClass) {
      delete existingSourceClass.edgeClassIds[this.classId];
      delete existingSourceClass._cachedShortestEdgePaths[this.classId];
    }

    delete this._cachedShortestSourcePath;

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  disconnectTarget({
    skipSave = false
  } = {}) {
    const existingTargetClass = this._mure.classes[this.targetClassId];

    if (existingTargetClass) {
      delete existingTargetClass.edgeClassIds[this.classId];
      delete existingTargetClass._cachedShortestEdgePaths[this.classId];
    }

    delete this._cachedShortestTargetPath;

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
    this.table = options.table;

    if (this.index === undefined || !this.table) {
      throw new Error(`index and table are required`);
    }

    this.classObj = options.classObj || null;
    this.row = options.row || {};
    this.connectedItems = options.connectedItems || {};
  }

  connectItem(tableId, item) {
    this.connectedItems[tableId] = this.connectedItems[tableId] || [];

    if (this.connectedItems[tableId].indexOf(item) === -1) {
      this.connectedItems[tableId].push(item);
    }
  }

  *iterateAcrossConnections(tableIds) {
    if (tableIds.length === 1) {
      yield* this.connectedItems[tableIds[0]] || [];
    } else {
      const thisTableId = tableIds[0];
      const remainingTableIds = tableIds.slice(1);

      for (const item of this.connectedItems[thisTableId] || []) {
        yield* item.iterateAcrossConnections(remainingTableIds);
      }
    }
  }

}

Object.defineProperty(GenericWrapper, 'type', {
  get() {
    return /(.*)Wrapper/.exec(this.name)[1];
  }

});

class NodeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  async *edges({
    limit = Infinity
  } = {}) {
    let i = 0;

    for (const edgeClassId of Object.keys(this.classObj.edgeClassIds)) {
      const tableIdChain = await this.classObj.prepShortestEdgePath(edgeClassId);
      const iterator = this.iterateAcrossConnections(tableIdChain);
      let temp = iterator.next();

      while (!temp.done && i < limit) {
        yield temp.value;
        i++;
        temp = iterator.next();
      }

      if (i >= limit) {
        return;
      }
    }
  }

}

class EdgeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  async *sourceNodes({
    limit = Infinity
  } = {}) {
    const iterator = this.iterateAcrossConnections((await this.classObj.prepShortestSourcePath()));

    for (let i = 0; i < limit; i++) {
      const temp = iterator.next();

      if (!temp.done) {
        yield temp.value;
      }
    }
  }

  async *targetNodes({
    limit = Infinity
  } = {}) {
    const iterator = this.iterateAcrossConnections((await this.classObj.prepShortestTargetPath()));

    for (let i = 0; i < limit; i++) {
      const temp = iterator.next();

      if (!temp.done) {
        yield temp.value;
      }
    }
  }

}



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
    options.type = options.data instanceof Array ? 'StaticTable' : 'StaticDictTable';
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
var version = "0.5.5";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TaW5nbGVQYXJlbnRNaXhpbi5qcyIsIi4uL3NyYy9UYWJsZXMvQWdncmVnYXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0V4cGFuZGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0ZhY2V0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcblxuY2xhc3MgVGFibGUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMuX211cmUgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtdXJlIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzID0gb3B0aW9ucy5kZXJpdmVkVGFibGVzIHx8IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGlmIChvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIHVzZWRCeUNsYXNzZXM6IHRoaXMuX3VzZWRCeUNsYXNzZXMsXG4gICAgICBkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zOiB7fVxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBHZW5lcmljIGNhY2hpbmcgc3R1ZmY7IHRoaXMgaXNuJ3QganVzdCBmb3IgcGVyZm9ybWFuY2UuIENvbm5lY3RlZFRhYmxlJ3NcbiAgICAvLyBhbGdvcml0aG0gcmVxdWlyZXMgdGhhdCBpdHMgcGFyZW50IHRhYmxlcyBoYXZlIHByZS1idWlsdCBpbmRleGVzICh3ZVxuICAgIC8vIHRlY2huaWNhbGx5IGNvdWxkIGltcGxlbWVudCBpdCBkaWZmZXJlbnRseSwgYnV0IGl0IHdvdWxkIGJlIGV4cGVuc2l2ZSxcbiAgICAvLyByZXF1aXJlcyB0cmlja3kgbG9naWMsIGFuZCB3ZSdyZSBhbHJlYWR5IGJ1aWxkaW5nIGluZGV4ZXMgZm9yIHNvbWUgdGFibGVzXG4gICAgLy8gbGlrZSBBZ2dyZWdhdGVkVGFibGUgYW55d2F5KVxuICAgIGlmIChvcHRpb25zLnJlc2V0KSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgZm9yIChjb25zdCBmaW5pc2hlZEl0ZW0gb2YgT2JqZWN0LnZhbHVlcyh0aGlzLl9jYWNoZSkpIHtcbiAgICAgICAgeWllbGQgZmluaXNoZWRJdGVtO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHlpZWxkICogYXdhaXQgdGhpcy5fYnVpbGRDYWNoZShvcHRpb25zKTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGU7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGFzeW5jIGNvdW50Um93cyAoKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fY2FjaGUpLmxlbmd0aDtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5fYnVpbGRDYWNoZSgpO1xuICAgICAgbGV0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICB3aGlsZSAoIXRlbXAuZG9uZSkge1xuICAgICAgICBjb3VudCsrO1xuICAgICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpO1xuICAgIGxldCBjb21wbGV0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBpdGVyYXRpb24gd2FzIGNhbmNlbGxlZDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgY29tcGxldGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHRlbXAudmFsdWUpO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGVtcC52YWx1ZS5pbmRleF0gPSB0ZW1wLnZhbHVlO1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgT2JqZWN0LmtleXMod3JhcHBlZEl0ZW0ucm93KSkge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgcmV0dXJuIGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBfZ2V0QWxsQXR0cmlidXRlcyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG4gIGdldCBhdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZ2V0QWxsQXR0cmlidXRlcygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMuX211cmUuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlVGFibGVzKCk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZUlkID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlSWQgJiYgdGhpcy5fbXVyZS50YWJsZXNbZXhpc3RpbmdUYWJsZUlkXSkgfHwgbnVsbDtcbiAgfVxuICBzaG9ydGVzdFBhdGhUb1RhYmxlIChvdGhlclRhYmxlKSB7XG4gICAgLy8gRGlqa3N0cmEncyBhbGdvcml0aG0uLi5cbiAgICBjb25zdCB2aXNpdGVkID0ge307XG4gICAgY29uc3QgZGlzdGFuY2VzID0ge307XG4gICAgY29uc3QgcHJldlRhYmxlcyA9IHt9O1xuICAgIGNvbnN0IHZpc2l0ID0gdGFyZ2V0SWQgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0VGFibGUgPSB0aGlzLl9tdXJlLnRhYmxlc1t0YXJnZXRJZF07XG4gICAgICAvLyBPbmx5IGNoZWNrIHRoZSB1bnZpc2l0ZWQgZGVyaXZlZCBhbmQgcGFyZW50IHRhYmxlc1xuICAgICAgY29uc3QgbmVpZ2hib3JMaXN0ID0gT2JqZWN0LmtleXModGFyZ2V0VGFibGUuX2Rlcml2ZWRUYWJsZXMpXG4gICAgICAgIC5jb25jYXQodGFyZ2V0VGFibGUucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS50YWJsZUlkKSlcbiAgICAgICAgLmZpbHRlcih0YWJsZUlkID0+ICF2aXNpdGVkW3RhYmxlSWRdKTtcbiAgICAgIC8vIENoZWNrIGFuZCBhc3NpZ24gKG9yIHVwZGF0ZSkgdGVudGF0aXZlIGRpc3RhbmNlcyB0byBlYWNoIG5laWdoYm9yXG4gICAgICBmb3IgKGNvbnN0IG5laWdoYm9ySWQgb2YgbmVpZ2hib3JMaXN0KSB7XG4gICAgICAgIGlmIChkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9IEluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIGlmIChkaXN0YW5jZXNbdGFyZ2V0SWRdICsgMSA8IGRpc3RhbmNlc1tuZWlnaGJvcklkXSkge1xuICAgICAgICAgIGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9IGRpc3RhbmNlc1t0YXJnZXRJZF0gKyAxO1xuICAgICAgICAgIHByZXZUYWJsZXNbbmVpZ2hib3JJZF0gPSB0YXJnZXRJZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgdGhpcyB0YWJsZSBpcyBvZmZpY2lhbGx5IHZpc2l0ZWQ7IHRha2UgaXQgb3V0IG9mIHRoZSBydW5uaW5nXG4gICAgICAvLyBmb3IgZnV0dXJlIHZpc2l0cyAvIGNoZWNrc1xuICAgICAgdmlzaXRlZFt0YXJnZXRJZF0gPSB0cnVlO1xuICAgICAgZGVsZXRlIGRpc3RhbmNlc1t0YXJnZXRJZF07XG4gICAgfTtcblxuICAgIC8vIFN0YXJ0IHdpdGggdGhpcyB0YWJsZVxuICAgIHByZXZUYWJsZXNbdGhpcy50YWJsZUlkXSA9IG51bGw7XG4gICAgZGlzdGFuY2VzW3RoaXMudGFibGVJZF0gPSAwO1xuICAgIGxldCB0b1Zpc2l0ID0gT2JqZWN0LmtleXMoZGlzdGFuY2VzKTtcbiAgICB3aGlsZSAodG9WaXNpdC5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBWaXNpdCB0aGUgbmV4dCB0YWJsZSB0aGF0IGhhcyB0aGUgc2hvcnRlc3QgZGlzdGFuY2VcbiAgICAgIHRvVmlzaXQuc29ydCgoYSwgYikgPT4gZGlzdGFuY2VzW2FdIC0gZGlzdGFuY2VzW2JdKTtcbiAgICAgIGxldCBuZXh0SWQgPSB0b1Zpc2l0LnNoaWZ0KCk7XG4gICAgICBpZiAobmV4dElkID09PSBvdGhlclRhYmxlLnRhYmxlSWQpIHtcbiAgICAgICAgLy8gRm91bmQgb3RoZXJUYWJsZSEgU2VuZCBiYWNrIHRoZSBjaGFpbiBvZiBjb25uZWN0ZWQgdGFibGVzXG4gICAgICAgIGNvbnN0IGNoYWluID0gW107XG4gICAgICAgIHdoaWxlIChwcmV2VGFibGVzW25leHRJZF0gIT09IG51bGwpIHtcbiAgICAgICAgICBjaGFpbi51bnNoaWZ0KHRoaXMuX211cmUudGFibGVzW25leHRJZF0pO1xuICAgICAgICAgIG5leHRJZCA9IHByZXZUYWJsZXNbbmV4dElkXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2hhaW47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBWaXNpdCB0aGUgdGFibGVcbiAgICAgICAgdmlzaXQobmV4dElkKTtcbiAgICAgICAgdG9WaXNpdCA9IE9iamVjdC5rZXlzKGRpc3RhbmNlcyk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFdlIGRpZG4ndCBmaW5kIGl0OyB0aGVyZSdzIG5vIGNvbm5lY3Rpb25cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnQWdncmVnYXRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnRXhwYW5kZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBkZWxpbWl0ZXJcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKHsgbGltaXQgfSkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKHsgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJyB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9tdXJlLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDAgfHwgdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbShpdGVtKTtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljRGljdFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB7fTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbShpdGVtKTtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpZXJkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEFnZ3JlZ2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgaWYgKG9wdGlvbnMucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLl9kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqYnO1xuICB9XG4gIGRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUgKGF0dHIsIGZ1bmMpIHtcbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfdXBkYXRlSXRlbSAob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHNvIHRoYXQgQWdncmVnYXRlZFRhYmxlIGNhbiB0YWtlIGFkdmFudGFnZVxuICAgIC8vIG9mIHRoZSBwYXJ0aWFsbHktYnVpbHQgY2FjaGUgYXMgaXQgZ29lcywgYW5kIHBvc3Rwb25lIGZpbmlzaGluZyBpdGVtc1xuICAgIC8vIHVudGlsIGFmdGVyIHRoZSBwYXJlbnQgdGFibGUgaGFzIGJlZW4gZnVsbHkgaXRlcmF0ZWRcblxuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuX2l0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt3cmFwcGVkSXRlbS5pbmRleF0gPSB3cmFwcGVkSXRlbTtcbiAgICAgIC8vIEdvIGFoZWFkIGFuZCB5aWVsZCB0aGUgdW5maW5pc2hlZCBpdGVtOyB0aGlzIG1ha2VzIGl0IHBvc3NpYmxlIGZvclxuICAgICAgLy8gY2xpZW50IGFwcHMgdG8gYmUgbW9yZSByZXNwb25zaXZlIGFuZCByZW5kZXIgcGFydGlhbCByZXN1bHRzLCBidXQgYWxzb1xuICAgICAgLy8gbWVhbnMgdGhhdCB0aGV5IG5lZWQgdG8gd2F0Y2ggZm9yIHdyYXBwZWRJdGVtLm9uKCd1cGRhdGUnKSBldmVudHNcbiAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgIH1cblxuICAgIC8vIFNlY29uZCBwYXNzOiBub3cgdGhhdCB3ZSd2ZSBjb21wbGV0ZWQgdGhlIGZ1bGwgaXRlcmF0aW9uIG9mIHRoZSBwYXJlbnRcbiAgICAvLyB0YWJsZSwgd2UgY2FuIGZpbmlzaCBlYWNoIGl0ZW1cbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIHRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgaW5kZXggPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlW2luZGV4XSkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0l0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgICBleGlzdGluZ0l0ZW0uY29ubmVjdEl0ZW0ocGFyZW50VGFibGUudGFibGVJZCwgd3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0odGhpcy50YWJsZUlkLCBleGlzdGluZ0l0ZW0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKGV4aXN0aW5nSXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4IH0pO1xuICAgICAgICBuZXdJdGVtLmNvbm5lY3RJdGVtKHBhcmVudFRhYmxlLnRhYmxlSWQsIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB3cmFwcGVkUGFyZW50LmNvbm5lY3RJdGVtKHRoaXMudGFibGVJZCwgbmV3SXRlbSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0obmV3SXRlbSwgbmV3SXRlbSk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF9nZXRBbGxBdHRyaWJ1dGVzICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fZ2V0QWxsQXR0cmlidXRlcygpO1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIHJlc3VsdFthdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEFnZ3JlZ2F0ZWRUYWJsZTtcbiIsImNvbnN0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmR1cGxpY2F0ZWRBdHRyaWJ1dGVzIHx8IHt9O1xuICAgIH1cbiAgICBfdG9SYXdPYmplY3QgKCkge1xuICAgICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgICBvYmouZHVwbGljYXRlZEF0dHJpYnV0ZXMgPSB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcztcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuICAgIGR1cGxpY2F0ZUF0dHJpYnV0ZSAocGFyZW50SWQsIGF0dHJpYnV0ZSkge1xuICAgICAgdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXNbcGFyZW50SWRdID0gdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXNbcGFyZW50SWRdIHx8IFtdO1xuICAgICAgdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXNbcGFyZW50SWRdLnB1c2goYXR0cmlidXRlKTtcbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICB9XG4gICAgX2R1cGxpY2F0ZUF0dHJpYnV0ZXMgKHdyYXBwZWRJdGVtKSB7XG4gICAgICBmb3IgKGNvbnN0IFtwYXJlbnRJZCwgYXR0cl0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXMpKSB7XG4gICAgICAgIGNvbnN0IHBhcmVudE5hbWUgPSB0aGlzLl9tdXJlLnRhYmxlc1twYXJlbnRJZF0ubmFtZTtcbiAgICAgICAgd3JhcHBlZEl0ZW0ucm93W2Ake3BhcmVudE5hbWV9LiR7YXR0cn1gXSA9IHdyYXBwZWRJdGVtLmNvbm5lY3RlZEl0ZW1zW3BhcmVudElkXVswXS5yb3dbYXR0cl07XG4gICAgICB9XG4gICAgfVxuICAgIF9nZXRBbGxBdHRyaWJ1dGVzICgpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl9nZXRBbGxBdHRyaWJ1dGVzKCk7XG4gICAgICBmb3IgKGNvbnN0IFtwYXJlbnRJZCwgYXR0cl0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXMpKSB7XG4gICAgICAgIGNvbnN0IHBhcmVudE5hbWUgPSB0aGlzLl9tdXJlLnRhYmxlc1twYXJlbnRJZF0ubmFtZTtcbiAgICAgICAgcmVzdWx0W2Ake3BhcmVudE5hbWV9LiR7YXR0cn1gXSA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcbmltcG9ydCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gZnJvbSAnLi9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluKFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuZGVsaW1pdGVyID0gb3B0aW9ucy5kZWxpbWl0ZXIgfHwgJywnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpCc7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCB2YWx1ZXMgPSAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSB8fCAnJykuc3BsaXQodGhpcy5kZWxpbWl0ZXIpO1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICAgICAgY29uc3Qgcm93ID0ge307XG4gICAgICAgIHJvd1t0aGlzLl9hdHRyaWJ1dGVdID0gdmFsdWU7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgICAgbmV3SXRlbS5jb25uZWN0SXRlbShwYXJlbnRUYWJsZS50YWJsZUlkLCB3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbSh0aGlzLnRhYmxlSWQsIG5ld0l0ZW0pO1xuICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKG5ld0l0ZW0pO1xuICAgICAgICB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmFjZXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICB0aGlzLl92YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUgPT09IHVuZGVmaW5lZCB8fCAhdGhpcy5fdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgYW5kIHZhbHVlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGAke3RoaXMucGFyZW50VGFibGUubmFtZX1bJHt0aGlzLl92YWx1ZX1dYDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IGluY2x1ZGVJdGVtID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdylcbiAgICAgICAgfSk7XG4gICAgICAgIG5ld0l0ZW0uY29ubmVjdEl0ZW0ocGFyZW50VGFibGUudGFibGVJZCwgd3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0odGhpcy50YWJsZUlkLCBuZXdJdGVtKTtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgICAgcmV0dXJuIG5ld0l0ZW07XG4gICAgICB9O1xuICAgICAgaWYgKHRoaXMuX2F0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5pbmRleCA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgICB5aWVsZCBpbmNsdWRlSXRlbSgpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgICB5aWVsZCBpbmNsdWRlSXRlbSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGYWNldGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIFNwaW4gdGhyb3VnaCBhbGwgb2YgdGhlIHBhcmVudFRhYmxlcyBzbyB0aGF0IHRoZWlyIF9jYWNoZSBpcyBwcmUtYnVpbHRcbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgYXdhaXQgcGFyZW50VGFibGUuY291bnRSb3dzKCk7XG4gICAgfVxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGUpKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZVtpbmRleF0pKSB7XG4gICAgICAgIC8vIE5vIG1hdGNoIGluIG9uZSBvZiB0aGUgb3RoZXIgdGFibGVzOyBvbWl0IHRoaXMgaXRlbVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIFRPRE86IGFkZCBlYWNoIHBhcmVudCB0YWJsZXMnIGtleXMgYXMgYXR0cmlidXRlIHZhbHVlc1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCB9KTtcbiAgICAgIGZvciAoY29uc3QgdGFibGUgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICAgIG5ld0l0ZW0uY29ubmVjdEl0ZW0odGFibGUudGFibGVJZCwgdGFibGUuX2NhY2hlW2luZGV4XSk7XG4gICAgICAgIHRhYmxlLl9jYWNoZVtpbmRleF0uY29ubmVjdEl0ZW0odGhpcy50YWJsZUlkLCBuZXdJdGVtKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2R1cGxpY2F0ZUF0dHJpYnV0ZXMobmV3SXRlbSk7XG4gICAgICB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pO1xuICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX211cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy5jbGFzc0lkID0gb3B0aW9ucy5jbGFzc0lkO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMuX211cmUgfHwgIXRoaXMuY2xhc3NJZCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYF9tdXJlLCBjbGFzc0lkLCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMuYW5ub3RhdGlvbiA9IG9wdGlvbnMuYW5ub3RhdGlvbiB8fCAnJztcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb246IHRoaXMuYW5ub3RhdGlvblxuICAgIH07XG4gIH1cbiAgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIHRoaXMuX2NsYXNzTmFtZSA9IHZhbHVlO1xuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXRIYXNoVGFibGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiBhdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgfVxuICBnZXQgdGFibGUgKCkge1xuICAgIHJldHVybiB0aGlzLl9tdXJlLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyB0aGlzLl9tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIF9kZXJpdmVHZW5lcmljQ2xhc3MgKG5ld1RhYmxlKSB7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnXG4gICAgfSk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgICB0aGlzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRocyA9IHt9O1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgcHJlcFNob3J0ZXN0RWRnZVBhdGggKGVkZ2VDbGFzc0lkKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW2VkZ2VDbGFzc0lkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbZWRnZUNsYXNzSWRdO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBlZGdlVGFibGUgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRdLnRhYmxlO1xuICAgICAgY29uc3QgaWRMaXN0ID0gW107XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRoaXMudGFibGUuc2hvcnRlc3RQYXRoVG9UYWJsZShlZGdlVGFibGUpKSB7XG4gICAgICAgIGlkTGlzdC5wdXNoKHRhYmxlLnRhYmxlSWQpO1xuICAgICAgICAvLyBTcGluIHRocm91Z2ggdGhlIHRhYmxlIHRvIG1ha2Ugc3VyZSBhbGwgaXRzIHJvd3MgYXJlIHdyYXBwZWQgYW5kIGNvbm5lY3RlZFxuICAgICAgICBhd2FpdCB0YWJsZS5jb3VudFJvd3MoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW2VkZ2VDbGFzc0lkXSA9IGlkTGlzdDtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIC8vIChvciBhIGZsb2F0aW5nIGVkZ2UgaWYgZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgaXMgbnVsbClcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBlZGdlQ2xhc3MuZGlyZWN0ZWQ7XG4gICAgICBlZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgICBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgLy8gRGVsZXRlIGVhY2ggb2YgdGhlIGVkZ2UgY2xhc3Nlc1xuICAgICAgc291cmNlRWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgICAgdGFyZ2V0RWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgIH1cbiAgICB0aGlzLmRlbGV0ZSgpO1xuICAgIGRlbGV0ZSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzSWRzO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgZGlyZWN0ZWQsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGNvbnN0IHRoaXNIYXNoID0gdGhpcy5nZXRIYXNoVGFibGUoYXR0cmlidXRlKTtcbiAgICBjb25zdCBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy5nZXRIYXNoVGFibGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBkaXJlY3RlZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWRcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBfcGlja0VkZ2VUYWJsZSAob3RoZXJDbGFzcykge1xuICAgIGxldCBlZGdlVGFibGU7XG4gICAgbGV0IGNoYWluID0gdGhpcy50YWJsZS5zaG9ydGVzdFBhdGhUb1RhYmxlKG90aGVyQ2xhc3MudGFibGUpO1xuICAgIGlmIChjaGFpbiA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmRlcmx5aW5nIHRhYmxlIGNoYWluIGJldHdlZW4gZWRnZSBhbmQgbm9kZSBjbGFzc2VzIGlzIGJyb2tlbmApO1xuICAgIH0gZWxzZSBpZiAoY2hhaW4ubGVuZ3RoIDw9IDIpIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICBlZGdlVGFibGUgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGU7IHByaW9yaXRpemUgU3RhdGljVGFibGUgYW5kIFN0YXRpY0RpY3RUYWJsZVxuICAgICAgbGV0IHN0YXRpY0V4aXN0cyA9IGZhbHNlO1xuICAgICAgY2hhaW4gPSBjaGFpbi5zbGljZSgxLCBjaGFpbi5sZW5ndGggLSAxKS5tYXAoKHRhYmxlLCBkaXN0KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0YWJsZS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZSwgZGlzdCB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIGNoYWluID0gY2hhaW4uZmlsdGVyKCh7IHRhYmxlIH0pID0+IHtcbiAgICAgICAgICByZXR1cm4gdGFibGUudHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlZGdlVGFibGUgPSBjaGFpblswXS50YWJsZTtcbiAgICB9XG4gICAgcmV0dXJuIGVkZ2VUYWJsZTtcbiAgfVxuICBhc3luYyBwcmVwU2hvcnRlc3RTb3VyY2VQYXRoICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVkU2hvcnRlc3RTb3VyY2VQYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGg7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9zb3VyY2VDbGFzc0lkID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgc291cmNlVGFibGUgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS50YWJsZTtcbiAgICAgIGNvbnN0IGlkTGlzdCA9IFtdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZSBvZiB0aGlzLnRhYmxlLnNob3J0ZXN0UGF0aFRvVGFibGUoc291cmNlVGFibGUpKSB7XG4gICAgICAgIGlkTGlzdC5wdXNoKHRhYmxlLnRhYmxlSWQpO1xuICAgICAgICAvLyBTcGluIHRocm91Z2ggdGhlIHRhYmxlIHRvIG1ha2Ugc3VyZSBhbGwgaXRzIHJvd3MgYXJlIHdyYXBwZWQgYW5kIGNvbm5lY3RlZFxuICAgICAgICBhd2FpdCB0YWJsZS5jb3VudFJvd3MoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aCA9IGlkTGlzdDtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGg7XG4gICAgfVxuICB9XG4gIGFzeW5jIHByZXBTaG9ydGVzdFRhcmdldFBhdGggKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aDtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3RhcmdldENsYXNzSWQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0YXJnZXRUYWJsZSA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLnRhYmxlO1xuICAgICAgY29uc3QgaWRMaXN0ID0gW107XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRoaXMudGFibGUuc2hvcnRlc3RQYXRoVG9UYWJsZSh0YXJnZXRUYWJsZSkpIHtcbiAgICAgICAgaWRMaXN0LnB1c2godGFibGUudGFibGVJZCk7XG4gICAgICAgIC8vIFNwaW4gdGhyb3VnaCB0aGUgdGFibGUgdG8gbWFrZSBzdXJlIGFsbCBpdHMgcm93cyBhcmUgd3JhcHBlZCBhbmQgY29ubmVjdGVkXG4gICAgICAgIGF3YWl0IHRhYmxlLmNvdW50Um93cygpO1xuICAgICAgfVxuICAgICAgdGhpcy5fY2FjaGVkU2hvcnRlc3RUYXJnZXRQYXRoID0gaWRMaXN0O1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aDtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICB0ZW1wLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICBkZWxldGUgdGVtcC5jbGFzc0lkO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMuX211cmUuY3JlYXRlQ2xhc3ModGVtcCk7XG5cbiAgICBpZiAodGVtcC5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgY29uc3QgZWRnZVRhYmxlID0gdGhpcy5fcGlja0VkZ2VUYWJsZShzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZS50YWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IGVkZ2VUYWJsZSA9IHRoaXMuX3BpY2tFZGdlVGFibGUodGFyZ2V0Q2xhc3MpO1xuICAgICAgY29uc3QgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGUudGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiB0ZW1wLnRhcmdldENsYXNzSWRcbiAgICAgIH0pO1xuICAgICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuXG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgZGlyZWN0aW9uLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pIHtcbiAgICBpZiAoZGlyZWN0aW9uKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGRpcmVjdGlvbiAhPT0gJ3NvdXJjZScgJiYgZGlyZWN0aW9uICE9PSAndGFyZ2V0Jykge1xuICAgICAgZGlyZWN0aW9uID0gdGhpcy50YXJnZXRDbGFzc0lkID09PSBudWxsID8gJ3RhcmdldCcgOiAnc291cmNlJztcbiAgICB9XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldCh7IG5vZGVDbGFzcywgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jb25uZWN0U291cmNlKHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgdG9nZ2xlTm9kZURpcmVjdGlvbiAoc291cmNlQ2xhc3NJZCkge1xuICAgIGlmICghc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3Qgc3dhcCB0byB1bmNvbm5lY3RlZCBjbGFzcyBpZDogJHtzb3VyY2VDbGFzc0lkfWApO1xuICAgICAgICB9XG4gICAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IHRlbXA7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBjb25uZWN0U291cmNlICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNraXBTYXZlID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMuZ2V0SGFzaFRhYmxlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MuZ2V0SGFzaFRhYmxlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSk7XG5cbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc2tpcFNhdmUgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy5nZXRIYXNoVGFibGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gdGFyZ2V0Q2xhc3MudGFibGUgOiB0YXJnZXRDbGFzcy5nZXRIYXNoVGFibGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKTtcblxuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGlzY29ubmVjdFNvdXJjZSAoeyBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdTb3VyY2VDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgICBkZWxldGUgZXhpc3RpbmdTb3VyY2VDbGFzcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aDtcbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKHsgc2tpcFNhdmUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBjb25zdCBleGlzdGluZ1RhcmdldENsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nVGFyZ2V0Q2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1RhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGg7XG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIHRoaXMudGFibGUgPSBvcHRpb25zLnRhYmxlO1xuICAgIGlmICh0aGlzLmluZGV4ID09PSB1bmRlZmluZWQgfHwgIXRoaXMudGFibGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggYW5kIHRhYmxlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLmNsYXNzT2JqID0gb3B0aW9ucy5jbGFzc09iaiB8fCBudWxsO1xuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IG9wdGlvbnMuY29ubmVjdGVkSXRlbXMgfHwge307XG4gIH1cbiAgY29ubmVjdEl0ZW0gKHRhYmxlSWQsIGl0ZW0pIHtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW3RhYmxlSWRdID0gdGhpcy5jb25uZWN0ZWRJdGVtc1t0YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1t0YWJsZUlkXS5pbmRleE9mKGl0ZW0pID09PSAtMSkge1xuICAgICAgdGhpcy5jb25uZWN0ZWRJdGVtc1t0YWJsZUlkXS5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgfVxuICAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW3RhYmxlSWRzWzBdXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRoaXNUYWJsZUlkID0gdGFibGVJZHNbMF07XG4gICAgICBjb25zdCByZW1haW5pbmdUYWJsZUlkcyA9IHRhYmxlSWRzLnNsaWNlKDEpO1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuY29ubmVjdGVkSXRlbXNbdGhpc1RhYmxlSWRdIHx8IFtdKSB7XG4gICAgICAgIHlpZWxkICogaXRlbS5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzICh7IGxpbWl0ID0gSW5maW5pdHkgfSA9IHt9KSB7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICBjb25zdCB0YWJsZUlkQ2hhaW4gPSBhd2FpdCB0aGlzLmNsYXNzT2JqLnByZXBTaG9ydGVzdEVkZ2VQYXRoKGVkZ2VDbGFzc0lkKTtcbiAgICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZENoYWluKTtcbiAgICAgIGxldCB0ZW1wID0gaXRlcmF0b3IubmV4dCgpO1xuICAgICAgd2hpbGUgKCF0ZW1wLmRvbmUgJiYgaSA8IGxpbWl0KSB7XG4gICAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgICAgIGkrKztcbiAgICAgICAgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIH1cbiAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzICh7IGxpbWl0ID0gSW5maW5pdHkgfSA9IHt9KSB7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhcbiAgICAgIGF3YWl0IHRoaXMuY2xhc3NPYmoucHJlcFNob3J0ZXN0U291cmNlUGF0aCgpKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqIHRhcmdldE5vZGVzICh7IGxpbWl0ID0gSW5maW5pdHkgfSA9IHt9KSB7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhcbiAgICAgIGF3YWl0IHRoaXMuY2xhc3NPYmoucHJlcFNob3J0ZXN0VGFyZ2V0UGF0aCgpKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICBpZiAodGhpcy5lbnRyaWVzW2hhc2hdLmluZGV4T2YodmFsdWUpID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcbmxldCBORVhUX1RBQkxFX0lEID0gMTtcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRBQkxFUyA9IFRBQkxFUztcbiAgICB0aGlzLkNMQVNTRVMgPSBDTEFTU0VTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcbiAgICB0aGlzLklOREVYRVMgPSBJTkRFWEVTO1xuXG4gICAgLy8gRGVmYXVsdCBuYW1lZCBmdW5jdGlvbnNcbiAgICB0aGlzLk5BTUVEX0ZVTkNUSU9OUyA9IHtcbiAgICAgIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkgeyB5aWVsZCB3cmFwcGVkSXRlbS5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAoIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgICF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBHcmFuZHBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgaWYgKCEocGFyZW50VHlwZSA9PT0gJ251bWJlcicgfHwgcGFyZW50VHlwZSA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyZW50IGlzbid0IGEga2V5IC8gaW5kZXhgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0RmluaXNoOiBmdW5jdGlvbiAqICh0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgeWllbGQge1xuICAgICAgICAgIGxlZnQ6IHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLFxuICAgICAgICAgIHJpZ2h0OiBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW1cbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy50YWJsZXMgPSB0aGlzLmh5ZHJhdGUoJ211cmVfdGFibGVzJywgdGhpcy5UQUJMRVMpO1xuICAgIE5FWFRfVEFCTEVfSUQgPSBPYmplY3Qua2V5cyh0aGlzLnRhYmxlcylcbiAgICAgIC5yZWR1Y2UoKGhpZ2hlc3ROdW0sIHRhYmxlSWQpID0+IHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KGhpZ2hlc3ROdW0sIHBhcnNlSW50KHRhYmxlSWQubWF0Y2goL3RhYmxlKFxcZCopLylbMV0pKTtcbiAgICAgIH0sIDApICsgMTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMuaHlkcmF0ZSgnbXVyZV9jbGFzc2VzJywgdGhpcy5DTEFTU0VTKTtcbiAgICBORVhUX0NMQVNTX0lEID0gT2JqZWN0LmtleXModGhpcy5jbGFzc2VzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgY2xhc3NJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQoY2xhc3NJZC5tYXRjaCgvY2xhc3MoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuICB9XG5cbiAgc2F2ZVRhYmxlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ211cmVfdGFibGVzJywgdGhpcy50YWJsZXMpO1xuICAgIHRoaXMudHJpZ2dlcigndGFibGVVcGRhdGUnKTtcbiAgfVxuICBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ211cmVfY2xhc3NlcycsIHRoaXMuY2xhc3Nlcyk7XG4gICAgdGhpcy50cmlnZ2VyKCdjbGFzc1VwZGF0ZScpO1xuICB9XG5cbiAgaHlkcmF0ZSAoc3RvcmFnZUtleSwgVFlQRVMpIHtcbiAgICBsZXQgY29udGFpbmVyID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShzdG9yYWdlS2V5KTtcbiAgICBjb250YWluZXIgPSBjb250YWluZXIgPyBKU09OLnBhcnNlKGNvbnRhaW5lcikgOiB7fTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb250YWluZXIpKSB7XG4gICAgICBjb25zdCB0eXBlID0gdmFsdWUudHlwZTtcbiAgICAgIGRlbGV0ZSB2YWx1ZS50eXBlO1xuICAgICAgdmFsdWUubXVyZSA9IHRoaXM7XG4gICAgICBjb250YWluZXJba2V5XSA9IG5ldyBUWVBFU1t0eXBlXSh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cbiAgZGVoeWRyYXRlIChzdG9yYWdlS2V5LCBjb250YWluZXIpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlLl90b1Jhd09iamVjdCgpO1xuICAgICAgICByZXN1bHRba2V5XS50eXBlID0gdmFsdWUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oc3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gICAgfVxuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG5cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMudGFibGVJZCkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHtORVhUX1RBQkxFX0lEfWA7XG4gICAgICBORVhUX1RBQkxFX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLlRBQkxFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFR5cGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICBpZiAoIW9wdGlvbnMuY2xhc3NJZCkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLkNMQVNTRVNbb3B0aW9ucy50eXBlXTtcbiAgICBkZWxldGUgb3B0aW9ucy50eXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cblxuICBuZXdUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlT2JqID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGVPYmo7XG4gIH1cbiAgbmV3Q2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdDbGFzc09iaiA9IHRoaXMuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gICAgdGhpcy5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdDbGFzc09iajtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY1RhYmxlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNUYWJsZSgpIGluc3RlYWQuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljVGFibGUoe1xuICAgICAgbmFtZTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljVGFibGUgKHsgbmFtZSwgZXh0ZW5zaW9uID0gJ3R4dCcsIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBkYXRhID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBhdHRyaWJ1dGVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBkYXRhLmNvbHVtbnMpIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgZGF0YS5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY1RhYmxlKHsgbmFtZSwgZGF0YSwgYXR0cmlidXRlcyB9KTtcbiAgfVxuICBhZGRTdGF0aWNUYWJsZSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudHlwZSA9IG9wdGlvbnMuZGF0YSBpbnN0YW5jZW9mIEFycmF5ID8gJ1N0YXRpY1RhYmxlJyA6ICdTdGF0aWNEaWN0VGFibGUnO1xuICAgIGxldCBuZXdUYWJsZSA9IHRoaXMubmV3VGFibGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlQWxsVW51c2VkVGFibGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IHRhYmxlSWQgaW4gdGhpcy50YWJsZXMpIHtcbiAgICAgIGlmICh0aGlzLnRhYmxlc1t0YWJsZUlkXSkge1xuICAgICAgICB0cnkgeyB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTsgfSBjYXRjaCAoZXJyKSB7fVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBkZWxldGVBbGxDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgY2xhc3NPYmouZGVsZXRlKCk7XG4gICAgfVxuICB9XG4gIGdldENsYXNzRGF0YSAoKSB7XG4gICAgY29uc3QgcmVzdWx0cyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICByZXN1bHRzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouY3VycmVudERhdGE7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IEZpbGVSZWFkZXIgZnJvbSAnZmlsZXJlYWRlcic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUoRmlsZVJlYWRlciwgbnVsbCk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJvZmYiLCJpbmRleCIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiZm9yRWFjaCIsInNldFRpbWVvdXQiLCJhcHBseSIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsIk9iamVjdCIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiVGFibGUiLCJvcHRpb25zIiwiX211cmUiLCJtdXJlIiwidGFibGVJZCIsIkVycm9yIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsInVzZWRCeUNsYXNzZXMiLCJfdXNlZEJ5Q2xhc3NlcyIsImZ1bmMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsIm5hbWUiLCJpdGVyYXRlIiwicmVzZXQiLCJfY2FjaGUiLCJmaW5pc2hlZEl0ZW0iLCJ2YWx1ZXMiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJkZXJpdmVkVGFibGUiLCJjb3VudFJvd3MiLCJrZXlzIiwibGVuZ3RoIiwiY291bnQiLCJpdGVyYXRvciIsIm5leHQiLCJkb25lIiwibGltaXQiLCJ1bmRlZmluZWQiLCJJbmZpbml0eSIsIl9pdGVyYXRlIiwiY29tcGxldGVkIiwiX2ZpbmlzaEl0ZW0iLCJ3cmFwcGVkSXRlbSIsInJvdyIsIl93cmFwIiwidGFibGUiLCJjbGFzc09iaiIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJfZ2V0QWxsQXR0cmlidXRlcyIsImFsbEF0dHJzIiwiY3VycmVudERhdGEiLCJkYXRhIiwiY29tcGxldGUiLCJkZXJpdmVBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwic2F2ZVRhYmxlcyIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZUlkIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJ0YWJsZXMiLCJzaG9ydGVzdFBhdGhUb1RhYmxlIiwib3RoZXJUYWJsZSIsInZpc2l0ZWQiLCJkaXN0YW5jZXMiLCJwcmV2VGFibGVzIiwidmlzaXQiLCJ0YXJnZXRJZCIsInRhcmdldFRhYmxlIiwibmVpZ2hib3JMaXN0IiwiY29uY2F0IiwicGFyZW50VGFibGVzIiwibWFwIiwicGFyZW50VGFibGUiLCJmaWx0ZXIiLCJuZWlnaGJvcklkIiwidG9WaXNpdCIsInNvcnQiLCJhIiwiYiIsIm5leHRJZCIsInNoaWZ0IiwiY2hhaW4iLCJ1bnNoaWZ0IiwiYWdncmVnYXRlIiwiZXhwYW5kIiwiZGVsaW1pdGVyIiwiY2xvc2VkRmFjZXQiLCJvcGVuRmFjZXQiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJjbGFzc2VzIiwicmVkdWNlIiwiYWdnIiwiZGVsZXRlIiwiZXhlYyIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIml0ZW0iLCJTdGF0aWNEaWN0VGFibGUiLCJTaW5nbGVQYXJlbnRNaXhpbiIsIl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4iLCJBZ2dyZWdhdGVkVGFibGUiLCJfYXR0cmlidXRlIiwiX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsInJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsIl9kZWh5ZHJhdGVGdW5jdGlvbiIsImRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUiLCJfdXBkYXRlSXRlbSIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJuZXdXcmFwcGVkSXRlbSIsIndyYXBwZWRQYXJlbnQiLCJleGlzdGluZ0l0ZW0iLCJjb25uZWN0SXRlbSIsIm5ld0l0ZW0iLCJEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfaW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9kdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlQXR0cmlidXRlIiwicGFyZW50SWQiLCJfZHVwbGljYXRlQXR0cmlidXRlcyIsInBhcmVudE5hbWUiLCJjb25uZWN0ZWRJdGVtcyIsIkV4cGFuZGVkVGFibGUiLCJzcGxpdCIsIkZhY2V0ZWRUYWJsZSIsIl92YWx1ZSIsImluY2x1ZGVJdGVtIiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJzbGljZSIsIkdlbmVyaWNDbGFzcyIsImNsYXNzSWQiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbiIsInNldENsYXNzTmFtZSIsInNhdmVDbGFzc2VzIiwiaGFzQ3VzdG9tTmFtZSIsImdldEhhc2hUYWJsZSIsImludGVycHJldEFzTm9kZXMiLCJuZXdDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJfZGVyaXZlR2VuZXJpY0NsYXNzIiwiTm9kZUNsYXNzIiwiZWRnZUNsYXNzSWRzIiwiX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzIiwiTm9kZVdyYXBwZXIiLCJwcmVwU2hvcnRlc3RFZGdlUGF0aCIsImVkZ2VDbGFzc0lkIiwiZWRnZVRhYmxlIiwiaWRMaXN0IiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiZWRnZUNsYXNzIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsInRhcmdldEVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY3JlYXRlQ2xhc3MiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJub2RlQ2xhc3MiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIkVkZ2VDbGFzcyIsIkVkZ2VXcmFwcGVyIiwiX3BpY2tFZGdlVGFibGUiLCJvdGhlckNsYXNzIiwic3RhdGljRXhpc3RzIiwiZGlzdCIsInN0YXJ0c1dpdGgiLCJwcmVwU2hvcnRlc3RTb3VyY2VQYXRoIiwiX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aCIsIl9zb3VyY2VDbGFzc0lkIiwic291cmNlVGFibGUiLCJwcmVwU2hvcnRlc3RUYXJnZXRQYXRoIiwiX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aCIsIl90YXJnZXRDbGFzc0lkIiwibmV3Tm9kZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsImRpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiY29ubmVjdFRhcmdldCIsImNvbm5lY3RTb3VyY2UiLCJ0b2dnbGVOb2RlRGlyZWN0aW9uIiwic2tpcFNhdmUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsInRoaXNUYWJsZUlkIiwicmVtYWluaW5nVGFibGVJZHMiLCJlZGdlcyIsInRhYmxlSWRDaGFpbiIsInNvdXJjZU5vZGVzIiwidGFyZ2V0Tm9kZXMiLCJJbk1lbW9yeUluZGV4IiwidG9SYXdPYmplY3QiLCJpdGVyRW50cmllcyIsImhhc2giLCJ2YWx1ZUxpc3QiLCJpdGVySGFzaGVzIiwiaXRlclZhbHVlTGlzdHMiLCJnZXRWYWx1ZUxpc3QiLCJhZGRWYWx1ZSIsIk5FWFRfQ0xBU1NfSUQiLCJORVhUX1RBQkxFX0lEIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiZGVidWciLCJEQVRBTElCX0ZPUk1BVFMiLCJUQUJMRVMiLCJDTEFTU0VTIiwiSU5ERVhFUyIsIk5BTUVEX0ZVTkNUSU9OUyIsImlkZW50aXR5IiwicmF3SXRlbSIsImtleSIsIlR5cGVFcnJvciIsInBhcmVudFR5cGUiLCJkZWZhdWx0RmluaXNoIiwidGhpc1dyYXBwZWRJdGVtIiwib3RoZXJXcmFwcGVkSXRlbSIsImxlZnQiLCJyaWdodCIsInNoYTEiLCJKU09OIiwic3RyaW5naWZ5Iiwibm9vcCIsImh5ZHJhdGUiLCJoaWdoZXN0TnVtIiwiTWF0aCIsIm1heCIsInBhcnNlSW50IiwibWF0Y2giLCJkZWh5ZHJhdGUiLCJzdG9yYWdlS2V5IiwiVFlQRVMiLCJjb250YWluZXIiLCJnZXRJdGVtIiwicGFyc2UiLCJzZXRJdGVtIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIlR5cGUiLCJzZWxlY3RvciIsIm5ld1RhYmxlT2JqIiwibmV3Q2xhc3NPYmoiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwiY29uc29sZSIsIndhcm4iLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJlcnIiLCJkZWxldGVBbGxDbGFzc2VzIiwiZ2V0Q2xhc3NEYXRhIiwicmVzdWx0cyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QkMsdUJBQXZCLEVBQWdEO1VBQzVDLENBQUMsS0FBS0wsYUFBTCxDQUFtQkcsU0FBbkIsQ0FBTCxFQUFvQzthQUM3QkgsYUFBTCxDQUFtQkcsU0FBbkIsSUFBZ0MsRUFBaEM7OztVQUVFLENBQUNFLHVCQUFMLEVBQThCO1lBQ3hCLEtBQUtMLGFBQUwsQ0FBbUJHLFNBQW5CLEVBQThCRyxPQUE5QixDQUFzQ0YsUUFBdEMsTUFBb0QsQ0FBQyxDQUF6RCxFQUE0RDs7Ozs7V0FJekRKLGFBQUwsQ0FBbUJHLFNBQW5CLEVBQThCSSxJQUE5QixDQUFtQ0gsUUFBbkM7OztJQUVGSSxHQUFHLENBQUVMLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNwQixLQUFLSixhQUFMLENBQW1CRyxTQUFuQixDQUFKLEVBQW1DO1lBQzdCLENBQUNDLFFBQUwsRUFBZTtpQkFDTixLQUFLSixhQUFMLENBQW1CRyxTQUFuQixDQUFQO1NBREYsTUFFTztjQUNETSxLQUFLLEdBQUcsS0FBS1QsYUFBTCxDQUFtQkcsU0FBbkIsRUFBOEJHLE9BQTlCLENBQXNDRixRQUF0QyxDQUFa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
