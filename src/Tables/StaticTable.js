import Table from './Table.js';

class StaticTable extends Table {
  constructor (options) {
    super(options);

    this.data = options.data || [];
  }
  async * _iterate (options) {
    for (let index = 0; index < this.data.length; index++) {
      const item = new options.Wrapper({ index, row: this.data[index] });
      this.finishItem(item);
      yield item;
    }
  }
  toRawObject () {
    const obj = super.toRawObject();
    obj.data = this.data;
    return obj;
  }
}
export default StaticTable;
