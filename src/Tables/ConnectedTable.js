import Table from './Table.js';
import DuplicatableAttributesMixin from './DuplicatableAttributesMixin.js';

class ConnectedTable extends DuplicatableAttributesMixin(Table) {
  get name () {
    return this.parentTables.map(parentTable => parentTable.name).join('⨯');
  }
  async * _iterate (options) {
    const parentTables = this.parentTables;
    // Spin through all of the parentTables so that their _cache is pre-built
    for (const parentTable of parentTables) {
      if (!parentTable._cache) {
        const iterator = parentTable.iterate();
        let temp;
        while (!temp || !temp.done) {
          temp = await iterator.next();
        }
      }
    }
    // Now that the caches are built, just iterate their keys directly
    for (const parentTable of parentTables) {
      if (!parentTable._cache) {
        // One of the parent tables was reset; return immediately
        return;
      }
      for (const index in parentTable._cache) {
        if (!this._partialCache[index]) {
          const connectedRows = {};
          for (const parentTable2 of parentTables) {
            connectedRows[parentTable2.tableId] = parentTable2._cache[index];
          }
          const wrappedItem = this._wrap({ index, connectedRows });
          this._duplicateAttributes(wrappedItem, connectedRows);
          this._finishItem(wrappedItem);
          yield wrappedItem;
        }
      }
    }
  }
}
export default ConnectedTable;
