import TriggerableMixin from '../Common/TriggerableMixin.js';
import Introspectable from '../Common/Introspectable.js';

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor ({ wrappedParent, token, rawItem }) {
    super();
    this.wrappedParent = wrappedParent;
    this.token = token;
    this.rawItem = rawItem;
  }
}
Object.defineProperty(GenericWrapper, 'type', {
  get () {
    return /(.*)Wrapper/.exec(this.name)[1];
  }
});
export default GenericWrapper;
