import Table from './Table.js';

class StaticDict extends Table {
  constructor (options) {
    super(options);

    this.data = options.data || {};
  }
  async * _iterate (options) {
    for (const [index, row] of Object.entries(this.data)) {
      const item = new options.Wrapper({ index, row });
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
export default StaticDict;
