'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var md5 = _interopDefault(require('blueimp-md5'));
var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var FileReader = _interopDefault(require('filereader'));

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
    const tokenList = [new this.mure.TOKENS.RootToken(this)];
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
            const wrappedItem = _value;

            yield wrappedItem;
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
      const iterator = _this3.iterate();
      for (let i = 0; i < limit; i++) {
        const temp = yield asyncGenerator.await(iterator.next());
        if (temp.done) {
          break;
        }
        yield temp.value;
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
      rawItem: this.stream.mure.root
    });
  }
  toString() {
    return `root`;
  }
}

class KeysToken extends BaseToken {
  constructor(stream, argList, { matchAll, keys, ranges } = {}) {
    super(stream);
    if (keys || ranges) {
      this.keys = keys;
      this.ranges = ranges;
    } else if (argList && argList.length === 1 && argList[0] === '' || matchAll) {
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
  difference(otherToken) {
    // Compute what is left of this after subtracting out everything in otherToken
    if (!(otherToken instanceof KeysToken)) {
      throw new Error(`Can't compute the difference of two different token types`);
    } else if (otherToken.matchAll) {
      return null;
    } else if (this.matchAll) {
      console.warn(`Inaccurate difference computed! TODO: need to figure out how to invert categorical keys!`);
      return this;
    } else {
      const newKeys = {};
      for (let key in this.keys || {}) {
        if (!otherToken.keys || !otherToken.keys[key]) {
          newKeys[key] = true;
        }
      }
      let newRanges = [];
      if (this.ranges) {
        if (otherToken.ranges) {
          let allPoints = this.ranges.reduce((agg, range) => {
            return agg.concat([{ include: true, low: true, value: range.low }, { include: true, high: true, value: range.high }]);
          }, []);
          allPoints = allPoints.concat(otherToken.ranges.reduce((agg, range) => {
            return agg.concat([{ exclude: true, low: true, value: range.low }, { exclude: true, high: true, value: range.high }]);
          }, [])).sort();
          let currentRange = null;
          for (let i = 0; i < allPoints.length; i++) {
            if (currentRange === null) {
              if (allPoints[i].include && allPoints[i].low) {
                currentRange = { low: allPoints[i].value };
              }
            } else if (allPoints[i].include && allPoints[i].high) {
              currentRange.high = allPoints[i].value;
              if (currentRange.high >= currentRange.low) {
                newRanges.push(currentRange);
              }
              currentRange = null;
            } else if (allPoints[i].exclude) {
              if (allPoints[i].low) {
                currentRange.high = allPoints[i].low - 1;
                if (currentRange.high >= currentRange.low) {
                  newRanges.push(currentRange);
                }
                currentRange = null;
              } else if (allPoints[i].high) {
                currentRange.low = allPoints[i].high + 1;
              }
            }
          }
        } else {
          newRanges = this.ranges;
        }
      }
      return new KeysToken(this.mure, null, { keys: newKeys, ranges: newRanges });
    }
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
  constructor({ mure, selector, classNames = [] }) {
    super();
    this.mure = mure;
    this.selector = selector;
    this.stream = this.mure.stream({ selector: selector });
    this.classNames = classNames;
    this.annotations = [];
  }
  wrap(options) {
    return new this.mure.WRAPPERS.GenericWrapper(options);
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
  constructor({ wrappedParent, token, rawItem }) {
    super();
    this.wrappedParent = wrappedParent;
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
  constructor(FileReader$$1) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node
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
      temp = temp.wrappedParent;
    }
    for (let classSelector in this.classes) {
      const construct = this.classes[classSelector];
      if (construct.stream.isSuperSetOfTokenList(tokenList)) {
        return construct.wrap({ wrappedParent, token, rawItem });
      }
    }
    return new this.WRAPPERS.GenericWrapper({ wrappedParent, token, rawItem });
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
        selector: `root.values('${key}').values()`,
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

let mure = new Mure(FileReader);
mure.version = pkg.version;

module.exports = mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL0NvbnN0cnVjdHMvR2VuZXJpY0NvbnN0cnVjdC5qcyIsIi4uL3NyYy9Db25zdHJ1Y3RzL05vZGVDb25zdHJ1Y3QuanMiLCIuLi9zcmMvQ29uc3RydWN0cy9FZGdlQ29uc3RydWN0LmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiaW1wb3J0IG1kNSBmcm9tICdibHVlaW1wLW1kNSc7XG5cbmNvbnN0IERFRkFVTFRfRlVOQ1RJT05TID0ge1xuICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZFBhcmVudCkgeyB5aWVsZCB3cmFwcGVkUGFyZW50LnJhd0l0ZW07IH0sXG4gIG1kNTogKHdyYXBwZWRQYXJlbnQpID0+IG1kNSh3cmFwcGVkUGFyZW50LnJhd0l0ZW0pLFxuICBub29wOiAoKSA9PiB7fVxufTtcblxuY2xhc3MgU3RyZWFtIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBtdXJlLFxuICAgIHNlbGVjdG9yID0gJ3Jvb3QnLFxuICAgIGZ1bmN0aW9ucyA9IHt9LFxuICAgIHN0cmVhbXMgPSB7fSxcbiAgICBlcnJvck1vZGUgPSAncGVybWlzc2l2ZScsXG4gICAgdHJhdmVyc2FsTW9kZSA9ICdERlMnXG4gIH0pIHtcbiAgICB0aGlzLm11cmUgPSBtdXJlO1xuXG4gICAgdGhpcy50b2tlbkxpc3QgPSB0aGlzLnBhcnNlU2VsZWN0b3Ioc2VsZWN0b3IpO1xuXG4gICAgdGhpcy5mdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX0ZVTkNUSU9OUywgZnVuY3Rpb25zKTtcbiAgICB0aGlzLnN0cmVhbXMgPSBzdHJlYW1zO1xuICAgIHRoaXMuZXJyb3JNb2RlID0gZXJyb3JNb2RlO1xuICAgIHRoaXMudHJhdmVyc2FsTW9kZSA9IHRyYXZlcnNhbE1vZGU7XG4gIH1cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3Quam9pbignJyk7XG4gIH1cbiAgcGFyc2VTZWxlY3RvciAoc2VsZWN0b3JTdHJpbmcpIHtcbiAgICBpZiAoIXNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ3Jvb3QnKSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBTZWxlY3RvcnMgbXVzdCBzdGFydCB3aXRoICdyb290J2ApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3RvclN0cmluZy5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgaWYgKCF0b2tlblN0cmluZ3MpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCBzZWxlY3RvciBzdHJpbmc6ICR7c2VsZWN0b3JTdHJpbmd9YCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuTGlzdCA9IFtuZXcgdGhpcy5tdXJlLlRPS0VOUy5Sb290VG9rZW4odGhpcyldO1xuICAgIHRva2VuU3RyaW5ncy5mb3JFYWNoKGNodW5rID0+IHtcbiAgICAgIGNvbnN0IHRlbXAgPSBjaHVuay5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKCF0ZW1wKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCB0b2tlbjogJHtjaHVua31gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRva2VuQ2xhc3NOYW1lID0gdGVtcFsxXVswXS50b1VwcGVyQ2FzZSgpICsgdGVtcFsxXS5zbGljZSgxKSArICdUb2tlbic7XG4gICAgICBjb25zdCBhcmdMaXN0ID0gdGVtcFsyXS5zcGxpdCgvKD88IVxcXFwpLC8pLm1hcChkID0+IGQudHJpbSgpKTtcbiAgICAgIGlmICh0b2tlbkNsYXNzTmFtZSA9PT0gJ1ZhbHVlc1Rva2VuJykge1xuICAgICAgICB0b2tlbkxpc3QucHVzaChuZXcgdGhpcy5tdXJlLlRPS0VOUy5LZXlzVG9rZW4odGhpcywgYXJnTGlzdCkpO1xuICAgICAgICB0b2tlbkxpc3QucHVzaChuZXcgdGhpcy5tdXJlLlRPS0VOUy5WYWx1ZVRva2VuKHRoaXMsIFtdKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMubXVyZS5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKSB7XG4gICAgICAgIHRva2VuTGlzdC5wdXNoKG5ldyB0aGlzLm11cmUuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSh0aGlzLCBhcmdMaXN0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gdG9rZW46ICR7dGVtcFsxXX1gKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdG9rZW5MaXN0O1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgaWYgKHRoaXMudHJhdmVyc2FsTW9kZSA9PT0gJ0JGUycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQnJlYWR0aC1maXJzdCBpdGVyYXRpb24gaXMgbm90IHlldCBpbXBsZW1lbnRlZC5gKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMudHJhdmVyc2FsTW9kZSA9PT0gJ0RGUycpIHtcbiAgICAgIGNvbnN0IGRlZXBIZWxwZXIgPSB0aGlzLmRlZXBIZWxwZXIodGhpcy50b2tlbkxpc3QsIHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEpO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiBkZWVwSGVscGVyKSB7XG4gICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gdHJhdmVyc2FsTW9kZTogJHt0aGlzLnRyYXZlcnNhbE1vZGV9YCk7XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBUaGlzIGhlbHBzIGRlcHRoLWZpcnN0IGl0ZXJhdGlvbiAod2Ugb25seSB3YW50IHRvIHlpZWxkIGZpbmlzaGVkIHBhdGhzLCBzb1xuICAgKiBpdCBsYXppbHkgYXNrcyBmb3IgdGhlbSBvbmUgYXQgYSB0aW1lIGZyb20gdGhlICpmaW5hbCogdG9rZW4sIHJlY3Vyc2l2ZWx5XG4gICAqIGFza2luZyBlYWNoIHByZWNlZGluZyB0b2tlbiB0byB5aWVsZCBkZXBlbmRlbnQgcGF0aHMgb25seSBhcyBuZWVkZWQpXG4gICAqL1xuICBhc3luYyAqIGRlZXBIZWxwZXIgKHRva2VuTGlzdCwgaSkge1xuICAgIGlmIChpID09PSAwKSB7XG4gICAgICB5aWVsZCAqIGF3YWl0IHRva2VuTGlzdFswXS5uYXZpZ2F0ZSgpOyAvLyBUaGUgZmlyc3QgdG9rZW4gaXMgYWx3YXlzIHRoZSByb290XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciBhd2FpdCAobGV0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5kZWVwSGVscGVyKHRva2VuTGlzdCwgaSAtIDEpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgeWllbGQgKiBhd2FpdCB0b2tlbkxpc3RbaV0ubmF2aWdhdGUod3JhcHBlZFBhcmVudCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmICh0aGlzLmVycm9yTW9kZSAhPT0gJ3Blcm1pc3NpdmUnIHx8XG4gICAgICAgICAgICAhKGVyciBpbnN0YW5jZW9mIFR5cGVFcnJvciAmJiBlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyAqIHNhbXBsZSAoeyBsaW1pdCA9IDEwIH0pIHtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZSgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGV4dGVuZCAoVG9rZW5DbGFzcywgYXJnTGlzdCwgZnVuY3Rpb25zID0ge30sIHN0cmVhbXMgPSB7fSkge1xuICAgIGNvbnN0IG5ld1N0cmVhbSA9IG5ldyBTdHJlYW0oe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgZnVuY3Rpb25zOiBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmZ1bmN0aW9ucywgZnVuY3Rpb25zKSxcbiAgICAgIHN0cmVhbXM6IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuc3RyZWFtcywgc3RyZWFtcyksXG4gICAgICBtb2RlOiB0aGlzLm1vZGVcbiAgICB9KTtcbiAgICBuZXdTdHJlYW0udG9rZW5MaXN0ID0gdGhpcy50b2tlbkxpc3QuY29uY2F0KFsgbmV3IFRva2VuQ2xhc3MobmV3U3RyZWFtLCBhcmdMaXN0KSBdKTtcbiAgICByZXR1cm4gbmV3U3RyZWFtO1xuICB9XG5cbiAgaXNTdXBlclNldE9mVG9rZW5MaXN0ICh0b2tlbkxpc3QpIHtcbiAgICBpZiAodG9rZW5MaXN0Lmxlbmd0aCAhPT0gdGhpcy50b2tlbkxpc3QubGVuZ3RoKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5ldmVyeSgodG9rZW4sIGkpID0+IHRva2VuLmlzU3VwZXJTZXRPZih0b2tlbkxpc3RbaV0pKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RyZWFtO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEJhc2VUb2tlbiBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zdHJlYW0gPSBzdHJlYW07XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIC8vIFRoZSBzdHJpbmcgdmVyc2lvbiBvZiBtb3N0IHRva2VucyBjYW4ganVzdCBiZSBkZXJpdmVkIGZyb20gdGhlIGNsYXNzIHR5cGVcbiAgICByZXR1cm4gYC4ke3RoaXMudHlwZS50b0xvd2VyQ2FzZSgpfSgpYDtcbiAgfVxuICBpc1N1cGVyU2V0T2YgKG90aGVyVG9rZW4pIHtcbiAgICByZXR1cm4gb3RoZXJUb2tlbi5jb25zdHJ1Y3RvciA9PT0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXNlVG9rZW4sICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRva2VuLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQmFzZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFJvb3RUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gICogbmF2aWdhdGUgKCkge1xuICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICB3cmFwcGVkUGFyZW50OiBudWxsLFxuICAgICAgdG9rZW46IHRoaXMsXG4gICAgICByYXdJdGVtOiB0aGlzLnN0cmVhbS5tdXJlLnJvb3RcbiAgICB9KTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGByb290YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUm9vdFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEtleXNUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIGFyZ0xpc3QsIHsgbWF0Y2hBbGwsIGtleXMsIHJhbmdlcyB9ID0ge30pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmIChrZXlzIHx8IHJhbmdlcykge1xuICAgICAgdGhpcy5rZXlzID0ga2V5cztcbiAgICAgIHRoaXMucmFuZ2VzID0gcmFuZ2VzO1xuICAgIH0gZWxzZSBpZiAoKGFyZ0xpc3QgJiYgYXJnTGlzdC5sZW5ndGggPT09IDEgJiYgYXJnTGlzdFswXSA9PT0gJycpIHx8IG1hdGNoQWxsKSB7XG4gICAgICB0aGlzLm1hdGNoQWxsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnTGlzdC5mb3JFYWNoKGFyZyA9PiB7XG4gICAgICAgIGxldCB0ZW1wID0gYXJnLm1hdGNoKC8oXFxkKyktKFtcXGTiiJ5dKykvKTtcbiAgICAgICAgaWYgKHRlbXAgJiYgdGVtcFsyXSA9PT0gJ+KInicpIHtcbiAgICAgICAgICB0ZW1wWzJdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IHRlbXAgPyB0ZW1wLm1hcChkID0+IGQucGFyc2VJbnQoZCkpIDogbnVsbDtcbiAgICAgICAgaWYgKHRlbXAgJiYgIWlzTmFOKHRlbXBbMV0pICYmICFpc05hTih0ZW1wWzJdKSkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSB0ZW1wWzFdOyBpIDw9IHRlbXBbMl07IGkrKykge1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IHRlbXBbMV0sIGhpZ2g6IHRlbXBbMl0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gYXJnLm1hdGNoKC8nKC4qKScvKTtcbiAgICAgICAgdGVtcCA9IHRlbXAgJiYgdGVtcFsxXSA/IHRlbXBbMV0gOiBhcmc7XG4gICAgICAgIGxldCBudW0gPSBOdW1iZXIodGVtcCk7XG4gICAgICAgIGlmIChpc05hTihudW0pIHx8IG51bSAhPT0gcGFyc2VJbnQodGVtcCkpIHsgLy8gbGVhdmUgbm9uLWludGVnZXIgbnVtYmVycyBhcyBzdHJpbmdzXG4gICAgICAgICAgdGhpcy5rZXlzID0gdGhpcy5rZXlzIHx8IHt9O1xuICAgICAgICAgIHRoaXMua2V5c1t0ZW1wXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiBudW0sIGhpZ2g6IG51bSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBCYWQgdG9rZW4ga2V5KHMpIC8gcmFuZ2Uocyk6ICR7SlNPTi5zdHJpbmdpZnkoYXJnTGlzdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLmNvbnNvbGlkYXRlUmFuZ2VzKHRoaXMucmFuZ2VzKTtcbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdHNOb3RoaW5nICgpIHtcbiAgICByZXR1cm4gIXRoaXMubWF0Y2hBbGwgJiYgIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXM7XG4gIH1cbiAgY29uc29saWRhdGVSYW5nZXMgKHJhbmdlcykge1xuICAgIC8vIE1lcmdlIGFueSBvdmVybGFwcGluZyByYW5nZXNcbiAgICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcbiAgICBjb25zdCB0ZW1wID0gcmFuZ2VzLnNvcnQoKGEsIGIpID0+IGEubG93IC0gYi5sb3cpO1xuICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFjdXJyZW50UmFuZ2UpIHtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH0gZWxzZSBpZiAodGVtcFtpXS5sb3cgPD0gY3VycmVudFJhbmdlLmhpZ2gpIHtcbiAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSB0ZW1wW2ldLmhpZ2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgICAvLyBDb3JuZXIgY2FzZTogYWRkIHRoZSBsYXN0IHJhbmdlXG4gICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UmFuZ2VzLmxlbmd0aCA+IDAgPyBuZXdSYW5nZXMgOiB1bmRlZmluZWQ7XG4gIH1cbiAgZGlmZmVyZW5jZSAob3RoZXJUb2tlbikge1xuICAgIC8vIENvbXB1dGUgd2hhdCBpcyBsZWZ0IG9mIHRoaXMgYWZ0ZXIgc3VidHJhY3Rpbmcgb3V0IGV2ZXJ5dGhpbmcgaW4gb3RoZXJUb2tlblxuICAgIGlmICghKG90aGVyVG9rZW4gaW5zdGFuY2VvZiBLZXlzVG9rZW4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNvbXB1dGUgdGhlIGRpZmZlcmVuY2Ugb2YgdHdvIGRpZmZlcmVudCB0b2tlbiB0eXBlc2ApO1xuICAgIH0gZWxzZSBpZiAob3RoZXJUb2tlbi5tYXRjaEFsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEluYWNjdXJhdGUgZGlmZmVyZW5jZSBjb21wdXRlZCEgVE9ETzogbmVlZCB0byBmaWd1cmUgb3V0IGhvdyB0byBpbnZlcnQgY2F0ZWdvcmljYWwga2V5cyFgKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdLZXlzID0ge307XG4gICAgICBmb3IgKGxldCBrZXkgaW4gKHRoaXMua2V5cyB8fCB7fSkpIHtcbiAgICAgICAgaWYgKCFvdGhlclRva2VuLmtleXMgfHwgIW90aGVyVG9rZW4ua2V5c1trZXldKSB7XG4gICAgICAgICAgbmV3S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1JhbmdlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICAgIGlmIChvdGhlclRva2VuLnJhbmdlcykge1xuICAgICAgICAgIGxldCBhbGxQb2ludHMgPSB0aGlzLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgYWxsUG9pbnRzID0gYWxsUG9pbnRzLmNvbmNhdChvdGhlclRva2VuLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSkpLnNvcnQoKTtcbiAgICAgICAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbFBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IHsgbG93OiBhbGxQb2ludHNbaV0udmFsdWUgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS52YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5leGNsdWRlKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0ubG93IC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5sb3cgPSBhbGxQb2ludHNbaV0uaGlnaCArIDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3UmFuZ2VzID0gdGhpcy5yYW5nZXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgS2V5c1Rva2VuKHRoaXMubXVyZSwgbnVsbCwgeyBrZXlzOiBuZXdLZXlzLCByYW5nZXM6IG5ld1JhbmdlcyB9KTtcbiAgICB9XG4gIH1cbiAgaXNTdXBlclNldE9mIChvdGhlclRva2VuKSB7XG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZGlmZiA9IG90aGVyVG9rZW4uZGlmZmVyZW5jZSh0aGlzKTtcbiAgICAgIHJldHVybiBkaWZmID09PSBudWxsIHx8IGRpZmYuc2VsZWN0c05vdGhpbmc7XG4gICAgfVxuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICBpZiAodGhpcy5tYXRjaEFsbCkgeyByZXR1cm4gJy5rZXlzKCknOyB9XG4gICAgcmV0dXJuICcua2V5cygnICsgdGhpcy5yYW5nZXMubWFwKCh7bG93LCBoaWdofSkgPT4gYCR7bG93fS0ke2hpZ2h9YClcbiAgICAgIC5jb25jYXQoT2JqZWN0LmtleXModGhpcy5rZXlzKS5tYXAoa2V5ID0+IGAnJHtrZXl9J2ApKVxuICAgICAgLmpvaW4oJywnKSArICcpJztcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBLZXlzVG9rZW4gaXMgbm90IGFuIG9iamVjdGApO1xuICAgIH1cbiAgICBpZiAodGhpcy5tYXRjaEFsbCkge1xuICAgICAgZm9yIChsZXQga2V5IGluIHdyYXBwZWRQYXJlbnQucmF3SXRlbSkge1xuICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGxldCB7bG93LCBoaWdofSBvZiB0aGlzLnJhbmdlcyB8fCBbXSkge1xuICAgICAgICBsb3cgPSBNYXRoLm1heCgwLCBsb3cpO1xuICAgICAgICBoaWdoID0gTWF0aC5taW4od3JhcHBlZFBhcmVudC5yYXdJdGVtLmxlbmd0aCAtIDEsIGhpZ2gpO1xuICAgICAgICBmb3IgKGxldCBpID0gbG93OyBpIDw9IGhpZ2g7IGkrKykge1xuICAgICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW1baV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMua2V5cyB8fCB7fSkge1xuICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEtleXNUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBWYWx1ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGNvbnN0IG9iaiA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgIGNvbnN0IGtleSA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgIGNvbnN0IGtleVR5cGUgPSB0eXBlb2Yga2V5O1xuICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCAoa2V5VHlwZSAhPT0gJ3N0cmluZycgJiYga2V5VHlwZSAhPT0gJ251bWJlcicpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBWYWx1ZVRva2VuIHVzZWQgb24gYSBub24tb2JqZWN0LCBvciB3aXRob3V0IGEgc3RyaW5nIC8gbnVtZXJpYyBrZXlgKTtcbiAgICB9XG4gICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQudmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBFdmFsdWF0ZVRva2VuIGlzIG5vdCBhIHN0cmluZ2ApO1xuICAgIH1cbiAgICBsZXQgbmV3U3RyZWFtID0gdGhpcy5zdHJlYW0ubXVyZS5zdHJlYW0oe1xuICAgICAgc2VsZWN0b3I6IHdyYXBwZWRQYXJlbnQudmFsdWUsXG4gICAgICBmdW5jdGlvbnM6IHRoaXMuc3RyZWFtLmZ1bmN0aW9ucyxcbiAgICAgIHN0cmVhbXM6IHRoaXMuc3RyZWFtLnN0cmVhbXMsXG4gICAgICBlcnJvck1vZGU6IHRoaXMuc3RyZWFtLmVycm9yTW9kZSxcbiAgICAgIHRyYXZlcnNhbE1vZGU6IHRoaXMuc3RyZWFtLnRyYXZlcnNhbE1vZGVcbiAgICB9KTtcbiAgICB5aWVsZCAqIGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0uZnVuY3Rpb25zW2dlbmVyYXRvcl0pIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBmdW5jdGlvbjogJHtnZW5lcmF0b3J9YCk7XG4gICAgfVxuICAgIHRoaXMuZ2VuZXJhdG9yID0gc3RyZWFtLmZ1bmN0aW9uc1tnZW5lcmF0b3JdO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5tYXAoJHt0aGlzLmdlbmVyYXRvcn0pYDtcbiAgfVxuICBpc1N1cGVyU2V0T2YgKG90aGVyVG9rZW4pIHtcbiAgICByZXR1cm4gb3RoZXJUb2tlbi5jb25zdHJ1Y3RvciA9PT0gTWFwVG9rZW4gJiYgb3RoZXJUb2tlbi5nZW5lcmF0b3IgPT09IHRoaXMuZ2VuZXJhdG9yO1xuICB9XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgdGhpcy5nZW5lcmF0b3Iod3JhcHBlZFBhcmVudCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFwVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUHJvbW90ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ21kNScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBmb3IgKGNvbnN0IGZ1bmMgb2YgWyBtYXAsIGhhc2gsIHJlZHVjZUluc3RhbmNlcyBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5mdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG4gICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPSByZWR1Y2VJbnN0YW5jZXM7XG5cbiAgICB0aGlzLnNlZW5JdGVtcyA9IHt9O1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5wcm9tb3RlKCR7dGhpcy5tYXB9LCAke3RoaXMuaGFzaH0sICR7dGhpcy5yZWR1Y2VJbnN0YW5jZXN9KWA7XG4gIH1cbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiB0aGlzLm1hcCh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgY29uc3QgaGFzaCA9IHRoaXMuaGFzaChtYXBwZWRSYXdJdGVtKTtcbiAgICAgIGlmICh0aGlzLnNlZW5JdGVtc1toYXNoXSkge1xuICAgICAgICB0aGlzLnJlZHVjZUluc3RhbmNlcyh0aGlzLnNlZW5JdGVtc1toYXNoXSwgbWFwcGVkUmF3SXRlbSk7XG4gICAgICAgIHRoaXMuc2Vlbkl0ZW1zW2hhc2hdLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zZWVuSXRlbXNbaGFzaF0gPSB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZVRva2VuO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDb25zdHJ1Y3QgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIHNlbGVjdG9yLCBjbGFzc05hbWVzID0gW10gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gbXVyZTtcbiAgICB0aGlzLnNlbGVjdG9yID0gc2VsZWN0b3I7XG4gICAgdGhpcy5zdHJlYW0gPSB0aGlzLm11cmUuc3RyZWFtKHsgc2VsZWN0b3I6IHNlbGVjdG9yIH0pO1xuICAgIHRoaXMuY2xhc3NOYW1lcyA9IGNsYXNzTmFtZXM7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IFtdO1xuICB9XG4gIHdyYXAgKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDb25zdHJ1Y3QsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNvbnN0cnVjdC8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDb25zdHJ1Y3Q7XG4iLCJpbXBvcnQgR2VuZXJpY0NvbnN0cnVjdCBmcm9tICcuL0dlbmVyaWNDb25zdHJ1Y3QuanMnO1xuXG5jbGFzcyBOb2RlQ29uc3RydWN0IGV4dGVuZHMgR2VuZXJpY0NvbnN0cnVjdCB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNvbnN0cnVjdDtcbiIsImltcG9ydCBHZW5lcmljQ29uc3RydWN0IGZyb20gJy4vR2VuZXJpY0NvbnN0cnVjdC5qcyc7XG5cbmNsYXNzIEVkZ2VDb25zdHJ1Y3QgZXh0ZW5kcyBHZW5lcmljQ29uc3RydWN0IHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ29uc3RydWN0O1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLndyYXBwZWRQYXJlbnQgPSB3cmFwcGVkUGFyZW50O1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgICB0aGlzLnJhd0l0ZW0gPSByYXdJdGVtO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IFN0cmVhbSBmcm9tICcuL1N0cmVhbS5qcyc7XG5pbXBvcnQgKiBhcyBUT0tFTlMgZnJvbSAnLi9Ub2tlbnMvVG9rZW5zLmpzJztcbmltcG9ydCAqIGFzIENPTlNUUlVDVFMgZnJvbSAnLi9Db25zdHJ1Y3RzL0NvbnN0cnVjdHMuanMnO1xuaW1wb3J0ICogYXMgV1JBUFBFUlMgZnJvbSAnLi9XcmFwcGVycy9XcmFwcGVycy5qcyc7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMucm9vdCA9IHt9O1xuICAgIHRoaXMuY2xhc3NlcyA9IHt9O1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgdGhpcy5UUlVUSFlfU1RSSU5HUyA9IHtcbiAgICAgICd0cnVlJzogdHJ1ZSxcbiAgICAgICd5ZXMnOiB0cnVlLFxuICAgICAgJ3knOiB0cnVlXG4gICAgfTtcbiAgICB0aGlzLkZBTFNFWV9TVFJJTkdTID0ge1xuICAgICAgJ2ZhbHNlJzogdHJ1ZSxcbiAgICAgICdubyc6IHRydWUsXG4gICAgICAnbic6IHRydWVcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UT0tFTlMgPSBUT0tFTlM7XG4gICAgdGhpcy5DT05TVFJVQ1RTID0gQ09OU1RSVUNUUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG5cbiAgICAvLyBNb25rZXktcGF0Y2ggYXZhaWxhYmxlIHRva2VucyBhcyBmdW5jdGlvbnMgb250byB0aGUgU3RyZWFtIGNsYXNzXG4gICAgZm9yIChjb25zdCB0b2tlbkNsYXNzTmFtZSBpbiB0aGlzLlRPS0VOUykge1xuICAgICAgY29uc3QgVG9rZW5DbGFzcyA9IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXTtcbiAgICAgIFN0cmVhbS5wcm90b3R5cGVbVG9rZW5DbGFzcy5sb3dlckNhbWVsQ2FzZVR5cGVdID0gZnVuY3Rpb24gKGFyZ0xpc3QsIGZ1bmN0aW9ucywgc3RyZWFtcykge1xuICAgICAgICByZXR1cm4gdGhpcy5leHRlbmQoVG9rZW5DbGFzcywgYXJnTGlzdCwgZnVuY3Rpb25zLCBzdHJlYW1zKTtcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgc3RyZWFtIChvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG4gIHdyYXAgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIGNvbnN0IHRva2VuTGlzdCA9IFt0b2tlbl07XG4gICAgbGV0IHRlbXAgPSB3cmFwcGVkUGFyZW50O1xuICAgIHdoaWxlICh0ZW1wICE9PSBudWxsKSB7XG4gICAgICB0b2tlbkxpc3QudW5zaGlmdCh0ZW1wLnRva2VuKTtcbiAgICAgIHRlbXAgPSB0ZW1wLndyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGZvciAobGV0IGNsYXNzU2VsZWN0b3IgaW4gdGhpcy5jbGFzc2VzKSB7XG4gICAgICBjb25zdCBjb25zdHJ1Y3QgPSB0aGlzLmNsYXNzZXNbY2xhc3NTZWxlY3Rvcl07XG4gICAgICBpZiAoY29uc3RydWN0LnN0cmVhbS5pc1N1cGVyU2V0T2ZUb2tlbkxpc3QodG9rZW5MaXN0KSkge1xuICAgICAgICByZXR1cm4gY29uc3RydWN0LndyYXAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyB0aGlzLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gIH1cblxuICBuZXdDbGFzcyAoeyBDbGFzc1R5cGUsIHNlbGVjdG9yLCBjbGFzc05hbWVzIH0pIHtcbiAgICBpZiAodGhpcy5jbGFzc2VzW3NlbGVjdG9yXSkge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tzZWxlY3Rvcl07XG4gICAgfVxuICAgIHRoaXMuY2xhc3Nlc1tzZWxlY3Rvcl0gPSBuZXcgQ2xhc3NUeXBlKHsgbXVyZTogdGhpcywgc2VsZWN0b3IsIGNsYXNzTmFtZXMgfSk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tzZWxlY3Rvcl07XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNEYXRhU291cmNlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlKHtcbiAgICAgIGtleTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFzeW5jIGFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGtleSxcbiAgICBleHRlbnNpb24gPSAndHh0JyxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICBsZXQgb2JqO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBvYmogPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljRGF0YVNvdXJjZShrZXksIG9iaik7XG4gIH1cbiAgYXN5bmMgYWRkU3RhdGljRGF0YVNvdXJjZSAoa2V5LCBvYmopIHtcbiAgICB0aGlzLnJvb3Rba2V5XSA9IG9iajtcbiAgICByZXR1cm4gdGhpcy5uZXdDbGFzcyh7XG4gICAgICBzZWxlY3RvcjogYHJvb3QudmFsdWVzKCcke2tleX0nKS52YWx1ZXMoKWAsXG4gICAgICBDbGFzc1R5cGU6IHRoaXMuQ09OU1RSVUNUUy5HZW5lcmljQ29uc3RydWN0LFxuICAgICAgY2xhc3NOYW1lczogWyBrZXkgXVxuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IEZpbGVSZWFkZXIgZnJvbSAnZmlsZXJlYWRlcic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUoRmlsZVJlYWRlcik7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsImluZGV4Iiwic3BsaWNlIiwiYXJncyIsImZvckVhY2giLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsInRpbWVvdXQiLCJ0cmlnZ2VyIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsImkiLCJERUZBVUxUX0ZVTkNUSU9OUyIsIndyYXBwZWRQYXJlbnQiLCJyYXdJdGVtIiwibWQ1IiwiU3RyZWFtIiwibXVyZSIsInRva2VuTGlzdCIsInBhcnNlU2VsZWN0b3IiLCJzZWxlY3RvciIsImZ1bmN0aW9ucyIsInN0cmVhbXMiLCJlcnJvck1vZGUiLCJ0cmF2ZXJzYWxNb2RlIiwiam9pbiIsInNlbGVjdG9yU3RyaW5nIiwic3RhcnRzV2l0aCIsIlN5bnRheEVycm9yIiwidG9rZW5TdHJpbmdzIiwibWF0Y2giLCJUT0tFTlMiLCJSb290VG9rZW4iLCJjaHVuayIsInRlbXAiLCJ0b2tlbkNsYXNzTmFtZSIsInRvVXBwZXJDYXNlIiwic2xpY2UiLCJhcmdMaXN0Iiwic3BsaXQiLCJtYXAiLCJkIiwidHJpbSIsIktleXNUb2tlbiIsIlZhbHVlVG9rZW4iLCJFcnJvciIsImRlZXBIZWxwZXIiLCJsZW5ndGgiLCJ3cmFwcGVkSXRlbSIsIm5hdmlnYXRlIiwiZXJyIiwiVHlwZUVycm9yIiwibGltaXQiLCJpdGVyYXRvciIsIml0ZXJhdGUiLCJuZXh0IiwiZG9uZSIsInZhbHVlIiwiVG9rZW5DbGFzcyIsIm5ld1N0cmVhbSIsIm1vZGUiLCJjb25jYXQiLCJldmVyeSIsInRva2VuIiwiaXNTdXBlclNldE9mIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwiY29uc3RydWN0b3IiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkJhc2VUb2tlbiIsInN0cmVhbSIsInRvTG93ZXJDYXNlIiwib3RoZXJUb2tlbiIsImV4ZWMiLCJuYW1lIiwid3JhcCIsInJvb3QiLCJtYXRjaEFsbCIsImtleXMiLCJyYW5nZXMiLCJhcmciLCJJbmZpbml0eSIsInBhcnNlSW50IiwiaXNOYU4iLCJsb3ciLCJoaWdoIiwibnVtIiwiTnVtYmVyIiwiSlNPTiIsInN0cmluZ2lmeSIsImNvbnNvbGlkYXRlUmFuZ2VzIiwic2VsZWN0c05vdGhpbmciLCJuZXdSYW5nZXMiLCJzb3J0IiwiYSIsImIiLCJjdXJyZW50UmFuZ2UiLCJ1bmRlZmluZWQiLCJ3YXJuIiwibmV3S2V5cyIsImtleSIsImFsbFBvaW50cyIsInJlZHVjZSIsImFnZyIsInJhbmdlIiwiaW5jbHVkZSIsImV4Y2x1ZGUiLCJkaWZmIiwiZGlmZmVyZW5jZSIsIk1hdGgiLCJtYXgiLCJtaW4iLCJoYXNPd25Qcm9wZXJ0eSIsIm9iaiIsImtleVR5cGUiLCJFdmFsdWF0ZVRva2VuIiwiTWFwVG9rZW4iLCJnZW5lcmF0b3IiLCJtYXBwZWRSYXdJdGVtIiwiUHJvbW90ZVRva2VuIiwiaGFzaCIsInJlZHVjZUluc3RhbmNlcyIsImZ1bmMiLCJzZWVuSXRlbXMiLCJHZW5lcmljQ29uc3RydWN0IiwiY2xhc3NOYW1lcyIsImFubm90YXRpb25zIiwib3B0aW9ucyIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJOb2RlQ29uc3RydWN0IiwiRWRnZUNvbnN0cnVjdCIsIk5vZGVXcmFwcGVyIiwiRWRnZVdyYXBwZXIiLCJNdXJlIiwiRmlsZVJlYWRlciIsIm1pbWUiLCJjbGFzc2VzIiwiREFUQUxJQl9GT1JNQVRTIiwiVFJVVEhZX1NUUklOR1MiLCJGQUxTRVlfU1RSSU5HUyIsIkNPTlNUUlVDVFMiLCJwcm90b3R5cGUiLCJleHRlbmQiLCJ1bnNoaWZ0IiwiY2xhc3NTZWxlY3RvciIsImNvbnN0cnVjdCIsImlzU3VwZXJTZXRPZlRva2VuTGlzdCIsIkNsYXNzVHlwZSIsImNoYXJzZXQiLCJmaWxlT2JqIiwiZmlsZU1CIiwic2l6ZSIsInNraXBTaXplQ2hlY2siLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZXN1bHQiLCJyZWFkQXNUZXh0IiwiZW5jb2RpbmciLCJhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UiLCJleHRlbnNpb25PdmVycmlkZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiYWRkU3RhdGljRGF0YVNvdXJjZSIsIm5ld0NsYXNzIiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsTUFBTUEsbUJBQW1CLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtrQkFDZjtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsYUFBTCxHQUFxQixFQUFyQjtXQUNLQyxjQUFMLEdBQXNCLEVBQXRCOztPQUVFQyxTQUFKLEVBQWVDLFFBQWYsRUFBeUJDLHVCQUF6QixFQUFrRDtVQUM1QyxDQUFDLEtBQUtKLGFBQUwsQ0FBbUJFLFNBQW5CLENBQUwsRUFBb0M7YUFDN0JGLGFBQUwsQ0FBbUJFLFNBQW5CLElBQWdDLEVBQWhDOztVQUVFLENBQUNFLHVCQUFMLEVBQThCO1lBQ3hCLEtBQUtKLGFBQUwsQ0FBbUJFLFNBQW5CLEVBQThCRyxPQUE5QixDQUFzQ0YsUUFBdEMsTUFBb0QsQ0FBQyxDQUF6RCxFQUE0RDs7OztXQUl6REgsYUFBTCxDQUFtQkUsU0FBbkIsRUFBOEJJLElBQTlCLENBQW1DSCxRQUFuQzs7UUFFR0QsU0FBTCxFQUFnQkMsUUFBaEIsRUFBMEI7VUFDcEIsS0FBS0gsYUFBTCxDQUFtQkUsU0FBbkIsQ0FBSixFQUFtQztZQUM3QixDQUFDQyxRQUFMLEVBQWU7aUJBQ04sS0FBS0gsYUFBTCxDQUFtQkUsU0FBbkIsQ0FBUDtTQURGLE1BRU87Y0FDREssUUFBUSxLQUFLUCxhQUFMLENBQW1CRSxTQUFuQixFQUE4QkcsT0FBOUIsQ0FBc0NGLFFBQXRDLENBQVo7Y0FDSUksU0FBUyxDQUFiLEVB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
