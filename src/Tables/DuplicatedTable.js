import Table from './Table.js';
import SingleParentMixin from './SingleParentMixin.js';

class DuplicatedTable extends SingleParentMixin(Table) {
  get name () {
    return this.parentTable.name + '*';
  }
  getSortHash () {
    return super.getSortHash() + this.parentTable.getSortHash();
  }
  async * _iterate () {
    // Yield the same items with the same connections, but wrapped and finished
    // by this table
    for await (const item of this.parentTable.iterate()) {
      const newItem = this._wrap({
        index: item.index,
        row: item.row,
        itemsToConnect: Object.values(item.connectedItems).reduce((agg, itemList) => {
          return agg.concat(itemList);
        }, [])
      });
      item.registerDuplicate(newItem);
      if (await this._finishItem(newItem)) {
        yield newItem;
      }
    }
  }
}
export default DuplicatedTable;
