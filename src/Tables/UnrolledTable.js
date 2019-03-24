import Table from './Table.js';
import ChildTableMixin from './ChildTableMixin.js';

class UnrolledTable extends ChildTableMixin(Table) {
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
      const rows = wrappedParent.row[this._attribute];
      if (rows !== undefined && rows !== null &&
          typeof rows[Symbol.iterator] === 'function') {
        for await (const row of rows) {
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
}
export default UnrolledTable;
