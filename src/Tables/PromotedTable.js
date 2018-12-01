import Table from './Table.js';
import SingleParentMixin from './SingleParentMixin.js';

class PromotedTable extends SingleParentMixin(Table) {
  constructor (options) {
    super(options);
    this._attribute = options.attribute;
    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }
  }
  _toRawObject () {
    const obj = super._toRawObject();
    obj.attribute = this._attribute;
    return obj;
  }
  getSortHash () {
    return super.getSortHash() + this.parentTable.getSortHash() + this._attribute;
  }
  get name () {
    return '↦' + this._attribute;
  }
  async _buildCache (resolve, reject) {
    // We override _buildCache because we don't actually want to call _finishItem
    // until all unique values have been seen
    this._unfinishedCache = [];
    this._unfinishedCacheLookup = {};
    this._partialCache = [];
    this._partialCacheLookup = {};
    const iterator = this._iterate();
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
        this._unfinishedCacheLookup[temp.value.index] = this._unfinishedCache.length;
        this._unfinishedCache.push(temp.value);
      }
    }
    // Okay, now we've seen everything; we can call _finishItem on each of the
    // unique values
    let i = 0;
    for (const value of this._unfinishedCache) {
      if (await this._finishItem(value)) {
        // Okay, this item passed all filters, and is ready to be sent out
        // into the world
        this._partialCacheLookup[value.index] = this._partialCache.length;
        this._partialCache.push(value);
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
    // Done iterating! We can graduate the partial cache / lookups into
    // finished ones, and satisfy all the requests
    delete this._unfinishedCache;
    delete this._unfinishedCacheLookup;
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
  async * _iterate () {
    const parentTable = this.parentTable;
    for await (const wrappedParent of parentTable.iterate()) {
      const index = String(await wrappedParent.row[this._attribute]);
      if (!this._partialCache) {
        // We were reset!
        throw this.iterationReset;
      } else if (this._unfinishedCacheLookup[index] !== undefined) {
        const existingItem = this._unfinishedCache[this._unfinishedCacheLookup[index]];
        existingItem.connectItem(wrappedParent);
        wrappedParent.connectItem(existingItem);
      } else {
        const newItem = this._wrap({
          index,
          itemsToConnect: [ wrappedParent ]
        });
        yield newItem;
      }
    }
  }
}
export default PromotedTable;
