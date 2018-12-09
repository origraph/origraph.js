import Table from './Table.js';

class ProjectedTable extends Table {
  constructor (options) {
    super(options);
    this.tableOrder = options.tableOrder;
    if (!this.tableOrder) {
      throw new Error(`tableOrder is required`);
    }
  }
  get name () {
    return this.tableOrder.map(tableId => this.model.tables[tableId].name).join('⨯');
  }
  getSortHash () {
    return super.getSortHash() + this.tableOrder
      .map(tableId => this.model.tables[tableId].getSortHash()).join('⨯');
  }
  async * _iterate () {
    const self = this;

    const firstTable = this.model.tables[this.tableOrder[0]];
    const remainingIds = this.tableOrder.slice(1);
    for await (const sourceItem of firstTable.iterate()) {
      for await (const lastItem of sourceItem.iterateAcrossConnections(remainingIds)) {
        const newItem = this._wrap({
          index: sourceItem.index + '⨯' + lastItem.index,
          itemsToConnect: [sourceItem, lastItem]
        });
        if (await self._finishItem(newItem)) {
          yield newItem;
        }
      }
    }
  }
}
export default ProjectedTable;
