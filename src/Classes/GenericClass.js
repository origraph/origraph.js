import Introspectable from '../Common/Introspectable.js';
import Stream from '../Stream.js';

class GenericClass extends Introspectable {
  constructor (options) {
    super();
    this.mure = options.mure;
    this.classId = options.classId;
    this.selector = options.selector;
    this._customClassName = options.customName || null;
    this.indexes = options.indexes || {};
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.namedFunctions = Object.assign({},
      this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.tokenClassList = this.mure.parseSelector(options.selector);
  }
  async toRawObject () {
    const result = {
      classType: this.constructor.name,
      selector: this.selector,
      customName: this._customClassName,
      classId: this.classId,
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
  set className (value) {
    this._customClassName = value;
  }
  get className () {
    if (this._customClassName) {
      return this._customClassName;
    }
    // const { lastToken, lastArgList } = this.tokenClassList[this.tokenClassList.length - 1];
    return 'todo: auto class name';
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
    this.mure.classes[this.classId] = new this.mure.CLASSES.NodeClass(options);
    await this.mure.saveClasses();
    return this.mure.classes[this.classId];
  }
  async interpretAsEdges () {
    const options = await this.toRawObject();
    options.mure = this.mure;
    this.mure.classes[this.classId] = new this.mure.CLASSES.EdgeClass(options);
    await this.mure.saveClasses();
    return this.mure.classes[this.classId];
  }
  async aggregate (hash, reduce) {
    throw new Error(`unimplemented`);
  }
  async expand (map) {
    throw new Error(`unimplemented`);
  }
  async filter (filter) {
    throw new Error(`unimplemented`);
  }
  async * split (hash) {
    throw new Error(`unimplemented`);
  }
}
Object.defineProperty(GenericClass, 'type', {
  get () {
    return /(.*)Class/.exec(this.name)[1];
  }
});
export default GenericClass;
