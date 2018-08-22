import Introspectable from '../Common/Introspectable.js';
import Stream from '../Stream.js';

class GenericClass extends Introspectable {
  constructor (options) {
    super();
    this.mure = options.mure;
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.namedFunctions = Object.assign({},
      this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.selector = options.selector || `root.values()`;
    this._customClassName = null;
    this.tokenClassList = this.mure.parseSelector(options.selector);
    this.indexes = options.indexes || {};
  }
  wrap (options) {
    return new this.mure.WRAPPERS.GenericWrapper(options);
  }
  get className () {
    return this._customClassName || 'class name auto-inference not implemented';
  }
  getStream (options = {}) {
    if (options.reset || !this._stream) {
      options.mure = this.mure;
      options.tokenClassList = this.tokenClassList;
      options.namedFunctions = this.namedFunctions;
      options.launchedFromClass = this;
      options.indexes = this.indexes;
      this._stream = new Stream(options);
    }
    return this._stream;
  }
  isSuperSetOfTokenList (tokenList) {
    if (tokenList.length !== this.tokenList.length) { return false; }
    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }
  interpretAsNodes () {
    throw new Error(`unimplemented`);
  }
  interpretAsEdges () {
    throw new Error(`unimplemented`);
  }
}
Object.defineProperty(GenericClass, 'type', {
  get () {
    return /(.*)Class/.exec(this.name)[1];
  }
});
export default GenericClass;
