import Introspectable from '../Common/Introspectable.js';
import Stream from '../Stream.js';

class GenericClass extends Introspectable {
  constructor (options) {
    super();
    this.mure = options.mure;
    this.classId = options.classId;
    this._selector = options.selector;
    this.customClassName = options.customClassName || null;
    this.opsSinceCustomName = options.opsSinceCustomName || null;
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.indexes = options.indexes || {};
    this.namedFunctions = Object.assign({},
      this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    for (let [funcName, func] of Object.entries(this.namedFunctions)) {
      if (typeof func === 'string') {
        this.namedFunctions[funcName] = new Function(func); // eslint-disable-line no-new-func
      }
    }
  }
  get selector () {
    return this._selector;
  }
  get tokenClassList () {
    return this.mure.parseSelector(this.selector);
  }
  async toRawObject () {
    const result = {
      classType: this.constructor.name,
      selector: this._selector,
      customClassName: this.customClassName,
      opsSinceCustomName: this.opsSinceCustomName,
      classId: this.classId,
      indexes: {},
      namedFunctions: {}
    };
    for (let [funcName, func] of Object.entries(this.namedFunctions)) {
      result.namedFunctions[funcName] = func.toString();
    }
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
    this.customClassName = value;
    this.opsSinceCustomName = 0;
  }
  get className () {
    if (this.opsSinceCustomName === null) {
      return this.selector;
    } else {
      const tokenStrings = this.selector.match(/\.([^(]*)\(([^)]*)\)/g);
      if (this.opsSinceCustomName > tokenStrings.length) {
        return this.selector;
      } else {
        const sliceIndex = tokenStrings.length - this.opsSinceCustomName;
        return `${this.customClassName}.${tokenStrings.slice(sliceIndex).join('.')}`;
      }
    }
  }
  setNamedFunction (funcName, func) {
    this.namedFunctions[funcName] = func;
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
