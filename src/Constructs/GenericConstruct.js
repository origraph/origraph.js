import Introspectable from '../Common/Introspectable.js';

class GenericConstruct extends Introspectable {
  constructor (mure, selector, classNames = []) {
    super();
    this.mure = mure;
    this.selector = selector;
    this.classNames = classNames;
    this.annotations = [];
  }
  wrap ({ parent, token, rawItem }) {
    return new this.mure.WRAPPERS.GenericWrapper({ parent, token, rawItem });
  }
  stream (options = {}) {
    options.selector = this.selector;
    return this.mure.stream(options);
  }
}
Object.defineProperty(GenericConstruct, 'type', {
  get () {
    return /(.*)Construct/.exec(this.name)[1];
  }
});
export default GenericConstruct;
