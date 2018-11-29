import Table from './Table.js';

class ConnectedTable extends Table {
  get name () {
    return this.parentTables.map(parentTable => parentTable.name).join('⨯');
  }
  getSortHash () {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join(',');
  }
  async * _iterate () {
    const parentTables = this.parentTables;
    // Don't try to connect values until all of the parent tables' caches are
    // built; TODO: might be able to do something more responsive here?
    for (const parentTable of parentTables) {
      await parentTable.buildCache();
    }
    // Now that the caches are built, just iterate their keys directly. We only
    // care about including rows that have exact matches across all tables, so
    // we can just pick one parent table to iterate
    const baseParentTable = parentTables[0];
    const otherParentTables = parentTables.slice(1);
    for (const index in baseParentTable._cacheLookup) {
      if (!parentTables.every(table => table._cacheLookup)) {
        // One of the parent tables was reset, meaning we need to reset as well
        throw this.iterationReset;
      }
      if (!otherParentTables.every(table => table._cacheLookup[index] !== undefined)) {
        // No match in one of the other tables; omit this item
        continue;
      }
      // TODO: add each parent tables' keys as attribute values
      const newItem = this._wrap({
        index,
        itemsToConnect: parentTables.map(table => table._cache[table._cacheLookup[index]])
      });
      if (await this._finishItem(newItem)) {
        yield newItem;
      }
    }
  }
}
export default ConnectedTable;
