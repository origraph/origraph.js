import Table from './Table.js';
import SingleParentMixin from './SingleParentMixin.js';

class ExpandedTable extends SingleParentMixin(Table) {
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
    return '+' + this._attribute;
  }
  async * _iterate () {
    const parentTable = this.parentTable;
    let index = 0;
    for await (const wrappedParent of parentTable.iterate()) {
      const row = wrappedParent.row[this._attribute];
      if (row !== undefined && row !== null && Object.keys(row).length > 0) {
        yield this._wrap({
          index,
          row,
          itemsToConnect: [ wrappedParent ]
        });
        index++;
      }
    }
  }
}
export default ExpandedTable;
