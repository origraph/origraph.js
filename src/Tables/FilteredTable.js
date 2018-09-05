import Table from './Table.js';
import SingleParentMixin from './SingleParentMixin.js';

class FilteredTable extends SingleParentMixin(Table) {
  constructor (options) {
    super(options);
    this._attribute = options.attribute;
    this._value = options.value;
    if (!this._attribute === undefined || !this._value === undefined) {
      throw new Error(`attribute and value are required`);
    }
  }
  _toRawObject () {
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
      const includeItem = () => {
        const wrappedItem = this._wrap({
          index,
          row: wrappedParent.row,
          connectedRows: { wrappedParent }
        });
        this._finishItem(wrappedItem);
        index++;
        return wrappedItem;
      };
      if (this._attribute === null) {
        if (wrappedParent.index === this._value) {
          yield includeItem();
        }
      } else {
        if (wrappedParent.row[this._attribute] === this._value) {
          yield includeItem();
        }
      }
    }
  }
}
export default FilteredTable;
