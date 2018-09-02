import Table from './Table.js';

class StaticDict extends Table {
  constructor (options) {
    super(options);
    this._data = options.data || {};
  }
  _toRawObject () {
    const obj = super._toRawObject();
    obj.data = this._data;
    return obj;
  }
  async * _iterate (options) {
    for (const [index, row] of Object.entries(this._data)) {
      const item = this._wrap({ index, row });
      this._finishItem(item);
      yield item;
    }
  }
}
export default StaticDict;
