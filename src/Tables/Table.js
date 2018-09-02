import Introspectable from '../Common/Introspectable.js';

class Table extends Introspectable {
  constructor (options) {
    super();
    this.mure = options.mure;
    this.tableId = options.tableId;
    if (!this.mure || !this.tableId) {
      throw new Error(`mure and tableId are required`);
    }

    this._expectedAttributes = options.attributes || {};
    this._observedAttributes = {};
    this.derivedTableLookup = options.derivedTableLookup || {};

    this._derivedAttributeFunctions = {};
    if (options.derivedAttributeFunctions) {
      for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions)) {
        this._derivedAttributeFunctions[attr] = this.mure.hydrateFunction(stringifiedFunc);
      }
    }
  }
  async * iterate (options = { reset: false }) {
    // Generic caching stuff; this isn't just for performance. ConnectedTable's
    // algorithm requires that its parent tables have pre-built indexes (we
    // technically could implement it differently, but it would be expensive,
    // requires tricky logic, and we're already building indexes for some tables
    // like AggregatedTable anyway)
    if (options.reset) {
      delete this._cache;
    }
    if (this._cache) {
      for (const finishedItem of Object.values(this._cache)) {
        yield finishedItem;
      }
      return;
    }

    // TODO: in large data scenarios, we should build the cache / index
    // externally on disk
    const partialCache = {};
    for await (const wrappedItem of this._iterate(options)) {
      this.finishItem(wrappedItem);
      partialCache[wrappedItem.index] = wrappedItem;
      yield wrappedItem;
    }
    this._cache = partialCache;
  }
  async * _iterate (options) {
    // _iterate will yield items immediately, even if they're not finished yet
    throw new Error(`this function should be overridden`);
  }
  finishItem (wrappedItem) {
    for (const [attr, func] of Object.entries(this.derivedAttributeFunctions)) {
      wrappedItem.row[attr] = func(wrappedItem);
    }
    for (const attr of Object.keys(wrappedItem.row)) {
      this._observedAttributes[attr] = true;
    }
    wrappedItem.trigger('finish');
  }
  toRawObject () {
    const result = {
      tableId: this.tableId,
      attributes: this.attributes,
      derivedTables: this.derivedTables,
      usedByClasses: this.usedByClasses,
      derivedAttributeFunctions: {}
    };
    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this.mure.dehydrateFunction(func);
    }
    return result;
  }
  getAllAttributes () {
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
  get attributes () {
    return Object.keys(this.getAllAttributes());
  }
  deriveTable (options) {
    const newTable = this.mure.createTable(options);
    this.derivedTableLookup[newTable.tableId] = true;
    this.mure.saveTables();
    return newTable;
  }
  aggregate (attribute) {
    return this.deriveTable({
      type: 'AggregatedTable',
      parentTableId: this.tableId,
      attribute
    });
  }
  expand (attribute, delimiter) {
    return this.deriveTable({
      type: 'ExpandedTable',
      parentTableId: this.tableId,
      attribute,
      delimiter
    });
  }
  closedFacet (attribute, values) {
    return values.map(value => {
      return this.deriveTable({
        type: 'FilteredTable',
        parentTableId: this.tableId,
        attribute,
        value
      });
    });
  }
  async * openFacet (options) {
    const values = {};
    const attribute = options.attribute;
    delete options.attribute;
    for await (const wrappedItem of this.iterate(options)) {
      const value = wrappedItem.row[attribute];
      if (!values[value]) {
        values[value] = true;
        yield this.deriveTable({
          type: 'FilteredTable',
          parentTableId: this.tableId,
          attribute,
          value
        });
      }
    }
  }
  get classes () {
    return Object.values(this.mure.classes).reduce((agg, classObj) => {
      if (classObj.tableId === this.tableId ||
        (classObj.tableIds && classObj.tableIds[this.tableId])) {
        agg.push(classObj);
      }
    }, []);
  }
  get parentTables () {
    return Object.values(this.mure.tables).reduce((agg, tableObj) => {
      if (tableObj.derivedTableLookup[this.tableId]) {
        agg.push(tableObj);
      }
    }, []);
  }
  delete () {
    if (Object.keys(this.derivedTableLookup).length > 0 || this.classes.length > 0) {
      throw new Error(`Can't delete in-use table ${this.tableId}`);
    }
    for (const parentTable of this.parentTables) {
      delete parentTable.derivedTableLookup[this.tableId];
    }
    delete this.mure.tables[this.tableId];
    this.mure.saveTables();
  }
}
Object.defineProperty(Table, 'type', {
  get () {
    return /(.*)Table/.exec(this.name)[1];
  }
});
export default Table;
