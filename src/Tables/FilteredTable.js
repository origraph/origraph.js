import Table from './Table.js';

class FilteredTable extends Table {
  constructor (options) {
    super(options);
    this.parentTableId = options.parentTableId;
    this.attribute = options.attribute;
    this.value = options.value;
    if (!this.parentTableId || !this.attribute || !this.value) {
      throw new Error(`parentTableId, attribute, and value are required`);
    }
  }
  async * _iterate (options) {
    const parentTable = this.mure.tables[this.parentTableId];
    let index = 0;
    for await (const { wrappedParent } of parentTable.iterate(options)) {
      if (wrappedParent.row[this.attribute] === this.value) {
        const wrappedItem = new options.Wrapper({ index, row: wrappedParent.row });
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
    obj.value = this.value;
    return obj;
  }
}
export default FilteredTable;
