import Table from './Table.js';

class StaticTable extends Table {
  constructor (options) {
    super(options);
    this._data = options.data || [];
  }
  _toRawObject () {
    const obj = super._toRawObject();
    obj.data = this._data;
    return obj;
  }
  async * _iterate (options) {
    for (let index = 0; index < this._data.length; index++) {
      const item = this._wrap({ index, row: this._data[index] });
      this._finishItem(item);
      yield item;
    }
  }
}
export default StaticTable;
