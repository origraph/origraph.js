import TriggerableMixin from '../Common/TriggerableMixin.js';
import Introspectable from '../Common/Introspectable.js';

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor (options) {
    super();
    this.index = options.index;
    if (this.index === undefined) {
      throw new Error(`index is required`);
    }
    this.row = options.row || {};
    this.connectedItems = options.connectedItems || {};
  }
  connectItem (tableId, item) {
    this.connectedItems[tableId] = this.connectedItems[tableId] || [];
    if (this.connectedItems[tableId].indexOf(item) === -1) {
      this.connectedItems[tableId].push(item);
    }
  }
}
Object.defineProperty(GenericWrapper, 'type', {
  get () {
    return /(.*)Wrapper/.exec(this.name)[1];
  }
});
export default GenericWrapper;
