import Table from './Table.js';
import SingleParentMixin from './SingleParentMixin.js';
import DuplicatableAttributesMixin from './DuplicatableAttributesMixin.js';

class ExpandedTable extends DuplicatableAttributesMixin(SingleParentMixin(Table)) {
  constructor (options) {
    super(options);
    this._attribute = options.attribute;
    if (!this.attribute) {
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
    const parentTableId = this.parentTable.tableId;
    for await (const wrappedParent of this.parentTable.iterate(options)) {
      const values = (wrappedParent.row[this.attribute] || '').split(this.delimiter);
      for (const value of values) {
        const row = {};
        row[this.attribute] = value;
        const connectedRows = {};
        connectedRows[parentTableId] = wrappedParent;
        const wrappedItem = this._wrap({ index, row, connectedRows });
        this._duplicateAttributes(wrappedItem, connectedRows);
        this._finishItem(wrappedItem);
        yield wrappedItem;
        index++;
      }
    }
  }
}
export default ExpandedTable;
