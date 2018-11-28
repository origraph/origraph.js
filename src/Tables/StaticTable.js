import Table from './Table.js';

class StaticTable extends Table {
  constructor (options) {
    super(options);
    this._name = options.name;
    this._data = options.data || [];
    if (!this._name || !this._data) {
      throw new Error(`name and data are required`);
    }
  }
  get name () {
    return this._name;
  }
  _toRawObject () {
    const obj = super._toRawObject();
    obj.name = this._name;
    obj.data = this._data;
    return obj;
  }
  getSortHash () {
    return super.getSortHash() + this._name;
  }
  async * _iterate (options) {
    for (let index = 0; index < this._data.length; index++) {
      const item = this._wrap({ index, row: this._data[index] });
      if (await this._finishItem(item)) {
        yield item;
      }
    }
  }
}
export default StaticTable;
