import Table from './Table.js';
import SingleParentMixin from './SingleParentMixin.js';

class ExpandedTable extends SingleParentMixin(Table) {
  constructor (options) {
    super(options);
    this._attribute = options.attribute;
    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }

    this.delimiter = options.delimiter || ',';
  }
  _toRawObject () {
    const obj = super._toRawObject();
    obj.attribute = this._attribute;
    return obj;
  }
  get name () {
    return this.parentTable.name + '↤';
  }
  async * _iterate (options) {
    let index = 0;
    const parentTable = this.parentTable;
    for await (const wrappedParent of parentTable.iterate(options)) {
      const values = (wrappedParent.row[this._attribute] || '').split(this.delimiter);
      for (const value of values) {
        const row = {};
        row[this._attribute] = value;
        const newItem = this._wrap({
          index,
          row,
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
export default ExpandedTable;
