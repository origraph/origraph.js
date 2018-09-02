import Table from './Table.js';
import DuplicatableAttributesMixin from './DuplicatableAttributesMixin.js';

class ExpandedTable extends DuplicatableAttributesMixin(Table) {
  constructor (options) {
    super(options);
    this.parentTableId = options.parentTableId;
    this.attribute = options.attribute;
    if (!this.parentTableId || !this.attribute) {
      throw new Error(`parentTableId and attribute are required`);
    }

    this.delimiter = options.delimiter || ',';
  }
  async * _iterate (options) {
    const parentTable = this.mure.tables[this.parentTableId];
    let index = 0;
    for await (const { wrappedParent } of parentTable.iterate(options)) {
      const values = (wrappedParent.row[this.attribute] || '').split(this.delimiter);
      for (const value of values) {
        const newRow = {};
        newRow[this.attribute] = value;
        const wrappedItem = new options.Wrapper({ index, row: newRow });
        this.duplicateAttributes(wrappedItem, wrappedParent);
        this.finishItem(wrappedItem);
        yield wrappedItem;
        index++;
      }
    }
  }
  toRawObject () {
    const obj = super.toRawObject();
    obj.parentTableId = this.parentTableId;
    obj.attribute = this.attribute;
    return obj;
  }
}
export default ExpandedTable;
