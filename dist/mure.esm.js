import md5 from 'blueimp-md5';
import mime from 'mime-types';
import datalib from 'datalib';

const TriggerableMixin = function (superclass) {
  return class extends superclass {
    constructor() {
      super(...arguments);
      this._instanceOfTriggerableMixin = true;
      this.eventHandlers = {};
      this.stickyTriggers = {};
    }
    on(eventName, callback, allowDuplicateListeners) {
      if (!this.eventHandlers[eventName]) {
        this.eventHandlers[eventName] = [];
      }
      if (!allowDuplicateListeners) {
        if (this.eventHandlers[eventName].indexOf(callback) !== -1) {
          return;
        }
      }
      this.eventHandlers[eventName].push(callback);
    }
    off(eventName, callback) {
      if (this.eventHandlers[eventName]) {
        if (!callback) {
          delete this.eventHandlers[eventName];
        } else {
          let index = this.eventHandlers[eventName].indexOf(callback);
          if (index >= 0) {
            this.eventHandlers[eventName].splice(index, 1);
          }
        }
      }
    }
    trigger(eventName, ...args) {
      if (this.eventHandlers[eventName]) {
        this.eventHandlers[eventName].forEach(callback => {
          window.setTimeout(() => {
            // Add timeout to prevent blocking
            callback.apply(this, args);
          }, 0);
        });
      }
    }
    stickyTrigger(eventName, argObj, delay = 10) {
      this.stickyTriggers[eventName] = this.stickyTriggers[eventName] || { argObj: {} };
      Object.assign(this.stickyTriggers[eventName].argObj, argObj);
      clearTimeout(this.stickyTriggers.timeout);
      this.stickyTriggers.timeout = setTimeout(() => {
        let argObj = this.stickyTriggers[eventName].argObj;
        delete this.stickyTriggers[eventName];
        this.trigger(eventName, argObj);
      }, delay);
    }
  };
};
Object.defineProperty(TriggerableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfTriggerableMixin
});

var asyncIterator = function (iterable) {
  if (typeof Symbol === "function") {
    if (Symbol.asyncIterator) {
      var method = iterable[Symbol.asyncIterator];
      if (method != null) return method.call(iterable);
    }

    if (Symbol.iterator) {
      return iterable[Symbol.iterator]();
    }
  }

  throw new TypeError("Object is not async iterable");
};

var asyncGenerator = function () {
  function AwaitValue(value) {
    this.value = value;
  }

  function AsyncGenerator(gen) {
    var front, back;

    function send(key, arg) {
      return new Promise(function (resolve, reject) {
        var request = {
          key: key,
          arg: arg,
          resolve: resolve,
          reject: reject,
          next: null
        };

        if (back) {
          back = back.next = request;
        } else {
          front = back = request;
          resume(key, arg);
        }
      });
    }

    function resume(key, arg) {
      try {
        var result = gen[key](arg);
        var value = result.value;

        if (value instanceof AwaitValue) {
          Promise.resolve(value.value).then(function (arg) {
            resume("next", arg);
          }, function (arg) {
            resume("throw", arg);
          });
        } else {
          settle(result.done ? "return" : "normal", result.value);
        }
      } catch (err) {
        settle("throw", err);
      }
    }

    function settle(type, value) {
      switch (type) {
        case "return":
          front.resolve({
            value: value,
            done: true
          });
          break;

        case "throw":
          front.reject(value);
          break;

        default:
          front.resolve({
            value: value,
            done: false
          });
          break;
      }

      front = front.next;

      if (front) {
        resume(front.key, front.arg);
      } else {
        back = null;
      }
    }

    this._invoke = send;

    if (typeof gen.return !== "function") {
      this.return = undefined;
    }
  }

  if (typeof Symbol === "function" && Symbol.asyncIterator) {
    AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  return {
    wrap: function (fn) {
      return function () {
        return new AsyncGenerator(fn.apply(this, arguments));
      };
    },
    await: function (value) {
      return new AwaitValue(value);
    }
  };
}();

var asyncGeneratorDelegate = function (inner, awaitWrap) {
  var iter = {},
      waiting = false;

  function pump(key, value) {
    waiting = true;
    value = new Promise(function (resolve) {
      resolve(inner[key](value));
    });
    return {
      done: false,
      value: awaitWrap(value)
    };
  }

  if (typeof Symbol === "function" && Symbol.iterator) {
    iter[Symbol.iterator] = function () {
      return this;
    };
  }

  iter.next = function (value) {
    if (waiting) {
      waiting = false;
      return value;
    }

    return pump("next", value);
  };

  if (typeof inner.throw === "function") {
    iter.throw = function (value) {
      if (waiting) {
        waiting = false;
        throw value;
      }

      return pump("throw", value);
    };
  }

  if (typeof inner.return === "function") {
    iter.return = function (value) {
      return pump("return", value);
    };
  }

  return iter;
};

var asyncToGenerator = function (fn) {
  return function () {
    var gen = fn.apply(this, arguments);
    return new Promise(function (resolve, reject) {
      function step(key, arg) {
        try {
          var info = gen[key](arg);
          var value = info.value;
        } catch (error) {
          reject(error);
          return;
        }

        if (info.done) {
          resolve(value);
        } else {
          return Promise.resolve(value).then(function (value) {
            step("next", value);
          }, function (err) {
            step("throw", err);
          });
        }
      }

      return step("next");
    });
  };
};

const DEFAULT_FUNCTIONS = {
  identity: function* (wrappedParent) {
    yield wrappedParent.rawItem;
  },
  md5: wrappedParent => md5(wrappedParent.rawItem),
  noop: () => {}
};

class Stream {
  constructor({
    mure,
    selector = 'root',
    functions = {},
    streams = {},
    errorMode = 'permissive',
    traversalMode = 'DFS'
  }) {
    this.mure = mure;

    this.tokenList = this.parseSelector(selector);

    this.functions = Object.assign({}, DEFAULT_FUNCTIONS, functions);
    this.streams = streams;
    this.errorMode = errorMode;
    this.traversalMode = traversalMode;
  }
  get selector() {
    return this.tokenList.join('');
  }
  parseSelector(selectorString) {
    if (!selectorString.startsWith('root')) {
      throw new SyntaxError(`Selectors must start with 'root'`);
    }
    const tokenStrings = selectorString.match(/\.([^(]*)\(([^)]*)\)/g);
    if (!tokenStrings) {
      throw new SyntaxError(`Invalid selector string: ${selectorString}`);
    }
    const tokenList = [];
    tokenStrings.forEach(chunk => {
      const temp = chunk.match(/^.([^(]*)\(([^)]*)\)/);
      if (!temp) {
        throw new SyntaxError(`Invalid token: ${chunk}`);
      }
      const tokenClassName = temp[1][0].toUpperCase() + temp[1].slice(1) + 'Token';
      const argList = temp[2].split(/(?<!\\),/).map(d => d.trim());
      if (tokenClassName === 'ValuesToken') {
        tokenList.push(new this.mure.TOKENS.KeysToken(this, argList));
        tokenList.push(new this.mure.TOKENS.ValueToken(this, []));
      } else if (this.mure.TOKENS[tokenClassName]) {
        tokenList.push(new this.mure.TOKENS[tokenClassName](this, argList));
      } else {
        throw new SyntaxError(`Unknown token: ${temp[1]}`);
      }
    });
    return tokenList;
  }
  iterate() {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      if (_this.traversalMode === 'BFS') {
        throw new Error(`Breadth-first iteration is not yet implemented.`);
      } else if (_this.traversalMode === 'DFS') {
        const deepHelper = _this.deepHelper(_this.tokenList, _this.tokenList.length - 1);
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = asyncIterator(deepHelper), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const finishedPath = _value;

            yield finishedPath;
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              yield asyncGenerator.await(_iterator.return());
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      } else {
        throw new Error(`Unknown traversalMode: ${_this.traversalMode}`);
      }
    })();
  }
  /**
   * This helps depth-first iteration (we only want to yield finished paths, so
   * it lazily asks for them one at a time from the *final* token, recursively
   * asking each preceding token to yield dependent paths only as needed)
   */
  deepHelper(tokenList, i) {
    var _this2 = this;

    return asyncGenerator.wrap(function* () {
      if (i === 0) {
        yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(tokenList[0].navigate()))), asyncGenerator.await); // The first token is always the root
      } else {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = asyncIterator(_this2.deepHelper(tokenList, i - 1)), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
            let wrappedParent = _value2;

            try {
              yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(tokenList[i].navigate(wrappedParent)))), asyncGenerator.await);
            } catch (err) {
              if (_this2.errorMode !== 'permissive' || !(err instanceof TypeError && err instanceof SyntaxError)) {
                throw err;
              }
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              yield asyncGenerator.await(_iterator2.return());
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      }
    })();
  }

  sample({ limit = 10 }) {
    var _this3 = this;

    return asyncGenerator.wrap(function* () {
      const iterator = yield asyncGenerator.await(_this3.iterate());
      for (let i = 0; i < limit; i++) {
        yield iterator.next().value;
      }
    })();
  }

  extend(TokenClass, argList, functions = {}, streams = {}) {
    const newStream = new Stream({
      mure: this.mure,
      functions: Object.assign({}, this.functions, functions),
      streams: Object.assign({}, this.streams, streams),
      mode: this.mode
    });
    newStream.tokenList = this.tokenList.concat([new TokenClass(newStream, argList)]);
    return newStream;
  }

  isSuperSetOfTokenList(tokenList) {
    if (tokenList.length !== this.tokenList.length) {
      return false;
    }
    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }
}

class Introspectable {
  get type() {
    return this.constructor.type;
  }
  get lowerCamelCaseType() {
    return this.constructor.lowerCamelCaseType;
  }
  get humanReadableType() {
    return this.constructor.humanReadableType;
  }
}
Object.defineProperty(Introspectable, 'type', {
  // This can / should be overridden by subclasses that follow a common string
  // pattern, such as RootToken, KeysToken, ParentToken, etc.
  configurable: true,
  get() {
    return this.type;
  }
});
Object.defineProperty(Introspectable, 'lowerCamelCaseType', {
  get() {
    const temp = this.type;
    return temp.replace(/./, temp[0].toLocaleLowerCase());
  }
});
Object.defineProperty(Introspectable, 'humanReadableType', {
  get() {
    // CamelCase to Sentence Case
    return this.type.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
});

class BaseToken extends Introspectable {
  constructor(stream) {
    super();
    this.stream = stream;
  }
  toString() {
    // The string version of most tokens can just be derived from the class type
    return `.${this.type.toLowerCase()}()`;
  }
  isSuperSetOf(otherToken) {
    return otherToken.constructor === this.constructor;
  }
  navigate(wrappedParent) {
    return asyncGenerator.wrap(function* () {
      throw new Error(`This function should be overridden`);
    })();
  }
}
Object.defineProperty(BaseToken, 'type', {
  get() {
    return (/(.*)Token/.exec(this.name)[1]
    );
  }
});

class RootToken extends BaseToken {
  *navigate() {
    yield this.stream.mure.wrap({
      wrappedParent: null,
      token: this,
      value: this.stream.mure.root
    });
  }
  toString() {
    return `root`;
  }
}

class KeysToken extends BaseToken {
  constructor(stream, argList, { matchAll, keys, ranges }) {
    super(stream);
    if (keys || ranges) {
      this.keys = keys;
      this.ranges = ranges;
    } else if (argList && argList.length === 0 || matchAll) {
      this.matchAll = true;
    } else {
      argList.forEach(arg => {
        let temp = arg.match(/(\d+)-([\d∞]+)/);
        if (temp && temp[2] === '∞') {
          temp[2] = Infinity;
        }
        temp = temp ? temp.map(d => d.parseInt(d)) : null;
        if (temp && !isNaN(temp[1]) && !isNaN(temp[2])) {
          for (let i = temp[1]; i <= temp[2]; i++) {
            this.ranges = this.ranges || [];
            this.ranges.push({ low: temp[1], high: temp[2] });
          }
          return;
        }
        temp = arg.match(/'(.*)'/);
        temp = temp && temp[1] ? temp[1] : arg;
        let num = Number(temp);
        if (isNaN(num) || num !== parseInt(temp)) {
          // leave non-integer numbers as strings
          this.keys = this.keys || {};
          this.keys[temp] = true;
        } else {
          this.ranges = this.ranges || [];
          this.ranges.push({ low: num, high: num });
        }
      });
      if (!this.keys && !this.ranges) {
        throw new SyntaxError(`Bad token key(s) / range(s): ${JSON.stringify(argList)}`);
      }
    }
    if (this.ranges) {
      this.ranges = this.consolidateRanges(this.ranges);
    }
  }
  get selectsNothing() {
    return !this.matchAll && !this.keys && !this.ranges;
  }
  consolidateRanges(ranges) {
    // Merge any overlapping ranges
    const newRanges = [];
    const temp = ranges.sort((a, b) => a.low - b.low);
    let currentRange = null;
    for (let i = 0; i < temp.length; i++) {
      if (!currentRange) {
        currentRange = temp[i];
      } else if (temp[i].low <= currentRange.high) {
        currentRange.high = temp[i].high;
      } else {
        newRanges.push(currentRange);
        currentRange = temp[i];
      }
    }
    if (currentRange) {
      // Corner case: add the last range
      newRanges.push(currentRange);
    }
    return newRanges.length > 0 ? newRanges : undefined;
  }
  isSuperSetOf(otherToken) {
    if (!(otherToken instanceof KeysToken)) {
      return false;
    } else {
      const diff = otherToken.difference(this);
      return diff === null || diff.selectsNothing;
    }
  }
  toString() {
    if (this.matchAll) {
      return '.keys()';
    }
    return '.keys(' + this.ranges.map(({ low, high }) => `${low}-${high}`).concat(Object.keys(this.keys).map(key => `'${key}'`)).join(',') + ')';
  }
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      if (typeof wrappedParent.rawItem !== 'object') {
        throw new TypeError(`Input to KeysToken is not an object`);
      }
      if (_this.matchAll) {
        for (let key in wrappedParent.rawItem) {
          yield _this.stream.mure.wrap({
            wrappedParent,
            token: _this,
            rawItem: key
          });
        }
      } else {
        for (let _ref of _this.ranges || []) {
          let { low, high } = _ref;

          low = Math.max(0, low);
          high = Math.min(wrappedParent.rawItem.length - 1, high);
          for (let i = low; i <= high; i++) {
            if (wrappedParent.rawItem[i] !== undefined) {
              yield _this.stream.mure.wrap({
                wrappedParent,
                token: _this,
                rawItem: i
              });
            }
          }
        }
        for (let key in _this.keys || {}) {
          if (wrappedParent.rawItem.hasOwnProperty(key)) {
            yield _this.stream.mure.wrap({
              wrappedParent,
              token: _this,
              rawItem: key
            });
          }
        }
      }
    })();
  }
}

class ValueToken extends BaseToken {
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      const obj = wrappedParent && wrappedParent.wrappedParent && wrappedParent.wrappedParent.rawItem;
      const key = wrappedParent && wrappedParent.rawItem;
      const keyType = typeof key;
      if (typeof obj !== 'object' || keyType !== 'string' && keyType !== 'number') {
        throw new TypeError(`ValueToken used on a non-object, or without a string / numeric key`);
      }
      yield _this.stream.mure.wrap({
        wrappedParent,
        token: _this,
        rawItem: obj[key]
      });
    })();
  }
}

class EvaluateToken extends BaseToken {
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      if (typeof wrappedParent.value !== 'string') {
        throw new TypeError(`Input to EvaluateToken is not a string`);
      }
      let newStream = _this.stream.mure.stream({
        selector: wrappedParent.value,
        functions: _this.stream.functions,
        streams: _this.stream.streams,
        errorMode: _this.stream.errorMode,
        traversalMode: _this.stream.traversalMode
      });
      yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(newStream.iterate()))), asyncGenerator.await);
    })();
  }
}

class MapToken extends BaseToken {
  constructor(stream, [generator = 'identity']) {
    super(stream);
    if (!stream.functions[generator]) {
      throw new SyntaxError(`Unknown function: ${generator}`);
    }
    this.generator = stream.functions[generator];
  }
  toString() {
    return `.map(${this.generator})`;
  }
  isSuperSetOf(otherToken) {
    return otherToken.constructor === MapToken && otherToken.generator === this.generator;
  }
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.generator(wrappedParent)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const mappedRawItem = _value;

          yield _this.stream.mure.wrap({
            wrappedParent,
            token: _this,
            rawItem: mappedRawItem
          });
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            yield asyncGenerator.await(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }
}

class PromoteToken extends BaseToken {
  constructor(stream, [map = 'identity', hash = 'md5', reduceInstances = 'noop']) {
    super(stream);
    for (const func of [map, hash, reduceInstances]) {
      if (!stream.functions[func]) {
        throw new SyntaxError(`Unknown function: ${func}`);
      }
    }
    this.map = map;
    this.hash = hash;
    this.reduceInstances = reduceInstances;

    this.seenItems = {};
  }
  toString() {
    return `.promote(${this.map}, ${this.hash}, ${this.reduceInstances})`;
  }
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.map(wrappedParent)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const mappedRawItem = _value;

          const hash = _this.hash(mappedRawItem);
          if (_this.seenItems[hash]) {
            _this.reduceInstances(_this.seenItems[hash], mappedRawItem);
            _this.seenItems[hash].trigger('update');
          } else {
            _this.seenItems[hash] = _this.stream.mure.wrap({
              wrappedParent,
              token: _this,
              rawItem: mappedRawItem
            });
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            yield asyncGenerator.await(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }
}



var TOKENS = /*#__PURE__*/Object.freeze({
  RootToken: RootToken,
  KeysToken: KeysToken,
  ValueToken: ValueToken,
  EvaluateToken: EvaluateToken,
  MapToken: MapToken,
  PromoteToken: PromoteToken
});

class GenericConstruct extends Introspectable {
  constructor(mure, selector, classNames = []) {
    super();
    this.mure = mure;
    this.selector = selector;
    this.classNames = classNames;
    this.annotations = [];
  }
  wrap({ parent, token, rawItem }) {
    return new this.mure.WRAPPERS.GenericWrapper({ parent, token, rawItem });
  }
  stream(options = {}) {
    options.selector = this.selector;
    return this.mure.stream(options);
  }
}
Object.defineProperty(GenericConstruct, 'type', {
  get() {
    return (/(.*)Construct/.exec(this.name)[1]
    );
  }
});

class NodeConstruct extends GenericConstruct {}

class EdgeConstruct extends GenericConstruct {}



var CONSTRUCTS = /*#__PURE__*/Object.freeze({
  GenericConstruct: GenericConstruct,
  NodeConstruct: NodeConstruct,
  EdgeConstruct: EdgeConstruct
});

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor({ parent, token, rawItem }) {
    super();
    this.parent = parent;
    this.token = token;
    this.rawItem = rawItem;
  }
}
Object.defineProperty(GenericWrapper, 'type', {
  get() {
    return (/(.*)Wrapper/.exec(this.name)[1]
    );
  }
});

class NodeWrapper extends GenericWrapper {}

class EdgeWrapper extends GenericWrapper {}



var WRAPPERS = /*#__PURE__*/Object.freeze({
  GenericWrapper: GenericWrapper,
  NodeWrapper: NodeWrapper,
  EdgeWrapper: EdgeWrapper
});

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node
    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    // Object containing each of our data sources
    this.root = {};
    this.classes = {};

    // extensions that we want datalib to handle
    this.DATALIB_FORMATS = {
      'json': 'json',
      'csv': 'csv',
      'tsv': 'tsv',
      'topojson': 'topojson',
      'treejson': 'treejson'
    };

    this.TRUTHY_STRINGS = {
      'true': true,
      'yes': true,
      'y': true
    };
    this.FALSEY_STRINGS = {
      'false': true,
      'no': true,
      'n': true
    };

    // Access to core classes via the main library helps avoid circular imports
    this.TOKENS = TOKENS;
    this.CONSTRUCTS = CONSTRUCTS;
    this.WRAPPERS = WRAPPERS;

    // Monkey-patch available tokens as functions onto the Stream class
    for (const tokenClassName in this.TOKENS) {
      const TokenClass = this.TOKENS[tokenClassName];
      Stream.prototype[TokenClass.lowerCamelCaseType] = function (argList, functions, streams) {
        return this.extend(TokenClass, argList, functions, streams);
      };
    }
  }

  stream(options = {}) {
    options.mure = this;
    return new Stream(options);
  }
  wrap({ wrappedParent, token, rawItem }) {
    const tokenList = [token];
    let temp = wrappedParent;
    while (temp !== null) {
      tokenList.unshift(temp.token);
      temp = temp.parent;
    }
    for (let classSelector of this.classes) {
      const construct = this.classes[classSelector];
      if (construct.stream.isSuperSetOfTokenList(tokenList)) {
        return construct.wrap({ parent: wrappedParent, token, rawItem });
      }
    }
    return new this.WRAPPERS.GenericWrapper({ parent: wrappedParent, token, rawItem });
  }

  newClass({ ClassType, selector, classNames }) {
    if (this.classes[selector]) {
      return this.classes[selector];
    }
    this.classes[selector] = new ClassType({ mure: this, selector, classNames });
    return this.classes[selector];
  }

  addFileAsStaticDataSource({
    fileObj,
    encoding = mime.charset(fileObj.type),
    extensionOverride = null,
    skipSizeCheck = false
  } = {}) {
    var _this = this;

    return asyncToGenerator(function* () {
      const fileMB = fileObj.size / 1048576;
      if (fileMB >= 30) {
        if (skipSizeCheck) {
          console.warn(`Attempting to load ${fileMB}MB file into memory`);
        } else {
          throw new Error(`${fileMB}MB file is too large to load statically; try addDynamicDataSource() instead.`);
        }
      }
      // extensionOverride allows things like topojson or treejson (that don't
      // have standardized mimeTypes) to be parsed correctly
      let text = yield new Promise(function (resolve, reject) {
        let reader = new _this.FileReader();
        reader.onload = function () {
          resolve(reader.result);
        };
        reader.readAsText(fileObj, encoding);
      });
      return _this.addStringAsStaticDataSource({
        key: fileObj.name,
        extension: extensionOverride || mime.extension(fileObj.type),
        text
      });
    })();
  }
  addStringAsStaticDataSource({
    key,
    extension = 'txt',
    text
  }) {
    var _this2 = this;

    return asyncToGenerator(function* () {
      let obj;
      if (_this2.DATALIB_FORMATS[extension]) {
        obj = datalib.read(text, { type: extension });
      } else if (extension === 'xml') {
        throw new Error('unimplemented');
      } else if (extension === 'txt') {
        throw new Error('unimplemented');
      } else {
        throw new Error(`Unsupported file extension: ${extension}`);
      }
      return _this2.addStaticDataSource(key, obj);
    })();
  }
  addStaticDataSource(key, obj) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      _this3.root[key] = obj;
      return _this3.newClass({
        selector: `root.values('${key}')`,
        ClassType: _this3.CONSTRUCTS.GenericConstruct,
        classNames: [key]
      });
    })();
  }
}

var name = "mure";
var version = "0.4.2";
var description = "An integration library for the mure ecosystem of apps";
var main = "dist/mure.cjs.js";
var module$1 = "dist/mure.esm.js";
var browser = "dist/mure.umd.js";
var scripts = {
	build: "rollup -c --environment TARGET:all",
	watch: "rollup -c -w",
	watchcjs: "rollup -c -w --environment TARGET:cjs",
	watchumd: "rollup -c -w --environment TARGET:umd",
	watchesm: "rollup -c -w --environment TARGET:esm",
	test: "jest",
	pretest: "rollup -c --environment TARGET:cjs",
	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && node --inspect-brk node_modules/.bin/jest --runInBand -t",
	coveralls: "cat ./coverage/lcov.info | node node_modules/.bin/coveralls"
};
var files = ["dist"];
var repository = {
	type: "git",
	url: "git+https://github.com/mure-apps/mure-library.git"
};
var author = "Alex Bigelow";
var license = "MIT";
var bugs = {
	url: "https://github.com/mure-apps/mure-library/issues"
};
var homepage = "https://github.com/mure-apps/mure-library#readme";
var devDependencies = {
	"babel-core": "^6.26.3",
	"babel-plugin-external-helpers": "^6.22.0",
	"babel-preset-env": "^1.7.0",
	"babel-preset-stage-3": "^6.24.1",
	coveralls: "^3.0.2",
	filereader: "^0.10.3",
	jest: "^23.5.0",
	"pouchdb-node": "^7.0.0",
	rollup: "^0.64.1",
	"rollup-plugin-babel": "^3.0.7",
	"rollup-plugin-commonjs": "^9.1.5",
	"rollup-plugin-json": "^3.0.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.2.1",
	"rollup-plugin-node-resolve": "^3.3.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	"blueimp-md5": "^2.10.0",
	datalib: "^1.9.1",
	"mime-types": "^2.1.19"
};
var peerDependencies = {
	d3: "^5.4.0"
};
var pkg = {
	name: name,
	version: version,
	description: description,
	main: main,
	module: module$1,
	"jsnext:main": "dist/mure.esm.js",
	browser: browser,
	scripts: scripts,
	files: files,
	repository: repository,
	author: author,
	license: license,
	bugs: bugs,
	homepage: homepage,
	devDependencies: devDependencies,
	dependencies: dependencies,
	peerDependencies: peerDependencies
};

let mure = new Mure(window.FileReader);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL0NvbnN0cnVjdHMvR2VuZXJpY0NvbnN0cnVjdC5qcyIsIi4uL3NyYy9Db25zdHJ1Y3RzL05vZGVDb25zdHJ1Y3QuanMiLCIuLi9zcmMvQ29uc3RydWN0cy9FZGdlQ29uc3RydWN0LmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJpbXBvcnQgbWQ1IGZyb20gJ2JsdWVpbXAtbWQ1JztcblxuY29uc3QgREVGQVVMVF9GVU5DVElPTlMgPSB7XG4gIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkUGFyZW50KSB7IHlpZWxkIHdyYXBwZWRQYXJlbnQucmF3SXRlbTsgfSxcbiAgbWQ1OiAod3JhcHBlZFBhcmVudCkgPT4gbWQ1KHdyYXBwZWRQYXJlbnQucmF3SXRlbSksXG4gIG5vb3A6ICgpID0+IHt9XG59O1xuXG5jbGFzcyBTdHJlYW0ge1xuICBjb25zdHJ1Y3RvciAoe1xuICAgIG11cmUsXG4gICAgc2VsZWN0b3IgPSAncm9vdCcsXG4gICAgZnVuY3Rpb25zID0ge30sXG4gICAgc3RyZWFtcyA9IHt9LFxuICAgIGVycm9yTW9kZSA9ICdwZXJtaXNzaXZlJyxcbiAgICB0cmF2ZXJzYWxNb2RlID0gJ0RGUydcbiAgfSkge1xuICAgIHRoaXMubXVyZSA9IG11cmU7XG5cbiAgICB0aGlzLnRva2VuTGlzdCA9IHRoaXMucGFyc2VTZWxlY3RvcihzZWxlY3Rvcik7XG5cbiAgICB0aGlzLmZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfRlVOQ1RJT05TLCBmdW5jdGlvbnMpO1xuICAgIHRoaXMuc3RyZWFtcyA9IHN0cmVhbXM7XG4gICAgdGhpcy5lcnJvck1vZGUgPSBlcnJvck1vZGU7XG4gICAgdGhpcy50cmF2ZXJzYWxNb2RlID0gdHJhdmVyc2FsTW9kZTtcbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5qb2luKCcnKTtcbiAgfVxuICBwYXJzZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZykge1xuICAgIGlmICghc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgncm9vdCcpKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFNlbGVjdG9ycyBtdXN0IHN0YXJ0IHdpdGggJ3Jvb3QnYCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yU3RyaW5nLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBpZiAoIXRva2VuU3RyaW5ncykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yIHN0cmluZzogJHtzZWxlY3RvclN0cmluZ31gKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5MaXN0ID0gW107XG4gICAgdG9rZW5TdHJpbmdzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IGNodW5rLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAoIXRlbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuOiAke2NodW5rfWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdG9rZW5DbGFzc05hbWUgPSB0ZW1wWzFdWzBdLnRvVXBwZXJDYXNlKCkgKyB0ZW1wWzFdLnNsaWNlKDEpICsgJ1Rva2VuJztcbiAgICAgIGNvbnN0IGFyZ0xpc3QgPSB0ZW1wWzJdLnNwbGl0KC8oPzwhXFxcXCksLykubWFwKGQgPT4gZC50cmltKCkpO1xuICAgICAgaWYgKHRva2VuQ2xhc3NOYW1lID09PSAnVmFsdWVzVG9rZW4nKSB7XG4gICAgICAgIHRva2VuTGlzdC5wdXNoKG5ldyB0aGlzLm11cmUuVE9LRU5TLktleXNUb2tlbih0aGlzLCBhcmdMaXN0KSk7XG4gICAgICAgIHRva2VuTGlzdC5wdXNoKG5ldyB0aGlzLm11cmUuVE9LRU5TLlZhbHVlVG9rZW4odGhpcywgW10pKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5tdXJlLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0pIHtcbiAgICAgICAgdG9rZW5MaXN0LnB1c2gobmV3IHRoaXMubXVyZS5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKHRoaXMsIGFyZ0xpc3QpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biB0b2tlbjogJHt0ZW1wWzFdfWApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0b2tlbkxpc3Q7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICBpZiAodGhpcy50cmF2ZXJzYWxNb2RlID09PSAnQkZTJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBCcmVhZHRoLWZpcnN0IGl0ZXJhdGlvbiBpcyBub3QgeWV0IGltcGxlbWVudGVkLmApO1xuICAgIH0gZWxzZSBpZiAodGhpcy50cmF2ZXJzYWxNb2RlID09PSAnREZTJykge1xuICAgICAgY29uc3QgZGVlcEhlbHBlciA9IHRoaXMuZGVlcEhlbHBlcih0aGlzLnRva2VuTGlzdCwgdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSk7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGZpbmlzaGVkUGF0aCBvZiBkZWVwSGVscGVyKSB7XG4gICAgICAgIHlpZWxkIGZpbmlzaGVkUGF0aDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHRyYXZlcnNhbE1vZGU6ICR7dGhpcy50cmF2ZXJzYWxNb2RlfWApO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogVGhpcyBoZWxwcyBkZXB0aC1maXJzdCBpdGVyYXRpb24gKHdlIG9ubHkgd2FudCB0byB5aWVsZCBmaW5pc2hlZCBwYXRocywgc29cbiAgICogaXQgbGF6aWx5IGFza3MgZm9yIHRoZW0gb25lIGF0IGEgdGltZSBmcm9tIHRoZSAqZmluYWwqIHRva2VuLCByZWN1cnNpdmVseVxuICAgKiBhc2tpbmcgZWFjaCBwcmVjZWRpbmcgdG9rZW4gdG8geWllbGQgZGVwZW5kZW50IHBhdGhzIG9ubHkgYXMgbmVlZGVkKVxuICAgKi9cbiAgYXN5bmMgKiBkZWVwSGVscGVyICh0b2tlbkxpc3QsIGkpIHtcbiAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgeWllbGQgKiBhd2FpdCB0b2tlbkxpc3RbMF0ubmF2aWdhdGUoKTsgLy8gVGhlIGZpcnN0IHRva2VuIGlzIGFsd2F5cyB0aGUgcm9vdFxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgYXdhaXQgKGxldCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuZGVlcEhlbHBlcih0b2tlbkxpc3QsIGkgLSAxKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHlpZWxkICogYXdhaXQgdG9rZW5MaXN0W2ldLm5hdmlnYXRlKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAodGhpcy5lcnJvck1vZGUgIT09ICdwZXJtaXNzaXZlJyB8fFxuICAgICAgICAgICAgIShlcnIgaW5zdGFuY2VvZiBUeXBlRXJyb3IgJiYgZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgKiBzYW1wbGUgKHsgbGltaXQgPSAxMCB9KSB7XG4gICAgY29uc3QgaXRlcmF0b3IgPSBhd2FpdCB0aGlzLml0ZXJhdGUoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIHlpZWxkIGl0ZXJhdG9yLm5leHQoKS52YWx1ZTtcbiAgICB9XG4gIH1cblxuICBleHRlbmQgKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIGZ1bmN0aW9ucyA9IHt9LCBzdHJlYW1zID0ge30pIHtcbiAgICBjb25zdCBuZXdTdHJlYW0gPSBuZXcgU3RyZWFtKHtcbiAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgIGZ1bmN0aW9uczogT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5mdW5jdGlvbnMsIGZ1bmN0aW9ucyksXG4gICAgICBzdHJlYW1zOiBPYmplY3QuYXNzaWduKHt9LCB0aGlzLnN0cmVhbXMsIHN0cmVhbXMpLFxuICAgICAgbW9kZTogdGhpcy5tb2RlXG4gICAgfSk7XG4gICAgbmV3U3RyZWFtLnRva2VuTGlzdCA9IHRoaXMudG9rZW5MaXN0LmNvbmNhdChbIG5ldyBUb2tlbkNsYXNzKG5ld1N0cmVhbSwgYXJnTGlzdCkgXSk7XG4gICAgcmV0dXJuIG5ld1N0cmVhbTtcbiAgfVxuXG4gIGlzU3VwZXJTZXRPZlRva2VuTGlzdCAodG9rZW5MaXN0KSB7XG4gICAgaWYgKHRva2VuTGlzdC5sZW5ndGggIT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QuZXZlcnkoKHRva2VuLCBpKSA9PiB0b2tlbi5pc1N1cGVyU2V0T2YodG9rZW5MaXN0W2ldKSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbTtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBCYXNlVG9rZW4gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICAvLyBUaGUgc3RyaW5nIHZlcnNpb24gb2YgbW9zdCB0b2tlbnMgY2FuIGp1c3QgYmUgZGVyaXZlZCBmcm9tIHRoZSBjbGFzcyB0eXBlXG4gICAgcmV0dXJuIGAuJHt0aGlzLnR5cGUudG9Mb3dlckNhc2UoKX0oKWA7XG4gIH1cbiAgaXNTdXBlclNldE9mIChvdGhlclRva2VuKSB7XG4gICAgcmV0dXJuIG90aGVyVG9rZW4uY29uc3RydWN0b3IgPT09IHRoaXMuY29uc3RydWN0b3I7XG4gIH1cbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQmFzZVRva2VuLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUb2tlbi8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEJhc2VUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBSb290VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICAqIG5hdmlnYXRlICgpIHtcbiAgICB5aWVsZCB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudDogbnVsbCxcbiAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgdmFsdWU6IHRoaXMuc3RyZWFtLm11cmUucm9vdFxuICAgIH0pO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYHJvb3RgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgS2V5c1Rva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgYXJnTGlzdCwgeyBtYXRjaEFsbCwga2V5cywgcmFuZ2VzIH0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmIChrZXlzIHx8IHJhbmdlcykge1xuICAgICAgdGhpcy5rZXlzID0ga2V5cztcbiAgICAgIHRoaXMucmFuZ2VzID0gcmFuZ2VzO1xuICAgIH0gZWxzZSBpZiAoKGFyZ0xpc3QgJiYgYXJnTGlzdC5sZW5ndGggPT09IDApIHx8IG1hdGNoQWxsKSB7XG4gICAgICB0aGlzLm1hdGNoQWxsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnTGlzdC5mb3JFYWNoKGFyZyA9PiB7XG4gICAgICAgIGxldCB0ZW1wID0gYXJnLm1hdGNoKC8oXFxkKyktKFtcXGTiiJ5dKykvKTtcbiAgICAgICAgaWYgKHRlbXAgJiYgdGVtcFsyXSA9PT0gJ+KInicpIHtcbiAgICAgICAgICB0ZW1wWzJdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IHRlbXAgPyB0ZW1wLm1hcChkID0+IGQucGFyc2VJbnQoZCkpIDogbnVsbDtcbiAgICAgICAgaWYgKHRlbXAgJiYgIWlzTmFOKHRlbXBbMV0pICYmICFpc05hTih0ZW1wWzJdKSkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSB0ZW1wWzFdOyBpIDw9IHRlbXBbMl07IGkrKykge1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IHRlbXBbMV0sIGhpZ2g6IHRlbXBbMl0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gYXJnLm1hdGNoKC8nKC4qKScvKTtcbiAgICAgICAgdGVtcCA9IHRlbXAgJiYgdGVtcFsxXSA/IHRlbXBbMV0gOiBhcmc7XG4gICAgICAgIGxldCBudW0gPSBOdW1iZXIodGVtcCk7XG4gICAgICAgIGlmIChpc05hTihudW0pIHx8IG51bSAhPT0gcGFyc2VJbnQodGVtcCkpIHsgLy8gbGVhdmUgbm9uLWludGVnZXIgbnVtYmVycyBhcyBzdHJpbmdzXG4gICAgICAgICAgdGhpcy5rZXlzID0gdGhpcy5rZXlzIHx8IHt9O1xuICAgICAgICAgIHRoaXMua2V5c1t0ZW1wXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiBudW0sIGhpZ2g6IG51bSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBCYWQgdG9rZW4ga2V5KHMpIC8gcmFuZ2Uocyk6ICR7SlNPTi5zdHJpbmdpZnkoYXJnTGlzdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLmNvbnNvbGlkYXRlUmFuZ2VzKHRoaXMucmFuZ2VzKTtcbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdHNOb3RoaW5nICgpIHtcbiAgICByZXR1cm4gIXRoaXMubWF0Y2hBbGwgJiYgIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXM7XG4gIH1cbiAgY29uc29saWRhdGVSYW5nZXMgKHJhbmdlcykge1xuICAgIC8vIE1lcmdlIGFueSBvdmVybGFwcGluZyByYW5nZXNcbiAgICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcbiAgICBjb25zdCB0ZW1wID0gcmFuZ2VzLnNvcnQoKGEsIGIpID0+IGEubG93IC0gYi5sb3cpO1xuICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFjdXJyZW50UmFuZ2UpIHtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH0gZWxzZSBpZiAodGVtcFtpXS5sb3cgPD0gY3VycmVudFJhbmdlLmhpZ2gpIHtcbiAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSB0ZW1wW2ldLmhpZ2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgICAvLyBDb3JuZXIgY2FzZTogYWRkIHRoZSBsYXN0IHJhbmdlXG4gICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UmFuZ2VzLmxlbmd0aCA+IDAgPyBuZXdSYW5nZXMgOiB1bmRlZmluZWQ7XG4gIH1cbiAgaXNTdXBlclNldE9mIChvdGhlclRva2VuKSB7XG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZGlmZiA9IG90aGVyVG9rZW4uZGlmZmVyZW5jZSh0aGlzKTtcbiAgICAgIHJldHVybiBkaWZmID09PSBudWxsIHx8IGRpZmYuc2VsZWN0c05vdGhpbmc7XG4gICAgfVxuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICBpZiAodGhpcy5tYXRjaEFsbCkgeyByZXR1cm4gJy5rZXlzKCknOyB9XG4gICAgcmV0dXJuICcua2V5cygnICsgdGhpcy5yYW5nZXMubWFwKCh7bG93LCBoaWdofSkgPT4gYCR7bG93fS0ke2hpZ2h9YClcbiAgICAgIC5jb25jYXQoT2JqZWN0LmtleXModGhpcy5rZXlzKS5tYXAoa2V5ID0+IGAnJHtrZXl9J2ApKVxuICAgICAgLmpvaW4oJywnKSArICcpJztcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBLZXlzVG9rZW4gaXMgbm90IGFuIG9iamVjdGApO1xuICAgIH1cbiAgICBpZiAodGhpcy5tYXRjaEFsbCkge1xuICAgICAgZm9yIChsZXQga2V5IGluIHdyYXBwZWRQYXJlbnQucmF3SXRlbSkge1xuICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGxldCB7bG93LCBoaWdofSBvZiB0aGlzLnJhbmdlcyB8fCBbXSkge1xuICAgICAgICBsb3cgPSBNYXRoLm1heCgwLCBsb3cpO1xuICAgICAgICBoaWdoID0gTWF0aC5taW4od3JhcHBlZFBhcmVudC5yYXdJdGVtLmxlbmd0aCAtIDEsIGhpZ2gpO1xuICAgICAgICBmb3IgKGxldCBpID0gbG93OyBpIDw9IGhpZ2g7IGkrKykge1xuICAgICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW1baV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMua2V5cyB8fCB7fSkge1xuICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEtleXNUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBWYWx1ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGNvbnN0IG9iaiA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgIGNvbnN0IGtleSA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgIGNvbnN0IGtleVR5cGUgPSB0eXBlb2Yga2V5O1xuICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCAoa2V5VHlwZSAhPT0gJ3N0cmluZycgJiYga2V5VHlwZSAhPT0gJ251bWJlcicpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBWYWx1ZVRva2VuIHVzZWQgb24gYSBub24tb2JqZWN0LCBvciB3aXRob3V0IGEgc3RyaW5nIC8gbnVtZXJpYyBrZXlgKTtcbiAgICB9XG4gICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQudmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBFdmFsdWF0ZVRva2VuIGlzIG5vdCBhIHN0cmluZ2ApO1xuICAgIH1cbiAgICBsZXQgbmV3U3RyZWFtID0gdGhpcy5zdHJlYW0ubXVyZS5zdHJlYW0oe1xuICAgICAgc2VsZWN0b3I6IHdyYXBwZWRQYXJlbnQudmFsdWUsXG4gICAgICBmdW5jdGlvbnM6IHRoaXMuc3RyZWFtLmZ1bmN0aW9ucyxcbiAgICAgIHN0cmVhbXM6IHRoaXMuc3RyZWFtLnN0cmVhbXMsXG4gICAgICBlcnJvck1vZGU6IHRoaXMuc3RyZWFtLmVycm9yTW9kZSxcbiAgICAgIHRyYXZlcnNhbE1vZGU6IHRoaXMuc3RyZWFtLnRyYXZlcnNhbE1vZGVcbiAgICB9KTtcbiAgICB5aWVsZCAqIGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0uZnVuY3Rpb25zW2dlbmVyYXRvcl0pIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBmdW5jdGlvbjogJHtnZW5lcmF0b3J9YCk7XG4gICAgfVxuICAgIHRoaXMuZ2VuZXJhdG9yID0gc3RyZWFtLmZ1bmN0aW9uc1tnZW5lcmF0b3JdO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5tYXAoJHt0aGlzLmdlbmVyYXRvcn0pYDtcbiAgfVxuICBpc1N1cGVyU2V0T2YgKG90aGVyVG9rZW4pIHtcbiAgICByZXR1cm4gb3RoZXJUb2tlbi5jb25zdHJ1Y3RvciA9PT0gTWFwVG9rZW4gJiYgb3RoZXJUb2tlbi5nZW5lcmF0b3IgPT09IHRoaXMuZ2VuZXJhdG9yO1xuICB9XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgdGhpcy5nZW5lcmF0b3Iod3JhcHBlZFBhcmVudCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFwVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUHJvbW90ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ21kNScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBmb3IgKGNvbnN0IGZ1bmMgb2YgWyBtYXAsIGhhc2gsIHJlZHVjZUluc3RhbmNlcyBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5mdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG4gICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPSByZWR1Y2VJbnN0YW5jZXM7XG5cbiAgICB0aGlzLnNlZW5JdGVtcyA9IHt9O1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5wcm9tb3RlKCR7dGhpcy5tYXB9LCAke3RoaXMuaGFzaH0sICR7dGhpcy5yZWR1Y2VJbnN0YW5jZXN9KWA7XG4gIH1cbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiB0aGlzLm1hcCh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgY29uc3QgaGFzaCA9IHRoaXMuaGFzaChtYXBwZWRSYXdJdGVtKTtcbiAgICAgIGlmICh0aGlzLnNlZW5JdGVtc1toYXNoXSkge1xuICAgICAgICB0aGlzLnJlZHVjZUluc3RhbmNlcyh0aGlzLnNlZW5JdGVtc1toYXNoXSwgbWFwcGVkUmF3SXRlbSk7XG4gICAgICAgIHRoaXMuc2Vlbkl0ZW1zW2hhc2hdLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zZWVuSXRlbXNbaGFzaF0gPSB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZVRva2VuO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDb25zdHJ1Y3QgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChtdXJlLCBzZWxlY3RvciwgY2xhc3NOYW1lcyA9IFtdKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm11cmUgPSBtdXJlO1xuICAgIHRoaXMuc2VsZWN0b3IgPSBzZWxlY3RvcjtcbiAgICB0aGlzLmNsYXNzTmFtZXMgPSBjbGFzc05hbWVzO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBbXTtcbiAgfVxuICB3cmFwICh7IHBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHJldHVybiBuZXcgdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKHsgcGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgfVxuICBzdHJlYW0gKG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMuc2VsZWN0b3IgPSB0aGlzLnNlbGVjdG9yO1xuICAgIHJldHVybiB0aGlzLm11cmUuc3RyZWFtKG9wdGlvbnMpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NvbnN0cnVjdCwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ29uc3RydWN0Ly5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NvbnN0cnVjdDtcbiIsImltcG9ydCBHZW5lcmljQ29uc3RydWN0IGZyb20gJy4vR2VuZXJpY0NvbnN0cnVjdC5qcyc7XG5cbmNsYXNzIE5vZGVDb25zdHJ1Y3QgZXh0ZW5kcyBHZW5lcmljQ29uc3RydWN0IHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ29uc3RydWN0O1xuIiwiaW1wb3J0IEdlbmVyaWNDb25zdHJ1Y3QgZnJvbSAnLi9HZW5lcmljQ29uc3RydWN0LmpzJztcblxuY2xhc3MgRWRnZUNvbnN0cnVjdCBleHRlbmRzIEdlbmVyaWNDb25zdHJ1Y3Qge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDb25zdHJ1Y3Q7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yICh7IHBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMucmF3SXRlbSA9IHJhd0l0ZW07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4vU3RyZWFtLmpzJztcbmltcG9ydCAqIGFzIFRPS0VOUyBmcm9tICcuL1Rva2Vucy9Ub2tlbnMuanMnO1xuaW1wb3J0ICogYXMgQ09OU1RSVUNUUyBmcm9tICcuL0NvbnN0cnVjdHMvQ29uc3RydWN0cy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy5yb290ID0ge307XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICB0aGlzLlRSVVRIWV9TVFJJTkdTID0ge1xuICAgICAgJ3RydWUnOiB0cnVlLFxuICAgICAgJ3llcyc6IHRydWUsXG4gICAgICAneSc6IHRydWVcbiAgICB9O1xuICAgIHRoaXMuRkFMU0VZX1NUUklOR1MgPSB7XG4gICAgICAnZmFsc2UnOiB0cnVlLFxuICAgICAgJ25vJzogdHJ1ZSxcbiAgICAgICduJzogdHJ1ZVxuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRPS0VOUyA9IFRPS0VOUztcbiAgICB0aGlzLkNPTlNUUlVDVFMgPSBDT05TVFJVQ1RTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcblxuICAgIC8vIE1vbmtleS1wYXRjaCBhdmFpbGFibGUgdG9rZW5zIGFzIGZ1bmN0aW9ucyBvbnRvIHRoZSBTdHJlYW0gY2xhc3NcbiAgICBmb3IgKGNvbnN0IHRva2VuQ2xhc3NOYW1lIGluIHRoaXMuVE9LRU5TKSB7XG4gICAgICBjb25zdCBUb2tlbkNsYXNzID0gdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdO1xuICAgICAgU3RyZWFtLnByb3RvdHlwZVtUb2tlbkNsYXNzLmxvd2VyQ2FtZWxDYXNlVHlwZV0gPSBmdW5jdGlvbiAoYXJnTGlzdCwgZnVuY3Rpb25zLCBzdHJlYW1zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmV4dGVuZChUb2tlbkNsYXNzLCBhcmdMaXN0LCBmdW5jdGlvbnMsIHN0cmVhbXMpO1xuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBzdHJlYW0gKG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cbiAgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgY29uc3QgdG9rZW5MaXN0ID0gW3Rva2VuXTtcbiAgICBsZXQgdGVtcCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgd2hpbGUgKHRlbXAgIT09IG51bGwpIHtcbiAgICAgIHRva2VuTGlzdC51bnNoaWZ0KHRlbXAudG9rZW4pO1xuICAgICAgdGVtcCA9IHRlbXAucGFyZW50O1xuICAgIH1cbiAgICBmb3IgKGxldCBjbGFzc1NlbGVjdG9yIG9mIHRoaXMuY2xhc3Nlcykge1xuICAgICAgY29uc3QgY29uc3RydWN0ID0gdGhpcy5jbGFzc2VzW2NsYXNzU2VsZWN0b3JdO1xuICAgICAgaWYgKGNvbnN0cnVjdC5zdHJlYW0uaXNTdXBlclNldE9mVG9rZW5MaXN0KHRva2VuTGlzdCkpIHtcbiAgICAgICAgcmV0dXJuIGNvbnN0cnVjdC53cmFwKHsgcGFyZW50OiB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyB0aGlzLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKHsgcGFyZW50OiB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgfVxuXG4gIG5ld0NsYXNzICh7IENsYXNzVHlwZSwgc2VsZWN0b3IsIGNsYXNzTmFtZXMgfSkge1xuICAgIGlmICh0aGlzLmNsYXNzZXNbc2VsZWN0b3JdKSB7XG4gICAgICByZXR1cm4gdGhpcy5jbGFzc2VzW3NlbGVjdG9yXTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc2VzW3NlbGVjdG9yXSA9IG5ldyBDbGFzc1R5cGUoeyBtdXJlOiB0aGlzLCBzZWxlY3RvciwgY2xhc3NOYW1lcyB9KTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW3NlbGVjdG9yXTtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY0RhdGFTb3VyY2UoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2Uoe1xuICAgICAga2V5OiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAga2V5LFxuICAgIGV4dGVuc2lvbiA9ICd0eHQnLFxuICAgIHRleHRcbiAgfSkge1xuICAgIGxldCBvYmo7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIG9iaiA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNEYXRhU291cmNlKGtleSwgb2JqKTtcbiAgfVxuICBhc3luYyBhZGRTdGF0aWNEYXRhU291cmNlIChrZXksIG9iaikge1xuICAgIHRoaXMucm9vdFtrZXldID0gb2JqO1xuICAgIHJldHVybiB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHNlbGVjdG9yOiBgcm9vdC52YWx1ZXMoJyR7a2V5fScpYCxcbiAgICAgIENsYXNzVHlwZTogdGhpcy5DT05TVFJVQ1RTLkdlbmVyaWNDb25zdHJ1Y3QsXG4gICAgICBjbGFzc05hbWVzOiBbIGtleSBdXG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXVyZTtcbiIsImltcG9ydCBNdXJlIGZyb20gJy4vTXVyZS5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUod2luZG93LkZpbGVSZWFkZXIpO1xubXVyZS52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJpbmRleCIsInNwbGljZSIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5IiwiYXJnT2JqIiwiZGVsYXkiLCJhc3NpZ24iLCJ0aW1lb3V0IiwidHJpZ2dlciIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJpIiwiREVGQVVMVF9GVU5DVElPTlMiLCJ3cmFwcGVkUGFyZW50IiwicmF3SXRlbSIsIm1kNSIsIlN0cmVhbSIsIm11cmUiLCJ0b2tlbkxpc3QiLCJwYXJzZVNlbGVjdG9yIiwic2VsZWN0b3IiLCJmdW5jdGlvbnMiLCJzdHJlYW1zIiwiZXJyb3JNb2RlIiwidHJhdmVyc2FsTW9kZSIsImpvaW4iLCJzZWxlY3RvclN0cmluZyIsInN0YXJ0c1dpdGgiLCJTeW50YXhFcnJvciIsInRva2VuU3RyaW5ncyIsIm1hdGNoIiwiY2h1bmsiLCJ0ZW1wIiwidG9rZW5DbGFzc05hbWUiLCJ0b1VwcGVyQ2FzZSIsInNsaWNlIiwiYXJnTGlzdCIsInNwbGl0IiwibWFwIiwiZCIsInRyaW0iLCJUT0tFTlMiLCJLZXlzVG9rZW4iLCJWYWx1ZVRva2VuIiwiRXJyb3IiLCJkZWVwSGVscGVyIiwibGVuZ3RoIiwiZmluaXNoZWRQYXRoIiwibmF2aWdhdGUiLCJlcnIiLCJUeXBlRXJyb3IiLCJsaW1pdCIsIml0ZXJhdG9yIiwiaXRlcmF0ZSIsIm5leHQiLCJ2YWx1ZSIsIlRva2VuQ2xhc3MiLCJuZXdTdHJlYW0iLCJtb2RlIiwiY29uY2F0IiwiZXZlcnkiLCJ0b2tlbiIsImlzU3VwZXJTZXRPZiIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImNvbnN0cnVjdG9yIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b0xvd2VyQ2FzZSIsIm90aGVyVG9rZW4iLCJleGVjIiwibmFtZSIsIlJvb3RUb2tlbiIsIndyYXAiLCJyb290IiwibWF0Y2hBbGwiLCJrZXlzIiwicmFuZ2VzIiwiYXJnIiwiSW5maW5pdHkiLCJwYXJzZUludCIsImlzTmFOIiwibG93IiwiaGlnaCIsIm51bSIsIk51bWJlciIsIkpTT04iLCJzdHJpbmdpZnkiLCJjb25zb2xpZGF0ZVJhbmdlcyIsInNlbGVjdHNOb3RoaW5nIiwibmV3UmFuZ2VzIiwic29ydCIsImEiLCJiIiwiY3VycmVudFJhbmdlIiwidW5kZWZpbmVkIiwiZGlmZiIsImRpZmZlcmVuY2UiLCJrZXkiLCJNYXRoIiwibWF4IiwibWluIiwiaGFzT3duUHJvcGVydHkiLCJvYmoiLCJrZXlUeXBlIiwiRXZhbHVhdGVUb2tlbiIsIk1hcFRva2VuIiwiZ2VuZXJhdG9yIiwibWFwcGVkUmF3SXRlbSIsIlByb21vdGVUb2tlbiIsImhhc2giLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwic2Vlbkl0ZW1zIiwiR2VuZXJpY0NvbnN0cnVjdCIsImNsYXNzTmFtZXMiLCJhbm5vdGF0aW9ucyIsInBhcmVudCIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJvcHRpb25zIiwiTm9kZUNvbnN0cnVjdCIsIkVkZ2VDb25zdHJ1Y3QiLCJOb2RlV3JhcHBlciIsIkVkZ2VXcmFwcGVyIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJtaW1lIiwiY2xhc3NlcyIsIkRBVEFMSUJfRk9STUFUUyIsIlRSVVRIWV9TVFJJTkdTIiwiRkFMU0VZX1NUUklOR1MiLCJDT05TVFJVQ1RTIiwicHJvdG90eXBlIiwiZXh0ZW5kIiwidW5zaGlmdCIsImNsYXNzU2VsZWN0b3IiLCJjb25zdHJ1Y3QiLCJpc1N1cGVyU2V0T2ZUb2tlbkxpc3QiLCJDbGFzc1R5cGUiLCJjaGFyc2V0IiwiZmlsZU9iaiIsImZpbGVNQiIsInNpemUiLCJza2lwU2l6ZUNoZWNrIiwid2FybiIsInRleHQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInJlYWRlciIsIm9ubG9hZCIsInJlc3VsdCIsInJlYWRBc1RleHQiLCJlbmNvZGluZyIsImFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSIsImV4dGVuc2lvbk92ZXJyaWRlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJhZGRTdGF0aWNEYXRhU291cmNlIiwibmV3Q2xhc3MiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUEsTUFBTUEsbUJBQW1CLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtrQkFDZjtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsYUFBTCxHQUFxQixFQUFyQjtXQUNLQyxjQUFMLEdBQXNCLEVBQXRCOztPQUVFQyxTQUFKLEVBQWVDLFFBQWYsRUFBeUJDLHVCQUF6QixFQUFrRDtVQUM1QyxDQUFDLEtBQUtKLGFBQUwsQ0FBbUJFLFNBQW5CLENBQUwsRUFBb0M7YUFDN0JGLGFBQUwsQ0FBbUJFLFNBQW5CLElBQWdDLEVBQWhDOztVQUVFLENBQUNFLHVCQUFMLEVBQThCO1lBQ3hCLEtBQUtKLGFBQUwsQ0FBbUJFLFNBQW5CLEVBQThCRyxPQUE5QixDQUFzQ0YsUUFBdEMsTUFBb0QsQ0FBQyxDQUF6RCxFQUE0RDs7OztXQUl6REgsYUFBTCxDQUFtQkUsU0FBbkIsRUFBOEJJLElBQTlCLENBQW1DSCxRQUFuQzs7UUFFR0QsU0FBTCxFQUFnQkMsUUFBaEIsRUFBMEI7VUFDcEIsS0FBS0gsYUFBTCxDQUFtQkUsU0FBbkIsQ0FBSixFQUFtQztZQUM3QixDQUFDQyxRQUFMLEVBQWU7aUJBQ04sS0FBS0gsYUFBTCxDQUFtQkUsU0FBbkIsQ0FBUDtTQURGLE1BRU87Y0FDREssUUFBUSxLQUFLUCxhQUFMLENBQW1CRSxTQUFuQixFQUE4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
