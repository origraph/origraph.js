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
    this.duplicateItems = options.duplicateItems || [];
  }
  registerDuplicate (item) {
    this.duplicateItems.push(item);
  }
  connectItem (item) {
    this.connectedItems[item.table.tableId] = this.connectedItems[item.table.tableId] || [];
    if (this.connectedItems[item.table.tableId].indexOf(item) === -1) {
      this.connectedItems[item.table.tableId].push(item);
    }
    for (const dup of this.duplicateItems) {
      item.connectItem(dup);
      dup.connectItem(item);
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
  get instanceId () {
    return `{"classId":"${this.classObj.classId}","index":"${this.index}"}`;
  }
  get exportId () {
    return `${this.classObj.classId}_${this.index}`;
  }
  equals (item) {
    return this.instanceId === item.instanceId;
  }
  async * handleLimit (options, iterators) {
    let limit = Infinity;
    if (options.limit !== undefined) {
      limit = options.limit;
      delete options.limit;
    }
    let i = 0;
    for (const iterator of iterators) {
      for await (const item of iterator) {
        yield item;
        i++;
        if (item === null || i >= limit) {
          return;
        }
      }
    }
  }
  async * iterateAcrossConnections (tableIds) {
    // First make sure that all the table caches have been fully built and
    // connected
    await Promise.all(tableIds.map(tableId => {
      return this.classObj.model.tables[tableId].buildCache();
    }));
    yield * this._iterateAcrossConnections(tableIds);
  }
  * _iterateAcrossConnections (tableIds) {
    if (this.reset) {
      return;
    }
    const nextTableId = tableIds[0];
    if (tableIds.length === 1) {
      yield * (this.connectedItems[nextTableId] || []);
    } else {
      const remainingTableIds = tableIds.slice(1);
      for (const item of this.connectedItems[nextTableId] || []) {
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
