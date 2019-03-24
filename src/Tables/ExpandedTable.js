import Table from './Table.js';
import ChildTableMixin from './ChildTableMixin.js';

class ExpandedTable extends ChildTableMixin(Table) {
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
    return this._attribute;
  }
  async * _iterate () {
    const parentTable = this.parentTable;
    let index = 0;
    for await (const wrappedParent of parentTable.iterate()) {
      const row = await wrappedParent.row[this._attribute];
      if (row !== undefined && row !== null && Object.keys(row).length > 0) {
        const newItem = this._wrap({
          index,
          row,
          itemsToConnect: [ wrappedParent ],
          parentIndex: wrappedParent.index
        });
        if (await this._finishItem(newItem)) {
          yield newItem;
          index++;
        }
      }
    }
  }
}
export default ExpandedTable;
