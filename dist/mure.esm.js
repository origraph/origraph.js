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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TaW5nbGVQYXJlbnRNaXhpbi5qcyIsIi4uL3NyYy9UYWJsZXMvQWdncmVnYXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0V4cGFuZGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0ZhY2V0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuXG5jbGFzcyBUYWJsZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX211cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5fbXVyZSB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG11cmUgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5hdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcyA9IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cblxuICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5zdXBwcmVzc2VkQXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gISFvcHRpb25zLnN1cHByZXNzSW5kZXg7XG5cbiAgICB0aGlzLl9pbmRleFN1YkZpbHRlciA9IChvcHRpb25zLmluZGV4U3ViRmlsdGVyICYmIHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKG9wdGlvbnMuaW5kZXhTdWJGaWx0ZXIpKSB8fCBudWxsO1xuICAgIHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuYXR0cmlidXRlU3ViRmlsdGVycyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuX2F0dHJpYnV0ZXMsXG4gICAgICBkZXJpdmVkVGFibGVzOiB0aGlzLl9kZXJpdmVkVGFibGVzLFxuICAgICAgdXNlZEJ5Q2xhc3NlczogdGhpcy5fdXNlZEJ5Q2xhc3NlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZVN1YkZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhTdWJGaWx0ZXI6ICh0aGlzLl9pbmRleFN1YkZpbHRlciAmJiB0aGlzLl9tdXJlLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4U3ViRmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlU3ViRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVTdWJGaWx0ZXJzW2F0dHJdID0gdGhpcy5fbXVyZS5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBHZW5lcmljIGNhY2hpbmcgc3R1ZmY7IHRoaXMgaXNuJ3QganVzdCBmb3IgcGVyZm9ybWFuY2UuIENvbm5lY3RlZFRhYmxlJ3NcbiAgICAvLyBhbGdvcml0aG0gcmVxdWlyZXMgdGhhdCBpdHMgcGFyZW50IHRhYmxlcyBoYXZlIHByZS1idWlsdCBpbmRleGVzICh3ZVxuICAgIC8vIHRlY2huaWNhbGx5IGNvdWxkIGltcGxlbWVudCBpdCBkaWZmZXJlbnRseSwgYnV0IGl0IHdvdWxkIGJlIGV4cGVuc2l2ZSxcbiAgICAvLyByZXF1aXJlcyB0cmlja3kgbG9naWMsIGFuZCB3ZSdyZSBhbHJlYWR5IGJ1aWxkaW5nIGluZGV4ZXMgZm9yIHNvbWUgdGFibGVzXG4gICAgLy8gbGlrZSBBZ2dyZWdhdGVkVGFibGUgYW55d2F5KVxuICAgIGlmIChvcHRpb25zLnJlc2V0KSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQgPT09IHVuZGVmaW5lZCA/IEluZmluaXR5IDogb3B0aW9ucy5saW1pdDtcbiAgICAgIHlpZWxkICogT2JqZWN0LnZhbHVlcyh0aGlzLl9jYWNoZSkuc2xpY2UoMCwgbGltaXQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHlpZWxkICogYXdhaXQgdGhpcy5fYnVpbGRDYWNoZShvcHRpb25zKTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGU7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGFzeW5jIGJ1aWxkQ2FjaGUgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fY2FjaGVQcm9taXNlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9jYWNoZVByb21pc2UgPSBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGVtcCBvZiB0aGlzLl9idWlsZENhY2hlKCkpIHt9IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbiAgICAgICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgfVxuICB9XG4gIGFzeW5jIGNvdW50Um93cyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpKS5sZW5ndGg7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZShvcHRpb25zKTtcbiAgICBsZXQgY29tcGxldGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gaXRlcmF0aW9uIHdhcyBjYW5jZWxsZWQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGNvbXBsZXRlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKTtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3RlbXAudmFsdWUuaW5kZXhdID0gdGVtcC52YWx1ZTtcbiAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbXBsZXRlZCkge1xuICAgICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHdyYXBwZWRJdGVtLnJvdykge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBkZWxldGUgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICBsZXQga2VlcCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2luZGV4U3ViRmlsdGVyKSB7XG4gICAgICBrZWVwID0gdGhpcy5faW5kZXhTdWJGaWx0ZXIod3JhcHBlZEl0ZW0uaW5kZXgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSkge1xuICAgICAga2VlcCA9IGtlZXAgJiYgZnVuYyh3cmFwcGVkSXRlbS5yb3dbYXR0cl0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyB0aGlzLl9tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3Qgb3RoZXJJdGVtIG9mIG9wdGlvbnMuaXRlbXNUb0Nvbm5lY3QgfHwgW10pIHtcbiAgICAgIHdyYXBwZWRJdGVtLmNvbm5lY3RJdGVtKG90aGVySXRlbSk7XG4gICAgICBvdGhlckl0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleFN1YkZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIGFkZFN1YkZpbHRlciAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhTdWJGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGVJZCA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZUlkICYmIHRoaXMuX211cmUudGFibGVzW2V4aXN0aW5nVGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgc2hvcnRlc3RQYXRoVG9UYWJsZSAob3RoZXJUYWJsZSkge1xuICAgIC8vIERpamtzdHJhJ3MgYWxnb3JpdGhtLi4uXG4gICAgY29uc3QgdmlzaXRlZCA9IHt9O1xuICAgIGNvbnN0IGRpc3RhbmNlcyA9IHt9O1xuICAgIGNvbnN0IHByZXZUYWJsZXMgPSB7fTtcbiAgICBjb25zdCB2aXNpdCA9IHRhcmdldElkID0+IHtcbiAgICAgIGNvbnN0IHRhcmdldFRhYmxlID0gdGhpcy5fbXVyZS50YWJsZXNbdGFyZ2V0SWRdO1xuICAgICAgLy8gT25seSBjaGVjayB0aGUgdW52aXNpdGVkIGRlcml2ZWQgYW5kIHBhcmVudCB0YWJsZXNcbiAgICAgIGNvbnN0IG5laWdoYm9yTGlzdCA9IE9iamVjdC5rZXlzKHRhcmdldFRhYmxlLl9kZXJpdmVkVGFibGVzKVxuICAgICAgICAuY29uY2F0KHRhcmdldFRhYmxlLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUudGFibGVJZCkpXG4gICAgICAgIC5maWx0ZXIodGFibGVJZCA9PiAhdmlzaXRlZFt0YWJsZUlkXSk7XG4gICAgICAvLyBDaGVjayBhbmQgYXNzaWduIChvciB1cGRhdGUpIHRlbnRhdGl2ZSBkaXN0YW5jZXMgdG8gZWFjaCBuZWlnaGJvclxuICAgICAgZm9yIChjb25zdCBuZWlnaGJvcklkIG9mIG5laWdoYm9yTGlzdCkge1xuICAgICAgICBpZiAoZGlzdGFuY2VzW25laWdoYm9ySWRdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlzdGFuY2VzW3RhcmdldElkXSArIDEgPCBkaXN0YW5jZXNbbmVpZ2hib3JJZF0pIHtcbiAgICAgICAgICBkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPSBkaXN0YW5jZXNbdGFyZ2V0SWRdICsgMTtcbiAgICAgICAgICBwcmV2VGFibGVzW25laWdoYm9ySWRdID0gdGFyZ2V0SWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIHRoaXMgdGFibGUgaXMgb2ZmaWNpYWxseSB2aXNpdGVkOyB0YWtlIGl0IG91dCBvZiB0aGUgcnVubmluZ1xuICAgICAgLy8gZm9yIGZ1dHVyZSB2aXNpdHMgLyBjaGVja3NcbiAgICAgIHZpc2l0ZWRbdGFyZ2V0SWRdID0gdHJ1ZTtcbiAgICAgIGRlbGV0ZSBkaXN0YW5jZXNbdGFyZ2V0SWRdO1xuICAgIH07XG5cbiAgICAvLyBTdGFydCB3aXRoIHRoaXMgdGFibGVcbiAgICBwcmV2VGFibGVzW3RoaXMudGFibGVJZF0gPSBudWxsO1xuICAgIGRpc3RhbmNlc1t0aGlzLnRhYmxlSWRdID0gMDtcbiAgICBsZXQgdG9WaXNpdCA9IE9iamVjdC5rZXlzKGRpc3RhbmNlcyk7XG4gICAgd2hpbGUgKHRvVmlzaXQubGVuZ3RoID4gMCkge1xuICAgICAgLy8gVmlzaXQgdGhlIG5leHQgdGFibGUgdGhhdCBoYXMgdGhlIHNob3J0ZXN0IGRpc3RhbmNlXG4gICAgICB0b1Zpc2l0LnNvcnQoKGEsIGIpID0+IGRpc3RhbmNlc1thXSAtIGRpc3RhbmNlc1tiXSk7XG4gICAgICBsZXQgbmV4dElkID0gdG9WaXNpdC5zaGlmdCgpO1xuICAgICAgaWYgKG5leHRJZCA9PT0gb3RoZXJUYWJsZS50YWJsZUlkKSB7XG4gICAgICAgIC8vIEZvdW5kIG90aGVyVGFibGUhIFNlbmQgYmFjayB0aGUgY2hhaW4gb2YgY29ubmVjdGVkIHRhYmxlc1xuICAgICAgICBjb25zdCBjaGFpbiA9IFtdO1xuICAgICAgICB3aGlsZSAocHJldlRhYmxlc1tuZXh0SWRdICE9PSBudWxsKSB7XG4gICAgICAgICAgY2hhaW4udW5zaGlmdCh0aGlzLl9tdXJlLnRhYmxlc1tuZXh0SWRdKTtcbiAgICAgICAgICBuZXh0SWQgPSBwcmV2VGFibGVzW25leHRJZF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoYWluO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVmlzaXQgdGhlIHRhYmxlXG4gICAgICAgIHZpc2l0KG5leHRJZCk7XG4gICAgICAgIHRvVmlzaXQgPSBPYmplY3Qua2V5cyhkaXN0YW5jZXMpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBXZSBkaWRuJ3QgZmluZCBpdDsgdGhlcmUncyBubyBjb25uZWN0aW9uXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgZGVsaW1pdGVyXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZSA9PT0gbnVsbCA/IHdyYXBwZWRJdGVtLmluZGV4IDogd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKHsgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJyB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9tdXJlLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDAgfHwgdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdFRhYmxlO1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aWVyZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBBZ2dyZWdhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLl9kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqYnO1xuICB9XG4gIGRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUgKGF0dHIsIGZ1bmMpIHtcbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfdXBkYXRlSXRlbSAob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHNvIHRoYXQgQWdncmVnYXRlZFRhYmxlIGNhbiB0YWtlIGFkdmFudGFnZVxuICAgIC8vIG9mIHRoZSBwYXJ0aWFsbHktYnVpbHQgY2FjaGUgYXMgaXQgZ29lcywgYW5kIHBvc3Rwb25lIGZpbmlzaGluZyBpdGVtc1xuICAgIC8vIHVudGlsIGFmdGVyIHRoZSBwYXJlbnQgdGFibGUgaGFzIGJlZW4gZnVsbHkgaXRlcmF0ZWRcblxuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuX2l0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt3cmFwcGVkSXRlbS5pbmRleF0gPSB3cmFwcGVkSXRlbTtcbiAgICAgIC8vIEdvIGFoZWFkIGFuZCB5aWVsZCB0aGUgdW5maW5pc2hlZCBpdGVtOyB0aGlzIG1ha2VzIGl0IHBvc3NpYmxlIGZvclxuICAgICAgLy8gY2xpZW50IGFwcHMgdG8gYmUgbW9yZSByZXNwb25zaXZlIGFuZCByZW5kZXIgcGFydGlhbCByZXN1bHRzLCBidXQgYWxzb1xuICAgICAgLy8gbWVhbnMgdGhhdCB0aGV5IG5lZWQgdG8gd2F0Y2ggZm9yIHdyYXBwZWRJdGVtLm9uKCd1cGRhdGUnKSBldmVudHNcbiAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgIH1cblxuICAgIC8vIFNlY29uZCBwYXNzOiBub3cgdGhhdCB3ZSd2ZSBjb21wbGV0ZWQgdGhlIGZ1bGwgaXRlcmF0aW9uIG9mIHRoZSBwYXJlbnRcbiAgICAvLyB0YWJsZSwgd2UgY2FuIGZpbmlzaCBlYWNoIGl0ZW1cbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIHRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgaWYgKCF0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBXZSB3ZXJlIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKGV4aXN0aW5nSXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKG5ld0l0ZW0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHN1cGVyLmdldEF0dHJpYnV0ZURldGFpbHMoKTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ucmVkdWNlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQWdncmVnYXRlZFRhYmxlO1xuIiwiY29uc3QgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuZHVwbGljYXRlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgfVxuICAgIF90b1Jhd09iamVjdCAoKSB7XG4gICAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICAgIG9iai5kdXBsaWNhdGVkQXR0cmlidXRlcyA9IHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgZHVwbGljYXRlQXR0cmlidXRlIChwYXJlbnRJZCwgYXR0cmlidXRlKSB7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gPSB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gfHwgW107XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0ucHVzaChhdHRyaWJ1dGUpO1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBfZHVwbGljYXRlQXR0cmlidXRlcyAod3JhcHBlZEl0ZW0pIHtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgcGFyZW50TmFtZSA9IHRoaXMuX211cmUudGFibGVzW3BhcmVudElkXS5uYW1lO1xuICAgICAgICB3cmFwcGVkSXRlbS5yb3dbYCR7cGFyZW50TmFtZX0uJHthdHRyfWBdID0gd3JhcHBlZEl0ZW0uY29ubmVjdGVkSXRlbXNbcGFyZW50SWRdWzBdLnJvd1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gICAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgICBjb25zdCBhbGxBdHRycyA9IHN1cGVyLmdldEF0dHJpYnV0ZURldGFpbHMoKTtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgYXR0ck5hbWUgPSBgJHt0aGlzLl9tdXJlLnRhYmxlc1twYXJlbnRJZF0ubmFtZX0uJHthdHRyfWA7XG4gICAgICAgIGFsbEF0dHJzW2F0dHJOYW1lXSA9IGFsbEF0dHJzW2F0dHJOYW1lXSB8fCB7IG5hbWU6IGF0dHJOYW1lIH07XG4gICAgICAgIGFsbEF0dHJzW2F0dHJOYW1lXS5jb3BpZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFsbEF0dHJzO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcbmltcG9ydCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gZnJvbSAnLi9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluKFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuZGVsaW1pdGVyID0gb3B0aW9ucy5kZWxpbWl0ZXIgfHwgJywnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpCc7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCB2YWx1ZXMgPSAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSB8fCAnJykuc3BsaXQodGhpcy5kZWxpbWl0ZXIpO1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICAgICAgY29uc3Qgcm93ID0ge307XG4gICAgICAgIHJvd1t0aGlzLl9hdHRyaWJ1dGVdID0gdmFsdWU7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3csXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKG5ld0l0ZW0pO1xuICAgICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlID09PSB1bmRlZmluZWQgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBgWyR7dGhpcy5fdmFsdWV9XWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBpZiAodGhpcy5hdHRyaWJ1dGUgPT09IG51bGwgJiYgd3JhcHBlZFBhcmVudC5pbmRleCA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgLy8gRmFjZXRpbmcgYnkgaW5kZXggdHJhbnNmb3JtcyBhIHJvdyBpbnRvIGEgdGFibGVcbiAgICAgICAgZm9yIChjb25zdCBbIGNoaWxkSW5kZXgsIGNoaWxkUm93IF0gb2YgT2JqZWN0LmVudHJpZXMod3JhcHBlZFBhcmVudC5yb3cpKSB7XG4gICAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgICAgaW5kZXg6IGNoaWxkSW5kZXgsXG4gICAgICAgICAgICByb3c6IGNoaWxkUm93LFxuICAgICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fYXR0cmlidXRlICE9PSBudWxsICYmIHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gZnJvbSAnLi9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbihUYWJsZSkge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS5uYW1lKS5qb2luKCfiqK8nKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgLy8gU3BpbiB0aHJvdWdoIGFsbCBvZiB0aGUgcGFyZW50VGFibGVzIHNvIHRoYXQgdGhlaXIgX2NhY2hlIGlzIHByZS1idWlsdFxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICBhd2FpdCBwYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG4gICAgfVxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGUpKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZVtpbmRleF0pKSB7XG4gICAgICAgIC8vIE5vIG1hdGNoIGluIG9uZSBvZiB0aGUgb3RoZXIgdGFibGVzOyBvbWl0IHRoaXMgaXRlbVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIFRPRE86IGFkZCBlYWNoIHBhcmVudCB0YWJsZXMnIGtleXMgYXMgYXR0cmlidXRlIHZhbHVlc1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IHBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSlcbiAgICAgIH0pO1xuICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlcyhuZXdJdGVtKTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLl9tdXJlIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBfbXVyZSwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb24gPSBvcHRpb25zLmFubm90YXRpb24gfHwgJyc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uOiB0aGlzLmFubm90YXRpb25cbiAgICB9O1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgIT09IG51bGw7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fCB0aGlzLnRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0SGFzaFRhYmxlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIF9kZXJpdmVHZW5lcmljQ2xhc3MgKG5ld1RhYmxlKSB7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnXG4gICAgfSk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgICB0aGlzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRocyA9IHt9O1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgcHJlcFNob3J0ZXN0RWRnZVBhdGggKGVkZ2VDbGFzc0lkKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW2VkZ2VDbGFzc0lkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbZWRnZUNsYXNzSWRdO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBlZGdlVGFibGUgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRdLnRhYmxlO1xuICAgICAgY29uc3QgaWRMaXN0ID0gW107XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRoaXMudGFibGUuc2hvcnRlc3RQYXRoVG9UYWJsZShlZGdlVGFibGUpKSB7XG4gICAgICAgIGlkTGlzdC5wdXNoKHRhYmxlLnRhYmxlSWQpO1xuICAgICAgICAvLyBTcGluIHRocm91Z2ggdGhlIHRhYmxlIHRvIG1ha2Ugc3VyZSBhbGwgaXRzIHJvd3MgYXJlIHdyYXBwZWQgYW5kIGNvbm5lY3RlZFxuICAgICAgICBhd2FpdCB0YWJsZS5idWlsZENhY2hlKCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1tlZGdlQ2xhc3NJZF0gPSBpZExpc3Q7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICAvLyAob3IgYSBmbG9hdGluZyBlZGdlIGlmIGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkIGlzIG51bGwpXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZWRnZUNsYXNzLmRpcmVjdGVkO1xuICAgICAgZWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgbGV0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIG5vdyB3ZSBrbm93IGhvdyB0byBzZXQgc291cmNlIC8gdGFyZ2V0IGlkc1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSB0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIC8vIERlbGV0ZSBlYWNoIG9mIHRoZSBlZGdlIGNsYXNzZXNcbiAgICAgIHNvdXJjZUVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICAgIHRhcmdldEVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICB9XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICBkZWxldGUgb3B0aW9ucy5jbGFzc0lkO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBkaXJlY3RlZCwgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgY29uc3QgdGhpc0hhc2ggPSB0aGlzLmdldEhhc2hUYWJsZShhdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLmdldEhhc2hUYWJsZShvdGhlckF0dHJpYnV0ZSk7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzSGFzaC5jb25uZWN0KFtvdGhlckhhc2hdKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIGRpcmVjdGVkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZFxuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdFZGdlQ2xhc3M7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBkaXNjb25uZWN0QWxsRWRnZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyB0aGlzLl9tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIF9waWNrRWRnZVRhYmxlIChvdGhlckNsYXNzKSB7XG4gICAgbGV0IGVkZ2VUYWJsZTtcbiAgICBsZXQgY2hhaW4gPSB0aGlzLnRhYmxlLnNob3J0ZXN0UGF0aFRvVGFibGUob3RoZXJDbGFzcy50YWJsZSk7XG4gICAgaWYgKGNoYWluID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZGVybHlpbmcgdGFibGUgY2hhaW4gYmV0d2VlbiBlZGdlIGFuZCBub2RlIGNsYXNzZXMgaXMgYnJva2VuYCk7XG4gICAgfSBlbHNlIGlmIChjaGFpbi5sZW5ndGggPD0gMikge1xuICAgICAgLy8gV2VpcmQgY29ybmVyIGNhc2Ugd2hlcmUgd2UncmUgdHJ5aW5nIHRvIGNyZWF0ZSBhbiBlZGdlIGJldHdlZW5cbiAgICAgIC8vIGFkamFjZW50IG9yIGlkZW50aWNhbCB0YWJsZXMuLi4gY3JlYXRlIGEgQ29ubmVjdGVkVGFibGVcbiAgICAgIGVkZ2VUYWJsZSA9IHRoaXMudGFibGUuY29ubmVjdChvdGhlckNsYXNzLnRhYmxlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIGEgdGFibGUgaW4gdGhlIG1pZGRsZTsgcHJpb3JpdGl6ZSBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBjaGFpbiA9IGNoYWluLnNsaWNlKDEsIGNoYWluLmxlbmd0aCAtIDEpLm1hcCgodGFibGUsIGRpc3QpID0+IHtcbiAgICAgICAgc3RhdGljRXhpc3RzID0gc3RhdGljRXhpc3RzIHx8IHRhYmxlLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIHJldHVybiB7IHRhYmxlLCBkaXN0IH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgY2hhaW4gPSBjaGFpbi5maWx0ZXIoKHsgdGFibGUgfSkgPT4ge1xuICAgICAgICAgIHJldHVybiB0YWJsZS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVkZ2VUYWJsZSA9IGNoYWluWzBdLnRhYmxlO1xuICAgIH1cbiAgICByZXR1cm4gZWRnZVRhYmxlO1xuICB9XG4gIGFzeW5jIHByZXBTaG9ydGVzdFNvdXJjZVBhdGggKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aDtcbiAgICB9IGVsc2UgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBzb3VyY2VUYWJsZSA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdLnRhYmxlO1xuICAgICAgY29uc3QgaWRMaXN0ID0gW107XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRoaXMudGFibGUuc2hvcnRlc3RQYXRoVG9UYWJsZShzb3VyY2VUYWJsZSkpIHtcbiAgICAgICAgaWRMaXN0LnB1c2godGFibGUudGFibGVJZCk7XG4gICAgICAgIC8vIFNwaW4gdGhyb3VnaCB0aGUgdGFibGUgdG8gbWFrZSBzdXJlIGFsbCBpdHMgcm93cyBhcmUgd3JhcHBlZCBhbmQgY29ubmVjdGVkXG4gICAgICAgIGF3YWl0IHRhYmxlLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aCA9IGlkTGlzdDtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGg7XG4gICAgfVxuICB9XG4gIGFzeW5jIHByZXBTaG9ydGVzdFRhcmdldFBhdGggKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aDtcbiAgICB9IGVsc2UgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0YXJnZXRUYWJsZSA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLnRhYmxlO1xuICAgICAgY29uc3QgaWRMaXN0ID0gW107XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRoaXMudGFibGUuc2hvcnRlc3RQYXRoVG9UYWJsZSh0YXJnZXRUYWJsZSkpIHtcbiAgICAgICAgaWRMaXN0LnB1c2godGFibGUudGFibGVJZCk7XG4gICAgICAgIC8vIFNwaW4gdGhyb3VnaCB0aGUgdGFibGUgdG8gbWFrZSBzdXJlIGFsbCBpdHMgcm93cyBhcmUgd3JhcHBlZCBhbmQgY29ubmVjdGVkXG4gICAgICAgIGF3YWl0IHRhYmxlLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aCA9IGlkTGlzdDtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGg7XG4gICAgfVxuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGVsZXRlKCk7XG4gICAgdGVtcC50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgZGVsZXRlIHRlbXAuY2xhc3NJZDtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IGVkZ2VUYWJsZSA9IHRoaXMuX3BpY2tFZGdlVGFibGUoc291cmNlQ2xhc3MpO1xuICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGUudGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IHRlbXAuc291cmNlQ2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWRcbiAgICAgIH0pO1xuICAgICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0ZW1wLnRhcmdldENsYXNzSWQgJiYgdGVtcC5zb3VyY2VDbGFzc0lkICE9PSB0ZW1wLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgICBjb25zdCBlZGdlVGFibGUgPSB0aGlzLl9waWNrRWRnZVRhYmxlKHRhcmdldENsYXNzKTtcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlLnRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogdGVtcC50YXJnZXRDbGFzc0lkXG4gICAgICB9KTtcbiAgICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgZGlyZWN0aW9uLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pIHtcbiAgICBpZiAoZGlyZWN0aW9uKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGRpcmVjdGlvbiAhPT0gJ3NvdXJjZScgJiYgZGlyZWN0aW9uICE9PSAndGFyZ2V0Jykge1xuICAgICAgZGlyZWN0aW9uID0gdGhpcy50YXJnZXRDbGFzc0lkID09PSBudWxsID8gJ3RhcmdldCcgOiAnc291cmNlJztcbiAgICB9XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldCh7IG5vZGVDbGFzcywgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jb25uZWN0U291cmNlKHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgdG9nZ2xlTm9kZURpcmVjdGlvbiAoc291cmNlQ2xhc3NJZCkge1xuICAgIGlmICghc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3Qgc3dhcCB0byB1bmNvbm5lY3RlZCBjbGFzcyBpZDogJHtzb3VyY2VDbGFzc0lkfWApO1xuICAgICAgICB9XG4gICAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IHRlbXA7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBjb25uZWN0U291cmNlICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNraXBTYXZlID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMuZ2V0SGFzaFRhYmxlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MuZ2V0SGFzaFRhYmxlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSk7XG5cbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc2tpcFNhdmUgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy5nZXRIYXNoVGFibGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gdGFyZ2V0Q2xhc3MudGFibGUgOiB0YXJnZXRDbGFzcy5nZXRIYXNoVGFibGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKTtcblxuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGlzY29ubmVjdFNvdXJjZSAoeyBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdTb3VyY2VDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgICBkZWxldGUgZXhpc3RpbmdTb3VyY2VDbGFzcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aDtcbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKHsgc2tpcFNhdmUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBjb25zdCBleGlzdGluZ1RhcmdldENsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nVGFyZ2V0Q2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1RhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGg7XG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIHRoaXMudGFibGUgPSBvcHRpb25zLnRhYmxlO1xuICAgIGlmICh0aGlzLmluZGV4ID09PSB1bmRlZmluZWQgfHwgIXRoaXMudGFibGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggYW5kIHRhYmxlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLmNsYXNzT2JqID0gb3B0aW9ucy5jbGFzc09iaiB8fCBudWxsO1xuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IG9wdGlvbnMuY29ubmVjdGVkSXRlbXMgfHwge307XG4gIH1cbiAgY29ubmVjdEl0ZW0gKGl0ZW0pIHtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gPSB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gfHwgW107XG4gICAgaWYgKHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5pbmRleE9mKGl0ZW0pID09PSAtMSkge1xuICAgICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLnB1c2goaXRlbSk7XG4gICAgfVxuICB9XG4gIGRpc2Nvbm5lY3QgKCkge1xuICAgIGZvciAoY29uc3QgaXRlbUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNvbm5lY3RlZEl0ZW1zKSkge1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1MaXN0KSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gKGl0ZW0uY29ubmVjdGVkSXRlbXNbdGhpcy50YWJsZS50YWJsZUlkXSB8fCBbXSkuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgIGl0ZW0uY29ubmVjdGVkSXRlbXNbdGhpcy50YWJsZS50YWJsZUlkXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSB7fTtcbiAgfVxuICAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW3RhYmxlSWRzWzBdXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRoaXNUYWJsZUlkID0gdGFibGVJZHNbMF07XG4gICAgICBjb25zdCByZW1haW5pbmdUYWJsZUlkcyA9IHRhYmxlSWRzLnNsaWNlKDEpO1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuY29ubmVjdGVkSXRlbXNbdGhpc1RhYmxlSWRdIHx8IFtdKSB7XG4gICAgICAgIHlpZWxkICogaXRlbS5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzICh7IGxpbWl0ID0gSW5maW5pdHksIGVkZ2VJZHMgPSB0aGlzLmNsYXNzT2JqLmVkZ2VDbGFzc0lkcyB9ID0ge30pIHtcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyhlZGdlSWRzKSkge1xuICAgICAgY29uc3QgdGFibGVJZENoYWluID0gYXdhaXQgdGhpcy5jbGFzc09iai5wcmVwU2hvcnRlc3RFZGdlUGF0aChlZGdlQ2xhc3NJZCk7XG4gICAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRDaGFpbik7XG4gICAgICBsZXQgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIHdoaWxlICghdGVtcC5kb25lICYmIGkgPCBsaW1pdCkge1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgICBpKys7XG4gICAgICAgIHRlbXAgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgICB9XG4gICAgICBpZiAoaSA+PSBsaW1pdCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBzb3VyY2VOb2RlcyAoeyBsaW1pdCA9IEluZmluaXR5IH0gPSB7fSkge1xuICAgIGNvbnN0IHRhYmxlSWRDaGFpbiA9IGF3YWl0IHRoaXMuY2xhc3NPYmoucHJlcFNob3J0ZXN0U291cmNlUGF0aCgpO1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZENoYWluKTtcbiAgICBsZXQgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICBsZXQgaSA9IDA7XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUgJiYgaSA8IGxpbWl0KSB7XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgaSsrO1xuICAgICAgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAoeyBsaW1pdCA9IEluZmluaXR5IH0gPSB7fSkge1xuICAgIGNvbnN0IHRhYmxlSWRDaGFpbiA9IGF3YWl0IHRoaXMuY2xhc3NPYmoucHJlcFNob3J0ZXN0VGFyZ2V0UGF0aCgpO1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZENoYWluKTtcbiAgICBsZXQgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICBsZXQgaSA9IDA7XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUgJiYgaSA8IGxpbWl0KSB7XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgaSsrO1xuICAgICAgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJjbGFzcyBJbk1lbW9yeUluZGV4IHtcbiAgY29uc3RydWN0b3IgKHsgZW50cmllcyA9IHt9LCBjb21wbGV0ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXM7XG4gICAgdGhpcy5jb21wbGV0ZSA9IGNvbXBsZXRlO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzO1xuICB9XG4gIGFzeW5jICogaXRlckVudHJpZXMgKCkge1xuICAgIGZvciAoY29uc3QgW2hhc2gsIHZhbHVlTGlzdF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgeyBoYXNoLCB2YWx1ZUxpc3QgfTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVySGFzaGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IGhhc2ggb2YgT2JqZWN0LmtleXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgaGFzaDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyVmFsdWVMaXN0cyAoKSB7XG4gICAgZm9yIChjb25zdCB2YWx1ZUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB2YWx1ZUxpc3Q7XG4gICAgfVxuICB9XG4gIGFzeW5jIGdldFZhbHVlTGlzdCAoaGFzaCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXNbaGFzaF0gfHwgW107XG4gIH1cbiAgYXN5bmMgYWRkVmFsdWUgKGhhc2gsIHZhbHVlKSB7XG4gICAgLy8gVE9ETzogYWRkIHNvbWUga2luZCBvZiB3YXJuaW5nIGlmIHRoaXMgaXMgZ2V0dGluZyBiaWc/XG4gICAgdGhpcy5lbnRyaWVzW2hhc2hdID0gYXdhaXQgdGhpcy5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgaWYgKHRoaXMuZW50cmllc1toYXNoXS5pbmRleE9mKHZhbHVlKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuZW50cmllc1toYXNoXS5wdXNoKHZhbHVlKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluTWVtb3J5SW5kZXg7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IHNoYTEgZnJvbSAnc2hhMSc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuL1RhYmxlcy9UYWJsZXMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcbmltcG9ydCAqIGFzIElOREVYRVMgZnJvbSAnLi9JbmRleGVzL0luZGV4ZXMuanMnO1xuXG5sZXQgTkVYVF9DTEFTU19JRCA9IDE7XG5sZXQgTkVYVF9UQUJMRV9JRCA9IDE7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBtdXJlLmRlYnVnIHRvIHRydWUgdG8gZGVidWcgc3RyZWFtc1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UQUJMRVMgPSBUQUJMRVM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHsgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbTsgfSxcbiAgICAgIGtleTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKCF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICAhd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR3JhbmRwYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIHlpZWxkIHtcbiAgICAgICAgICBsZWZ0OiB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICByaWdodDogb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgICAgIG5vb3A6ICgpID0+IHt9XG4gICAgfTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMudGFibGVzID0gdGhpcy5oeWRyYXRlKCdtdXJlX3RhYmxlcycsIHRoaXMuVEFCTEVTKTtcbiAgICBORVhUX1RBQkxFX0lEID0gT2JqZWN0LmtleXModGhpcy50YWJsZXMpXG4gICAgICAucmVkdWNlKChoaWdoZXN0TnVtLCB0YWJsZUlkKSA9PiB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heChoaWdoZXN0TnVtLCBwYXJzZUludCh0YWJsZUlkLm1hdGNoKC90YWJsZShcXGQqKS8pWzFdKSk7XG4gICAgICB9LCAwKSArIDE7XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBvdXIgY2xhc3Mgc3BlY2lmaWNhdGlvbnNcbiAgICB0aGlzLmNsYXNzZXMgPSB0aGlzLmh5ZHJhdGUoJ211cmVfY2xhc3NlcycsIHRoaXMuQ0xBU1NFUyk7XG4gICAgTkVYVF9DTEFTU19JRCA9IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NlcylcbiAgICAgIC5yZWR1Y2UoKGhpZ2hlc3ROdW0sIGNsYXNzSWQpID0+IHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KGhpZ2hlc3ROdW0sIHBhcnNlSW50KGNsYXNzSWQubWF0Y2goL2NsYXNzKFxcZCopLylbMV0pKTtcbiAgICAgIH0sIDApICsgMTtcbiAgfVxuXG4gIHNhdmVUYWJsZXMgKCkge1xuICAgIHRoaXMuZGVoeWRyYXRlKCdtdXJlX3RhYmxlcycsIHRoaXMudGFibGVzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3RhYmxlVXBkYXRlJyk7XG4gIH1cbiAgc2F2ZUNsYXNzZXMgKCkge1xuICAgIHRoaXMuZGVoeWRyYXRlKCdtdXJlX2NsYXNzZXMnLCB0aGlzLmNsYXNzZXMpO1xuICAgIHRoaXMudHJpZ2dlcignY2xhc3NVcGRhdGUnKTtcbiAgfVxuXG4gIGh5ZHJhdGUgKHN0b3JhZ2VLZXksIFRZUEVTKSB7XG4gICAgbGV0IGNvbnRhaW5lciA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oc3RvcmFnZUtleSk7XG4gICAgY29udGFpbmVyID0gY29udGFpbmVyID8gSlNPTi5wYXJzZShjb250YWluZXIpIDoge307XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgY29uc3QgdHlwZSA9IHZhbHVlLnR5cGU7XG4gICAgICBkZWxldGUgdmFsdWUudHlwZTtcbiAgICAgIHZhbHVlLm11cmUgPSB0aGlzO1xuICAgICAgY29udGFpbmVyW2tleV0gPSBuZXcgVFlQRVNbdHlwZV0odmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gY29udGFpbmVyO1xuICB9XG4gIGRlaHlkcmF0ZSAoc3RvcmFnZUtleSwgY29udGFpbmVyKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvbnRhaW5lcikpIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgICAgcmVzdWx0W2tleV0udHlwZSA9IHZhbHVlLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKHN0b3JhZ2VLZXksIEpTT04uc3RyaW5naWZ5KHJlc3VsdCkpO1xuICAgIH1cbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIG5ldyBGdW5jdGlvbihgcmV0dXJuICR7c3RyaW5naWZpZWRGdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgfVxuICBkZWh5ZHJhdGVGdW5jdGlvbiAoZnVuYykge1xuICAgIGxldCBzdHJpbmdpZmllZEZ1bmMgPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgLy8gSXN0YW5idWwgYWRkcyBzb21lIGNvZGUgdG8gZnVuY3Rpb25zIGZvciBjb21wdXRpbmcgY292ZXJhZ2UsIHRoYXQgZ2V0c1xuICAgIC8vIGluY2x1ZGVkIGluIHRoZSBzdHJpbmdpZmljYXRpb24gcHJvY2VzcyBkdXJpbmcgdGVzdGluZy4gU2VlOlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3R3YXJsb3N0L2lzdGFuYnVsL2lzc3Vlcy8zMTAjaXNzdWVjb21tZW50LTI3NDg4OTAyMlxuICAgIHN0cmluZ2lmaWVkRnVuYyA9IHN0cmluZ2lmaWVkRnVuYy5yZXBsYWNlKC9jb3ZfKC4rPylcXCtcXCtbLDtdPy9nLCAnJyk7XG4gICAgcmV0dXJuIHN0cmluZ2lmaWVkRnVuYztcbiAgfVxuXG4gIGNyZWF0ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zLnRhYmxlSWQpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7TkVYVF9UQUJMRV9JRH1gO1xuICAgICAgTkVYVF9UQUJMRV9JRCArPSAxO1xuICAgIH1cbiAgICBjb25zdCBUeXBlID0gdGhpcy5UQUJMRVNbb3B0aW9ucy50eXBlXTtcbiAgICBkZWxldGUgb3B0aW9ucy50eXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdO1xuICB9XG4gIGNyZWF0ZUNsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYGVtcHR5YCB9KSB7XG4gICAgaWYgKCFvcHRpb25zLmNsYXNzSWQpIHtcbiAgICAgIG9wdGlvbnMuY2xhc3NJZCA9IGBjbGFzcyR7TkVYVF9DTEFTU19JRH1gO1xuICAgICAgTkVYVF9DTEFTU19JRCArPSAxO1xuICAgIH1cbiAgICBjb25zdCBUeXBlID0gdGhpcy5DTEFTU0VTW29wdGlvbnMudHlwZV07XG4gICAgZGVsZXRlIG9wdGlvbnMudHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdID0gbmV3IFR5cGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG5cbiAgbmV3VGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZU9iaiA9IHRoaXMuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5zYXZlVGFibGVzKCk7XG4gICAgcmV0dXJuIG5ld1RhYmxlT2JqO1xuICB9XG4gIG5ld0NsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3Q2xhc3NPYmogPSB0aGlzLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gbmV3Q2xhc3NPYmo7XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNUYWJsZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHk7IHRyeSBhZGREeW5hbWljVGFibGUoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY1RhYmxlKHtcbiAgICAgIG5hbWU6IGZpbGVPYmoubmFtZSxcbiAgICAgIGV4dGVuc2lvbjogZXh0ZW5zaW9uT3ZlcnJpZGUgfHwgbWltZS5leHRlbnNpb24oZmlsZU9iai50eXBlKSxcbiAgICAgIHRleHRcbiAgICB9KTtcbiAgfVxuICBhZGRTdHJpbmdBc1N0YXRpY1RhYmxlICh7IG5hbWUsIGV4dGVuc2lvbiA9ICd0eHQnLCB0ZXh0IH0pIHtcbiAgICBsZXQgZGF0YSwgYXR0cmlidXRlcztcbiAgICBpZiAodGhpcy5EQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgZGF0YSA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZSh7IG5hbWUsIGRhdGEsIGF0dHJpYnV0ZXMgfSk7XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLm5ld1RhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHsgdGhpcy50YWJsZXNbdGFibGVJZF0uZGVsZXRlKCk7IH0gY2F0Y2ggKGVycikge31cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZGVsZXRlQWxsQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzT2JqLmRlbGV0ZSgpO1xuICAgIH1cbiAgfVxuICBnZXRDbGFzc0RhdGEgKCkge1xuICAgIGNvbnN0IHJlc3VsdHMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgcmVzdWx0c1tjbGFzc09iai5jbGFzc0lkXSA9IGNsYXNzT2JqLmN1cnJlbnREYXRhO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG11cmUgPSBuZXcgTXVyZSh3aW5kb3cuRmlsZVJlYWRlciwgd2luZG93LmxvY2FsU3RvcmFnZSk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJvZmYiLCJpbmRleCIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiZm9yRWFjaCIsInNldFRpbWVvdXQiLCJhcHBseSIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsIk9iamVjdCIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiVGFibGUiLCJvcHRpb25zIiwiX211cmUiLCJtdXJlIiwidGFibGVJZCIsIkVycm9yIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleFN1YkZpbHRlciIsImluZGV4U3ViRmlsdGVyIiwiX2F0dHJpYnV0ZVN1YkZpbHRlcnMiLCJhdHRyaWJ1dGVTdWJGaWx0ZXJzIiwiX3RvUmF3T2JqZWN0IiwicmVzdWx0IiwiX2F0dHJpYnV0ZXMiLCJ1c2VkQnlDbGFzc2VzIiwiX3VzZWRCeUNsYXNzZXMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsImZ1bmMiLCJuYW1lIiwiaXRlcmF0ZSIsInJlc2V0IiwiX2NhY2hlIiwibGltaXQiLCJ1bmRlZmluZWQiLCJJbmZpbml0eSIsInZhbHVlcyIsInNsaWNlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlIiwiZGVyaXZlZFRhYmxlIiwiYnVpbGRDYWNoZSIsIl9jYWNoZVByb21pc2UiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNvdW50Um93cyIsImtleXMiLCJsZW5ndGgiLCJpdGVyYXRvciIsIl9pdGVyYXRlIiwiY29tcGxldGVkIiwibmV4dCIsImRvbmUiLCJfZmluaXNoSXRlbSIsIndyYXBwZWRJdGVtIiwicm93Iiwia2VlcCIsImRpc2Nvbm5lY3QiLCJfd3JhcCIsInRhYmxlIiwiY2xhc3NPYmoiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwib3RoZXJJdGVtIiwiaXRlbXNUb0Nvbm5lY3QiLCJjb25uZWN0SXRlbSIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImNvbXBsZXRlIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRTdWJGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwic2F2ZVRhYmxlcyIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZUlkIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJ0YWJsZXMiLCJzaG9ydGVzdFBhdGhUb1RhYmxlIiwib3RoZXJUYWJsZSIsInZpc2l0ZWQiLCJkaXN0YW5jZXMiLCJwcmV2VGFibGVzIiwidmlzaXQiLCJ0YXJnZXRJZCIsInRhcmdldFRhYmxlIiwibmVpZ2hib3JMaXN0IiwiY29uY2F0IiwicGFyZW50VGFibGVzIiwibWFwIiwicGFyZW50VGFibGUiLCJmaWx0ZXIiLCJuZWlnaGJvcklkIiwidG9WaXNpdCIsInNvcnQiLCJhIiwiYiIsIm5leHRJZCIsInNoaWZ0IiwiY2hhaW4iLCJ1bnNoaWZ0IiwiYWdncmVnYXRlIiwiZXhwYW5kIiwiZGVsaW1pdGVyIiwiY2xvc2VkRmFjZXQiLCJvcGVuRmFjZXQiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJjbGFzc2VzIiwicmVkdWNlIiwiYWdnIiwiZGVsZXRlIiwiZXhlYyIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIml0ZW0iLCJTdGF0aWNEaWN0VGFibGUiLCJTaW5nbGVQYXJlbnRNaXhpbiIsIl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4iLCJBZ2dyZWdhdGVkVGFibGUiLCJfYXR0cmlidXRlIiwiX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsInJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsIl9kZWh5ZHJhdGVGdW5jdGlvbiIsImRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUiLCJfdXBkYXRlSXRlbSIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJuZXdXcmFwcGVkSXRlbSIsIndyYXBwZWRQYXJlbnQiLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwicmVkdWNlZCIsIkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIiwiX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlZEF0dHJpYnV0ZXMiLCJkdXBsaWNhdGVBdHRyaWJ1dGUiLCJwYXJlbnRJZCIsIl9kdXBsaWNhdGVBdHRyaWJ1dGVzIiwicGFyZW50TmFtZSIsImNvbm5lY3RlZEl0ZW1zIiwiYXR0ck5hbWUiLCJjb3BpZWQiLCJFeHBhbmRlZFRhYmxlIiwic3BsaXQiLCJGYWNldGVkVGFibGUiLCJfdmFsdWUiLCJjaGlsZEluZGV4IiwiY2hpbGRSb3ciLCJDb25uZWN0ZWRUYWJsZSIsImpvaW4iLCJiYXNlUGFyZW50VGFibGUiLCJvdGhlclBhcmVudFRhYmxlcyIsIkdlbmVyaWNDbGFzcyIsImNsYXNzSWQiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbiIsInNldENsYXNzTmFtZSIsInNhdmVDbGFzc2VzIiwiaGFzQ3VzdG9tTmFtZSIsImdldEhhc2hUYWJsZSIsImludGVycHJldEFzTm9kZXMiLCJuZXdDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJfZGVyaXZlR2VuZXJpY0NsYXNzIiwiTm9kZUNsYXNzIiwiZWRnZUNsYXNzSWRzIiwiX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzIiwiTm9kZVdyYXBwZXIiLCJwcmVwU2hvcnRlc3RFZGdlUGF0aCIsImVkZ2VDbGFzc0lkIiwiZWRnZVRhYmxlIiwiaWRMaXN0IiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiZWRnZUNsYXNzIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsInRhcmdldEVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY3JlYXRlQ2xhc3MiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJub2RlQ2xhc3MiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIkVkZ2VDbGFzcyIsIkVkZ2VXcmFwcGVyIiwiX3BpY2tFZGdlVGFibGUiLCJvdGhlckNsYXNzIiwic3RhdGljRXhpc3RzIiwiZGlzdCIsInN0YXJ0c1dpdGgiLCJwcmVwU2hvcnRlc3RTb3VyY2VQYXRoIiwiX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aCIsInNvdXJjZVRhYmxlIiwicHJlcFNob3J0ZXN0VGFyZ2V0UGF0aCIsIl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGgiLCJuZXdOb2RlQ2xhc3MiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwiZGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJjb25uZWN0VGFyZ2V0IiwiY29ubmVjdFNvdXJjZSIsInRvZ2dsZU5vZGVEaXJlY3Rpb24iLCJza2lwU2F2ZSIsImVkZ2VIYXNoIiwibm9kZUhhc2giLCJleGlzdGluZ1NvdXJjZUNsYXNzIiwiZXhpc3RpbmdUYXJnZXRDbGFzcyIsIml0ZW1MaXN0IiwiaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwidGFibGVJZHMiLCJ0aGlzVGFibGVJZCIsInJlbWFpbmluZ1RhYmxlSWRzIiwiZWRnZXMiLCJlZGdlSWRzIiwidGFibGVJZENoYWluIiwic291cmNlTm9kZXMiLCJ0YXJnZXROb2RlcyIsIkluTWVtb3J5SW5kZXgiLCJ0b1Jhd09iamVjdCIsIml0ZXJFbnRyaWVzIiwiaGFzaCIsInZhbHVlTGlzdCIsIml0ZXJIYXNoZXMiLCJpdGVyVmFsdWVMaXN0cyIsImdldFZhbHVlTGlzdCIsImFkZFZhbHVlIiwiTkVYVF9DTEFTU19JRCIsIk5FWFRfVEFCTEVfSUQiLCJNdXJlIiwiRmlsZVJlYWRlciIsImxvY2FsU3RvcmFnZSIsIm1pbWUiLCJkZWJ1ZyIsIkRBVEFMSUJfRk9STUFUUyIsIlRBQkxFUyIsIkNMQVNTRVMiLCJJTkRFWEVTIiwiTkFNRURfRlVOQ1RJT05TIiwiaWRlbnRpdHkiLCJyYXdJdGVtIiwia2V5IiwiVHlwZUVycm9yIiwicGFyZW50VHlwZSIsImRlZmF1bHRGaW5pc2giLCJ0aGlzV3JhcHBlZEl0ZW0iLCJvdGhlcldyYXBwZWRJdGVtIiwibGVmdCIsInJpZ2h0Iiwic2hhMSIsIkpTT04iLCJzdHJpbmdpZnkiLCJub29wIiwiaHlkcmF0ZSIsImhpZ2hlc3ROdW0iLCJNYXRoIiwibWF4IiwicGFyc2VJbnQiLCJtYXRjaCIsImRlaHlkcmF0ZSIsInN0b3JhZ2VLZXkiLCJUWVBFUyIsImNvbnRhaW5lciIsImdldEl0ZW0iLCJwYXJzZSIsInNldEl0ZW0iLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiVHlwZSIsInNlbGVjdG9yIiwibmV3VGFibGVPYmoiLCJuZXdDbGFzc09iaiIsImFkZEZpbGVBc1N0YXRpY1RhYmxlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJjb25zb2xlIiwid2FybiIsInRleHQiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJlcnIiLCJkZWxldGVBbGxDbGFzc2VzIiwiZ2V0Q2xhc3NEYXRhIiwicmVzdWx0cyIsIndpbmRvdyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FBSTtZQUNQLEdBQUdDLFNB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
