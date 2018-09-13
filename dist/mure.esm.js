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

let mure = new Mure(window.FileReader, window.localStorage);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TaW5nbGVQYXJlbnRNaXhpbi5qcyIsIi4uL3NyYy9UYWJsZXMvQWdncmVnYXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0V4cGFuZGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0ZhY2V0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvVHJhbnNwb3NlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Db25uZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9JbmRleGVzL0luTWVtb3J5SW5kZXguanMiLCIuLi9zcmMvTXVyZS5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICBpZiAoIXRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoIWFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKSAhPT0gLTEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudE5hbWUsIC4uLmFyZ3MpIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fbXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLl9tdXJlIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbXVyZSBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG5cbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzID0gb3B0aW9ucy5kZXJpdmVkVGFibGVzIHx8IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIHx8IHt9KSkge1xuICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLnN1cHByZXNzZWRBdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSAhIW9wdGlvbnMuc3VwcHJlc3NJbmRleDtcblxuICAgIHRoaXMuX2luZGV4U3ViRmlsdGVyID0gKG9wdGlvbnMuaW5kZXhTdWJGaWx0ZXIgJiYgdGhpcy5fbXVyZS5oeWRyYXRlRnVuY3Rpb24ob3B0aW9ucy5pbmRleFN1YkZpbHRlcikpIHx8IG51bGw7XG4gICAgdGhpcy5fYXR0cmlidXRlU3ViRmlsdGVycyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5hdHRyaWJ1dGVTdWJGaWx0ZXJzIHx8IHt9KSkge1xuICAgICAgdGhpcy5fYXR0cmlidXRlU3ViRmlsdGVyc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgYXR0cmlidXRlczogdGhpcy5fYXR0cmlidXRlcyxcbiAgICAgIGRlcml2ZWRUYWJsZXM6IHRoaXMuX2Rlcml2ZWRUYWJsZXMsXG4gICAgICB1c2VkQnlDbGFzc2VzOiB0aGlzLl91c2VkQnlDbGFzc2VzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge30sXG4gICAgICBzdXBwcmVzc2VkQXR0cmlidXRlczogdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMsXG4gICAgICBzdXBwcmVzc0luZGV4OiB0aGlzLl9zdXBwcmVzc0luZGV4LFxuICAgICAgYXR0cmlidXRlU3ViRmlsdGVyczoge30sXG4gICAgICBpbmRleFN1YkZpbHRlcjogKHRoaXMuX2luZGV4U3ViRmlsdGVyICYmIHRoaXMuX211cmUuZGVoeWRyYXRlRnVuY3Rpb24odGhpcy5faW5kZXhTdWJGaWx0ZXIpKSB8fCBudWxsXG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgcmVzdWx0LmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSkge1xuICAgICAgcmVzdWx0LmF0dHJpYnV0ZVN1YkZpbHRlcnNbYXR0cl0gPSB0aGlzLl9tdXJlLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIEdlbmVyaWMgY2FjaGluZyBzdHVmZjsgdGhpcyBpc24ndCBqdXN0IGZvciBwZXJmb3JtYW5jZS4gQ29ubmVjdGVkVGFibGUnc1xuICAgIC8vIGFsZ29yaXRobSByZXF1aXJlcyB0aGF0IGl0cyBwYXJlbnQgdGFibGVzIGhhdmUgcHJlLWJ1aWx0IGluZGV4ZXMgKHdlXG4gICAgLy8gdGVjaG5pY2FsbHkgY291bGQgaW1wbGVtZW50IGl0IGRpZmZlcmVudGx5LCBidXQgaXQgd291bGQgYmUgZXhwZW5zaXZlLFxuICAgIC8vIHJlcXVpcmVzIHRyaWNreSBsb2dpYywgYW5kIHdlJ3JlIGFscmVhZHkgYnVpbGRpbmcgaW5kZXhlcyBmb3Igc29tZSB0YWJsZXNcbiAgICAvLyBsaWtlIEFnZ3JlZ2F0ZWRUYWJsZSBhbnl3YXkpXG4gICAgaWYgKG9wdGlvbnMucmVzZXQpIHtcbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgICAgeWllbGQgKiBPYmplY3QudmFsdWVzKHRoaXMuX2NhY2hlKS5zbGljZSgwLCBsaW1pdCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgeWllbGQgKiBhd2FpdCB0aGlzLl9idWlsZENhY2hlKG9wdGlvbnMpO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBmb3IgKGNvbnN0IGRlcml2ZWRUYWJsZSBvZiB0aGlzLmRlcml2ZWRUYWJsZXMpIHtcbiAgICAgIGRlcml2ZWRUYWJsZS5yZXNldCgpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jlc2V0Jyk7XG4gIH1cbiAgYXN5bmMgYnVpbGRDYWNoZSAoKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGU7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0ZW1wIG9mIHRoaXMuX2J1aWxkQ2FjaGUoKSkge30gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgICAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgY291bnRSb3dzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMoYXdhaXQgdGhpcy5idWlsZENhY2hlKCkpLmxlbmd0aDtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpO1xuICAgIGxldCBjb21wbGV0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBpdGVyYXRpb24gd2FzIGNhbmNlbGxlZDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgY29tcGxldGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHRlbXAudmFsdWUpO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGVtcC52YWx1ZS5pbmRleF0gPSB0ZW1wLnZhbHVlO1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gd3JhcHBlZEl0ZW0ucm93KSB7XG4gICAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGRlbGV0ZSB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhTdWJGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleFN1YkZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBmdW5jKHdyYXBwZWRJdGVtLnJvd1thdHRyXSk7XG4gICAgICBpZiAoIWtlZXApIHsgYnJlYWs7IH1cbiAgICB9XG4gICAgaWYgKGtlZXApIHtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbmlzaCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3cmFwcGVkSXRlbS5kaXNjb25uZWN0KCk7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaWx0ZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIGtlZXA7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBjbGFzc09iaiA/IGNsYXNzT2JqLl93cmFwKG9wdGlvbnMpIDogbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gICAgZm9yIChjb25zdCBvdGhlckl0ZW0gb2Ygb3B0aW9ucy5pdGVtc1RvQ29ubmVjdCB8fCBbXSkge1xuICAgICAgd3JhcHBlZEl0ZW0uY29ubmVjdEl0ZW0ob3RoZXJJdGVtKTtcbiAgICAgIG90aGVySXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuICBnZXRJbmRleERldGFpbHMgKCkge1xuICAgIGNvbnN0IGRldGFpbHMgPSB7IG5hbWU6IG51bGwgfTtcbiAgICBpZiAodGhpcy5fc3VwcHJlc3NJbmRleCkge1xuICAgICAgZGV0YWlscy5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2luZGV4U3ViRmlsdGVyKSB7XG4gICAgICBkZXRhaWxzLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGRldGFpbHM7XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZXhwZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ub2JzZXJ2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmRlcml2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0QXR0cmlidXRlRGV0YWlscygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBzdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZV0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgYWRkU3ViRmlsdGVyIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9pbmRleFN1YkZpbHRlciA9IGZ1bmM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMuX211cmUuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlVGFibGVzKCk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZUlkID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlSWQgJiYgdGhpcy5fbXVyZS50YWJsZXNbZXhpc3RpbmdUYWJsZUlkXSkgfHwgbnVsbDtcbiAgfVxuICBzaG9ydGVzdFBhdGhUb1RhYmxlIChvdGhlclRhYmxlKSB7XG4gICAgLy8gRGlqa3N0cmEncyBhbGdvcml0aG0uLi5cbiAgICBjb25zdCB2aXNpdGVkID0ge307XG4gICAgY29uc3QgZGlzdGFuY2VzID0ge307XG4gICAgY29uc3QgcHJldlRhYmxlcyA9IHt9O1xuICAgIGNvbnN0IHZpc2l0ID0gdGFyZ2V0SWQgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0VGFibGUgPSB0aGlzLl9tdXJlLnRhYmxlc1t0YXJnZXRJZF07XG4gICAgICAvLyBPbmx5IGNoZWNrIHRoZSB1bnZpc2l0ZWQgZGVyaXZlZCBhbmQgcGFyZW50IHRhYmxlc1xuICAgICAgY29uc3QgbmVpZ2hib3JMaXN0ID0gT2JqZWN0LmtleXModGFyZ2V0VGFibGUuX2Rlcml2ZWRUYWJsZXMpXG4gICAgICAgIC5jb25jYXQodGFyZ2V0VGFibGUucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS50YWJsZUlkKSlcbiAgICAgICAgLmZpbHRlcih0YWJsZUlkID0+ICF2aXNpdGVkW3RhYmxlSWRdKTtcbiAgICAgIC8vIENoZWNrIGFuZCBhc3NpZ24gKG9yIHVwZGF0ZSkgdGVudGF0aXZlIGRpc3RhbmNlcyB0byBlYWNoIG5laWdoYm9yXG4gICAgICBmb3IgKGNvbnN0IG5laWdoYm9ySWQgb2YgbmVpZ2hib3JMaXN0KSB7XG4gICAgICAgIGlmIChkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9IEluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIGlmIChkaXN0YW5jZXNbdGFyZ2V0SWRdICsgMSA8IGRpc3RhbmNlc1tuZWlnaGJvcklkXSkge1xuICAgICAgICAgIGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9IGRpc3RhbmNlc1t0YXJnZXRJZF0gKyAxO1xuICAgICAgICAgIHByZXZUYWJsZXNbbmVpZ2hib3JJZF0gPSB0YXJnZXRJZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgdGhpcyB0YWJsZSBpcyBvZmZpY2lhbGx5IHZpc2l0ZWQ7IHRha2UgaXQgb3V0IG9mIHRoZSBydW5uaW5nXG4gICAgICAvLyBmb3IgZnV0dXJlIHZpc2l0cyAvIGNoZWNrc1xuICAgICAgdmlzaXRlZFt0YXJnZXRJZF0gPSB0cnVlO1xuICAgICAgZGVsZXRlIGRpc3RhbmNlc1t0YXJnZXRJZF07XG4gICAgfTtcblxuICAgIC8vIFN0YXJ0IHdpdGggdGhpcyB0YWJsZVxuICAgIHByZXZUYWJsZXNbdGhpcy50YWJsZUlkXSA9IG51bGw7XG4gICAgZGlzdGFuY2VzW3RoaXMudGFibGVJZF0gPSAwO1xuICAgIGxldCB0b1Zpc2l0ID0gT2JqZWN0LmtleXMoZGlzdGFuY2VzKTtcbiAgICB3aGlsZSAodG9WaXNpdC5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBWaXNpdCB0aGUgbmV4dCB0YWJsZSB0aGF0IGhhcyB0aGUgc2hvcnRlc3QgZGlzdGFuY2VcbiAgICAgIHRvVmlzaXQuc29ydCgoYSwgYikgPT4gZGlzdGFuY2VzW2FdIC0gZGlzdGFuY2VzW2JdKTtcbiAgICAgIGxldCBuZXh0SWQgPSB0b1Zpc2l0LnNoaWZ0KCk7XG4gICAgICBpZiAobmV4dElkID09PSBvdGhlclRhYmxlLnRhYmxlSWQpIHtcbiAgICAgICAgLy8gRm91bmQgb3RoZXJUYWJsZSEgU2VuZCBiYWNrIHRoZSBjaGFpbiBvZiBjb25uZWN0ZWQgdGFibGVzXG4gICAgICAgIGNvbnN0IGNoYWluID0gW107XG4gICAgICAgIHdoaWxlIChwcmV2VGFibGVzW25leHRJZF0gIT09IG51bGwpIHtcbiAgICAgICAgICBjaGFpbi51bnNoaWZ0KHRoaXMuX211cmUudGFibGVzW25leHRJZF0pO1xuICAgICAgICAgIG5leHRJZCA9IHByZXZUYWJsZXNbbmV4dElkXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2hhaW47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBWaXNpdCB0aGUgdGFibGVcbiAgICAgICAgdmlzaXQobmV4dElkKTtcbiAgICAgICAgdG9WaXNpdCA9IE9iamVjdC5rZXlzKGRpc3RhbmNlcyk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFdlIGRpZG4ndCBmaW5kIGl0OyB0aGVyZSdzIG5vIGNvbm5lY3Rpb25cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnQWdncmVnYXRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnRXhwYW5kZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBkZWxpbWl0ZXJcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKHsgbGltaXQgfSkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiBpbmRleGVzLm1hcChpbmRleCA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXhcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXg6IHdyYXBwZWRJdGVtLmluZGV4XG4gICAgICB9O1xuICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMuX211cmUuY3JlYXRlVGFibGUoeyB0eXBlOiAnQ29ubmVjdGVkVGFibGUnIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5fbXVyZS50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fbXVyZS50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCB8fCB0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBpbi11c2UgdGFibGUgJHt0aGlzLnRhYmxlSWR9YCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9tdXJlLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3RUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpZXJkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEFnZ3JlZ2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuX2RlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpic7XG4gIH1cbiAgZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSAoYXR0ciwgZnVuYykge1xuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIF91cGRhdGVJdGVtIChvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyhvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0udHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucykge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugc28gdGhhdCBBZ2dyZWdhdGVkVGFibGUgY2FuIHRha2UgYWR2YW50YWdlXG4gICAgLy8gb2YgdGhlIHBhcnRpYWxseS1idWlsdCBjYWNoZSBhcyBpdCBnb2VzLCBhbmQgcG9zdHBvbmUgZmluaXNoaW5nIGl0ZW1zXG4gICAgLy8gdW50aWwgYWZ0ZXIgdGhlIHBhcmVudCB0YWJsZSBoYXMgYmVlbiBmdWxseSBpdGVyYXRlZFxuXG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5faXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3dyYXBwZWRJdGVtLmluZGV4XSA9IHdyYXBwZWRJdGVtO1xuICAgICAgLy8gR28gYWhlYWQgYW5kIHlpZWxkIHRoZSB1bmZpbmlzaGVkIGl0ZW07IHRoaXMgbWFrZXMgaXQgcG9zc2libGUgZm9yXG4gICAgICAvLyBjbGllbnQgYXBwcyB0byBiZSBtb3JlIHJlc3BvbnNpdmUgYW5kIHJlbmRlciBwYXJ0aWFsIHJlc3VsdHMsIGJ1dCBhbHNvXG4gICAgICAvLyBtZWFucyB0aGF0IHRoZXkgbmVlZCB0byB3YXRjaCBmb3Igd3JhcHBlZEl0ZW0ub24oJ3VwZGF0ZScpIGV2ZW50c1xuICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgfVxuXG4gICAgLy8gU2Vjb25kIHBhc3M6IG5vdyB0aGF0IHdlJ3ZlIGNvbXBsZXRlZCB0aGUgZnVsbCBpdGVyYXRpb24gb2YgdGhlIHBhcmVudFxuICAgIC8vIHRhYmxlLCB3ZSBjYW4gZmluaXNoIGVhY2ggaXRlbVxuICAgIGZvciAoY29uc3QgaW5kZXggaW4gdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICBpZiAoIXRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0pIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgICAgZXhpc3RpbmdJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB3cmFwcGVkUGFyZW50LmNvbm5lY3RJdGVtKGV4aXN0aW5nSXRlbSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0oZXhpc3RpbmdJdGVtLCB3cmFwcGVkUGFyZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0obmV3SXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0gc3VwZXIuZ2V0QXR0cmlidXRlRGV0YWlscygpO1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5yZWR1Y2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBBZ2dyZWdhdGVkVGFibGU7XG4iLCJjb25zdCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5kdXBsaWNhdGVkQXR0cmlidXRlcyB8fCB7fTtcbiAgICB9XG4gICAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgICAgb2JqLmR1cGxpY2F0ZWRBdHRyaWJ1dGVzID0gdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXM7XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICBkdXBsaWNhdGVBdHRyaWJ1dGUgKHBhcmVudElkLCBhdHRyaWJ1dGUpIHtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzW3BhcmVudElkXSA9IHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzW3BhcmVudElkXSB8fCBbXTtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzW3BhcmVudElkXS5wdXNoKGF0dHJpYnV0ZSk7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuICAgIF9kdXBsaWNhdGVBdHRyaWJ1dGVzICh3cmFwcGVkSXRlbSkge1xuICAgICAgZm9yIChjb25zdCBbcGFyZW50SWQsIGF0dHJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICBjb25zdCBwYXJlbnROYW1lID0gdGhpcy5fbXVyZS50YWJsZXNbcGFyZW50SWRdLm5hbWU7XG4gICAgICAgIHdyYXBwZWRJdGVtLnJvd1tgJHtwYXJlbnROYW1lfS4ke2F0dHJ9YF0gPSB3cmFwcGVkSXRlbS5jb25uZWN0ZWRJdGVtc1twYXJlbnRJZF1bMF0ucm93W2F0dHJdO1xuICAgICAgfVxuICAgIH1cbiAgICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICAgIGNvbnN0IGFsbEF0dHJzID0gc3VwZXIuZ2V0QXR0cmlidXRlRGV0YWlscygpO1xuICAgICAgZm9yIChjb25zdCBbcGFyZW50SWQsIGF0dHJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICBjb25zdCBhdHRyTmFtZSA9IGAke3RoaXMuX211cmUudGFibGVzW3BhcmVudElkXS5uYW1lfS4ke2F0dHJ9YDtcbiAgICAgICAgYWxsQXR0cnNbYXR0ck5hbWVdID0gYWxsQXR0cnNbYXR0ck5hbWVdIHx8IHsgbmFtZTogYXR0ck5hbWUgfTtcbiAgICAgICAgYWxsQXR0cnNbYXR0ck5hbWVdLmNvcGllZCA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWxsQXR0cnM7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuaW1wb3J0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiBmcm9tICcuL0R1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5kZWxpbWl0ZXIgPSBvcHRpb25zLmRlbGltaXRlciB8fCAnLCc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAn4oakJztcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IHZhbHVlcyA9ICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdIHx8ICcnKS5zcGxpdCh0aGlzLmRlbGltaXRlcik7XG4gICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuICAgICAgICBjb25zdCByb3cgPSB7fTtcbiAgICAgICAgcm93W3RoaXMuX2F0dHJpYnV0ZV0gPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdyxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2R1cGxpY2F0ZUF0dHJpYnV0ZXMobmV3SXRlbSk7XG4gICAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmFjZXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICB0aGlzLl92YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBgWyR7dGhpcy5fdmFsdWV9XWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBpZiAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgLy8gTm9ybWFsIGZhY2V0aW5nIGp1c3QgZ2l2ZXMgYSBzdWJzZXQgb2YgdGhlIG9yaWdpbmFsIHRhYmxlXG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3c6IE9iamVjdC5hc3NpZ24oe30sIHdyYXBwZWRQYXJlbnQucm93KSxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmFjZXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBUcmFuc3Bvc2VkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2luZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5faW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5pbmRleCA9IHRoaXMuX2luZGV4O1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBg4bWAJHt0aGlzLl9pbmRleH1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGF3YWl0IHBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcblxuICAgIC8vIEl0ZXJhdGUgdGhlIHJvdydzIGF0dHJpYnV0ZXMgYXMgaW5kZXhlc1xuICAgIGNvbnN0IHdyYXBwZWRQYXJlbnQgPSBwYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5faW5kZXhdIHx8IHsgcm93OiB7fSB9O1xuICAgIGZvciAoY29uc3QgWyBpbmRleCwgdmFsdWUgXSBvZiBPYmplY3QuZW50cmllcyh3cmFwcGVkUGFyZW50LnJvdykpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gZnJvbSAnLi9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbihUYWJsZSkge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS5uYW1lKS5qb2luKCfiqK8nKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgLy8gU3BpbiB0aHJvdWdoIGFsbCBvZiB0aGUgcGFyZW50VGFibGVzIHNvIHRoYXQgdGhlaXIgX2NhY2hlIGlzIHByZS1idWlsdFxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICBhd2FpdCBwYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG4gICAgfVxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGUpKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZVtpbmRleF0pKSB7XG4gICAgICAgIC8vIE5vIG1hdGNoIGluIG9uZSBvZiB0aGUgb3RoZXIgdGFibGVzOyBvbWl0IHRoaXMgaXRlbVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIFRPRE86IGFkZCBlYWNoIHBhcmVudCB0YWJsZXMnIGtleXMgYXMgYXR0cmlidXRlIHZhbHVlc1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IHBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSlcbiAgICAgIH0pO1xuICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlcyhuZXdJdGVtKTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLl9tdXJlIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBfbXVyZSwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb24gPSBvcHRpb25zLmFubm90YXRpb24gfHwgJyc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uOiB0aGlzLmFubm90YXRpb25cbiAgICB9O1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgIT09IG51bGw7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fCB0aGlzLnRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0SGFzaFRhYmxlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIF9kZXJpdmVHZW5lcmljQ2xhc3MgKG5ld1RhYmxlKSB7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnXG4gICAgfSk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgICB0aGlzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRocyA9IHt9O1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgcHJlcFNob3J0ZXN0RWRnZVBhdGggKGVkZ2VDbGFzc0lkKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW2VkZ2VDbGFzc0lkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbZWRnZUNsYXNzSWRdO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBlZGdlVGFibGUgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRdLnRhYmxlO1xuICAgICAgY29uc3QgaWRMaXN0ID0gW107XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRoaXMudGFibGUuc2hvcnRlc3RQYXRoVG9UYWJsZShlZGdlVGFibGUpKSB7XG4gICAgICAgIGlkTGlzdC5wdXNoKHRhYmxlLnRhYmxlSWQpO1xuICAgICAgICAvLyBTcGluIHRocm91Z2ggdGhlIHRhYmxlIHRvIG1ha2Ugc3VyZSBhbGwgaXRzIHJvd3MgYXJlIHdyYXBwZWQgYW5kIGNvbm5lY3RlZFxuICAgICAgICBhd2FpdCB0YWJsZS5idWlsZENhY2hlKCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1tlZGdlQ2xhc3NJZF0gPSBpZExpc3Q7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICAvLyAob3IgYSBmbG9hdGluZyBlZGdlIGlmIGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkIGlzIG51bGwpXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZWRnZUNsYXNzLmRpcmVjdGVkO1xuICAgICAgZWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgbGV0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIG5vdyB3ZSBrbm93IGhvdyB0byBzZXQgc291cmNlIC8gdGFyZ2V0IGlkc1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSB0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIC8vIERlbGV0ZSBlYWNoIG9mIHRoZSBlZGdlIGNsYXNzZXNcbiAgICAgIHNvdXJjZUVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICAgIHRhcmdldEVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICB9XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICBkZWxldGUgb3B0aW9ucy5jbGFzc0lkO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBkaXJlY3RlZCwgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgY29uc3QgdGhpc0hhc2ggPSB0aGlzLmdldEhhc2hUYWJsZShhdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLmdldEhhc2hUYWJsZShvdGhlckF0dHJpYnV0ZSk7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzSGFzaC5jb25uZWN0KFtvdGhlckhhc2hdKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIGRpcmVjdGVkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZFxuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdFZGdlQ2xhc3M7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBkaXNjb25uZWN0QWxsRWRnZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyB0aGlzLl9tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIF9waWNrRWRnZVRhYmxlIChvdGhlckNsYXNzKSB7XG4gICAgbGV0IGVkZ2VUYWJsZTtcbiAgICBsZXQgY2hhaW4gPSB0aGlzLnRhYmxlLnNob3J0ZXN0UGF0aFRvVGFibGUob3RoZXJDbGFzcy50YWJsZSk7XG4gICAgaWYgKGNoYWluID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZGVybHlpbmcgdGFibGUgY2hhaW4gYmV0d2VlbiBlZGdlIGFuZCBub2RlIGNsYXNzZXMgaXMgYnJva2VuYCk7XG4gICAgfSBlbHNlIGlmIChjaGFpbi5sZW5ndGggPD0gMikge1xuICAgICAgLy8gV2VpcmQgY29ybmVyIGNhc2Ugd2hlcmUgd2UncmUgdHJ5aW5nIHRvIGNyZWF0ZSBhbiBlZGdlIGJldHdlZW5cbiAgICAgIC8vIGFkamFjZW50IG9yIGlkZW50aWNhbCB0YWJsZXMuLi4gY3JlYXRlIGEgQ29ubmVjdGVkVGFibGVcbiAgICAgIGVkZ2VUYWJsZSA9IHRoaXMudGFibGUuY29ubmVjdChvdGhlckNsYXNzLnRhYmxlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIGEgdGFibGUgaW4gdGhlIG1pZGRsZTsgcHJpb3JpdGl6ZSBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBjaGFpbiA9IGNoYWluLnNsaWNlKDEsIGNoYWluLmxlbmd0aCAtIDEpLm1hcCgodGFibGUsIGRpc3QpID0+IHtcbiAgICAgICAgc3RhdGljRXhpc3RzID0gc3RhdGljRXhpc3RzIHx8IHRhYmxlLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIHJldHVybiB7IHRhYmxlLCBkaXN0IH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgY2hhaW4gPSBjaGFpbi5maWx0ZXIoKHsgdGFibGUgfSkgPT4ge1xuICAgICAgICAgIHJldHVybiB0YWJsZS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVkZ2VUYWJsZSA9IGNoYWluWzBdLnRhYmxlO1xuICAgIH1cbiAgICByZXR1cm4gZWRnZVRhYmxlO1xuICB9XG4gIGFzeW5jIHByZXBTaG9ydGVzdFNvdXJjZVBhdGggKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aDtcbiAgICB9IGVsc2UgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBzb3VyY2VUYWJsZSA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdLnRhYmxlO1xuICAgICAgY29uc3QgaWRMaXN0ID0gW107XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRoaXMudGFibGUuc2hvcnRlc3RQYXRoVG9UYWJsZShzb3VyY2VUYWJsZSkpIHtcbiAgICAgICAgaWRMaXN0LnB1c2godGFibGUudGFibGVJZCk7XG4gICAgICAgIC8vIFNwaW4gdGhyb3VnaCB0aGUgdGFibGUgdG8gbWFrZSBzdXJlIGFsbCBpdHMgcm93cyBhcmUgd3JhcHBlZCBhbmQgY29ubmVjdGVkXG4gICAgICAgIGF3YWl0IHRhYmxlLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aCA9IGlkTGlzdDtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGg7XG4gICAgfVxuICB9XG4gIGFzeW5jIHByZXBTaG9ydGVzdFRhcmdldFBhdGggKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aDtcbiAgICB9IGVsc2UgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0YXJnZXRUYWJsZSA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLnRhYmxlO1xuICAgICAgY29uc3QgaWRMaXN0ID0gW107XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRoaXMudGFibGUuc2hvcnRlc3RQYXRoVG9UYWJsZSh0YXJnZXRUYWJsZSkpIHtcbiAgICAgICAgaWRMaXN0LnB1c2godGFibGUudGFibGVJZCk7XG4gICAgICAgIC8vIFNwaW4gdGhyb3VnaCB0aGUgdGFibGUgdG8gbWFrZSBzdXJlIGFsbCBpdHMgcm93cyBhcmUgd3JhcHBlZCBhbmQgY29ubmVjdGVkXG4gICAgICAgIGF3YWl0IHRhYmxlLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aCA9IGlkTGlzdDtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGg7XG4gICAgfVxuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGVsZXRlKCk7XG4gICAgdGVtcC50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgZGVsZXRlIHRlbXAuY2xhc3NJZDtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IGVkZ2VUYWJsZSA9IHRoaXMuX3BpY2tFZGdlVGFibGUoc291cmNlQ2xhc3MpO1xuICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGUudGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IHRlbXAuc291cmNlQ2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWRcbiAgICAgIH0pO1xuICAgICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0ZW1wLnRhcmdldENsYXNzSWQgJiYgdGVtcC5zb3VyY2VDbGFzc0lkICE9PSB0ZW1wLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgICBjb25zdCBlZGdlVGFibGUgPSB0aGlzLl9waWNrRWRnZVRhYmxlKHRhcmdldENsYXNzKTtcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlLnRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogdGVtcC50YXJnZXRDbGFzc0lkXG4gICAgICB9KTtcbiAgICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgZGlyZWN0aW9uLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pIHtcbiAgICBpZiAoZGlyZWN0aW9uKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGRpcmVjdGlvbiAhPT0gJ3NvdXJjZScgJiYgZGlyZWN0aW9uICE9PSAndGFyZ2V0Jykge1xuICAgICAgZGlyZWN0aW9uID0gdGhpcy50YXJnZXRDbGFzc0lkID09PSBudWxsID8gJ3RhcmdldCcgOiAnc291cmNlJztcbiAgICB9XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldCh7IG5vZGVDbGFzcywgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jb25uZWN0U291cmNlKHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgdG9nZ2xlTm9kZURpcmVjdGlvbiAoc291cmNlQ2xhc3NJZCkge1xuICAgIGlmICghc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3Qgc3dhcCB0byB1bmNvbm5lY3RlZCBjbGFzcyBpZDogJHtzb3VyY2VDbGFzc0lkfWApO1xuICAgICAgICB9XG4gICAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IHRlbXA7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBjb25uZWN0U291cmNlICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNraXBTYXZlID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMuZ2V0SGFzaFRhYmxlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MuZ2V0SGFzaFRhYmxlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSk7XG5cbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc2tpcFNhdmUgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy5nZXRIYXNoVGFibGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gdGFyZ2V0Q2xhc3MudGFibGUgOiB0YXJnZXRDbGFzcy5nZXRIYXNoVGFibGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKTtcblxuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGlzY29ubmVjdFNvdXJjZSAoeyBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdTb3VyY2VDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgICBkZWxldGUgZXhpc3RpbmdTb3VyY2VDbGFzcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aDtcbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKHsgc2tpcFNhdmUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBjb25zdCBleGlzdGluZ1RhcmdldENsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nVGFyZ2V0Q2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1RhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGg7XG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIHRoaXMudGFibGUgPSBvcHRpb25zLnRhYmxlO1xuICAgIGlmICh0aGlzLmluZGV4ID09PSB1bmRlZmluZWQgfHwgIXRoaXMudGFibGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggYW5kIHRhYmxlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLmNsYXNzT2JqID0gb3B0aW9ucy5jbGFzc09iaiB8fCBudWxsO1xuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IG9wdGlvbnMuY29ubmVjdGVkSXRlbXMgfHwge307XG4gIH1cbiAgY29ubmVjdEl0ZW0gKGl0ZW0pIHtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gPSB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gfHwgW107XG4gICAgaWYgKHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5pbmRleE9mKGl0ZW0pID09PSAtMSkge1xuICAgICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLnB1c2goaXRlbSk7XG4gICAgfVxuICB9XG4gIGRpc2Nvbm5lY3QgKCkge1xuICAgIGZvciAoY29uc3QgaXRlbUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNvbm5lY3RlZEl0ZW1zKSkge1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1MaXN0KSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gKGl0ZW0uY29ubmVjdGVkSXRlbXNbdGhpcy50YWJsZS50YWJsZUlkXSB8fCBbXSkuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgIGl0ZW0uY29ubmVjdGVkSXRlbXNbdGhpcy50YWJsZS50YWJsZUlkXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSB7fTtcbiAgfVxuICAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW3RhYmxlSWRzWzBdXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRoaXNUYWJsZUlkID0gdGFibGVJZHNbMF07XG4gICAgICBjb25zdCByZW1haW5pbmdUYWJsZUlkcyA9IHRhYmxlSWRzLnNsaWNlKDEpO1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuY29ubmVjdGVkSXRlbXNbdGhpc1RhYmxlSWRdIHx8IFtdKSB7XG4gICAgICAgIHlpZWxkICogaXRlbS5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzICh7IGxpbWl0ID0gSW5maW5pdHksIGVkZ2VJZHMgPSB0aGlzLmNsYXNzT2JqLmVkZ2VDbGFzc0lkcyB9ID0ge30pIHtcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyhlZGdlSWRzKSkge1xuICAgICAgY29uc3QgdGFibGVJZENoYWluID0gYXdhaXQgdGhpcy5jbGFzc09iai5wcmVwU2hvcnRlc3RFZGdlUGF0aChlZGdlQ2xhc3NJZCk7XG4gICAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRDaGFpbik7XG4gICAgICBsZXQgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIHdoaWxlICghdGVtcC5kb25lICYmIGkgPCBsaW1pdCkge1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgICBpKys7XG4gICAgICAgIHRlbXAgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgICB9XG4gICAgICBpZiAoaSA+PSBsaW1pdCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBzb3VyY2VOb2RlcyAoeyBsaW1pdCA9IEluZmluaXR5IH0gPSB7fSkge1xuICAgIGNvbnN0IHRhYmxlSWRDaGFpbiA9IGF3YWl0IHRoaXMuY2xhc3NPYmoucHJlcFNob3J0ZXN0U291cmNlUGF0aCgpO1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZENoYWluKTtcbiAgICBsZXQgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICBsZXQgaSA9IDA7XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUgJiYgaSA8IGxpbWl0KSB7XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgaSsrO1xuICAgICAgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAoeyBsaW1pdCA9IEluZmluaXR5IH0gPSB7fSkge1xuICAgIGNvbnN0IHRhYmxlSWRDaGFpbiA9IGF3YWl0IHRoaXMuY2xhc3NPYmoucHJlcFNob3J0ZXN0VGFyZ2V0UGF0aCgpO1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZENoYWluKTtcbiAgICBsZXQgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICBsZXQgaSA9IDA7XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUgJiYgaSA8IGxpbWl0KSB7XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgaSsrO1xuICAgICAgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJjbGFzcyBJbk1lbW9yeUluZGV4IHtcbiAgY29uc3RydWN0b3IgKHsgZW50cmllcyA9IHt9LCBjb21wbGV0ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXM7XG4gICAgdGhpcy5jb21wbGV0ZSA9IGNvbXBsZXRlO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzO1xuICB9XG4gIGFzeW5jICogaXRlckVudHJpZXMgKCkge1xuICAgIGZvciAoY29uc3QgW2hhc2gsIHZhbHVlTGlzdF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgeyBoYXNoLCB2YWx1ZUxpc3QgfTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVySGFzaGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IGhhc2ggb2YgT2JqZWN0LmtleXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgaGFzaDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyVmFsdWVMaXN0cyAoKSB7XG4gICAgZm9yIChjb25zdCB2YWx1ZUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB2YWx1ZUxpc3Q7XG4gICAgfVxuICB9XG4gIGFzeW5jIGdldFZhbHVlTGlzdCAoaGFzaCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXNbaGFzaF0gfHwgW107XG4gIH1cbiAgYXN5bmMgYWRkVmFsdWUgKGhhc2gsIHZhbHVlKSB7XG4gICAgLy8gVE9ETzogYWRkIHNvbWUga2luZCBvZiB3YXJuaW5nIGlmIHRoaXMgaXMgZ2V0dGluZyBiaWc/XG4gICAgdGhpcy5lbnRyaWVzW2hhc2hdID0gYXdhaXQgdGhpcy5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgaWYgKHRoaXMuZW50cmllc1toYXNoXS5pbmRleE9mKHZhbHVlKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuZW50cmllc1toYXNoXS5wdXNoKHZhbHVlKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluTWVtb3J5SW5kZXg7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IHNoYTEgZnJvbSAnc2hhMSc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuL1RhYmxlcy9UYWJsZXMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcbmltcG9ydCAqIGFzIElOREVYRVMgZnJvbSAnLi9JbmRleGVzL0luZGV4ZXMuanMnO1xuXG5sZXQgTkVYVF9DTEFTU19JRCA9IDE7XG5sZXQgTkVYVF9UQUJMRV9JRCA9IDE7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBtdXJlLmRlYnVnIHRvIHRydWUgdG8gZGVidWcgc3RyZWFtc1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UQUJMRVMgPSBUQUJMRVM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHsgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbTsgfSxcbiAgICAgIGtleTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKCF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICAhd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR3JhbmRwYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIHlpZWxkIHtcbiAgICAgICAgICBsZWZ0OiB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICByaWdodDogb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgICAgIG5vb3A6ICgpID0+IHt9XG4gICAgfTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMudGFibGVzID0gdGhpcy5oeWRyYXRlKCdtdXJlX3RhYmxlcycsIHRoaXMuVEFCTEVTKTtcbiAgICBORVhUX1RBQkxFX0lEID0gT2JqZWN0LmtleXModGhpcy50YWJsZXMpXG4gICAgICAucmVkdWNlKChoaWdoZXN0TnVtLCB0YWJsZUlkKSA9PiB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heChoaWdoZXN0TnVtLCBwYXJzZUludCh0YWJsZUlkLm1hdGNoKC90YWJsZShcXGQqKS8pWzFdKSk7XG4gICAgICB9LCAwKSArIDE7XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBvdXIgY2xhc3Mgc3BlY2lmaWNhdGlvbnNcbiAgICB0aGlzLmNsYXNzZXMgPSB0aGlzLmh5ZHJhdGUoJ211cmVfY2xhc3NlcycsIHRoaXMuQ0xBU1NFUyk7XG4gICAgTkVYVF9DTEFTU19JRCA9IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NlcylcbiAgICAgIC5yZWR1Y2UoKGhpZ2hlc3ROdW0sIGNsYXNzSWQpID0+IHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KGhpZ2hlc3ROdW0sIHBhcnNlSW50KGNsYXNzSWQubWF0Y2goL2NsYXNzKFxcZCopLylbMV0pKTtcbiAgICAgIH0sIDApICsgMTtcbiAgfVxuXG4gIHNhdmVUYWJsZXMgKCkge1xuICAgIHRoaXMuZGVoeWRyYXRlKCdtdXJlX3RhYmxlcycsIHRoaXMudGFibGVzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3RhYmxlVXBkYXRlJyk7XG4gIH1cbiAgc2F2ZUNsYXNzZXMgKCkge1xuICAgIHRoaXMuZGVoeWRyYXRlKCdtdXJlX2NsYXNzZXMnLCB0aGlzLmNsYXNzZXMpO1xuICAgIHRoaXMudHJpZ2dlcignY2xhc3NVcGRhdGUnKTtcbiAgfVxuXG4gIGh5ZHJhdGUgKHN0b3JhZ2VLZXksIFRZUEVTKSB7XG4gICAgbGV0IGNvbnRhaW5lciA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oc3RvcmFnZUtleSk7XG4gICAgY29udGFpbmVyID0gY29udGFpbmVyID8gSlNPTi5wYXJzZShjb250YWluZXIpIDoge307XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgY29uc3QgdHlwZSA9IHZhbHVlLnR5cGU7XG4gICAgICBkZWxldGUgdmFsdWUudHlwZTtcbiAgICAgIHZhbHVlLm11cmUgPSB0aGlzO1xuICAgICAgY29udGFpbmVyW2tleV0gPSBuZXcgVFlQRVNbdHlwZV0odmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gY29udGFpbmVyO1xuICB9XG4gIGRlaHlkcmF0ZSAoc3RvcmFnZUtleSwgY29udGFpbmVyKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvbnRhaW5lcikpIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgICAgcmVzdWx0W2tleV0udHlwZSA9IHZhbHVlLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKHN0b3JhZ2VLZXksIEpTT04uc3RyaW5naWZ5KHJlc3VsdCkpO1xuICAgIH1cbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIG5ldyBGdW5jdGlvbihgcmV0dXJuICR7c3RyaW5naWZpZWRGdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgfVxuICBkZWh5ZHJhdGVGdW5jdGlvbiAoZnVuYykge1xuICAgIGxldCBzdHJpbmdpZmllZEZ1bmMgPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgLy8gSXN0YW5idWwgYWRkcyBzb21lIGNvZGUgdG8gZnVuY3Rpb25zIGZvciBjb21wdXRpbmcgY292ZXJhZ2UsIHRoYXQgZ2V0c1xuICAgIC8vIGluY2x1ZGVkIGluIHRoZSBzdHJpbmdpZmljYXRpb24gcHJvY2VzcyBkdXJpbmcgdGVzdGluZy4gU2VlOlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3R3YXJsb3N0L2lzdGFuYnVsL2lzc3Vlcy8zMTAjaXNzdWVjb21tZW50LTI3NDg4OTAyMlxuICAgIHN0cmluZ2lmaWVkRnVuYyA9IHN0cmluZ2lmaWVkRnVuYy5yZXBsYWNlKC9jb3ZfKC4rPylcXCtcXCtbLDtdPy9nLCAnJyk7XG4gICAgcmV0dXJuIHN0cmluZ2lmaWVkRnVuYztcbiAgfVxuXG4gIGNyZWF0ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zLnRhYmxlSWQpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7TkVYVF9UQUJMRV9JRH1gO1xuICAgICAgTkVYVF9UQUJMRV9JRCArPSAxO1xuICAgIH1cbiAgICBjb25zdCBUeXBlID0gdGhpcy5UQUJMRVNbb3B0aW9ucy50eXBlXTtcbiAgICBkZWxldGUgb3B0aW9ucy50eXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdO1xuICB9XG4gIGNyZWF0ZUNsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYGVtcHR5YCB9KSB7XG4gICAgaWYgKCFvcHRpb25zLmNsYXNzSWQpIHtcbiAgICAgIG9wdGlvbnMuY2xhc3NJZCA9IGBjbGFzcyR7TkVYVF9DTEFTU19JRH1gO1xuICAgICAgTkVYVF9DTEFTU19JRCArPSAxO1xuICAgIH1cbiAgICBjb25zdCBUeXBlID0gdGhpcy5DTEFTU0VTW29wdGlvbnMudHlwZV07XG4gICAgZGVsZXRlIG9wdGlvbnMudHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdID0gbmV3IFR5cGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG5cbiAgbmV3VGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZU9iaiA9IHRoaXMuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5zYXZlVGFibGVzKCk7XG4gICAgcmV0dXJuIG5ld1RhYmxlT2JqO1xuICB9XG4gIG5ld0NsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3Q2xhc3NPYmogPSB0aGlzLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gbmV3Q2xhc3NPYmo7XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNUYWJsZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHk7IHRyeSBhZGREeW5hbWljVGFibGUoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY1RhYmxlKHtcbiAgICAgIG5hbWU6IGZpbGVPYmoubmFtZSxcbiAgICAgIGV4dGVuc2lvbjogZXh0ZW5zaW9uT3ZlcnJpZGUgfHwgbWltZS5leHRlbnNpb24oZmlsZU9iai50eXBlKSxcbiAgICAgIHRleHRcbiAgICB9KTtcbiAgfVxuICBhZGRTdHJpbmdBc1N0YXRpY1RhYmxlICh7IG5hbWUsIGV4dGVuc2lvbiA9ICd0eHQnLCB0ZXh0IH0pIHtcbiAgICBsZXQgZGF0YSwgYXR0cmlidXRlcztcbiAgICBpZiAodGhpcy5EQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgZGF0YSA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZSh7IG5hbWUsIGRhdGEsIGF0dHJpYnV0ZXMgfSk7XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLm5ld1RhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHsgdGhpcy50YWJsZXNbdGFibGVJZF0uZGVsZXRlKCk7IH0gY2F0Y2ggKGVycikge31cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZGVsZXRlQWxsQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzT2JqLmRlbGV0ZSgpO1xuICAgIH1cbiAgfVxuICBnZXRDbGFzc0RhdGEgKCkge1xuICAgIGNvbnN0IHJlc3VsdHMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgcmVzdWx0c1tjbGFzc09iai5jbGFzc0lkXSA9IGNsYXNzT2JqLmN1cnJlbnREYXRhO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG11cmUgPSBuZXcgTXVyZSh3aW5kb3cuRmlsZVJlYWRlciwgd2luZG93LmxvY2FsU3RvcmFnZSk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJvZmYiLCJpbmRleCIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiZm9yRWFjaCIsInNldFRpbWVvdXQiLCJhcHBseSIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsIk9iamVjdCIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiVGFibGUiLCJvcHRpb25zIiwiX211cmUiLCJtdXJlIiwidGFibGVJZCIsIkVycm9yIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleFN1YkZpbHRlciIsImluZGV4U3ViRmlsdGVyIiwiX2F0dHJpYnV0ZVN1YkZpbHRlcnMiLCJhdHRyaWJ1dGVTdWJGaWx0ZXJzIiwiX3RvUmF3T2JqZWN0IiwicmVzdWx0IiwiX2F0dHJpYnV0ZXMiLCJ1c2VkQnlDbGFzc2VzIiwiX3VzZWRCeUNsYXNzZXMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsImZ1bmMiLCJuYW1lIiwiaXRlcmF0ZSIsInJlc2V0IiwiX2NhY2hlIiwibGltaXQiLCJ1bmRlZmluZWQiLCJJbmZpbml0eSIsInZhbHVlcyIsInNsaWNlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlIiwiZGVyaXZlZFRhYmxlIiwiYnVpbGRDYWNoZSIsIl9jYWNoZVByb21pc2UiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNvdW50Um93cyIsImtleXMiLCJsZW5ndGgiLCJpdGVyYXRvciIsIl9pdGVyYXRlIiwiY29tcGxldGVkIiwibmV4dCIsImRvbmUiLCJfZmluaXNoSXRlbSIsIndyYXBwZWRJdGVtIiwicm93Iiwia2VlcCIsImRpc2Nvbm5lY3QiLCJfd3JhcCIsInRhYmxlIiwiY2xhc3NPYmoiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwib3RoZXJJdGVtIiwiaXRlbXNUb0Nvbm5lY3QiLCJjb25uZWN0SXRlbSIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImNvbXBsZXRlIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRTdWJGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwic2F2ZVRhYmxlcyIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZUlkIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJ0YWJsZXMiLCJzaG9ydGVzdFBhdGhUb1RhYmxlIiwib3RoZXJUYWJsZSIsInZpc2l0ZWQiLCJkaXN0YW5jZXMiLCJwcmV2VGFibGVzIiwidmlzaXQiLCJ0YXJnZXRJZCIsInRhcmdldFRhYmxlIiwibmVpZ2hib3JMaXN0IiwiY29uY2F0IiwicGFyZW50VGFibGVzIiwibWFwIiwicGFyZW50VGFibGUiLCJmaWx0ZXIiLCJuZWlnaGJvcklkIiwidG9WaXNpdCIsInNvcnQiLCJhIiwiYiIsIm5leHRJZCIsInNoaWZ0IiwiY2hhaW4iLCJ1bnNoaWZ0IiwiYWdncmVnYXRlIiwiZXhwYW5kIiwiZGVsaW1pdGVyIiwiY2xvc2VkRmFjZXQiLCJvcGVuRmFjZXQiLCJjbG9zZWRUcmFuc3Bvc2UiLCJpbmRleGVzIiwib3BlblRyYW5zcG9zZSIsImNvbm5lY3QiLCJvdGhlclRhYmxlTGlzdCIsImNsYXNzZXMiLCJyZWR1Y2UiLCJhZ2ciLCJkZWxldGUiLCJleGVjIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiaXRlbSIsIlN0YXRpY0RpY3RUYWJsZSIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIkFnZ3JlZ2F0ZWRUYWJsZSIsIl9hdHRyaWJ1dGUiLCJfcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIiwicmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIiwiX2RlaHlkcmF0ZUZ1bmN0aW9uIiwiZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSIsIl91cGRhdGVJdGVtIiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsIm5ld1dyYXBwZWRJdGVtIiwid3JhcHBlZFBhcmVudCIsImV4aXN0aW5nSXRlbSIsIm5ld0l0ZW0iLCJyZWR1Y2VkIiwiRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIiwiX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfZHVwbGljYXRlZEF0dHJpYnV0ZXMiLCJkdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZUF0dHJpYnV0ZSIsInBhcmVudElkIiwiX2R1cGxpY2F0ZUF0dHJpYnV0ZXMiLCJwYXJlbnROYW1lIiwiY29ubmVjdGVkSXRlbXMiLCJhdHRyTmFtZSIsImNvcGllZCIsIkV4cGFuZGVkVGFibGUiLCJzcGxpdCIsIkZhY2V0ZWRUYWJsZSIsIl92YWx1ZSIsIlRyYW5zcG9zZWRUYWJsZSIsIl9pbmRleCIsIkNvbm5lY3RlZFRhYmxlIiwiam9pbiIsImJhc2VQYXJlbnRUYWJsZSIsIm90aGVyUGFyZW50VGFibGVzIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9jbGFzc05hbWUiLCJjbGFzc05hbWUiLCJhbm5vdGF0aW9uIiwic2V0Q2xhc3NOYW1lIiwic2F2ZUNsYXNzZXMiLCJoYXNDdXN0b21OYW1lIiwiZ2V0SGFzaFRhYmxlIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm5ld0NsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIl9kZXJpdmVHZW5lcmljQ2xhc3MiLCJOb2RlQ2xhc3MiLCJlZGdlQ2xhc3NJZHMiLCJfY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHMiLCJOb2RlV3JhcHBlciIsInByZXBTaG9ydGVzdEVkZ2VQYXRoIiwiZWRnZUNsYXNzSWQiLCJlZGdlVGFibGUiLCJpZExpc3QiLCJkaXNjb25uZWN0QWxsRWRnZXMiLCJlZGdlQ2xhc3MiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsImRpcmVjdGVkIiwic291cmNlRWRnZUNsYXNzIiwidGFyZ2V0RWRnZUNsYXNzIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJuZXdFZGdlQ2xhc3MiLCJjcmVhdGVDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5vZGVDbGFzcyIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0IiwiRWRnZUNsYXNzIiwiRWRnZVdyYXBwZXIiLCJfcGlja0VkZ2VUYWJsZSIsIm90aGVyQ2xhc3MiLCJzdGF0aWNFeGlzdHMiLCJkaXN0Iiwic3RhcnRzV2l0aCIsInByZXBTaG9ydGVzdFNvdXJjZVBhdGgiLCJfY2FjaGVkU2hvcnRlc3RTb3VyY2VQYXRoIiwic291cmNlVGFibGUiLCJwcmVwU2hvcnRlc3RUYXJnZXRQYXRoIiwiX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aCIsIm5ld05vZGVDbGFzcyIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJkaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImNvbm5lY3RUYXJnZXQiLCJjb25uZWN0U291cmNlIiwidG9nZ2xlTm9kZURpcmVjdGlvbiIsInNraXBTYXZlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwiaXRlbUxpc3QiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsInRoaXNUYWJsZUlkIiwicmVtYWluaW5nVGFibGVJZHMiLCJlZGdlcyIsImVkZ2VJZHMiLCJ0YWJsZUlkQ2hhaW4iLCJzb3VyY2VOb2RlcyIsInRhcmdldE5vZGVzIiwiSW5NZW1vcnlJbmRleCIsInRvUmF3T2JqZWN0IiwiaXRlckVudHJpZXMiLCJoYXNoIiwidmFsdWVMaXN0IiwiaXRlckhhc2hlcyIsIml0ZXJWYWx1ZUxpc3RzIiwiZ2V0VmFsdWVMaXN0IiwiYWRkVmFsdWUiLCJORVhUX0NMQVNTX0lEIiwiTkVYVF9UQUJMRV9JRCIsIk11cmUiLCJGaWxlUmVhZGVyIiwibG9jYWxTdG9yYWdlIiwibWltZSIsImRlYnVnIiwiREFUQUxJQl9GT1JNQVRTIiwiVEFCTEVTIiwiQ0xBU1NFUyIsIklOREVYRVMiLCJOQU1FRF9GVU5DVElPTlMiLCJpZGVudGl0eSIsInJhd0l0ZW0iLCJrZXkiLCJUeXBlRXJyb3IiLCJwYXJlbnRUeXBlIiwiZGVmYXVsdEZpbmlzaCIsInRoaXNXcmFwcGVkSXRlbSIsIm90aGVyV3JhcHBlZEl0ZW0iLCJsZWZ0IiwicmlnaHQiLCJzaGExIiwiSlNPTiIsInN0cmluZ2lmeSIsIm5vb3AiLCJoeWRyYXRlIiwiaGlnaGVzdE51bSIsIk1hdGgiLCJtYXgiLCJwYXJzZUludCIsIm1hdGNoIiwiZGVoeWRyYXRlIiwic3RvcmFnZUtleSIsIlRZUEVTIiwiY29udGFpbmVyIiwiZ2V0SXRlbSIsInBhcnNlIiwic2V0SXRlbSIsIkZ1bmN0aW9uIiwidG9TdHJpbmciLCJUeXBlIiwic2VsZWN0b3IiLCJuZXdUYWJsZU9iaiIsIm5ld0NsYXNzT2JqIiwiYWRkRmlsZUFzU3RhdGljVGFibGUiLCJmaWxlT2JqIiwiZW5jb2RpbmciLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsImNvbnNvbGUiLCJ3YXJuIiwidGV4dCIsInJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJhZGRTdHJpbmdBc1N0YXRpY1RhYmxlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJBcnJheSIsImRlbGV0ZUFsbFVudXNlZFRhYmxlcyIsImVyciIsImRlbGV0ZUFsbENsYXNzZXMiLCJnZXRDbGFzc0RhdGEiLCJyZXN1bHRzIiwid2luZG93IiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QkMsdUJBQXZCLEVBQWdEO1VBQzVDLENBQUMsS0FBS0wsYUFBTCxDQUFtQkcsU0FBbkIsQ0FBTCxFQUFvQzthQUM3QkgsYUFBTCxDQUFtQkcsU0FBbkIsSUFBZ0MsRUFBaEM7OztVQUVFLENBQUNFLHVCQUFMLEVBQThCO1lBQ3hCLEtBQUtMLGFBQUwsQ0FBbUJHLFNBQW5CLEVBQThCRyxPQUE5QixDQUFzQ0YsUUFBdEMsTUFBb0QsQ0FBQyxDQUF6RCxFQUE0RDs7Ozs7V0FJekRKLGFBQUwsQ0FBbUJHLFNBQW5CLEVBQThCSSxJQUE5QixDQUFtQ0gsUUFBbkM7OztJQUVGSSxHQUFHLENBQUVMLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNwQixLQUFLSixhQUFMLENBQW1CRyxTQUFuQixDQUFKLEVBQW1DO1lBQzdCLENBQUNDLFFBQUwsRUFBZTtpQkFDTixLQUFLSixhQUFMLENBQW1CRyxTQUFuQixDQUFQO1NBREYsTUFFTztjQUNETSxLQUFLLEdBQUcsS0FBS1QsYUFBTCxDQUFtQkcsU0FBbkIsRUFBOEJHLE9BQTlCLENBQXNDRixRQUF0QyxDQUFaOztjQUNJSyxLQUFLLElBQUksQ0FBYixFQUFnQjtpQkFDVFQs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
