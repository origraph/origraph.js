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
    this._customClassName = options.customName || null;
    this.tokenClassList = this.mure.parseSelector(options.selector);
    this.indexes = options.indexes || {};
  }
  async toRawObject () {
    const result = {
      classType: this.constructor.name,
      selector: this.selector,
      customName: this._customClassName,
      indexes: {}
    };
    await Promise.all(Object.entries(this.indexes).map(async ([funcName, index]) => {
      if (index.complete) {
        result.indexes[funcName] = await index.toRawObject();
      }
    }));
    return result;
  }
  wrap (options) {
    return new this.Wrapper(options);
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
  async interpretAsNodes () {
    const options = await this.toRawObject();
    options.mure = this.mure;
    this.mure.classes[this.selector] = new this.mure.CLASSES.NodeClass(options);
    await this.mure.saveClasses();
    return this.mure.classes[this.selector];
  }
  async interpretAsEdges () {
    const options = await this.toRawObject();
    options.mure = this.mure;
    this.mure.classes[this.selector] = new this.mure.CLASSES.EdgeClass(options);
    await this.mure.saveClasses();
    return this.mure.classes[this.selector];
  }
}
Object.defineProperty(GenericClass, 'type', {
  get () {
    return /(.*)Class/.exec(this.name)[1];
  }
});
export default GenericClass;
