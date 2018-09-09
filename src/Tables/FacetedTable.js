import Table from './Table.js';
import SingleParentMixin from './SingleParentMixin.js';

class FacetedTable extends SingleParentMixin(Table) {
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
    const parentTable = this.parentTable;
    for await (const wrappedParent of parentTable.iterate(options)) {
      if ((this._attribute === null && wrappedParent.index === this._value) ||
          (this._attribute !== null && wrappedParent.row[this._attribute] === this._value)) {
        const newItem = this._wrap({
          index,
          row: Object.assign({}, wrappedParent.row),
          itemsToConnect: [ wrappedParent ]
        });
        if (this._finishItem(newItem)) {
          yield newItem;
        }
        index++;
      }
    }
  }
}
export default FacetedTable;
