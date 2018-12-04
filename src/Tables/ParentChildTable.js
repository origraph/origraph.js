import Table from './Table.js';

class ParentChildTable extends Table {
  get name () {
    return this.parentTables.map(parentTable => parentTable.name).join('/');
  }
  getSortHash () {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join(',');
  }
  async * _iterate () {
    let parentTable, childTable;
    if (this.parentTables[0].parentTable === this.parentTables[1]) {
      parentTable = this.parentTables[1];
      childTable = this.parentTables[0];
    } else if (this.parentTables[1].parentTable === this.parentTables[0]) {
      parentTable = this.parentTables[0];
      childTable = this.parentTables[1];
    } else {
      throw new Error(`ParentChildTable not set up properly`);
    }

    let index = 0;
    for await (const child of childTable.iterate()) {
      const parent = await parentTable.getItem(child.parentIndex);
      const newItem = this._wrap({
        index,
        itemsToConnect: [parent, child]
      });
      if (await this._finishItem(newItem)) {
        yield newItem;
        index++;
      }
    }
  }
}
export default ParentChildTable;
