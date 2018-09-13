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

    for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions || {})) {
      this._derivedAttributeFunctions[attr] = this._mure.hydrateFunction(stringifiedFunc);
    }

    this._suppressedAttributes = options.suppressedAttributes || {};
    this._suppressIndex = !!options.suppressIndex;
    this._indexSubFilter = options.indexSubFilter && this._mure.hydrateFunction(options.indexSubFilter) || null;
    this._attributeSubFilters = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.attributeSubFilters || {})) {
      this._attributeSubFilters[attr] = this._mure.hydrateFunction(stringifiedFunc);
    }
  }

  _toRawObject() {
    const result = {
      tableId: this.tableId,
      attributes: this._attributes,
      derivedTables: this._derivedTables,
      usedByClasses: this._usedByClasses,
      derivedAttributeFunctions: {},
      suppressedAttributes: this._suppressedAttributes,
      suppressIndex: this._suppressIndex,
      attributeSubFilters: {},
      indexSubFilter: this._indexSubFilter && this._mure.dehydrateFunction(this._indexSubFilter) || null
    };

    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this._mure.dehydrateFunction(func);
    }

    for (const [attr, func] of Object.entries(this._attributeSubFilters)) {
      result.attributeSubFilters[attr] = this._mure.dehydrateFunction(func);
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
      const limit = options.limit === undefined ? Infinity : options.limit;
      yield* Object.values(this._cache).slice(0, limit);
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

    for (const attr in wrappedItem.row) {
      this._observedAttributes[attr] = true;
    }

    for (const attr in this._suppressedAttributes) {
      delete wrappedItem.row[attr];
    }

    let keep = true;

    if (this._indexSubFilter) {
      keep = this._indexSubFilter(wrappedItem.index);
    }

    for (const [attr, func] of Object.entries(this._attributeSubFilters)) {
      keep = keep && func(wrappedItem.row[attr]);

      if (!keep) {
        break;
      }
    }

    if (keep) {
      wrappedItem.trigger('finish');
    } else {
      wrappedItem.disconnect();
      wrappedItem.trigger('filter');
    }

    return keep;
  }

  _wrap(options) {
    options.table = this;
    const classObj = this.classObj;
    const wrappedItem = classObj ? classObj._wrap(options) : new this._mure.WRAPPERS.GenericWrapper(options);

    for (const otherItem of options.itemsToConnect || []) {
      wrappedItem.connectItem(otherItem);
      otherItem.connectItem(wrappedItem);
    }

    return wrappedItem;
  }

  getIndexDetails() {
    const details = {
      name: null
    };

    if (this._suppressIndex) {
      details.suppressed = true;
    }

    if (this._indexSubFilter) {
      details.filtered = true;
    }

    return details;
  }

  getAttributeDetails() {
    const allAttrs = {};

    for (const attr in this._expectedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].expected = true;
    }

    for (const attr in this._observedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].observed = true;
    }

    for (const attr in this._derivedAttributeFunctions) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].derived = true;
    }

    for (const attr in this._suppressedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].suppressed = true;
    }

    for (const attr in this._attributeSubFilters) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].filtered = true;
    }

    return allAttrs;
  }

  get attributes() {
    return Object.keys(this.getAttributeDetails());
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

  suppressAttribute(attribute) {
    if (attribute === null) {
      this._suppressIndex = true;
    } else {
      this._suppressedAttributes[attribute] = true;
    }

    this.reset();
  }

  addSubFilter(attribute, func) {
    if (attribute === null) {
      this._indexSubFilter = func;
    } else {
      this._attributeSubFilters[attribute] = func;
    }

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
      const value = attribute === null ? wrappedItem.index : wrappedItem.row[attribute];

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

      if (this._finishItem(item)) {
        yield item;
      }
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

      if (this._finishItem(item)) {
        yield item;
      }
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

    for (const [attr, stringifiedFunc] of Object.entries(options.reduceAttributeFunctions || {})) {
      this._reduceAttributeFunctions[attr] = this._mure.hydrateFunction(stringifiedFunc);
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

      if (!this._finishItem(wrappedItem)) {
        delete this._partialCache[index];
      }
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
        existingItem.connectItem(wrappedParent);
        wrappedParent.connectItem(existingItem);

        this._updateItem(existingItem, wrappedParent);
      } else {
        const newItem = this._wrap({
          index,
          itemsToConnect: [wrappedParent]
        });

        this._updateItem(newItem, newItem);

        yield newItem;
      }
    }
  }

  getAttributeDetails() {
    const allAttrs = super.getAttributeDetails();

    for (const attr in this._reduceAttributeFunctions) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].reduced = true;
    }

    return allAttrs;
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

    getAttributeDetails() {
      const allAttrs = super.getAttributeDetails();

      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const attrName = `${this._mure.tables[parentId].name}.${attr}`;
        allAttrs[attrName] = allAttrs[attrName] || {
          name: attrName
        };
        allAttrs[attrName].copied = true;
      }

      return allAttrs;
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
          row,
          itemsToConnect: [wrappedParent]
        });

        this._duplicateAttributes(newItem);

        if (this._finishItem(newItem)) {
          yield newItem;
        }

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
    return `[${this._value}]`;
  }

  async *_iterate(options) {
    let index = 0;
    const parentTable = this.parentTable;

    for await (const wrappedParent of parentTable.iterate(options)) {
      if (this.attribute === null && wrappedParent.index === this._value) {
        // Faceting by index transforms a row into a table
        for (const [childIndex, childRow] of Object.entries(wrappedParent.row)) {
          const newItem = this._wrap({
            index: childIndex,
            row: childRow,
            itemsToConnect: [wrappedParent]
          });

          if (this._finishItem(newItem)) {
            yield newItem;
          }
        }

        return;
      } else if (this._attribute !== null && wrappedParent.row[this._attribute] === this._value) {
        // Normal faceting just gives a subset of the original table
        const newItem = this._wrap({
          index,
          row: Object.assign({}, wrappedParent.row),
          itemsToConnect: [wrappedParent]
        });

        if (this._finishItem(newItem)) {
          yield newItem;
        }

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
        index,
        itemsToConnect: parentTables.map(table => table._cache[index])
      });

      this._duplicateAttributes(newItem);

      if (this._finishItem(newItem)) {
        yield newItem;
      }
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
    this.table.reset();
    return this._mure.newClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    this.table.reset();
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
    this.table.reset();
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
    } else if (this.sourceClassId === null) {
      return [];
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
    } else if (this.targetClassId === null) {
      return [];
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

    this.table.reset();

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

  connectItem(item) {
    this.connectedItems[item.table.tableId] = this.connectedItems[item.table.tableId] || [];

    if (this.connectedItems[item.table.tableId].indexOf(item) === -1) {
      this.connectedItems[item.table.tableId].push(item);
    }
  }

  disconnect() {
    for (const itemList of Object.values(this.connectedItems)) {
      for (const item of itemList) {
        const index = (item.connectedItems[this.table.tableId] || []).indexOf(this);

        if (index !== -1) {
          item.connectedItems[this.table.tableId].splice(index, 1);
        }
      }
    }

    this.connectedItems = {};
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
    limit = Infinity,
    edgeIds = this.classObj.edgeClassIds
  } = {}) {
    let i = 0;

    for (const edgeClassId of Object.keys(edgeIds)) {
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
    const tableIdChain = await this.classObj.prepShortestSourcePath();
    const iterator = this.iterateAcrossConnections(tableIdChain);
    let temp = iterator.next();
    let i = 0;

    while (!temp.done && i < limit) {
      yield temp.value;
      i++;
      temp = iterator.next();
    }
  }

  async *targetNodes({
    limit = Infinity
  } = {}) {
    const tableIdChain = await this.classObj.prepShortestTargetPath();
    const iterator = this.iterateAcrossConnections(tableIdChain);
    let temp = iterator.next();
    let i = 0;

    while (!temp.done && i < limit) {
      yield temp.value;
      i++;
      temp = iterator.next();
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
var version = "0.5.8";
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
	"@babel/core": "^7.0.1",
	"@babel/preset-env": "^7.0.0",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.6.0",
	coveralls: "^3.0.2",
	filereader: "^0.10.3",
	jest: "^23.6.0",
	rollup: "^0.65.2",
	"rollup-plugin-babel": "^4.0.3",
	"rollup-plugin-commonjs": "^9.1.6",
	"rollup-plugin-json": "^3.0.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.4.0",
	"rollup-plugin-node-resolve": "^3.4.0",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TaW5nbGVQYXJlbnRNaXhpbi5qcyIsIi4uL3NyYy9UYWJsZXMvQWdncmVnYXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0V4cGFuZGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0ZhY2V0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcblxuY2xhc3MgVGFibGUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMuX211cmUgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtdXJlIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhTdWJGaWx0ZXIgPSAob3B0aW9ucy5pbmRleFN1YkZpbHRlciAmJiB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4U3ViRmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZVN1YkZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzW2F0dHJdID0gdGhpcy5fbXVyZS5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIHVzZWRCeUNsYXNzZXM6IHRoaXMuX3VzZWRCeUNsYXNzZXMsXG4gICAgICBkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zOiB7fSxcbiAgICAgIHN1cHByZXNzZWRBdHRyaWJ1dGVzOiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyxcbiAgICAgIHN1cHByZXNzSW5kZXg6IHRoaXMuX3N1cHByZXNzSW5kZXgsXG4gICAgICBhdHRyaWJ1dGVTdWJGaWx0ZXJzOiB7fSxcbiAgICAgIGluZGV4U3ViRmlsdGVyOiAodGhpcy5faW5kZXhTdWJGaWx0ZXIgJiYgdGhpcy5fbXVyZS5kZWh5ZHJhdGVGdW5jdGlvbih0aGlzLl9pbmRleFN1YkZpbHRlcikpIHx8IG51bGxcbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnMpKSB7XG4gICAgICByZXN1bHQuYXR0cmlidXRlU3ViRmlsdGVyc1thdHRyXSA9IHRoaXMuX211cmUuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gR2VuZXJpYyBjYWNoaW5nIHN0dWZmOyB0aGlzIGlzbid0IGp1c3QgZm9yIHBlcmZvcm1hbmNlLiBDb25uZWN0ZWRUYWJsZSdzXG4gICAgLy8gYWxnb3JpdGhtIHJlcXVpcmVzIHRoYXQgaXRzIHBhcmVudCB0YWJsZXMgaGF2ZSBwcmUtYnVpbHQgaW5kZXhlcyAod2VcbiAgICAvLyB0ZWNobmljYWxseSBjb3VsZCBpbXBsZW1lbnQgaXQgZGlmZmVyZW50bHksIGJ1dCBpdCB3b3VsZCBiZSBleHBlbnNpdmUsXG4gICAgLy8gcmVxdWlyZXMgdHJpY2t5IGxvZ2ljLCBhbmQgd2UncmUgYWxyZWFkeSBidWlsZGluZyBpbmRleGVzIGZvciBzb21lIHRhYmxlc1xuICAgIC8vIGxpa2UgQWdncmVnYXRlZFRhYmxlIGFueXdheSlcbiAgICBpZiAob3B0aW9ucy5yZXNldCkge1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgICB5aWVsZCAqIE9iamVjdC52YWx1ZXModGhpcy5fY2FjaGUpLnNsaWNlKDAsIGxpbWl0KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB5aWVsZCAqIGF3YWl0IHRoaXMuX2J1aWxkQ2FjaGUob3B0aW9ucyk7XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGZvciAoY29uc3QgZGVyaXZlZFRhYmxlIG9mIHRoaXMuZGVyaXZlZFRhYmxlcykge1xuICAgICAgZGVyaXZlZFRhYmxlLnJlc2V0KCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncmVzZXQnKTtcbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2NhY2hlKS5sZW5ndGg7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBjb3VudCA9IDA7XG4gICAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2J1aWxkQ2FjaGUoKTtcbiAgICAgIGxldCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgd2hpbGUgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgY291bnQrKztcbiAgICAgICAgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb3VudDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZShvcHRpb25zKTtcbiAgICBsZXQgY29tcGxldGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gaXRlcmF0aW9uIHdhcyBjYW5jZWxsZWQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGNvbXBsZXRlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKTtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3RlbXAudmFsdWUuaW5kZXhdID0gdGVtcC52YWx1ZTtcbiAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbXBsZXRlZCkge1xuICAgICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHdyYXBwZWRJdGVtLnJvdykge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBkZWxldGUgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICBsZXQga2VlcCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2luZGV4U3ViRmlsdGVyKSB7XG4gICAgICBrZWVwID0gdGhpcy5faW5kZXhTdWJGaWx0ZXIod3JhcHBlZEl0ZW0uaW5kZXgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSkge1xuICAgICAga2VlcCA9IGtlZXAgJiYgZnVuYyh3cmFwcGVkSXRlbS5yb3dbYXR0cl0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyB0aGlzLl9tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3Qgb3RoZXJJdGVtIG9mIG9wdGlvbnMuaXRlbXNUb0Nvbm5lY3QgfHwgW10pIHtcbiAgICAgIHdyYXBwZWRJdGVtLmNvbm5lY3RJdGVtKG90aGVySXRlbSk7XG4gICAgICBvdGhlckl0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleFN1YkZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIGFkZFN1YkZpbHRlciAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhTdWJGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGVJZCA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZUlkICYmIHRoaXMuX211cmUudGFibGVzW2V4aXN0aW5nVGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgc2hvcnRlc3RQYXRoVG9UYWJsZSAob3RoZXJUYWJsZSkge1xuICAgIC8vIERpamtzdHJhJ3MgYWxnb3JpdGhtLi4uXG4gICAgY29uc3QgdmlzaXRlZCA9IHt9O1xuICAgIGNvbnN0IGRpc3RhbmNlcyA9IHt9O1xuICAgIGNvbnN0IHByZXZUYWJsZXMgPSB7fTtcbiAgICBjb25zdCB2aXNpdCA9IHRhcmdldElkID0+IHtcbiAgICAgIGNvbnN0IHRhcmdldFRhYmxlID0gdGhpcy5fbXVyZS50YWJsZXNbdGFyZ2V0SWRdO1xuICAgICAgLy8gT25seSBjaGVjayB0aGUgdW52aXNpdGVkIGRlcml2ZWQgYW5kIHBhcmVudCB0YWJsZXNcbiAgICAgIGNvbnN0IG5laWdoYm9yTGlzdCA9IE9iamVjdC5rZXlzKHRhcmdldFRhYmxlLl9kZXJpdmVkVGFibGVzKVxuICAgICAgICAuY29uY2F0KHRhcmdldFRhYmxlLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUudGFibGVJZCkpXG4gICAgICAgIC5maWx0ZXIodGFibGVJZCA9PiAhdmlzaXRlZFt0YWJsZUlkXSk7XG4gICAgICAvLyBDaGVjayBhbmQgYXNzaWduIChvciB1cGRhdGUpIHRlbnRhdGl2ZSBkaXN0YW5jZXMgdG8gZWFjaCBuZWlnaGJvclxuICAgICAgZm9yIChjb25zdCBuZWlnaGJvcklkIG9mIG5laWdoYm9yTGlzdCkge1xuICAgICAgICBpZiAoZGlzdGFuY2VzW25laWdoYm9ySWRdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlzdGFuY2VzW3RhcmdldElkXSArIDEgPCBkaXN0YW5jZXNbbmVpZ2hib3JJZF0pIHtcbiAgICAgICAgICBkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPSBkaXN0YW5jZXNbdGFyZ2V0SWRdICsgMTtcbiAgICAgICAgICBwcmV2VGFibGVzW25laWdoYm9ySWRdID0gdGFyZ2V0SWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIHRoaXMgdGFibGUgaXMgb2ZmaWNpYWxseSB2aXNpdGVkOyB0YWtlIGl0IG91dCBvZiB0aGUgcnVubmluZ1xuICAgICAgLy8gZm9yIGZ1dHVyZSB2aXNpdHMgLyBjaGVja3NcbiAgICAgIHZpc2l0ZWRbdGFyZ2V0SWRdID0gdHJ1ZTtcbiAgICAgIGRlbGV0ZSBkaXN0YW5jZXNbdGFyZ2V0SWRdO1xuICAgIH07XG5cbiAgICAvLyBTdGFydCB3aXRoIHRoaXMgdGFibGVcbiAgICBwcmV2VGFibGVzW3RoaXMudGFibGVJZF0gPSBudWxsO1xuICAgIGRpc3RhbmNlc1t0aGlzLnRhYmxlSWRdID0gMDtcbiAgICBsZXQgdG9WaXNpdCA9IE9iamVjdC5rZXlzKGRpc3RhbmNlcyk7XG4gICAgd2hpbGUgKHRvVmlzaXQubGVuZ3RoID4gMCkge1xuICAgICAgLy8gVmlzaXQgdGhlIG5leHQgdGFibGUgdGhhdCBoYXMgdGhlIHNob3J0ZXN0IGRpc3RhbmNlXG4gICAgICB0b1Zpc2l0LnNvcnQoKGEsIGIpID0+IGRpc3RhbmNlc1thXSAtIGRpc3RhbmNlc1tiXSk7XG4gICAgICBsZXQgbmV4dElkID0gdG9WaXNpdC5zaGlmdCgpO1xuICAgICAgaWYgKG5leHRJZCA9PT0gb3RoZXJUYWJsZS50YWJsZUlkKSB7XG4gICAgICAgIC8vIEZvdW5kIG90aGVyVGFibGUhIFNlbmQgYmFjayB0aGUgY2hhaW4gb2YgY29ubmVjdGVkIHRhYmxlc1xuICAgICAgICBjb25zdCBjaGFpbiA9IFtdO1xuICAgICAgICB3aGlsZSAocHJldlRhYmxlc1tuZXh0SWRdICE9PSBudWxsKSB7XG4gICAgICAgICAgY2hhaW4udW5zaGlmdCh0aGlzLl9tdXJlLnRhYmxlc1tuZXh0SWRdKTtcbiAgICAgICAgICBuZXh0SWQgPSBwcmV2VGFibGVzW25leHRJZF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoYWluO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVmlzaXQgdGhlIHRhYmxlXG4gICAgICAgIHZpc2l0KG5leHRJZCk7XG4gICAgICAgIHRvVmlzaXQgPSBPYmplY3Qua2V5cyhkaXN0YW5jZXMpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBXZSBkaWRuJ3QgZmluZCBpdDsgdGhlcmUncyBubyBjb25uZWN0aW9uXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgZGVsaW1pdGVyXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZSA9PT0gbnVsbCA/IHdyYXBwZWRJdGVtLmluZGV4IDogd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKHsgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJyB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9tdXJlLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDAgfHwgdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdFRhYmxlO1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aWVyZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBBZ2dyZWdhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLl9kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqYnO1xuICB9XG4gIGRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUgKGF0dHIsIGZ1bmMpIHtcbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfdXBkYXRlSXRlbSAob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHNvIHRoYXQgQWdncmVnYXRlZFRhYmxlIGNhbiB0YWtlIGFkdmFudGFnZVxuICAgIC8vIG9mIHRoZSBwYXJ0aWFsbHktYnVpbHQgY2FjaGUgYXMgaXQgZ29lcywgYW5kIHBvc3Rwb25lIGZpbmlzaGluZyBpdGVtc1xuICAgIC8vIHVudGlsIGFmdGVyIHRoZSBwYXJlbnQgdGFibGUgaGFzIGJlZW4gZnVsbHkgaXRlcmF0ZWRcblxuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuX2l0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt3cmFwcGVkSXRlbS5pbmRleF0gPSB3cmFwcGVkSXRlbTtcbiAgICAgIC8vIEdvIGFoZWFkIGFuZCB5aWVsZCB0aGUgdW5maW5pc2hlZCBpdGVtOyB0aGlzIG1ha2VzIGl0IHBvc3NpYmxlIGZvclxuICAgICAgLy8gY2xpZW50IGFwcHMgdG8gYmUgbW9yZSByZXNwb25zaXZlIGFuZCByZW5kZXIgcGFydGlhbCByZXN1bHRzLCBidXQgYWxzb1xuICAgICAgLy8gbWVhbnMgdGhhdCB0aGV5IG5lZWQgdG8gd2F0Y2ggZm9yIHdyYXBwZWRJdGVtLm9uKCd1cGRhdGUnKSBldmVudHNcbiAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgIH1cblxuICAgIC8vIFNlY29uZCBwYXNzOiBub3cgdGhhdCB3ZSd2ZSBjb21wbGV0ZWQgdGhlIGZ1bGwgaXRlcmF0aW9uIG9mIHRoZSBwYXJlbnRcbiAgICAvLyB0YWJsZSwgd2UgY2FuIGZpbmlzaCBlYWNoIGl0ZW1cbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIHRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgaWYgKCF0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBXZSB3ZXJlIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKGV4aXN0aW5nSXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKG5ld0l0ZW0sIG5ld0l0ZW0pO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHN1cGVyLmdldEF0dHJpYnV0ZURldGFpbHMoKTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ucmVkdWNlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQWdncmVnYXRlZFRhYmxlO1xuIiwiY29uc3QgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuZHVwbGljYXRlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgfVxuICAgIF90b1Jhd09iamVjdCAoKSB7XG4gICAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICAgIG9iai5kdXBsaWNhdGVkQXR0cmlidXRlcyA9IHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgZHVwbGljYXRlQXR0cmlidXRlIChwYXJlbnRJZCwgYXR0cmlidXRlKSB7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gPSB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gfHwgW107XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0ucHVzaChhdHRyaWJ1dGUpO1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBfZHVwbGljYXRlQXR0cmlidXRlcyAod3JhcHBlZEl0ZW0pIHtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgcGFyZW50TmFtZSA9IHRoaXMuX211cmUudGFibGVzW3BhcmVudElkXS5uYW1lO1xuICAgICAgICB3cmFwcGVkSXRlbS5yb3dbYCR7cGFyZW50TmFtZX0uJHthdHRyfWBdID0gd3JhcHBlZEl0ZW0uY29ubmVjdGVkSXRlbXNbcGFyZW50SWRdWzBdLnJvd1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gICAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgICBjb25zdCBhbGxBdHRycyA9IHN1cGVyLmdldEF0dHJpYnV0ZURldGFpbHMoKTtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgYXR0ck5hbWUgPSBgJHt0aGlzLl9tdXJlLnRhYmxlc1twYXJlbnRJZF0ubmFtZX0uJHthdHRyfWA7XG4gICAgICAgIGFsbEF0dHJzW2F0dHJOYW1lXSA9IGFsbEF0dHJzW2F0dHJOYW1lXSB8fCB7IG5hbWU6IGF0dHJOYW1lIH07XG4gICAgICAgIGFsbEF0dHJzW2F0dHJOYW1lXS5jb3BpZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFsbEF0dHJzO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcbmltcG9ydCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gZnJvbSAnLi9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluKFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuZGVsaW1pdGVyID0gb3B0aW9ucy5kZWxpbWl0ZXIgfHwgJywnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpCc7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCB2YWx1ZXMgPSAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSB8fCAnJykuc3BsaXQodGhpcy5kZWxpbWl0ZXIpO1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICAgICAgY29uc3Qgcm93ID0ge307XG4gICAgICAgIHJvd1t0aGlzLl9hdHRyaWJ1dGVdID0gdmFsdWU7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3csXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKG5ld0l0ZW0pO1xuICAgICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlID09PSB1bmRlZmluZWQgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBgWyR7dGhpcy5fdmFsdWV9XWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBpZiAodGhpcy5hdHRyaWJ1dGUgPT09IG51bGwgJiYgd3JhcHBlZFBhcmVudC5pbmRleCA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgLy8gRmFjZXRpbmcgYnkgaW5kZXggdHJhbnNmb3JtcyBhIHJvdyBpbnRvIGEgdGFibGVcbiAgICAgICAgZm9yIChjb25zdCBbIGNoaWxkSW5kZXgsIGNoaWxkUm93IF0gb2YgT2JqZWN0LmVudHJpZXMod3JhcHBlZFBhcmVudC5yb3cpKSB7XG4gICAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgICAgaW5kZXg6IGNoaWxkSW5kZXgsXG4gICAgICAgICAgICByb3c6IGNoaWxkUm93LFxuICAgICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fYXR0cmlidXRlICE9PSBudWxsICYmIHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gZnJvbSAnLi9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbihUYWJsZSkge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS5uYW1lKS5qb2luKCfiqK8nKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgLy8gU3BpbiB0aHJvdWdoIGFsbCBvZiB0aGUgcGFyZW50VGFibGVzIHNvIHRoYXQgdGhlaXIgX2NhY2hlIGlzIHByZS1idWlsdFxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICBhd2FpdCBwYXJlbnRUYWJsZS5jb3VudFJvd3MoKTtcbiAgICB9XG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZSkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbaW5kZXhdKVxuICAgICAgfSk7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKG5ld0l0ZW0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX211cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy5jbGFzc0lkID0gb3B0aW9ucy5jbGFzc0lkO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMuX211cmUgfHwgIXRoaXMuY2xhc3NJZCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYF9tdXJlLCBjbGFzc0lkLCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMuYW5ub3RhdGlvbiA9IG9wdGlvbnMuYW5ub3RhdGlvbiB8fCAnJztcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb246IHRoaXMuYW5ub3RhdGlvblxuICAgIH07XG4gIH1cbiAgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIHRoaXMuX2NsYXNzTmFtZSA9IHZhbHVlO1xuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXRIYXNoVGFibGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiBhdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgfVxuICBnZXQgdGFibGUgKCkge1xuICAgIHJldHVybiB0aGlzLl9tdXJlLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyB0aGlzLl9tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgX2Rlcml2ZUdlbmVyaWNDbGFzcyAobmV3VGFibGUpIHtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyh7XG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcydcbiAgICB9KTtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3ModGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKSk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3ModGhpcy50YWJsZS5leHBhbmQoYXR0cmlidXRlLCBkZWxpbWl0ZXIpKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkcyA9IG9wdGlvbnMuZWRnZUNsYXNzSWRzIHx8IHt9O1xuICAgIHRoaXMuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzID0ge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuZWRnZUNsYXNzSWRzID0gdGhpcy5lZGdlQ2xhc3NJZHM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBhc3luYyBwcmVwU2hvcnRlc3RFZGdlUGF0aCAoZWRnZUNsYXNzSWQpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbZWRnZUNsYXNzSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1tlZGdlQ2xhc3NJZF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGVkZ2VUYWJsZSA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZF0udGFibGU7XG4gICAgICBjb25zdCBpZExpc3QgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGhpcy50YWJsZS5zaG9ydGVzdFBhdGhUb1RhYmxlKGVkZ2VUYWJsZSkpIHtcbiAgICAgICAgaWRMaXN0LnB1c2godGFibGUudGFibGVJZCk7XG4gICAgICAgIC8vIFNwaW4gdGhyb3VnaCB0aGUgdGFibGUgdG8gbWFrZSBzdXJlIGFsbCBpdHMgcm93cyBhcmUgd3JhcHBlZCBhbmQgY29ubmVjdGVkXG4gICAgICAgIGF3YWl0IHRhYmxlLmNvdW50Um93cygpO1xuICAgICAgfVxuICAgICAgdGhpcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbZWRnZUNsYXNzSWRdID0gaWRMaXN0O1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID4gMikge1xuICAgICAgLy8gSWYgdGhlcmUgYXJlIG1vcmUgdGhhbiB0d28gZWRnZXMsIGJyZWFrIGFsbCBjb25uZWN0aW9ucyBhbmQgbWFrZVxuICAgICAgLy8gdGhpcyBhIGZsb2F0aW5nIGVkZ2UgKGZvciBub3csIHdlJ3JlIG5vdCBkZWFsaW5nIGluIGh5cGVyZWRnZXMpXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gV2l0aCBvbmx5IG9uZSBjb25uZWN0aW9uLCB0aGlzIG5vZGUgc2hvdWxkIGJlY29tZSBhIHNlbGYtZWRnZVxuICAgICAgLy8gKG9yIGEgZmxvYXRpbmcgZWRnZSBpZiBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCBpcyBudWxsKVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIGVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgIGxldCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIGxldCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgIC8vIEZpZ3VyZSBvdXQgdGhlIGRpcmVjdGlvbiwgaWYgdGhlcmUgaXMgb25lXG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLmRpcmVjdGVkICYmIHRhcmdldEVkZ2VDbGFzcy5kaXJlY3RlZCkge1xuICAgICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGhhcHBlbmVkIHRvIGdldCB0aGUgZWRnZXMgaW4gb3JkZXI7IHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBnb3QgdGhlIGVkZ2VzIGJhY2t3YXJkczsgc3dhcCB0aGVtIGFuZCBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgICAgIHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBub3cgd2Uga25vdyBob3cgdG8gc2V0IHNvdXJjZSAvIHRhcmdldCBpZHNcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IHNvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICAvLyBEZWxldGUgZWFjaCBvZiB0aGUgZWRnZSBjbGFzc2VzXG4gICAgICBzb3VyY2VFZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgICB0YXJnZXRFZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgfVxuICAgIHRoaXMuZGVsZXRlKCk7XG4gICAgZGVsZXRlIG9wdGlvbnMuY2xhc3NJZDtcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgZGlyZWN0ZWQsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGNvbnN0IHRoaXNIYXNoID0gdGhpcy5nZXRIYXNoVGFibGUoYXR0cmlidXRlKTtcbiAgICBjb25zdCBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy5nZXRIYXNoVGFibGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBkaXJlY3RlZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWRcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBfcGlja0VkZ2VUYWJsZSAob3RoZXJDbGFzcykge1xuICAgIGxldCBlZGdlVGFibGU7XG4gICAgbGV0IGNoYWluID0gdGhpcy50YWJsZS5zaG9ydGVzdFBhdGhUb1RhYmxlKG90aGVyQ2xhc3MudGFibGUpO1xuICAgIGlmIChjaGFpbiA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmRlcmx5aW5nIHRhYmxlIGNoYWluIGJldHdlZW4gZWRnZSBhbmQgbm9kZSBjbGFzc2VzIGlzIGJyb2tlbmApO1xuICAgIH0gZWxzZSBpZiAoY2hhaW4ubGVuZ3RoIDw9IDIpIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICBlZGdlVGFibGUgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGU7IHByaW9yaXRpemUgU3RhdGljVGFibGUgYW5kIFN0YXRpY0RpY3RUYWJsZVxuICAgICAgbGV0IHN0YXRpY0V4aXN0cyA9IGZhbHNlO1xuICAgICAgY2hhaW4gPSBjaGFpbi5zbGljZSgxLCBjaGFpbi5sZW5ndGggLSAxKS5tYXAoKHRhYmxlLCBkaXN0KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0YWJsZS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZSwgZGlzdCB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIGNoYWluID0gY2hhaW4uZmlsdGVyKCh7IHRhYmxlIH0pID0+IHtcbiAgICAgICAgICByZXR1cm4gdGFibGUudHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlZGdlVGFibGUgPSBjaGFpblswXS50YWJsZTtcbiAgICB9XG4gICAgcmV0dXJuIGVkZ2VUYWJsZTtcbiAgfVxuICBhc3luYyBwcmVwU2hvcnRlc3RTb3VyY2VQYXRoICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVkU2hvcnRlc3RTb3VyY2VQYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGg7XG4gICAgfSBlbHNlIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgc291cmNlVGFibGUgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS50YWJsZTtcbiAgICAgIGNvbnN0IGlkTGlzdCA9IFtdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZSBvZiB0aGlzLnRhYmxlLnNob3J0ZXN0UGF0aFRvVGFibGUoc291cmNlVGFibGUpKSB7XG4gICAgICAgIGlkTGlzdC5wdXNoKHRhYmxlLnRhYmxlSWQpO1xuICAgICAgICAvLyBTcGluIHRocm91Z2ggdGhlIHRhYmxlIHRvIG1ha2Ugc3VyZSBhbGwgaXRzIHJvd3MgYXJlIHdyYXBwZWQgYW5kIGNvbm5lY3RlZFxuICAgICAgICBhd2FpdCB0YWJsZS5jb3VudFJvd3MoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aCA9IGlkTGlzdDtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGg7XG4gICAgfVxuICB9XG4gIGFzeW5jIHByZXBTaG9ydGVzdFRhcmdldFBhdGggKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aDtcbiAgICB9IGVsc2UgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0YXJnZXRUYWJsZSA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLnRhYmxlO1xuICAgICAgY29uc3QgaWRMaXN0ID0gW107XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRoaXMudGFibGUuc2hvcnRlc3RQYXRoVG9UYWJsZSh0YXJnZXRUYWJsZSkpIHtcbiAgICAgICAgaWRMaXN0LnB1c2godGFibGUudGFibGVJZCk7XG4gICAgICAgIC8vIFNwaW4gdGhyb3VnaCB0aGUgdGFibGUgdG8gbWFrZSBzdXJlIGFsbCBpdHMgcm93cyBhcmUgd3JhcHBlZCBhbmQgY29ubmVjdGVkXG4gICAgICAgIGF3YWl0IHRhYmxlLmNvdW50Um93cygpO1xuICAgICAgfVxuICAgICAgdGhpcy5fY2FjaGVkU2hvcnRlc3RUYXJnZXRQYXRoID0gaWRMaXN0O1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aDtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICB0ZW1wLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICBkZWxldGUgdGVtcC5jbGFzc0lkO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMuX211cmUuY3JlYXRlQ2xhc3ModGVtcCk7XG5cbiAgICBpZiAodGVtcC5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgY29uc3QgZWRnZVRhYmxlID0gdGhpcy5fcGlja0VkZ2VUYWJsZShzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZS50YWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IGVkZ2VUYWJsZSA9IHRoaXMuX3BpY2tFZGdlVGFibGUodGFyZ2V0Q2xhc3MpO1xuICAgICAgY29uc3QgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGUudGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiB0ZW1wLnRhcmdldENsYXNzSWRcbiAgICAgIH0pO1xuICAgICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCBkaXJlY3Rpb24sIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSkge1xuICAgIGlmIChkaXJlY3Rpb24pIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoZGlyZWN0aW9uICE9PSAnc291cmNlJyAmJiBkaXJlY3Rpb24gIT09ICd0YXJnZXQnKSB7XG4gICAgICBkaXJlY3Rpb24gPSB0aGlzLnRhcmdldENsYXNzSWQgPT09IG51bGwgPyAndGFyZ2V0JyA6ICdzb3VyY2UnO1xuICAgIH1cbiAgICBpZiAoZGlyZWN0aW9uID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2UoeyBub2RlQ2xhc3MsIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSk7XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICB0b2dnbGVOb2RlRGlyZWN0aW9uIChzb3VyY2VDbGFzc0lkKSB7XG4gICAgaWYgKCFzb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBpZiAoc291cmNlQ2xhc3NJZCAhPT0gdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBzd2FwIHRvIHVuY29ubmVjdGVkIGNsYXNzIGlkOiAke3NvdXJjZUNsYXNzSWR9YCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGNvbm5lY3RTb3VyY2UgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc2tpcFNhdmUgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy5nZXRIYXNoVGFibGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gc291cmNlQ2xhc3MudGFibGUgOiBzb3VyY2VDbGFzcy5nZXRIYXNoVGFibGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKTtcblxuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgY29ubmVjdFRhcmdldCAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbCxcbiAgICBza2lwU2F2ZSA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLmdldEhhc2hUYWJsZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLmdldEhhc2hUYWJsZShub2RlQXR0cmlidXRlKTtcbiAgICBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pO1xuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0U291cmNlICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZXhpc3RpbmdTb3VyY2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1NvdXJjZUNsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdTb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVkU2hvcnRlc3RTb3VyY2VQYXRoO1xuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoeyBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aDtcbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gIH1cbiAgZGlzY29ubmVjdCAoKSB7XG4gICAgZm9yIChjb25zdCBpdGVtTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuY29ubmVjdGVkSXRlbXMpKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbUxpc3QpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSAoaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdIHx8IFtdKS5pbmRleE9mKHRoaXMpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IHt9O1xuICB9XG4gICogaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbdGFibGVJZHNbMF1dIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGhpc1RhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1t0aGlzVGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhyZW1haW5pbmdUYWJsZUlkcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogZWRnZXMgKHsgbGltaXQgPSBJbmZpbml0eSwgZWRnZUlkcyA9IHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzIH0gPSB7fSkge1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKGVkZ2VJZHMpKSB7XG4gICAgICBjb25zdCB0YWJsZUlkQ2hhaW4gPSBhd2FpdCB0aGlzLmNsYXNzT2JqLnByZXBTaG9ydGVzdEVkZ2VQYXRoKGVkZ2VDbGFzc0lkKTtcbiAgICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZENoYWluKTtcbiAgICAgIGxldCB0ZW1wID0gaXRlcmF0b3IubmV4dCgpO1xuICAgICAgd2hpbGUgKCF0ZW1wLmRvbmUgJiYgaSA8IGxpbWl0KSB7XG4gICAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgICAgIGkrKztcbiAgICAgICAgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIH1cbiAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzICh7IGxpbWl0ID0gSW5maW5pdHkgfSA9IHt9KSB7XG4gICAgY29uc3QgdGFibGVJZENoYWluID0gYXdhaXQgdGhpcy5jbGFzc09iai5wcmVwU2hvcnRlc3RTb3VyY2VQYXRoKCk7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkQ2hhaW4pO1xuICAgIGxldCB0ZW1wID0gaXRlcmF0b3IubmV4dCgpO1xuICAgIGxldCBpID0gMDtcbiAgICB3aGlsZSAoIXRlbXAuZG9uZSAmJiBpIDwgbGltaXQpIHtcbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgICBpKys7XG4gICAgICB0ZW1wID0gaXRlcmF0b3IubmV4dCgpO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHRhcmdldE5vZGVzICh7IGxpbWl0ID0gSW5maW5pdHkgfSA9IHt9KSB7XG4gICAgY29uc3QgdGFibGVJZENoYWluID0gYXdhaXQgdGhpcy5jbGFzc09iai5wcmVwU2hvcnRlc3RUYXJnZXRQYXRoKCk7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkQ2hhaW4pO1xuICAgIGxldCB0ZW1wID0gaXRlcmF0b3IubmV4dCgpO1xuICAgIGxldCBpID0gMDtcbiAgICB3aGlsZSAoIXRlbXAuZG9uZSAmJiBpIDwgbGltaXQpIHtcbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgICBpKys7XG4gICAgICB0ZW1wID0gaXRlcmF0b3IubmV4dCgpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICBpZiAodGhpcy5lbnRyaWVzW2hhc2hdLmluZGV4T2YodmFsdWUpID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcbmxldCBORVhUX1RBQkxFX0lEID0gMTtcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRBQkxFUyA9IFRBQkxFUztcbiAgICB0aGlzLkNMQVNTRVMgPSBDTEFTU0VTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcbiAgICB0aGlzLklOREVYRVMgPSBJTkRFWEVTO1xuXG4gICAgLy8gRGVmYXVsdCBuYW1lZCBmdW5jdGlvbnNcbiAgICB0aGlzLk5BTUVEX0ZVTkNUSU9OUyA9IHtcbiAgICAgIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkgeyB5aWVsZCB3cmFwcGVkSXRlbS5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAoIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgICF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBHcmFuZHBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgaWYgKCEocGFyZW50VHlwZSA9PT0gJ251bWJlcicgfHwgcGFyZW50VHlwZSA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyZW50IGlzbid0IGEga2V5IC8gaW5kZXhgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0RmluaXNoOiBmdW5jdGlvbiAqICh0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgeWllbGQge1xuICAgICAgICAgIGxlZnQ6IHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLFxuICAgICAgICAgIHJpZ2h0OiBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW1cbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy50YWJsZXMgPSB0aGlzLmh5ZHJhdGUoJ211cmVfdGFibGVzJywgdGhpcy5UQUJMRVMpO1xuICAgIE5FWFRfVEFCTEVfSUQgPSBPYmplY3Qua2V5cyh0aGlzLnRhYmxlcylcbiAgICAgIC5yZWR1Y2UoKGhpZ2hlc3ROdW0sIHRhYmxlSWQpID0+IHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KGhpZ2hlc3ROdW0sIHBhcnNlSW50KHRhYmxlSWQubWF0Y2goL3RhYmxlKFxcZCopLylbMV0pKTtcbiAgICAgIH0sIDApICsgMTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMuaHlkcmF0ZSgnbXVyZV9jbGFzc2VzJywgdGhpcy5DTEFTU0VTKTtcbiAgICBORVhUX0NMQVNTX0lEID0gT2JqZWN0LmtleXModGhpcy5jbGFzc2VzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgY2xhc3NJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQoY2xhc3NJZC5tYXRjaCgvY2xhc3MoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuICB9XG5cbiAgc2F2ZVRhYmxlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ211cmVfdGFibGVzJywgdGhpcy50YWJsZXMpO1xuICAgIHRoaXMudHJpZ2dlcigndGFibGVVcGRhdGUnKTtcbiAgfVxuICBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ211cmVfY2xhc3NlcycsIHRoaXMuY2xhc3Nlcyk7XG4gICAgdGhpcy50cmlnZ2VyKCdjbGFzc1VwZGF0ZScpO1xuICB9XG5cbiAgaHlkcmF0ZSAoc3RvcmFnZUtleSwgVFlQRVMpIHtcbiAgICBsZXQgY29udGFpbmVyID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShzdG9yYWdlS2V5KTtcbiAgICBjb250YWluZXIgPSBjb250YWluZXIgPyBKU09OLnBhcnNlKGNvbnRhaW5lcikgOiB7fTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb250YWluZXIpKSB7XG4gICAgICBjb25zdCB0eXBlID0gdmFsdWUudHlwZTtcbiAgICAgIGRlbGV0ZSB2YWx1ZS50eXBlO1xuICAgICAgdmFsdWUubXVyZSA9IHRoaXM7XG4gICAgICBjb250YWluZXJba2V5XSA9IG5ldyBUWVBFU1t0eXBlXSh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cbiAgZGVoeWRyYXRlIChzdG9yYWdlS2V5LCBjb250YWluZXIpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlLl90b1Jhd09iamVjdCgpO1xuICAgICAgICByZXN1bHRba2V5XS50eXBlID0gdmFsdWUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oc3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gICAgfVxuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG5cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMudGFibGVJZCkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHtORVhUX1RBQkxFX0lEfWA7XG4gICAgICBORVhUX1RBQkxFX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLlRBQkxFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFR5cGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICBpZiAoIW9wdGlvbnMuY2xhc3NJZCkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLkNMQVNTRVNbb3B0aW9ucy50eXBlXTtcbiAgICBkZWxldGUgb3B0aW9ucy50eXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cblxuICBuZXdUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlT2JqID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGVPYmo7XG4gIH1cbiAgbmV3Q2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdDbGFzc09iaiA9IHRoaXMuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gICAgdGhpcy5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdDbGFzc09iajtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY1RhYmxlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNUYWJsZSgpIGluc3RlYWQuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljVGFibGUoe1xuICAgICAgbmFtZTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljVGFibGUgKHsgbmFtZSwgZXh0ZW5zaW9uID0gJ3R4dCcsIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBkYXRhID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBhdHRyaWJ1dGVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBkYXRhLmNvbHVtbnMpIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgZGF0YS5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY1RhYmxlKHsgbmFtZSwgZGF0YSwgYXR0cmlidXRlcyB9KTtcbiAgfVxuICBhZGRTdGF0aWNUYWJsZSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudHlwZSA9IG9wdGlvbnMuZGF0YSBpbnN0YW5jZW9mIEFycmF5ID8gJ1N0YXRpY1RhYmxlJyA6ICdTdGF0aWNEaWN0VGFibGUnO1xuICAgIGxldCBuZXdUYWJsZSA9IHRoaXMubmV3VGFibGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlQWxsVW51c2VkVGFibGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IHRhYmxlSWQgaW4gdGhpcy50YWJsZXMpIHtcbiAgICAgIGlmICh0aGlzLnRhYmxlc1t0YWJsZUlkXSkge1xuICAgICAgICB0cnkgeyB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTsgfSBjYXRjaCAoZXJyKSB7fVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBkZWxldGVBbGxDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgY2xhc3NPYmouZGVsZXRlKCk7XG4gICAgfVxuICB9XG4gIGdldENsYXNzRGF0YSAoKSB7XG4gICAgY29uc3QgcmVzdWx0cyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICByZXN1bHRzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouY3VycmVudERhdGE7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IEZpbGVSZWFkZXIgZnJvbSAnZmlsZXJlYWRlcic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUoRmlsZVJlYWRlciwgbnVsbCk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJvZmYiLCJpbmRleCIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiZm9yRWFjaCIsInNldFRpbWVvdXQiLCJhcHBseSIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsIk9iamVjdCIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiVGFibGUiLCJvcHRpb25zIiwiX211cmUiLCJtdXJlIiwidGFibGVJZCIsIkVycm9yIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleFN1YkZpbHRlciIsImluZGV4U3ViRmlsdGVyIiwiX2F0dHJpYnV0ZVN1YkZpbHRlcnMiLCJhdHRyaWJ1dGVTdWJGaWx0ZXJzIiwiX3RvUmF3T2JqZWN0IiwicmVzdWx0IiwiX2F0dHJpYnV0ZXMiLCJ1c2VkQnlDbGFzc2VzIiwiX3VzZWRCeUNsYXNzZXMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsImZ1bmMiLCJuYW1lIiwiaXRlcmF0ZSIsInJlc2V0IiwiX2NhY2hlIiwibGltaXQiLCJ1bmRlZmluZWQiLCJJbmZpbml0eSIsInZhbHVlcyIsInNsaWNlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlIiwiZGVyaXZlZFRhYmxlIiwiY291bnRSb3dzIiwia2V5cyIsImxlbmd0aCIsImNvdW50IiwiaXRlcmF0b3IiLCJuZXh0IiwiZG9uZSIsIl9pdGVyYXRlIiwiY29tcGxldGVkIiwiX2ZpbmlzaEl0ZW0iLCJ3cmFwcGVkSXRlbSIsInJvdyIsImtlZXAiLCJkaXNjb25uZWN0IiwiX3dyYXAiLCJ0YWJsZSIsImNsYXNzT2JqIiwiV1JBUFBFUlMiLCJHZW5lcmljV3JhcHBlciIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiY29ubmVjdEl0ZW0iLCJnZXRJbmRleERldGFpbHMiLCJkZXRhaWxzIiwic3VwcHJlc3NlZCIsImZpbHRlcmVkIiwiZ2V0QXR0cmlidXRlRGV0YWlscyIsImFsbEF0dHJzIiwiZXhwZWN0ZWQiLCJvYnNlcnZlZCIsImRlcml2ZWQiLCJjdXJyZW50RGF0YSIsImRhdGEiLCJjb21wbGV0ZSIsImRlcml2ZUF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsInN1cHByZXNzQXR0cmlidXRlIiwiYWRkU3ViRmlsdGVyIiwiX2Rlcml2ZVRhYmxlIiwibmV3VGFibGUiLCJjcmVhdGVUYWJsZSIsInNhdmVUYWJsZXMiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGVJZCIsImZpbmQiLCJ0YWJsZU9iaiIsImV2ZXJ5Iiwib3B0aW9uTmFtZSIsIm9wdGlvblZhbHVlIiwidGFibGVzIiwic2hvcnRlc3RQYXRoVG9UYWJsZSIsIm90aGVyVGFibGUiLCJ2aXNpdGVkIiwiZGlzdGFuY2VzIiwicHJldlRhYmxlcyIsInZpc2l0IiwidGFyZ2V0SWQiLCJ0YXJnZXRUYWJsZSIsIm5laWdoYm9yTGlzdCIsImNvbmNhdCIsInBhcmVudFRhYmxlcyIsIm1hcCIsInBhcmVudFRhYmxlIiwiZmlsdGVyIiwibmVpZ2hib3JJZCIsInRvVmlzaXQiLCJzb3J0IiwiYSIsImIiLCJuZXh0SWQiLCJzaGlmdCIsImNoYWluIiwidW5zaGlmdCIsImFnZ3JlZ2F0ZSIsImV4cGFuZCIsImRlbGltaXRlciIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0IiwiY2xhc3NlcyIsInJlZHVjZSIsImFnZyIsImRlbGV0ZSIsImV4ZWMiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJpdGVtIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQWdncmVnYXRlZFRhYmxlIiwiX2F0dHJpYnV0ZSIsIl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJyZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJfZGVoeWRyYXRlRnVuY3Rpb24iLCJkZXJpdmVSZWR1Y2VkQXR0cmlidXRlIiwiX3VwZGF0ZUl0ZW0iLCJvcmlnaW5hbFdyYXBwZWRJdGVtIiwibmV3V3JhcHBlZEl0ZW0iLCJ3cmFwcGVkUGFyZW50IiwiZXhpc3RpbmdJdGVtIiwibmV3SXRlbSIsInJlZHVjZWQiLCJEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfaW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9kdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlQXR0cmlidXRlIiwicGFyZW50SWQiLCJfZHVwbGljYXRlQXR0cmlidXRlcyIsInBhcmVudE5hbWUiLCJjb25uZWN0ZWRJdGVtcyIsImF0dHJOYW1lIiwiY29waWVkIiwiRXhwYW5kZWRUYWJsZSIsInNwbGl0IiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiY2hpbGRJbmRleCIsImNoaWxkUm93IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJHZW5lcmljQ2xhc3MiLCJjbGFzc0lkIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsImFubm90YXRpb24iLCJzZXRDbGFzc05hbWUiLCJzYXZlQ2xhc3NlcyIsImhhc0N1c3RvbU5hbWUiLCJnZXRIYXNoVGFibGUiLCJpbnRlcnByZXRBc05vZGVzIiwibmV3Q2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiX2Rlcml2ZUdlbmVyaWNDbGFzcyIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc0lkcyIsIl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRocyIsIk5vZGVXcmFwcGVyIiwicHJlcFNob3J0ZXN0RWRnZVBhdGgiLCJlZGdlQ2xhc3NJZCIsImVkZ2VUYWJsZSIsImlkTGlzdCIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNyZWF0ZUNsYXNzIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibm9kZUNsYXNzIiwiZGlzY29ubmVjdFNvdXJjZSIsImRpc2Nvbm5lY3RUYXJnZXQiLCJFZGdlQ2xhc3MiLCJFZGdlV3JhcHBlciIsIl9waWNrRWRnZVRhYmxlIiwib3RoZXJDbGFzcyIsInN0YXRpY0V4aXN0cyIsImRpc3QiLCJzdGFydHNXaXRoIiwicHJlcFNob3J0ZXN0U291cmNlUGF0aCIsIl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGgiLCJzb3VyY2VUYWJsZSIsInByZXBTaG9ydGVzdFRhcmdldFBhdGgiLCJfY2FjaGVkU2hvcnRlc3RUYXJnZXRQYXRoIiwibmV3Tm9kZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsImRpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiY29ubmVjdFRhcmdldCIsImNvbm5lY3RTb3VyY2UiLCJ0b2dnbGVOb2RlRGlyZWN0aW9uIiwic2tpcFNhdmUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJpdGVtTGlzdCIsIml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInRhYmxlSWRzIiwidGhpc1RhYmxlSWQiLCJyZW1haW5pbmdUYWJsZUlkcyIsImVkZ2VzIiwiZWRnZUlkcyIsInRhYmxlSWRDaGFpbiIsInNvdXJjZU5vZGVzIiwidGFyZ2V0Tm9kZXMiLCJJbk1lbW9yeUluZGV4IiwidG9SYXdPYmplY3QiLCJpdGVyRW50cmllcyIsImhhc2giLCJ2YWx1ZUxpc3QiLCJpdGVySGFzaGVzIiwiaXRlclZhbHVlTGlzdHMiLCJnZXRWYWx1ZUxpc3QiLCJhZGRWYWx1ZSIsIk5FWFRfQ0xBU1NfSUQiLCJORVhUX1RBQkxFX0lEIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiZGVidWciLCJEQVRBTElCX0ZPUk1BVFMiLCJUQUJMRVMiLCJDTEFTU0VTIiwiSU5ERVhFUyIsIk5BTUVEX0ZVTkNUSU9OUyIsImlkZW50aXR5IiwicmF3SXRlbSIsImtleSIsIlR5cGVFcnJvciIsInBhcmVudFR5cGUiLCJkZWZhdWx0RmluaXNoIiwidGhpc1dyYXBwZWRJdGVtIiwib3RoZXJXcmFwcGVkSXRlbSIsImxlZnQiLCJyaWdodCIsInNoYTEiLCJKU09OIiwic3RyaW5naWZ5Iiwibm9vcCIsImh5ZHJhdGUiLCJoaWdoZXN0TnVtIiwiTWF0aCIsIm1heCIsInBhcnNlSW50IiwibWF0Y2giLCJkZWh5ZHJhdGUiLCJzdG9yYWdlS2V5IiwiVFlQRVMiLCJjb250YWluZXIiLCJnZXRJdGVtIiwicGFyc2UiLCJzZXRJdGVtIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIlR5cGUiLCJzZWxlY3RvciIsIm5ld1RhYmxlT2JqIiwibmV3Q2xhc3NPYmoiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwiY29uc29sZSIsIndhcm4iLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJlcnIiLCJkZWxldGVBbGxDbGFzc2VzIiwiZ2V0Q2xhc3NEYXRhIiwicmVzdWx0cyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QkMsdUJBQXZCLEVBQWdEO1VBQzVDLENBQUMsS0FBS0wsYUFBTCxDQUFtQkcsU0FBbkIsQ0FBTCxFQUFvQzthQUM3QkgsYUFBTCxDQUFtQkcsU0FBbkIsSUFBZ0MsRUFBaEM7OztV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
