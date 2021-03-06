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
    return `${this._index}`;
  }
  async * _iterate () {
    // Pre-build the parent table's cache
    await this.parentTable.buildCache();

    // Iterate the row's attributes as indexes
    const wrappedParent = this.parentTable._cache[this.parentTable._cacheLookup[this._index]] || { row: {} };
    for (let [ index, value ] of Object.entries(wrappedParent.row)) {
      value = await value;
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
