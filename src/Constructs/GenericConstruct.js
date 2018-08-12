import Introspectable from '../Common/Introspectable.js';

class GenericConstruct extends Introspectable {
  constructor ({ mure, selector, classNames = [] }) {
    super();
    this.mure = mure;
    this.selector = selector;
    this.stream = this.mure.stream({ selector: selector });
    this.classNames = classNames;
    this.annotations = [];
  }
  wrap (options) {
    return new this.mure.WRAPPERS.GenericWrapper(options);
  }
}
Object.defineProperty(GenericConstruct, 'type', {
  get () {
    return /(.*)Construct/.exec(this.name)[1];
  }
});
export default GenericConstruct;
