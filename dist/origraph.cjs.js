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
    this._origraph = options.origraph;
    this.tableId = options.tableId;

    if (!this._origraph || !this.tableId) {
      throw new Error(`origraph and tableId are required`);
    }

    this._expectedAttributes = options.attributes || {};
    this._observedAttributes = {};
    this._derivedTables = options.derivedTables || {};
    this._derivedAttributeFunctions = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions || {})) {
      this._derivedAttributeFunctions[attr] = this._origraph.hydrateFunction(stringifiedFunc);
    }

    this._suppressedAttributes = options.suppressedAttributes || {};
    this._suppressIndex = !!options.suppressIndex;
    this._indexSubFilter = options.indexSubFilter && this._origraph.hydrateFunction(options.indexSubFilter) || null;
    this._attributeSubFilters = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.attributeSubFilters || {})) {
      this._attributeSubFilters[attr] = this._origraph.hydrateFunction(stringifiedFunc);
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
      indexSubFilter: this._indexSubFilter && this._origraph.dehydrateFunction(this._indexSubFilter) || null
    };

    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this._origraph.dehydrateFunction(func);
    }

    for (const [attr, func] of Object.entries(this._attributeSubFilters)) {
      result.attributeSubFilters[attr] = this._origraph.dehydrateFunction(func);
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
    const wrappedItem = classObj ? classObj._wrap(options) : new this._origraph.WRAPPERS.GenericWrapper(options);

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
    const newTable = this._origraph.createTable(options);

    this._derivedTables[newTable.tableId] = true;

    this._origraph.saveTables();

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
    return existingTableId && this._origraph.tables[existingTableId] || null;
  }

  shortestPathToTable(otherTable) {
    // Dijkstra's algorithm...
    const visited = {};
    const distances = {};
    const prevTables = {};

    const visit = targetId => {
      const targetTable = this._origraph.tables[targetId]; // Only check the unvisited derived and parent tables

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
          chain.unshift(this._origraph.tables[nextId]);
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
    const newTable = this._origraph.createTable({
      type: 'ConnectedTable'
    });

    this._derivedTables[newTable.tableId] = true;

    for (const otherTable of otherTableList) {
      otherTable._derivedTables[newTable.tableId] = true;
    }

    this._origraph.saveTables();

    return newTable;
  }

  get classObj() {
    return Object.values(this._origraph.classes).find(classObj => {
      return classObj.table === this;
    });
  }

  get parentTables() {
    return Object.values(this._origraph.tables).reduce((agg, tableObj) => {
      if (tableObj._derivedTables[this.tableId]) {
        agg.push(tableObj);
      }

      return agg;
    }, []);
  }

  get derivedTables() {
    return Object.keys(this._derivedTables).map(tableId => {
      return this._origraph.tables[tableId];
    });
  }

  get inUse() {
    if (Object.keys(this._derivedTables).length > 0) {
      return true;
    }

    return Object.values(this._origraph.classes).some(classObj => {
      return classObj.tableId === this.tableId || classObj.sourceTableIds.indexOf(this.tableId) !== -1 || classObj.targetTableIds.indexOf(this.tableId) !== -1;
    });
  }

  delete() {
    if (this.inUse) {
      throw new Error(`Can't delete in-use table ${this.tableId}`);
    }

    for (const parentTable of this.parentTables) {
      delete parentTable.derivedTables[this.tableId];
    }

    delete this._origraph.tables[this.tableId];

    this._origraph.saveTables();
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
      this._reduceAttributeFunctions[attr] = this._origraph.hydrateFunction(stringifiedFunc);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.reduceAttributeFunctions = {};

    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      obj.reduceAttributeFunctions[attr] = this._origraph._dehydrateFunction(func);
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
      const index = String(wrappedParent.row[this._attribute]);

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
        const parentName = this._origraph.tables[parentId].name;
        wrappedItem.row[`${parentName}.${attr}`] = wrappedItem.connectedItems[parentId][0].row[attr];
      }
    }

    getAttributeDetails() {
      const allAttrs = super.getAttributeDetails();

      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const attrName = `${this._origraph.tables[parentId].name}.${attr}`;
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
    this._origraph = options.origraph;
    this.classId = options.classId;
    this.tableId = options.tableId;

    if (!this._origraph || !this.classId || !this.tableId) {
      throw new Error(`_origraph, classId, and tableId are required`);
    }

    this._className = options.className || null;
    this.annotations = options.annotations || {};
  }

  _toRawObject() {
    return {
      classId: this.classId,
      tableId: this.tableId,
      className: this._className,
      annotations: this.annotations
    };
  }

  setClassName(value) {
    this._className = value;

    this._origraph.saveClasses();
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
    return this._origraph.tables[this.tableId];
  }

  _wrap(options) {
    options.classObj = this;
    return new this._origraph.WRAPPERS.GenericWrapper(options);
  }

  interpretAsNodes() {
    const options = this._toRawObject();

    options.type = 'NodeClass';
    this.table.reset();
    return this._origraph.newClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    this.table.reset();
    return this._origraph.newClass(options);
  }

  _deriveGenericClass(newTable) {
    return this._origraph.newClass({
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
    delete this._origraph.classes[this.classId];

    this._origraph.saveClasses();
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
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.edgeClassIds = this.edgeClassIds;
    return result;
  }

  _wrap(options) {
    options.classObj = this;
    return new this._origraph.WRAPPERS.NodeWrapper(options);
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
      const edgeClass = this._origraph.classes[edgeClassIds[0]]; // Are we the source or target of the existing edge (internally, in terms
      // of sourceId / targetId, not edgeClass.direction)?

      const isSource = edgeClass.sourceClassId === this.classId; // As we're converted to an edge, our new resulting source AND target
      // should be whatever is at the other end of edgeClass (if anything)

      if (isSource) {
        options.sourceClassId = options.targetClassId = edgeClass.targetClassId;
      } else {
        options.sourceClassId = options.targetClassId = edgeClass.sourceClassId;
      } // tableId lists should emanate out from the (new) edge table; assuming
      // (for a moment) that isSource === true, we'd construct the tableId list
      // like this:


      let tableIdList = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]).concat(edgeClass.sourceTableIds);

      if (!isSource) {
        // Whoops, got it backwards!
        tableIdList.reverse();
      }

      options.directed = edgeClass.directed;
      options.sourceTableIds = options.targetTableIds = tableIdList; // TODO: instead of deleting the existing edge class, should we leave it
      // hanging + unconnected?

      edgeClass.delete();
    } else if (edgeClassIds.length === 2) {
      // Okay, we've got two edges, so this is a little more straightforward
      let sourceEdgeClass = this._origraph.classes[edgeClassIds[0]];
      let targetEdgeClass = this._origraph.classes[edgeClassIds[1]]; // Figure out the direction, if there is one

      options.directed = false;

      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        if (sourceEdgeClass.targetClassId === this.classId && targetEdgeClass.sourceClassId === this.classId) {
          // We happened to get the edges in order; set directed to true
          options.directed = true;
        } else if (sourceEdgeClass.sourceClassId === this.classId && targetEdgeClass.targetClassId === this.classId) {
          // We got the edges backwards; swap them and set directed to true
          targetEdgeClass = this._origraph.classes[edgeClassIds[0]];
          sourceEdgeClass = this._origraph.classes[edgeClassIds[1]];
          options.directed = true;
        }
      } // Okay, now we know how to set source / target ids


      options.sourceClassId = sourceEdgeClass.classId;
      options.targetClassId = targetEdgeClass.classId; // Concatenate the intermediate tableId lists, emanating out from the
      // (new) edge table

      options.sourceTableIds = sourceEdgeClass.targetTableIds.slice().reverse().concat([sourceEdgeClass.tableId]).concat(sourceEdgeClass.sourceTableIds);

      if (sourceEdgeClass.targetClassId === this.classId) {
        options.sourceTableIds.reverse();
      }

      options.targetTableIds = targetEdgeClass.targetTableIds.slice().reverse().concat([targetEdgeClass.tableId]).concat(targetEdgeClass.sourceTableIds);

      if (targetEdgeClass.targetClassId === this.classId) {
        options.targetTableIds.reverse();
      } // Delete each of the edge classes


      sourceEdgeClass.delete();
      targetEdgeClass.delete();
    }

    this.delete();
    delete options.classId;
    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    this.table.reset();
    return this._origraph.newClass(options);
  }

  connectToNodeClass({
    otherNodeClass,
    attribute,
    otherAttribute
  }) {
    const thisHash = this.getHashTable(attribute);
    const otherHash = otherNodeClass.getHashTable(otherAttribute);
    const connectedTable = thisHash.connect([otherHash]);

    const newEdgeClass = this._origraph.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceTableIds: [thisHash.tableId],
      targetClassId: otherNodeClass.classId,
      targetTableIds: [otherHash.tableId]
    });

    this.edgeClassIds[newEdgeClass.classId] = true;
    otherNodeClass.edgeClassIds[newEdgeClass.classId] = true;

    this._origraph.saveClasses();

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
      const edgeClass = this._origraph.classes[edgeClassId];

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
    super(options); // sourceTableIds and targetTableIds are lists of any intermediate tables,
    // beginning with the edge table (but not including it), that lead to the
    // source / target node tables (but not including) those

    this.sourceClassId = options.sourceClassId || null;
    this.sourceTableIds = options.sourceTableIds || [];
    this.targetClassId = options.targetClassId || null;
    this.targetTableIds = options.targetTableIds || [];
    this.directed = options.directed || false;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.sourceTableIds = this.sourceTableIds;
    result.targetClassId = this.targetClassId;
    result.targetTableIds = this.targetTableIds;
    result.directed = this.directed;
    return result;
  }

  _wrap(options) {
    options.classObj = this;
    return new this._origraph.WRAPPERS.EdgeWrapper(options);
  }

  _splitTableIdList(tableIdList, otherClass) {
    let result = {
      nodeTableIdList: [],
      edgeTableId: null,
      edgeTableIdList: []
    };

    if (tableIdList.length === 0) {
      // Weird corner case where we're trying to create an edge between
      // adjacent or identical tables... create a ConnectedTable
      result.edgeTableId = this.table.connect(otherClass.table).tableId;
      return result;
    } else {
      // Use a table in the middle as the new edge table; prioritize
      // StaticTable and StaticDictTable
      let staticExists = false;
      let tableDistances = tableIdList.map((tableId, index) => {
        staticExists = staticExists || this._origraph.tables[tableId].type.startsWith('Static');
        return {
          tableId,
          index,
          dist: Math.abs(tableIdList / 2 - index)
        };
      });

      if (staticExists) {
        tableDistances = tableDistances.filter(({
          tableId
        }) => {
          return this._origraph.tables[tableId].type.startsWith('Static');
        });
      }

      const {
        tableId,
        index
      } = tableDistances.sort((a, b) => a.dist - b.dist)[0];
      result.edgeTableId = tableId;
      result.edgeTableIdList = tableIdList.slice(0, index).reverse();
      result.nodeTableIdList = tableIdList.slice(index + 1);
    }

    return result;
  }

  interpretAsNodes() {
    const temp = this._toRawObject();

    this.delete();
    temp.type = 'NodeClass';
    delete temp.classId;

    const newNodeClass = this._origraph.createClass(temp);

    if (temp.sourceClassId) {
      const sourceClass = this._origraph.classes[temp.sourceClassId];

      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.sourceTableIds, sourceClass);

      const sourceEdgeClass = this._origraph.createClass({
        type: 'EdgeClass',
        tableId: edgeTableId,
        directed: temp.directed,
        sourceClassId: temp.sourceClassId,
        sourceTableIds: nodeTableIdList,
        targetClassId: newNodeClass.classId,
        targetTableIds: edgeTableIdList
      });

      sourceClass.edgeClassIds[sourceEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[sourceEdgeClass.classId] = true;
    }

    if (temp.targetClassId && temp.sourceClassId !== temp.targetClassId) {
      const targetClass = this._origraph.classes[temp.targetClassId];

      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.targetTableIds, targetClass);

      const targetEdgeClass = this._origraph.createClass({
        type: 'EdgeClass',
        tableId: edgeTableId,
        directed: temp.directed,
        sourceClassId: newNodeClass.classId,
        sourceTableIds: edgeTableIdList,
        targetClassId: temp.targetClassId,
        targetTableIds: nodeTableIdList
      });

      targetClass.edgeClassIds[targetEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[targetEdgeClass.classId] = true;
    }

    this.table.reset();

    this._origraph.saveClasses();

    return newNodeClass;
  }

  interpretAsEdges() {
    return this;
  }

  connectToNodeClass({
    nodeClass,
    side,
    nodeAttribute,
    edgeAttribute
  }) {
    if (side === 'source') {
      this.connectSource({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    } else if (side === 'target') {
      this.connectTarget({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    } else {
      throw new Error(`PoliticalOutsiderError: "${side}" is an invalid side`);
    }

    this._origraph.saveClasses();
  }

  toggleDirection(directed) {
    if (directed === false || this.swappedDirection === true) {
      this.directed = false;
      delete this.swappedDirection;
    } else if (!this.directed) {
      this.directed = true;
      this.swappedDirection = false;
    } else {
      // Directed was already true, just switch source and target
      let temp = this.sourceClassId;
      this.sourceClassId = this.targetClassId;
      this.targetClassId = temp;
      temp = this.sourceTableIds;
      this.sourceTableIds = this.targetTableIds;
      this.targetTableIds = temp;
      this.swappedDirection = true;
    }

    this._origraph.saveClasses();
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
    const sourceClass = this._origraph.classes[this.sourceClassId];
    sourceClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.getHashTable(nodeAttribute);
    this.sourceTableIds = [edgeHash.connect([nodeHash]).tableId];

    if (edgeAttribute !== null) {
      this.sourceTableIds.unshift(edgeHash.tableId);
    }

    if (nodeAttribute !== null) {
      this.sourceTableIds.push(nodeHash.tableId);
    }

    if (!skipSave) {
      this._origraph.saveClasses();
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
    const targetClass = this._origraph.classes[this.targetClassId];
    targetClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.getHashTable(nodeAttribute);
    this.targetTableIds = [edgeHash.connect([nodeHash]).tableId];

    if (edgeAttribute !== null) {
      this.targetTableIds.unshift(edgeHash.tableId);
    }

    if (nodeAttribute !== null) {
      this.targetTableIds.push(nodeHash.tableId);
    }

    if (!skipSave) {
      this._origraph.saveClasses();
    }
  }

  disconnectSource({
    skipSave = false
  } = {}) {
    const existingSourceClass = this._origraph.classes[this.sourceClassId];

    if (existingSourceClass) {
      delete existingSourceClass.edgeClassIds[this.classId];
    }

    this.sourceTableIds = [];
    this.sourceClassId = null;

    if (!skipSave) {
      this._origraph.saveClasses();
    }
  }

  disconnectTarget({
    skipSave = false
  } = {}) {
    const existingTargetClass = this._origraph.classes[this.targetClassId];

    if (existingTargetClass) {
      delete existingTargetClass.edgeClassIds[this.classId];
    }

    this.targetTableIds = [];
    this.targetClassId = null;

    if (!skipSave) {
      this._origraph.saveClasses();
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

  async *iterateAcrossConnections({
    tableIds,
    limit = Infinity
  }) {
    // First make sure that all the table caches have been fully built and
    // connected
    await Promise.all(tableIds.map(tableId => {
      return this.classObj._origraph.tables[tableId].buildCache();
    }));
    let i = 0;

    for (const item of this._iterateAcrossConnections(tableIds)) {
      yield item;
      i++;

      if (i >= limit) {
        return;
      }
    }
  }

  *_iterateAcrossConnections(tableIds) {
    if (tableIds.length === 1) {
      yield* this.connectedItems[tableIds[0]] || [];
    } else {
      const thisTableId = tableIds[0];
      const remainingTableIds = tableIds.slice(1);

      for (const item of this.connectedItems[thisTableId] || []) {
        yield* item._iterateAcrossConnections(remainingTableIds);
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

  async *edges(options = {
    limit: Infinity
  }) {
    const edgeIds = options.edgeIds || this.classObj.edgeClassIds;
    let i = 0;

    for (const edgeId of Object.keys(edgeIds)) {
      const edgeClass = this.classObj._origraph.classes[edgeId];

      if (edgeClass.sourceClassId === this.classObj.classId) {
        options.tableIds = edgeClass.sourceTableIds.slice().reverse().concat([edgeClass.tableId]);
      } else {
        options.tableIds = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]);
      }

      for await (const item of this.iterateAcrossConnections(options)) {
        yield item;
        i++;

        if (i >= options.limit) {
          return;
        }
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

  async *sourceNodes(options = {}) {
    if (this.classObj.sourceClassId === null) {
      return;
    }

    const sourceTableId = this.classObj._origraph.classes[this.classObj.sourceClassId].tableId;
    options.tableIds = this.classObj.sourceTableIds.concat([sourceTableId]);
    yield* this.iterateAcrossConnections(options);
  }

  async *targetNodes(options = {}) {
    if (this.classObj.targetClassId === null) {
      return;
    }

    const targetTableId = this.classObj._origraph.classes[this.classObj.targetClassId].tableId;
    options.tableIds = this.classObj.targetTableIds.concat([targetTableId]);
    yield* this.iterateAcrossConnections(options);
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

class Origraph extends TriggerableMixin(class {}) {
  constructor(FileReader$$1, localStorage) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node

    this.localStorage = localStorage; // either window.localStorage or null

    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set origraph.debug to true to debug streams

    this.plugins = {}; // extensions that we want datalib to handle

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

    this.tables = this.hydrate('origraph_tables', this.TABLES);
    NEXT_TABLE_ID = Object.keys(this.tables).reduce((highestNum, tableId) => {
      return Math.max(highestNum, parseInt(tableId.match(/table(\d*)/)[1]));
    }, 0) + 1; // Object containing our class specifications

    this.classes = this.hydrate('origraph_classes', this.CLASSES);
    NEXT_CLASS_ID = Object.keys(this.classes).reduce((highestNum, classId) => {
      return Math.max(highestNum, parseInt(classId.match(/class(\d*)/)[1]));
    }, 0) + 1;
  }

  saveTables() {
    this.dehydrate('origraph_tables', this.tables);
    this.trigger('tableUpdate');
  }

  saveClasses() {
    this.dehydrate('origraph_classes', this.classes);
    this.trigger('classUpdate');
  }

  hydrate(storageKey, TYPES) {
    let container = this.localStorage && this.localStorage.getItem(storageKey);
    container = container ? JSON.parse(container) : {};

    for (const [key, value] of Object.entries(container)) {
      const type = value.type;
      delete value.type;
      value.origraph = this;
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
    options.origraph = this;
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
    options.origraph = this;
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

  registerPlugin(name, plugin) {
    this.plugins[name] = plugin;
  }

}

var name = "origraph";
var version = "0.1.3";
var description = "A library for flexible graph reshaping";
var main = "dist/origraph.cjs.js";
var module$1 = "dist/origraph.esm.js";
var browser = "dist/origraph.umd.js";
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
	url: "git+https://github.com/origraph/origraph.js.git"
};
var author = "Alex Bigelow";
var license = "MIT";
var bugs = {
	url: "https://github.com/origraph/origraph.js/issues"
};
var homepage = "https://github.com/origraph/origraph.js#readme";
var devDependencies = {
	"@babel/core": "^7.1.2",
	"@babel/preset-env": "^7.1.0",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.6.0",
	coveralls: "^3.0.2",
	jest: "^23.6.0",
	rollup: "^0.66.6",
	"rollup-plugin-babel": "^4.0.3",
	"rollup-plugin-commonjs": "^9.2.0",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.4.0",
	"rollup-plugin-node-resolve": "^3.4.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.1",
	filereader: "^0.10.3",
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
	"jsnext:main": "dist/origraph.esm.js",
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

let origraph = new Origraph(FileReader, null);
origraph.version = pkg.version;

module.exports = origraph;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguY2pzLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL09yaWdyYXBoLmpzIiwiLi4vc3JjL21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICBpZiAoIXRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoIWFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKSAhPT0gLTEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudE5hbWUsIC4uLmFyZ3MpIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fb3JpZ3JhcGggPSBvcHRpb25zLm9yaWdyYXBoO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMuX29yaWdyYXBoIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgb3JpZ3JhcGggYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5hdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcyA9IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9vcmlncmFwaC5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhTdWJGaWx0ZXIgPSAob3B0aW9ucy5pbmRleFN1YkZpbHRlciAmJiB0aGlzLl9vcmlncmFwaC5oeWRyYXRlRnVuY3Rpb24ob3B0aW9ucy5pbmRleFN1YkZpbHRlcikpIHx8IG51bGw7XG4gICAgdGhpcy5fYXR0cmlidXRlU3ViRmlsdGVycyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5hdHRyaWJ1dGVTdWJGaWx0ZXJzIHx8IHt9KSkge1xuICAgICAgdGhpcy5fYXR0cmlidXRlU3ViRmlsdGVyc1thdHRyXSA9IHRoaXMuX29yaWdyYXBoLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuX2F0dHJpYnV0ZXMsXG4gICAgICBkZXJpdmVkVGFibGVzOiB0aGlzLl9kZXJpdmVkVGFibGVzLFxuICAgICAgdXNlZEJ5Q2xhc3NlczogdGhpcy5fdXNlZEJ5Q2xhc3NlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZVN1YkZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhTdWJGaWx0ZXI6ICh0aGlzLl9pbmRleFN1YkZpbHRlciAmJiB0aGlzLl9vcmlncmFwaC5kZWh5ZHJhdGVGdW5jdGlvbih0aGlzLl9pbmRleFN1YkZpbHRlcikpIHx8IG51bGxcbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX29yaWdyYXBoLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSkge1xuICAgICAgcmVzdWx0LmF0dHJpYnV0ZVN1YkZpbHRlcnNbYXR0cl0gPSB0aGlzLl9vcmlncmFwaC5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIEdlbmVyaWMgY2FjaGluZyBzdHVmZjsgdGhpcyBpc24ndCBqdXN0IGZvciBwZXJmb3JtYW5jZS4gQ29ubmVjdGVkVGFibGUnc1xuICAgIC8vIGFsZ29yaXRobSByZXF1aXJlcyB0aGF0IGl0cyBwYXJlbnQgdGFibGVzIGhhdmUgcHJlLWJ1aWx0IGluZGV4ZXMgKHdlXG4gICAgLy8gdGVjaG5pY2FsbHkgY291bGQgaW1wbGVtZW50IGl0IGRpZmZlcmVudGx5LCBidXQgaXQgd291bGQgYmUgZXhwZW5zaXZlLFxuICAgIC8vIHJlcXVpcmVzIHRyaWNreSBsb2dpYywgYW5kIHdlJ3JlIGFscmVhZHkgYnVpbGRpbmcgaW5kZXhlcyBmb3Igc29tZSB0YWJsZXNcbiAgICAvLyBsaWtlIEFnZ3JlZ2F0ZWRUYWJsZSBhbnl3YXkpXG4gICAgaWYgKG9wdGlvbnMucmVzZXQpIHtcbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgICAgeWllbGQgKiBPYmplY3QudmFsdWVzKHRoaXMuX2NhY2hlKS5zbGljZSgwLCBsaW1pdCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgeWllbGQgKiBhd2FpdCB0aGlzLl9idWlsZENhY2hlKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQgPT09IHVuZGVmaW5lZCA/IEluZmluaXR5IDogb3B0aW9ucy5saW1pdDtcbiAgICBkZWxldGUgb3B0aW9ucy5saW1pdDtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUob3B0aW9ucyk7XG4gICAgbGV0IGNvbXBsZXRlZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIGl0ZXJhdGlvbiB3YXMgY2FuY2VsbGVkOyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICBjb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSk7XG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt0ZW1wLnZhbHVlLmluZGV4XSA9IHRlbXAudmFsdWU7XG4gICAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjb21wbGV0ZWQpIHtcbiAgICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgZGVsZXRlIHdyYXBwZWRJdGVtLnJvd1thdHRyXTtcbiAgICB9XG4gICAgbGV0IGtlZXAgPSB0cnVlO1xuICAgIGlmICh0aGlzLl9pbmRleFN1YkZpbHRlcikge1xuICAgICAga2VlcCA9IHRoaXMuX2luZGV4U3ViRmlsdGVyKHdyYXBwZWRJdGVtLmluZGV4KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlU3ViRmlsdGVycykpIHtcbiAgICAgIGtlZXAgPSBrZWVwICYmIGZ1bmMod3JhcHBlZEl0ZW0ucm93W2F0dHJdKTtcbiAgICAgIGlmICgha2VlcCkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoa2VlcCkge1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyYXBwZWRJdGVtLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbHRlcicpO1xuICAgIH1cbiAgICByZXR1cm4ga2VlcDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgdGhpcy5fb3JpZ3JhcGguV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gICAgZm9yIChjb25zdCBvdGhlckl0ZW0gb2Ygb3B0aW9ucy5pdGVtc1RvQ29ubmVjdCB8fCBbXSkge1xuICAgICAgd3JhcHBlZEl0ZW0uY29ubmVjdEl0ZW0ob3RoZXJJdGVtKTtcbiAgICAgIG90aGVySXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGU7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX2NhY2hlUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fY2FjaGVQcm9taXNlID0gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRlbXAgb2YgdGhpcy5fYnVpbGRDYWNoZSgpKSB7fSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIH1cbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhhd2FpdCB0aGlzLmJ1aWxkQ2FjaGUoKSkubGVuZ3RoO1xuICB9XG4gIGdldEluZGV4RGV0YWlscyAoKSB7XG4gICAgY29uc3QgZGV0YWlscyA9IHsgbmFtZTogbnVsbCB9O1xuICAgIGlmICh0aGlzLl9zdXBwcmVzc0luZGV4KSB7XG4gICAgICBkZXRhaWxzLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faW5kZXhTdWJGaWx0ZXIpIHtcbiAgICAgIGRldGFpbHMuZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZGV0YWlscztcbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHt9O1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5leHBlY3RlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5vYnNlcnZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZGVyaXZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fYXR0cmlidXRlU3ViRmlsdGVycykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG4gIGdldCBhdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5nZXRBdHRyaWJ1dGVEZXRhaWxzKCkpO1xuICB9XG4gIGdldCBjdXJyZW50RGF0YSAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6IHRoaXMuX2NhY2hlIHx8IHRoaXMuX3BhcnRpYWxDYWNoZSB8fCB7fSxcbiAgICAgIGNvbXBsZXRlOiAhIXRoaXMuX2NhY2hlXG4gICAgfTtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIHN1cHByZXNzQXR0cmlidXRlIChhdHRyaWJ1dGUpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBhZGRTdWJGaWx0ZXIgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2luZGV4U3ViRmlsdGVyID0gZnVuYztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYXR0cmlidXRlU3ViRmlsdGVyc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIF9kZXJpdmVUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5fb3JpZ3JhcGguc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGVJZCA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZUlkICYmIHRoaXMuX29yaWdyYXBoLnRhYmxlc1tleGlzdGluZ1RhYmxlSWRdKSB8fCBudWxsO1xuICB9XG4gIHNob3J0ZXN0UGF0aFRvVGFibGUgKG90aGVyVGFibGUpIHtcbiAgICAvLyBEaWprc3RyYSdzIGFsZ29yaXRobS4uLlxuICAgIGNvbnN0IHZpc2l0ZWQgPSB7fTtcbiAgICBjb25zdCBkaXN0YW5jZXMgPSB7fTtcbiAgICBjb25zdCBwcmV2VGFibGVzID0ge307XG4gICAgY29uc3QgdmlzaXQgPSB0YXJnZXRJZCA9PiB7XG4gICAgICBjb25zdCB0YXJnZXRUYWJsZSA9IHRoaXMuX29yaWdyYXBoLnRhYmxlc1t0YXJnZXRJZF07XG4gICAgICAvLyBPbmx5IGNoZWNrIHRoZSB1bnZpc2l0ZWQgZGVyaXZlZCBhbmQgcGFyZW50IHRhYmxlc1xuICAgICAgY29uc3QgbmVpZ2hib3JMaXN0ID0gT2JqZWN0LmtleXModGFyZ2V0VGFibGUuX2Rlcml2ZWRUYWJsZXMpXG4gICAgICAgIC5jb25jYXQodGFyZ2V0VGFibGUucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS50YWJsZUlkKSlcbiAgICAgICAgLmZpbHRlcih0YWJsZUlkID0+ICF2aXNpdGVkW3RhYmxlSWRdKTtcbiAgICAgIC8vIENoZWNrIGFuZCBhc3NpZ24gKG9yIHVwZGF0ZSkgdGVudGF0aXZlIGRpc3RhbmNlcyB0byBlYWNoIG5laWdoYm9yXG4gICAgICBmb3IgKGNvbnN0IG5laWdoYm9ySWQgb2YgbmVpZ2hib3JMaXN0KSB7XG4gICAgICAgIGlmIChkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9IEluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIGlmIChkaXN0YW5jZXNbdGFyZ2V0SWRdICsgMSA8IGRpc3RhbmNlc1tuZWlnaGJvcklkXSkge1xuICAgICAgICAgIGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9IGRpc3RhbmNlc1t0YXJnZXRJZF0gKyAxO1xuICAgICAgICAgIHByZXZUYWJsZXNbbmVpZ2hib3JJZF0gPSB0YXJnZXRJZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgdGhpcyB0YWJsZSBpcyBvZmZpY2lhbGx5IHZpc2l0ZWQ7IHRha2UgaXQgb3V0IG9mIHRoZSBydW5uaW5nXG4gICAgICAvLyBmb3IgZnV0dXJlIHZpc2l0cyAvIGNoZWNrc1xuICAgICAgdmlzaXRlZFt0YXJnZXRJZF0gPSB0cnVlO1xuICAgICAgZGVsZXRlIGRpc3RhbmNlc1t0YXJnZXRJZF07XG4gICAgfTtcblxuICAgIC8vIFN0YXJ0IHdpdGggdGhpcyB0YWJsZVxuICAgIHByZXZUYWJsZXNbdGhpcy50YWJsZUlkXSA9IG51bGw7XG4gICAgZGlzdGFuY2VzW3RoaXMudGFibGVJZF0gPSAwO1xuICAgIGxldCB0b1Zpc2l0ID0gT2JqZWN0LmtleXMoZGlzdGFuY2VzKTtcbiAgICB3aGlsZSAodG9WaXNpdC5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBWaXNpdCB0aGUgbmV4dCB0YWJsZSB0aGF0IGhhcyB0aGUgc2hvcnRlc3QgZGlzdGFuY2VcbiAgICAgIHRvVmlzaXQuc29ydCgoYSwgYikgPT4gZGlzdGFuY2VzW2FdIC0gZGlzdGFuY2VzW2JdKTtcbiAgICAgIGxldCBuZXh0SWQgPSB0b1Zpc2l0LnNoaWZ0KCk7XG4gICAgICBpZiAobmV4dElkID09PSBvdGhlclRhYmxlLnRhYmxlSWQpIHtcbiAgICAgICAgLy8gRm91bmQgb3RoZXJUYWJsZSEgU2VuZCBiYWNrIHRoZSBjaGFpbiBvZiBjb25uZWN0ZWQgdGFibGVzXG4gICAgICAgIGNvbnN0IGNoYWluID0gW107XG4gICAgICAgIHdoaWxlIChwcmV2VGFibGVzW25leHRJZF0gIT09IG51bGwpIHtcbiAgICAgICAgICBjaGFpbi51bnNoaWZ0KHRoaXMuX29yaWdyYXBoLnRhYmxlc1tuZXh0SWRdKTtcbiAgICAgICAgICBuZXh0SWQgPSBwcmV2VGFibGVzW25leHRJZF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoYWluO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVmlzaXQgdGhlIHRhYmxlXG4gICAgICAgIHZpc2l0KG5leHRJZCk7XG4gICAgICAgIHRvVmlzaXQgPSBPYmplY3Qua2V5cyhkaXN0YW5jZXMpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBXZSBkaWRuJ3QgZmluZCBpdDsgdGhlcmUncyBubyBjb25uZWN0aW9uXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgZGVsaW1pdGVyXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9O1xuICAgICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gaW5kZXhlcy5tYXAoaW5kZXggPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4XG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoeyBsaW1pdCB9KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVUYWJsZSh7IHR5cGU6ICdDb25uZWN0ZWRUYWJsZScgfSk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgZm9yIChjb25zdCBvdGhlclRhYmxlIG9mIG90aGVyVGFibGVMaXN0KSB7XG4gICAgICBvdGhlclRhYmxlLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5fb3JpZ3JhcGguc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX29yaWdyYXBoLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX29yaWdyYXBoLnRhYmxlcykucmVkdWNlKChhZ2csIHRhYmxlT2JqKSA9PiB7XG4gICAgICBpZiAodGFibGVPYmouX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXSkge1xuICAgICAgICBhZ2cucHVzaCh0YWJsZU9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKTtcbiAgfVxuICBnZXQgZGVyaXZlZFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX29yaWdyYXBoLmNsYXNzZXMpLnNvbWUoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlSWQgPT09IHRoaXMudGFibGVJZCB8fFxuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xIHx8XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTE7XG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBpZiAodGhpcy5pblVzZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fb3JpZ3JhcGgudGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgdGhpcy5fb3JpZ3JhcGguc2F2ZVRhYmxlcygpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3RUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpZXJkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEFnZ3JlZ2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX29yaWdyYXBoLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9vcmlncmFwaC5fZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAn4oamJztcbiAgfVxuICBkZXJpdmVSZWR1Y2VkQXR0cmlidXRlIChhdHRyLCBmdW5jKSB7XG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX3VwZGF0ZUl0ZW0gKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG5ld1dyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG5ld1dyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zKSB7XG4gICAgLy8gV2Ugb3ZlcnJpZGUgX2J1aWxkQ2FjaGUgYmVjYXVzZSBzbyB0aGF0IEFnZ3JlZ2F0ZWRUYWJsZSBjYW4gdGFrZSBhZHZhbnRhZ2VcbiAgICAvLyBvZiB0aGUgcGFydGlhbGx5LWJ1aWx0IGNhY2hlIGFzIGl0IGdvZXMsIGFuZCBwb3N0cG9uZSBmaW5pc2hpbmcgaXRlbXNcbiAgICAvLyB1bnRpbCBhZnRlciB0aGUgcGFyZW50IHRhYmxlIGhhcyBiZWVuIGZ1bGx5IGl0ZXJhdGVkXG5cbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbd3JhcHBlZEl0ZW0uaW5kZXhdID0gd3JhcHBlZEl0ZW07XG4gICAgICAvLyBHbyBhaGVhZCBhbmQgeWllbGQgdGhlIHVuZmluaXNoZWQgaXRlbTsgdGhpcyBtYWtlcyBpdCBwb3NzaWJsZSBmb3JcbiAgICAgIC8vIGNsaWVudCBhcHBzIHRvIGJlIG1vcmUgcmVzcG9uc2l2ZSBhbmQgcmVuZGVyIHBhcnRpYWwgcmVzdWx0cywgYnV0IGFsc29cbiAgICAgIC8vIG1lYW5zIHRoYXQgdGhleSBuZWVkIHRvIHdhdGNoIGZvciB3cmFwcGVkSXRlbS5vbigndXBkYXRlJykgZXZlbnRzXG4gICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICB9XG5cbiAgICAvLyBTZWNvbmQgcGFzczogbm93IHRoYXQgd2UndmUgY29tcGxldGVkIHRoZSBmdWxsIGl0ZXJhdGlvbiBvZiB0aGUgcGFyZW50XG4gICAgLy8gdGFibGUsIHdlIGNhbiBmaW5pc2ggZWFjaCBpdGVtXG4gICAgZm9yIChjb25zdCBpbmRleCBpbiB0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIGlmICghdGhpcy5fZmluaXNoSXRlbSh3cmFwcGVkSXRlbSkpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgaW5kZXggPSBTdHJpbmcod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBXZSB3ZXJlIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKGV4aXN0aW5nSXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKG5ld0l0ZW0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHN1cGVyLmdldEF0dHJpYnV0ZURldGFpbHMoKTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ucmVkdWNlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQWdncmVnYXRlZFRhYmxlO1xuIiwiY29uc3QgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuZHVwbGljYXRlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgfVxuICAgIF90b1Jhd09iamVjdCAoKSB7XG4gICAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICAgIG9iai5kdXBsaWNhdGVkQXR0cmlidXRlcyA9IHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgZHVwbGljYXRlQXR0cmlidXRlIChwYXJlbnRJZCwgYXR0cmlidXRlKSB7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gPSB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gfHwgW107XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0ucHVzaChhdHRyaWJ1dGUpO1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBfZHVwbGljYXRlQXR0cmlidXRlcyAod3JhcHBlZEl0ZW0pIHtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgcGFyZW50TmFtZSA9IHRoaXMuX29yaWdyYXBoLnRhYmxlc1twYXJlbnRJZF0ubmFtZTtcbiAgICAgICAgd3JhcHBlZEl0ZW0ucm93W2Ake3BhcmVudE5hbWV9LiR7YXR0cn1gXSA9IHdyYXBwZWRJdGVtLmNvbm5lY3RlZEl0ZW1zW3BhcmVudElkXVswXS5yb3dbYXR0cl07XG4gICAgICB9XG4gICAgfVxuICAgIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgICAgY29uc3QgYWxsQXR0cnMgPSBzdXBlci5nZXRBdHRyaWJ1dGVEZXRhaWxzKCk7XG4gICAgICBmb3IgKGNvbnN0IFtwYXJlbnRJZCwgYXR0cl0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXMpKSB7XG4gICAgICAgIGNvbnN0IGF0dHJOYW1lID0gYCR7dGhpcy5fb3JpZ3JhcGgudGFibGVzW3BhcmVudElkXS5uYW1lfS4ke2F0dHJ9YDtcbiAgICAgICAgYWxsQXR0cnNbYXR0ck5hbWVdID0gYWxsQXR0cnNbYXR0ck5hbWVdIHx8IHsgbmFtZTogYXR0ck5hbWUgfTtcbiAgICAgICAgYWxsQXR0cnNbYXR0ck5hbWVdLmNvcGllZCA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWxsQXR0cnM7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuaW1wb3J0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiBmcm9tICcuL0R1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5kZWxpbWl0ZXIgPSBvcHRpb25zLmRlbGltaXRlciB8fCAnLCc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAn4oakJztcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IHZhbHVlcyA9ICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdIHx8ICcnKS5zcGxpdCh0aGlzLmRlbGltaXRlcik7XG4gICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuICAgICAgICBjb25zdCByb3cgPSB7fTtcbiAgICAgICAgcm93W3RoaXMuX2F0dHJpYnV0ZV0gPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdyxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2R1cGxpY2F0ZUF0dHJpYnV0ZXMobmV3SXRlbSk7XG4gICAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmFjZXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICB0aGlzLl92YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBgWyR7dGhpcy5fdmFsdWV9XWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBpZiAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgLy8gTm9ybWFsIGZhY2V0aW5nIGp1c3QgZ2l2ZXMgYSBzdWJzZXQgb2YgdGhlIG9yaWdpbmFsIHRhYmxlXG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3c6IE9iamVjdC5hc3NpZ24oe30sIHdyYXBwZWRQYXJlbnQucm93KSxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmFjZXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBUcmFuc3Bvc2VkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2luZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5faW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5pbmRleCA9IHRoaXMuX2luZGV4O1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBg4bWAJHt0aGlzLl9pbmRleH1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGF3YWl0IHBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcblxuICAgIC8vIEl0ZXJhdGUgdGhlIHJvdydzIGF0dHJpYnV0ZXMgYXMgaW5kZXhlc1xuICAgIGNvbnN0IHdyYXBwZWRQYXJlbnQgPSBwYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5faW5kZXhdIHx8IHsgcm93OiB7fSB9O1xuICAgIGZvciAoY29uc3QgWyBpbmRleCwgdmFsdWUgXSBvZiBPYmplY3QuZW50cmllcyh3cmFwcGVkUGFyZW50LnJvdykpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gZnJvbSAnLi9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbihUYWJsZSkge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS5uYW1lKS5qb2luKCfiqK8nKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgLy8gU3BpbiB0aHJvdWdoIGFsbCBvZiB0aGUgcGFyZW50VGFibGVzIHNvIHRoYXQgdGhlaXIgX2NhY2hlIGlzIHByZS1idWlsdFxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICBhd2FpdCBwYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG4gICAgfVxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGUpKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZVtpbmRleF0pKSB7XG4gICAgICAgIC8vIE5vIG1hdGNoIGluIG9uZSBvZiB0aGUgb3RoZXIgdGFibGVzOyBvbWl0IHRoaXMgaXRlbVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIFRPRE86IGFkZCBlYWNoIHBhcmVudCB0YWJsZXMnIGtleXMgYXMgYXR0cmlidXRlIHZhbHVlc1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IHBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSlcbiAgICAgIH0pO1xuICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlcyhuZXdJdGVtKTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9wdGlvbnMub3JpZ3JhcGg7XG4gICAgdGhpcy5jbGFzc0lkID0gb3B0aW9ucy5jbGFzc0lkO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMuX29yaWdyYXBoIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBfb3JpZ3JhcGgsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9uc1xuICAgIH07XG4gIH1cbiAgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIHRoaXMuX2NsYXNzTmFtZSA9IHZhbHVlO1xuICAgIHRoaXMuX29yaWdyYXBoLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgIT09IG51bGw7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fCB0aGlzLnRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0SGFzaFRhYmxlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5fb3JpZ3JhcGgudGFibGVzW3RoaXMudGFibGVJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IHRoaXMuX29yaWdyYXBoLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5fb3JpZ3JhcGgubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlR2VuZXJpY0NsYXNzIChuZXdUYWJsZSkge1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5uZXdDbGFzcyh7XG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcydcbiAgICB9KTtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3ModGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKSk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3ModGhpcy50YWJsZS5leHBhbmQoYXR0cmlidXRlLCBkZWxpbWl0ZXIpKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlICgpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlblRyYW5zcG9zZSgpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5fb3JpZ3JhcGguc2F2ZUNsYXNzZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkcyA9IG9wdGlvbnMuZWRnZUNsYXNzSWRzIHx8IHt9O1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IHRoaXMuX29yaWdyYXBoLldSQVBQRVJTLk5vZGVXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIC8vIEFyZSB3ZSB0aGUgc291cmNlIG9yIHRhcmdldCBvZiB0aGUgZXhpc3RpbmcgZWRnZSAoaW50ZXJuYWxseSwgaW4gdGVybXNcbiAgICAgIC8vIG9mIHNvdXJjZUlkIC8gdGFyZ2V0SWQsIG5vdCBlZGdlQ2xhc3MuZGlyZWN0aW9uKT9cbiAgICAgIGNvbnN0IGlzU291cmNlID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZDtcblxuICAgICAgLy8gQXMgd2UncmUgY29udmVydGVkIHRvIGFuIGVkZ2UsIG91ciBuZXcgcmVzdWx0aW5nIHNvdXJjZSBBTkQgdGFyZ2V0XG4gICAgICAvLyBzaG91bGQgYmUgd2hhdGV2ZXIgaXMgYXQgdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MgKGlmIGFueXRoaW5nKVxuICAgICAgaWYgKGlzU291cmNlKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICB9XG5cbiAgICAgIC8vIHRhYmxlSWQgbGlzdHMgc2hvdWxkIGVtYW5hdGUgb3V0IGZyb20gdGhlIChuZXcpIGVkZ2UgdGFibGU7IGFzc3VtaW5nXG4gICAgICAvLyAoZm9yIGEgbW9tZW50KSB0aGF0IGlzU291cmNlID09PSB0cnVlLCB3ZSdkIGNvbnN0cnVjdCB0aGUgdGFibGVJZCBsaXN0XG4gICAgICAvLyBsaWtlIHRoaXM6XG4gICAgICBsZXQgdGFibGVJZExpc3QgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIGVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmICghaXNTb3VyY2UpIHtcbiAgICAgICAgLy8gV2hvb3BzLCBnb3QgaXQgYmFja3dhcmRzIVxuICAgICAgICB0YWJsZUlkTGlzdC5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZWRnZUNsYXNzLmRpcmVjdGVkO1xuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YWJsZUlkTGlzdDtcbiAgICAgIC8vIFRPRE86IGluc3RlYWQgb2YgZGVsZXRpbmcgdGhlIGV4aXN0aW5nIGVkZ2UgY2xhc3MsIHNob3VsZCB3ZSBsZWF2ZSBpdFxuICAgICAgLy8gaGFuZ2luZyArIHVuY29ubmVjdGVkP1xuICAgICAgZWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgLy8gT2theSwgd2UndmUgZ290IHR3byBlZGdlcywgc28gdGhpcyBpcyBhIGxpdHRsZSBtb3JlIHN0cmFpZ2h0Zm9yd2FyZFxuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIGxldCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fb3JpZ3JhcGguY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBub3cgd2Uga25vdyBob3cgdG8gc2V0IHNvdXJjZSAvIHRhcmdldCBpZHNcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IHNvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEZWxldGUgZWFjaCBvZiB0aGUgZWRnZSBjbGFzc2VzXG4gICAgICBzb3VyY2VFZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgICB0YXJnZXRFZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgfVxuICAgIHRoaXMuZGVsZXRlKCk7XG4gICAgZGVsZXRlIG9wdGlvbnMuY2xhc3NJZDtcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGNvbnN0IHRoaXNIYXNoID0gdGhpcy5nZXRIYXNoVGFibGUoYXR0cmlidXRlKTtcbiAgICBjb25zdCBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy5nZXRIYXNoVGFibGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFsgdGhpc0hhc2gudGFibGVJZCBdLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldFRhYmxlSWRzOiBbIG90aGVySGFzaC50YWJsZUlkIF1cbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMuX29yaWdyYXBoLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIC8vIHNvdXJjZVRhYmxlSWRzIGFuZCB0YXJnZXRUYWJsZUlkcyBhcmUgbGlzdHMgb2YgYW55IGludGVybWVkaWF0ZSB0YWJsZXMsXG4gICAgLy8gYmVnaW5uaW5nIHdpdGggdGhlIGVkZ2UgdGFibGUgKGJ1dCBub3QgaW5jbHVkaW5nIGl0KSwgdGhhdCBsZWFkIHRvIHRoZVxuICAgIC8vIHNvdXJjZSAvIHRhcmdldCBub2RlIHRhYmxlcyAoYnV0IG5vdCBpbmNsdWRpbmcpIHRob3NlXG5cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgdGhpcy5fb3JpZ3JhcGguV1JBUFBFUlMuRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLl9vcmlncmFwaC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgcmV0dXJuIHsgdGFibGVJZCwgaW5kZXgsIGRpc3Q6IE1hdGguYWJzKHRhYmxlSWRMaXN0IC8gMiAtIGluZGV4KSB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIHRhYmxlRGlzdGFuY2VzID0gdGFibGVEaXN0YW5jZXMuZmlsdGVyKCh7IHRhYmxlSWQgfSkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCB7IHRhYmxlSWQsIGluZGV4IH0gPSB0YWJsZURpc3RhbmNlcy5zb3J0KChhLCBiKSA9PiBhLmRpc3QgLSBiLmRpc3QpWzBdO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGFibGVJZDtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZSgwLCBpbmRleCkucmV2ZXJzZSgpO1xuICAgICAgcmVzdWx0Lm5vZGVUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKGluZGV4ICsgMSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICB0ZW1wLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICBkZWxldGUgdGVtcC5jbGFzc0lkO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW3RlbXAuc291cmNlQ2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC5zb3VyY2VUYWJsZUlkcywgc291cmNlQ2xhc3MpO1xuICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiB0ZW1wLnNvdXJjZUNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGVtcC50YXJnZXRDbGFzc0lkICYmIHRlbXAuc291cmNlQ2xhc3NJZCAhPT0gdGVtcC50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiB0ZW1wLnRhcmdldENsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBub2RlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICB0aGlzLl9vcmlncmFwaC5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgc2lkZSwgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KSB7XG4gICAgaWYgKHNpZGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2UoeyBub2RlQ2xhc3MsIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSk7XG4gICAgfSBlbHNlIGlmIChzaWRlID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFBvbGl0aWNhbE91dHNpZGVyRXJyb3I6IFwiJHtzaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgICB0aGlzLl9vcmlncmFwaC5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIHRvZ2dsZURpcmVjdGlvbiAoZGlyZWN0ZWQpIHtcbiAgICBpZiAoZGlyZWN0ZWQgPT09IGZhbHNlIHx8IHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgZGVsZXRlIHRoaXMuc3dhcHBlZERpcmVjdGlvbjtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmRpcmVjdGVkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEaXJlY3RlZCB3YXMgYWxyZWFkeSB0cnVlLCBqdXN0IHN3aXRjaCBzb3VyY2UgYW5kIHRhcmdldFxuICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSB0ZW1wO1xuICAgICAgdGVtcCA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSB0ZW1wO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5fb3JpZ3JhcGguc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBjb25uZWN0U291cmNlICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNraXBTYXZlID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5fb3JpZ3JhcGguY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLmdldEhhc2hUYWJsZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyBzb3VyY2VDbGFzcy50YWJsZSA6IHNvdXJjZUNsYXNzLmdldEhhc2hUYWJsZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cblxuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fb3JpZ3JhcGguc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc2tpcFNhdmUgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMuZ2V0SGFzaFRhYmxlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRhcmdldENsYXNzLnRhYmxlIDogdGFyZ2V0Q2xhc3MuZ2V0SGFzaFRhYmxlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9vcmlncmFwaC5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGlzY29ubmVjdFNvdXJjZSAoeyBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX29yaWdyYXBoLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fb3JpZ3JhcGguc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gIH1cbiAgZGlzY29ubmVjdCAoKSB7XG4gICAgZm9yIChjb25zdCBpdGVtTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuY29ubmVjdGVkSXRlbXMpKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbUxpc3QpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSAoaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdIHx8IFtdKS5pbmRleE9mKHRoaXMpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IHt9O1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh7IHRhYmxlSWRzLCBsaW1pdCA9IEluZmluaXR5IH0pIHtcbiAgICAvLyBGaXJzdCBtYWtlIHN1cmUgdGhhdCBhbGwgdGhlIHRhYmxlIGNhY2hlcyBoYXZlIGJlZW4gZnVsbHkgYnVpbHQgYW5kXG4gICAgLy8gY29ubmVjdGVkXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwodGFibGVJZHMubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3NPYmouX29yaWdyYXBoLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSkge1xuICAgICAgeWllbGQgaXRlbTtcbiAgICAgIGkrKztcbiAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbdGFibGVJZHNbMF1dIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGhpc1RhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1t0aGlzVGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0geyBsaW1pdDogSW5maW5pdHkgfSkge1xuICAgIGNvbnN0IGVkZ2VJZHMgPSBvcHRpb25zLmVkZ2VJZHMgfHwgdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHM7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIE9iamVjdC5rZXlzKGVkZ2VJZHMpKSB7XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLl9vcmlncmFwaC5jbGFzc2VzW2VkZ2VJZF07XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NPYmouY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnRhYmxlSWRzID0gZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnMudGFibGVJZHMgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgIGkrKztcbiAgICAgICAgaWYgKGkgPj0gb3B0aW9ucy5saW1pdCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogc291cmNlTm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlVGFibGVJZCA9IHRoaXMuY2xhc3NPYmouX29yaWdyYXBoXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgb3B0aW9ucy50YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmouc291cmNlVGFibGVJZHNcbiAgICAgIC5jb25jYXQoWyBzb3VyY2VUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkID0gdGhpcy5jbGFzc09iai5fb3JpZ3JhcGhcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF0udGFibGVJZDtcbiAgICBvcHRpb25zLnRhYmxlSWRzID0gdGhpcy5jbGFzc09iai50YXJnZXRUYWJsZUlkc1xuICAgICAgLmNvbmNhdChbIHRhcmdldFRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICBpZiAodGhpcy5lbnRyaWVzW2hhc2hdLmluZGV4T2YodmFsdWUpID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcbmxldCBORVhUX1RBQkxFX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBvcmlncmFwaC5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UQUJMRVMgPSBUQUJMRVM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHsgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbTsgfSxcbiAgICAgIGtleTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKCF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICAhd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR3JhbmRwYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIHlpZWxkIHtcbiAgICAgICAgICBsZWZ0OiB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICByaWdodDogb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgICAgIG5vb3A6ICgpID0+IHt9XG4gICAgfTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMudGFibGVzID0gdGhpcy5oeWRyYXRlKCdvcmlncmFwaF90YWJsZXMnLCB0aGlzLlRBQkxFUyk7XG4gICAgTkVYVF9UQUJMRV9JRCA9IE9iamVjdC5rZXlzKHRoaXMudGFibGVzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgdGFibGVJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQodGFibGVJZC5tYXRjaCgvdGFibGUoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgb3VyIGNsYXNzIHNwZWNpZmljYXRpb25zXG4gICAgdGhpcy5jbGFzc2VzID0gdGhpcy5oeWRyYXRlKCdvcmlncmFwaF9jbGFzc2VzJywgdGhpcy5DTEFTU0VTKTtcbiAgICBORVhUX0NMQVNTX0lEID0gT2JqZWN0LmtleXModGhpcy5jbGFzc2VzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgY2xhc3NJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQoY2xhc3NJZC5tYXRjaCgvY2xhc3MoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuICB9XG5cbiAgc2F2ZVRhYmxlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ29yaWdyYXBoX3RhYmxlcycsIHRoaXMudGFibGVzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3RhYmxlVXBkYXRlJyk7XG4gIH1cbiAgc2F2ZUNsYXNzZXMgKCkge1xuICAgIHRoaXMuZGVoeWRyYXRlKCdvcmlncmFwaF9jbGFzc2VzJywgdGhpcy5jbGFzc2VzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NsYXNzVXBkYXRlJyk7XG4gIH1cblxuICBoeWRyYXRlIChzdG9yYWdlS2V5LCBUWVBFUykge1xuICAgIGxldCBjb250YWluZXIgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKHN0b3JhZ2VLZXkpO1xuICAgIGNvbnRhaW5lciA9IGNvbnRhaW5lciA/IEpTT04ucGFyc2UoY29udGFpbmVyKSA6IHt9O1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvbnRhaW5lcikpIHtcbiAgICAgIGNvbnN0IHR5cGUgPSB2YWx1ZS50eXBlO1xuICAgICAgZGVsZXRlIHZhbHVlLnR5cGU7XG4gICAgICB2YWx1ZS5vcmlncmFwaCA9IHRoaXM7XG4gICAgICBjb250YWluZXJba2V5XSA9IG5ldyBUWVBFU1t0eXBlXSh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cbiAgZGVoeWRyYXRlIChzdG9yYWdlS2V5LCBjb250YWluZXIpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlLl90b1Jhd09iamVjdCgpO1xuICAgICAgICByZXN1bHRba2V5XS50eXBlID0gdmFsdWUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oc3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gICAgfVxuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG5cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMudGFibGVJZCkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHtORVhUX1RBQkxFX0lEfWA7XG4gICAgICBORVhUX1RBQkxFX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLlRBQkxFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5vcmlncmFwaCA9IHRoaXM7XG4gICAgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdO1xuICB9XG4gIGNyZWF0ZUNsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYGVtcHR5YCB9KSB7XG4gICAgaWYgKCFvcHRpb25zLmNsYXNzSWQpIHtcbiAgICAgIG9wdGlvbnMuY2xhc3NJZCA9IGBjbGFzcyR7TkVYVF9DTEFTU19JRH1gO1xuICAgICAgTkVYVF9DTEFTU19JRCArPSAxO1xuICAgIH1cbiAgICBjb25zdCBUeXBlID0gdGhpcy5DTEFTU0VTW29wdGlvbnMudHlwZV07XG4gICAgZGVsZXRlIG9wdGlvbnMudHlwZTtcbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIG5ld1RhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGVPYmogPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZU9iajtcbiAgfVxuICBuZXdDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld0NsYXNzT2JqID0gdGhpcy5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0NsYXNzT2JqO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljVGFibGUgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY1RhYmxlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24gPSAndHh0JywgdGV4dCB9KSB7XG4gICAgbGV0IGRhdGEsIGF0dHJpYnV0ZXM7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5uZXdUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5uZXdDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBkZWxldGVBbGxVbnVzZWRUYWJsZXMgKCkge1xuICAgIGZvciAoY29uc3QgdGFibGVJZCBpbiB0aGlzLnRhYmxlcykge1xuICAgICAgaWYgKHRoaXMudGFibGVzW3RhYmxlSWRdKSB7XG4gICAgICAgIHRyeSB7IHRoaXMudGFibGVzW3RhYmxlSWRdLmRlbGV0ZSgpOyB9IGNhdGNoIChlcnIpIHt9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGRlbGV0ZUFsbENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc09iai5kZWxldGUoKTtcbiAgICB9XG4gIH1cbiAgZ2V0Q2xhc3NEYXRhICgpIHtcbiAgICBjb25zdCByZXN1bHRzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIHJlc3VsdHNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5jdXJyZW50RGF0YTtcbiAgICB9XG4gIH1cbiAgcmVnaXN0ZXJQbHVnaW4gKG5hbWUsIHBsdWdpbikge1xuICAgIHRoaXMucGx1Z2luc1tuYW1lXSA9IHBsdWdpbjtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBPcmlncmFwaDtcbiIsImltcG9ydCBPcmlncmFwaCBmcm9tICcuL09yaWdyYXBoLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCBGaWxlUmVhZGVyIGZyb20gJ2ZpbGVyZWFkZXInO1xuXG5sZXQgb3JpZ3JhcGggPSBuZXcgT3JpZ3JhcGgoRmlsZVJlYWRlciwgbnVsbCk7XG5vcmlncmFwaC52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG9yaWdyYXBoO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsIm9mZiIsImluZGV4Iiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5Iiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiT2JqZWN0IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJUYWJsZSIsIm9wdGlvbnMiLCJfb3JpZ3JhcGgiLCJvcmlncmFwaCIsInRhYmxlSWQiLCJFcnJvciIsIl9leHBlY3RlZEF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVzIiwiX29ic2VydmVkQXR0cmlidXRlcyIsIl9kZXJpdmVkVGFibGVzIiwiZGVyaXZlZFRhYmxlcyIsIl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiaHlkcmF0ZUZ1bmN0aW9uIiwiX3N1cHByZXNzZWRBdHRyaWJ1dGVzIiwic3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJfc3VwcHJlc3NJbmRleCIsInN1cHByZXNzSW5kZXgiLCJfaW5kZXhTdWJGaWx0ZXIiLCJpbmRleFN1YkZpbHRlciIsIl9hdHRyaWJ1dGVTdWJGaWx0ZXJzIiwiYXR0cmlidXRlU3ViRmlsdGVycyIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwidXNlZEJ5Q2xhc3NlcyIsIl91c2VkQnlDbGFzc2VzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwiaXRlcmF0ZSIsInJlc2V0IiwiX2NhY2hlIiwibGltaXQiLCJ1bmRlZmluZWQiLCJJbmZpbml0eSIsInZhbHVlcyIsInNsaWNlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlIiwiaXRlcmF0b3IiLCJfaXRlcmF0ZSIsImNvbXBsZXRlZCIsIm5leHQiLCJkb25lIiwiX2ZpbmlzaEl0ZW0iLCJ3cmFwcGVkSXRlbSIsInJvdyIsImtlZXAiLCJkaXNjb25uZWN0IiwiX3dyYXAiLCJ0YWJsZSIsImNsYXNzT2JqIiwiV1JBUFBFUlMiLCJHZW5lcmljV3JhcHBlciIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiY29ubmVjdEl0ZW0iLCJkZXJpdmVkVGFibGUiLCJuYW1lIiwiYnVpbGRDYWNoZSIsIl9jYWNoZVByb21pc2UiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNvdW50Um93cyIsImtleXMiLCJsZW5ndGgiLCJnZXRJbmRleERldGFpbHMiLCJkZXRhaWxzIiwic3VwcHJlc3NlZCIsImZpbHRlcmVkIiwiZ2V0QXR0cmlidXRlRGV0YWlscyIsImFsbEF0dHJzIiwiZXhwZWN0ZWQiLCJvYnNlcnZlZCIsImRlcml2ZWQiLCJjdXJyZW50RGF0YSIsImRhdGEiLCJjb21wbGV0ZSIsImRlcml2ZUF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsInN1cHByZXNzQXR0cmlidXRlIiwiYWRkU3ViRmlsdGVyIiwiX2Rlcml2ZVRhYmxlIiwibmV3VGFibGUiLCJjcmVhdGVUYWJsZSIsInNhdmVUYWJsZXMiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGVJZCIsImZpbmQiLCJ0YWJsZU9iaiIsImV2ZXJ5Iiwib3B0aW9uTmFtZSIsIm9wdGlvblZhbHVlIiwidGFibGVzIiwic2hvcnRlc3RQYXRoVG9UYWJsZSIsIm90aGVyVGFibGUiLCJ2aXNpdGVkIiwiZGlzdGFuY2VzIiwicHJldlRhYmxlcyIsInZpc2l0IiwidGFyZ2V0SWQiLCJ0YXJnZXRUYWJsZSIsIm5laWdoYm9yTGlzdCIsImNvbmNhdCIsInBhcmVudFRhYmxlcyIsIm1hcCIsInBhcmVudFRhYmxlIiwiZmlsdGVyIiwibmVpZ2hib3JJZCIsInRvVmlzaXQiLCJzb3J0IiwiYSIsImIiLCJuZXh0SWQiLCJzaGlmdCIsImNoYWluIiwidW5zaGlmdCIsImFnZ3JlZ2F0ZSIsImV4cGFuZCIsImRlbGltaXRlciIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY2xvc2VkVHJhbnNwb3NlIiwiaW5kZXhlcyIsIm9wZW5UcmFuc3Bvc2UiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJjbGFzc2VzIiwicmVkdWNlIiwiYWdnIiwiaW5Vc2UiLCJzb21lIiwic291cmNlVGFibGVJZHMiLCJ0YXJnZXRUYWJsZUlkcyIsImRlbGV0ZSIsImV4ZWMiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJpdGVtIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQWdncmVnYXRlZFRhYmxlIiwiX2F0dHJpYnV0ZSIsIl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJyZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJfZGVoeWRyYXRlRnVuY3Rpb24iLCJkZXJpdmVSZWR1Y2VkQXR0cmlidXRlIiwiX3VwZGF0ZUl0ZW0iLCJvcmlnaW5hbFdyYXBwZWRJdGVtIiwibmV3V3JhcHBlZEl0ZW0iLCJ3cmFwcGVkUGFyZW50IiwiU3RyaW5nIiwiZXhpc3RpbmdJdGVtIiwibmV3SXRlbSIsInJlZHVjZWQiLCJEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfaW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9kdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlQXR0cmlidXRlIiwicGFyZW50SWQiLCJfZHVwbGljYXRlQXR0cmlidXRlcyIsInBhcmVudE5hbWUiLCJjb25uZWN0ZWRJdGVtcyIsImF0dHJOYW1lIiwiY29waWVkIiwiRXhwYW5kZWRUYWJsZSIsInNwbGl0IiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJHZW5lcmljQ2xhc3MiLCJjbGFzc0lkIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsImFubm90YXRpb25zIiwic2V0Q2xhc3NOYW1lIiwic2F2ZUNsYXNzZXMiLCJoYXNDdXN0b21OYW1lIiwiZ2V0SGFzaFRhYmxlIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm5ld0NsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIl9kZXJpdmVHZW5lcmljQ2xhc3MiLCJOb2RlQ2xhc3MiLCJlZGdlQ2xhc3NJZHMiLCJOb2RlV3JhcHBlciIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImVkZ2VDbGFzcyIsImlzU291cmNlIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJ0YWJsZUlkTGlzdCIsInJldmVyc2UiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsInRhcmdldEVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY3JlYXRlQ2xhc3MiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJub2RlQ2xhc3MiLCJlZGdlQ2xhc3NJZCIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0IiwiRWRnZUNsYXNzIiwiRWRnZVdyYXBwZXIiLCJfc3BsaXRUYWJsZUlkTGlzdCIsIm90aGVyQ2xhc3MiLCJub2RlVGFibGVJZExpc3QiLCJlZGdlVGFibGVJZCIsImVkZ2VUYWJsZUlkTGlzdCIsInN0YXRpY0V4aXN0cyIsInRhYmxlRGlzdGFuY2VzIiwic3RhcnRzV2l0aCIsImRpc3QiLCJNYXRoIiwiYWJzIiwibmV3Tm9kZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsInNpZGUiLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImNvbm5lY3RTb3VyY2UiLCJjb25uZWN0VGFyZ2V0IiwidG9nZ2xlRGlyZWN0aW9uIiwic3dhcHBlZERpcmVjdGlvbiIsInNraXBTYXZlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwiaXRlbUxpc3QiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsImFsbCIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0aGlzVGFibGVJZCIsInJlbWFpbmluZ1RhYmxlSWRzIiwiZWRnZXMiLCJlZGdlSWRzIiwiZWRnZUlkIiwic291cmNlTm9kZXMiLCJzb3VyY2VUYWJsZUlkIiwidGFyZ2V0Tm9kZXMiLCJ0YXJnZXRUYWJsZUlkIiwiSW5NZW1vcnlJbmRleCIsInRvUmF3T2JqZWN0IiwiaXRlckVudHJpZXMiLCJoYXNoIiwidmFsdWVMaXN0IiwiaXRlckhhc2hlcyIsIml0ZXJWYWx1ZUxpc3RzIiwiZ2V0VmFsdWVMaXN0IiwiYWRkVmFsdWUiLCJORVhUX0NMQVNTX0lEIiwiTkVYVF9UQUJMRV9JRCIsIk9yaWdyYXBoIiwiRmlsZVJlYWRlciIsImxvY2FsU3RvcmFnZSIsIm1pbWUiLCJkZWJ1ZyIsInBsdWdpbnMiLCJEQVRBTElCX0ZPUk1BVFMiLCJUQUJMRVMiLCJDTEFTU0VTIiwiSU5ERVhFUyIsIk5BTUVEX0ZVTkNUSU9OUyIsImlkZW50aXR5IiwicmF3SXRlbSIsImtleSIsIlR5cGVFcnJvciIsInBhcmVudFR5cGUiLCJkZWZhdWx0RmluaXNoIiwidGhpc1dyYXBwZWRJdGVtIiwib3RoZXJXcmFwcGVkSXRlbSIsImxlZnQiLCJyaWdodCIsInNoYTEiLCJKU09OIiwic3RyaW5naWZ5Iiwibm9vcCIsImh5ZHJhdGUiLCJoaWdoZXN0TnVtIiwibWF4IiwicGFyc2VJbnQiLCJtYXRjaCIsImRlaHlkcmF0ZSIsInN0b3JhZ2VLZXkiLCJUWVBFUyIsImNvbnRhaW5lciIsImdldEl0ZW0iLCJwYXJzZSIsInNldEl0ZW0iLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiVHlwZSIsInNlbGVjdG9yIiwibmV3VGFibGVPYmoiLCJuZXdDbGFzc09iaiIsImFkZEZpbGVBc1N0YXRpY1RhYmxlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJjb25zb2xlIiwid2FybiIsInRleHQiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJlcnIiLCJkZWxldGVBbGxDbGFzc2VzIiwiZ2V0Q2xhc3NEYXRhIiwicmVzdWx0cyIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luIiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLEdBQUk7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGFBQUwsR0FBcUIsRUFBckI7V0FDS0MsY0FBTCxHQUFzQixFQUF0Qjs7O0lBRUZDLEVBQUUsQ0FBRUMsU0FBRixFQUFhQyxRQUFi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
