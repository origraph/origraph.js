import Table from './Table.js';
import DuplicatableAttributesMixin from './DuplicatableAttributesMixin.js';

class ConnectedTable extends DuplicatableAttributesMixin(Table) {
  constructor (options) {
    super(options);
    this.parentTableIds = options.parentTableIds;
    if (!this.parentTableIds || !this.parentTableIds.length >= 2) {
      throw new Error(`At least 2 parentTableIds are required`);
    }
  }
  async * _iterate (options) {
    // TODO: spin through all of the parentTables so that their _cache is
    // pre-built, and just iterate their caches! (simpler + faster algorithm
    // than manually matching indexes)
  }
  toRawObject () {
    const obj = super.toRawObject();
    obj.parentTableIds = this.parentTableIds;
    return obj;
  }
}
export default ConnectedTable;
