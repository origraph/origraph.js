import Introspectable from '../Common/Introspectable.js';
import Stream from '../Stream.js';

const ASTERISKS = {
  'evaluate': '↬',
  'join': '⨯',
  'map': '↦',
  'promote': '↑',
  'value': '→'
};

class GenericClass extends Introspectable {
  constructor (options) {
    super();
    this.mure = options.mure;
    this.classId = options.classId;
    this._selector = options.selector;
    this.customClassName = options.customClassName || null;
    this.customNameTokenIndex = options.customNameTokenIndex || null;
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.indexes = options.indexes || {};
    this.namedFunctions = Object.assign({},
      this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    for (let [funcName, func] of Object.entries(this.namedFunctions)) {
      if (typeof func === 'string') {
        this.namedFunctions[funcName] = new Function(`return ${func}`)(); // eslint-disable-line no-new-func
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
      customNameTokenIndex: this.customNameTokenIndex,
      classId: this.classId,
      indexes: {},
      namedFunctions: {}
    };
    for (let [funcName, func] of Object.entries(this.namedFunctions)) {
      let stringifiedFunc = func.toString();
      // Istanbul adds some code to functions for computing coverage, that gets
      // included in the stringification process during testing. See:
      // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022
      stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
      result.namedFunctions[funcName] = stringifiedFunc;
    }
    await Promise.all(Object.entries(this.indexes).map(async ([funcName, index]) => {
      if (index.complete) {
        result.indexes[funcName] = await index.toRawObject();
      }
    }));
    return result;
  }
  async setClassName (value) {
    if (this.customClassName !== value) {
      this.customClassName = value;
      this.customNameTokenIndex = this.selector.match(/\.([^(]*)\(([^)]*)\)/g).length;
      await this.mure.saveClasses();
    }
  }
  get hasCustomName () {
    return this.customClassName !== null &&
      this.customNameTokenIndex === this.selector.match(/\.([^(]*)\(([^)]*)\)/g).length;
  }
  get className () {
    const selector = this.selector;
    const tokenStrings = selector.match(/\.([^(]*)\(([^)]*)\)/g);
    let result = '';
    for (let i = tokenStrings.length - 1; i >= 0; i--) {
      if (this.customClassName !== null && i <= this.customNameTokenIndex) {
        return this.customClassName + result;
      }
      const temp = tokenStrings[i].match(/^.([^(]*)\(([^)]*)\)/);
      if (temp[1] === 'keys' || temp[1] === 'values') {
        if (temp[2] === '') {
          result = '*' + result;
        } else {
          result = temp[2].replace(/'([^']*)'/, '$1') + result;
        }
      } else {
        result = ASTERISKS[temp[1]] + result;
      }
    }
    return (selector.startsWith('empty') ? '∅' : '') + result;
  }
  addHashFunction (funcName, func) {
    this.namedFunctions[funcName] = func;
  }
  populateStreamOptions (options = {}) {
    options.mure = this.mure;
    options.tokenClassList = this.tokenClassList;
    options.namedFunctions = this.namedFunctions;
    options.launchedFromClass = this;
    options.indexes = this.indexes;
    return options;
  }
  getStream (options = {}) {
    if (options.reset || !this._stream) {
      this._stream = new Stream(this.populateStreamOptions(options));
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
  async split (hash) {
    throw new Error(`unimplemented`);
  }
  async delete () {
    delete this.mure.classes[this.classId];
    await this.mure.saveClasses();
  }
}
Object.defineProperty(GenericClass, 'type', {
  get () {
    return /(.*)Class/.exec(this.name)[1];
  }
});
export default GenericClass;
