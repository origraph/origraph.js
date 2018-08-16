import Introspectable from '../Common/Introspectable.js';
import Stream from '../Stream.js';

class GenericClass extends Introspectable {
  constructor (options) {
    super();
    this.mure = options.mure;
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.namedFunctions = Object.assign({},
      this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.tokenClassList = this.mure.parseSelector(options.selector || `root.values()`);
  }
  wrap (options) {
    return new this.mure.WRAPPERS.GenericWrapper(options);
  }
  getStream () {
    return new Stream({
      mure: this.mure,
      tokenClassList: this.tokenClassList,
      namedFunctions: this.namedFunctions,
      launchedFromClass: this
    });
  }
  isSuperSetOfTokenList (tokenList) {
    if (tokenList.length !== this.tokenList.length) { return false; }
    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }
}
Object.defineProperty(GenericClass, 'type', {
  get () {
    return /(.*)Class/.exec(this.name)[1];
  }
});
export default GenericClass;
