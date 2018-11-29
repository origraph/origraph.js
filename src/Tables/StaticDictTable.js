import Table from './Table.js';

class StaticDictTable extends Table {
  constructor (options) {
    super(options);
    this._name = options.name;
    this._data = options.data || {};
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
  async * _iterate () {
    for (const [index, row] of Object.entries(this._data)) {
      const item = this._wrap({ index, row });
      if (await this._finishItem(item)) {
        yield item;
      }
    }
  }
}
export default StaticDictTable;
