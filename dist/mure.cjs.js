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

        await table.buildCache();
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

        await table.buildCache();
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

        await table.buildCache();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TaW5nbGVQYXJlbnRNaXhpbi5qcyIsIi4uL3NyYy9UYWJsZXMvQWdncmVnYXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0V4cGFuZGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0ZhY2V0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvVHJhbnNwb3NlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Db25uZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9JbmRleGVzL0luTWVtb3J5SW5kZXguanMiLCIuLi9zcmMvTXVyZS5qcyIsIi4uL3NyYy9tYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuXG5jbGFzcyBUYWJsZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX211cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5fbXVyZSB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG11cmUgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5hdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcyA9IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cblxuICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5zdXBwcmVzc2VkQXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gISFvcHRpb25zLnN1cHByZXNzSW5kZXg7XG5cbiAgICB0aGlzLl9pbmRleFN1YkZpbHRlciA9IChvcHRpb25zLmluZGV4U3ViRmlsdGVyICYmIHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKG9wdGlvbnMuaW5kZXhTdWJGaWx0ZXIpKSB8fCBudWxsO1xuICAgIHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuYXR0cmlidXRlU3ViRmlsdGVycyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuX2F0dHJpYnV0ZXMsXG4gICAgICBkZXJpdmVkVGFibGVzOiB0aGlzLl9kZXJpdmVkVGFibGVzLFxuICAgICAgdXNlZEJ5Q2xhc3NlczogdGhpcy5fdXNlZEJ5Q2xhc3NlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZVN1YkZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhTdWJGaWx0ZXI6ICh0aGlzLl9pbmRleFN1YkZpbHRlciAmJiB0aGlzLl9tdXJlLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4U3ViRmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlU3ViRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVTdWJGaWx0ZXJzW2F0dHJdID0gdGhpcy5fbXVyZS5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBHZW5lcmljIGNhY2hpbmcgc3R1ZmY7IHRoaXMgaXNuJ3QganVzdCBmb3IgcGVyZm9ybWFuY2UuIENvbm5lY3RlZFRhYmxlJ3NcbiAgICAvLyBhbGdvcml0aG0gcmVxdWlyZXMgdGhhdCBpdHMgcGFyZW50IHRhYmxlcyBoYXZlIHByZS1idWlsdCBpbmRleGVzICh3ZVxuICAgIC8vIHRlY2huaWNhbGx5IGNvdWxkIGltcGxlbWVudCBpdCBkaWZmZXJlbnRseSwgYnV0IGl0IHdvdWxkIGJlIGV4cGVuc2l2ZSxcbiAgICAvLyByZXF1aXJlcyB0cmlja3kgbG9naWMsIGFuZCB3ZSdyZSBhbHJlYWR5IGJ1aWxkaW5nIGluZGV4ZXMgZm9yIHNvbWUgdGFibGVzXG4gICAgLy8gbGlrZSBBZ2dyZWdhdGVkVGFibGUgYW55d2F5KVxuICAgIGlmIChvcHRpb25zLnJlc2V0KSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQgPT09IHVuZGVmaW5lZCA/IEluZmluaXR5IDogb3B0aW9ucy5saW1pdDtcbiAgICAgIHlpZWxkICogT2JqZWN0LnZhbHVlcyh0aGlzLl9jYWNoZSkuc2xpY2UoMCwgbGltaXQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHlpZWxkICogYXdhaXQgdGhpcy5fYnVpbGRDYWNoZShvcHRpb25zKTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGU7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGFzeW5jIGJ1aWxkQ2FjaGUgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fY2FjaGVQcm9taXNlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9jYWNoZVByb21pc2UgPSBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGVtcCBvZiB0aGlzLl9idWlsZENhY2hlKCkpIHt9IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbiAgICAgICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgfVxuICB9XG4gIGFzeW5jIGNvdW50Um93cyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpKS5sZW5ndGg7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZShvcHRpb25zKTtcbiAgICBsZXQgY29tcGxldGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gaXRlcmF0aW9uIHdhcyBjYW5jZWxsZWQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGNvbXBsZXRlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKTtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3RlbXAudmFsdWUuaW5kZXhdID0gdGVtcC52YWx1ZTtcbiAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbXBsZXRlZCkge1xuICAgICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHdyYXBwZWRJdGVtLnJvdykge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBkZWxldGUgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICBsZXQga2VlcCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2luZGV4U3ViRmlsdGVyKSB7XG4gICAgICBrZWVwID0gdGhpcy5faW5kZXhTdWJGaWx0ZXIod3JhcHBlZEl0ZW0uaW5kZXgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSkge1xuICAgICAga2VlcCA9IGtlZXAgJiYgZnVuYyh3cmFwcGVkSXRlbS5yb3dbYXR0cl0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyB0aGlzLl9tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3Qgb3RoZXJJdGVtIG9mIG9wdGlvbnMuaXRlbXNUb0Nvbm5lY3QgfHwgW10pIHtcbiAgICAgIHdyYXBwZWRJdGVtLmNvbm5lY3RJdGVtKG90aGVySXRlbSk7XG4gICAgICBvdGhlckl0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleFN1YkZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIGFkZFN1YkZpbHRlciAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhTdWJGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGVJZCA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZUlkICYmIHRoaXMuX211cmUudGFibGVzW2V4aXN0aW5nVGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgc2hvcnRlc3RQYXRoVG9UYWJsZSAob3RoZXJUYWJsZSkge1xuICAgIC8vIERpamtzdHJhJ3MgYWxnb3JpdGhtLi4uXG4gICAgY29uc3QgdmlzaXRlZCA9IHt9O1xuICAgIGNvbnN0IGRpc3RhbmNlcyA9IHt9O1xuICAgIGNvbnN0IHByZXZUYWJsZXMgPSB7fTtcbiAgICBjb25zdCB2aXNpdCA9IHRhcmdldElkID0+IHtcbiAgICAgIGNvbnN0IHRhcmdldFRhYmxlID0gdGhpcy5fbXVyZS50YWJsZXNbdGFyZ2V0SWRdO1xuICAgICAgLy8gT25seSBjaGVjayB0aGUgdW52aXNpdGVkIGRlcml2ZWQgYW5kIHBhcmVudCB0YWJsZXNcbiAgICAgIGNvbnN0IG5laWdoYm9yTGlzdCA9IE9iamVjdC5rZXlzKHRhcmdldFRhYmxlLl9kZXJpdmVkVGFibGVzKVxuICAgICAgICAuY29uY2F0KHRhcmdldFRhYmxlLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUudGFibGVJZCkpXG4gICAgICAgIC5maWx0ZXIodGFibGVJZCA9PiAhdmlzaXRlZFt0YWJsZUlkXSk7XG4gICAgICAvLyBDaGVjayBhbmQgYXNzaWduIChvciB1cGRhdGUpIHRlbnRhdGl2ZSBkaXN0YW5jZXMgdG8gZWFjaCBuZWlnaGJvclxuICAgICAgZm9yIChjb25zdCBuZWlnaGJvcklkIG9mIG5laWdoYm9yTGlzdCkge1xuICAgICAgICBpZiAoZGlzdGFuY2VzW25laWdoYm9ySWRdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlzdGFuY2VzW3RhcmdldElkXSArIDEgPCBkaXN0YW5jZXNbbmVpZ2hib3JJZF0pIHtcbiAgICAgICAgICBkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPSBkaXN0YW5jZXNbdGFyZ2V0SWRdICsgMTtcbiAgICAgICAgICBwcmV2VGFibGVzW25laWdoYm9ySWRdID0gdGFyZ2V0SWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIHRoaXMgdGFibGUgaXMgb2ZmaWNpYWxseSB2aXNpdGVkOyB0YWtlIGl0IG91dCBvZiB0aGUgcnVubmluZ1xuICAgICAgLy8gZm9yIGZ1dHVyZSB2aXNpdHMgLyBjaGVja3NcbiAgICAgIHZpc2l0ZWRbdGFyZ2V0SWRdID0gdHJ1ZTtcbiAgICAgIGRlbGV0ZSBkaXN0YW5jZXNbdGFyZ2V0SWRdO1xuICAgIH07XG5cbiAgICAvLyBTdGFydCB3aXRoIHRoaXMgdGFibGVcbiAgICBwcmV2VGFibGVzW3RoaXMudGFibGVJZF0gPSBudWxsO1xuICAgIGRpc3RhbmNlc1t0aGlzLnRhYmxlSWRdID0gMDtcbiAgICBsZXQgdG9WaXNpdCA9IE9iamVjdC5rZXlzKGRpc3RhbmNlcyk7XG4gICAgd2hpbGUgKHRvVmlzaXQubGVuZ3RoID4gMCkge1xuICAgICAgLy8gVmlzaXQgdGhlIG5leHQgdGFibGUgdGhhdCBoYXMgdGhlIHNob3J0ZXN0IGRpc3RhbmNlXG4gICAgICB0b1Zpc2l0LnNvcnQoKGEsIGIpID0+IGRpc3RhbmNlc1thXSAtIGRpc3RhbmNlc1tiXSk7XG4gICAgICBsZXQgbmV4dElkID0gdG9WaXNpdC5zaGlmdCgpO1xuICAgICAgaWYgKG5leHRJZCA9PT0gb3RoZXJUYWJsZS50YWJsZUlkKSB7XG4gICAgICAgIC8vIEZvdW5kIG90aGVyVGFibGUhIFNlbmQgYmFjayB0aGUgY2hhaW4gb2YgY29ubmVjdGVkIHRhYmxlc1xuICAgICAgICBjb25zdCBjaGFpbiA9IFtdO1xuICAgICAgICB3aGlsZSAocHJldlRhYmxlc1tuZXh0SWRdICE9PSBudWxsKSB7XG4gICAgICAgICAgY2hhaW4udW5zaGlmdCh0aGlzLl9tdXJlLnRhYmxlc1tuZXh0SWRdKTtcbiAgICAgICAgICBuZXh0SWQgPSBwcmV2VGFibGVzW25leHRJZF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoYWluO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVmlzaXQgdGhlIHRhYmxlXG4gICAgICAgIHZpc2l0KG5leHRJZCk7XG4gICAgICAgIHRvVmlzaXQgPSBPYmplY3Qua2V5cyhkaXN0YW5jZXMpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBXZSBkaWRuJ3QgZmluZCBpdDsgdGhlcmUncyBubyBjb25uZWN0aW9uXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgZGVsaW1pdGVyXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9O1xuICAgICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gaW5kZXhlcy5tYXAoaW5kZXggPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4XG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoeyBsaW1pdCB9KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKHsgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJyB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9tdXJlLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDAgfHwgdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdFRhYmxlO1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aWVyZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBBZ2dyZWdhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLl9kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqYnO1xuICB9XG4gIGRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUgKGF0dHIsIGZ1bmMpIHtcbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfdXBkYXRlSXRlbSAob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHNvIHRoYXQgQWdncmVnYXRlZFRhYmxlIGNhbiB0YWtlIGFkdmFudGFnZVxuICAgIC8vIG9mIHRoZSBwYXJ0aWFsbHktYnVpbHQgY2FjaGUgYXMgaXQgZ29lcywgYW5kIHBvc3Rwb25lIGZpbmlzaGluZyBpdGVtc1xuICAgIC8vIHVudGlsIGFmdGVyIHRoZSBwYXJlbnQgdGFibGUgaGFzIGJlZW4gZnVsbHkgaXRlcmF0ZWRcblxuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuX2l0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt3cmFwcGVkSXRlbS5pbmRleF0gPSB3cmFwcGVkSXRlbTtcbiAgICAgIC8vIEdvIGFoZWFkIGFuZCB5aWVsZCB0aGUgdW5maW5pc2hlZCBpdGVtOyB0aGlzIG1ha2VzIGl0IHBvc3NpYmxlIGZvclxuICAgICAgLy8gY2xpZW50IGFwcHMgdG8gYmUgbW9yZSByZXNwb25zaXZlIGFuZCByZW5kZXIgcGFydGlhbCByZXN1bHRzLCBidXQgYWxzb1xuICAgICAgLy8gbWVhbnMgdGhhdCB0aGV5IG5lZWQgdG8gd2F0Y2ggZm9yIHdyYXBwZWRJdGVtLm9uKCd1cGRhdGUnKSBldmVudHNcbiAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgIH1cblxuICAgIC8vIFNlY29uZCBwYXNzOiBub3cgdGhhdCB3ZSd2ZSBjb21wbGV0ZWQgdGhlIGZ1bGwgaXRlcmF0aW9uIG9mIHRoZSBwYXJlbnRcbiAgICAvLyB0YWJsZSwgd2UgY2FuIGZpbmlzaCBlYWNoIGl0ZW1cbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIHRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgaWYgKCF0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBXZSB3ZXJlIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKGV4aXN0aW5nSXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKG5ld0l0ZW0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHN1cGVyLmdldEF0dHJpYnV0ZURldGFpbHMoKTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ucmVkdWNlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQWdncmVnYXRlZFRhYmxlO1xuIiwiY29uc3QgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuZHVwbGljYXRlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgfVxuICAgIF90b1Jhd09iamVjdCAoKSB7XG4gICAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICAgIG9iai5kdXBsaWNhdGVkQXR0cmlidXRlcyA9IHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgZHVwbGljYXRlQXR0cmlidXRlIChwYXJlbnRJZCwgYXR0cmlidXRlKSB7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gPSB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gfHwgW107XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0ucHVzaChhdHRyaWJ1dGUpO1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBfZHVwbGljYXRlQXR0cmlidXRlcyAod3JhcHBlZEl0ZW0pIHtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgcGFyZW50TmFtZSA9IHRoaXMuX211cmUudGFibGVzW3BhcmVudElkXS5uYW1lO1xuICAgICAgICB3cmFwcGVkSXRlbS5yb3dbYCR7cGFyZW50TmFtZX0uJHthdHRyfWBdID0gd3JhcHBlZEl0ZW0uY29ubmVjdGVkSXRlbXNbcGFyZW50SWRdWzBdLnJvd1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gICAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgICBjb25zdCBhbGxBdHRycyA9IHN1cGVyLmdldEF0dHJpYnV0ZURldGFpbHMoKTtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgYXR0ck5hbWUgPSBgJHt0aGlzLl9tdXJlLnRhYmxlc1twYXJlbnRJZF0ubmFtZX0uJHthdHRyfWA7XG4gICAgICAgIGFsbEF0dHJzW2F0dHJOYW1lXSA9IGFsbEF0dHJzW2F0dHJOYW1lXSB8fCB7IG5hbWU6IGF0dHJOYW1lIH07XG4gICAgICAgIGFsbEF0dHJzW2F0dHJOYW1lXS5jb3BpZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFsbEF0dHJzO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcbmltcG9ydCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gZnJvbSAnLi9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluKFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuZGVsaW1pdGVyID0gb3B0aW9ucy5kZWxpbWl0ZXIgfHwgJywnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpCc7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCB2YWx1ZXMgPSAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSB8fCAnJykuc3BsaXQodGhpcy5kZWxpbWl0ZXIpO1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICAgICAgY29uc3Qgcm93ID0ge307XG4gICAgICAgIHJvd1t0aGlzLl9hdHRyaWJ1dGVdID0gdmFsdWU7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3csXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKG5ld0l0ZW0pO1xuICAgICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYFske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgVHJhbnNwb3NlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuX2luZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouaW5kZXggPSB0aGlzLl9pbmRleDtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYOG1gCR7dGhpcy5faW5kZXh9YDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBhd2FpdCBwYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG5cbiAgICAvLyBJdGVyYXRlIHRoZSByb3cncyBhdHRyaWJ1dGVzIGFzIGluZGV4ZXNcbiAgICBjb25zdCB3cmFwcGVkUGFyZW50ID0gcGFyZW50VGFibGUuX2NhY2hlW3RoaXMuX2luZGV4XSB8fCB7IHJvdzoge30gfTtcbiAgICBmb3IgKGNvbnN0IFsgaW5kZXgsIHZhbHVlIF0gb2YgT2JqZWN0LmVudHJpZXMod3JhcHBlZFBhcmVudC5yb3cpKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICByb3c6IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgPyB2YWx1ZSA6IHsgdmFsdWUgfSxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBUcmFuc3Bvc2VkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIFNwaW4gdGhyb3VnaCBhbGwgb2YgdGhlIHBhcmVudFRhYmxlcyBzbyB0aGF0IHRoZWlyIF9jYWNoZSBpcyBwcmUtYnVpbHRcbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgYXdhaXQgcGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuICAgIH1cbiAgICAvLyBOb3cgdGhhdCB0aGUgY2FjaGVzIGFyZSBidWlsdCwganVzdCBpdGVyYXRlIHRoZWlyIGtleXMgZGlyZWN0bHkuIFdlIG9ubHlcbiAgICAvLyBjYXJlIGFib3V0IGluY2x1ZGluZyByb3dzIHRoYXQgaGF2ZSBleGFjdCBtYXRjaGVzIGFjcm9zcyBhbGwgdGFibGVzLCBzb1xuICAgIC8vIHdlIGNhbiBqdXN0IHBpY2sgb25lIHBhcmVudCB0YWJsZSB0byBpdGVyYXRlXG4gICAgY29uc3QgYmFzZVBhcmVudFRhYmxlID0gcGFyZW50VGFibGVzWzBdO1xuICAgIGNvbnN0IG90aGVyUGFyZW50VGFibGVzID0gcGFyZW50VGFibGVzLnNsaWNlKDEpO1xuICAgIGZvciAoY29uc3QgaW5kZXggaW4gYmFzZVBhcmVudFRhYmxlLl9jYWNoZSkge1xuICAgICAgaWYgKCFwYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlKSkge1xuICAgICAgICAvLyBPbmUgb2YgdGhlIHBhcmVudCB0YWJsZXMgd2FzIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCFvdGhlclBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbaW5kZXhdKSkge1xuICAgICAgICAvLyBObyBtYXRjaCBpbiBvbmUgb2YgdGhlIG90aGVyIHRhYmxlczsgb21pdCB0aGlzIGl0ZW1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPOiBhZGQgZWFjaCBwYXJlbnQgdGFibGVzJyBrZXlzIGFzIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBwYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLl9jYWNoZVtpbmRleF0pXG4gICAgICB9KTtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZUF0dHJpYnV0ZXMobmV3SXRlbSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fbXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5fbXVyZSB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgX211cmUsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9uID0gb3B0aW9ucy5hbm5vdGF0aW9uIHx8ICcnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGNsYXNzTmFtZTogdGhpcy5fY2xhc3NOYW1lLFxuICAgICAgYW5ub3RhdGlvbjogdGhpcy5hbm5vdGF0aW9uXG4gICAgfTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lICE9PSBudWxsO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHwgdGhpcy50YWJsZS5uYW1lO1xuICB9XG4gIGdldEhhc2hUYWJsZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIGF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpO1xuICB9XG4gIGdldCB0YWJsZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RoaXMudGFibGVJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlR2VuZXJpY0NsYXNzIChuZXdUYWJsZSkge1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJ1xuICAgIH0pO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyh0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUsIGRlbGltaXRlcikpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gICAgdGhpcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHMgPSB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyB0aGlzLl9tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jIHByZXBTaG9ydGVzdEVkZ2VQYXRoIChlZGdlQ2xhc3NJZCkge1xuICAgIGlmICh0aGlzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1tlZGdlQ2xhc3NJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW2VkZ2VDbGFzc0lkXTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZWRnZVRhYmxlID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkXS50YWJsZTtcbiAgICAgIGNvbnN0IGlkTGlzdCA9IFtdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZSBvZiB0aGlzLnRhYmxlLnNob3J0ZXN0UGF0aFRvVGFibGUoZWRnZVRhYmxlKSkge1xuICAgICAgICBpZExpc3QucHVzaCh0YWJsZS50YWJsZUlkKTtcbiAgICAgICAgLy8gU3BpbiB0aHJvdWdoIHRoZSB0YWJsZSB0byBtYWtlIHN1cmUgYWxsIGl0cyByb3dzIGFyZSB3cmFwcGVkIGFuZCBjb25uZWN0ZWRcbiAgICAgICAgYXdhaXQgdGFibGUuYnVpbGRDYWNoZSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbZWRnZUNsYXNzSWRdID0gaWRMaXN0O1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID4gMikge1xuICAgICAgLy8gSWYgdGhlcmUgYXJlIG1vcmUgdGhhbiB0d28gZWRnZXMsIGJyZWFrIGFsbCBjb25uZWN0aW9ucyBhbmQgbWFrZVxuICAgICAgLy8gdGhpcyBhIGZsb2F0aW5nIGVkZ2UgKGZvciBub3csIHdlJ3JlIG5vdCBkZWFsaW5nIGluIGh5cGVyZWRnZXMpXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gV2l0aCBvbmx5IG9uZSBjb25uZWN0aW9uLCB0aGlzIG5vZGUgc2hvdWxkIGJlY29tZSBhIHNlbGYtZWRnZVxuICAgICAgLy8gKG9yIGEgZmxvYXRpbmcgZWRnZSBpZiBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCBpcyBudWxsKVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIGVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgIGxldCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIGxldCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgIC8vIEZpZ3VyZSBvdXQgdGhlIGRpcmVjdGlvbiwgaWYgdGhlcmUgaXMgb25lXG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLmRpcmVjdGVkICYmIHRhcmdldEVkZ2VDbGFzcy5kaXJlY3RlZCkge1xuICAgICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGhhcHBlbmVkIHRvIGdldCB0aGUgZWRnZXMgaW4gb3JkZXI7IHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBnb3QgdGhlIGVkZ2VzIGJhY2t3YXJkczsgc3dhcCB0aGVtIGFuZCBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgICAgIHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBub3cgd2Uga25vdyBob3cgdG8gc2V0IHNvdXJjZSAvIHRhcmdldCBpZHNcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IHNvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICAvLyBEZWxldGUgZWFjaCBvZiB0aGUgZWRnZSBjbGFzc2VzXG4gICAgICBzb3VyY2VFZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgICB0YXJnZXRFZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgfVxuICAgIHRoaXMuZGVsZXRlKCk7XG4gICAgZGVsZXRlIG9wdGlvbnMuY2xhc3NJZDtcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgZGlyZWN0ZWQsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGNvbnN0IHRoaXNIYXNoID0gdGhpcy5nZXRIYXNoVGFibGUoYXR0cmlidXRlKTtcbiAgICBjb25zdCBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy5nZXRIYXNoVGFibGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBkaXJlY3RlZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWRcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBfcGlja0VkZ2VUYWJsZSAob3RoZXJDbGFzcykge1xuICAgIGxldCBlZGdlVGFibGU7XG4gICAgbGV0IGNoYWluID0gdGhpcy50YWJsZS5zaG9ydGVzdFBhdGhUb1RhYmxlKG90aGVyQ2xhc3MudGFibGUpO1xuICAgIGlmIChjaGFpbiA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmRlcmx5aW5nIHRhYmxlIGNoYWluIGJldHdlZW4gZWRnZSBhbmQgbm9kZSBjbGFzc2VzIGlzIGJyb2tlbmApO1xuICAgIH0gZWxzZSBpZiAoY2hhaW4ubGVuZ3RoIDw9IDIpIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICBlZGdlVGFibGUgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGU7IHByaW9yaXRpemUgU3RhdGljVGFibGUgYW5kIFN0YXRpY0RpY3RUYWJsZVxuICAgICAgbGV0IHN0YXRpY0V4aXN0cyA9IGZhbHNlO1xuICAgICAgY2hhaW4gPSBjaGFpbi5zbGljZSgxLCBjaGFpbi5sZW5ndGggLSAxKS5tYXAoKHRhYmxlLCBkaXN0KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0YWJsZS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZSwgZGlzdCB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIGNoYWluID0gY2hhaW4uZmlsdGVyKCh7IHRhYmxlIH0pID0+IHtcbiAgICAgICAgICByZXR1cm4gdGFibGUudHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlZGdlVGFibGUgPSBjaGFpblswXS50YWJsZTtcbiAgICB9XG4gICAgcmV0dXJuIGVkZ2VUYWJsZTtcbiAgfVxuICBhc3luYyBwcmVwU2hvcnRlc3RTb3VyY2VQYXRoICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVkU2hvcnRlc3RTb3VyY2VQYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGg7XG4gICAgfSBlbHNlIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgc291cmNlVGFibGUgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS50YWJsZTtcbiAgICAgIGNvbnN0IGlkTGlzdCA9IFtdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZSBvZiB0aGlzLnRhYmxlLnNob3J0ZXN0UGF0aFRvVGFibGUoc291cmNlVGFibGUpKSB7XG4gICAgICAgIGlkTGlzdC5wdXNoKHRhYmxlLnRhYmxlSWQpO1xuICAgICAgICAvLyBTcGluIHRocm91Z2ggdGhlIHRhYmxlIHRvIG1ha2Ugc3VyZSBhbGwgaXRzIHJvd3MgYXJlIHdyYXBwZWQgYW5kIGNvbm5lY3RlZFxuICAgICAgICBhd2FpdCB0YWJsZS5idWlsZENhY2hlKCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGggPSBpZExpc3Q7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkU2hvcnRlc3RTb3VyY2VQYXRoO1xuICAgIH1cbiAgfVxuICBhc3luYyBwcmVwU2hvcnRlc3RUYXJnZXRQYXRoICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVkU2hvcnRlc3RUYXJnZXRQYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGg7XG4gICAgfSBlbHNlIGlmICh0aGlzLnRhcmdldENsYXNzSWQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGFyZ2V0VGFibGUgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXS50YWJsZTtcbiAgICAgIGNvbnN0IGlkTGlzdCA9IFtdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZSBvZiB0aGlzLnRhYmxlLnNob3J0ZXN0UGF0aFRvVGFibGUodGFyZ2V0VGFibGUpKSB7XG4gICAgICAgIGlkTGlzdC5wdXNoKHRhYmxlLnRhYmxlSWQpO1xuICAgICAgICAvLyBTcGluIHRocm91Z2ggdGhlIHRhYmxlIHRvIG1ha2Ugc3VyZSBhbGwgaXRzIHJvd3MgYXJlIHdyYXBwZWQgYW5kIGNvbm5lY3RlZFxuICAgICAgICBhd2FpdCB0YWJsZS5idWlsZENhY2hlKCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGggPSBpZExpc3Q7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkU2hvcnRlc3RUYXJnZXRQYXRoO1xuICAgIH1cbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICB0aGlzLmRlbGV0ZSgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIGRlbGV0ZSB0ZW1wLmNsYXNzSWQ7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh0ZW1wKTtcblxuICAgIGlmICh0ZW1wLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgICBjb25zdCBlZGdlVGFibGUgPSB0aGlzLl9waWNrRWRnZVRhYmxlKHNvdXJjZUNsYXNzKTtcbiAgICAgIGNvbnN0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlLnRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiB0ZW1wLnNvdXJjZUNsYXNzSWQsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkXG4gICAgICB9KTtcbiAgICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGVtcC50YXJnZXRDbGFzc0lkICYmIHRlbXAuc291cmNlQ2xhc3NJZCAhPT0gdGVtcC50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgICAgY29uc3QgZWRnZVRhYmxlID0gdGhpcy5fcGlja0VkZ2VUYWJsZSh0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZS50YWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIGRpcmVjdGlvbiwgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KSB7XG4gICAgaWYgKGRpcmVjdGlvbikge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmIChkaXJlY3Rpb24gIT09ICdzb3VyY2UnICYmIGRpcmVjdGlvbiAhPT0gJ3RhcmdldCcpIHtcbiAgICAgIGRpcmVjdGlvbiA9IHRoaXMudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCA/ICd0YXJnZXQnIDogJ3NvdXJjZSc7XG4gICAgfVxuICAgIGlmIChkaXJlY3Rpb24gPT09ICd0YXJnZXQnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RUYXJnZXQoeyBub2RlQ2xhc3MsIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZSh7IG5vZGVDbGFzcywgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KTtcbiAgICB9XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIHRvZ2dsZU5vZGVEaXJlY3Rpb24gKHNvdXJjZUNsYXNzSWQpIHtcbiAgICBpZiAoIXNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICBpZiAoc291cmNlQ2xhc3NJZCAhPT0gdGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IHN3YXAgdG8gdW5jb25uZWN0ZWQgY2xhc3MgaWQ6ICR7c291cmNlQ2xhc3NJZH1gKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgdGVtcCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSB0ZW1wO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbCxcbiAgICBza2lwU2F2ZSA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLmdldEhhc2hUYWJsZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyBzb3VyY2VDbGFzcy50YWJsZSA6IHNvdXJjZUNsYXNzLmdldEhhc2hUYWJsZShub2RlQXR0cmlidXRlKTtcbiAgICBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pO1xuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNraXBTYXZlID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMuZ2V0SGFzaFRhYmxlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRhcmdldENsYXNzLnRhYmxlIDogdGFyZ2V0Q2xhc3MuZ2V0SGFzaFRhYmxlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSk7XG5cbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKHsgc2tpcFNhdmUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGg7XG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1RhcmdldENsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1RhcmdldENsYXNzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVkU2hvcnRlc3RUYXJnZXRQYXRoO1xuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICB0aGlzLnRhYmxlID0gb3B0aW9ucy50YWJsZTtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLnRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGFuZCB0YWJsZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc09iaiA9IG9wdGlvbnMuY2xhc3NPYmogfHwgbnVsbDtcbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSBvcHRpb25zLmNvbm5lY3RlZEl0ZW1zIHx8IHt9O1xuICB9XG4gIGNvbm5lY3RJdGVtIChpdGVtKSB7XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdID0gdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdIHx8IFtdO1xuICAgIGlmICh0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0uaW5kZXhPZihpdGVtKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgKiBpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgaWYgKHRhYmxlSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgeWllbGQgKiAodGhpcy5jb25uZWN0ZWRJdGVtc1t0YWJsZUlkc1swXV0gfHwgW10pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0aGlzVGFibGVJZCA9IHRhYmxlSWRzWzBdO1xuICAgICAgY29uc3QgcmVtYWluaW5nVGFibGVJZHMgPSB0YWJsZUlkcy5zbGljZSgxKTtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmNvbm5lY3RlZEl0ZW1zW3RoaXNUYWJsZUlkXSB8fCBbXSkge1xuICAgICAgICB5aWVsZCAqIGl0ZW0uaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHJlbWFpbmluZ1RhYmxlSWRzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBlZGdlcyAoeyBsaW1pdCA9IEluZmluaXR5LCBlZGdlSWRzID0gdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHMgfSA9IHt9KSB7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXMoZWRnZUlkcykpIHtcbiAgICAgIGNvbnN0IHRhYmxlSWRDaGFpbiA9IGF3YWl0IHRoaXMuY2xhc3NPYmoucHJlcFNob3J0ZXN0RWRnZVBhdGgoZWRnZUNsYXNzSWQpO1xuICAgICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkQ2hhaW4pO1xuICAgICAgbGV0IHRlbXAgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgICB3aGlsZSAoIXRlbXAuZG9uZSAmJiBpIDwgbGltaXQpIHtcbiAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgICAgaSsrO1xuICAgICAgICB0ZW1wID0gaXRlcmF0b3IubmV4dCgpO1xuICAgICAgfVxuICAgICAgaWYgKGkgPj0gbGltaXQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogc291cmNlTm9kZXMgKHsgbGltaXQgPSBJbmZpbml0eSB9ID0ge30pIHtcbiAgICBjb25zdCB0YWJsZUlkQ2hhaW4gPSBhd2FpdCB0aGlzLmNsYXNzT2JqLnByZXBTaG9ydGVzdFNvdXJjZVBhdGgoKTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRDaGFpbik7XG4gICAgbGV0IHRlbXAgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgbGV0IGkgPSAwO1xuICAgIHdoaWxlICghdGVtcC5kb25lICYmIGkgPCBsaW1pdCkge1xuICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgIGkrKztcbiAgICAgIHRlbXAgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogdGFyZ2V0Tm9kZXMgKHsgbGltaXQgPSBJbmZpbml0eSB9ID0ge30pIHtcbiAgICBjb25zdCB0YWJsZUlkQ2hhaW4gPSBhd2FpdCB0aGlzLmNsYXNzT2JqLnByZXBTaG9ydGVzdFRhcmdldFBhdGgoKTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRDaGFpbik7XG4gICAgbGV0IHRlbXAgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgbGV0IGkgPSAwO1xuICAgIHdoaWxlICghdGVtcC5kb25lICYmIGkgPCBsaW1pdCkge1xuICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgIGkrKztcbiAgICAgIHRlbXAgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiY2xhc3MgSW5NZW1vcnlJbmRleCB7XG4gIGNvbnN0cnVjdG9yICh7IGVudHJpZXMgPSB7fSwgY29tcGxldGUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICB0aGlzLmVudHJpZXMgPSBlbnRyaWVzO1xuICAgIHRoaXMuY29tcGxldGUgPSBjb21wbGV0ZTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcztcbiAgfVxuICBhc3luYyAqIGl0ZXJFbnRyaWVzICgpIHtcbiAgICBmb3IgKGNvbnN0IFtoYXNoLCB2YWx1ZUxpc3RdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHsgaGFzaCwgdmFsdWVMaXN0IH07XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlckhhc2hlcyAoKSB7XG4gICAgZm9yIChjb25zdCBoYXNoIG9mIE9iamVjdC5rZXlzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIGhhc2g7XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlclZhbHVlTGlzdHMgKCkge1xuICAgIGZvciAoY29uc3QgdmFsdWVMaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgdmFsdWVMaXN0O1xuICAgIH1cbiAgfVxuICBhc3luYyBnZXRWYWx1ZUxpc3QgKGhhc2gpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzW2hhc2hdIHx8IFtdO1xuICB9XG4gIGFzeW5jIGFkZFZhbHVlIChoYXNoLCB2YWx1ZSkge1xuICAgIC8vIFRPRE86IGFkZCBzb21lIGtpbmQgb2Ygd2FybmluZyBpZiB0aGlzIGlzIGdldHRpbmcgYmlnP1xuICAgIHRoaXMuZW50cmllc1toYXNoXSA9IGF3YWl0IHRoaXMuZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgIGlmICh0aGlzLmVudHJpZXNbaGFzaF0uaW5kZXhPZih2YWx1ZSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbk1lbW9yeUluZGV4O1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgKiBhcyBUQUJMRVMgZnJvbSAnLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuaW1wb3J0ICogYXMgV1JBUFBFUlMgZnJvbSAnLi9XcmFwcGVycy9XcmFwcGVycy5qcyc7XG5pbXBvcnQgKiBhcyBJTkRFWEVTIGZyb20gJy4vSW5kZXhlcy9JbmRleGVzLmpzJztcblxubGV0IE5FWFRfQ0xBU1NfSUQgPSAxO1xubGV0IE5FWFRfVEFCTEVfSUQgPSAxO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoRmlsZVJlYWRlciwgbG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBlaXRoZXIgd2luZG93LmxvY2FsU3RvcmFnZSBvciBudWxsXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG4gICAgdGhpcy5EQVRBTElCX0ZPUk1BVFMgPSB7XG4gICAgICAnanNvbic6ICdqc29uJyxcbiAgICAgICdjc3YnOiAnY3N2JyxcbiAgICAgICd0c3YnOiAndHN2JyxcbiAgICAgICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICAgICAndHJlZWpzb24nOiAndHJlZWpzb24nXG4gICAgfTtcblxuICAgIC8vIEFjY2VzcyB0byBjb3JlIGNsYXNzZXMgdmlhIHRoZSBtYWluIGxpYnJhcnkgaGVscHMgYXZvaWQgY2lyY3VsYXIgaW1wb3J0c1xuICAgIHRoaXMuVEFCTEVTID0gVEFCTEVTO1xuICAgIHRoaXMuQ0xBU1NFUyA9IENMQVNTRVM7XG4gICAgdGhpcy5XUkFQUEVSUyA9IFdSQVBQRVJTO1xuICAgIHRoaXMuSU5ERVhFUyA9IElOREVYRVM7XG5cbiAgICAvLyBEZWZhdWx0IG5hbWVkIGZ1bmN0aW9uc1xuICAgIHRoaXMuTkFNRURfRlVOQ1RJT05TID0ge1xuICAgICAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7IHlpZWxkIHdyYXBwZWRJdGVtLnJhd0l0ZW07IH0sXG4gICAgICBrZXk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7XG4gICAgICAgIGlmICghd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEdyYW5kcGFyZW50IGlzIG5vdCBhbiBvYmplY3QgLyBhcnJheWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICBpZiAoIShwYXJlbnRUeXBlID09PSAnbnVtYmVyJyB8fCBwYXJlbnRUeXBlID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXJlbnQgaXNuJ3QgYSBrZXkgLyBpbmRleGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRGaW5pc2g6IGZ1bmN0aW9uICogKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkge1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgbGVmdDogdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0sXG4gICAgICAgICAgcmlnaHQ6IG90aGVyV3JhcHBlZEl0ZW0ucmF3SXRlbVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHNoYTE6IHJhd0l0ZW0gPT4gc2hhMShKU09OLnN0cmluZ2lmeShyYXdJdGVtKSksXG4gICAgICBub29wOiAoKSA9PiB7fVxuICAgIH07XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnRhYmxlcyA9IHRoaXMuaHlkcmF0ZSgnbXVyZV90YWJsZXMnLCB0aGlzLlRBQkxFUyk7XG4gICAgTkVYVF9UQUJMRV9JRCA9IE9iamVjdC5rZXlzKHRoaXMudGFibGVzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgdGFibGVJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQodGFibGVJZC5tYXRjaCgvdGFibGUoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgb3VyIGNsYXNzIHNwZWNpZmljYXRpb25zXG4gICAgdGhpcy5jbGFzc2VzID0gdGhpcy5oeWRyYXRlKCdtdXJlX2NsYXNzZXMnLCB0aGlzLkNMQVNTRVMpO1xuICAgIE5FWFRfQ0xBU1NfSUQgPSBPYmplY3Qua2V5cyh0aGlzLmNsYXNzZXMpXG4gICAgICAucmVkdWNlKChoaWdoZXN0TnVtLCBjbGFzc0lkKSA9PiB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heChoaWdoZXN0TnVtLCBwYXJzZUludChjbGFzc0lkLm1hdGNoKC9jbGFzcyhcXGQqKS8pWzFdKSk7XG4gICAgICB9LCAwKSArIDE7XG4gIH1cblxuICBzYXZlVGFibGVzICgpIHtcbiAgICB0aGlzLmRlaHlkcmF0ZSgnbXVyZV90YWJsZXMnLCB0aGlzLnRhYmxlcyk7XG4gICAgdGhpcy50cmlnZ2VyKCd0YWJsZVVwZGF0ZScpO1xuICB9XG4gIHNhdmVDbGFzc2VzICgpIHtcbiAgICB0aGlzLmRlaHlkcmF0ZSgnbXVyZV9jbGFzc2VzJywgdGhpcy5jbGFzc2VzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NsYXNzVXBkYXRlJyk7XG4gIH1cblxuICBoeWRyYXRlIChzdG9yYWdlS2V5LCBUWVBFUykge1xuICAgIGxldCBjb250YWluZXIgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKHN0b3JhZ2VLZXkpO1xuICAgIGNvbnRhaW5lciA9IGNvbnRhaW5lciA/IEpTT04ucGFyc2UoY29udGFpbmVyKSA6IHt9O1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvbnRhaW5lcikpIHtcbiAgICAgIGNvbnN0IHR5cGUgPSB2YWx1ZS50eXBlO1xuICAgICAgZGVsZXRlIHZhbHVlLnR5cGU7XG4gICAgICB2YWx1ZS5tdXJlID0gdGhpcztcbiAgICAgIGNvbnRhaW5lcltrZXldID0gbmV3IFRZUEVTW3R5cGVdKHZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbnRhaW5lcjtcbiAgfVxuICBkZWh5ZHJhdGUgKHN0b3JhZ2VLZXksIGNvbnRhaW5lcikge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0ge307XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb250YWluZXIpKSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICAgIHJlc3VsdFtrZXldLnR5cGUgPSB2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShzdG9yYWdlS2V5LCBKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcbiAgICB9XG4gIH1cbiAgaHlkcmF0ZUZ1bmN0aW9uIChzdHJpbmdpZmllZEZ1bmMpIHtcbiAgICBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cblxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy50YWJsZUlkKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke05FWFRfVEFCTEVfSUR9YDtcbiAgICAgIE5FWFRfVEFCTEVfSUQgKz0gMTtcbiAgICB9XG4gICAgY29uc3QgVHlwZSA9IHRoaXMuVEFCTEVTW29wdGlvbnMudHlwZV07XG4gICAgZGVsZXRlIG9wdGlvbnMudHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIGlmICghb3B0aW9ucy5jbGFzc0lkKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke05FWFRfQ0xBU1NfSUR9YDtcbiAgICAgIE5FWFRfQ0xBU1NfSUQgKz0gMTtcbiAgICB9XG4gICAgY29uc3QgVHlwZSA9IHRoaXMuQ0xBU1NFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIG5ld1RhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGVPYmogPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZU9iajtcbiAgfVxuICBuZXdDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld0NsYXNzT2JqID0gdGhpcy5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0NsYXNzT2JqO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljVGFibGUgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY1RhYmxlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24gPSAndHh0JywgdGV4dCB9KSB7XG4gICAgbGV0IGRhdGEsIGF0dHJpYnV0ZXM7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5uZXdUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5uZXdDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBkZWxldGVBbGxVbnVzZWRUYWJsZXMgKCkge1xuICAgIGZvciAoY29uc3QgdGFibGVJZCBpbiB0aGlzLnRhYmxlcykge1xuICAgICAgaWYgKHRoaXMudGFibGVzW3RhYmxlSWRdKSB7XG4gICAgICAgIHRyeSB7IHRoaXMudGFibGVzW3RhYmxlSWRdLmRlbGV0ZSgpOyB9IGNhdGNoIChlcnIpIHt9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGRlbGV0ZUFsbENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc09iai5kZWxldGUoKTtcbiAgICB9XG4gIH1cbiAgZ2V0Q2xhc3NEYXRhICgpIHtcbiAgICBjb25zdCByZXN1bHRzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIHJlc3VsdHNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5jdXJyZW50RGF0YTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXVyZTtcbiIsImltcG9ydCBNdXJlIGZyb20gJy4vTXVyZS5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5pbXBvcnQgRmlsZVJlYWRlciBmcm9tICdmaWxlcmVhZGVyJztcblxubGV0IG11cmUgPSBuZXcgTXVyZShGaWxlUmVhZGVyLCBudWxsKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsIm9mZiIsImluZGV4Iiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5Iiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiT2JqZWN0IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJUYWJsZSIsIm9wdGlvbnMiLCJfbXVyZSIsIm11cmUiLCJ0YWJsZUlkIiwiRXJyb3IiLCJfZXhwZWN0ZWRBdHRyaWJ1dGVzIiwiYXR0cmlidXRlcyIsIl9vYnNlcnZlZEF0dHJpYnV0ZXMiLCJfZGVyaXZlZFRhYmxlcyIsImRlcml2ZWRUYWJsZXMiLCJfZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImF0dHIiLCJzdHJpbmdpZmllZEZ1bmMiLCJlbnRyaWVzIiwiZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImh5ZHJhdGVGdW5jdGlvbiIsIl9zdXBwcmVzc2VkQXR0cmlidXRlcyIsInN1cHByZXNzZWRBdHRyaWJ1dGVzIiwiX3N1cHByZXNzSW5kZXgiLCJzdXBwcmVzc0luZGV4IiwiX2luZGV4U3ViRmlsdGVyIiwiaW5kZXhTdWJGaWx0ZXIiLCJfYXR0cmlidXRlU3ViRmlsdGVycyIsImF0dHJpYnV0ZVN1YkZpbHRlcnMiLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsInVzZWRCeUNsYXNzZXMiLCJfdXNlZEJ5Q2xhc3NlcyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwiZnVuYyIsIm5hbWUiLCJpdGVyYXRlIiwicmVzZXQiLCJfY2FjaGUiLCJsaW1pdCIsInVuZGVmaW5lZCIsIkluZmluaXR5IiwidmFsdWVzIiwic2xpY2UiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJkZXJpdmVkVGFibGUiLCJidWlsZENhY2hlIiwiX2NhY2hlUHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY291bnRSb3dzIiwia2V5cyIsImxlbmd0aCIsIml0ZXJhdG9yIiwiX2l0ZXJhdGUiLCJjb21wbGV0ZWQiLCJuZXh0IiwiZG9uZSIsIl9maW5pc2hJdGVtIiwid3JhcHBlZEl0ZW0iLCJyb3ciLCJrZWVwIiwiZGlzY29ubmVjdCIsIl93cmFwIiwidGFibGUiLCJjbGFzc09iaiIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJvdGhlckl0ZW0iLCJpdGVtc1RvQ29ubmVjdCIsImNvbm5lY3RJdGVtIiwiZ2V0SW5kZXhEZXRhaWxzIiwiZGV0YWlscyIsInN1cHByZXNzZWQiLCJmaWx0ZXJlZCIsImdldEF0dHJpYnV0ZURldGFpbHMiLCJhbGxBdHRycyIsImV4cGVjdGVkIiwib2JzZXJ2ZWQiLCJkZXJpdmVkIiwiY3VycmVudERhdGEiLCJkYXRhIiwiY29tcGxldGUiLCJkZXJpdmVBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJzdXBwcmVzc0F0dHJpYnV0ZSIsImFkZFN1YkZpbHRlciIsIl9kZXJpdmVUYWJsZSIsIm5ld1RhYmxlIiwiY3JlYXRlVGFibGUiLCJzYXZlVGFibGVzIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlSWQiLCJmaW5kIiwidGFibGVPYmoiLCJldmVyeSIsIm9wdGlvbk5hbWUiLCJvcHRpb25WYWx1ZSIsInRhYmxlcyIsInNob3J0ZXN0UGF0aFRvVGFibGUiLCJvdGhlclRhYmxlIiwidmlzaXRlZCIsImRpc3RhbmNlcyIsInByZXZUYWJsZXMiLCJ2aXNpdCIsInRhcmdldElkIiwidGFyZ2V0VGFibGUiLCJuZWlnaGJvckxpc3QiLCJjb25jYXQiLCJwYXJlbnRUYWJsZXMiLCJtYXAiLCJwYXJlbnRUYWJsZSIsImZpbHRlciIsIm5laWdoYm9ySWQiLCJ0b1Zpc2l0Iiwic29ydCIsImEiLCJiIiwibmV4dElkIiwic2hpZnQiLCJjaGFpbiIsInVuc2hpZnQiLCJhZ2dyZWdhdGUiLCJleHBhbmQiLCJkZWxpbWl0ZXIiLCJjbG9zZWRGYWNldCIsIm9wZW5GYWNldCIsImNsb3NlZFRyYW5zcG9zZSIsImluZGV4ZXMiLCJvcGVuVHJhbnNwb3NlIiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0IiwiY2xhc3NlcyIsInJlZHVjZSIsImFnZyIsImRlbGV0ZSIsImV4ZWMiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJpdGVtIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQWdncmVnYXRlZFRhYmxlIiwiX2F0dHJpYnV0ZSIsIl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJyZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJfZGVoeWRyYXRlRnVuY3Rpb24iLCJkZXJpdmVSZWR1Y2VkQXR0cmlidXRlIiwiX3VwZGF0ZUl0ZW0iLCJvcmlnaW5hbFdyYXBwZWRJdGVtIiwibmV3V3JhcHBlZEl0ZW0iLCJ3cmFwcGVkUGFyZW50IiwiZXhpc3RpbmdJdGVtIiwibmV3SXRlbSIsInJlZHVjZWQiLCJEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfaW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9kdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlQXR0cmlidXRlIiwicGFyZW50SWQiLCJfZHVwbGljYXRlQXR0cmlidXRlcyIsInBhcmVudE5hbWUiLCJjb25uZWN0ZWRJdGVtcyIsImF0dHJOYW1lIiwiY29waWVkIiwiRXhwYW5kZWRUYWJsZSIsInNwbGl0IiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJHZW5lcmljQ2xhc3MiLCJjbGFzc0lkIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsImFubm90YXRpb24iLCJzZXRDbGFzc05hbWUiLCJzYXZlQ2xhc3NlcyIsImhhc0N1c3RvbU5hbWUiLCJnZXRIYXNoVGFibGUiLCJpbnRlcnByZXRBc05vZGVzIiwibmV3Q2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiX2Rlcml2ZUdlbmVyaWNDbGFzcyIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc0lkcyIsIl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRocyIsIk5vZGVXcmFwcGVyIiwicHJlcFNob3J0ZXN0RWRnZVBhdGgiLCJlZGdlQ2xhc3NJZCIsImVkZ2VUYWJsZSIsImlkTGlzdCIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNyZWF0ZUNsYXNzIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibm9kZUNsYXNzIiwiZGlzY29ubmVjdFNvdXJjZSIsImRpc2Nvbm5lY3RUYXJnZXQiLCJFZGdlQ2xhc3MiLCJFZGdlV3JhcHBlciIsIl9waWNrRWRnZVRhYmxlIiwib3RoZXJDbGFzcyIsInN0YXRpY0V4aXN0cyIsImRpc3QiLCJzdGFydHNXaXRoIiwicHJlcFNob3J0ZXN0U291cmNlUGF0aCIsIl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGgiLCJzb3VyY2VUYWJsZSIsInByZXBTaG9ydGVzdFRhcmdldFBhdGgiLCJfY2FjaGVkU2hvcnRlc3RUYXJnZXRQYXRoIiwibmV3Tm9kZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsImRpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiY29ubmVjdFRhcmdldCIsImNvbm5lY3RTb3VyY2UiLCJ0b2dnbGVOb2RlRGlyZWN0aW9uIiwic2tpcFNhdmUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJpdGVtTGlzdCIsIml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInRhYmxlSWRzIiwidGhpc1RhYmxlSWQiLCJyZW1haW5pbmdUYWJsZUlkcyIsImVkZ2VzIiwiZWRnZUlkcyIsInRhYmxlSWRDaGFpbiIsInNvdXJjZU5vZGVzIiwidGFyZ2V0Tm9kZXMiLCJJbk1lbW9yeUluZGV4IiwidG9SYXdPYmplY3QiLCJpdGVyRW50cmllcyIsImhhc2giLCJ2YWx1ZUxpc3QiLCJpdGVySGFzaGVzIiwiaXRlclZhbHVlTGlzdHMiLCJnZXRWYWx1ZUxpc3QiLCJhZGRWYWx1ZSIsIk5FWFRfQ0xBU1NfSUQiLCJORVhUX1RBQkxFX0lEIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiZGVidWciLCJEQVRBTElCX0ZPUk1BVFMiLCJUQUJMRVMiLCJDTEFTU0VTIiwiSU5ERVhFUyIsIk5BTUVEX0ZVTkNUSU9OUyIsImlkZW50aXR5IiwicmF3SXRlbSIsImtleSIsIlR5cGVFcnJvciIsInBhcmVudFR5cGUiLCJkZWZhdWx0RmluaXNoIiwidGhpc1dyYXBwZWRJdGVtIiwib3RoZXJXcmFwcGVkSXRlbSIsImxlZnQiLCJyaWdodCIsInNoYTEiLCJKU09OIiwic3RyaW5naWZ5Iiwibm9vcCIsImh5ZHJhdGUiLCJoaWdoZXN0TnVtIiwiTWF0aCIsIm1heCIsInBhcnNlSW50IiwibWF0Y2giLCJkZWh5ZHJhdGUiLCJzdG9yYWdlS2V5IiwiVFlQRVMiLCJjb250YWluZXIiLCJnZXRJdGVtIiwicGFyc2UiLCJzZXRJdGVtIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIlR5cGUiLCJzZWxlY3RvciIsIm5ld1RhYmxlT2JqIiwibmV3Q2xhc3NPYmoiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwiY29uc29sZSIsIndhcm4iLCJ0ZXh0IiwicmVhZGVyIiwib25sb2FkIiwicmVhZEFzVGV4dCIsImFkZFN0cmluZ0FzU3RhdGljVGFibGUiLCJleHRlbnNpb24iLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNUYWJsZSIsIkFycmF5IiwiZGVsZXRlQWxsVW51c2VkVGFibGVzIiwiZXJyIiwiZGVsZXRlQWxsQ2xhc3NlcyIsImdldENsYXNzRGF0YSIsInJlc3VsdHMiLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FBSTtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsYUFBTCxHQUFxQixFQUFyQjtXQUNLQyxjQUFMLEdBQXNCLEVBQXRCOzs7SUFFRkMsRUFBRSxDQUFFQyxTQUFGLEVBQWFDLFFBQWIsRUFBdUJDLHVCQUF2QixFQUFnRDtVQUM1QyxDQUFDLEtBQUtMLGFBQUwsQ0FBbUJHLFNBQW5CLENBQUwsRUFBb0M7YUFDN0JILGFBQUwsQ0FBbUJHLFNBQW5CLElBQWdDLEVBQWhDOzs7VUFFRSxDQUFDRSx1QkFBTCxFQUE4QjtZQUN4QixLQUFLTCxhQUFMLENBQW1CRyxTQUFuQixFQUE4QkcsT0FBOUIsQ0FBc0NGLFFBQXRDLE1BQW9ELENBQUMsQ0FBekQsRUFBNEQ7Ozs7O1dBSXpESixhQUFMLENBQW1CRyxTQUFuQixFQUE4QkksSUFBOUIsQ0FBbUNILFFBQW5DOzs7SUFFRkksR0FBRyxDQUFFTCxTQUFGLEVBQWFDLFFBQWIsRUFBdUI7VUFDcEIsS0FBS0osYUFBTCxDQUFtQkcsU0FBbkIsQ0FBSixFQUFtQztZQUM3QixDQUFDQyxRQUFMLEVBQWU7aUJBQ04sS0FBS0osYUFBTCxDQUFtQkcsU0FBbkIsQ0FBUDtTQURGLE1BRU87Y0FDRE0sS0FBSyxHQUFHLEtBQUtULGFBQUwsQ0FBbUJHLFNBQW5CLEVBQThCRyxPQUE5QixDQUFzQ0YsUUFBdEMsQ0FBWjs7Y0FDSUssS0FBSyxJQUFJLENBQWIsRUFB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
