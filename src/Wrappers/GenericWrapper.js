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
  connectItem (tableId, item) {
    this.connectedItems[tableId] = this.connectedItems[tableId] || [];
    if (this.connectedItems[tableId].indexOf(item) === -1) {
      this.connectedItems[tableId].push(item);
    }
  }
  * iterateAcrossConnections (tableIds) {
    if (tableIds.length === 1) {
      yield * (this.connectedItems[tableIds[0]] || []);
    } else {
      const thisTableId = tableIds[0];
      const remainingTableIds = tableIds.slice(1);
      for (const item of this.connectedItems[thisTableId] || []) {
        yield * item.iterateAcrossConnections(remainingTableIds);
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
