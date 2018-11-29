import Table from './Table.js';
import SingleParentMixin from './SingleParentMixin.js';

class AggregatedTable extends SingleParentMixin(Table) {
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
  async * _buildCache (options) {
    // We override _buildCache so that AggregatedTable can take advantage
    // of the partially-built cache as it goes, and postpone finishing items
    // until after the parent table has been fully iterated

    // TODO: in large data scenarios, we should build the cache / index
    // externally on disk
    this._partialCache = {};
    for await (const wrappedItem of this._iterate(options)) {
      this._partialCache[wrappedItem.index] = wrappedItem;
      // Go ahead and yield the unfinished item; this makes it possible for
      // client apps to be more responsive and render partial results, but also
      // means that they need to watch for wrappedItem.on('finish') events
      yield wrappedItem;
    }

    // Second pass: now that we've completed the full iteration of the parent
    // table, we can finish each item
    for (const index in this._partialCache) {
      const wrappedItem = this._partialCache[index];
      if (!await this._finishItem(wrappedItem)) {
        delete this._partialCache[index];
      }
    }
    this._cache = this._partialCache;
    delete this._partialCache;
  }
  async * _iterate (options) {
    const parentTable = this.parentTable;
    for await (const wrappedParent of parentTable.iterate(options)) {
      const index = String(await wrappedParent.row[this._attribute]);
      if (!this._partialCache) {
        // We were reset; return immediately
        return;
      } else if (this._partialCache[index]) {
        const existingItem = this._partialCache[index];
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
export default AggregatedTable;
