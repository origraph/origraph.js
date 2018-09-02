import TriggerableMixin from '../Common/TriggerableMixin.js';
import Introspectable from '../Common/Introspectable.js';

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor ({ key, value }) {
    super();
    this.key = key;
    this.value = value;
  }
}
Object.defineProperty(GenericWrapper, 'type', {
  get () {
    return /(.*)Wrapper/.exec(this.name)[1];
  }
});
export default GenericWrapper;
