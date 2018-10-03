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
      await parentTable.buildCache();
    }
    // Now that the caches are built, just iterate their keys directly. We only
    // care about including rows that have exact matches across all tables, so
    // we can just pick one parent table to iterate
    const baseParentTable = parentTables[0];
    const otherParentTables = parentTables.slice(1);
    for (const index in baseParentTable._cache) {
      if (!parentTables.every(table => table._cache)) {
        // One of the parent tables was reset; return immediately
        return;
      }
      if (!otherParentTables.every(table => table._cache[index])) {
        // No match in one of the other tables; omit this item
        continue;
      }
      // TODO: add each parent tables' keys as attribute values
      const newItem = this._wrap({
        index,
        itemsToConnect: parentTables.map(table => table._cache[index])
      });
      this._duplicateAttributes(newItem);
      if (this._finishItem(newItem)) {
        yield newItem;
      }
    }
  }
}
export default ConnectedTable;
