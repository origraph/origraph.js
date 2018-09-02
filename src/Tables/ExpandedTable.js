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
  async * _iterate (options) {
    let index = 0;
    const parentTableId = this.parentTable.tableId;
    for await (const { wrappedParentItem } of this.parentTable.iterate(options)) {
      const values = (wrappedParentItem.row[this.attribute] || '').split(this.delimiter);
      for (const value of values) {
        const row = {};
        row[this.attribute] = value;
        const wrappedItem = new options.Wrapper({ index, row });
        const parentItems = {};
        parentItems[parentTableId] = wrappedParentItem;
        this._duplicateAttributes(wrappedItem, parentItems);
        this._finishItem(wrappedItem);
        yield wrappedItem;
        index++;
      }
    }
  }
}
export default ExpandedTable;
