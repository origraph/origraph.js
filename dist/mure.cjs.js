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
    traversalMode = 'DFS'
  }) {
    this.mure = mure;

    this.tokenList = this.parseSelector(selector);

    this.functions = Object.assign({}, DEFAULT_FUNCTIONS, functions);
    this.streams = streams;
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

            if (!(wrappedItem instanceof _this.mure.WRAPPERS.GenericWrapper)) {
              if (_this.mure.debug) {
                console.warn(wrappedItem);
              }
            } else {
              yield wrappedItem;
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
        let parentYieldedSomething = false;
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = asyncIterator(_this2.deepHelper(tokenList, i - 1)), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
            let wrappedParent = _value2;

            parentYieldedSomething = true;
            if (wrappedParent instanceof _this2.mure.WRAPPERS.GenericWrapper) {
              yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(tokenList[i].navigate(wrappedParent)))), asyncGenerator.await);
            } else {
              yield wrappedParent;
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

        if (_this2.mure.debug && !parentYieldedSomething) {
          yield `Token yielded nothing: ${tokenList[i - 1]}`;
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
    return '.keys(' + (this.ranges || []).map(({ low, high }) => {
      return low === high ? low : `${low}-${high}`;
    }).concat(Object.keys(this.keys || {}).map(key => `'${key}'`)).join(',') + ')';
  }
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      if (typeof wrappedParent.rawItem !== 'object') {
        if (!_this.stream.mure.debug) {
          throw new TypeError(`Input to KeysToken is not an object`);
        } else {
          return;
        }
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
        if (!_this.stream.mure.debug) {
          throw new TypeError(`ValueToken used on a non-object, or without a string / numeric key`);
        } else {
          return;
        }
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
      if (typeof wrappedParent.rawItem !== 'string') {
        if (!_this.stream.mure.debug) {
          throw new TypeError(`Input to EvaluateToken is not a string`);
        } else {
          return;
        }
      }
      let newStream;
      try {
        newStream = _this.stream.mure.stream({
          selector: wrappedParent.rawItem,
          functions: _this.stream.functions,
          streams: _this.stream.streams,
          traversalMode: _this.stream.traversalMode
        });
      } catch (err) {
        if (!_this.stream.mure.debug || !(err instanceof SyntaxError)) {
          throw err;
        } else {
          return;
        }
      }
      const iterator = yield asyncGenerator.await(newStream.iterate());
      yield* asyncGeneratorDelegate(asyncIterator(iterator), asyncGenerator.await);
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

    this.debug = false; // Set mure.debug to true to debug streams

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
        if (extension === 'csv' || extension === 'tsv') {
          delete obj.columns;
        }
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

  removeDataSource(key) {
    delete this.root[key];
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
	test: "jest --runInBand",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL0NvbnN0cnVjdHMvR2VuZXJpY0NvbnN0cnVjdC5qcyIsIi4uL3NyYy9Db25zdHJ1Y3RzL05vZGVDb25zdHJ1Y3QuanMiLCIuLi9zcmMvQ29uc3RydWN0cy9FZGdlQ29uc3RydWN0LmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiaW1wb3J0IG1kNSBmcm9tICdibHVlaW1wLW1kNSc7XG5cbmNvbnN0IERFRkFVTFRfRlVOQ1RJT05TID0ge1xuICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZFBhcmVudCkgeyB5aWVsZCB3cmFwcGVkUGFyZW50LnJhd0l0ZW07IH0sXG4gIG1kNTogKHdyYXBwZWRQYXJlbnQpID0+IG1kNSh3cmFwcGVkUGFyZW50LnJhd0l0ZW0pLFxuICBub29wOiAoKSA9PiB7fVxufTtcblxuY2xhc3MgU3RyZWFtIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBtdXJlLFxuICAgIHNlbGVjdG9yID0gJ3Jvb3QnLFxuICAgIGZ1bmN0aW9ucyA9IHt9LFxuICAgIHN0cmVhbXMgPSB7fSxcbiAgICB0cmF2ZXJzYWxNb2RlID0gJ0RGUydcbiAgfSkge1xuICAgIHRoaXMubXVyZSA9IG11cmU7XG5cbiAgICB0aGlzLnRva2VuTGlzdCA9IHRoaXMucGFyc2VTZWxlY3RvcihzZWxlY3Rvcik7XG5cbiAgICB0aGlzLmZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfRlVOQ1RJT05TLCBmdW5jdGlvbnMpO1xuICAgIHRoaXMuc3RyZWFtcyA9IHN0cmVhbXM7XG4gICAgdGhpcy50cmF2ZXJzYWxNb2RlID0gdHJhdmVyc2FsTW9kZTtcbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5qb2luKCcnKTtcbiAgfVxuICBwYXJzZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZykge1xuICAgIGlmICghc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgncm9vdCcpKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFNlbGVjdG9ycyBtdXN0IHN0YXJ0IHdpdGggJ3Jvb3QnYCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yU3RyaW5nLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBpZiAoIXRva2VuU3RyaW5ncykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yIHN0cmluZzogJHtzZWxlY3RvclN0cmluZ31gKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5MaXN0ID0gW25ldyB0aGlzLm11cmUuVE9LRU5TLlJvb3RUb2tlbih0aGlzKV07XG4gICAgdG9rZW5TdHJpbmdzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IGNodW5rLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAoIXRlbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuOiAke2NodW5rfWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdG9rZW5DbGFzc05hbWUgPSB0ZW1wWzFdWzBdLnRvVXBwZXJDYXNlKCkgKyB0ZW1wWzFdLnNsaWNlKDEpICsgJ1Rva2VuJztcbiAgICAgIGNvbnN0IGFyZ0xpc3QgPSB0ZW1wWzJdLnNwbGl0KC8oPzwhXFxcXCksLykubWFwKGQgPT4gZC50cmltKCkpO1xuICAgICAgaWYgKHRva2VuQ2xhc3NOYW1lID09PSAnVmFsdWVzVG9rZW4nKSB7XG4gICAgICAgIHRva2VuTGlzdC5wdXNoKG5ldyB0aGlzLm11cmUuVE9LRU5TLktleXNUb2tlbih0aGlzLCBhcmdMaXN0KSk7XG4gICAgICAgIHRva2VuTGlzdC5wdXNoKG5ldyB0aGlzLm11cmUuVE9LRU5TLlZhbHVlVG9rZW4odGhpcywgW10pKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5tdXJlLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0pIHtcbiAgICAgICAgdG9rZW5MaXN0LnB1c2gobmV3IHRoaXMubXVyZS5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKHRoaXMsIGFyZ0xpc3QpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biB0b2tlbjogJHt0ZW1wWzFdfWApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0b2tlbkxpc3Q7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICBpZiAodGhpcy50cmF2ZXJzYWxNb2RlID09PSAnQkZTJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBCcmVhZHRoLWZpcnN0IGl0ZXJhdGlvbiBpcyBub3QgeWV0IGltcGxlbWVudGVkLmApO1xuICAgIH0gZWxzZSBpZiAodGhpcy50cmF2ZXJzYWxNb2RlID09PSAnREZTJykge1xuICAgICAgY29uc3QgZGVlcEhlbHBlciA9IHRoaXMuZGVlcEhlbHBlcih0aGlzLnRva2VuTGlzdCwgdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSk7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIGRlZXBIZWxwZXIpIHtcbiAgICAgICAgaWYgKCEod3JhcHBlZEl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIpKSB7XG4gICAgICAgICAgaWYgKHRoaXMubXVyZS5kZWJ1Zykge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKHdyYXBwZWRJdGVtKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHRyYXZlcnNhbE1vZGU6ICR7dGhpcy50cmF2ZXJzYWxNb2RlfWApO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogVGhpcyBoZWxwcyBkZXB0aC1maXJzdCBpdGVyYXRpb24gKHdlIG9ubHkgd2FudCB0byB5aWVsZCBmaW5pc2hlZCBwYXRocywgc29cbiAgICogaXQgbGF6aWx5IGFza3MgZm9yIHRoZW0gb25lIGF0IGEgdGltZSBmcm9tIHRoZSAqZmluYWwqIHRva2VuLCByZWN1cnNpdmVseVxuICAgKiBhc2tpbmcgZWFjaCBwcmVjZWRpbmcgdG9rZW4gdG8geWllbGQgZGVwZW5kZW50IHBhdGhzIG9ubHkgYXMgbmVlZGVkKVxuICAgKi9cbiAgYXN5bmMgKiBkZWVwSGVscGVyICh0b2tlbkxpc3QsIGkpIHtcbiAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgeWllbGQgKiBhd2FpdCB0b2tlbkxpc3RbMF0ubmF2aWdhdGUoKTsgLy8gVGhlIGZpcnN0IHRva2VuIGlzIGFsd2F5cyB0aGUgcm9vdFxuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgcGFyZW50WWllbGRlZFNvbWV0aGluZyA9IGZhbHNlO1xuICAgICAgZm9yIGF3YWl0IChsZXQgd3JhcHBlZFBhcmVudCBvZiB0aGlzLmRlZXBIZWxwZXIodG9rZW5MaXN0LCBpIC0gMSkpIHtcbiAgICAgICAgcGFyZW50WWllbGRlZFNvbWV0aGluZyA9IHRydWU7XG4gICAgICAgIGlmICh3cmFwcGVkUGFyZW50IGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKSB7XG4gICAgICAgICAgeWllbGQgKiBhd2FpdCB0b2tlbkxpc3RbaV0ubmF2aWdhdGUod3JhcHBlZFBhcmVudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZFBhcmVudDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubXVyZS5kZWJ1ZyAmJiAhcGFyZW50WWllbGRlZFNvbWV0aGluZykge1xuICAgICAgICB5aWVsZCBgVG9rZW4geWllbGRlZCBub3RoaW5nOiAke3Rva2VuTGlzdFtpIC0gMV19YDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyAqIHNhbXBsZSAoeyBsaW1pdCA9IDEwIH0pIHtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZSgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGV4dGVuZCAoVG9rZW5DbGFzcywgYXJnTGlzdCwgZnVuY3Rpb25zID0ge30sIHN0cmVhbXMgPSB7fSkge1xuICAgIGNvbnN0IG5ld1N0cmVhbSA9IG5ldyBTdHJlYW0oe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgZnVuY3Rpb25zOiBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmZ1bmN0aW9ucywgZnVuY3Rpb25zKSxcbiAgICAgIHN0cmVhbXM6IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuc3RyZWFtcywgc3RyZWFtcyksXG4gICAgICBtb2RlOiB0aGlzLm1vZGVcbiAgICB9KTtcbiAgICBuZXdTdHJlYW0udG9rZW5MaXN0ID0gdGhpcy50b2tlbkxpc3QuY29uY2F0KFsgbmV3IFRva2VuQ2xhc3MobmV3U3RyZWFtLCBhcmdMaXN0KSBdKTtcbiAgICByZXR1cm4gbmV3U3RyZWFtO1xuICB9XG5cbiAgaXNTdXBlclNldE9mVG9rZW5MaXN0ICh0b2tlbkxpc3QpIHtcbiAgICBpZiAodG9rZW5MaXN0Lmxlbmd0aCAhPT0gdGhpcy50b2tlbkxpc3QubGVuZ3RoKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5ldmVyeSgodG9rZW4sIGkpID0+IHRva2VuLmlzU3VwZXJTZXRPZih0b2tlbkxpc3RbaV0pKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RyZWFtO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEJhc2VUb2tlbiBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zdHJlYW0gPSBzdHJlYW07XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIC8vIFRoZSBzdHJpbmcgdmVyc2lvbiBvZiBtb3N0IHRva2VucyBjYW4ganVzdCBiZSBkZXJpdmVkIGZyb20gdGhlIGNsYXNzIHR5cGVcbiAgICByZXR1cm4gYC4ke3RoaXMudHlwZS50b0xvd2VyQ2FzZSgpfSgpYDtcbiAgfVxuICBpc1N1cGVyU2V0T2YgKG90aGVyVG9rZW4pIHtcbiAgICByZXR1cm4gb3RoZXJUb2tlbi5jb25zdHJ1Y3RvciA9PT0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXNlVG9rZW4sICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRva2VuLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQmFzZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFJvb3RUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gICogbmF2aWdhdGUgKCkge1xuICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICB3cmFwcGVkUGFyZW50OiBudWxsLFxuICAgICAgdG9rZW46IHRoaXMsXG4gICAgICByYXdJdGVtOiB0aGlzLnN0cmVhbS5tdXJlLnJvb3RcbiAgICB9KTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGByb290YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUm9vdFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEtleXNUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIGFyZ0xpc3QsIHsgbWF0Y2hBbGwsIGtleXMsIHJhbmdlcyB9ID0ge30pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmIChrZXlzIHx8IHJhbmdlcykge1xuICAgICAgdGhpcy5rZXlzID0ga2V5cztcbiAgICAgIHRoaXMucmFuZ2VzID0gcmFuZ2VzO1xuICAgIH0gZWxzZSBpZiAoKGFyZ0xpc3QgJiYgYXJnTGlzdC5sZW5ndGggPT09IDEgJiYgYXJnTGlzdFswXSA9PT0gJycpIHx8IG1hdGNoQWxsKSB7XG4gICAgICB0aGlzLm1hdGNoQWxsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnTGlzdC5mb3JFYWNoKGFyZyA9PiB7XG4gICAgICAgIGxldCB0ZW1wID0gYXJnLm1hdGNoKC8oXFxkKyktKFtcXGTiiJ5dKykvKTtcbiAgICAgICAgaWYgKHRlbXAgJiYgdGVtcFsyXSA9PT0gJ+KInicpIHtcbiAgICAgICAgICB0ZW1wWzJdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IHRlbXAgPyB0ZW1wLm1hcChkID0+IGQucGFyc2VJbnQoZCkpIDogbnVsbDtcbiAgICAgICAgaWYgKHRlbXAgJiYgIWlzTmFOKHRlbXBbMV0pICYmICFpc05hTih0ZW1wWzJdKSkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSB0ZW1wWzFdOyBpIDw9IHRlbXBbMl07IGkrKykge1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IHRlbXBbMV0sIGhpZ2g6IHRlbXBbMl0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gYXJnLm1hdGNoKC8nKC4qKScvKTtcbiAgICAgICAgdGVtcCA9IHRlbXAgJiYgdGVtcFsxXSA/IHRlbXBbMV0gOiBhcmc7XG4gICAgICAgIGxldCBudW0gPSBOdW1iZXIodGVtcCk7XG4gICAgICAgIGlmIChpc05hTihudW0pIHx8IG51bSAhPT0gcGFyc2VJbnQodGVtcCkpIHsgLy8gbGVhdmUgbm9uLWludGVnZXIgbnVtYmVycyBhcyBzdHJpbmdzXG4gICAgICAgICAgdGhpcy5rZXlzID0gdGhpcy5rZXlzIHx8IHt9O1xuICAgICAgICAgIHRoaXMua2V5c1t0ZW1wXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiBudW0sIGhpZ2g6IG51bSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBCYWQgdG9rZW4ga2V5KHMpIC8gcmFuZ2Uocyk6ICR7SlNPTi5zdHJpbmdpZnkoYXJnTGlzdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLmNvbnNvbGlkYXRlUmFuZ2VzKHRoaXMucmFuZ2VzKTtcbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdHNOb3RoaW5nICgpIHtcbiAgICByZXR1cm4gIXRoaXMubWF0Y2hBbGwgJiYgIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXM7XG4gIH1cbiAgY29uc29saWRhdGVSYW5nZXMgKHJhbmdlcykge1xuICAgIC8vIE1lcmdlIGFueSBvdmVybGFwcGluZyByYW5nZXNcbiAgICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcbiAgICBjb25zdCB0ZW1wID0gcmFuZ2VzLnNvcnQoKGEsIGIpID0+IGEubG93IC0gYi5sb3cpO1xuICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFjdXJyZW50UmFuZ2UpIHtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH0gZWxzZSBpZiAodGVtcFtpXS5sb3cgPD0gY3VycmVudFJhbmdlLmhpZ2gpIHtcbiAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSB0ZW1wW2ldLmhpZ2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgICAvLyBDb3JuZXIgY2FzZTogYWRkIHRoZSBsYXN0IHJhbmdlXG4gICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UmFuZ2VzLmxlbmd0aCA+IDAgPyBuZXdSYW5nZXMgOiB1bmRlZmluZWQ7XG4gIH1cbiAgZGlmZmVyZW5jZSAob3RoZXJUb2tlbikge1xuICAgIC8vIENvbXB1dGUgd2hhdCBpcyBsZWZ0IG9mIHRoaXMgYWZ0ZXIgc3VidHJhY3Rpbmcgb3V0IGV2ZXJ5dGhpbmcgaW4gb3RoZXJUb2tlblxuICAgIGlmICghKG90aGVyVG9rZW4gaW5zdGFuY2VvZiBLZXlzVG9rZW4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNvbXB1dGUgdGhlIGRpZmZlcmVuY2Ugb2YgdHdvIGRpZmZlcmVudCB0b2tlbiB0eXBlc2ApO1xuICAgIH0gZWxzZSBpZiAob3RoZXJUb2tlbi5tYXRjaEFsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEluYWNjdXJhdGUgZGlmZmVyZW5jZSBjb21wdXRlZCEgVE9ETzogbmVlZCB0byBmaWd1cmUgb3V0IGhvdyB0byBpbnZlcnQgY2F0ZWdvcmljYWwga2V5cyFgKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdLZXlzID0ge307XG4gICAgICBmb3IgKGxldCBrZXkgaW4gKHRoaXMua2V5cyB8fCB7fSkpIHtcbiAgICAgICAgaWYgKCFvdGhlclRva2VuLmtleXMgfHwgIW90aGVyVG9rZW4ua2V5c1trZXldKSB7XG4gICAgICAgICAgbmV3S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1JhbmdlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICAgIGlmIChvdGhlclRva2VuLnJhbmdlcykge1xuICAgICAgICAgIGxldCBhbGxQb2ludHMgPSB0aGlzLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgYWxsUG9pbnRzID0gYWxsUG9pbnRzLmNvbmNhdChvdGhlclRva2VuLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSkpLnNvcnQoKTtcbiAgICAgICAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbFBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IHsgbG93OiBhbGxQb2ludHNbaV0udmFsdWUgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS52YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5leGNsdWRlKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0ubG93IC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5sb3cgPSBhbGxQb2ludHNbaV0uaGlnaCArIDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3UmFuZ2VzID0gdGhpcy5yYW5nZXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgS2V5c1Rva2VuKHRoaXMubXVyZSwgbnVsbCwgeyBrZXlzOiBuZXdLZXlzLCByYW5nZXM6IG5ld1JhbmdlcyB9KTtcbiAgICB9XG4gIH1cbiAgaXNTdXBlclNldE9mIChvdGhlclRva2VuKSB7XG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZGlmZiA9IG90aGVyVG9rZW4uZGlmZmVyZW5jZSh0aGlzKTtcbiAgICAgIHJldHVybiBkaWZmID09PSBudWxsIHx8IGRpZmYuc2VsZWN0c05vdGhpbmc7XG4gICAgfVxuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICBpZiAodGhpcy5tYXRjaEFsbCkgeyByZXR1cm4gJy5rZXlzKCknOyB9XG4gICAgcmV0dXJuICcua2V5cygnICsgKHRoaXMucmFuZ2VzIHx8IFtdKS5tYXAoKHtsb3csIGhpZ2h9KSA9PiB7XG4gICAgICByZXR1cm4gbG93ID09PSBoaWdoID8gbG93IDogYCR7bG93fS0ke2hpZ2h9YDtcbiAgICB9KS5jb25jYXQoT2JqZWN0LmtleXModGhpcy5rZXlzIHx8IHt9KS5tYXAoa2V5ID0+IGAnJHtrZXl9J2ApKVxuICAgICAgLmpvaW4oJywnKSArICcpJztcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gS2V5c1Rva2VuIGlzIG5vdCBhbiBvYmplY3RgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGZvciAobGV0IGtleSBpbiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0pIHtcbiAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZm9yIChsZXQge2xvdywgaGlnaH0gb2YgdGhpcy5yYW5nZXMgfHwgW10pIHtcbiAgICAgICAgbG93ID0gTWF0aC5tYXgoMCwgbG93KTtcbiAgICAgICAgaGlnaCA9IE1hdGgubWluKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5sZW5ndGggLSAxLCBoaWdoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IGxvdzsgaSA8PSBoaWdoOyBpKyspIHtcbiAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICByYXdJdGVtOiBpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAobGV0IGtleSBpbiB0aGlzLmtleXMgfHwge30pIHtcbiAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBLZXlzVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgVmFsdWVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBjb25zdCBvYmogPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICBjb25zdCBrZXkgPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICBjb25zdCBrZXlUeXBlID0gdHlwZW9mIGtleTtcbiAgICBpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgfHwgKGtleVR5cGUgIT09ICdzdHJpbmcnICYmIGtleVR5cGUgIT09ICdudW1iZXInKSkge1xuICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgcmF3SXRlbTogb2JqW2tleV1cbiAgICB9KTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVmFsdWVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBFdmFsdWF0ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGlmICh0eXBlb2Ygd3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnc3RyaW5nJykge1xuICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEV2YWx1YXRlVG9rZW4gaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBuZXdTdHJlYW07XG4gICAgdHJ5IHtcbiAgICAgIG5ld1N0cmVhbSA9IHRoaXMuc3RyZWFtLm11cmUuc3RyZWFtKHtcbiAgICAgICAgc2VsZWN0b3I6IHdyYXBwZWRQYXJlbnQucmF3SXRlbSxcbiAgICAgICAgZnVuY3Rpb25zOiB0aGlzLnN0cmVhbS5mdW5jdGlvbnMsXG4gICAgICAgIHN0cmVhbXM6IHRoaXMuc3RyZWFtLnN0cmVhbXMsXG4gICAgICAgIHRyYXZlcnNhbE1vZGU6IHRoaXMuc3RyZWFtLnRyYXZlcnNhbE1vZGVcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnIHx8ICEoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpKSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgaXRlcmF0b3IgPSBhd2FpdCBuZXdTdHJlYW0uaXRlcmF0ZSgpO1xuICAgIHlpZWxkICogaXRlcmF0b3I7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0uZnVuY3Rpb25zW2dlbmVyYXRvcl0pIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBmdW5jdGlvbjogJHtnZW5lcmF0b3J9YCk7XG4gICAgfVxuICAgIHRoaXMuZ2VuZXJhdG9yID0gc3RyZWFtLmZ1bmN0aW9uc1tnZW5lcmF0b3JdO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5tYXAoJHt0aGlzLmdlbmVyYXRvcn0pYDtcbiAgfVxuICBpc1N1cGVyU2V0T2YgKG90aGVyVG9rZW4pIHtcbiAgICByZXR1cm4gb3RoZXJUb2tlbi5jb25zdHJ1Y3RvciA9PT0gTWFwVG9rZW4gJiYgb3RoZXJUb2tlbi5nZW5lcmF0b3IgPT09IHRoaXMuZ2VuZXJhdG9yO1xuICB9XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgdGhpcy5nZW5lcmF0b3Iod3JhcHBlZFBhcmVudCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFwVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUHJvbW90ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ21kNScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBmb3IgKGNvbnN0IGZ1bmMgb2YgWyBtYXAsIGhhc2gsIHJlZHVjZUluc3RhbmNlcyBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5mdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG4gICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPSByZWR1Y2VJbnN0YW5jZXM7XG5cbiAgICB0aGlzLnNlZW5JdGVtcyA9IHt9O1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5wcm9tb3RlKCR7dGhpcy5tYXB9LCAke3RoaXMuaGFzaH0sICR7dGhpcy5yZWR1Y2VJbnN0YW5jZXN9KWA7XG4gIH1cbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiB0aGlzLm1hcCh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgY29uc3QgaGFzaCA9IHRoaXMuaGFzaChtYXBwZWRSYXdJdGVtKTtcbiAgICAgIGlmICh0aGlzLnNlZW5JdGVtc1toYXNoXSkge1xuICAgICAgICB0aGlzLnJlZHVjZUluc3RhbmNlcyh0aGlzLnNlZW5JdGVtc1toYXNoXSwgbWFwcGVkUmF3SXRlbSk7XG4gICAgICAgIHRoaXMuc2Vlbkl0ZW1zW2hhc2hdLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zZWVuSXRlbXNbaGFzaF0gPSB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZVRva2VuO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDb25zdHJ1Y3QgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIHNlbGVjdG9yLCBjbGFzc05hbWVzID0gW10gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gbXVyZTtcbiAgICB0aGlzLnNlbGVjdG9yID0gc2VsZWN0b3I7XG4gICAgdGhpcy5zdHJlYW0gPSB0aGlzLm11cmUuc3RyZWFtKHsgc2VsZWN0b3I6IHNlbGVjdG9yIH0pO1xuICAgIHRoaXMuY2xhc3NOYW1lcyA9IGNsYXNzTmFtZXM7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IFtdO1xuICB9XG4gIHdyYXAgKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDb25zdHJ1Y3QsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNvbnN0cnVjdC8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDb25zdHJ1Y3Q7XG4iLCJpbXBvcnQgR2VuZXJpY0NvbnN0cnVjdCBmcm9tICcuL0dlbmVyaWNDb25zdHJ1Y3QuanMnO1xuXG5jbGFzcyBOb2RlQ29uc3RydWN0IGV4dGVuZHMgR2VuZXJpY0NvbnN0cnVjdCB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNvbnN0cnVjdDtcbiIsImltcG9ydCBHZW5lcmljQ29uc3RydWN0IGZyb20gJy4vR2VuZXJpY0NvbnN0cnVjdC5qcyc7XG5cbmNsYXNzIEVkZ2VDb25zdHJ1Y3QgZXh0ZW5kcyBHZW5lcmljQ29uc3RydWN0IHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ29uc3RydWN0O1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLndyYXBwZWRQYXJlbnQgPSB3cmFwcGVkUGFyZW50O1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgICB0aGlzLnJhd0l0ZW0gPSByYXdJdGVtO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IFN0cmVhbSBmcm9tICcuL1N0cmVhbS5qcyc7XG5pbXBvcnQgKiBhcyBUT0tFTlMgZnJvbSAnLi9Ub2tlbnMvVG9rZW5zLmpzJztcbmltcG9ydCAqIGFzIENPTlNUUlVDVFMgZnJvbSAnLi9Db25zdHJ1Y3RzL0NvbnN0cnVjdHMuanMnO1xuaW1wb3J0ICogYXMgV1JBUFBFUlMgZnJvbSAnLi9XcmFwcGVycy9XcmFwcGVycy5qcyc7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnJvb3QgPSB7fTtcbiAgICB0aGlzLmNsYXNzZXMgPSB7fTtcblxuICAgIC8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG4gICAgdGhpcy5EQVRBTElCX0ZPUk1BVFMgPSB7XG4gICAgICAnanNvbic6ICdqc29uJyxcbiAgICAgICdjc3YnOiAnY3N2JyxcbiAgICAgICd0c3YnOiAndHN2JyxcbiAgICAgICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICAgICAndHJlZWpzb24nOiAndHJlZWpzb24nXG4gICAgfTtcblxuICAgIHRoaXMuVFJVVEhZX1NUUklOR1MgPSB7XG4gICAgICAndHJ1ZSc6IHRydWUsXG4gICAgICAneWVzJzogdHJ1ZSxcbiAgICAgICd5JzogdHJ1ZVxuICAgIH07XG4gICAgdGhpcy5GQUxTRVlfU1RSSU5HUyA9IHtcbiAgICAgICdmYWxzZSc6IHRydWUsXG4gICAgICAnbm8nOiB0cnVlLFxuICAgICAgJ24nOiB0cnVlXG4gICAgfTtcblxuICAgIC8vIEFjY2VzcyB0byBjb3JlIGNsYXNzZXMgdmlhIHRoZSBtYWluIGxpYnJhcnkgaGVscHMgYXZvaWQgY2lyY3VsYXIgaW1wb3J0c1xuICAgIHRoaXMuVE9LRU5TID0gVE9LRU5TO1xuICAgIHRoaXMuQ09OU1RSVUNUUyA9IENPTlNUUlVDVFM7XG4gICAgdGhpcy5XUkFQUEVSUyA9IFdSQVBQRVJTO1xuXG4gICAgLy8gTW9ua2V5LXBhdGNoIGF2YWlsYWJsZSB0b2tlbnMgYXMgZnVuY3Rpb25zIG9udG8gdGhlIFN0cmVhbSBjbGFzc1xuICAgIGZvciAoY29uc3QgdG9rZW5DbGFzc05hbWUgaW4gdGhpcy5UT0tFTlMpIHtcbiAgICAgIGNvbnN0IFRva2VuQ2xhc3MgPSB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV07XG4gICAgICBTdHJlYW0ucHJvdG90eXBlW1Rva2VuQ2xhc3MubG93ZXJDYW1lbENhc2VUeXBlXSA9IGZ1bmN0aW9uIChhcmdMaXN0LCBmdW5jdGlvbnMsIHN0cmVhbXMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXh0ZW5kKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIGZ1bmN0aW9ucywgc3RyZWFtcyk7XG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHN0cmVhbSAob3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuICB3cmFwICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBjb25zdCB0b2tlbkxpc3QgPSBbdG9rZW5dO1xuICAgIGxldCB0ZW1wID0gd3JhcHBlZFBhcmVudDtcbiAgICB3aGlsZSAodGVtcCAhPT0gbnVsbCkge1xuICAgICAgdG9rZW5MaXN0LnVuc2hpZnQodGVtcC50b2tlbik7XG4gICAgICB0ZW1wID0gdGVtcC53cmFwcGVkUGFyZW50O1xuICAgIH1cbiAgICBmb3IgKGxldCBjbGFzc1NlbGVjdG9yIGluIHRoaXMuY2xhc3Nlcykge1xuICAgICAgY29uc3QgY29uc3RydWN0ID0gdGhpcy5jbGFzc2VzW2NsYXNzU2VsZWN0b3JdO1xuICAgICAgaWYgKGNvbnN0cnVjdC5zdHJlYW0uaXNTdXBlclNldE9mVG9rZW5MaXN0KHRva2VuTGlzdCkpIHtcbiAgICAgICAgcmV0dXJuIGNvbnN0cnVjdC53cmFwKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXcgdGhpcy5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcih7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICB9XG5cbiAgbmV3Q2xhc3MgKHsgQ2xhc3NUeXBlLCBzZWxlY3RvciwgY2xhc3NOYW1lcyB9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3Nlc1tzZWxlY3Rvcl0pIHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzZXNbc2VsZWN0b3JdO1xuICAgIH1cbiAgICB0aGlzLmNsYXNzZXNbc2VsZWN0b3JdID0gbmV3IENsYXNzVHlwZSh7IG11cmU6IHRoaXMsIHNlbGVjdG9yLCBjbGFzc05hbWVzIH0pO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbc2VsZWN0b3JdO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHk7IHRyeSBhZGREeW5hbWljRGF0YVNvdXJjZSgpIGluc3RlYWQuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSh7XG4gICAgICBrZXk6IGZpbGVPYmoubmFtZSxcbiAgICAgIGV4dGVuc2lvbjogZXh0ZW5zaW9uT3ZlcnJpZGUgfHwgbWltZS5leHRlbnNpb24oZmlsZU9iai50eXBlKSxcbiAgICAgIHRleHRcbiAgICB9KTtcbiAgfVxuICBhc3luYyBhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBrZXksXG4gICAgZXh0ZW5zaW9uID0gJ3R4dCcsXG4gICAgdGV4dFxuICB9KSB7XG4gICAgbGV0IG9iajtcbiAgICBpZiAodGhpcy5EQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgb2JqID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBkZWxldGUgb2JqLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljRGF0YVNvdXJjZShrZXksIG9iaik7XG4gIH1cbiAgYXN5bmMgYWRkU3RhdGljRGF0YVNvdXJjZSAoa2V5LCBvYmopIHtcbiAgICB0aGlzLnJvb3Rba2V5XSA9IG9iajtcbiAgICByZXR1cm4gdGhpcy5uZXdDbGFzcyh7XG4gICAgICBzZWxlY3RvcjogYHJvb3QudmFsdWVzKCcke2tleX0nKS52YWx1ZXMoKWAsXG4gICAgICBDbGFzc1R5cGU6IHRoaXMuQ09OU1RSVUNUUy5HZW5lcmljQ29uc3RydWN0LFxuICAgICAgY2xhc3NOYW1lczogWyBrZXkgXVxuICAgIH0pO1xuICB9XG5cbiAgcmVtb3ZlRGF0YVNvdXJjZSAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMucm9vdFtrZXldO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IEZpbGVSZWFkZXIgZnJvbSAnZmlsZXJlYWRlcic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUoRmlsZVJlYWRlcik7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsImluZGV4Iiwic3BsaWNlIiwiYXJncyIsImZvckVhY2giLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsInRpbWVvdXQiLCJ0cmlnZ2VyIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsImkiLCJERUZBVUxUX0ZVTkNUSU9OUyIsIndyYXBwZWRQYXJlbnQiLCJyYXdJdGVtIiwibWQ1IiwiU3RyZWFtIiwibXVyZSIsInRva2VuTGlzdCIsInBhcnNlU2VsZWN0b3IiLCJzZWxlY3RvciIsImZ1bmN0aW9ucyIsInN0cmVhbXMiLCJ0cmF2ZXJzYWxNb2RlIiwiam9pbiIsInNlbGVjdG9yU3RyaW5nIiwic3RhcnRzV2l0aCIsIlN5bnRheEVycm9yIiwidG9rZW5TdHJpbmdzIiwibWF0Y2giLCJUT0tFTlMiLCJSb290VG9rZW4iLCJjaHVuayIsInRlbXAiLCJ0b2tlbkNsYXNzTmFtZSIsInRvVXBwZXJDYXNlIiwic2xpY2UiLCJhcmdMaXN0Iiwic3BsaXQiLCJtYXAiLCJkIiwidHJpbSIsIktleXNUb2tlbiIsIlZhbHVlVG9rZW4iLCJFcnJvciIsImRlZXBIZWxwZXIiLCJsZW5ndGgiLCJ3cmFwcGVkSXRlbSIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJkZWJ1ZyIsIndhcm4iLCJuYXZpZ2F0ZSIsInBhcmVudFlpZWxkZWRTb21ldGhpbmciLCJsaW1pdCIsIml0ZXJhdG9yIiwiaXRlcmF0ZSIsIm5leHQiLCJkb25lIiwidmFsdWUiLCJUb2tlbkNsYXNzIiwibmV3U3RyZWFtIiwibW9kZSIsImNvbmNhdCIsImV2ZXJ5IiwidG9rZW4iLCJpc1N1cGVyU2V0T2YiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJjb25zdHJ1Y3RvciIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiQmFzZVRva2VuIiwic3RyZWFtIiwidG9Mb3dlckNhc2UiLCJvdGhlclRva2VuIiwiZXhlYyIsIm5hbWUiLCJ3cmFwIiwicm9vdCIsIm1hdGNoQWxsIiwia2V5cyIsInJhbmdlcyIsImFyZyIsIkluZmluaXR5IiwicGFyc2VJbnQiLCJpc05hTiIsImxvdyIsImhpZ2giLCJudW0iLCJOdW1iZXIiLCJKU09OIiwic3RyaW5naWZ5IiwiY29uc29saWRhdGVSYW5nZXMiLCJzZWxlY3RzTm90aGluZyIsIm5ld1JhbmdlcyIsInNvcnQiLCJhIiwiYiIsImN1cnJlbnRSYW5nZSIsInVuZGVmaW5lZCIsIm5ld0tleXMiLCJrZXkiLCJhbGxQb2ludHMiLCJyZWR1Y2UiLCJhZ2ciLCJyYW5nZSIsImluY2x1ZGUiLCJleGNsdWRlIiwiZGlmZiIsImRpZmZlcmVuY2UiLCJUeXBlRXJyb3IiLCJNYXRoIiwibWF4IiwibWluIiwiaGFzT3duUHJvcGVydHkiLCJvYmoiLCJrZXlUeXBlIiwiRXZhbHVhdGVUb2tlbiIsImVyciIsIk1hcFRva2VuIiwiZ2VuZXJhdG9yIiwibWFwcGVkUmF3SXRlbSIsIlByb21vdGVUb2tlbiIsImhhc2giLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwic2Vlbkl0ZW1zIiwiR2VuZXJpY0NvbnN0cnVjdCIsImNsYXNzTmFtZXMiLCJhbm5vdGF0aW9ucyIsIm9wdGlvbnMiLCJOb2RlQ29uc3RydWN0IiwiRWRnZUNvbnN0cnVjdCIsIk5vZGVXcmFwcGVyIiwiRWRnZVdyYXBwZXIiLCJNdXJlIiwiRmlsZVJlYWRlciIsIm1pbWUiLCJjbGFzc2VzIiwiREFUQUxJQl9GT1JNQVRTIiwiVFJVVEhZX1NUUklOR1MiLCJGQUxTRVlfU1RSSU5HUyIsIkNPTlNUUlVDVFMiLCJwcm90b3R5cGUiLCJleHRlbmQiLCJ1bnNoaWZ0IiwiY2xhc3NTZWxlY3RvciIsImNvbnN0cnVjdCIsImlzU3VwZXJTZXRPZlRva2VuTGlzdCIsIkNsYXNzVHlwZSIsImNoYXJzZXQiLCJmaWxlT2JqIiwiZmlsZU1CIiwic2l6ZSIsInNraXBTaXplQ2hlY2siLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZXN1bHQiLCJyZWFkQXNUZXh0IiwiZW5jb2RpbmciLCJhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UiLCJleHRlbnNpb25PdmVycmlkZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY0RhdGFTb3VyY2UiLCJuZXdDbGFzcyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE1BQU1BLG1CQUFtQixVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7a0JBQ2Y7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGFBQUwsR0FBcUIsRUFBckI7V0FDS0MsY0FBTCxHQUFzQixFQUF0Qjs7T0FFRUMsU0FBSixFQUFlQyxRQUFmLEVBQXlCQyx1QkFBekIsRUFBa0Q7VUFDNUMsQ0FBQyxLQUFLSixhQUFMLENBQW1CRSxTQUFuQixDQUFMLEVBQW9DO2FBQzdCRixhQUFMLENBQW1CRSxTQUFuQixJQUFnQyxFQUFoQzs7VUFFRSxDQUFDRSx1QkFBTCxFQUE4QjtZQUN4QixLQUFLSixhQUFMLENBQW1CRSxTQUFuQixFQUE4QkcsT0FBOUIsQ0FBc0NGLFFBQXRDLE1BQW9ELENBQUMsQ0FBekQsRUFBNEQ7Ozs7V0FJekRILGFBQUwsQ0FBbUJFLFNBQW5CLEVBQThCSSxJQUE5QixDQUFtQ0gsUUFBbkM7O1FBRUdELFNBQUwsRUFBZ0JDLFFBQWhCLEVBQTBCO1VBQ3BCLEtBQUtILGFBQUwsQ0FBbUJFLFNBQW5CLENBQUosRUFBbUM7WUFDN0IsQ0FBQ0MsUUFBTCxFQUFlO2lCQUNOLEtBQUtILGFB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
