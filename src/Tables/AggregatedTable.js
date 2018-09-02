import Table from './Table.js';

class AggregatedTable extends Table {
  constructor (options) {
    super(options);
    this.parentTableId = options.parentTableId;
    this.attribute = options.attribute;
    if (!this.parentTableId || !this.attribute) {
      throw new Error(`parentTableId and attribute are required`);
    }

    this._reduceAttributeFunctions = {};
    if (options.reduceAttributeFunctions) {
      for (const [attr, stringifiedFunc] of Object.entries(options.reduceAttributeFunctions)) {
        this._reduceAttributeFunctions[attr] = this.mure.hydrateFunction(stringifiedFunc);
      }
    }
  }
  updateItem (originalWrappedItem, newWrappedItem) {
    for (const [attr, func] of Object.entries(this.reduceAttributeFunctions)) {
      originalWrappedItem.row[attr] = func(originalWrappedItem, newWrappedItem);
    }
    originalWrappedItem.trigger('update');
  }
  async * iterate (options = { reset: false }) {
    // We override the general iterate function here, because we have to build
    // the cache internally anyway, and it doesn't make sense to do it twice.
    // Also, AggregatedTable is the only case where items need to be finished
    // *after* they've been cached, not the other way around
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
    this._partialCache = {};
    for await (const wrappedItem of this._iterate(options)) {
      this._partialCache[wrappedItem.index] = wrappedItem;
    }

    // Second pass: now that we've completed the full iteration of the parent
    // table, we can go ahead and finish each item
    for (const index in this._partialCache) {
      const wrappedItem = this._partialCache[index];
      this.finishItem(wrappedItem);
      yield wrappedItem;
    }
    this._cache = this._partialCache;
    delete this._partialCache;
  }
  async * _iterate (options) {
    const parentTable = this.mure.tables[this.parentTableId];
    for await (const { wrappedParent } of parentTable.iterate(options)) {
      const index = wrappedParent.row[this.attribute];
      if (this._partialCache[index]) {
        this.updateItem(this._partialCache[index], wrappedParent);
      } else {
        yield new options.Wrapper({ index, row: wrappedParent.row });
      }
    }
  }
  toRawObject () {
    const obj = super.toRawObject();
    obj.parentTableId = this.parentTableId;
    obj.attribute = this.attribute;
    obj.reduceAttributeFunctions = {};
    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      obj.reduceAttributeFunctions[attr] = this.mure.dehydrateFunction(func);
    }
    return obj;
  }
  getAllAttributes () {
    const result = super.getAllAttributes();
    for (const attr in this._reduceAttributeFunctions) {
      result[attr] = true;
    }
    return result;
  }
}
export default AggregatedTable;
