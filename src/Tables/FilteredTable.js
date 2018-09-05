import Table from './Table.js';
import SingleParentMixin from './SingleParentMixin.js';

class FilteredTable extends SingleParentMixin(Table) {
  constructor (options) {
    super(options);
    this._attribute = options.attribute;
    this._value = options.value;
    if (!this._attribute || !this._value) {
      throw new Error(`attribute and value are required`);
    }
  }
  toRawObject () {
    const obj = super._toRawObject();
    obj.attribute = this._attribute;
    obj.value = this._value;
    return obj;
  }
  get name () {
    return `${this.parentTable.name}[${this._value}]`;
  }
  async * _iterate (options) {
    let index = 0;
    for await (const wrappedParent of this.parentTable.iterate(options)) {
      if (wrappedParent.row[this._attribute] === this._value) {
        const wrappedItem = this._wrap({
          index,
          row: wrappedParent.row,
          connectedRows: { wrappedParent }
        });
        this._finishItem(wrappedItem);
        yield wrappedItem;
        index++;
      }
    }
  }
}
export default FilteredTable;
