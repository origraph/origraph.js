import Introspectable from '../Common/Introspectable.js';
import TriggerableMixin from '../Common/TriggerableMixin.js';

class Table extends TriggerableMixin(Introspectable) {
  constructor (options) {
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

    this._indexSubFilter = (options.indexSubFilter && this._mure.hydrateFunction(options.indexSubFilter)) || null;
    this._attributeSubFilters = {};
    for (const [attr, stringifiedFunc] of Object.entries(options.attributeSubFilters || {})) {
      this._attributeSubFilters[attr] = this._mure.hydrateFunction(stringifiedFunc);
    }
  }
  _toRawObject () {
    const result = {
      tableId: this.tableId,
      attributes: this._attributes,
      derivedTables: this._derivedTables,
      usedByClasses: this._usedByClasses,
      derivedAttributeFunctions: {},
      suppressedAttributes: this._suppressedAttributes,
      suppressIndex: this._suppressIndex,
      attributeSubFilters: {},
      indexSubFilter: (this._indexSubFilter && this._mure.dehydrateFunction(this._indexSubFilter)) || null
    };
    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this._mure.dehydrateFunction(func);
    }
    for (const [attr, func] of Object.entries(this._attributeSubFilters)) {
      result.attributeSubFilters[attr] = this._mure.dehydrateFunction(func);
    }
    return result;
  }
  async * iterate (options = {}) {
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
      yield * Object.values(this._cache).slice(0, limit);
      return;
    }

    yield * await this._buildCache(options);
  }
  async * _buildCache (options = {}) {
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
  async * _iterate (options) {
    throw new Error(`this function should be overridden`);
  }
  _finishItem (wrappedItem) {
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
      if (!keep) { break; }
    }
    if (keep) {
      wrappedItem.trigger('finish');
    } else {
      wrappedItem.disconnect();
      wrappedItem.trigger('filter');
    }
    return keep;
  }
  _wrap (options) {
    options.table = this;
    const classObj = this.classObj;
    const wrappedItem = classObj ? classObj._wrap(options) : new this._mure.WRAPPERS.GenericWrapper(options);
    for (const otherItem of options.itemsToConnect || []) {
      wrappedItem.connectItem(otherItem);
      otherItem.connectItem(wrappedItem);
    }
    return wrappedItem;
  }
  reset () {
    delete this._partialCache;
    delete this._cache;
    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }
    this.trigger('reset');
  }
  get name () {
    throw new Error(`this function should be overridden`);
  }
  async buildCache () {
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
  async countRows () {
    return Object.keys(await this.buildCache()).length;
  }
  getIndexDetails () {
    const details = { name: null };
    if (this._suppressIndex) {
      details.suppressed = true;
    }
    if (this._indexSubFilter) {
      details.filtered = true;
    }
    return details;
  }
  getAttributeDetails () {
    const allAttrs = {};
    for (const attr in this._expectedAttributes) {
      allAttrs[attr] = allAttrs[attr] || { name: attr };
      allAttrs[attr].expected = true;
    }
    for (const attr in this._observedAttributes) {
      allAttrs[attr] = allAttrs[attr] || { name: attr };
      allAttrs[attr].observed = true;
    }
    for (const attr in this._derivedAttributeFunctions) {
      allAttrs[attr] = allAttrs[attr] || { name: attr };
      allAttrs[attr].derived = true;
    }
    for (const attr in this._suppressedAttributes) {
      allAttrs[attr] = allAttrs[attr] || { name: attr };
      allAttrs[attr].suppressed = true;
    }
    for (const attr in this._attributeSubFilters) {
      allAttrs[attr] = allAttrs[attr] || { name: attr };
      allAttrs[attr].filtered = true;
    }
    return allAttrs;
  }
  get attributes () {
    return Object.keys(this.getAttributeDetails());
  }
  get currentData () {
    return {
      data: this._cache || this._partialCache || {},
      complete: !!this._cache
    };
  }
  deriveAttribute (attribute, func) {
    this._derivedAttributeFunctions[attribute] = func;
    this.reset();
  }
  suppressAttribute (attribute) {
    if (attribute === null) {
      this._suppressIndex = true;
    } else {
      this._suppressedAttributes[attribute] = true;
    }
    this.reset();
  }
  addSubFilter (attribute, func) {
    if (attribute === null) {
      this._indexSubFilter = func;
    } else {
      this._attributeSubFilters[attribute] = func;
    }
    this.reset();
  }
  _deriveTable (options) {
    const newTable = this._mure.createTable(options);
    this._derivedTables[newTable.tableId] = true;
    this._mure.saveTables();
    return newTable;
  }
  _getExistingTable (options) {
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
    return (existingTableId && this._mure.tables[existingTableId]) || null;
  }
  shortestPathToTable (otherTable) {
    // Dijkstra's algorithm...
    const visited = {};
    const distances = {};
    const prevTables = {};
    const visit = targetId => {
      const targetTable = this._mure.tables[targetId];
      // Only check the unvisited derived and parent tables
      const neighborList = Object.keys(targetTable._derivedTables)
        .concat(targetTable.parentTables.map(parentTable => parentTable.tableId))
        .filter(tableId => !visited[tableId]);
      // Check and assign (or update) tentative distances to each neighbor
      for (const neighborId of neighborList) {
        if (distances[neighborId] === undefined) {
          distances[neighborId] = Infinity;
        }
        if (distances[targetId] + 1 < distances[neighborId]) {
          distances[neighborId] = distances[targetId] + 1;
          prevTables[neighborId] = targetId;
        }
      }
      // Okay, this table is officially visited; take it out of the running
      // for future visits / checks
      visited[targetId] = true;
      delete distances[targetId];
    };

    // Start with this table
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
    }
    // We didn't find it; there's no connection
    return null;
  }
  aggregate (attribute) {
    const options = {
      type: 'AggregatedTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }
  expand (attribute, delimiter) {
    const options = {
      type: 'ExpandedTable',
      attribute,
      delimiter
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }
  closedFacet (attribute, values) {
    return values.map(value => {
      const options = {
        type: 'FacetedTable',
        attribute,
        value
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }
  async * openFacet (attribute, limit = Infinity) {
    const values = {};
    for await (const wrappedItem of this.iterate({ limit })) {
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
  closedTranspose (indexes) {
    return indexes.map(index => {
      const options = {
        type: 'TransposedTable',
        index
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }
  async * openTranspose (limit = Infinity) {
    for await (const wrappedItem of this.iterate({ limit })) {
      const options = {
        type: 'TransposedTable',
        index: wrappedItem.index
      };
      yield this._getExistingTable(options) || this._deriveTable(options);
    }
  }
  connect (otherTableList) {
    const newTable = this._mure.createTable({ type: 'ConnectedTable' });
    this._derivedTables[newTable.tableId] = true;
    for (const otherTable of otherTableList) {
      otherTable._derivedTables[newTable.tableId] = true;
    }
    this._mure.saveTables();
    return newTable;
  }
  get classObj () {
    return Object.values(this._mure.classes).find(classObj => {
      return classObj.table === this;
    });
  }
  get parentTables () {
    return Object.values(this._mure.tables).reduce((agg, tableObj) => {
      if (tableObj._derivedTables[this.tableId]) {
        agg.push(tableObj);
      }
      return agg;
    }, []);
  }
  get derivedTables () {
    return Object.keys(this._derivedTables).map(tableId => {
      return this._mure.tables[tableId];
    });
  }
  get inUse () {
    if (Object.keys(this._derivedTables).length > 0) {
      return true;
    }
    return Object.values(this._mure.classes).some(classObj => {
      return classObj.tableId === this.tableId ||
        classObj.sourceTableIds.indexOf(this.tableId) !== -1 ||
        classObj.targetTableIds.indexOf(this.tableId) !== -1;
    });
  }
  delete () {
    if (this.inUse) {
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
  get () {
    return /(.*)Table/.exec(this.name)[1];
  }
});
export default Table;
