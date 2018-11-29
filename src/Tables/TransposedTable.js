import Table from './Table.js';
import SingleParentMixin from './SingleParentMixin.js';

class TransposedTable extends SingleParentMixin(Table) {
  constructor (options) {
    super(options);
    this._index = options.index;
    if (this._index === undefined) {
      throw new Error(`index is required`);
    }
  }
  _toRawObject () {
    const obj = super._toRawObject();
    obj.index = this._index;
    return obj;
  }
  getSortHash () {
    return super.getSortHash() + this.parentTable.getSortHash() + this._index;
  }
  get name () {
    return `ᵀ${this._index}`;
  }
  async * _iterate () {
    // Pre-build the parent table's cache
    const parentTable = this.parentTable;
    await parentTable.buildCache();

    // Iterate the row's attributes as indexes
    const wrappedParent = parentTable._cache[parentTable._cacheLookup[this._index]] || { row: {} };
    for (const [ index, value ] of Object.entries(wrappedParent.row)) {
      const newItem = this._wrap({
        index,
        row: typeof value === 'object' ? value : { value },
        itemsToConnect: [ wrappedParent ]
      });
      if (await this._finishItem(newItem)) {
        yield newItem;
      }
    }
  }
}
export default TransposedTable;
