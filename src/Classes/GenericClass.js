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
    this._mure = options.mure;
    this.classId = options.classId;
    this._selector = options.selector;
    this.customClassName = options.customClassName || null;
    this.customNameTokenIndex = options.customNameTokenIndex || null;
    this.annotations = options.annotations || [];
    this.Wrapper = this._mure.WRAPPERS.GenericWrapper;
    this.namedFunctions = Object.assign({},
      this._mure.NAMED_FUNCTIONS, options.namedFunctions || {});
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
    return this._mure.parseSelector(this.selector);
  }
  toRawObject () {
    const result = {
      classType: this.constructor.name,
      selector: this._selector,
      customClassName: this.customClassName,
      customNameTokenIndex: this.customNameTokenIndex,
      annotations: this.annotations,
      classId: this.classId,
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
    return result;
  }
  setClassName (value) {
    if (this.customClassName !== value) {
      this.customClassName = value;
      this.customNameTokenIndex = this.selector.match(/\.([^(]*)\(([^)]*)\)/g).length;
      this._mure.saveClasses();
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
  addAttributeAsHashFunction (attrName) {
    this.namedFunctions[attrName] = function * (wrappedItem) {
      yield wrappedItem.rawItem[attrName];
    };
  }
  expandAttributeAsHashFunction (attrName, delimiter = ',') {
    this.namedFunctions[attrName] = function * (wrappedItem) {
      for (const value of wrappedItem.rawItem.split(delimiter)) {
        yield value.trim();
      }
    };
  }
  populateStreamOptions (options = {}) {
    options.mure = this._mure;
    options.tokenClassList = this.tokenClassList;
    options.namedFunctions = this.namedFunctions;
    options.launchedFromClass = this;
    return options;
  }
  getStream (options = {}) {
    return new Stream(this.populateStreamOptions(options));
  }
  isSuperSetOfTokenList (tokenList) {
    if (tokenList.length !== this.tokenList.length) { return false; }
    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }
  interpretAsNodes () {
    const options = this.toRawObject();
    options.ClassType = this._mure.CLASSES.NodeClass;
    return this._mure.newClass(options);
  }
  interpretAsEdges () {
    const options = this.toRawObject();
    options.ClassType = this._mure.CLASSES.EdgeClass;
    return this._mure.newClass(options);
  }
  aggregate (hash, reduce) {
    throw new Error(`unimplemented`);
  }
  expand (map) {
    throw new Error(`unimplemented`);
  }
  filter (filter) {
    throw new Error(`unimplemented`);
  }
  split (hash) {
    throw new Error(`unimplemented`);
  }
  delete () {
    delete this._mure.classes[this.classId];
    this._mure.saveClasses();
  }
}
Object.defineProperty(GenericClass, 'type', {
  get () {
    return /(.*)Class/.exec(this.name)[1];
  }
});
export default GenericClass;
