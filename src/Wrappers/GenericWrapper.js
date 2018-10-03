import TriggerableMixin from '../Common/TriggerableMixin.js';
import Introspectable from '../Common/Introspectable.js';

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor (options) {
    super();
    this.index = options.index;
    this.table = options.table;
    if (this.index === undefined || !this.table) {
      throw new Error(`index and table are required`);
    }
    this.classObj = options.classObj || null;
    this.row = options.row || {};
    this.connectedItems = options.connectedItems || {};
  }
  connectItem (item) {
    this.connectedItems[item.table.tableId] = this.connectedItems[item.table.tableId] || [];
    if (this.connectedItems[item.table.tableId].indexOf(item) === -1) {
      this.connectedItems[item.table.tableId].push(item);
    }
  }
  disconnect () {
    for (const itemList of Object.values(this.connectedItems)) {
      for (const item of itemList) {
        const index = (item.connectedItems[this.table.tableId] || []).indexOf(this);
        if (index !== -1) {
          item.connectedItems[this.table.tableId].splice(index, 1);
        }
      }
    }
    this.connectedItems = {};
  }
  async * iterateAcrossConnections ({ tableIds, limit = Infinity }) {
    // First make sure that all the table caches have been fully built and
    // connected
    await Promise.all(tableIds.map(tableId => {
      return this.classObj._origraph.tables[tableId].buildCache();
    }));
    let i = 0;
    for (const item of this._iterateAcrossConnections(tableIds)) {
      yield item;
      i++;
      if (i >= limit) {
        return;
      }
    }
  }
  * _iterateAcrossConnections (tableIds) {
    if (tableIds.length === 1) {
      yield * (this.connectedItems[tableIds[0]] || []);
    } else {
      const thisTableId = tableIds[0];
      const remainingTableIds = tableIds.slice(1);
      for (const item of this.connectedItems[thisTableId] || []) {
        yield * item._iterateAcrossConnections(remainingTableIds);
      }
    }
  }
}
Object.defineProperty(GenericWrapper, 'type', {
  get () {
    return /(.*)Wrapper/.exec(this.name)[1];
  }
});
export default GenericWrapper;
