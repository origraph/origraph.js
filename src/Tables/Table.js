import Introspectable from '../Common/Introspectable.js';
import TriggerableMixin from '../Common/TriggerableMixin.js';
import GenericWrapper from '../Wrappers/GenericWrapper.js';

class Table extends TriggerableMixin(Introspectable) {
  constructor (options) {
    super();
    this.model = options.model;
    this.tableId = options.tableId;
    if (!this.model || !this.tableId) {
      throw new Error(`model and tableId are required`);
    }

    this._expectedAttributes = options.attributes || {};
    this._observedAttributes = {};

    this._derivedTables = options.derivedTables || {};

    this._derivedAttributeFunctions = {};
    for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions || {})) {
      this._derivedAttributeFunctions[attr] = this.hydrateFunction(stringifiedFunc);
    }

    this._suppressedAttributes = options.suppressedAttributes || {};
    this._suppressIndex = !!options.suppressIndex;

    this._indexFilter = (options.indexFilter && this.hydrateFunction(options.indexFilter)) || null;
    this._attributeFilters = {};
    for (const [attr, stringifiedFunc] of Object.entries(options.attributeFilters || {})) {
      this._attributeFilters[attr] = this.hydrateFunction(stringifiedFunc);
    }

    this._limitPromises = {};

    this.iterationReset = new Error('Iteration reset');
  }
  _toRawObject () {
    const result = {
      tableId: this.tableId,
      attributes: this._attributes,
      derivedTables: this._derivedTables,
      derivedAttributeFunctions: {},
      suppressedAttributes: this._suppressedAttributes,
      suppressIndex: this._suppressIndex,
      attributeFilters: {},
      indexFilter: (this._indexFilter && this.dehydrateFunction(this._indexFilter)) || null
    };
    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this.dehydrateFunction(func);
    }
    for (const [attr, func] of Object.entries(this._attributeFilters)) {
      result.attributeFilters[attr] = this.dehydrateFunction(func);
    }
    return result;
  }
  getSortHash () {
    return this.type;
  }
  hydrateFunction (stringifiedFunc) {
    return new Function(`return ${stringifiedFunc}`)(); // eslint-disable-line no-new-func
  }
  dehydrateFunction (func) {
    let stringifiedFunc = func.toString();
    // Istanbul adds some code to functions for computing coverage, that gets
    // included in the stringification process during testing. See:
    // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022
    stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
    return stringifiedFunc;
  }
  async * iterate (limit = Infinity) {
    if (this._cache) {
      // The cache has already been built; just grab data from it directly
      yield * this._cache.slice(0, limit);
    } else if (this._partialCache && this._partialCache.length >= limit) {
      // The cache isn't finished, but it's already long enough to satisfy this
      // request
      yield * this._partialCache.slice(0, limit);
    } else {
      // The cache isn't finished building (and maybe didn't even start yet);
      // kick it off, and then wait for enough items to be processed to satisfy
      // the limit
      this.buildCache();
      yield * await new Promise((resolve, reject) => {
        this._limitPromises[limit] = this._limitPromises[limit] || [];
        this._limitPromises[limit].push({ resolve, reject });
      });
    }
  }
  async * _iterate (options) {
    throw new Error(`this function should be overridden`);
  }
  async _buildCache (resolve, reject) {
    this._partialCache = [];
    this._partialCacheLookup = {};
    const iterator = this._iterate();
    let i = 0;
    let temp = { done: false };
    while (!temp.done) {
      try {
        temp = await iterator.next();
      } catch (err) {
        // Something went wrong upstream (something that this._iterate
        // depends on was reset or threw a real error)
        if (err === this.iterationReset) {
          this.handleReset(reject);
        } else {
          throw err;
        }
      }
      if (!this._partialCache) {
        // reset() was called before we could finish; we need to let everyone
        // that was waiting on us know that we can't comply
        this.handleReset(reject);
        return;
      }
      if (!temp.done) {
        if (await this._finishItem(temp.value)) {
          // Okay, this item passed all filters, and is ready to be sent out
          // into the world
          this._partialCacheLookup[temp.value.index] = this._partialCache.length;
          this._partialCache.push(temp.value);
          i++;
          for (let limit of Object.keys(this._limitPromises)) {
            limit = Number(limit);
            // check if we have enough data now to satisfy any waiting requests
            if (limit <= i) {
              for (const { resolve } of this._limitPromises[limit]) {
                resolve(this._partialCache.slice(0, limit));
              }
              delete this._limitPromises[limit];
            }
          }
        }
      }
    }
    // Done iterating! We can graduate the partial cache / lookups into
    // finished ones, and satisfy all the requests
    this._cache = this._partialCache;
    delete this._partialCache;
    this._cacheLookup = this._partialCacheLookup;
    delete this._partialCacheLookup;
    for (let limit of Object.keys(this._limitPromises)) {
      limit = Number(limit);
      for (const { resolve } of this._limitPromises[limit]) {
        resolve(this._cache.slice(0, limit));
      }
      delete this._limitPromises[limit];
    }
    delete this._cachePromise;
    this.trigger('cacheBuilt');
    resolve(this._cache);
  }
  buildCache () {
    if (this._cache) {
      return this._cache;
    } else if (!this._cachePromise) {
      this._cachePromise = new Promise((resolve, reject) => {
        // The setTimeout here is absolutely necessary, or this._cachePromise
        // won't be stored in time for the next buildCache() call that comes
        // through
        setTimeout(() => {
          this._buildCache(resolve, reject);
        }, 0);
      });
    }
    return this._cachePromise;
  }
  reset () {
    delete this._cache;
    delete this._cacheLookup;
    delete this._partialCache;
    delete this._partialCacheLookup;
    delete this._cachePromise;
    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }
    this.trigger('reset');
  }
  handleReset (reject) {
    for (const limit of Object.keys(this._limitPromises)) {
      this._limitPromises[limit].reject(this.iterationReset);
      delete this._limitPromises;
    }
    reject(this.iterationReset);
  }
  async countRows () {
    return (await this.buildCache()).length;
  }
  async _finishItem (wrappedItem) {
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
    if (this._indexFilter) {
      keep = this._indexFilter(wrappedItem.index);
    }
    for (const [attr, func] of Object.entries(this._attributeFilters)) {
      keep = keep && await func(await wrappedItem.row[attr]);
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
    const wrappedItem = classObj ? classObj._wrap(options) : new GenericWrapper(options);
    for (const otherItem of options.itemsToConnect || []) {
      wrappedItem.connectItem(otherItem);
      otherItem.connectItem(wrappedItem);
    }
    return wrappedItem;
  }
  get name () {
    throw new Error(`this function should be overridden`);
  }
  getIndexDetails () {
    const details = { name: null };
    if (this._suppressIndex) {
      details.suppressed = true;
    }
    if (this._indexFilter) {
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
    for (const attr in this._attributeFilters) {
      allAttrs[attr] = allAttrs[attr] || { name: attr };
      allAttrs[attr].filtered = true;
    }
    return allAttrs;
  }
  get attributes () {
    return Object.keys(this.getAttributeDetails());
  }
  get currentData () {
    // Allow probing to see whatever data happens to be available
    return {
      data: this._cache || this._partialCache || [],
      lookup: this._cacheLookup || this._partialCacheLookup || {},
      complete: !!this._cache
    };
  }
  async getItem (index) {
    if (this._cacheLookup) {
      return this._cache[this._cacheLookup[index]];
    } else if (this._partialCacheLookup && this._partialCacheLookup[index] !== undefined) {
      return this._partialCache[this._partialCacheLookup[index]];
    }
    // Stupid approach when the cache isn't built: interate until we see the
    // index. Subclasses should override this
    for await (const item of this.iterate()) {
      if (item.index === index) {
        return item;
      }
    }
    return null;
  }
  deriveAttribute (attribute, func) {
    this._derivedAttributeFunctions[attribute] = func;
    this.reset();
    this.model.trigger('update');
  }
  suppressAttribute (attribute) {
    if (attribute === null) {
      this._suppressIndex = true;
    } else {
      this._suppressedAttributes[attribute] = true;
    }
    this.reset();
    this.model.trigger('update');
  }
  addFilter (attribute, func) {
    if (attribute === null) {
      this._indexFilter = func;
    } else {
      this._attributeFilters[attribute] = func;
    }
    this.reset();
    this.model.trigger('update');
  }
  _deriveTable (options) {
    const newTable = this.model.createTable(options);
    this._derivedTables[newTable.tableId] = true;
    this.model.trigger('update');
    return newTable;
  }
  _getExistingTable (options) {
    // Check if the derived table has already been defined
    const existingTable = this.derivedTables.find(tableObj => {
      return Object.entries(options).every(([optionName, optionValue]) => {
        if (optionName === 'type') {
          return tableObj.constructor.name === optionValue;
        } else {
          return tableObj['_' + optionName] === optionValue;
        }
      });
    });
    return (existingTable && this.model.tables[existingTable.tableId]) || null;
  }
  promote (attribute) {
    const options = {
      type: 'PromotedTable',
      attribute
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
    for await (const wrappedItem of this.iterate(limit)) {
      const value = await wrappedItem.row[attribute];
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
    for await (const wrappedItem of this.iterate(limit)) {
      const options = {
        type: 'TransposedTable',
        index: wrappedItem.index
      };
      yield this._getExistingTable(options) || this._deriveTable(options);
    }
  }
  duplicate () {
    return this._deriveTable({
      type: 'DuplicatedTable'
    });
  }
  connect (otherTableList) {
    const newTable = this.model.createTable({
      type: 'ConnectedTable'
    });
    this._derivedTables[newTable.tableId] = true;
    for (const otherTable of otherTableList) {
      otherTable._derivedTables[newTable.tableId] = true;
    }
    this.model.trigger('update');
    return newTable;
  }
  get classObj () {
    return Object.values(this.model.classes).find(classObj => {
      return classObj.table === this;
    });
  }
  get parentTables () {
    return Object.values(this.model.tables).reduce((agg, tableObj) => {
      if (tableObj._derivedTables[this.tableId]) {
        agg.push(tableObj);
      }
      return agg;
    }, []);
  }
  get derivedTables () {
    return Object.keys(this._derivedTables).map(tableId => {
      return this.model.tables[tableId];
    });
  }
  get inUse () {
    if (Object.keys(this._derivedTables).length > 0) {
      return true;
    }
    return Object.values(this.model.classes).some(classObj => {
      return classObj.tableId === this.tableId ||
        classObj.sourceTableIds.indexOf(this.tableId) !== -1 ||
        classObj.targetTableIds.indexOf(this.tableId) !== -1;
    });
  }
  delete () {
    if (this.inUse) {
      const err = new Error(`Can't delete in-use table ${this.tableId}`);
      err.inUse = true;
      throw err;
    }
    for (const parentTable of this.parentTables) {
      delete parentTable.derivedTables[this.tableId];
    }
    delete this.model.tables[this.tableId];
    this.model.trigger('update');
  }
}
Object.defineProperty(Table, 'type', {
  get () {
    return /(.*)Table/.exec(this.name)[1];
  }
});
export default Table;
