import Table from './Table.js';
import SingleParentMixin from './SingleParentMixin.js';

class AggregatedTable extends SingleParentMixin(Table) {
  constructor (options) {
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
  _toRawObject () {
    const obj = super._toRawObject();
    obj.attribute = this._attribute;
    obj.reduceAttributeFunctions = {};
    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      obj.reduceAttributeFunctions[attr] = this._mure._dehydrateFunction(func);
    }
    return obj;
  }
  get name () {
    return this.parentTable.name + '↦';
  }
  deriveReducedAttribute (attr, func) {
    this._reduceAttributeFunctions[attr] = func;
    this.reset();
  }
  _updateItem (originalWrappedItem, newWrappedItem) {
    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      originalWrappedItem.row[attr] = func(originalWrappedItem, newWrappedItem);
    }
    originalWrappedItem.trigger('update');
  }
  async * _buildCache (options) {
    // We override _buildCache because so that AggregatedTable can take advantage
    // of the partially-built cache as it goes, and postpone finishing items
    // until after the parent table has been fully iterated

    // TODO: in large data scenarios, we should build the cache / index
    // externally on disk
    this._partialCache = {};
    for await (const wrappedItem of this._iterate(options)) {
      this._partialCache[wrappedItem.index] = wrappedItem;
      // Go ahead and yield the unfinished item; this makes it possible for
      // client apps to be more responsive and render partial results, but also
      // means that they need to watch for wrappedItem.on('update') events
      yield wrappedItem;
    }

    // Second pass: now that we've completed the full iteration of the parent
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
  async * _iterate (options) {
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
          itemsToConnect: [ wrappedParent ]
        });
        this._updateItem(newItem, wrappedParent);
        yield newItem;
      }
    }
  }
  getAttributeDetails () {
    const allAttrs = super.getAttributeDetails();
    for (const attr in this._reduceAttributeFunctions) {
      allAttrs[attr] = allAttrs[attr] || { name: attr };
      allAttrs[attr].reduced = true;
    }
    return allAttrs;
  }
}
export default AggregatedTable;
