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

  reset() {
    delete this._partialCache;
    delete this._cache;

    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }

    this.trigger('reset');
  }

  get name() {
    throw new Error(`this function should be overridden`);
  }

  async buildCache() {
    if (this._cache) {
      return this._cache;
    } else if (this._cachePromise) {
      return this._cachePromise;
    } else {
      this._cachePromise = new Promise(async (resolve, reject) => {
        for await (const temp of this._buildCache()) {} // eslint-disable-line no-unused-vars


        delete this._cachePromise;
        resolve(this._cache);
      });
      return this._cachePromise;
    }
  }

  async countRows() {
    return Object.keys((await this.buildCache())).length;
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

  closedTranspose(indexes) {
    return indexes.map(index => {
      const options = {
        type: 'TransposedTable',
        index
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }

  async *openTranspose(limit = Infinity) {
    for await (const wrappedItem of this.iterate({
      limit
    })) {
      const options = {
        type: 'TransposedTable',
        index: wrappedItem.index
      };
      yield this._getExistingTable(options) || this._deriveTable(options);
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

        this._updateItem(newItem, wrappedParent);

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

    if (!this._attribute || !this._value === undefined) {
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
      if (wrappedParent.row[this._attribute] === this._value) {
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

class TransposedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._index = options.index;

    if (this._index === undefined) {
      throw new Error(`index is required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.index = this._index;
    return obj;
  }

  get name() {
    return `ᵀ${this._index}`;
  }

  async *_iterate(options) {
    // Pre-build the parent table's cache
    const parentTable = this.parentTable;
    await parentTable.buildCache(); // Iterate the row's attributes as indexes

    const wrappedParent = parentTable._cache[this._index] || {
      row: {}
    };

    for (const [index, value] of Object.entries(wrappedParent.row)) {
      const newItem = this._wrap({
        index,
        row: typeof value === 'object' ? value : {
          value
        },
        itemsToConnect: [wrappedParent]
      });

      if (this._finishItem(newItem)) {
        yield newItem;
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
      await parentTable.buildCache();
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
  ConnectedTable: ConnectedTable,
  TransposedTable: TransposedTable
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

  closedTranspose(indexes) {
    return this.table.closedTranspose(indexes).map(newTable => {
      return this._deriveGenericClass(newTable);
    });
  }

  async *openTranspose() {
    for await (const newTable of this.table.openTranspose()) {
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
    this._cachedEdgePaths = {};
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
    if (this._cachedEdgePaths[edgeClassId] !== undefined) {
      return this._cachedEdgePaths[edgeClassId];
    } else {
      const edgeTable = this._mure.classes[edgeClassId].table;
      const idList = [];

      for (const table of this.table.shortestPathToTable(edgeTable)) {
        idList.push(table.tableId); // Spin through the table to make sure all its rows are wrapped and connected

        await table.buildCache();
      }

      this._cachedEdgePaths[edgeClassId] = idList;
      return this._cachedEdgePaths[edgeClassId];
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
    if (this._cachedSourcePath !== undefined) {
      return this._cachedSourcePath;
    } else if (this.sourceClassId === null) {
      return [];
    } else {
      const sourceTable = this._mure.classes[this.sourceClassId].table;
      const idList = [];

      for (const table of this.table.shortestPathToTable(sourceTable)) {
        idList.push(table.tableId); // Spin through the table to make sure all its rows are wrapped and connected

        await table.buildCache();
      }

      this._cachedSourcePath = idList;
      return this._cachedSourcePath;
    }
  }

  async prepShortestTargetPath() {
    if (this._cachedTargetPath !== undefined) {
      return this._cachedTargetPath;
    } else if (this.targetClassId === null) {
      return [];
    } else {
      const targetTable = this._mure.classes[this.targetClassId].table;
      const idList = [];

      for (const table of this.table.shortestPathToTable(targetTable)) {
        idList.push(table.tableId); // Spin through the table to make sure all its rows are wrapped and connected

        await table.buildCache();
      }

      this._cachedTargetPath = idList;
      return this._cachedTargetPath;
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
      delete existingSourceClass._cachedEdgePaths[this.classId];
    }

    delete this._cachedSourcePath;

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
      delete existingTargetClass._cachedEdgePaths[this.classId];
    }

    delete this._cachedTargetPath;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TaW5nbGVQYXJlbnRNaXhpbi5qcyIsIi4uL3NyYy9UYWJsZXMvQWdncmVnYXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0V4cGFuZGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0ZhY2V0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvVHJhbnNwb3NlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Db25uZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9JbmRleGVzL0luTWVtb3J5SW5kZXguanMiLCIuLi9zcmMvTXVyZS5qcyIsIi4uL3NyYy9tYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuXG5jbGFzcyBUYWJsZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX211cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5fbXVyZSB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG11cmUgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5hdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcyA9IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cblxuICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5zdXBwcmVzc2VkQXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gISFvcHRpb25zLnN1cHByZXNzSW5kZXg7XG5cbiAgICB0aGlzLl9pbmRleFN1YkZpbHRlciA9IChvcHRpb25zLmluZGV4U3ViRmlsdGVyICYmIHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKG9wdGlvbnMuaW5kZXhTdWJGaWx0ZXIpKSB8fCBudWxsO1xuICAgIHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuYXR0cmlidXRlU3ViRmlsdGVycyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuX2F0dHJpYnV0ZXMsXG4gICAgICBkZXJpdmVkVGFibGVzOiB0aGlzLl9kZXJpdmVkVGFibGVzLFxuICAgICAgdXNlZEJ5Q2xhc3NlczogdGhpcy5fdXNlZEJ5Q2xhc3NlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZVN1YkZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhTdWJGaWx0ZXI6ICh0aGlzLl9pbmRleFN1YkZpbHRlciAmJiB0aGlzLl9tdXJlLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4U3ViRmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlU3ViRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVTdWJGaWx0ZXJzW2F0dHJdID0gdGhpcy5fbXVyZS5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIEdlbmVyaWMgY2FjaGluZyBzdHVmZjsgdGhpcyBpc24ndCBqdXN0IGZvciBwZXJmb3JtYW5jZS4gQ29ubmVjdGVkVGFibGUnc1xuICAgIC8vIGFsZ29yaXRobSByZXF1aXJlcyB0aGF0IGl0cyBwYXJlbnQgdGFibGVzIGhhdmUgcHJlLWJ1aWx0IGluZGV4ZXMgKHdlXG4gICAgLy8gdGVjaG5pY2FsbHkgY291bGQgaW1wbGVtZW50IGl0IGRpZmZlcmVudGx5LCBidXQgaXQgd291bGQgYmUgZXhwZW5zaXZlLFxuICAgIC8vIHJlcXVpcmVzIHRyaWNreSBsb2dpYywgYW5kIHdlJ3JlIGFscmVhZHkgYnVpbGRpbmcgaW5kZXhlcyBmb3Igc29tZSB0YWJsZXNcbiAgICAvLyBsaWtlIEFnZ3JlZ2F0ZWRUYWJsZSBhbnl3YXkpXG4gICAgaWYgKG9wdGlvbnMucmVzZXQpIHtcbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgICAgeWllbGQgKiBPYmplY3QudmFsdWVzKHRoaXMuX2NhY2hlKS5zbGljZSgwLCBsaW1pdCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgeWllbGQgKiBhd2FpdCB0aGlzLl9idWlsZENhY2hlKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQgPT09IHVuZGVmaW5lZCA/IEluZmluaXR5IDogb3B0aW9ucy5saW1pdDtcbiAgICBkZWxldGUgb3B0aW9ucy5saW1pdDtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUob3B0aW9ucyk7XG4gICAgbGV0IGNvbXBsZXRlZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIGl0ZXJhdGlvbiB3YXMgY2FuY2VsbGVkOyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICBjb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSk7XG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt0ZW1wLnZhbHVlLmluZGV4XSA9IHRlbXAudmFsdWU7XG4gICAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjb21wbGV0ZWQpIHtcbiAgICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgZGVsZXRlIHdyYXBwZWRJdGVtLnJvd1thdHRyXTtcbiAgICB9XG4gICAgbGV0IGtlZXAgPSB0cnVlO1xuICAgIGlmICh0aGlzLl9pbmRleFN1YkZpbHRlcikge1xuICAgICAga2VlcCA9IHRoaXMuX2luZGV4U3ViRmlsdGVyKHdyYXBwZWRJdGVtLmluZGV4KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlU3ViRmlsdGVycykpIHtcbiAgICAgIGtlZXAgPSBrZWVwICYmIGZ1bmMod3JhcHBlZEl0ZW0ucm93W2F0dHJdKTtcbiAgICAgIGlmICgha2VlcCkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoa2VlcCkge1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyYXBwZWRJdGVtLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbHRlcicpO1xuICAgIH1cbiAgICByZXR1cm4ga2VlcDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IG90aGVySXRlbSBvZiBvcHRpb25zLml0ZW1zVG9Db25uZWN0IHx8IFtdKSB7XG4gICAgICB3cmFwcGVkSXRlbS5jb25uZWN0SXRlbShvdGhlckl0ZW0pO1xuICAgICAgb3RoZXJJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBmb3IgKGNvbnN0IGRlcml2ZWRUYWJsZSBvZiB0aGlzLmRlcml2ZWRUYWJsZXMpIHtcbiAgICAgIGRlcml2ZWRUYWJsZS5yZXNldCgpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jlc2V0Jyk7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jIGJ1aWxkQ2FjaGUgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fY2FjaGVQcm9taXNlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9jYWNoZVByb21pc2UgPSBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGVtcCBvZiB0aGlzLl9idWlsZENhY2hlKCkpIHt9IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbiAgICAgICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgfVxuICB9XG4gIGFzeW5jIGNvdW50Um93cyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpKS5sZW5ndGg7XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleFN1YkZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIGFkZFN1YkZpbHRlciAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhTdWJGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGVJZCA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZUlkICYmIHRoaXMuX211cmUudGFibGVzW2V4aXN0aW5nVGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgc2hvcnRlc3RQYXRoVG9UYWJsZSAob3RoZXJUYWJsZSkge1xuICAgIC8vIERpamtzdHJhJ3MgYWxnb3JpdGhtLi4uXG4gICAgY29uc3QgdmlzaXRlZCA9IHt9O1xuICAgIGNvbnN0IGRpc3RhbmNlcyA9IHt9O1xuICAgIGNvbnN0IHByZXZUYWJsZXMgPSB7fTtcbiAgICBjb25zdCB2aXNpdCA9IHRhcmdldElkID0+IHtcbiAgICAgIGNvbnN0IHRhcmdldFRhYmxlID0gdGhpcy5fbXVyZS50YWJsZXNbdGFyZ2V0SWRdO1xuICAgICAgLy8gT25seSBjaGVjayB0aGUgdW52aXNpdGVkIGRlcml2ZWQgYW5kIHBhcmVudCB0YWJsZXNcbiAgICAgIGNvbnN0IG5laWdoYm9yTGlzdCA9IE9iamVjdC5rZXlzKHRhcmdldFRhYmxlLl9kZXJpdmVkVGFibGVzKVxuICAgICAgICAuY29uY2F0KHRhcmdldFRhYmxlLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUudGFibGVJZCkpXG4gICAgICAgIC5maWx0ZXIodGFibGVJZCA9PiAhdmlzaXRlZFt0YWJsZUlkXSk7XG4gICAgICAvLyBDaGVjayBhbmQgYXNzaWduIChvciB1cGRhdGUpIHRlbnRhdGl2ZSBkaXN0YW5jZXMgdG8gZWFjaCBuZWlnaGJvclxuICAgICAgZm9yIChjb25zdCBuZWlnaGJvcklkIG9mIG5laWdoYm9yTGlzdCkge1xuICAgICAgICBpZiAoZGlzdGFuY2VzW25laWdoYm9ySWRdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlzdGFuY2VzW3RhcmdldElkXSArIDEgPCBkaXN0YW5jZXNbbmVpZ2hib3JJZF0pIHtcbiAgICAgICAgICBkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPSBkaXN0YW5jZXNbdGFyZ2V0SWRdICsgMTtcbiAgICAgICAgICBwcmV2VGFibGVzW25laWdoYm9ySWRdID0gdGFyZ2V0SWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIHRoaXMgdGFibGUgaXMgb2ZmaWNpYWxseSB2aXNpdGVkOyB0YWtlIGl0IG91dCBvZiB0aGUgcnVubmluZ1xuICAgICAgLy8gZm9yIGZ1dHVyZSB2aXNpdHMgLyBjaGVja3NcbiAgICAgIHZpc2l0ZWRbdGFyZ2V0SWRdID0gdHJ1ZTtcbiAgICAgIGRlbGV0ZSBkaXN0YW5jZXNbdGFyZ2V0SWRdO1xuICAgIH07XG5cbiAgICAvLyBTdGFydCB3aXRoIHRoaXMgdGFibGVcbiAgICBwcmV2VGFibGVzW3RoaXMudGFibGVJZF0gPSBudWxsO1xuICAgIGRpc3RhbmNlc1t0aGlzLnRhYmxlSWRdID0gMDtcbiAgICBsZXQgdG9WaXNpdCA9IE9iamVjdC5rZXlzKGRpc3RhbmNlcyk7XG4gICAgd2hpbGUgKHRvVmlzaXQubGVuZ3RoID4gMCkge1xuICAgICAgLy8gVmlzaXQgdGhlIG5leHQgdGFibGUgdGhhdCBoYXMgdGhlIHNob3J0ZXN0IGRpc3RhbmNlXG4gICAgICB0b1Zpc2l0LnNvcnQoKGEsIGIpID0+IGRpc3RhbmNlc1thXSAtIGRpc3RhbmNlc1tiXSk7XG4gICAgICBsZXQgbmV4dElkID0gdG9WaXNpdC5zaGlmdCgpO1xuICAgICAgaWYgKG5leHRJZCA9PT0gb3RoZXJUYWJsZS50YWJsZUlkKSB7XG4gICAgICAgIC8vIEZvdW5kIG90aGVyVGFibGUhIFNlbmQgYmFjayB0aGUgY2hhaW4gb2YgY29ubmVjdGVkIHRhYmxlc1xuICAgICAgICBjb25zdCBjaGFpbiA9IFtdO1xuICAgICAgICB3aGlsZSAocHJldlRhYmxlc1tuZXh0SWRdICE9PSBudWxsKSB7XG4gICAgICAgICAgY2hhaW4udW5zaGlmdCh0aGlzLl9tdXJlLnRhYmxlc1tuZXh0SWRdKTtcbiAgICAgICAgICBuZXh0SWQgPSBwcmV2VGFibGVzW25leHRJZF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoYWluO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVmlzaXQgdGhlIHRhYmxlXG4gICAgICAgIHZpc2l0KG5leHRJZCk7XG4gICAgICAgIHRvVmlzaXQgPSBPYmplY3Qua2V5cyhkaXN0YW5jZXMpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBXZSBkaWRuJ3QgZmluZCBpdDsgdGhlcmUncyBubyBjb25uZWN0aW9uXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgZGVsaW1pdGVyXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9O1xuICAgICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gaW5kZXhlcy5tYXAoaW5kZXggPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4XG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoeyBsaW1pdCB9KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKHsgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJyB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9tdXJlLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDAgfHwgdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdFRhYmxlO1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aWVyZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBBZ2dyZWdhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLl9kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqYnO1xuICB9XG4gIGRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUgKGF0dHIsIGZ1bmMpIHtcbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfdXBkYXRlSXRlbSAob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHNvIHRoYXQgQWdncmVnYXRlZFRhYmxlIGNhbiB0YWtlIGFkdmFudGFnZVxuICAgIC8vIG9mIHRoZSBwYXJ0aWFsbHktYnVpbHQgY2FjaGUgYXMgaXQgZ29lcywgYW5kIHBvc3Rwb25lIGZpbmlzaGluZyBpdGVtc1xuICAgIC8vIHVudGlsIGFmdGVyIHRoZSBwYXJlbnQgdGFibGUgaGFzIGJlZW4gZnVsbHkgaXRlcmF0ZWRcblxuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuX2l0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt3cmFwcGVkSXRlbS5pbmRleF0gPSB3cmFwcGVkSXRlbTtcbiAgICAgIC8vIEdvIGFoZWFkIGFuZCB5aWVsZCB0aGUgdW5maW5pc2hlZCBpdGVtOyB0aGlzIG1ha2VzIGl0IHBvc3NpYmxlIGZvclxuICAgICAgLy8gY2xpZW50IGFwcHMgdG8gYmUgbW9yZSByZXNwb25zaXZlIGFuZCByZW5kZXIgcGFydGlhbCByZXN1bHRzLCBidXQgYWxzb1xuICAgICAgLy8gbWVhbnMgdGhhdCB0aGV5IG5lZWQgdG8gd2F0Y2ggZm9yIHdyYXBwZWRJdGVtLm9uKCd1cGRhdGUnKSBldmVudHNcbiAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgIH1cblxuICAgIC8vIFNlY29uZCBwYXNzOiBub3cgdGhhdCB3ZSd2ZSBjb21wbGV0ZWQgdGhlIGZ1bGwgaXRlcmF0aW9uIG9mIHRoZSBwYXJlbnRcbiAgICAvLyB0YWJsZSwgd2UgY2FuIGZpbmlzaCBlYWNoIGl0ZW1cbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIHRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgaWYgKCF0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBXZSB3ZXJlIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKGV4aXN0aW5nSXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKG5ld0l0ZW0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHN1cGVyLmdldEF0dHJpYnV0ZURldGFpbHMoKTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ucmVkdWNlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQWdncmVnYXRlZFRhYmxlO1xuIiwiY29uc3QgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuZHVwbGljYXRlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgfVxuICAgIF90b1Jhd09iamVjdCAoKSB7XG4gICAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICAgIG9iai5kdXBsaWNhdGVkQXR0cmlidXRlcyA9IHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgZHVwbGljYXRlQXR0cmlidXRlIChwYXJlbnRJZCwgYXR0cmlidXRlKSB7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gPSB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gfHwgW107XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0ucHVzaChhdHRyaWJ1dGUpO1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBfZHVwbGljYXRlQXR0cmlidXRlcyAod3JhcHBlZEl0ZW0pIHtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgcGFyZW50TmFtZSA9IHRoaXMuX211cmUudGFibGVzW3BhcmVudElkXS5uYW1lO1xuICAgICAgICB3cmFwcGVkSXRlbS5yb3dbYCR7cGFyZW50TmFtZX0uJHthdHRyfWBdID0gd3JhcHBlZEl0ZW0uY29ubmVjdGVkSXRlbXNbcGFyZW50SWRdWzBdLnJvd1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gICAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgICBjb25zdCBhbGxBdHRycyA9IHN1cGVyLmdldEF0dHJpYnV0ZURldGFpbHMoKTtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgYXR0ck5hbWUgPSBgJHt0aGlzLl9tdXJlLnRhYmxlc1twYXJlbnRJZF0ubmFtZX0uJHthdHRyfWA7XG4gICAgICAgIGFsbEF0dHJzW2F0dHJOYW1lXSA9IGFsbEF0dHJzW2F0dHJOYW1lXSB8fCB7IG5hbWU6IGF0dHJOYW1lIH07XG4gICAgICAgIGFsbEF0dHJzW2F0dHJOYW1lXS5jb3BpZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFsbEF0dHJzO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcbmltcG9ydCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gZnJvbSAnLi9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluKFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuZGVsaW1pdGVyID0gb3B0aW9ucy5kZWxpbWl0ZXIgfHwgJywnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpCc7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCB2YWx1ZXMgPSAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSB8fCAnJykuc3BsaXQodGhpcy5kZWxpbWl0ZXIpO1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICAgICAgY29uc3Qgcm93ID0ge307XG4gICAgICAgIHJvd1t0aGlzLl9hdHRyaWJ1dGVdID0gdmFsdWU7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3csXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKG5ld0l0ZW0pO1xuICAgICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYFske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgVHJhbnNwb3NlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuX2luZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouaW5kZXggPSB0aGlzLl9pbmRleDtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYOG1gCR7dGhpcy5faW5kZXh9YDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBhd2FpdCBwYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG5cbiAgICAvLyBJdGVyYXRlIHRoZSByb3cncyBhdHRyaWJ1dGVzIGFzIGluZGV4ZXNcbiAgICBjb25zdCB3cmFwcGVkUGFyZW50ID0gcGFyZW50VGFibGUuX2NhY2hlW3RoaXMuX2luZGV4XSB8fCB7IHJvdzoge30gfTtcbiAgICBmb3IgKGNvbnN0IFsgaW5kZXgsIHZhbHVlIF0gb2YgT2JqZWN0LmVudHJpZXMod3JhcHBlZFBhcmVudC5yb3cpKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICByb3c6IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgPyB2YWx1ZSA6IHsgdmFsdWUgfSxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBUcmFuc3Bvc2VkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIFNwaW4gdGhyb3VnaCBhbGwgb2YgdGhlIHBhcmVudFRhYmxlcyBzbyB0aGF0IHRoZWlyIF9jYWNoZSBpcyBwcmUtYnVpbHRcbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgYXdhaXQgcGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuICAgIH1cbiAgICAvLyBOb3cgdGhhdCB0aGUgY2FjaGVzIGFyZSBidWlsdCwganVzdCBpdGVyYXRlIHRoZWlyIGtleXMgZGlyZWN0bHkuIFdlIG9ubHlcbiAgICAvLyBjYXJlIGFib3V0IGluY2x1ZGluZyByb3dzIHRoYXQgaGF2ZSBleGFjdCBtYXRjaGVzIGFjcm9zcyBhbGwgdGFibGVzLCBzb1xuICAgIC8vIHdlIGNhbiBqdXN0IHBpY2sgb25lIHBhcmVudCB0YWJsZSB0byBpdGVyYXRlXG4gICAgY29uc3QgYmFzZVBhcmVudFRhYmxlID0gcGFyZW50VGFibGVzWzBdO1xuICAgIGNvbnN0IG90aGVyUGFyZW50VGFibGVzID0gcGFyZW50VGFibGVzLnNsaWNlKDEpO1xuICAgIGZvciAoY29uc3QgaW5kZXggaW4gYmFzZVBhcmVudFRhYmxlLl9jYWNoZSkge1xuICAgICAgaWYgKCFwYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlKSkge1xuICAgICAgICAvLyBPbmUgb2YgdGhlIHBhcmVudCB0YWJsZXMgd2FzIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCFvdGhlclBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbaW5kZXhdKSkge1xuICAgICAgICAvLyBObyBtYXRjaCBpbiBvbmUgb2YgdGhlIG90aGVyIHRhYmxlczsgb21pdCB0aGlzIGl0ZW1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPOiBhZGQgZWFjaCBwYXJlbnQgdGFibGVzJyBrZXlzIGFzIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBwYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLl9jYWNoZVtpbmRleF0pXG4gICAgICB9KTtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZUF0dHJpYnV0ZXMobmV3SXRlbSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fbXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5fbXVyZSB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgX211cmUsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9uID0gb3B0aW9ucy5hbm5vdGF0aW9uIHx8ICcnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGNsYXNzTmFtZTogdGhpcy5fY2xhc3NOYW1lLFxuICAgICAgYW5ub3RhdGlvbjogdGhpcy5hbm5vdGF0aW9uXG4gICAgfTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lICE9PSBudWxsO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHwgdGhpcy50YWJsZS5uYW1lO1xuICB9XG4gIGdldEhhc2hUYWJsZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIGF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpO1xuICB9XG4gIGdldCB0YWJsZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RoaXMudGFibGVJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlR2VuZXJpY0NsYXNzIChuZXdUYWJsZSkge1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJ1xuICAgIH0pO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyh0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUsIGRlbGltaXRlcikpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkVHJhbnNwb3NlKGluZGV4ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuVHJhbnNwb3NlKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkcyA9IG9wdGlvbnMuZWRnZUNsYXNzSWRzIHx8IHt9O1xuICAgIHRoaXMuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzID0ge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuZWRnZUNsYXNzSWRzID0gdGhpcy5lZGdlQ2xhc3NJZHM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBhc3luYyBwcmVwU2hvcnRlc3RFZGdlUGF0aCAoZWRnZUNsYXNzSWQpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbZWRnZUNsYXNzSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1tlZGdlQ2xhc3NJZF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGVkZ2VUYWJsZSA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZF0udGFibGU7XG4gICAgICBjb25zdCBpZExpc3QgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGhpcy50YWJsZS5zaG9ydGVzdFBhdGhUb1RhYmxlKGVkZ2VUYWJsZSkpIHtcbiAgICAgICAgaWRMaXN0LnB1c2godGFibGUudGFibGVJZCk7XG4gICAgICAgIC8vIFNwaW4gdGhyb3VnaCB0aGUgdGFibGUgdG8gbWFrZSBzdXJlIGFsbCBpdHMgcm93cyBhcmUgd3JhcHBlZCBhbmQgY29ubmVjdGVkXG4gICAgICAgIGF3YWl0IHRhYmxlLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW2VkZ2VDbGFzc0lkXSA9IGlkTGlzdDtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIC8vIChvciBhIGZsb2F0aW5nIGVkZ2UgaWYgZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgaXMgbnVsbClcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBlZGdlQ2xhc3MuZGlyZWN0ZWQ7XG4gICAgICBlZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgICBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgLy8gRGVsZXRlIGVhY2ggb2YgdGhlIGVkZ2UgY2xhc3Nlc1xuICAgICAgc291cmNlRWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgICAgdGFyZ2V0RWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgIH1cbiAgICB0aGlzLmRlbGV0ZSgpO1xuICAgIGRlbGV0ZSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzSWRzO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGRpcmVjdGVkLCBhdHRyaWJ1dGUsIG90aGVyQXR0cmlidXRlIH0pIHtcbiAgICBjb25zdCB0aGlzSGFzaCA9IHRoaXMuZ2V0SGFzaFRhYmxlKGF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MuZ2V0SGFzaFRhYmxlKG90aGVyQXR0cmlidXRlKTtcbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMuX211cmUuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgZGlyZWN0ZWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3BpY2tFZGdlVGFibGUgKG90aGVyQ2xhc3MpIHtcbiAgICBsZXQgZWRnZVRhYmxlO1xuICAgIGxldCBjaGFpbiA9IHRoaXMudGFibGUuc2hvcnRlc3RQYXRoVG9UYWJsZShvdGhlckNsYXNzLnRhYmxlKTtcbiAgICBpZiAoY2hhaW4gPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5kZXJseWluZyB0YWJsZSBjaGFpbiBiZXR3ZWVuIGVkZ2UgYW5kIG5vZGUgY2xhc3NlcyBpcyBicm9rZW5gKTtcbiAgICB9IGVsc2UgaWYgKGNoYWluLmxlbmd0aCA8PSAyKSB7XG4gICAgICAvLyBXZWlyZCBjb3JuZXIgY2FzZSB3aGVyZSB3ZSdyZSB0cnlpbmcgdG8gY3JlYXRlIGFuIGVkZ2UgYmV0d2VlblxuICAgICAgLy8gYWRqYWNlbnQgb3IgaWRlbnRpY2FsIHRhYmxlcy4uLiBjcmVhdGUgYSBDb25uZWN0ZWRUYWJsZVxuICAgICAgZWRnZVRhYmxlID0gdGhpcy50YWJsZS5jb25uZWN0KG90aGVyQ2xhc3MudGFibGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgYSB0YWJsZSBpbiB0aGUgbWlkZGxlOyBwcmlvcml0aXplIFN0YXRpY1RhYmxlIGFuZCBTdGF0aWNEaWN0VGFibGVcbiAgICAgIGxldCBzdGF0aWNFeGlzdHMgPSBmYWxzZTtcbiAgICAgIGNoYWluID0gY2hhaW4uc2xpY2UoMSwgY2hhaW4ubGVuZ3RoIC0gMSkubWFwKCh0YWJsZSwgZGlzdCkgPT4ge1xuICAgICAgICBzdGF0aWNFeGlzdHMgPSBzdGF0aWNFeGlzdHMgfHwgdGFibGUudHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgcmV0dXJuIHsgdGFibGUsIGRpc3QgfTtcbiAgICAgIH0pO1xuICAgICAgaWYgKHN0YXRpY0V4aXN0cykge1xuICAgICAgICBjaGFpbiA9IGNoYWluLmZpbHRlcigoeyB0YWJsZSB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWRnZVRhYmxlID0gY2hhaW5bMF0udGFibGU7XG4gICAgfVxuICAgIHJldHVybiBlZGdlVGFibGU7XG4gIH1cbiAgYXN5bmMgcHJlcFNob3J0ZXN0U291cmNlUGF0aCAoKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkU2hvcnRlc3RTb3VyY2VQYXRoO1xuICAgIH0gZWxzZSBpZiAodGhpcy5zb3VyY2VDbGFzc0lkID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHNvdXJjZVRhYmxlID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0udGFibGU7XG4gICAgICBjb25zdCBpZExpc3QgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGhpcy50YWJsZS5zaG9ydGVzdFBhdGhUb1RhYmxlKHNvdXJjZVRhYmxlKSkge1xuICAgICAgICBpZExpc3QucHVzaCh0YWJsZS50YWJsZUlkKTtcbiAgICAgICAgLy8gU3BpbiB0aHJvdWdoIHRoZSB0YWJsZSB0byBtYWtlIHN1cmUgYWxsIGl0cyByb3dzIGFyZSB3cmFwcGVkIGFuZCBjb25uZWN0ZWRcbiAgICAgICAgYXdhaXQgdGFibGUuYnVpbGRDYWNoZSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5fY2FjaGVkU2hvcnRlc3RTb3VyY2VQYXRoID0gaWRMaXN0O1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgcHJlcFNob3J0ZXN0VGFyZ2V0UGF0aCAoKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkU2hvcnRlc3RUYXJnZXRQYXRoO1xuICAgIH0gZWxzZSBpZiAodGhpcy50YXJnZXRDbGFzc0lkID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRhcmdldFRhYmxlID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0udGFibGU7XG4gICAgICBjb25zdCBpZExpc3QgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGhpcy50YWJsZS5zaG9ydGVzdFBhdGhUb1RhYmxlKHRhcmdldFRhYmxlKSkge1xuICAgICAgICBpZExpc3QucHVzaCh0YWJsZS50YWJsZUlkKTtcbiAgICAgICAgLy8gU3BpbiB0aHJvdWdoIHRoZSB0YWJsZSB0byBtYWtlIHN1cmUgYWxsIGl0cyByb3dzIGFyZSB3cmFwcGVkIGFuZCBjb25uZWN0ZWRcbiAgICAgICAgYXdhaXQgdGFibGUuYnVpbGRDYWNoZSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5fY2FjaGVkU2hvcnRlc3RUYXJnZXRQYXRoID0gaWRMaXN0O1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aDtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICB0ZW1wLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICBkZWxldGUgdGVtcC5jbGFzc0lkO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMuX211cmUuY3JlYXRlQ2xhc3ModGVtcCk7XG5cbiAgICBpZiAodGVtcC5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgY29uc3QgZWRnZVRhYmxlID0gdGhpcy5fcGlja0VkZ2VUYWJsZShzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZS50YWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IGVkZ2VUYWJsZSA9IHRoaXMuX3BpY2tFZGdlVGFibGUodGFyZ2V0Q2xhc3MpO1xuICAgICAgY29uc3QgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGUudGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiB0ZW1wLnRhcmdldENsYXNzSWRcbiAgICAgIH0pO1xuICAgICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCBkaXJlY3Rpb24sIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSkge1xuICAgIGlmIChkaXJlY3Rpb24pIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoZGlyZWN0aW9uICE9PSAnc291cmNlJyAmJiBkaXJlY3Rpb24gIT09ICd0YXJnZXQnKSB7XG4gICAgICBkaXJlY3Rpb24gPSB0aGlzLnRhcmdldENsYXNzSWQgPT09IG51bGwgPyAndGFyZ2V0JyA6ICdzb3VyY2UnO1xuICAgIH1cbiAgICBpZiAoZGlyZWN0aW9uID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2UoeyBub2RlQ2xhc3MsIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSk7XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICB0b2dnbGVOb2RlRGlyZWN0aW9uIChzb3VyY2VDbGFzc0lkKSB7XG4gICAgaWYgKCFzb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBpZiAoc291cmNlQ2xhc3NJZCAhPT0gdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBzd2FwIHRvIHVuY29ubmVjdGVkIGNsYXNzIGlkOiAke3NvdXJjZUNsYXNzSWR9YCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGNvbm5lY3RTb3VyY2UgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc2tpcFNhdmUgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy5nZXRIYXNoVGFibGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gc291cmNlQ2xhc3MudGFibGUgOiBzb3VyY2VDbGFzcy5nZXRIYXNoVGFibGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKTtcblxuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgY29ubmVjdFRhcmdldCAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbCxcbiAgICBza2lwU2F2ZSA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLmdldEhhc2hUYWJsZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLmdldEhhc2hUYWJsZShub2RlQXR0cmlidXRlKTtcbiAgICBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pO1xuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0U291cmNlICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZXhpc3RpbmdTb3VyY2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1NvdXJjZUNsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdTb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVkU2hvcnRlc3RTb3VyY2VQYXRoO1xuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoeyBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aDtcbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gIH1cbiAgZGlzY29ubmVjdCAoKSB7XG4gICAgZm9yIChjb25zdCBpdGVtTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuY29ubmVjdGVkSXRlbXMpKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbUxpc3QpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSAoaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdIHx8IFtdKS5pbmRleE9mKHRoaXMpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IHt9O1xuICB9XG4gICogaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbdGFibGVJZHNbMF1dIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGhpc1RhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1t0aGlzVGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhyZW1haW5pbmdUYWJsZUlkcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogZWRnZXMgKHsgbGltaXQgPSBJbmZpbml0eSwgZWRnZUlkcyA9IHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzIH0gPSB7fSkge1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKGVkZ2VJZHMpKSB7XG4gICAgICBjb25zdCB0YWJsZUlkQ2hhaW4gPSBhd2FpdCB0aGlzLmNsYXNzT2JqLnByZXBTaG9ydGVzdEVkZ2VQYXRoKGVkZ2VDbGFzc0lkKTtcbiAgICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZENoYWluKTtcbiAgICAgIGxldCB0ZW1wID0gaXRlcmF0b3IubmV4dCgpO1xuICAgICAgd2hpbGUgKCF0ZW1wLmRvbmUgJiYgaSA8IGxpbWl0KSB7XG4gICAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgICAgIGkrKztcbiAgICAgICAgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIH1cbiAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzICh7IGxpbWl0ID0gSW5maW5pdHkgfSA9IHt9KSB7XG4gICAgY29uc3QgdGFibGVJZENoYWluID0gYXdhaXQgdGhpcy5jbGFzc09iai5wcmVwU2hvcnRlc3RTb3VyY2VQYXRoKCk7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkQ2hhaW4pO1xuICAgIGxldCB0ZW1wID0gaXRlcmF0b3IubmV4dCgpO1xuICAgIGxldCBpID0gMDtcbiAgICB3aGlsZSAoIXRlbXAuZG9uZSAmJiBpIDwgbGltaXQpIHtcbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgICBpKys7XG4gICAgICB0ZW1wID0gaXRlcmF0b3IubmV4dCgpO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHRhcmdldE5vZGVzICh7IGxpbWl0ID0gSW5maW5pdHkgfSA9IHt9KSB7XG4gICAgY29uc3QgdGFibGVJZENoYWluID0gYXdhaXQgdGhpcy5jbGFzc09iai5wcmVwU2hvcnRlc3RUYXJnZXRQYXRoKCk7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkQ2hhaW4pO1xuICAgIGxldCB0ZW1wID0gaXRlcmF0b3IubmV4dCgpO1xuICAgIGxldCBpID0gMDtcbiAgICB3aGlsZSAoIXRlbXAuZG9uZSAmJiBpIDwgbGltaXQpIHtcbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgICBpKys7XG4gICAgICB0ZW1wID0gaXRlcmF0b3IubmV4dCgpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICBpZiAodGhpcy5lbnRyaWVzW2hhc2hdLmluZGV4T2YodmFsdWUpID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcbmxldCBORVhUX1RBQkxFX0lEID0gMTtcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRBQkxFUyA9IFRBQkxFUztcbiAgICB0aGlzLkNMQVNTRVMgPSBDTEFTU0VTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcbiAgICB0aGlzLklOREVYRVMgPSBJTkRFWEVTO1xuXG4gICAgLy8gRGVmYXVsdCBuYW1lZCBmdW5jdGlvbnNcbiAgICB0aGlzLk5BTUVEX0ZVTkNUSU9OUyA9IHtcbiAgICAgIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkgeyB5aWVsZCB3cmFwcGVkSXRlbS5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAoIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgICF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBHcmFuZHBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgaWYgKCEocGFyZW50VHlwZSA9PT0gJ251bWJlcicgfHwgcGFyZW50VHlwZSA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyZW50IGlzbid0IGEga2V5IC8gaW5kZXhgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0RmluaXNoOiBmdW5jdGlvbiAqICh0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgeWllbGQge1xuICAgICAgICAgIGxlZnQ6IHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLFxuICAgICAgICAgIHJpZ2h0OiBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW1cbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy50YWJsZXMgPSB0aGlzLmh5ZHJhdGUoJ211cmVfdGFibGVzJywgdGhpcy5UQUJMRVMpO1xuICAgIE5FWFRfVEFCTEVfSUQgPSBPYmplY3Qua2V5cyh0aGlzLnRhYmxlcylcbiAgICAgIC5yZWR1Y2UoKGhpZ2hlc3ROdW0sIHRhYmxlSWQpID0+IHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KGhpZ2hlc3ROdW0sIHBhcnNlSW50KHRhYmxlSWQubWF0Y2goL3RhYmxlKFxcZCopLylbMV0pKTtcbiAgICAgIH0sIDApICsgMTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMuaHlkcmF0ZSgnbXVyZV9jbGFzc2VzJywgdGhpcy5DTEFTU0VTKTtcbiAgICBORVhUX0NMQVNTX0lEID0gT2JqZWN0LmtleXModGhpcy5jbGFzc2VzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgY2xhc3NJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQoY2xhc3NJZC5tYXRjaCgvY2xhc3MoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuICB9XG5cbiAgc2F2ZVRhYmxlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ211cmVfdGFibGVzJywgdGhpcy50YWJsZXMpO1xuICAgIHRoaXMudHJpZ2dlcigndGFibGVVcGRhdGUnKTtcbiAgfVxuICBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ211cmVfY2xhc3NlcycsIHRoaXMuY2xhc3Nlcyk7XG4gICAgdGhpcy50cmlnZ2VyKCdjbGFzc1VwZGF0ZScpO1xuICB9XG5cbiAgaHlkcmF0ZSAoc3RvcmFnZUtleSwgVFlQRVMpIHtcbiAgICBsZXQgY29udGFpbmVyID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShzdG9yYWdlS2V5KTtcbiAgICBjb250YWluZXIgPSBjb250YWluZXIgPyBKU09OLnBhcnNlKGNvbnRhaW5lcikgOiB7fTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb250YWluZXIpKSB7XG4gICAgICBjb25zdCB0eXBlID0gdmFsdWUudHlwZTtcbiAgICAgIGRlbGV0ZSB2YWx1ZS50eXBlO1xuICAgICAgdmFsdWUubXVyZSA9IHRoaXM7XG4gICAgICBjb250YWluZXJba2V5XSA9IG5ldyBUWVBFU1t0eXBlXSh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cbiAgZGVoeWRyYXRlIChzdG9yYWdlS2V5LCBjb250YWluZXIpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlLl90b1Jhd09iamVjdCgpO1xuICAgICAgICByZXN1bHRba2V5XS50eXBlID0gdmFsdWUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oc3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gICAgfVxuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG5cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMudGFibGVJZCkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHtORVhUX1RBQkxFX0lEfWA7XG4gICAgICBORVhUX1RBQkxFX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLlRBQkxFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFR5cGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICBpZiAoIW9wdGlvbnMuY2xhc3NJZCkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLkNMQVNTRVNbb3B0aW9ucy50eXBlXTtcbiAgICBkZWxldGUgb3B0aW9ucy50eXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cblxuICBuZXdUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlT2JqID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGVPYmo7XG4gIH1cbiAgbmV3Q2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdDbGFzc09iaiA9IHRoaXMuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gICAgdGhpcy5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdDbGFzc09iajtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY1RhYmxlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNUYWJsZSgpIGluc3RlYWQuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljVGFibGUoe1xuICAgICAgbmFtZTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljVGFibGUgKHsgbmFtZSwgZXh0ZW5zaW9uID0gJ3R4dCcsIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBkYXRhID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBhdHRyaWJ1dGVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBkYXRhLmNvbHVtbnMpIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgZGF0YS5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY1RhYmxlKHsgbmFtZSwgZGF0YSwgYXR0cmlidXRlcyB9KTtcbiAgfVxuICBhZGRTdGF0aWNUYWJsZSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudHlwZSA9IG9wdGlvbnMuZGF0YSBpbnN0YW5jZW9mIEFycmF5ID8gJ1N0YXRpY1RhYmxlJyA6ICdTdGF0aWNEaWN0VGFibGUnO1xuICAgIGxldCBuZXdUYWJsZSA9IHRoaXMubmV3VGFibGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlQWxsVW51c2VkVGFibGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IHRhYmxlSWQgaW4gdGhpcy50YWJsZXMpIHtcbiAgICAgIGlmICh0aGlzLnRhYmxlc1t0YWJsZUlkXSkge1xuICAgICAgICB0cnkgeyB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTsgfSBjYXRjaCAoZXJyKSB7fVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBkZWxldGVBbGxDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgY2xhc3NPYmouZGVsZXRlKCk7XG4gICAgfVxuICB9XG4gIGdldENsYXNzRGF0YSAoKSB7XG4gICAgY29uc3QgcmVzdWx0cyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICByZXN1bHRzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouY3VycmVudERhdGE7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IEZpbGVSZWFkZXIgZnJvbSAnZmlsZXJlYWRlcic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUoRmlsZVJlYWRlciwgbnVsbCk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJvZmYiLCJpbmRleCIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiZm9yRWFjaCIsInNldFRpbWVvdXQiLCJhcHBseSIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsIk9iamVjdCIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiVGFibGUiLCJvcHRpb25zIiwiX211cmUiLCJtdXJlIiwidGFibGVJZCIsIkVycm9yIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleFN1YkZpbHRlciIsImluZGV4U3ViRmlsdGVyIiwiX2F0dHJpYnV0ZVN1YkZpbHRlcnMiLCJhdHRyaWJ1dGVTdWJGaWx0ZXJzIiwiX3RvUmF3T2JqZWN0IiwicmVzdWx0IiwiX2F0dHJpYnV0ZXMiLCJ1c2VkQnlDbGFzc2VzIiwiX3VzZWRCeUNsYXNzZXMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsImZ1bmMiLCJpdGVyYXRlIiwicmVzZXQiLCJfY2FjaGUiLCJsaW1pdCIsInVuZGVmaW5lZCIsIkluZmluaXR5IiwidmFsdWVzIiwic2xpY2UiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJpdGVyYXRvciIsIl9pdGVyYXRlIiwiY29tcGxldGVkIiwibmV4dCIsImRvbmUiLCJfZmluaXNoSXRlbSIsIndyYXBwZWRJdGVtIiwicm93Iiwia2VlcCIsImRpc2Nvbm5lY3QiLCJfd3JhcCIsInRhYmxlIiwiY2xhc3NPYmoiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwib3RoZXJJdGVtIiwiaXRlbXNUb0Nvbm5lY3QiLCJjb25uZWN0SXRlbSIsImRlcml2ZWRUYWJsZSIsIm5hbWUiLCJidWlsZENhY2hlIiwiX2NhY2hlUHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY291bnRSb3dzIiwia2V5cyIsImxlbmd0aCIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImNvbXBsZXRlIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRTdWJGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwic2F2ZVRhYmxlcyIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZUlkIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJ0YWJsZXMiLCJzaG9ydGVzdFBhdGhUb1RhYmxlIiwib3RoZXJUYWJsZSIsInZpc2l0ZWQiLCJkaXN0YW5jZXMiLCJwcmV2VGFibGVzIiwidmlzaXQiLCJ0YXJnZXRJZCIsInRhcmdldFRhYmxlIiwibmVpZ2hib3JMaXN0IiwiY29uY2F0IiwicGFyZW50VGFibGVzIiwibWFwIiwicGFyZW50VGFibGUiLCJmaWx0ZXIiLCJuZWlnaGJvcklkIiwidG9WaXNpdCIsInNvcnQiLCJhIiwiYiIsIm5leHRJZCIsInNoaWZ0IiwiY2hhaW4iLCJ1bnNoaWZ0IiwiYWdncmVnYXRlIiwiZXhwYW5kIiwiZGVsaW1pdGVyIiwiY2xvc2VkRmFjZXQiLCJvcGVuRmFjZXQiLCJjbG9zZWRUcmFuc3Bvc2UiLCJpbmRleGVzIiwib3BlblRyYW5zcG9zZSIsImNvbm5lY3QiLCJvdGhlclRhYmxlTGlzdCIsImNsYXNzZXMiLCJyZWR1Y2UiLCJhZ2ciLCJkZWxldGUiLCJleGVjIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiaXRlbSIsIlN0YXRpY0RpY3RUYWJsZSIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIkFnZ3JlZ2F0ZWRUYWJsZSIsIl9hdHRyaWJ1dGUiLCJfcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIiwicmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIiwiX2RlaHlkcmF0ZUZ1bmN0aW9uIiwiZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSIsIl91cGRhdGVJdGVtIiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsIm5ld1dyYXBwZWRJdGVtIiwid3JhcHBlZFBhcmVudCIsImV4aXN0aW5nSXRlbSIsIm5ld0l0ZW0iLCJyZWR1Y2VkIiwiRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIiwiX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfZHVwbGljYXRlZEF0dHJpYnV0ZXMiLCJkdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZUF0dHJpYnV0ZSIsInBhcmVudElkIiwiX2R1cGxpY2F0ZUF0dHJpYnV0ZXMiLCJwYXJlbnROYW1lIiwiY29ubmVjdGVkSXRlbXMiLCJhdHRyTmFtZSIsImNvcGllZCIsIkV4cGFuZGVkVGFibGUiLCJzcGxpdCIsIkZhY2V0ZWRUYWJsZSIsIl92YWx1ZSIsIlRyYW5zcG9zZWRUYWJsZSIsIl9pbmRleCIsIkNvbm5lY3RlZFRhYmxlIiwiam9pbiIsImJhc2VQYXJlbnRUYWJsZSIsIm90aGVyUGFyZW50VGFibGVzIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9jbGFzc05hbWUiLCJjbGFzc05hbWUiLCJhbm5vdGF0aW9uIiwic2V0Q2xhc3NOYW1lIiwic2F2ZUNsYXNzZXMiLCJoYXNDdXN0b21OYW1lIiwiZ2V0SGFzaFRhYmxlIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm5ld0NsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIl9kZXJpdmVHZW5lcmljQ2xhc3MiLCJOb2RlQ2xhc3MiLCJlZGdlQ2xhc3NJZHMiLCJfY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHMiLCJOb2RlV3JhcHBlciIsInByZXBTaG9ydGVzdEVkZ2VQYXRoIiwiZWRnZUNsYXNzSWQiLCJlZGdlVGFibGUiLCJpZExpc3QiLCJkaXNjb25uZWN0QWxsRWRnZXMiLCJlZGdlQ2xhc3MiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsImRpcmVjdGVkIiwic291cmNlRWRnZUNsYXNzIiwidGFyZ2V0RWRnZUNsYXNzIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJuZXdFZGdlQ2xhc3MiLCJjcmVhdGVDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5vZGVDbGFzcyIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0IiwiRWRnZUNsYXNzIiwiRWRnZVdyYXBwZXIiLCJfcGlja0VkZ2VUYWJsZSIsIm90aGVyQ2xhc3MiLCJzdGF0aWNFeGlzdHMiLCJkaXN0Iiwic3RhcnRzV2l0aCIsInByZXBTaG9ydGVzdFNvdXJjZVBhdGgiLCJfY2FjaGVkU2hvcnRlc3RTb3VyY2VQYXRoIiwic291cmNlVGFibGUiLCJwcmVwU2hvcnRlc3RUYXJnZXRQYXRoIiwiX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aCIsIm5ld05vZGVDbGFzcyIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJkaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImNvbm5lY3RUYXJnZXQiLCJjb25uZWN0U291cmNlIiwidG9nZ2xlTm9kZURpcmVjdGlvbiIsInNraXBTYXZlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwiaXRlbUxpc3QiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsInRoaXNUYWJsZUlkIiwicmVtYWluaW5nVGFibGVJZHMiLCJlZGdlcyIsImVkZ2VJZHMiLCJ0YWJsZUlkQ2hhaW4iLCJzb3VyY2VOb2RlcyIsInRhcmdldE5vZGVzIiwiSW5NZW1vcnlJbmRleCIsInRvUmF3T2JqZWN0IiwiaXRlckVudHJpZXMiLCJoYXNoIiwidmFsdWVMaXN0IiwiaXRlckhhc2hlcyIsIml0ZXJWYWx1ZUxpc3RzIiwiZ2V0VmFsdWVMaXN0IiwiYWRkVmFsdWUiLCJORVhUX0NMQVNTX0lEIiwiTkVYVF9UQUJMRV9JRCIsIk11cmUiLCJGaWxlUmVhZGVyIiwibG9jYWxTdG9yYWdlIiwibWltZSIsImRlYnVnIiwiREFUQUxJQl9GT1JNQVRTIiwiVEFCTEVTIiwiQ0xBU1NFUyIsIklOREVYRVMiLCJOQU1FRF9GVU5DVElPTlMiLCJpZGVudGl0eSIsInJhd0l0ZW0iLCJrZXkiLCJUeXBlRXJyb3IiLCJwYXJlbnRUeXBlIiwiZGVmYXVsdEZpbmlzaCIsInRoaXNXcmFwcGVkSXRlbSIsIm90aGVyV3JhcHBlZEl0ZW0iLCJsZWZ0IiwicmlnaHQiLCJzaGExIiwiSlNPTiIsInN0cmluZ2lmeSIsIm5vb3AiLCJoeWRyYXRlIiwiaGlnaGVzdE51bSIsIk1hdGgiLCJtYXgiLCJwYXJzZUludCIsIm1hdGNoIiwiZGVoeWRyYXRlIiwic3RvcmFnZUtleSIsIlRZUEVTIiwiY29udGFpbmVyIiwiZ2V0SXRlbSIsInBhcnNlIiwic2V0SXRlbSIsIkZ1bmN0aW9uIiwidG9TdHJpbmciLCJUeXBlIiwic2VsZWN0b3IiLCJuZXdUYWJsZU9iaiIsIm5ld0NsYXNzT2JqIiwiYWRkRmlsZUFzU3RhdGljVGFibGUiLCJmaWxlT2JqIiwiZW5jb2RpbmciLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsImNvbnNvbGUiLCJ3YXJuIiwidGV4dCIsInJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJhZGRTdHJpbmdBc1N0YXRpY1RhYmxlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJBcnJheSIsImRlbGV0ZUFsbFVudXNlZFRhYmxlcyIsImVyciIsImRlbGV0ZUFsbENsYXNzZXMiLCJnZXRDbGFzc0RhdGEiLCJyZXN1bHRzIiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLEdBQUk7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGFBQUwsR0FBcUIsRUFBckI7V0FDS0MsY0FBTCxHQUFzQixFQUF0Qjs7O0lBRUZDLEVBQUUsQ0FBRUMsU0FBRixFQUFhQyxRQUFiLEVBQXVCQyx1QkFBdkIsRUFBZ0Q7VUFDNUMsQ0FBQyxLQUFLTCxhQUFMLENBQW1CRyxTQUFuQixDQUFMLEVBQW9DO2FBQzdCSCxhQUFMLENBQW1CRyxTQUFuQixJQUFnQyxFQUFoQzs7O1VBRUUsQ0FBQ0UsdUJBQUwsRUFBOEI7WUFDeEIsS0FBS0wsYUFBTCxDQUFtQkcsU0FBbkIsRUFBOEJHLE9BQTlCLENBQXNDRixRQUF0QyxNQUFvRCxDQUFDLENBQXpELEVBQTREOzs7OztXQUl6REosYUFBTCxDQUFtQkcsU0FBbkIsRUFBOEJJLElBQTlCLENBQW1DSCxRQUFuQzs7O0lBRUZJLEdBQUcsQ0FBRUwsU0FBRixFQUFhQyxRQUFiLEVBQXVCO1VBQ3BCLEtBQUtKLGFBQUwsQ0FBbUJHLFNBQW5CLENBQUosRUFBbUM7WUFDN0IsQ0FBQ0MsUUFBTCxFQUFlO2lCQUNOLEtBQUtKLGFBQUwsQ0FBbUJHLFNBQW5CLENBQVA7U0FERixNQUVPO2NBQ0RNLEtBQUssR0FBRyxLQUFLVCxhQUFMLENBQW1CRyxTQUFuQixFQUE4QkcsT0FBOUIsQ0FBc0NGLFFBQXRDLENBQVo7O2NBQ0lLLEtBQUssSUFBSSxDQUFiLEVBQWdCO2lCQUNUVCxhQUFMLENBQW1CRyxTQUFuQixFQUE4Qk8sTUFBOUIsQ0FBcUNELEtBQXJDLEVBQTRDLENBQTVDOzs7Ozs7SUFLUkUsT0FBTyxDQUFFUixTQUFGLEVBQWEsR0FBR1MsSUFBaEIsRUFBc0I7VUFDdkIsS0FBS1osYUFBTCxDQUFtQkcsU0FBbkIsQ0FBSixFQUFtQzthQUM1QkgsYUFBTCxDQUFtQkcsU0FBbkIsRUFBOEJVLE9BQTlCLENBQXNDVCxRQUFRLElBQUk7VUFDaERVLFVBQVUsQ0FBQyxNQUFNOztZQUNmVixRQUFRLENBQUNXLEtBQVQsQ0FBZSxJQUFmLEVBQXFCSCxJQUFyQjtXQURRLEVBRVAsQ0FGTyxDQUFWO1NBREY7Ozs7SUFPSkksYUFBYSxDQUFFYixTQUFGLEVBQWFjLE1BQWIsRUFBcUJDLEtBQUssR0FBRyxFQUE3QixFQUFpQztXQUN2Q2pCLGNBQUwsQ0FBb0JFLFNBQXBCLElBQWlDLEtBQUtGLGNBQUwsQ0FBb0JFLFNBQXBCLEtBQWtDO1FBQUVjLE1BQU0sRUFBRTtPQUE3RTtNQUNBRSxNQUFNLENBQUNDLE1BQVAsQ0FBYyxLQUFLbkIsY0FBTCxDQUFvQkUsU0FBcEIsRUFBK0JjLE1BQTdDLEVBQXFEQSxNQUFyRDtNQUNBSSxZQUFZLENBQUMsS0FBS3BCLGNBQUwsQ0FBb0JxQixPQUFyQixDQUFaO1dBQ0tyQixjQUFMLENBQW9CcUIsT0FBcEIsR0FBOEJSLFVBQVUsQ0FBQyxNQUFNO1lBQ3pDRyxNQUFNLEdBQUcsS0FBS2hCLGNBQUwsQ0FBb0JFLFNBQXBCLEVBQStCYyxNQUE1QztlQUNPLEtBQUtoQixjQUFMLENBQW9CRSxTQUFwQixDQUFQO2FBQ0tRLE9BQUwsQ0FBYVIsU0FBYixFQUF3QmMsTUFBeEI7T0FIc0MsRUFJckNDLEtBSnFDLENBQXhDOzs7R0EzQ0o7Q0FERjs7QUFvREFDLE1BQU0sQ0FBQ0ksY0FBUCxDQUFzQjVCLGdCQUF0QixFQUF3QzZCLE1BQU0sQ0FBQ0MsV0FBL0MsRUFBNEQ7RUFDMURDLEtBQUssRUFBRUMsQ0FBQyxJQUFJLENBQUMsQ0FBQ0EsQ0FBQyxDQUFDNUI7Q0FEbEI7O0FDcERBLE1BQU02QixjQUFOLENBQXFCO01BQ2ZDLElBQUosR0FBWTtXQUNILEtBQUtoQyxXQUFMLENBQWlCZ0MsSUFBeEI7OztNQUVFQyxrQkFBSixHQUEwQjtXQUNqQixLQUFLakMsV0FBTCxDQUFpQmlDLGtCQUF4Qjs7O01BRUVDLGlCQUFKLEdBQXlCO1dBQ2hCLEtBQUtsQyxXQUFMLENBQWlCa0MsaUJBQXhCOzs7OztBQUdKWixNQUFNLENBQUNJLGNBQVAsQ0FBc0JLLGNBQXRCLEVBQXNDLE1BQXRDLEVBQThDOzs7RUFHNUNJLFlBQVksRUFBRSxJQUg4Qjs7RUFJNUNDLEdBQUcsR0FBSTtXQUFTLEtBQUtKLElBQVo7OztDQUpYO0FBTUFWLE1BQU0sQ0FBQ0ksY0FBUCxDQUFzQkssY0FBdEIsRUFBc0Msb0JBQXRDLEVBQTREO0VBQzFESyxHQUFHLEdBQUk7VUFDQ0MsSUFBSSxHQUFHLEtBQUtMLElBQWxCO1dBQ09LLElBQUksQ0FBQ0MsT0FBTCxDQUFhLEdBQWIsRUFBa0JELElBQUksQ0FBQyxDQUFELENBQUosQ0FBUUUsaUJBQVIsRUFBbEIsQ0FBUDs7O0NBSEo7QUFNQWpCLE1BQU0sQ0FBQ0ksY0FBUCxDQUFzQkssY0FBdEIsRUFBc0MsbUJBQXRDLEVBQTJEO0VBQ3pESyxHQUFHLEdBQUk7O1dBRUUsS0FBS0osSUFBTCxDQUFVTSxPQUFWLENBQWtCLGlCQUFsQixFQUFxQyxPQUFyQyxDQUFQOzs7Q0FISjs7QUNwQkEsTUFBTUUsS0FBTixTQUFvQjFDLGdCQUFnQixDQUFDaUMsY0FBRCxDQUFwQyxDQUFxRDtFQUNuRC9CLFdBQVcsQ0FBRXlDLE9BQUYsRUFBVzs7U0FFZkMsS0FBTCxHQUFhRCxPQUFPLENBQUNFLElBQXJCO1NBQ0tDLE9BQUwsR0FBZUgsT0FBTyxDQUFDRyxPQUF2Qjs7UUFDSSxDQUFDLEtBQUtGLEtBQU4sSUFBZSxDQUFDLEtBQUtFLE9BQXpCLEVBQWtDO1lBQzFCLElBQUlDLEtBQUosQ0FBVywrQkFBWCxDQUFOOzs7U0FHR0MsbUJBQUwsR0FBMkJMLE9BQU8sQ0FBQ00sVUFBUixJQUFzQixFQUFqRDtTQUNLQyxtQkFBTCxHQUEyQixFQUEzQjtTQUVLQyxjQUFMLEdBQXNCUixPQUFPLENBQUNTLGFBQVIsSUFBeUIsRUFBL0M7U0FFS0MsMEJBQUwsR0FBa0MsRUFBbEM7O1NBQ0ssTUFBTSxDQUFDQyxJQUFELEVBQU9DLGVBQVAsQ0FBWCxJQUFzQy9CLE1BQU0sQ0FBQ2dDLE9BQVAsQ0FBZWIsT0FBTyxDQUFDYyx5QkFBUixJQUFxQyxFQUFwRCxDQUF0QyxFQUErRjtXQUN4RkosMEJBQUwsQ0FBZ0NDLElBQWhDLElBQXdDLEtBQUtWLEtBQUwsQ0FBV2MsZUFBWCxDQUEyQkgsZUFBM0IsQ0FBeEM7OztTQUdHSSxxQkFBTCxHQUE2QmhCLE9BQU8sQ0FBQ2lCLG9CQUFSLElBQWdDLEVBQTdEO1NBQ0tDLGNBQUwsR0FBc0IsQ0FBQyxDQUFDbEIsT0FBTyxDQUFDbUIsYUFBaEM7U0FFS0MsZUFBTCxHQUF3QnBCLE9BQU8sQ0FBQ3FCLGNBQVIsSUFBMEIsS0FBS3BCLEtBQUwsQ0FBV2MsZUFBWCxDQUEyQmYsT0FBTyxDQUFDcUIsY0FBbkMsQ0FBM0IsSUFBa0YsSUFBekc7U0FDS0Msb0JBQUwsR0FBNEIsRUFBNUI7O1NBQ0ssTUFBTSxDQUFDWCxJQUFELEVBQU9DLGVBQVAsQ0FBWCxJQUFzQy9CLE1BQU0sQ0FBQ2dDLE9BQVAsQ0FBZWIsT0FBTyxDQUFDdUIsbUJBQVIsSUFBK0IsRUFBOUMsQ0FBdEMsRUFBeUY7V0FDbEZELG9CQUFMLENBQTBCWCxJQUExQixJQUFrQyxLQUFLVixLQUFMLENBQVdjLGVBQVgsQ0FBMkJILGVBQTNCLENBQWxDOzs7O0VBR0pZLFlBQVksR0FBSTtVQUNSQyxNQUFNLEdBQUc7TUFDYnRCLE9BQU8sRUFBRSxLQUFLQSxPQUREO01BRWJHLFVBQVUsRUFBRSxLQUFLb0IsV0FGSjtNQUdiakIsYUFBYSxFQUFFLEtBQUtELGNBSFA7TUFJYm1CLGFBQWEsRUFBRSxLQUFLQyxjQUpQO01BS2JkLHlCQUF5QixFQUFFLEVBTGQ7TUFNYkcsb0JBQW9CLEVBQUUsS0FBS0QscUJBTmQ7TUFPYkcsYUFBYSxFQUFFLEtBQUtELGNBUFA7TUFRYkssbUJBQW1CLEVBQUUsRUFSUjtNQVNiRixjQUFjLEVBQUcsS0FBS0QsZUFBTCxJQUF3QixLQUFLbkIsS0FBTCxDQUFXNEIsaUJBQVgsQ0FBNkIsS0FBS1QsZUFBbEMsQ0FBekIsSUFBZ0Y7S0FUbEc7O1NBV0ssTUFBTSxDQUFDVCxJQUFELEVBQU9tQixJQUFQLENBQVgsSUFBMkJqRCxNQUFNLENBQUNnQyxPQUFQLENBQWUsS0FBS0gsMEJBQXBCLENBQTNCLEVBQTRFO01BQzFFZSxNQUFNLENBQUNYLHlCQUFQLENBQWlDSCxJQUFqQyxJQUF5QyxLQUFLVixLQUFMLENBQVc0QixpQkFBWCxDQUE2QkMsSUFBN0IsQ0FBekM7OztTQUVHLE1BQU0sQ0FBQ25CLElBQUQsRUFBT21CLElBQVAsQ0FBWCxJQUEyQmpELE1BQU0sQ0FBQ2dDLE9BQVAsQ0FBZSxLQUFLUyxvQkFBcEIsQ0FBM0IsRUFBc0U7TUFDcEVHLE1BQU0sQ0FBQ0YsbUJBQVAsQ0FBMkJaLElBQTNCLElBQW1DLEtBQUtWLEtBQUwsQ0FBVzRCLGlCQUFYLENBQTZCQyxJQUE3QixDQUFuQzs7O1dBRUtMLE1BQVA7OztTQUVNTSxPQUFSLENBQWlCL0IsT0FBTyxHQUFHLEVBQTNCLEVBQStCOzs7Ozs7UUFNekJBLE9BQU8sQ0FBQ2dDLEtBQVosRUFBbUI7V0FDWkEsS0FBTDs7O1FBR0UsS0FBS0MsTUFBVCxFQUFpQjtZQUNUQyxLQUFLLEdBQUdsQyxPQUFPLENBQUNrQyxLQUFSLEtBQWtCQyxTQUFsQixHQUE4QkMsUUFBOUIsR0FBeUNwQyxPQUFPLENBQUNrQyxLQUEvRDthQUNRckQsTUFBTSxDQUFDd0QsTUFBUCxDQUFjLEtBQUtKLE1BQW5CLEVBQTJCSyxLQUEzQixDQUFpQyxDQUFqQyxFQUFvQ0osS0FBcEMsQ0FBUjs7OztXQUlNLE1BQU0sS0FBS0ssV0FBTCxDQUFpQnZDLE9BQWpCLENBQWQ7OztTQUVNdUMsV0FBUixDQUFxQnZDLE9BQU8sR0FBRyxFQUEvQixFQUFtQzs7O1NBRzVCd0MsYUFBTCxHQUFxQixFQUFyQjtVQUNNTixLQUFLLEdBQUdsQyxPQUFPLENBQUNrQyxLQUFSLEtBQWtCQyxTQUFsQixHQUE4QkMsUUFBOUIsR0FBeUNwQyxPQUFPLENBQUNrQyxLQUEvRDtXQUNPbEMsT0FBTyxDQUFDa0MsS0FBZjs7VUFDTU8sUUFBUSxHQUFHLEtBQUtDLFFBQUwsQ0FBYzFDLE9BQWQsQ0FBakI7O1FBQ0kyQyxTQUFTLEdBQUcsS0FBaEI7O1NBQ0ssSUFBSXRELENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUc2QyxLQUFwQixFQUEyQjdDLENBQUMsRUFBNUIsRUFBZ0M7WUFDeEJPLElBQUksR0FBRyxNQUFNNkMsUUFBUSxDQUFDRyxJQUFULEVBQW5COztVQUNJLENBQUMsS0FBS0osYUFBVixFQUF5Qjs7Ozs7VUFJckI1QyxJQUFJLENBQUNpRCxJQUFULEVBQWU7UUFDYkYsU0FBUyxHQUFHLElBQVo7O09BREYsTUFHTzthQUNBRyxXQUFMLENBQWlCbEQsSUFBSSxDQUFDUixLQUF0Qjs7YUFDS29ELGFBQUwsQ0FBbUI1QyxJQUFJLENBQUNSLEtBQUwsQ0FBV2pCLEtBQTlCLElBQXVDeUIsSUFBSSxDQUFDUixLQUE1QztjQUNNUSxJQUFJLENBQUNSLEtBQVg7Ozs7UUFHQXVELFNBQUosRUFBZTtXQUNSVixNQUFMLEdBQWMsS0FBS08sYUFBbkI7OztXQUVLLEtBQUtBLGFBQVo7OztTQUVNRSxRQUFSLENBQWtCMUMsT0FBbEIsRUFBMkI7VUFDbkIsSUFBSUksS0FBSixDQUFXLG9DQUFYLENBQU47OztFQUVGMEMsV0FBVyxDQUFFQyxXQUFGLEVBQWU7U0FDbkIsTUFBTSxDQUFDcEMsSUFBRCxFQUFPbUIsSUFBUCxDQUFYLElBQTJCakQsTUFBTSxDQUFDZ0MsT0FBUCxDQUFlLEtBQUtILDBCQUFwQixDQUEzQixFQUE0RTtNQUMxRXFDLFdBQVcsQ0FBQ0MsR0FBWixDQUFnQnJDLElBQWhCLElBQXdCbUIsSUFBSSxDQUFDaUIsV0FBRCxDQUE1Qjs7O1NBRUcsTUFBTXBDLElBQVgsSUFBbUJvQyxXQUFXLENBQUNDLEdBQS9CLEVBQW9DO1dBQzdCekMsbUJBQUwsQ0FBeUJJLElBQXpCLElBQWlDLElBQWpDOzs7U0FFRyxNQUFNQSxJQUFYLElBQW1CLEtBQUtLLHFCQUF4QixFQUErQzthQUN0QytCLFdBQVcsQ0FBQ0MsR0FBWixDQUFnQnJDLElBQWhCLENBQVA7OztRQUVFc0MsSUFBSSxHQUFHLElBQVg7O1FBQ0ksS0FBSzdCLGVBQVQsRUFBMEI7TUFDeEI2QixJQUFJLEdBQUcsS0FBSzdCLGVBQUwsQ0FBcUIyQixXQUFXLENBQUM1RSxLQUFqQyxDQUFQOzs7U0FFRyxNQUFNLENBQUN3QyxJQUFELEVBQU9tQixJQUFQLENBQVgsSUFBMkJqRCxNQUFNLENBQUNnQyxPQUFQLENBQWUsS0FBS1Msb0JBQXBCLENBQTNCLEVBQXNFO01BQ3BFMkIsSUFBSSxHQUFHQSxJQUFJLElBQUluQixJQUFJLENBQUNpQixXQUFXLENBQUNDLEdBQVosQ0FBZ0JyQyxJQUFoQixDQUFELENBQW5COztVQUNJLENBQUNzQyxJQUFMLEVBQVc7Ozs7O1FBRVRBLElBQUosRUFBVTtNQUNSRixXQUFXLENBQUMxRSxPQUFaLENBQW9CLFFBQXBCO0tBREYsTUFFTztNQUNMMEUsV0FBVyxDQUFDRyxVQUFaO01BQ0FILFdBQVcsQ0FBQzFFLE9BQVosQ0FBb0IsUUFBcEI7OztXQUVLNEUsSUFBUDs7O0VBRUZFLEtBQUssQ0FBRW5ELE9BQUYsRUFBVztJQUNkQSxPQUFPLENBQUNvRCxLQUFSLEdBQWdCLElBQWhCO1VBQ01DLFFBQVEsR0FBRyxLQUFLQSxRQUF0QjtVQUNNTixXQUFXLEdBQUdNLFFBQVEsR0FBR0EsUUFBUSxDQUFDRixLQUFULENBQWVuRCxPQUFmLENBQUgsR0FBNkIsSUFBSSxLQUFLQyxLQUFMLENBQVdxRCxRQUFYLENBQW9CQyxjQUF4QixDQUF1Q3ZELE9BQXZDLENBQXpEOztTQUNLLE1BQU13RCxTQUFYLElBQXdCeEQsT0FBTyxDQUFDeUQsY0FBUixJQUEwQixFQUFsRCxFQUFzRDtNQUNwRFYsV0FBVyxDQUFDVyxXQUFaLENBQXdCRixTQUF4QjtNQUNBQSxTQUFTLENBQUNFLFdBQVYsQ0FBc0JYLFdBQXRCOzs7V0FFS0EsV0FBUDs7O0VBRUZmLEtBQUssR0FBSTtXQUNBLEtBQUtRLGFBQVo7V0FDTyxLQUFLUCxNQUFaOztTQUNLLE1BQU0wQixZQUFYLElBQTJCLEtBQUtsRCxhQUFoQyxFQUErQztNQUM3Q2tELFlBQVksQ0FBQzNCLEtBQWI7OztTQUVHM0QsT0FBTCxDQUFhLE9BQWI7OztNQUVFdUYsSUFBSixHQUFZO1VBQ0osSUFBSXhELEtBQUosQ0FBVyxvQ0FBWCxDQUFOOzs7UUFFSXlELFVBQU4sR0FBb0I7UUFDZCxLQUFLNUIsTUFBVCxFQUFpQjthQUNSLEtBQUtBLE1BQVo7S0FERixNQUVPLElBQUksS0FBSzZCLGFBQVQsRUFBd0I7YUFDdEIsS0FBS0EsYUFBWjtLQURLLE1BRUE7V0FDQUEsYUFBTCxHQUFxQixJQUFJQyxPQUFKLENBQVksT0FBT0MsT0FBUCxFQUFnQkMsTUFBaEIsS0FBMkI7bUJBQy9DLE1BQU1yRSxJQUFqQixJQUF5QixLQUFLMkMsV0FBTCxFQUF6QixFQUE2QyxFQURhOzs7ZUFFbkQsS0FBS3VCLGFBQVo7UUFDQUUsT0FBTyxDQUFDLEtBQUsvQixNQUFOLENBQVA7T0FIbUIsQ0FBckI7YUFLTyxLQUFLNkIsYUFBWjs7OztRQUdFSSxTQUFOLEdBQW1CO1dBQ1ZyRixNQUFNLENBQUNzRixJQUFQLEVBQVksTUFBTSxLQUFLTixVQUFMLEVBQWxCLEdBQXFDTyxNQUE1Qzs7O0VBRUZDLGVBQWUsR0FBSTtVQUNYQyxPQUFPLEdBQUc7TUFBRVYsSUFBSSxFQUFFO0tBQXhCOztRQUNJLEtBQUsxQyxjQUFULEVBQXlCO01BQ3ZCb0QsT0FBTyxDQUFDQyxVQUFSLEdBQXFCLElBQXJCOzs7UUFFRSxLQUFLbkQsZUFBVCxFQUEwQjtNQUN4QmtELE9BQU8sQ0FBQ0UsUUFBUixHQUFtQixJQUFuQjs7O1dBRUtGLE9BQVA7OztFQUVGRyxtQkFBbUIsR0FBSTtVQUNmQyxRQUFRLEdBQUcsRUFBakI7O1NBQ0ssTUFBTS9ELElBQVgsSUFBbUIsS0FBS04sbUJBQXhCLEVBQTZDO01BQzNDcUUsUUFBUSxDQUFDL0QsSUFBRCxDQUFSLEdBQWlCK0QsUUFBUSxDQUFDL0QsSUFBRCxDQUFSLElBQWtCO1FBQUVpRCxJQUFJLEVBQUVqRDtPQUEzQztNQUNBK0QsUUFBUSxDQUFDL0QsSUFBRCxDQUFSLENBQWVnRSxRQUFmLEdBQTBCLElBQTFCOzs7U0FFRyxNQUFNaEUsSUFBWCxJQUFtQixLQUFLSixtQkFBeEIsRUFBNkM7TUFDM0NtRSxRQUFRLENBQUMvRCxJQUFELENBQVIsR0FBaUIrRCxRQUFRLENBQUMvRCxJQUFELENBQVIsSUFBa0I7UUFBRWlELElBQUksRUFBRWpEO09BQTNDO01BQ0ErRCxRQUFRLENBQUMvRCxJQUFELENBQVIsQ0FBZWlFLFFBQWYsR0FBMEIsSUFBMUI7OztTQUVHLE1BQU1qRSxJQUFYLElBQW1CLEtBQUtELDBCQUF4QixFQUFvRDtNQUNsRGdFLFFBQVEsQ0FBQy9ELElBQUQsQ0FBUixHQUFpQitELFFBQVEsQ0FBQy9ELElBQUQsQ0FBUixJQUFrQjtRQUFFaUQsSUFBSSxFQUFFakQ7T0FBM0M7TUFDQStELFFBQVEsQ0FBQy9ELElBQUQsQ0FBUixDQUFla0UsT0FBZixHQUF5QixJQUF6Qjs7O1NBRUcsTUFBTWxFLElBQVgsSUFBbUIsS0FBS0sscUJBQXhCLEVBQStDO01BQzdDMEQsUUFBUSxDQUFDL0QsSUFBRCxDQUFSLEdBQWlCK0QsUUFBUSxDQUFDL0QsSUFBRCxDQUFSLElBQWtCO1FBQUVpRCxJQUFJLEVBQUVqRDtPQUEzQztNQUNBK0QsUUFBUSxDQUFDL0QsSUFBRCxDQUFSLENBQWU0RCxVQUFmLEdBQTRCLElBQTVCOzs7U0FFRyxNQUFNNUQsSUFBWCxJQUFtQixLQUFLVyxvQkFBeEIsRUFBOEM7TUFDNUNvRCxRQUFRLENBQUMvRCxJQUFELENBQVIsR0FBaUIrRCxRQUFRLENBQUMvRCxJQUFELENBQVIsSUFBa0I7UUFBRWlELElBQUksRUFBRWpEO09BQTNDO01BQ0ErRCxRQUFRLENBQUMvRCxJQUFELENBQVIsQ0FBZTZELFFBQWYsR0FBMEIsSUFBMUI7OztXQUVLRSxRQUFQOzs7TUFFRXBFLFVBQUosR0FBa0I7V0FDVHpCLE1BQU0sQ0FBQ3NGLElBQVAsQ0FBWSxLQUFLTSxtQkFBTCxFQUFaLENBQVA7OztNQUVFSyxXQUFKLEdBQW1CO1dBQ1Y7TUFDTEMsSUFBSSxFQUFFLEtBQUs5QyxNQUFMLElBQWUsS0FBS08sYUFBcEIsSUFBcUMsRUFEdEM7TUFFTHdDLFFBQVEsRUFBRSxDQUFDLENBQUMsS0FBSy9DO0tBRm5COzs7RUFLRmdELGVBQWUsQ0FBRUMsU0FBRixFQUFhcEQsSUFBYixFQUFtQjtTQUMzQnBCLDBCQUFMLENBQWdDd0UsU0FBaEMsSUFBNkNwRCxJQUE3QztTQUNLRSxLQUFMOzs7RUFFRm1ELGlCQUFpQixDQUFFRCxTQUFGLEVBQWE7UUFDeEJBLFNBQVMsS0FBSyxJQUFsQixFQUF3QjtXQUNqQmhFLGNBQUwsR0FBc0IsSUFBdEI7S0FERixNQUVPO1dBQ0FGLHFCQUFMLENBQTJCa0UsU0FBM0IsSUFBd0MsSUFBeEM7OztTQUVHbEQsS0FBTDs7O0VBRUZvRCxZQUFZLENBQUVGLFNBQUYsRUFBYXBELElBQWIsRUFBbUI7UUFDekJvRCxTQUFTLEtBQUssSUFBbEIsRUFBd0I7V0FDakI5RCxlQUFMLEdBQXVCVSxJQUF2QjtLQURGLE1BRU87V0FDQVIsb0JBQUwsQ0FBMEI0RCxTQUExQixJQUF1Q3BELElBQXZDOzs7U0FFR0UsS0FBTDs7O0VBRUZxRCxZQUFZLENBQUVyRixPQUFGLEVBQVc7VUFDZnNGLFFBQVEsR0FBRyxLQUFLckYsS0FBTCxDQUFXc0YsV0FBWCxDQUF1QnZGLE9BQXZCLENBQWpCOztTQUNLUSxjQUFMLENBQW9COEUsUUFBUSxDQUFDbkYsT0FBN0IsSUFBd0MsSUFBeEM7O1NBQ0tGLEtBQUwsQ0FBV3VGLFVBQVg7O1dBQ09GLFFBQVA7OztFQUVGRyxpQkFBaUIsQ0FBRXpGLE9BQUYsRUFBVzs7VUFFcEIwRixlQUFlLEdBQUcsS0FBS2pGLGFBQUwsQ0FBbUJrRixJQUFuQixDQUF3QkMsUUFBUSxJQUFJO2FBQ25EL0csTUFBTSxDQUFDZ0MsT0FBUCxDQUFlYixPQUFmLEVBQXdCNkYsS0FBeEIsQ0FBOEIsQ0FBQyxDQUFDQyxVQUFELEVBQWFDLFdBQWIsQ0FBRCxLQUErQjtZQUM5REQsVUFBVSxLQUFLLE1BQW5CLEVBQTJCO2lCQUNsQkYsUUFBUSxDQUFDckksV0FBVCxDQUFxQnFHLElBQXJCLEtBQThCbUMsV0FBckM7U0FERixNQUVPO2lCQUNFSCxRQUFRLENBQUMsTUFBTUUsVUFBUCxDQUFSLEtBQStCQyxXQUF0Qzs7T0FKRyxDQUFQO0tBRHNCLENBQXhCO1dBU1FMLGVBQWUsSUFBSSxLQUFLekYsS0FBTCxDQUFXK0YsTUFBWCxDQUFrQk4sZUFBbEIsQ0FBcEIsSUFBMkQsSUFBbEU7OztFQUVGTyxtQkFBbUIsQ0FBRUMsVUFBRixFQUFjOztVQUV6QkMsT0FBTyxHQUFHLEVBQWhCO1VBQ01DLFNBQVMsR0FBRyxFQUFsQjtVQUNNQyxVQUFVLEdBQUcsRUFBbkI7O1VBQ01DLEtBQUssR0FBR0MsUUFBUSxJQUFJO1lBQ2xCQyxXQUFXLEdBQUcsS0FBS3ZHLEtBQUwsQ0FBVytGLE1BQVgsQ0FBa0JPLFFBQWxCLENBQXBCLENBRHdCOztZQUdsQkUsWUFBWSxHQUFHNUgsTUFBTSxDQUFDc0YsSUFBUCxDQUFZcUMsV0FBVyxDQUFDaEcsY0FBeEIsRUFDbEJrRyxNQURrQixDQUNYRixXQUFXLENBQUNHLFlBQVosQ0FBeUJDLEdBQXpCLENBQTZCQyxXQUFXLElBQUlBLFdBQVcsQ0FBQzFHLE9BQXhELENBRFcsRUFFbEIyRyxNQUZrQixDQUVYM0csT0FBTyxJQUFJLENBQUNnRyxPQUFPLENBQUNoRyxPQUFELENBRlIsQ0FBckIsQ0FId0I7O1dBT25CLE1BQU00RyxVQUFYLElBQXlCTixZQUF6QixFQUF1QztZQUNqQ0wsU0FBUyxDQUFDVyxVQUFELENBQVQsS0FBMEI1RSxTQUE5QixFQUF5QztVQUN2Q2lFLFNBQVMsQ0FBQ1csVUFBRCxDQUFULEdBQXdCM0UsUUFBeEI7OztZQUVFZ0UsU0FBUyxDQUFDRyxRQUFELENBQVQsR0FBc0IsQ0FBdEIsR0FBMEJILFNBQVMsQ0FBQ1csVUFBRCxDQUF2QyxFQUFxRDtVQUNuRFgsU0FBUyxDQUFDVyxVQUFELENBQVQsR0FBd0JYLFNBQVMsQ0FBQ0csUUFBRCxDQUFULEdBQXNCLENBQTlDO1VBQ0FGLFVBQVUsQ0FBQ1UsVUFBRCxDQUFWLEdBQXlCUixRQUF6Qjs7T0Fib0I7Ozs7TUFrQnhCSixPQUFPLENBQUNJLFFBQUQsQ0FBUCxHQUFvQixJQUFwQjthQUNPSCxTQUFTLENBQUNHLFFBQUQsQ0FBaEI7S0FuQkYsQ0FMK0I7OztJQTRCL0JGLFVBQVUsQ0FBQyxLQUFLbEcsT0FBTixDQUFWLEdBQTJCLElBQTNCO0lBQ0FpRyxTQUFTLENBQUMsS0FBS2pHLE9BQU4sQ0FBVCxHQUEwQixDQUExQjtRQUNJNkcsT0FBTyxHQUFHbkksTUFBTSxDQUFDc0YsSUFBUCxDQUFZaUMsU0FBWixDQUFkOztXQUNPWSxPQUFPLENBQUM1QyxNQUFSLEdBQWlCLENBQXhCLEVBQTJCOztNQUV6QjRDLE9BQU8sQ0FBQ0MsSUFBUixDQUFhLENBQUNDLENBQUQsRUFBSUMsQ0FBSixLQUFVZixTQUFTLENBQUNjLENBQUQsQ0FBVCxHQUFlZCxTQUFTLENBQUNlLENBQUQsQ0FBL0M7VUFDSUMsTUFBTSxHQUFHSixPQUFPLENBQUNLLEtBQVIsRUFBYjs7VUFDSUQsTUFBTSxLQUFLbEIsVUFBVSxDQUFDL0YsT0FBMUIsRUFBbUM7O2NBRTNCbUgsS0FBSyxHQUFHLEVBQWQ7O2VBQ09qQixVQUFVLENBQUNlLE1BQUQsQ0FBVixLQUF1QixJQUE5QixFQUFvQztVQUNsQ0UsS0FBSyxDQUFDQyxPQUFOLENBQWMsS0FBS3RILEtBQUwsQ0FBVytGLE1BQVgsQ0FBa0JvQixNQUFsQixDQUFkO1VBQ0FBLE1BQU0sR0FBR2YsVUFBVSxDQUFDZSxNQUFELENBQW5COzs7ZUFFS0UsS0FBUDtPQVBGLE1BUU87O1FBRUxoQixLQUFLLENBQUNjLE1BQUQsQ0FBTDtRQUNBSixPQUFPLEdBQUduSSxNQUFNLENBQUNzRixJQUFQLENBQVlpQyxTQUFaLENBQVY7O0tBOUMyQjs7O1dBa0R4QixJQUFQOzs7RUFFRm9CLFNBQVMsQ0FBRXRDLFNBQUYsRUFBYTtVQUNkbEYsT0FBTyxHQUFHO01BQ2RULElBQUksRUFBRSxpQkFEUTtNQUVkMkY7S0FGRjtXQUlPLEtBQUtPLGlCQUFMLENBQXVCekYsT0FBdkIsS0FBbUMsS0FBS3FGLFlBQUwsQ0FBa0JyRixPQUFsQixDQUExQzs7O0VBRUZ5SCxNQUFNLENBQUV2QyxTQUFGLEVBQWF3QyxTQUFiLEVBQXdCO1VBQ3RCMUgsT0FBTyxHQUFHO01BQ2RULElBQUksRUFBRSxlQURRO01BRWQyRixTQUZjO01BR2R3QztLQUhGO1dBS08sS0FBS2pDLGlCQUFMLENBQXVCekYsT0FBdkIsS0FBbUMsS0FBS3FGLFlBQUwsQ0FBa0JyRixPQUFsQixDQUExQzs7O0VBRUYySCxXQUFXLENBQUV6QyxTQUFGLEVBQWE3QyxNQUFiLEVBQXFCO1dBQ3ZCQSxNQUFNLENBQUN1RSxHQUFQLENBQVd4SCxLQUFLLElBQUk7WUFDbkJZLE9BQU8sR0FBRztRQUNkVCxJQUFJLEVBQUUsY0FEUTtRQUVkMkYsU0FGYztRQUdkOUY7T0FIRjthQUtPLEtBQUtxRyxpQkFBTCxDQUF1QnpGLE9BQXZCLEtBQW1DLEtBQUtxRixZQUFMLENBQWtCckYsT0FBbEIsQ0FBMUM7S0FOSyxDQUFQOzs7U0FTTTRILFNBQVIsQ0FBbUIxQyxTQUFuQixFQUE4QmhELEtBQUssR0FBR0UsUUFBdEMsRUFBZ0Q7VUFDeENDLE1BQU0sR0FBRyxFQUFmOztlQUNXLE1BQU1VLFdBQWpCLElBQWdDLEtBQUtoQixPQUFMLENBQWE7TUFBRUc7S0FBZixDQUFoQyxFQUF5RDtZQUNqRDlDLEtBQUssR0FBRzJELFdBQVcsQ0FBQ0MsR0FBWixDQUFnQmtDLFNBQWhCLENBQWQ7O1VBQ0ksQ0FBQzdDLE1BQU0sQ0FBQ2pELEtBQUQsQ0FBWCxFQUFvQjtRQUNsQmlELE1BQU0sQ0FBQ2pELEtBQUQsQ0FBTixHQUFnQixJQUFoQjtjQUNNWSxPQUFPLEdBQUc7VUFDZFQsSUFBSSxFQUFFLGNBRFE7VUFFZDJGLFNBRmM7VUFHZDlGO1NBSEY7Y0FLTSxLQUFLcUcsaUJBQUwsQ0FBdUJ6RixPQUF2QixLQUFtQyxLQUFLcUYsWUFBTCxDQUFrQnJGLE9BQWxCLENBQXpDOzs7OztFQUlONkgsZUFBZSxDQUFFQyxPQUFGLEVBQVc7V0FDakJBLE9BQU8sQ0FBQ2xCLEdBQVIsQ0FBWXpJLEtBQUssSUFBSTtZQUNwQjZCLE9BQU8sR0FBRztRQUNkVCxJQUFJLEVBQUUsaUJBRFE7UUFFZHBCO09BRkY7YUFJTyxLQUFLc0gsaUJBQUwsQ0FBdUJ6RixPQUF2QixLQUFtQyxLQUFLcUYsWUFBTCxDQUFrQnJGLE9BQWxCLENBQTFDO0tBTEssQ0FBUDs7O1NBUU0rSCxhQUFSLENBQXVCN0YsS0FBSyxHQUFHRSxRQUEvQixFQUF5QztlQUM1QixNQUFNVyxXQUFqQixJQUFnQyxLQUFLaEIsT0FBTCxDQUFhO01BQUVHO0tBQWYsQ0FBaEMsRUFBeUQ7WUFDakRsQyxPQUFPLEdBQUc7UUFDZFQsSUFBSSxFQUFFLGlCQURRO1FBRWRwQixLQUFLLEVBQUU0RSxXQUFXLENBQUM1RTtPQUZyQjtZQUlNLEtBQUtzSCxpQkFBTCxDQUF1QnpGLE9BQXZCLEtBQW1DLEtBQUtxRixZQUFMLENBQWtCckYsT0FBbEIsQ0FBekM7Ozs7RUFHSmdJLE9BQU8sQ0FBRUMsY0FBRixFQUFrQjtVQUNqQjNDLFFBQVEsR0FBRyxLQUFLckYsS0FBTCxDQUFXc0YsV0FBWCxDQUF1QjtNQUFFaEcsSUFBSSxFQUFFO0tBQS9CLENBQWpCOztTQUNLaUIsY0FBTCxDQUFvQjhFLFFBQVEsQ0FBQ25GLE9BQTdCLElBQXdDLElBQXhDOztTQUNLLE1BQU0rRixVQUFYLElBQXlCK0IsY0FBekIsRUFBeUM7TUFDdkMvQixVQUFVLENBQUMxRixjQUFYLENBQTBCOEUsUUFBUSxDQUFDbkYsT0FBbkMsSUFBOEMsSUFBOUM7OztTQUVHRixLQUFMLENBQVd1RixVQUFYOztXQUNPRixRQUFQOzs7TUFFRWpDLFFBQUosR0FBZ0I7V0FDUHhFLE1BQU0sQ0FBQ3dELE1BQVAsQ0FBYyxLQUFLcEMsS0FBTCxDQUFXaUksT0FBekIsRUFBa0N2QyxJQUFsQyxDQUF1Q3RDLFFBQVEsSUFBSTthQUNqREEsUUFBUSxDQUFDRCxLQUFULEtBQW1CLElBQTFCO0tBREssQ0FBUDs7O01BSUV1RCxZQUFKLEdBQW9CO1dBQ1g5SCxNQUFNLENBQUN3RCxNQUFQLENBQWMsS0FBS3BDLEtBQUwsQ0FBVytGLE1BQXpCLEVBQWlDbUMsTUFBakMsQ0FBd0MsQ0FBQ0MsR0FBRCxFQUFNeEMsUUFBTixLQUFtQjtVQUM1REEsUUFBUSxDQUFDcEYsY0FBVCxDQUF3QixLQUFLTCxPQUE3QixDQUFKLEVBQTJDO1FBQ3pDaUksR0FBRyxDQUFDbkssSUFBSixDQUFTMkgsUUFBVDs7O2FBRUt3QyxHQUFQO0tBSkssRUFLSixFQUxJLENBQVA7OztNQU9FM0gsYUFBSixHQUFxQjtXQUNaNUIsTUFBTSxDQUFDc0YsSUFBUCxDQUFZLEtBQUszRCxjQUFqQixFQUFpQ29HLEdBQWpDLENBQXFDekcsT0FBTyxJQUFJO2FBQzlDLEtBQUtGLEtBQUwsQ0FBVytGLE1BQVgsQ0FBa0I3RixPQUFsQixDQUFQO0tBREssQ0FBUDs7O0VBSUZrSSxNQUFNLEdBQUk7UUFDSnhKLE1BQU0sQ0FBQ3NGLElBQVAsQ0FBWSxLQUFLM0QsY0FBakIsRUFBaUM0RCxNQUFqQyxHQUEwQyxDQUExQyxJQUErQyxLQUFLZixRQUF4RCxFQUFrRTtZQUMxRCxJQUFJakQsS0FBSixDQUFXLDZCQUE0QixLQUFLRCxPQUFRLEVBQXBELENBQU47OztTQUVHLE1BQU0wRyxXQUFYLElBQTBCLEtBQUtGLFlBQS9CLEVBQTZDO2FBQ3BDRSxXQUFXLENBQUNwRyxhQUFaLENBQTBCLEtBQUtOLE9BQS9CLENBQVA7OztXQUVLLEtBQUtGLEtBQUwsQ0FBVytGLE1BQVgsQ0FBa0IsS0FBSzdGLE9BQXZCLENBQVA7O1NBQ0tGLEtBQUwsQ0FBV3VGLFVBQVg7Ozs7O0FBR0ozRyxNQUFNLENBQUNJLGNBQVAsQ0FBc0JjLEtBQXRCLEVBQTZCLE1BQTdCLEVBQXFDO0VBQ25DSixHQUFHLEdBQUk7V0FDRSxZQUFZMkksSUFBWixDQUFpQixLQUFLMUUsSUFBdEIsRUFBNEIsQ0FBNUIsQ0FBUDs7O0NBRko7O0FDeFlBLE1BQU0yRSxXQUFOLFNBQTBCeEksS0FBMUIsQ0FBZ0M7RUFDOUJ4QyxXQUFXLENBQUV5QyxPQUFGLEVBQVc7VUFDZEEsT0FBTjtTQUNLd0ksS0FBTCxHQUFheEksT0FBTyxDQUFDNEQsSUFBckI7U0FDSzZFLEtBQUwsR0FBYXpJLE9BQU8sQ0FBQytFLElBQVIsSUFBZ0IsRUFBN0I7O1FBQ0ksQ0FBQyxLQUFLeUQsS0FBTixJQUFlLENBQUMsS0FBS0MsS0FBekIsRUFBZ0M7WUFDeEIsSUFBSXJJLEtBQUosQ0FBVyw0QkFBWCxDQUFOOzs7O01BR0F3RCxJQUFKLEdBQVk7V0FDSCxLQUFLNEUsS0FBWjs7O0VBRUZoSCxZQUFZLEdBQUk7VUFDUmtILEdBQUcsR0FBRyxNQUFNbEgsWUFBTixFQUFaOztJQUNBa0gsR0FBRyxDQUFDOUUsSUFBSixHQUFXLEtBQUs0RSxLQUFoQjtJQUNBRSxHQUFHLENBQUMzRCxJQUFKLEdBQVcsS0FBSzBELEtBQWhCO1dBQ09DLEdBQVA7OztTQUVNaEcsUUFBUixDQUFrQjFDLE9BQWxCLEVBQTJCO1NBQ3BCLElBQUk3QixLQUFLLEdBQUcsQ0FBakIsRUFBb0JBLEtBQUssR0FBRyxLQUFLc0ssS0FBTCxDQUFXckUsTUFBdkMsRUFBK0NqRyxLQUFLLEVBQXBELEVBQXdEO1lBQ2hEd0ssSUFBSSxHQUFHLEtBQUt4RixLQUFMLENBQVc7UUFBRWhGLEtBQUY7UUFBUzZFLEdBQUcsRUFBRSxLQUFLeUYsS0FBTCxDQUFXdEssS0FBWDtPQUF6QixDQUFiOztVQUNJLEtBQUsyRSxXQUFMLENBQWlCNkYsSUFBakIsQ0FBSixFQUE0QjtjQUNwQkEsSUFBTjs7Ozs7OztBQ3RCUixNQUFNQyxlQUFOLFNBQThCN0ksS0FBOUIsQ0FBb0M7RUFDbEN4QyxXQUFXLENBQUV5QyxPQUFGLEVBQVc7VUFDZEEsT0FBTjtTQUNLd0ksS0FBTCxHQUFheEksT0FBTyxDQUFDNEQsSUFBckI7U0FDSzZFLEtBQUwsR0FBYXpJLE9BQU8sQ0FBQytFLElBQVIsSUFBZ0IsRUFBN0I7O1FBQ0ksQ0FBQyxLQUFLeUQsS0FBTixJQUFlLENBQUMsS0FBS0MsS0FBekIsRUFBZ0M7WUFDeEIsSUFBSXJJLEtBQUosQ0FBVyw0QkFBWCxDQUFOOzs7O01BR0F3RCxJQUFKLEdBQVk7V0FDSCxLQUFLNEUsS0FBWjs7O0VBRUZoSCxZQUFZLEdBQUk7VUFDUmtILEdBQUcsR0FBRyxNQUFNbEgsWUFBTixFQUFaOztJQUNBa0gsR0FBRyxDQUFDOUUsSUFBSixHQUFXLEtBQUs0RSxLQUFoQjtJQUNBRSxHQUFHLENBQUMzRCxJQUFKLEdBQVcsS0FBSzBELEtBQWhCO1dBQ09DLEdBQVA7OztTQUVNaEcsUUFBUixDQUFrQjFDLE9BQWxCLEVBQTJCO1NBQ3BCLE1BQU0sQ0FBQzdCLEtBQUQsRUFBUTZFLEdBQVIsQ0FBWCxJQUEyQm5FLE1BQU0sQ0FBQ2dDLE9BQVAsQ0FBZSxLQUFLNEgsS0FBcEIsQ0FBM0IsRUFBdUQ7WUFDL0NFLElBQUksR0FBRyxLQUFLeEYsS0FBTCxDQUFXO1FBQUVoRixLQUFGO1FBQVM2RTtPQUFwQixDQUFiOztVQUNJLEtBQUtGLFdBQUwsQ0FBaUI2RixJQUFqQixDQUFKLEVBQTRCO2NBQ3BCQSxJQUFOOzs7Ozs7O0FDeEJSLE1BQU1FLGlCQUFpQixHQUFHLFVBQVV2TCxVQUFWLEVBQXNCO1NBQ3ZDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsQ0FBRXlDLE9BQUYsRUFBVztZQUNkQSxPQUFOO1dBQ0s4SSw0QkFBTCxHQUFvQyxJQUFwQzs7O1FBRUVqQyxXQUFKLEdBQW1CO1lBQ1hGLFlBQVksR0FBRyxLQUFLQSxZQUExQjs7VUFDSUEsWUFBWSxDQUFDdkMsTUFBYixLQUF3QixDQUE1QixFQUErQjtjQUN2QixJQUFJaEUsS0FBSixDQUFXLDhDQUE2QyxLQUFLYixJQUFLLEVBQWxFLENBQU47T0FERixNQUVPLElBQUlvSCxZQUFZLENBQUN2QyxNQUFiLEdBQXNCLENBQTFCLEVBQTZCO2NBQzVCLElBQUloRSxLQUFKLENBQVcsbURBQWtELEtBQUtiLElBQUssRUFBdkUsQ0FBTjs7O2FBRUtvSCxZQUFZLENBQUMsQ0FBRCxDQUFuQjs7O0dBWko7Q0FERjs7QUFpQkE5SCxNQUFNLENBQUNJLGNBQVAsQ0FBc0I0SixpQkFBdEIsRUFBeUMzSixNQUFNLENBQUNDLFdBQWhELEVBQTZEO0VBQzNEQyxLQUFLLEVBQUVDLENBQUMsSUFBSSxDQUFDLENBQUNBLENBQUMsQ0FBQ3lKO0NBRGxCOztBQ2RBLE1BQU1DLGVBQU4sU0FBOEJGLGlCQUFpQixDQUFDOUksS0FBRCxDQUEvQyxDQUF1RDtFQUNyRHhDLFdBQVcsQ0FBRXlDLE9BQUYsRUFBVztVQUNkQSxPQUFOO1NBQ0tnSixVQUFMLEdBQWtCaEosT0FBTyxDQUFDa0YsU0FBMUI7O1FBQ0ksQ0FBQyxLQUFLOEQsVUFBVixFQUFzQjtZQUNkLElBQUk1SSxLQUFKLENBQVcsdUJBQVgsQ0FBTjs7O1NBR0c2SSx5QkFBTCxHQUFpQyxFQUFqQzs7U0FDSyxNQUFNLENBQUN0SSxJQUFELEVBQU9DLGVBQVAsQ0FBWCxJQUFzQy9CLE1BQU0sQ0FBQ2dDLE9BQVAsQ0FBZWIsT0FBTyxDQUFDa0osd0JBQVIsSUFBb0MsRUFBbkQsQ0FBdEMsRUFBOEY7V0FDdkZELHlCQUFMLENBQStCdEksSUFBL0IsSUFBdUMsS0FBS1YsS0FBTCxDQUFXYyxlQUFYLENBQTJCSCxlQUEzQixDQUF2Qzs7OztFQUdKWSxZQUFZLEdBQUk7VUFDUmtILEdBQUcsR0FBRyxNQUFNbEgsWUFBTixFQUFaOztJQUNBa0gsR0FBRyxDQUFDeEQsU0FBSixHQUFnQixLQUFLOEQsVUFBckI7SUFDQU4sR0FBRyxDQUFDUSx3QkFBSixHQUErQixFQUEvQjs7U0FDSyxNQUFNLENBQUN2SSxJQUFELEVBQU9tQixJQUFQLENBQVgsSUFBMkJqRCxNQUFNLENBQUNnQyxPQUFQLENBQWUsS0FBS29JLHlCQUFwQixDQUEzQixFQUEyRTtNQUN6RVAsR0FBRyxDQUFDUSx3QkFBSixDQUE2QnZJLElBQTdCLElBQXFDLEtBQUtWLEtBQUwsQ0FBV2tKLGtCQUFYLENBQThCckgsSUFBOUIsQ0FBckM7OztXQUVLNEcsR0FBUDs7O01BRUU5RSxJQUFKLEdBQVk7V0FDSCxLQUFLaUQsV0FBTCxDQUFpQmpELElBQWpCLEdBQXdCLEdBQS9COzs7RUFFRndGLHNCQUFzQixDQUFFekksSUFBRixFQUFRbUIsSUFBUixFQUFjO1NBQzdCbUgseUJBQUwsQ0FBK0J0SSxJQUEvQixJQUF1Q21CLElBQXZDO1NBQ0tFLEtBQUw7OztFQUVGcUgsV0FBVyxDQUFFQyxtQkFBRixFQUF1QkMsY0FBdkIsRUFBdUM7U0FDM0MsTUFBTSxDQUFDNUksSUFBRCxFQUFPbUIsSUFBUCxDQUFYLElBQTJCakQsTUFBTSxDQUFDZ0MsT0FBUCxDQUFlLEtBQUtvSSx5QkFBcEIsQ0FBM0IsRUFBMkU7TUFDekVLLG1CQUFtQixDQUFDdEcsR0FBcEIsQ0FBd0JyQyxJQUF4QixJQUFnQ21CLElBQUksQ0FBQ3dILG1CQUFELEVBQXNCQyxjQUF0QixDQUFwQzs7O0lBRUZELG1CQUFtQixDQUFDakwsT0FBcEIsQ0FBNEIsUUFBNUI7OztTQUVNa0UsV0FBUixDQUFxQnZDLE9BQXJCLEVBQThCOzs7Ozs7U0FPdkJ3QyxhQUFMLEdBQXFCLEVBQXJCOztlQUNXLE1BQU1PLFdBQWpCLElBQWdDLEtBQUtMLFFBQUwsQ0FBYzFDLE9BQWQsQ0FBaEMsRUFBd0Q7V0FDakR3QyxhQUFMLENBQW1CTyxXQUFXLENBQUM1RSxLQUEvQixJQUF3QzRFLFdBQXhDLENBRHNEOzs7O1lBS2hEQSxXQUFOO0tBYjBCOzs7O1NBa0J2QixNQUFNNUUsS0FBWCxJQUFvQixLQUFLcUUsYUFBekIsRUFBd0M7WUFDaENPLFdBQVcsR0FBRyxLQUFLUCxhQUFMLENBQW1CckUsS0FBbkIsQ0FBcEI7O1VBQ0ksQ0FBQyxLQUFLMkUsV0FBTCxDQUFpQkMsV0FBakIsQ0FBTCxFQUFvQztlQUMzQixLQUFLUCxhQUFMLENBQW1CckUsS0FBbkIsQ0FBUDs7OztTQUdDOEQsTUFBTCxHQUFjLEtBQUtPLGFBQW5CO1dBQ08sS0FBS0EsYUFBWjs7O1NBRU1FLFFBQVIsQ0FBa0IxQyxPQUFsQixFQUEyQjtVQUNuQjZHLFdBQVcsR0FBRyxLQUFLQSxXQUF6Qjs7ZUFDVyxNQUFNMkMsYUFBakIsSUFBa0MzQyxXQUFXLENBQUM5RSxPQUFaLENBQW9CL0IsT0FBcEIsQ0FBbEMsRUFBZ0U7WUFDeEQ3QixLQUFLLEdBQUdxTCxhQUFhLENBQUN4RyxHQUFkLENBQWtCLEtBQUtnRyxVQUF2QixDQUFkOztVQUNJLENBQUMsS0FBS3hHLGFBQVYsRUFBeUI7OztPQUF6QixNQUdPLElBQUksS0FBS0EsYUFBTCxDQUFtQnJFLEtBQW5CLENBQUosRUFBK0I7Y0FDOUJzTCxZQUFZLEdBQUcsS0FBS2pILGFBQUwsQ0FBbUJyRSxLQUFuQixDQUFyQjtRQUNBc0wsWUFBWSxDQUFDL0YsV0FBYixDQUF5QjhGLGFBQXpCO1FBQ0FBLGFBQWEsQ0FBQzlGLFdBQWQsQ0FBMEIrRixZQUExQjs7YUFDS0osV0FBTCxDQUFpQkksWUFBakIsRUFBK0JELGFBQS9CO09BSkssTUFLQTtjQUNDRSxPQUFPLEdBQUcsS0FBS3ZHLEtBQUwsQ0FBVztVQUN6QmhGLEtBRHlCO1VBRXpCc0YsY0FBYyxFQUFFLENBQUUrRixhQUFGO1NBRkYsQ0FBaEI7O2FBSUtILFdBQUwsQ0FBaUJLLE9BQWpCLEVBQTBCRixhQUExQjs7Y0FDTUUsT0FBTjs7Ozs7RUFJTmpGLG1CQUFtQixHQUFJO1VBQ2ZDLFFBQVEsR0FBRyxNQUFNRCxtQkFBTixFQUFqQjs7U0FDSyxNQUFNOUQsSUFBWCxJQUFtQixLQUFLc0kseUJBQXhCLEVBQW1EO01BQ2pEdkUsUUFBUSxDQUFDL0QsSUFBRCxDQUFSLEdBQWlCK0QsUUFBUSxDQUFDL0QsSUFBRCxDQUFSLElBQWtCO1FBQUVpRCxJQUFJLEVBQUVqRDtPQUEzQztNQUNBK0QsUUFBUSxDQUFDL0QsSUFBRCxDQUFSLENBQWVnSixPQUFmLEdBQXlCLElBQXpCOzs7V0FFS2pGLFFBQVA7Ozs7O0FDN0ZKLE1BQU1rRiwyQkFBMkIsR0FBRyxVQUFVdE0sVUFBVixFQUFzQjtTQUNqRCxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLENBQUV5QyxPQUFGLEVBQVc7WUFDZEEsT0FBTjtXQUNLNkosc0NBQUwsR0FBOEMsSUFBOUM7V0FDS0MscUJBQUwsR0FBNkI5SixPQUFPLENBQUMrSixvQkFBUixJQUFnQyxFQUE3RDs7O0lBRUZ2SSxZQUFZLEdBQUk7WUFDUmtILEdBQUcsR0FBRyxNQUFNbEgsWUFBTixFQUFaOztNQUNBa0gsR0FBRyxDQUFDcUIsb0JBQUosR0FBMkIsS0FBS0QscUJBQWhDO2FBQ09wQixHQUFQOzs7SUFFRnNCLGtCQUFrQixDQUFFQyxRQUFGLEVBQVkvRSxTQUFaLEVBQXVCO1dBQ2xDNEUscUJBQUwsQ0FBMkJHLFFBQTNCLElBQXVDLEtBQUtILHFCQUFMLENBQTJCRyxRQUEzQixLQUF3QyxFQUEvRTs7V0FDS0gscUJBQUwsQ0FBMkJHLFFBQTNCLEVBQXFDaE0sSUFBckMsQ0FBMENpSCxTQUExQzs7V0FDS2xELEtBQUw7OztJQUVGa0ksb0JBQW9CLENBQUVuSCxXQUFGLEVBQWU7V0FDNUIsTUFBTSxDQUFDa0gsUUFBRCxFQUFXdEosSUFBWCxDQUFYLElBQStCOUIsTUFBTSxDQUFDZ0MsT0FBUCxDQUFlLEtBQUtpSixxQkFBcEIsQ0FBL0IsRUFBMkU7Y0FDbkVLLFVBQVUsR0FBRyxLQUFLbEssS0FBTCxDQUFXK0YsTUFBWCxDQUFrQmlFLFFBQWxCLEVBQTRCckcsSUFBL0M7UUFDQWIsV0FBVyxDQUFDQyxHQUFaLENBQWlCLEdBQUVtSCxVQUFXLElBQUd4SixJQUFLLEVBQXRDLElBQTJDb0MsV0FBVyxDQUFDcUgsY0FBWixDQUEyQkgsUUFBM0IsRUFBcUMsQ0FBckMsRUFBd0NqSCxHQUF4QyxDQUE0Q3JDLElBQTVDLENBQTNDOzs7O0lBR0o4RCxtQkFBbUIsR0FBSTtZQUNmQyxRQUFRLEdBQUcsTUFBTUQsbUJBQU4sRUFBakI7O1dBQ0ssTUFBTSxDQUFDd0YsUUFBRCxFQUFXdEosSUFBWCxDQUFYLElBQStCOUIsTUFBTSxDQUFDZ0MsT0FBUCxDQUFlLEtBQUtpSixxQkFBcEIsQ0FBL0IsRUFBMkU7Y0FDbkVPLFFBQVEsR0FBSSxHQUFFLEtBQUtwSyxLQUFMLENBQVcrRixNQUFYLENBQWtCaUUsUUFBbEIsRUFBNEJyRyxJQUFLLElBQUdqRCxJQUFLLEVBQTdEO1FBQ0ErRCxRQUFRLENBQUMyRixRQUFELENBQVIsR0FBcUIzRixRQUFRLENBQUMyRixRQUFELENBQVIsSUFBc0I7VUFBRXpHLElBQUksRUFBRXlHO1NBQW5EO1FBQ0EzRixRQUFRLENBQUMyRixRQUFELENBQVIsQ0FBbUJDLE1BQW5CLEdBQTRCLElBQTVCOzs7YUFFSzVGLFFBQVA7OztHQTdCSjtDQURGOztBQWtDQTdGLE1BQU0sQ0FBQ0ksY0FBUCxDQUFzQjJLLDJCQUF0QixFQUFtRDFLLE1BQU0sQ0FBQ0MsV0FBMUQsRUFBdUU7RUFDckVDLEtBQUssRUFBRUMsQ0FBQyxJQUFJLENBQUMsQ0FBQ0EsQ0FBQyxDQUFDd0s7Q0FEbEI7O0FDOUJBLE1BQU1VLGFBQU4sU0FBNEJYLDJCQUEyQixDQUFDZixpQkFBaUIsQ0FBQzlJLEtBQUQsQ0FBbEIsQ0FBdkQsQ0FBa0Y7RUFDaEZ4QyxXQUFXLENBQUV5QyxPQUFGLEVBQVc7VUFDZEEsT0FBTjtTQUNLZ0osVUFBTCxHQUFrQmhKLE9BQU8sQ0FBQ2tGLFNBQTFCOztRQUNJLENBQUMsS0FBSzhELFVBQVYsRUFBc0I7WUFDZCxJQUFJNUksS0FBSixDQUFXLHVCQUFYLENBQU47OztTQUdHc0gsU0FBTCxHQUFpQjFILE9BQU8sQ0FBQzBILFNBQVIsSUFBcUIsR0FBdEM7OztFQUVGbEcsWUFBWSxHQUFJO1VBQ1JrSCxHQUFHLEdBQUcsTUFBTWxILFlBQU4sRUFBWjs7SUFDQWtILEdBQUcsQ0FBQ3hELFNBQUosR0FBZ0IsS0FBSzhELFVBQXJCO1dBQ09OLEdBQVA7OztNQUVFOUUsSUFBSixHQUFZO1dBQ0gsS0FBS2lELFdBQUwsQ0FBaUJqRCxJQUFqQixHQUF3QixHQUEvQjs7O1NBRU1sQixRQUFSLENBQWtCMUMsT0FBbEIsRUFBMkI7UUFDckI3QixLQUFLLEdBQUcsQ0FBWjtVQUNNMEksV0FBVyxHQUFHLEtBQUtBLFdBQXpCOztlQUNXLE1BQU0yQyxhQUFqQixJQUFrQzNDLFdBQVcsQ0FBQzlFLE9BQVosQ0FBb0IvQixPQUFwQixDQUFsQyxFQUFnRTtZQUN4RHFDLE1BQU0sR0FBRyxDQUFDbUgsYUFBYSxDQUFDeEcsR0FBZCxDQUFrQixLQUFLZ0csVUFBdkIsS0FBc0MsRUFBdkMsRUFBMkN3QixLQUEzQyxDQUFpRCxLQUFLOUMsU0FBdEQsQ0FBZjs7V0FDSyxNQUFNdEksS0FBWCxJQUFvQmlELE1BQXBCLEVBQTRCO2NBQ3BCVyxHQUFHLEdBQUcsRUFBWjtRQUNBQSxHQUFHLENBQUMsS0FBS2dHLFVBQU4sQ0FBSCxHQUF1QjVKLEtBQXZCOztjQUNNc0ssT0FBTyxHQUFHLEtBQUt2RyxLQUFMLENBQVc7VUFDekJoRixLQUR5QjtVQUV6QjZFLEdBRnlCO1VBR3pCUyxjQUFjLEVBQUUsQ0FBRStGLGFBQUY7U0FIRixDQUFoQjs7YUFLS1Usb0JBQUwsQ0FBMEJSLE9BQTFCOztZQUNJLEtBQUs1RyxXQUFMLENBQWlCNEcsT0FBakIsQ0FBSixFQUErQjtnQkFDdkJBLE9BQU47OztRQUVGdkwsS0FBSzs7Ozs7OztBQ3BDYixNQUFNc00sWUFBTixTQUEyQjVCLGlCQUFpQixDQUFDOUksS0FBRCxDQUE1QyxDQUFvRDtFQUNsRHhDLFdBQVcsQ0FBRXlDLE9BQUYsRUFBVztVQUNkQSxPQUFOO1NBQ0tnSixVQUFMLEdBQWtCaEosT0FBTyxDQUFDa0YsU0FBMUI7U0FDS3dGLE1BQUwsR0FBYzFLLE9BQU8sQ0FBQ1osS0FBdEI7O1FBQ0ksQ0FBQyxLQUFLNEosVUFBTixJQUFvQixDQUFDLEtBQUswQixNQUFOLEtBQWlCdkksU0FBekMsRUFBb0Q7WUFDNUMsSUFBSS9CLEtBQUosQ0FBVyxrQ0FBWCxDQUFOOzs7O0VBR0pvQixZQUFZLEdBQUk7VUFDUmtILEdBQUcsR0FBRyxNQUFNbEgsWUFBTixFQUFaOztJQUNBa0gsR0FBRyxDQUFDeEQsU0FBSixHQUFnQixLQUFLOEQsVUFBckI7SUFDQU4sR0FBRyxDQUFDdEosS0FBSixHQUFZLEtBQUtzTCxNQUFqQjtXQUNPaEMsR0FBUDs7O01BRUU5RSxJQUFKLEdBQVk7V0FDRixJQUFHLEtBQUs4RyxNQUFPLEdBQXZCOzs7U0FFTWhJLFFBQVIsQ0FBa0IxQyxPQUFsQixFQUEyQjtRQUNyQjdCLEtBQUssR0FBRyxDQUFaO1VBQ00wSSxXQUFXLEdBQUcsS0FBS0EsV0FBekI7O2VBQ1csTUFBTTJDLGFBQWpCLElBQWtDM0MsV0FBVyxDQUFDOUUsT0FBWixDQUFvQi9CLE9BQXBCLENBQWxDLEVBQWdFO1VBQzFEd0osYUFBYSxDQUFDeEcsR0FBZCxDQUFrQixLQUFLZ0csVUFBdkIsTUFBdUMsS0FBSzBCLE1BQWhELEVBQXdEOztjQUVoRGhCLE9BQU8sR0FBRyxLQUFLdkcsS0FBTCxDQUFXO1VBQ3pCaEYsS0FEeUI7VUFFekI2RSxHQUFHLEVBQUVuRSxNQUFNLENBQUNDLE1BQVAsQ0FBYyxFQUFkLEVBQWtCMEssYUFBYSxDQUFDeEcsR0FBaEMsQ0FGb0I7VUFHekJTLGNBQWMsRUFBRSxDQUFFK0YsYUFBRjtTQUhGLENBQWhCOztZQUtJLEtBQUsxRyxXQUFMLENBQWlCNEcsT0FBakIsQ0FBSixFQUErQjtnQkFDdkJBLE9BQU47OztRQUVGdkwsS0FBSzs7Ozs7OztBQ2hDYixNQUFNd00sZUFBTixTQUE4QjlCLGlCQUFpQixDQUFDOUksS0FBRCxDQUEvQyxDQUF1RDtFQUNyRHhDLFdBQVcsQ0FBRXlDLE9BQUYsRUFBVztVQUNkQSxPQUFOO1NBQ0s0SyxNQUFMLEdBQWM1SyxPQUFPLENBQUM3QixLQUF0Qjs7UUFDSSxLQUFLeU0sTUFBTCxLQUFnQnpJLFNBQXBCLEVBQStCO1lBQ3ZCLElBQUkvQixLQUFKLENBQVcsbUJBQVgsQ0FBTjs7OztFQUdKb0IsWUFBWSxHQUFJO1VBQ1JrSCxHQUFHLEdBQUcsTUFBTWxILFlBQU4sRUFBWjs7SUFDQWtILEdBQUcsQ0FBQ3ZLLEtBQUosR0FBWSxLQUFLeU0sTUFBakI7V0FDT2xDLEdBQVA7OztNQUVFOUUsSUFBSixHQUFZO1dBQ0YsSUFBRyxLQUFLZ0gsTUFBTyxFQUF2Qjs7O1NBRU1sSSxRQUFSLENBQWtCMUMsT0FBbEIsRUFBMkI7O1VBRW5CNkcsV0FBVyxHQUFHLEtBQUtBLFdBQXpCO1VBQ01BLFdBQVcsQ0FBQ2hELFVBQVosRUFBTixDQUh5Qjs7VUFNbkIyRixhQUFhLEdBQUczQyxXQUFXLENBQUM1RSxNQUFaLENBQW1CLEtBQUsySSxNQUF4QixLQUFtQztNQUFFNUgsR0FBRyxFQUFFO0tBQWhFOztTQUNLLE1BQU0sQ0FBRTdFLEtBQUYsRUFBU2lCLEtBQVQsQ0FBWCxJQUErQlAsTUFBTSxDQUFDZ0MsT0FBUCxDQUFlMkksYUFBYSxDQUFDeEcsR0FBN0IsQ0FBL0IsRUFBa0U7WUFDMUQwRyxPQUFPLEdBQUcsS0FBS3ZHLEtBQUwsQ0FBVztRQUN6QmhGLEtBRHlCO1FBRXpCNkUsR0FBRyxFQUFFLE9BQU81RCxLQUFQLEtBQWlCLFFBQWpCLEdBQTRCQSxLQUE1QixHQUFvQztVQUFFQTtTQUZsQjtRQUd6QnFFLGNBQWMsRUFBRSxDQUFFK0YsYUFBRjtPQUhGLENBQWhCOztVQUtJLEtBQUsxRyxXQUFMLENBQWlCNEcsT0FBakIsQ0FBSixFQUErQjtjQUN2QkEsT0FBTjs7Ozs7OztBQzlCUixNQUFNbUIsY0FBTixTQUE2QmpCLDJCQUEyQixDQUFDN0osS0FBRCxDQUF4RCxDQUFnRTtNQUMxRDZELElBQUosR0FBWTtXQUNILEtBQUsrQyxZQUFMLENBQWtCQyxHQUFsQixDQUFzQkMsV0FBVyxJQUFJQSxXQUFXLENBQUNqRCxJQUFqRCxFQUF1RGtILElBQXZELENBQTRELEdBQTVELENBQVA7OztTQUVNcEksUUFBUixDQUFrQjFDLE9BQWxCLEVBQTJCO1VBQ25CMkcsWUFBWSxHQUFHLEtBQUtBLFlBQTFCLENBRHlCOztTQUdwQixNQUFNRSxXQUFYLElBQTBCRixZQUExQixFQUF3QztZQUNoQ0UsV0FBVyxDQUFDaEQsVUFBWixFQUFOO0tBSnVCOzs7OztVQVNuQmtILGVBQWUsR0FBR3BFLFlBQVksQ0FBQyxDQUFELENBQXBDO1VBQ01xRSxpQkFBaUIsR0FBR3JFLFlBQVksQ0FBQ3JFLEtBQWIsQ0FBbUIsQ0FBbkIsQ0FBMUI7O1NBQ0ssTUFBTW5FLEtBQVgsSUFBb0I0TSxlQUFlLENBQUM5SSxNQUFwQyxFQUE0QztVQUN0QyxDQUFDMEUsWUFBWSxDQUFDZCxLQUFiLENBQW1CekMsS0FBSyxJQUFJQSxLQUFLLENBQUNuQixNQUFsQyxDQUFMLEVBQWdEOzs7OztVQUk1QyxDQUFDK0ksaUJBQWlCLENBQUNuRixLQUFsQixDQUF3QnpDLEtBQUssSUFBSUEsS0FBSyxDQUFDbkIsTUFBTixDQUFhOUQsS0FBYixDQUFqQyxDQUFMLEVBQTREOzs7T0FMbEI7OztZQVVwQ3VMLE9BQU8sR0FBRyxLQUFLdkcsS0FBTCxDQUFXO1FBQ3pCaEYsS0FEeUI7UUFFekJzRixjQUFjLEVBQUVrRCxZQUFZLENBQUNDLEdBQWIsQ0FBaUJ4RCxLQUFLLElBQUlBLEtBQUssQ0FBQ25CLE1BQU4sQ0FBYTlELEtBQWIsQ0FBMUI7T0FGRixDQUFoQjs7V0FJSytMLG9CQUFMLENBQTBCUixPQUExQjs7VUFDSSxLQUFLNUcsV0FBTCxDQUFpQjRHLE9BQWpCLENBQUosRUFBK0I7Y0FDdkJBLE9BQU47Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNoQ1IsTUFBTXVCLFlBQU4sU0FBMkIzTCxjQUEzQixDQUEwQztFQUN4Qy9CLFdBQVcsQ0FBRXlDLE9BQUYsRUFBVzs7U0FFZkMsS0FBTCxHQUFhRCxPQUFPLENBQUNFLElBQXJCO1NBQ0tnTCxPQUFMLEdBQWVsTCxPQUFPLENBQUNrTCxPQUF2QjtTQUNLL0ssT0FBTCxHQUFlSCxPQUFPLENBQUNHLE9BQXZCOztRQUNJLENBQUMsS0FBS0YsS0FBTixJQUFlLENBQUMsS0FBS2lMLE9BQXJCLElBQWdDLENBQUMsS0FBSy9LLE9BQTFDLEVBQW1EO1lBQzNDLElBQUlDLEtBQUosQ0FBVywwQ0FBWCxDQUFOOzs7U0FHRytLLFVBQUwsR0FBa0JuTCxPQUFPLENBQUNvTCxTQUFSLElBQXFCLElBQXZDO1NBQ0tDLFVBQUwsR0FBa0JyTCxPQUFPLENBQUNxTCxVQUFSLElBQXNCLEVBQXhDOzs7RUFFRjdKLFlBQVksR0FBSTtXQUNQO01BQ0wwSixPQUFPLEVBQUUsS0FBS0EsT0FEVDtNQUVML0ssT0FBTyxFQUFFLEtBQUtBLE9BRlQ7TUFHTGlMLFNBQVMsRUFBRSxLQUFLRCxVQUhYO01BSUxFLFVBQVUsRUFBRSxLQUFLQTtLQUpuQjs7O0VBT0ZDLFlBQVksQ0FBRWxNLEtBQUYsRUFBUztTQUNkK0wsVUFBTCxHQUFrQi9MLEtBQWxCOztTQUNLYSxLQUFMLENBQVdzTCxXQUFYOzs7TUFFRUMsYUFBSixHQUFxQjtXQUNaLEtBQUtMLFVBQUwsS0FBb0IsSUFBM0I7OztNQUVFQyxTQUFKLEdBQWlCO1dBQ1IsS0FBS0QsVUFBTCxJQUFtQixLQUFLL0gsS0FBTCxDQUFXUSxJQUFyQzs7O0VBRUY2SCxZQUFZLENBQUV2RyxTQUFGLEVBQWE7V0FDaEJBLFNBQVMsS0FBSyxJQUFkLEdBQXFCLEtBQUs5QixLQUExQixHQUFrQyxLQUFLQSxLQUFMLENBQVdvRSxTQUFYLENBQXFCdEMsU0FBckIsQ0FBekM7OztNQUVFOUIsS0FBSixHQUFhO1dBQ0osS0FBS25ELEtBQUwsQ0FBVytGLE1BQVgsQ0FBa0IsS0FBSzdGLE9BQXZCLENBQVA7OztFQUVGZ0QsS0FBSyxDQUFFbkQsT0FBRixFQUFXO0lBQ2RBLE9BQU8sQ0FBQ3FELFFBQVIsR0FBbUIsSUFBbkI7V0FDTyxJQUFJLEtBQUtwRCxLQUFMLENBQVdxRCxRQUFYLENBQW9CQyxjQUF4QixDQUF1Q3ZELE9BQXZDLENBQVA7OztFQUVGMEwsZ0JBQWdCLEdBQUk7VUFDWjFMLE9BQU8sR0FBRyxLQUFLd0IsWUFBTCxFQUFoQjs7SUFDQXhCLE9BQU8sQ0FBQ1QsSUFBUixHQUFlLFdBQWY7U0FDSzZELEtBQUwsQ0FBV3BCLEtBQVg7V0FDTyxLQUFLL0IsS0FBTCxDQUFXMEwsUUFBWCxDQUFvQjNMLE9BQXBCLENBQVA7OztFQUVGNEwsZ0JBQWdCLEdBQUk7VUFDWjVMLE9BQU8sR0FBRyxLQUFLd0IsWUFBTCxFQUFoQjs7SUFDQXhCLE9BQU8sQ0FBQ1QsSUFBUixHQUFlLFdBQWY7U0FDSzZELEtBQUwsQ0FBV3BCLEtBQVg7V0FDTyxLQUFLL0IsS0FBTCxDQUFXMEwsUUFBWCxDQUFvQjNMLE9BQXBCLENBQVA7OztFQUVGNkwsbUJBQW1CLENBQUV2RyxRQUFGLEVBQVk7V0FDdEIsS0FBS3JGLEtBQUwsQ0FBVzBMLFFBQVgsQ0FBb0I7TUFDekJ4TCxPQUFPLEVBQUVtRixRQUFRLENBQUNuRixPQURPO01BRXpCWixJQUFJLEVBQUU7S0FGRCxDQUFQOzs7RUFLRmlJLFNBQVMsQ0FBRXRDLFNBQUYsRUFBYTtXQUNiLEtBQUsyRyxtQkFBTCxDQUF5QixLQUFLekksS0FBTCxDQUFXb0UsU0FBWCxDQUFxQnRDLFNBQXJCLENBQXpCLENBQVA7OztFQUVGdUMsTUFBTSxDQUFFdkMsU0FBRixFQUFhd0MsU0FBYixFQUF3QjtXQUNyQixLQUFLbUUsbUJBQUwsQ0FBeUIsS0FBS3pJLEtBQUwsQ0FBV3FFLE1BQVgsQ0FBa0J2QyxTQUFsQixFQUE2QndDLFNBQTdCLENBQXpCLENBQVA7OztFQUVGQyxXQUFXLENBQUV6QyxTQUFGLEVBQWE3QyxNQUFiLEVBQXFCO1dBQ3ZCLEtBQUtlLEtBQUwsQ0FBV3VFLFdBQVgsQ0FBdUJ6QyxTQUF2QixFQUFrQzdDLE1BQWxDLEVBQTBDdUUsR0FBMUMsQ0FBOEN0QixRQUFRLElBQUk7YUFDeEQsS0FBS3VHLG1CQUFMLENBQXlCdkcsUUFBekIsQ0FBUDtLQURLLENBQVA7OztTQUlNc0MsU0FBUixDQUFtQjFDLFNBQW5CLEVBQThCO2VBQ2pCLE1BQU1JLFFBQWpCLElBQTZCLEtBQUtsQyxLQUFMLENBQVd3RSxTQUFYLENBQXFCMUMsU0FBckIsQ0FBN0IsRUFBOEQ7WUFDdEQsS0FBSzJHLG1CQUFMLENBQXlCdkcsUUFBekIsQ0FBTjs7OztFQUdKdUMsZUFBZSxDQUFFQyxPQUFGLEVBQVc7V0FDakIsS0FBSzFFLEtBQUwsQ0FBV3lFLGVBQVgsQ0FBMkJDLE9BQTNCLEVBQW9DbEIsR0FBcEMsQ0FBd0N0QixRQUFRLElBQUk7YUFDbEQsS0FBS3VHLG1CQUFMLENBQXlCdkcsUUFBekIsQ0FBUDtLQURLLENBQVA7OztTQUlNeUMsYUFBUixHQUF5QjtlQUNaLE1BQU16QyxRQUFqQixJQUE2QixLQUFLbEMsS0FBTCxDQUFXMkUsYUFBWCxFQUE3QixFQUF5RDtZQUNqRCxLQUFLOEQsbUJBQUwsQ0FBeUJ2RyxRQUF6QixDQUFOOzs7O0VBR0orQyxNQUFNLEdBQUk7V0FDRCxLQUFLcEksS0FBTCxDQUFXaUksT0FBWCxDQUFtQixLQUFLZ0QsT0FBeEIsQ0FBUDs7U0FDS2pMLEtBQUwsQ0FBV3NMLFdBQVg7Ozs7O0FBR0oxTSxNQUFNLENBQUNJLGNBQVAsQ0FBc0JnTSxZQUF0QixFQUFvQyxNQUFwQyxFQUE0QztFQUMxQ3RMLEdBQUcsR0FBSTtXQUNFLFlBQVkySSxJQUFaLENBQWlCLEtBQUsxRSxJQUF0QixFQUE0QixDQUE1QixDQUFQOzs7Q0FGSjs7QUMxRkEsTUFBTWtJLFNBQU4sU0FBd0JiLFlBQXhCLENBQXFDO0VBQ25DMU4sV0FBVyxDQUFFeUMsT0FBRixFQUFXO1VBQ2RBLE9BQU47U0FDSytMLFlBQUwsR0FBb0IvTCxPQUFPLENBQUMrTCxZQUFSLElBQXdCLEVBQTVDO1NBQ0tDLHdCQUFMLEdBQWdDLEVBQWhDOzs7RUFFRnhLLFlBQVksR0FBSTtVQUNSQyxNQUFNLEdBQUcsTUFBTUQsWUFBTixFQUFmOztJQUNBQyxNQUFNLENBQUNzSyxZQUFQLEdBQXNCLEtBQUtBLFlBQTNCO1dBQ090SyxNQUFQOzs7RUFFRjBCLEtBQUssQ0FBRW5ELE9BQUYsRUFBVztJQUNkQSxPQUFPLENBQUNxRCxRQUFSLEdBQW1CLElBQW5CO1dBQ08sSUFBSSxLQUFLcEQsS0FBTCxDQUFXcUQsUUFBWCxDQUFvQjJJLFdBQXhCLENBQW9Dak0sT0FBcEMsQ0FBUDs7O1FBRUlrTSxvQkFBTixDQUE0QkMsV0FBNUIsRUFBeUM7UUFDbkMsS0FBS0gsd0JBQUwsQ0FBOEJHLFdBQTlCLE1BQStDaEssU0FBbkQsRUFBOEQ7YUFDckQsS0FBSzZKLHdCQUFMLENBQThCRyxXQUE5QixDQUFQO0tBREYsTUFFTztZQUNDQyxTQUFTLEdBQUcsS0FBS25NLEtBQUwsQ0FBV2lJLE9BQVgsQ0FBbUJpRSxXQUFuQixFQUFnQy9JLEtBQWxEO1lBQ01pSixNQUFNLEdBQUcsRUFBZjs7V0FDSyxNQUFNakosS0FBWCxJQUFvQixLQUFLQSxLQUFMLENBQVc2QyxtQkFBWCxDQUErQm1HLFNBQS9CLENBQXBCLEVBQStEO1FBQzdEQyxNQUFNLENBQUNwTyxJQUFQLENBQVltRixLQUFLLENBQUNqRCxPQUFsQixFQUQ2RDs7Y0FHdkRpRCxLQUFLLENBQUNTLFVBQU4sRUFBTjs7O1dBRUdtSSx3QkFBTCxDQUE4QkcsV0FBOUIsSUFBNkNFLE1BQTdDO2FBQ08sS0FBS0wsd0JBQUwsQ0FBOEJHLFdBQTlCLENBQVA7Ozs7RUFHSlQsZ0JBQWdCLEdBQUk7V0FDWCxJQUFQOzs7RUFFRkUsZ0JBQWdCLEdBQUk7VUFDWkcsWUFBWSxHQUFHbE4sTUFBTSxDQUFDc0YsSUFBUCxDQUFZLEtBQUs0SCxZQUFqQixDQUFyQjs7VUFDTS9MLE9BQU8sR0FBRyxNQUFNd0IsWUFBTixFQUFoQjs7UUFFSXVLLFlBQVksQ0FBQzNILE1BQWIsR0FBc0IsQ0FBMUIsRUFBNkI7OztXQUd0QmtJLGtCQUFMO0tBSEYsTUFJTyxJQUFJUCxZQUFZLENBQUMzSCxNQUFiLEtBQXdCLENBQTVCLEVBQStCOzs7WUFHOUJtSSxTQUFTLEdBQUcsS0FBS3RNLEtBQUwsQ0FBV2lJLE9BQVgsQ0FBbUI2RCxZQUFZLENBQUMsQ0FBRCxDQUEvQixDQUFsQjtNQUNBL0wsT0FBTyxDQUFDd00sYUFBUixHQUF3QkQsU0FBUyxDQUFDQyxhQUFsQztNQUNBeE0sT0FBTyxDQUFDeU0sYUFBUixHQUF3QkYsU0FBUyxDQUFDQyxhQUFsQztNQUNBeE0sT0FBTyxDQUFDME0sUUFBUixHQUFtQkgsU0FBUyxDQUFDRyxRQUE3QjtNQUNBSCxTQUFTLENBQUNsRSxNQUFWO0tBUEssTUFRQSxJQUFJMEQsWUFBWSxDQUFDM0gsTUFBYixLQUF3QixDQUE1QixFQUErQjtVQUNoQ3VJLGVBQWUsR0FBRyxLQUFLMU0sS0FBTCxDQUFXaUksT0FBWCxDQUFtQjZELFlBQVksQ0FBQyxDQUFELENBQS9CLENBQXRCO1VBQ0lhLGVBQWUsR0FBRyxLQUFLM00sS0FBTCxDQUFXaUksT0FBWCxDQUFtQjZELFlBQVksQ0FBQyxDQUFELENBQS9CLENBQXRCLENBRm9DOztNQUlwQy9MLE9BQU8sQ0FBQzBNLFFBQVIsR0FBbUIsS0FBbkI7O1VBQ0lDLGVBQWUsQ0FBQ0QsUUFBaEIsSUFBNEJFLGVBQWUsQ0FBQ0YsUUFBaEQsRUFBMEQ7WUFDcERDLGVBQWUsQ0FBQ0YsYUFBaEIsS0FBa0MsS0FBS3ZCLE9BQXZDLElBQ0EwQixlQUFlLENBQUNKLGFBQWhCLEtBQWtDLEtBQUt0QixPQUQzQyxFQUNvRDs7VUFFbERsTCxPQUFPLENBQUMwTSxRQUFSLEdBQW1CLElBQW5CO1NBSEYsTUFJTyxJQUFJQyxlQUFlLENBQUNILGFBQWhCLEtBQWtDLEtBQUt0QixPQUF2QyxJQUNBMEIsZUFBZSxDQUFDSCxhQUFoQixLQUFrQyxLQUFLdkIsT0FEM0MsRUFDb0Q7O1VBRXpEMEIsZUFBZSxHQUFHLEtBQUszTSxLQUFMLENBQVdpSSxPQUFYLENBQW1CNkQsWUFBWSxDQUFDLENBQUQsQ0FBL0IsQ0FBbEI7VUFDQVksZUFBZSxHQUFHLEtBQUsxTSxLQUFMLENBQVdpSSxPQUFYLENBQW1CNkQsWUFBWSxDQUFDLENBQUQsQ0FBL0IsQ0FBbEI7VUFDQS9MLE9BQU8sQ0FBQzBNLFFBQVIsR0FBbUIsSUFBbkI7O09BZmdDOzs7TUFtQnBDMU0sT0FBTyxDQUFDd00sYUFBUixHQUF3QkcsZUFBZSxDQUFDekIsT0FBeEM7TUFDQWxMLE9BQU8sQ0FBQ3lNLGFBQVIsR0FBd0JHLGVBQWUsQ0FBQzFCLE9BQXhDLENBcEJvQzs7TUFzQnBDeUIsZUFBZSxDQUFDdEUsTUFBaEI7TUFDQXVFLGVBQWUsQ0FBQ3ZFLE1BQWhCOzs7U0FFR0EsTUFBTDtXQUNPckksT0FBTyxDQUFDa0wsT0FBZjtXQUNPbEwsT0FBTyxDQUFDK0wsWUFBZjtJQUNBL0wsT0FBTyxDQUFDVCxJQUFSLEdBQWUsV0FBZjtTQUNLNkQsS0FBTCxDQUFXcEIsS0FBWDtXQUNPLEtBQUsvQixLQUFMLENBQVcwTCxRQUFYLENBQW9CM0wsT0FBcEIsQ0FBUDs7O0VBRUY2TSxrQkFBa0IsQ0FBRTtJQUFFQyxjQUFGO0lBQWtCSixRQUFsQjtJQUE0QnhILFNBQTVCO0lBQXVDNkg7R0FBekMsRUFBMkQ7VUFDckVDLFFBQVEsR0FBRyxLQUFLdkIsWUFBTCxDQUFrQnZHLFNBQWxCLENBQWpCO1VBQ00rSCxTQUFTLEdBQUdILGNBQWMsQ0FBQ3JCLFlBQWYsQ0FBNEJzQixjQUE1QixDQUFsQjtVQUNNRyxjQUFjLEdBQUdGLFFBQVEsQ0FBQ2hGLE9BQVQsQ0FBaUIsQ0FBQ2lGLFNBQUQsQ0FBakIsQ0FBdkI7O1VBQ01FLFlBQVksR0FBRyxLQUFLbE4sS0FBTCxDQUFXbU4sV0FBWCxDQUF1QjtNQUMxQzdOLElBQUksRUFBRSxXQURvQztNQUUxQ1ksT0FBTyxFQUFFK00sY0FBYyxDQUFDL00sT0FGa0I7TUFHMUN1TSxRQUgwQztNQUkxQ0YsYUFBYSxFQUFFLEtBQUt0QixPQUpzQjtNQUsxQ3VCLGFBQWEsRUFBRUssY0FBYyxDQUFDNUI7S0FMWCxDQUFyQjs7U0FPS2EsWUFBTCxDQUFrQm9CLFlBQVksQ0FBQ2pDLE9BQS9CLElBQTBDLElBQTFDO0lBQ0E0QixjQUFjLENBQUNmLFlBQWYsQ0FBNEJvQixZQUFZLENBQUNqQyxPQUF6QyxJQUFvRCxJQUFwRDs7U0FDS2pMLEtBQUwsQ0FBV3NMLFdBQVg7O1dBQ080QixZQUFQOzs7RUFFRkUsa0JBQWtCLENBQUVyTixPQUFGLEVBQVc7VUFDckJ1TSxTQUFTLEdBQUd2TSxPQUFPLENBQUN1TSxTQUExQjtXQUNPdk0sT0FBTyxDQUFDdU0sU0FBZjtJQUNBdk0sT0FBTyxDQUFDc04sU0FBUixHQUFvQixJQUFwQjtXQUNPZixTQUFTLENBQUNNLGtCQUFWLENBQTZCN00sT0FBN0IsQ0FBUDs7O0VBRUZzTSxrQkFBa0IsR0FBSTtTQUNmLE1BQU1ILFdBQVgsSUFBMEJ0TixNQUFNLENBQUNzRixJQUFQLENBQVksS0FBSzRILFlBQWpCLENBQTFCLEVBQTBEO1lBQ2xEUSxTQUFTLEdBQUcsS0FBS3RNLEtBQUwsQ0FBV2lJLE9BQVgsQ0FBbUJpRSxXQUFuQixDQUFsQjs7VUFDSUksU0FBUyxDQUFDQyxhQUFWLEtBQTRCLEtBQUt0QixPQUFyQyxFQUE4QztRQUM1Q3FCLFNBQVMsQ0FBQ2dCLGdCQUFWOzs7VUFFRWhCLFNBQVMsQ0FBQ0UsYUFBVixLQUE0QixLQUFLdkIsT0FBckMsRUFBOEM7UUFDNUNxQixTQUFTLENBQUNpQixnQkFBVjs7Ozs7RUFJTm5GLE1BQU0sR0FBSTtTQUNIaUUsa0JBQUw7VUFDTWpFLE1BQU47Ozs7O0FDcEhKLE1BQU1vRixTQUFOLFNBQXdCeEMsWUFBeEIsQ0FBcUM7RUFDbkMxTixXQUFXLENBQUV5QyxPQUFGLEVBQVc7VUFDZEEsT0FBTjtTQUNLd00sYUFBTCxHQUFxQnhNLE9BQU8sQ0FBQ3dNLGFBQVIsSUFBeUIsSUFBOUM7U0FDS0MsYUFBTCxHQUFxQnpNLE9BQU8sQ0FBQ3lNLGFBQVIsSUFBeUIsSUFBOUM7U0FDS0MsUUFBTCxHQUFnQjFNLE9BQU8sQ0FBQzBNLFFBQVIsSUFBb0IsS0FBcEM7OztFQUVGbEwsWUFBWSxHQUFJO1VBQ1JDLE1BQU0sR0FBRyxNQUFNRCxZQUFOLEVBQWY7O0lBRUFDLE1BQU0sQ0FBQytLLGFBQVAsR0FBdUIsS0FBS0EsYUFBNUI7SUFDQS9LLE1BQU0sQ0FBQ2dMLGFBQVAsR0FBdUIsS0FBS0EsYUFBNUI7SUFDQWhMLE1BQU0sQ0FBQ2lMLFFBQVAsR0FBa0IsS0FBS0EsUUFBdkI7V0FDT2pMLE1BQVA7OztFQUVGMEIsS0FBSyxDQUFFbkQsT0FBRixFQUFXO0lBQ2RBLE9BQU8sQ0FBQ3FELFFBQVIsR0FBbUIsSUFBbkI7V0FDTyxJQUFJLEtBQUtwRCxLQUFMLENBQVdxRCxRQUFYLENBQW9Cb0ssV0FBeEIsQ0FBb0MxTixPQUFwQyxDQUFQOzs7RUFFRjJOLGNBQWMsQ0FBRUMsVUFBRixFQUFjO1FBQ3RCeEIsU0FBSjtRQUNJOUUsS0FBSyxHQUFHLEtBQUtsRSxLQUFMLENBQVc2QyxtQkFBWCxDQUErQjJILFVBQVUsQ0FBQ3hLLEtBQTFDLENBQVo7O1FBQ0lrRSxLQUFLLEtBQUssSUFBZCxFQUFvQjtZQUNaLElBQUlsSCxLQUFKLENBQVcsZ0VBQVgsQ0FBTjtLQURGLE1BRU8sSUFBSWtILEtBQUssQ0FBQ2xELE1BQU4sSUFBZ0IsQ0FBcEIsRUFBdUI7OztNQUc1QmdJLFNBQVMsR0FBRyxLQUFLaEosS0FBTCxDQUFXNEUsT0FBWCxDQUFtQjRGLFVBQVUsQ0FBQ3hLLEtBQTlCLENBQVo7S0FISyxNQUlBOztVQUVEeUssWUFBWSxHQUFHLEtBQW5CO01BQ0F2RyxLQUFLLEdBQUdBLEtBQUssQ0FBQ2hGLEtBQU4sQ0FBWSxDQUFaLEVBQWVnRixLQUFLLENBQUNsRCxNQUFOLEdBQWUsQ0FBOUIsRUFBaUN3QyxHQUFqQyxDQUFxQyxDQUFDeEQsS0FBRCxFQUFRMEssSUFBUixLQUFpQjtRQUM1REQsWUFBWSxHQUFHQSxZQUFZLElBQUl6SyxLQUFLLENBQUM3RCxJQUFOLENBQVd3TyxVQUFYLENBQXNCLFFBQXRCLENBQS9CO2VBQ087VUFBRTNLLEtBQUY7VUFBUzBLO1NBQWhCO09BRk0sQ0FBUjs7VUFJSUQsWUFBSixFQUFrQjtRQUNoQnZHLEtBQUssR0FBR0EsS0FBSyxDQUFDUixNQUFOLENBQWEsQ0FBQztVQUFFMUQ7U0FBSCxLQUFlO2lCQUMzQkEsS0FBSyxDQUFDN0QsSUFBTixDQUFXd08sVUFBWCxDQUFzQixRQUF0QixDQUFQO1NBRE0sQ0FBUjs7O01BSUYzQixTQUFTLEdBQUc5RSxLQUFLLENBQUMsQ0FBRCxDQUFMLENBQVNsRSxLQUFyQjs7O1dBRUtnSixTQUFQOzs7UUFFSTRCLHNCQUFOLEdBQWdDO1FBQzFCLEtBQUtDLHlCQUFMLEtBQW1DOUwsU0FBdkMsRUFBa0Q7YUFDekMsS0FBSzhMLHlCQUFaO0tBREYsTUFFTyxJQUFJLEtBQUt6QixhQUFMLEtBQXVCLElBQTNCLEVBQWlDO2FBQy9CLEVBQVA7S0FESyxNQUVBO1lBQ0MwQixXQUFXLEdBQUcsS0FBS2pPLEtBQUwsQ0FBV2lJLE9BQVgsQ0FBbUIsS0FBS3NFLGFBQXhCLEVBQXVDcEosS0FBM0Q7WUFDTWlKLE1BQU0sR0FBRyxFQUFmOztXQUNLLE1BQU1qSixLQUFYLElBQW9CLEtBQUtBLEtBQUwsQ0FBVzZDLG1CQUFYLENBQStCaUksV0FBL0IsQ0FBcEIsRUFBaUU7UUFDL0Q3QixNQUFNLENBQUNwTyxJQUFQLENBQVltRixLQUFLLENBQUNqRCxPQUFsQixFQUQrRDs7Y0FHekRpRCxLQUFLLENBQUNTLFVBQU4sRUFBTjs7O1dBRUdvSyx5QkFBTCxHQUFpQzVCLE1BQWpDO2FBQ08sS0FBSzRCLHlCQUFaOzs7O1FBR0VFLHNCQUFOLEdBQWdDO1FBQzFCLEtBQUtDLHlCQUFMLEtBQW1Dak0sU0FBdkMsRUFBa0Q7YUFDekMsS0FBS2lNLHlCQUFaO0tBREYsTUFFTyxJQUFJLEtBQUszQixhQUFMLEtBQXVCLElBQTNCLEVBQWlDO2FBQy9CLEVBQVA7S0FESyxNQUVBO1lBQ0NqRyxXQUFXLEdBQUcsS0FBS3ZHLEtBQUwsQ0FBV2lJLE9BQVgsQ0FBbUIsS0FBS3VFLGFBQXhCLEVBQXVDckosS0FBM0Q7WUFDTWlKLE1BQU0sR0FBRyxFQUFmOztXQUNLLE1BQU1qSixLQUFYLElBQW9CLEtBQUtBLEtBQUwsQ0FBVzZDLG1CQUFYLENBQStCTyxXQUEvQixDQUFwQixFQUFpRTtRQUMvRDZGLE1BQU0sQ0FBQ3BPLElBQVAsQ0FBWW1GLEtBQUssQ0FBQ2pELE9BQWxCLEVBRCtEOztjQUd6RGlELEtBQUssQ0FBQ1MsVUFBTixFQUFOOzs7V0FFR3VLLHlCQUFMLEdBQWlDL0IsTUFBakM7YUFDTyxLQUFLK0IseUJBQVo7Ozs7RUFHSjFDLGdCQUFnQixHQUFJO1VBQ1o5TCxJQUFJLEdBQUcsS0FBSzRCLFlBQUwsRUFBYjs7U0FDSzZHLE1BQUw7SUFDQXpJLElBQUksQ0FBQ0wsSUFBTCxHQUFZLFdBQVo7V0FDT0ssSUFBSSxDQUFDc0wsT0FBWjs7VUFDTW1ELFlBQVksR0FBRyxLQUFLcE8sS0FBTCxDQUFXbU4sV0FBWCxDQUF1QnhOLElBQXZCLENBQXJCOztRQUVJQSxJQUFJLENBQUM0TSxhQUFULEVBQXdCO1lBQ2hCOEIsV0FBVyxHQUFHLEtBQUtyTyxLQUFMLENBQVdpSSxPQUFYLENBQW1CLEtBQUtzRSxhQUF4QixDQUFwQjs7WUFDTUosU0FBUyxHQUFHLEtBQUt1QixjQUFMLENBQW9CVyxXQUFwQixDQUFsQjs7WUFDTTNCLGVBQWUsR0FBRyxLQUFLMU0sS0FBTCxDQUFXbU4sV0FBWCxDQUF1QjtRQUM3QzdOLElBQUksRUFBRSxXQUR1QztRQUU3Q1ksT0FBTyxFQUFFaU0sU0FBUyxDQUFDak0sT0FGMEI7UUFHN0N1TSxRQUFRLEVBQUU5TSxJQUFJLENBQUM4TSxRQUg4QjtRQUk3Q0YsYUFBYSxFQUFFNU0sSUFBSSxDQUFDNE0sYUFKeUI7UUFLN0NDLGFBQWEsRUFBRTRCLFlBQVksQ0FBQ25EO09BTE4sQ0FBeEI7O01BT0FvRCxXQUFXLENBQUN2QyxZQUFaLENBQXlCWSxlQUFlLENBQUN6QixPQUF6QyxJQUFvRCxJQUFwRDtNQUNBbUQsWUFBWSxDQUFDdEMsWUFBYixDQUEwQlksZUFBZSxDQUFDekIsT0FBMUMsSUFBcUQsSUFBckQ7OztRQUVFdEwsSUFBSSxDQUFDNk0sYUFBTCxJQUFzQjdNLElBQUksQ0FBQzRNLGFBQUwsS0FBdUI1TSxJQUFJLENBQUM2TSxhQUF0RCxFQUFxRTtZQUM3RDhCLFdBQVcsR0FBRyxLQUFLdE8sS0FBTCxDQUFXaUksT0FBWCxDQUFtQixLQUFLdUUsYUFBeEIsQ0FBcEI7O1lBQ01MLFNBQVMsR0FBRyxLQUFLdUIsY0FBTCxDQUFvQlksV0FBcEIsQ0FBbEI7O1lBQ00zQixlQUFlLEdBQUcsS0FBSzNNLEtBQUwsQ0FBV21OLFdBQVgsQ0FBdUI7UUFDN0M3TixJQUFJLEVBQUUsV0FEdUM7UUFFN0NZLE9BQU8sRUFBRWlNLFNBQVMsQ0FBQ2pNLE9BRjBCO1FBRzdDdU0sUUFBUSxFQUFFOU0sSUFBSSxDQUFDOE0sUUFIOEI7UUFJN0NGLGFBQWEsRUFBRTZCLFlBQVksQ0FBQ25ELE9BSmlCO1FBSzdDdUIsYUFBYSxFQUFFN00sSUFBSSxDQUFDNk07T0FMRSxDQUF4Qjs7TUFPQThCLFdBQVcsQ0FBQ3hDLFlBQVosQ0FBeUJhLGVBQWUsQ0FBQzFCLE9BQXpDLElBQW9ELElBQXBEO01BQ0FtRCxZQUFZLENBQUN0QyxZQUFiLENBQTBCYSxlQUFlLENBQUMxQixPQUExQyxJQUFxRCxJQUFyRDs7O1NBRUc5SCxLQUFMLENBQVdwQixLQUFYOztTQUNLL0IsS0FBTCxDQUFXc0wsV0FBWDs7V0FDTzhDLFlBQVA7OztFQUVGekMsZ0JBQWdCLEdBQUk7V0FDWCxJQUFQOzs7RUFFRmlCLGtCQUFrQixDQUFFO0lBQUVTLFNBQUY7SUFBYWtCLFNBQWI7SUFBd0JDLGFBQXhCO0lBQXVDQztHQUF6QyxFQUEwRDtRQUN0RUYsU0FBSixFQUFlO1dBQ1I5QixRQUFMLEdBQWdCLElBQWhCOzs7UUFFRThCLFNBQVMsS0FBSyxRQUFkLElBQTBCQSxTQUFTLEtBQUssUUFBNUMsRUFBc0Q7TUFDcERBLFNBQVMsR0FBRyxLQUFLL0IsYUFBTCxLQUF1QixJQUF2QixHQUE4QixRQUE5QixHQUF5QyxRQUFyRDs7O1FBRUUrQixTQUFTLEtBQUssUUFBbEIsRUFBNEI7V0FDckJHLGFBQUwsQ0FBbUI7UUFBRXJCLFNBQUY7UUFBYW1CLGFBQWI7UUFBNEJDO09BQS9DO0tBREYsTUFFTztXQUNBRSxhQUFMLENBQW1CO1FBQUV0QixTQUFGO1FBQWFtQixhQUFiO1FBQTRCQztPQUEvQzs7O1NBRUd6TyxLQUFMLENBQVdzTCxXQUFYOzs7RUFFRnNELG1CQUFtQixDQUFFckMsYUFBRixFQUFpQjtRQUM5QixDQUFDQSxhQUFMLEVBQW9CO1dBQ2JFLFFBQUwsR0FBZ0IsS0FBaEI7S0FERixNQUVPO1dBQ0FBLFFBQUwsR0FBZ0IsSUFBaEI7O1VBQ0lGLGFBQWEsS0FBSyxLQUFLQSxhQUEzQixFQUEwQztZQUNwQ0EsYUFBYSxLQUFLLEtBQUtDLGFBQTNCLEVBQTBDO2dCQUNsQyxJQUFJck0sS0FBSixDQUFXLHVDQUFzQ29NLGFBQWMsRUFBL0QsQ0FBTjs7O1lBRUU1TSxJQUFJLEdBQUcsS0FBSzRNLGFBQWhCO2FBQ0tBLGFBQUwsR0FBcUIsS0FBS0MsYUFBMUI7YUFDS0EsYUFBTCxHQUFxQjdNLElBQXJCOzs7O1NBR0NLLEtBQUwsQ0FBV3NMLFdBQVg7OztFQUVGcUQsYUFBYSxDQUFFO0lBQ2J0QixTQURhO0lBRWJtQixhQUFhLEdBQUcsSUFGSDtJQUdiQyxhQUFhLEdBQUcsSUFISDtJQUliSSxRQUFRLEdBQUc7TUFDVCxFQUxTLEVBS0w7UUFDRixLQUFLdEMsYUFBVCxFQUF3QjtXQUNqQmUsZ0JBQUwsQ0FBc0I7UUFBRXVCLFFBQVEsRUFBRTtPQUFsQzs7O1NBRUd0QyxhQUFMLEdBQXFCYyxTQUFTLENBQUNwQyxPQUEvQjtVQUNNb0QsV0FBVyxHQUFHLEtBQUtyTyxLQUFMLENBQVdpSSxPQUFYLENBQW1CLEtBQUtzRSxhQUF4QixDQUFwQjtJQUNBOEIsV0FBVyxDQUFDdkMsWUFBWixDQUF5QixLQUFLYixPQUE5QixJQUF5QyxJQUF6QztVQUVNNkQsUUFBUSxHQUFHTCxhQUFhLEtBQUssSUFBbEIsR0FBeUIsS0FBS3RMLEtBQTlCLEdBQXNDLEtBQUtxSSxZQUFMLENBQWtCaUQsYUFBbEIsQ0FBdkQ7VUFDTU0sUUFBUSxHQUFHUCxhQUFhLEtBQUssSUFBbEIsR0FBeUJILFdBQVcsQ0FBQ2xMLEtBQXJDLEdBQTZDa0wsV0FBVyxDQUFDN0MsWUFBWixDQUF5QmdELGFBQXpCLENBQTlEO0lBQ0FNLFFBQVEsQ0FBQy9HLE9BQVQsQ0FBaUIsQ0FBQ2dILFFBQUQsQ0FBakI7O1FBRUksQ0FBQ0YsUUFBTCxFQUFlO1dBQU83TyxLQUFMLENBQVdzTCxXQUFYOzs7O0VBRW5Cb0QsYUFBYSxDQUFFO0lBQ2JyQixTQURhO0lBRWJtQixhQUFhLEdBQUcsSUFGSDtJQUdiQyxhQUFhLEdBQUcsSUFISDtJQUliSSxRQUFRLEdBQUc7TUFDVCxFQUxTLEVBS0w7UUFDRixLQUFLckMsYUFBVCxFQUF3QjtXQUNqQmUsZ0JBQUwsQ0FBc0I7UUFBRXNCLFFBQVEsRUFBRTtPQUFsQzs7O1NBRUdyQyxhQUFMLEdBQXFCYSxTQUFTLENBQUNwQyxPQUEvQjtVQUNNcUQsV0FBVyxHQUFHLEtBQUt0TyxLQUFMLENBQVdpSSxPQUFYLENBQW1CLEtBQUt1RSxhQUF4QixDQUFwQjtJQUNBOEIsV0FBVyxDQUFDeEMsWUFBWixDQUF5QixLQUFLYixPQUE5QixJQUF5QyxJQUF6QztVQUVNNkQsUUFBUSxHQUFHTCxhQUFhLEtBQUssSUFBbEIsR0FBeUIsS0FBS3RMLEtBQTlCLEdBQXNDLEtBQUtxSSxZQUFMLENBQWtCaUQsYUFBbEIsQ0FBdkQ7VUFDTU0sUUFBUSxHQUFHUCxhQUFhLEtBQUssSUFBbEIsR0FBeUJGLFdBQVcsQ0FBQ25MLEtBQXJDLEdBQTZDbUwsV0FBVyxDQUFDOUMsWUFBWixDQUF5QmdELGFBQXpCLENBQTlEO0lBQ0FNLFFBQVEsQ0FBQy9HLE9BQVQsQ0FBaUIsQ0FBQ2dILFFBQUQsQ0FBakI7O1FBRUksQ0FBQ0YsUUFBTCxFQUFlO1dBQU83TyxLQUFMLENBQVdzTCxXQUFYOzs7O0VBRW5CZ0MsZ0JBQWdCLENBQUU7SUFBRXVCLFFBQVEsR0FBRztNQUFVLEVBQXpCLEVBQTZCO1VBQ3JDRyxtQkFBbUIsR0FBRyxLQUFLaFAsS0FBTCxDQUFXaUksT0FBWCxDQUFtQixLQUFLc0UsYUFBeEIsQ0FBNUI7O1FBQ0l5QyxtQkFBSixFQUF5QjthQUNoQkEsbUJBQW1CLENBQUNsRCxZQUFwQixDQUFpQyxLQUFLYixPQUF0QyxDQUFQO2FBQ08rRCxtQkFBbUIsQ0FBQ2pELHdCQUFwQixDQUE2QyxLQUFLZCxPQUFsRCxDQUFQOzs7V0FFSyxLQUFLK0MseUJBQVo7O1FBQ0ksQ0FBQ2EsUUFBTCxFQUFlO1dBQU83TyxLQUFMLENBQVdzTCxXQUFYOzs7O0VBRW5CaUMsZ0JBQWdCLENBQUU7SUFBRXNCLFFBQVEsR0FBRztNQUFVLEVBQXpCLEVBQTZCO1VBQ3JDSSxtQkFBbUIsR0FBRyxLQUFLalAsS0FBTCxDQUFXaUksT0FBWCxDQUFtQixLQUFLdUUsYUFBeEIsQ0FBNUI7O1FBQ0l5QyxtQkFBSixFQUF5QjthQUNoQkEsbUJBQW1CLENBQUNuRCxZQUFwQixDQUFpQyxLQUFLYixPQUF0QyxDQUFQO2FBQ09nRSxtQkFBbUIsQ0FBQ2xELHdCQUFwQixDQUE2QyxLQUFLZCxPQUFsRCxDQUFQOzs7V0FFSyxLQUFLa0QseUJBQVo7O1FBQ0ksQ0FBQ1UsUUFBTCxFQUFlO1dBQU83TyxLQUFMLENBQVdzTCxXQUFYOzs7O0VBRW5CbEQsTUFBTSxHQUFJO1NBQ0hrRixnQkFBTCxDQUFzQjtNQUFFdUIsUUFBUSxFQUFFO0tBQWxDO1NBQ0t0QixnQkFBTCxDQUFzQjtNQUFFc0IsUUFBUSxFQUFFO0tBQWxDO1VBQ016RyxNQUFOOzs7Ozs7Ozs7Ozs7O0FDOU1KLE1BQU05RSxjQUFOLFNBQTZCbEcsZ0JBQWdCLENBQUNpQyxjQUFELENBQTdDLENBQThEO0VBQzVEL0IsV0FBVyxDQUFFeUMsT0FBRixFQUFXOztTQUVmN0IsS0FBTCxHQUFhNkIsT0FBTyxDQUFDN0IsS0FBckI7U0FDS2lGLEtBQUwsR0FBYXBELE9BQU8sQ0FBQ29ELEtBQXJCOztRQUNJLEtBQUtqRixLQUFMLEtBQWVnRSxTQUFmLElBQTRCLENBQUMsS0FBS2lCLEtBQXRDLEVBQTZDO1lBQ3JDLElBQUloRCxLQUFKLENBQVcsOEJBQVgsQ0FBTjs7O1NBRUdpRCxRQUFMLEdBQWdCckQsT0FBTyxDQUFDcUQsUUFBUixJQUFvQixJQUFwQztTQUNLTCxHQUFMLEdBQVdoRCxPQUFPLENBQUNnRCxHQUFSLElBQWUsRUFBMUI7U0FDS29ILGNBQUwsR0FBc0JwSyxPQUFPLENBQUNvSyxjQUFSLElBQTBCLEVBQWhEOzs7RUFFRjFHLFdBQVcsQ0FBRWlGLElBQUYsRUFBUTtTQUNaeUIsY0FBTCxDQUFvQnpCLElBQUksQ0FBQ3ZGLEtBQUwsQ0FBV2pELE9BQS9CLElBQTBDLEtBQUtpSyxjQUFMLENBQW9CekIsSUFBSSxDQUFDdkYsS0FBTCxDQUFXakQsT0FBL0IsS0FBMkMsRUFBckY7O1FBQ0ksS0FBS2lLLGNBQUwsQ0FBb0J6QixJQUFJLENBQUN2RixLQUFMLENBQVdqRCxPQUEvQixFQUF3Q25DLE9BQXhDLENBQWdEMkssSUFBaEQsTUFBMEQsQ0FBQyxDQUEvRCxFQUFrRTtXQUMzRHlCLGNBQUwsQ0FBb0J6QixJQUFJLENBQUN2RixLQUFMLENBQVdqRCxPQUEvQixFQUF3Q2xDLElBQXhDLENBQTZDMEssSUFBN0M7Ozs7RUFHSnpGLFVBQVUsR0FBSTtTQUNQLE1BQU1pTSxRQUFYLElBQXVCdFEsTUFBTSxDQUFDd0QsTUFBUCxDQUFjLEtBQUsrSCxjQUFuQixDQUF2QixFQUEyRDtXQUNwRCxNQUFNekIsSUFBWCxJQUFtQndHLFFBQW5CLEVBQTZCO2NBQ3JCaFIsS0FBSyxHQUFHLENBQUN3SyxJQUFJLENBQUN5QixjQUFMLENBQW9CLEtBQUtoSCxLQUFMLENBQVdqRCxPQUEvQixLQUEyQyxFQUE1QyxFQUFnRG5DLE9BQWhELENBQXdELElBQXhELENBQWQ7O1lBQ0lHLEtBQUssS0FBSyxDQUFDLENBQWYsRUFBa0I7VUFDaEJ3SyxJQUFJLENBQUN5QixjQUFMLENBQW9CLEtBQUtoSCxLQUFMLENBQVdqRCxPQUEvQixFQUF3Qy9CLE1BQXhDLENBQStDRCxLQUEvQyxFQUFzRCxDQUF0RDs7Ozs7U0FJRGlNLGNBQUwsR0FBc0IsRUFBdEI7OztHQUVBZ0Ysd0JBQUYsQ0FBNEJDLFFBQTVCLEVBQXNDO1FBQ2hDQSxRQUFRLENBQUNqTCxNQUFULEtBQW9CLENBQXhCLEVBQTJCO2FBQ2hCLEtBQUtnRyxjQUFMLENBQW9CaUYsUUFBUSxDQUFDLENBQUQsQ0FBNUIsS0FBb0MsRUFBN0M7S0FERixNQUVPO1lBQ0NDLFdBQVcsR0FBR0QsUUFBUSxDQUFDLENBQUQsQ0FBNUI7WUFDTUUsaUJBQWlCLEdBQUdGLFFBQVEsQ0FBQy9NLEtBQVQsQ0FBZSxDQUFmLENBQTFCOztXQUNLLE1BQU1xRyxJQUFYLElBQW1CLEtBQUt5QixjQUFMLENBQW9Ca0YsV0FBcEIsS0FBb0MsRUFBdkQsRUFBMkQ7ZUFDakQzRyxJQUFJLENBQUN5Ryx3QkFBTCxDQUE4QkcsaUJBQTlCLENBQVI7Ozs7Ozs7QUFLUjFRLE1BQU0sQ0FBQ0ksY0FBUCxDQUFzQnNFLGNBQXRCLEVBQXNDLE1BQXRDLEVBQThDO0VBQzVDNUQsR0FBRyxHQUFJO1dBQ0UsY0FBYzJJLElBQWQsQ0FBbUIsS0FBSzFFLElBQXhCLEVBQThCLENBQTlCLENBQVA7OztDQUZKOztBQzFDQSxNQUFNcUksV0FBTixTQUEwQjFJLGNBQTFCLENBQXlDO0VBQ3ZDaEcsV0FBVyxDQUFFeUMsT0FBRixFQUFXO1VBQ2RBLE9BQU47O1FBQ0ksQ0FBQyxLQUFLcUQsUUFBVixFQUFvQjtZQUNaLElBQUlqRCxLQUFKLENBQVcsc0JBQVgsQ0FBTjs7OztTQUdJb1AsS0FBUixDQUFlO0lBQUV0TixLQUFLLEdBQUdFLFFBQVY7SUFBb0JxTixPQUFPLEdBQUcsS0FBS3BNLFFBQUwsQ0FBYzBJO01BQWlCLEVBQTVFLEVBQWdGO1FBQzFFMU0sQ0FBQyxHQUFHLENBQVI7O1NBQ0ssTUFBTThNLFdBQVgsSUFBMEJ0TixNQUFNLENBQUNzRixJQUFQLENBQVlzTCxPQUFaLENBQTFCLEVBQWdEO1lBQ3hDQyxZQUFZLEdBQUcsTUFBTSxLQUFLck0sUUFBTCxDQUFjNkksb0JBQWQsQ0FBbUNDLFdBQW5DLENBQTNCO1lBQ00xSixRQUFRLEdBQUcsS0FBSzJNLHdCQUFMLENBQThCTSxZQUE5QixDQUFqQjtVQUNJOVAsSUFBSSxHQUFHNkMsUUFBUSxDQUFDRyxJQUFULEVBQVg7O2FBQ08sQ0FBQ2hELElBQUksQ0FBQ2lELElBQU4sSUFBY3hELENBQUMsR0FBRzZDLEtBQXpCLEVBQWdDO2NBQ3hCdEMsSUFBSSxDQUFDUixLQUFYO1FBQ0FDLENBQUM7UUFDRE8sSUFBSSxHQUFHNkMsUUFBUSxDQUFDRyxJQUFULEVBQVA7OztVQUVFdkQsQ0FBQyxJQUFJNkMsS0FBVCxFQUFnQjs7Ozs7Ozs7QUNsQnRCLE1BQU13TCxXQUFOLFNBQTBCbkssY0FBMUIsQ0FBeUM7RUFDdkNoRyxXQUFXLENBQUV5QyxPQUFGLEVBQVc7VUFDZEEsT0FBTjs7UUFDSSxDQUFDLEtBQUtxRCxRQUFWLEVBQW9CO1lBQ1osSUFBSWpELEtBQUosQ0FBVyxzQkFBWCxDQUFOOzs7O1NBR0l1UCxXQUFSLENBQXFCO0lBQUV6TixLQUFLLEdBQUdFO01BQWEsRUFBNUMsRUFBZ0Q7VUFDeENzTixZQUFZLEdBQUcsTUFBTSxLQUFLck0sUUFBTCxDQUFjMkssc0JBQWQsRUFBM0I7VUFDTXZMLFFBQVEsR0FBRyxLQUFLMk0sd0JBQUwsQ0FBOEJNLFlBQTlCLENBQWpCO1FBQ0k5UCxJQUFJLEdBQUc2QyxRQUFRLENBQUNHLElBQVQsRUFBWDtRQUNJdkQsQ0FBQyxHQUFHLENBQVI7O1dBQ08sQ0FBQ08sSUFBSSxDQUFDaUQsSUFBTixJQUFjeEQsQ0FBQyxHQUFHNkMsS0FBekIsRUFBZ0M7WUFDeEJ0QyxJQUFJLENBQUNSLEtBQVg7TUFDQUMsQ0FBQztNQUNETyxJQUFJLEdBQUc2QyxRQUFRLENBQUNHLElBQVQsRUFBUDs7OztTQUdJZ04sV0FBUixDQUFxQjtJQUFFMU4sS0FBSyxHQUFHRTtNQUFhLEVBQTVDLEVBQWdEO1VBQ3hDc04sWUFBWSxHQUFHLE1BQU0sS0FBS3JNLFFBQUwsQ0FBYzhLLHNCQUFkLEVBQTNCO1VBQ00xTCxRQUFRLEdBQUcsS0FBSzJNLHdCQUFMLENBQThCTSxZQUE5QixDQUFqQjtRQUNJOVAsSUFBSSxHQUFHNkMsUUFBUSxDQUFDRyxJQUFULEVBQVg7UUFDSXZELENBQUMsR0FBRyxDQUFSOztXQUNPLENBQUNPLElBQUksQ0FBQ2lELElBQU4sSUFBY3hELENBQUMsR0FBRzZDLEtBQXpCLEVBQWdDO1lBQ3hCdEMsSUFBSSxDQUFDUixLQUFYO01BQ0FDLENBQUM7TUFDRE8sSUFBSSxHQUFHNkMsUUFBUSxDQUFDRyxJQUFULEVBQVA7Ozs7Ozs7Ozs7Ozs7O0FDNUJOLE1BQU1pTixhQUFOLENBQW9CO0VBQ2xCdFMsV0FBVyxDQUFFO0lBQUVzRCxPQUFPLEdBQUcsRUFBWjtJQUFnQm1FLFFBQVEsR0FBRztNQUFVLEVBQXZDLEVBQTJDO1NBQy9DbkUsT0FBTCxHQUFlQSxPQUFmO1NBQ0ttRSxRQUFMLEdBQWdCQSxRQUFoQjs7O1FBRUk4SyxXQUFOLEdBQXFCO1dBQ1osS0FBS2pQLE9BQVo7OztTQUVNa1AsV0FBUixHQUF1QjtTQUNoQixNQUFNLENBQUNDLElBQUQsRUFBT0MsU0FBUCxDQUFYLElBQWdDcFIsTUFBTSxDQUFDZ0MsT0FBUCxDQUFlLEtBQUtBLE9BQXBCLENBQWhDLEVBQThEO1lBQ3REO1FBQUVtUCxJQUFGO1FBQVFDO09BQWQ7Ozs7U0FHSUMsVUFBUixHQUFzQjtTQUNmLE1BQU1GLElBQVgsSUFBbUJuUixNQUFNLENBQUNzRixJQUFQLENBQVksS0FBS3RELE9BQWpCLENBQW5CLEVBQThDO1lBQ3RDbVAsSUFBTjs7OztTQUdJRyxjQUFSLEdBQTBCO1NBQ25CLE1BQU1GLFNBQVgsSUFBd0JwUixNQUFNLENBQUN3RCxNQUFQLENBQWMsS0FBS3hCLE9BQW5CLENBQXhCLEVBQXFEO1lBQzdDb1AsU0FBTjs7OztRQUdFRyxZQUFOLENBQW9CSixJQUFwQixFQUEwQjtXQUNqQixLQUFLblAsT0FBTCxDQUFhbVAsSUFBYixLQUFzQixFQUE3Qjs7O1FBRUlLLFFBQU4sQ0FBZ0JMLElBQWhCLEVBQXNCNVEsS0FBdEIsRUFBNkI7O1NBRXRCeUIsT0FBTCxDQUFhbVAsSUFBYixJQUFxQixNQUFNLEtBQUtJLFlBQUwsQ0FBa0JKLElBQWxCLENBQTNCOztRQUNJLEtBQUtuUCxPQUFMLENBQWFtUCxJQUFiLEVBQW1CaFMsT0FBbkIsQ0FBMkJvQixLQUEzQixNQUFzQyxDQUFDLENBQTNDLEVBQThDO1dBQ3ZDeUIsT0FBTCxDQUFhbVAsSUFBYixFQUFtQi9SLElBQW5CLENBQXdCbUIsS0FBeEI7Ozs7Ozs7Ozs7OztBQ3JCTixJQUFJa1IsYUFBYSxHQUFHLENBQXBCO0FBQ0EsSUFBSUMsYUFBYSxHQUFHLENBQXBCOztBQUVBLE1BQU1DLElBQU4sU0FBbUJuVCxnQkFBZ0IsQ0FBQyxNQUFNLEVBQVAsQ0FBbkMsQ0FBOEM7RUFDNUNFLFdBQVcsQ0FBRWtULGFBQUYsRUFBY0MsWUFBZCxFQUE0Qjs7U0FFaENELFVBQUwsR0FBa0JBLGFBQWxCLENBRnFDOztTQUdoQ0MsWUFBTCxHQUFvQkEsWUFBcEIsQ0FIcUM7O1NBSWhDQyxJQUFMLEdBQVlBLElBQVosQ0FKcUM7O1NBTWhDQyxLQUFMLEdBQWEsS0FBYixDQU5xQzs7O1NBU2hDQyxlQUFMLEdBQXVCO2NBQ2IsTUFEYTthQUVkLEtBRmM7YUFHZCxLQUhjO2tCQUlULFVBSlM7a0JBS1Q7S0FMZCxDQVRxQzs7U0FrQmhDQyxNQUFMLEdBQWNBLE1BQWQ7U0FDS0MsT0FBTCxHQUFlQSxPQUFmO1NBQ0t6TixRQUFMLEdBQWdCQSxRQUFoQjtTQUNLME4sT0FBTCxHQUFlQSxPQUFmLENBckJxQzs7U0F3QmhDQyxlQUFMLEdBQXVCO01BQ3JCQyxRQUFRLEVBQUUsV0FBWW5PLFdBQVosRUFBeUI7Y0FBUUEsV0FBVyxDQUFDb08sT0FBbEI7T0FEaEI7TUFFckJDLEdBQUcsRUFBRSxXQUFZck8sV0FBWixFQUF5QjtZQUN4QixDQUFDQSxXQUFXLENBQUN5RyxhQUFiLElBQ0EsQ0FBQ3pHLFdBQVcsQ0FBQ3lHLGFBQVosQ0FBMEJBLGFBRDNCLElBRUEsT0FBT3pHLFdBQVcsQ0FBQ3lHLGFBQVosQ0FBMEJBLGFBQTFCLENBQXdDMkgsT0FBL0MsS0FBMkQsUUFGL0QsRUFFeUU7Z0JBQ2pFLElBQUlFLFNBQUosQ0FBZSxzQ0FBZixDQUFOOzs7Y0FFSUMsVUFBVSxHQUFHLE9BQU92TyxXQUFXLENBQUN5RyxhQUFaLENBQTBCMkgsT0FBcEQ7O1lBQ0ksRUFBRUcsVUFBVSxLQUFLLFFBQWYsSUFBMkJBLFVBQVUsS0FBSyxRQUE1QyxDQUFKLEVBQTJEO2dCQUNuRCxJQUFJRCxTQUFKLENBQWUsNEJBQWYsQ0FBTjtTQURGLE1BRU87Z0JBQ0N0TyxXQUFXLENBQUN5RyxhQUFaLENBQTBCMkgsT0FBaEM7O09BWmlCO01BZXJCSSxhQUFhLEVBQUUsV0FBWUMsZUFBWixFQUE2QkMsZ0JBQTdCLEVBQStDO2NBQ3REO1VBQ0pDLElBQUksRUFBRUYsZUFBZSxDQUFDTCxPQURsQjtVQUVKUSxLQUFLLEVBQUVGLGdCQUFnQixDQUFDTjtTQUYxQjtPQWhCbUI7TUFxQnJCUyxJQUFJLEVBQUVULE9BQU8sSUFBSVMsSUFBSSxDQUFDQyxJQUFJLENBQUNDLFNBQUwsQ0FBZVgsT0FBZixDQUFELENBckJBO01Bc0JyQlksSUFBSSxFQUFFLE1BQU07S0F0QmQsQ0F4QnFDOztTQWtEaEMvTCxNQUFMLEdBQWMsS0FBS2dNLE9BQUwsQ0FBYSxhQUFiLEVBQTRCLEtBQUtsQixNQUFqQyxDQUFkO0lBQ0FQLGFBQWEsR0FBRzFSLE1BQU0sQ0FBQ3NGLElBQVAsQ0FBWSxLQUFLNkIsTUFBakIsRUFDYm1DLE1BRGEsQ0FDTixDQUFDOEosVUFBRCxFQUFhOVIsT0FBYixLQUF5QjthQUN4QitSLElBQUksQ0FBQ0MsR0FBTCxDQUFTRixVQUFULEVBQXFCRyxRQUFRLENBQUNqUyxPQUFPLENBQUNrUyxLQUFSLENBQWMsWUFBZCxFQUE0QixDQUE1QixDQUFELENBQTdCLENBQVA7S0FGWSxFQUdYLENBSFcsSUFHTixDQUhWLENBbkRxQzs7U0F5RGhDbkssT0FBTCxHQUFlLEtBQUs4SixPQUFMLENBQWEsY0FBYixFQUE2QixLQUFLakIsT0FBbEMsQ0FBZjtJQUNBVCxhQUFhLEdBQUd6UixNQUFNLENBQUNzRixJQUFQLENBQVksS0FBSytELE9BQWpCLEVBQ2JDLE1BRGEsQ0FDTixDQUFDOEosVUFBRCxFQUFhL0csT0FBYixLQUF5QjthQUN4QmdILElBQUksQ0FBQ0MsR0FBTCxDQUFTRixVQUFULEVBQXFCRyxRQUFRLENBQUNsSCxPQUFPLENBQUNtSCxLQUFSLENBQWMsWUFBZCxFQUE0QixDQUE1QixDQUFELENBQTdCLENBQVA7S0FGWSxFQUdYLENBSFcsSUFHTixDQUhWOzs7RUFNRjdNLFVBQVUsR0FBSTtTQUNQOE0sU0FBTCxDQUFlLGFBQWYsRUFBOEIsS0FBS3RNLE1BQW5DO1NBQ0szSCxPQUFMLENBQWEsYUFBYjs7O0VBRUZrTixXQUFXLEdBQUk7U0FDUitHLFNBQUwsQ0FBZSxjQUFmLEVBQStCLEtBQUtwSyxPQUFwQztTQUNLN0osT0FBTCxDQUFhLGFBQWI7OztFQUdGMlQsT0FBTyxDQUFFTyxVQUFGLEVBQWNDLEtBQWQsRUFBcUI7UUFDdEJDLFNBQVMsR0FBRyxLQUFLL0IsWUFBTCxJQUFxQixLQUFLQSxZQUFMLENBQWtCZ0MsT0FBbEIsQ0FBMEJILFVBQTFCLENBQXJDO0lBQ0FFLFNBQVMsR0FBR0EsU0FBUyxHQUFHWixJQUFJLENBQUNjLEtBQUwsQ0FBV0YsU0FBWCxDQUFILEdBQTJCLEVBQWhEOztTQUNLLE1BQU0sQ0FBQ3JCLEdBQUQsRUFBTWhTLEtBQU4sQ0FBWCxJQUEyQlAsTUFBTSxDQUFDZ0MsT0FBUCxDQUFlNFIsU0FBZixDQUEzQixFQUFzRDtZQUM5Q2xULElBQUksR0FBR0gsS0FBSyxDQUFDRyxJQUFuQjthQUNPSCxLQUFLLENBQUNHLElBQWI7TUFDQUgsS0FBSyxDQUFDYyxJQUFOLEdBQWEsSUFBYjtNQUNBdVMsU0FBUyxDQUFDckIsR0FBRCxDQUFULEdBQWlCLElBQUlvQixLQUFLLENBQUNqVCxJQUFELENBQVQsQ0FBZ0JILEtBQWhCLENBQWpCOzs7V0FFS3FULFNBQVA7OztFQUVGSCxTQUFTLENBQUVDLFVBQUYsRUFBY0UsU0FBZCxFQUF5QjtRQUM1QixLQUFLL0IsWUFBVCxFQUF1QjtZQUNmalAsTUFBTSxHQUFHLEVBQWY7O1dBQ0ssTUFBTSxDQUFDMlAsR0FBRCxFQUFNaFMsS0FBTixDQUFYLElBQTJCUCxNQUFNLENBQUNnQyxPQUFQLENBQWU0UixTQUFmLENBQTNCLEVBQXNEO1FBQ3BEaFIsTUFBTSxDQUFDMlAsR0FBRCxDQUFOLEdBQWNoUyxLQUFLLENBQUNvQyxZQUFOLEVBQWQ7UUFDQUMsTUFBTSxDQUFDMlAsR0FBRCxDQUFOLENBQVk3UixJQUFaLEdBQW1CSCxLQUFLLENBQUM3QixXQUFOLENBQWtCcUcsSUFBckM7OztXQUVHOE0sWUFBTCxDQUFrQmtDLE9BQWxCLENBQTBCTCxVQUExQixFQUFzQ1YsSUFBSSxDQUFDQyxTQUFMLENBQWVyUSxNQUFmLENBQXRDOzs7O0VBR0pWLGVBQWUsQ0FBRUgsZUFBRixFQUFtQjtRQUM1QmlTLFFBQUosQ0FBYyxVQUFTalMsZUFBZ0IsRUFBdkMsSUFEZ0M7OztFQUdsQ2lCLGlCQUFpQixDQUFFQyxJQUFGLEVBQVE7UUFDbkJsQixlQUFlLEdBQUdrQixJQUFJLENBQUNnUixRQUFMLEVBQXRCLENBRHVCOzs7O0lBS3ZCbFMsZUFBZSxHQUFHQSxlQUFlLENBQUNmLE9BQWhCLENBQXdCLHFCQUF4QixFQUErQyxFQUEvQyxDQUFsQjtXQUNPZSxlQUFQOzs7RUFHRjJFLFdBQVcsQ0FBRXZGLE9BQUYsRUFBVztRQUNoQixDQUFDQSxPQUFPLENBQUNHLE9BQWIsRUFBc0I7TUFDcEJILE9BQU8sQ0FBQ0csT0FBUixHQUFtQixRQUFPb1EsYUFBYyxFQUF4QztNQUNBQSxhQUFhLElBQUksQ0FBakI7OztVQUVJd0MsSUFBSSxHQUFHLEtBQUtqQyxNQUFMLENBQVk5USxPQUFPLENBQUNULElBQXBCLENBQWI7V0FDT1MsT0FBTyxDQUFDVCxJQUFmO0lBQ0FTLE9BQU8sQ0FBQ0UsSUFBUixHQUFlLElBQWY7U0FDSzhGLE1BQUwsQ0FBWWhHLE9BQU8sQ0FBQ0csT0FBcEIsSUFBK0IsSUFBSTRTLElBQUosQ0FBUy9TLE9BQVQsQ0FBL0I7V0FDTyxLQUFLZ0csTUFBTCxDQUFZaEcsT0FBTyxDQUFDRyxPQUFwQixDQUFQOzs7RUFFRmlOLFdBQVcsQ0FBRXBOLE9BQU8sR0FBRztJQUFFZ1QsUUFBUSxFQUFHO0dBQXpCLEVBQW1DO1FBQ3hDLENBQUNoVCxPQUFPLENBQUNrTCxPQUFiLEVBQXNCO01BQ3BCbEwsT0FBTyxDQUFDa0wsT0FBUixHQUFtQixRQUFPb0YsYUFBYyxFQUF4QztNQUNBQSxhQUFhLElBQUksQ0FBakI7OztVQUVJeUMsSUFBSSxHQUFHLEtBQUtoQyxPQUFMLENBQWEvUSxPQUFPLENBQUNULElBQXJCLENBQWI7V0FDT1MsT0FBTyxDQUFDVCxJQUFmO0lBQ0FTLE9BQU8sQ0FBQ0UsSUFBUixHQUFlLElBQWY7U0FDS2dJLE9BQUwsQ0FBYWxJLE9BQU8sQ0FBQ2tMLE9BQXJCLElBQWdDLElBQUk2SCxJQUFKLENBQVMvUyxPQUFULENBQWhDO1dBQ08sS0FBS2tJLE9BQUwsQ0FBYWxJLE9BQU8sQ0FBQ2tMLE9BQXJCLENBQVA7OztFQUdGNUYsUUFBUSxDQUFFdEYsT0FBRixFQUFXO1VBQ1hpVCxXQUFXLEdBQUcsS0FBSzFOLFdBQUwsQ0FBaUJ2RixPQUFqQixDQUFwQjtTQUNLd0YsVUFBTDtXQUNPeU4sV0FBUDs7O0VBRUZ0SCxRQUFRLENBQUUzTCxPQUFGLEVBQVc7VUFDWGtULFdBQVcsR0FBRyxLQUFLOUYsV0FBTCxDQUFpQnBOLE9BQWpCLENBQXBCO1NBQ0t1TCxXQUFMO1dBQ08ySCxXQUFQOzs7UUFHSUMsb0JBQU4sQ0FBNEI7SUFDMUJDLE9BRDBCO0lBRTFCQyxRQUFRLEdBQUcxQyxJQUFJLENBQUMyQyxPQUFMLENBQWFGLE9BQU8sQ0FBQzdULElBQXJCLENBRmU7SUFHMUJnVSxpQkFBaUIsR0FBRyxJQUhNO0lBSTFCQyxhQUFhLEdBQUc7TUFDZCxFQUxKLEVBS1E7VUFDQUMsTUFBTSxHQUFHTCxPQUFPLENBQUNNLElBQVIsR0FBZSxPQUE5Qjs7UUFDSUQsTUFBTSxJQUFJLEVBQWQsRUFBa0I7VUFDWkQsYUFBSixFQUFtQjtRQUNqQkcsT0FBTyxDQUFDQyxJQUFSLENBQWMsc0JBQXFCSCxNQUFPLHFCQUExQztPQURGLE1BRU87Y0FDQyxJQUFJclQsS0FBSixDQUFXLEdBQUVxVCxNQUFPLHlFQUFwQixDQUFOOztLQU5FOzs7O1FBV0ZJLElBQUksR0FBRyxNQUFNLElBQUk5UCxPQUFKLENBQVksQ0FBQ0MsT0FBRCxFQUFVQyxNQUFWLEtBQXFCO1VBQzVDNlAsTUFBTSxHQUFHLElBQUksS0FBS3JELFVBQVQsRUFBYjs7TUFDQXFELE1BQU0sQ0FBQ0MsTUFBUCxHQUFnQixNQUFNO1FBQ3BCL1AsT0FBTyxDQUFDOFAsTUFBTSxDQUFDclMsTUFBUixDQUFQO09BREY7O01BR0FxUyxNQUFNLENBQUNFLFVBQVAsQ0FBa0JaLE9BQWxCLEVBQTJCQyxRQUEzQjtLQUxlLENBQWpCO1dBT08sS0FBS1ksc0JBQUwsQ0FBNEI7TUFDakNyUSxJQUFJLEVBQUV3UCxPQUFPLENBQUN4UCxJQURtQjtNQUVqQ3NRLFNBQVMsRUFBRVgsaUJBQWlCLElBQUk1QyxJQUFJLENBQUN1RCxTQUFMLENBQWVkLE9BQU8sQ0FBQzdULElBQXZCLENBRkM7TUFHakNzVTtLQUhLLENBQVA7OztFQU1GSSxzQkFBc0IsQ0FBRTtJQUFFclEsSUFBRjtJQUFRc1EsU0FBUyxHQUFHLEtBQXBCO0lBQTJCTDtHQUE3QixFQUFxQztRQUNyRDlPLElBQUosRUFBVXpFLFVBQVY7O1FBQ0ksS0FBS3VRLGVBQUwsQ0FBcUJxRCxTQUFyQixDQUFKLEVBQXFDO01BQ25DblAsSUFBSSxHQUFHb1AsT0FBTyxDQUFDQyxJQUFSLENBQWFQLElBQWIsRUFBbUI7UUFBRXRVLElBQUksRUFBRTJVO09BQTNCLENBQVA7O1VBQ0lBLFNBQVMsS0FBSyxLQUFkLElBQXVCQSxTQUFTLEtBQUssS0FBekMsRUFBZ0Q7UUFDOUM1VCxVQUFVLEdBQUcsRUFBYjs7YUFDSyxNQUFNSyxJQUFYLElBQW1Cb0UsSUFBSSxDQUFDc1AsT0FBeEIsRUFBaUM7VUFDL0IvVCxVQUFVLENBQUNLLElBQUQsQ0FBVixHQUFtQixJQUFuQjs7O2VBRUtvRSxJQUFJLENBQUNzUCxPQUFaOztLQVBKLE1BU08sSUFBSUgsU0FBUyxLQUFLLEtBQWxCLEVBQXlCO1lBQ3hCLElBQUk5VCxLQUFKLENBQVUsZUFBVixDQUFOO0tBREssTUFFQSxJQUFJOFQsU0FBUyxLQUFLLEtBQWxCLEVBQXlCO1lBQ3hCLElBQUk5VCxLQUFKLENBQVUsZUFBVixDQUFOO0tBREssTUFFQTtZQUNDLElBQUlBLEtBQUosQ0FBVywrQkFBOEI4VCxTQUFVLEVBQW5ELENBQU47OztXQUVLLEtBQUtJLGNBQUwsQ0FBb0I7TUFBRTFRLElBQUY7TUFBUW1CLElBQVI7TUFBY3pFO0tBQWxDLENBQVA7OztFQUVGZ1UsY0FBYyxDQUFFdFUsT0FBRixFQUFXO0lBQ3ZCQSxPQUFPLENBQUNULElBQVIsR0FBZVMsT0FBTyxDQUFDK0UsSUFBUixZQUF3QndQLEtBQXhCLEdBQWdDLGFBQWhDLEdBQWdELGlCQUEvRDtRQUNJalAsUUFBUSxHQUFHLEtBQUtBLFFBQUwsQ0FBY3RGLE9BQWQsQ0FBZjtXQUNPLEtBQUsyTCxRQUFMLENBQWM7TUFDbkJwTSxJQUFJLEVBQUUsY0FEYTtNQUVuQnFFLElBQUksRUFBRTVELE9BQU8sQ0FBQzRELElBRks7TUFHbkJ6RCxPQUFPLEVBQUVtRixRQUFRLENBQUNuRjtLQUhiLENBQVA7OztFQU1GcVUscUJBQXFCLEdBQUk7U0FDbEIsTUFBTXJVLE9BQVgsSUFBc0IsS0FBSzZGLE1BQTNCLEVBQW1DO1VBQzdCLEtBQUtBLE1BQUwsQ0FBWTdGLE9BQVosQ0FBSixFQUEwQjtZQUNwQjtlQUFPNkYsTUFBTCxDQUFZN0YsT0FBWixFQUFxQmtJLE1BQXJCO1NBQU4sQ0FBdUMsT0FBT29NLEdBQVAsRUFBWTs7Ozs7RUFJekRDLGdCQUFnQixHQUFJO1NBQ2IsTUFBTXJSLFFBQVgsSUFBdUJ4RSxNQUFNLENBQUN3RCxNQUFQLENBQWMsS0FBSzZGLE9BQW5CLENBQXZCLEVBQW9EO01BQ2xEN0UsUUFBUSxDQUFDZ0YsTUFBVDs7OztFQUdKc00sWUFBWSxHQUFJO1VBQ1JDLE9BQU8sR0FBRyxFQUFoQjs7U0FDSyxNQUFNdlIsUUFBWCxJQUF1QnhFLE1BQU0sQ0FBQ3dELE1BQVAsQ0FBYyxLQUFLNkYsT0FBbkIsQ0FBdkIsRUFBb0Q7TUFDbEQwTSxPQUFPLENBQUN2UixRQUFRLENBQUM2SCxPQUFWLENBQVAsR0FBNEI3SCxRQUFRLENBQUN5QixXQUFyQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDOU5OLElBQUk1RSxJQUFJLEdBQUcsSUFBSXNRLElBQUosQ0FBU0MsVUFBVCxFQUFxQixJQUFyQixDQUFYO0FBQ0F2USxJQUFJLENBQUMyVSxPQUFMLEdBQWVDLEdBQUcsQ0FBQ0QsT0FBbkI7Ozs7In0=
