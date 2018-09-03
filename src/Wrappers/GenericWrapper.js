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
    this.connectedRows = options.connectedRows || {};
  }
}
Object.defineProperty(GenericWrapper, 'type', {
  get () {
    return /(.*)Wrapper/.exec(this.name)[1];
  }
});
export default GenericWrapper;
