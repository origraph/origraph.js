'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var sha1 = _interopDefault(require('sha1'));
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
          setTimeout(() => {
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
  sha1: rawItem => sha1(JSON.stringify(rawItem)),
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
    this.functions = Object.assign({}, DEFAULT_FUNCTIONS, functions);
    this.streams = streams;
    this.traversalMode = traversalMode;
    this.tokenList = this.parseSelector(selector);
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
      const argList = temp[2].split(/(?<!\\),/).map(d => {
        d = d.trim();
        return d === '' ? undefined : d;
      });
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
              const iterator = yield asyncGenerator.await(tokenList[i].navigate(wrappedParent));
              yield* asyncGeneratorDelegate(asyncIterator(iterator), asyncGenerator.await);
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
    } else if (argList && argList.length === 1 && argList[0] === undefined || matchAll) {
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
    this.generator = generator;
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
        for (var _iterator = asyncIterator(_this.stream.functions[_this.generator](wrappedParent)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
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
  constructor(stream, [map = 'identity', hash = 'sha1', reduceInstances = 'noop']) {
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
        for (var _iterator = asyncIterator(_this.stream.functions[_this.map](wrappedParent)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const mappedRawItem = _value;

          const hash = _this.stream.functions[_this.hash](mappedRawItem);
          if (_this.seenItems[hash]) {
            if (_this.reduceInstances !== 'noop') {
              _this.stream.functions[_this.reduceInstances](_this.seenItems[hash], mappedRawItem);
              _this.seenItems[hash].trigger('update');
            }
          } else {
            _this.seenItems[hash] = _this.stream.mure.wrap({
              wrappedParent,
              token: _this,
              rawItem: mappedRawItem
            });
            yield _this.seenItems[hash];
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
	datalib: "^1.9.1",
	"mime-types": "^2.1.19",
	sha1: "^1.1.1"
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL0NvbnN0cnVjdHMvR2VuZXJpY0NvbnN0cnVjdC5qcyIsIi4uL3NyYy9Db25zdHJ1Y3RzL05vZGVDb25zdHJ1Y3QuanMiLCIuLi9zcmMvQ29uc3RydWN0cy9FZGdlQ29uc3RydWN0LmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJpbXBvcnQgc2hhMSBmcm9tICdzaGExJztcblxuY29uc3QgREVGQVVMVF9GVU5DVElPTlMgPSB7XG4gIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkUGFyZW50KSB7IHlpZWxkIHdyYXBwZWRQYXJlbnQucmF3SXRlbTsgfSxcbiAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgbm9vcDogKCkgPT4ge31cbn07XG5cbmNsYXNzIFN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgbXVyZSxcbiAgICBzZWxlY3RvciA9ICdyb290JyxcbiAgICBmdW5jdGlvbnMgPSB7fSxcbiAgICBzdHJlYW1zID0ge30sXG4gICAgdHJhdmVyc2FsTW9kZSA9ICdERlMnXG4gIH0pIHtcbiAgICB0aGlzLm11cmUgPSBtdXJlO1xuICAgIHRoaXMuZnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9GVU5DVElPTlMsIGZ1bmN0aW9ucyk7XG4gICAgdGhpcy5zdHJlYW1zID0gc3RyZWFtcztcbiAgICB0aGlzLnRyYXZlcnNhbE1vZGUgPSB0cmF2ZXJzYWxNb2RlO1xuICAgIHRoaXMudG9rZW5MaXN0ID0gdGhpcy5wYXJzZVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5qb2luKCcnKTtcbiAgfVxuICBwYXJzZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZykge1xuICAgIGlmICghc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgncm9vdCcpKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFNlbGVjdG9ycyBtdXN0IHN0YXJ0IHdpdGggJ3Jvb3QnYCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yU3RyaW5nLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBpZiAoIXRva2VuU3RyaW5ncykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yIHN0cmluZzogJHtzZWxlY3RvclN0cmluZ31gKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5MaXN0ID0gW25ldyB0aGlzLm11cmUuVE9LRU5TLlJvb3RUb2tlbih0aGlzKV07XG4gICAgdG9rZW5TdHJpbmdzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IGNodW5rLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAoIXRlbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuOiAke2NodW5rfWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdG9rZW5DbGFzc05hbWUgPSB0ZW1wWzFdWzBdLnRvVXBwZXJDYXNlKCkgKyB0ZW1wWzFdLnNsaWNlKDEpICsgJ1Rva2VuJztcbiAgICAgIGNvbnN0IGFyZ0xpc3QgPSB0ZW1wWzJdLnNwbGl0KC8oPzwhXFxcXCksLykubWFwKGQgPT4ge1xuICAgICAgICBkID0gZC50cmltKCk7XG4gICAgICAgIHJldHVybiBkID09PSAnJyA/IHVuZGVmaW5lZCA6IGQ7XG4gICAgICB9KTtcbiAgICAgIGlmICh0b2tlbkNsYXNzTmFtZSA9PT0gJ1ZhbHVlc1Rva2VuJykge1xuICAgICAgICB0b2tlbkxpc3QucHVzaChuZXcgdGhpcy5tdXJlLlRPS0VOUy5LZXlzVG9rZW4odGhpcywgYXJnTGlzdCkpO1xuICAgICAgICB0b2tlbkxpc3QucHVzaChuZXcgdGhpcy5tdXJlLlRPS0VOUy5WYWx1ZVRva2VuKHRoaXMsIFtdKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMubXVyZS5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKSB7XG4gICAgICAgIHRva2VuTGlzdC5wdXNoKG5ldyB0aGlzLm11cmUuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSh0aGlzLCBhcmdMaXN0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gdG9rZW46ICR7dGVtcFsxXX1gKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdG9rZW5MaXN0O1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgaWYgKHRoaXMudHJhdmVyc2FsTW9kZSA9PT0gJ0JGUycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQnJlYWR0aC1maXJzdCBpdGVyYXRpb24gaXMgbm90IHlldCBpbXBsZW1lbnRlZC5gKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMudHJhdmVyc2FsTW9kZSA9PT0gJ0RGUycpIHtcbiAgICAgIGNvbnN0IGRlZXBIZWxwZXIgPSB0aGlzLmRlZXBIZWxwZXIodGhpcy50b2tlbkxpc3QsIHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEpO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiBkZWVwSGVscGVyKSB7XG4gICAgICAgIGlmICghKHdyYXBwZWRJdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKSkge1xuICAgICAgICAgIGlmICh0aGlzLm11cmUuZGVidWcpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybih3cmFwcGVkSXRlbSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0cmF2ZXJzYWxNb2RlOiAke3RoaXMudHJhdmVyc2FsTW9kZX1gKTtcbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIFRoaXMgaGVscHMgZGVwdGgtZmlyc3QgaXRlcmF0aW9uICh3ZSBvbmx5IHdhbnQgdG8geWllbGQgZmluaXNoZWQgcGF0aHMsIHNvXG4gICAqIGl0IGxhemlseSBhc2tzIGZvciB0aGVtIG9uZSBhdCBhIHRpbWUgZnJvbSB0aGUgKmZpbmFsKiB0b2tlbiwgcmVjdXJzaXZlbHlcbiAgICogYXNraW5nIGVhY2ggcHJlY2VkaW5nIHRva2VuIHRvIHlpZWxkIGRlcGVuZGVudCBwYXRocyBvbmx5IGFzIG5lZWRlZClcbiAgICovXG4gIGFzeW5jICogZGVlcEhlbHBlciAodG9rZW5MaXN0LCBpKSB7XG4gICAgaWYgKGkgPT09IDApIHtcbiAgICAgIHlpZWxkICogYXdhaXQgdG9rZW5MaXN0WzBdLm5hdmlnYXRlKCk7IC8vIFRoZSBmaXJzdCB0b2tlbiBpcyBhbHdheXMgdGhlIHJvb3RcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHBhcmVudFlpZWxkZWRTb21ldGhpbmcgPSBmYWxzZTtcbiAgICAgIGZvciBhd2FpdCAobGV0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5kZWVwSGVscGVyKHRva2VuTGlzdCwgaSAtIDEpKSB7XG4gICAgICAgIHBhcmVudFlpZWxkZWRTb21ldGhpbmcgPSB0cnVlO1xuICAgICAgICBpZiAod3JhcHBlZFBhcmVudCBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcikge1xuICAgICAgICAgIGNvbnN0IGl0ZXJhdG9yID0gYXdhaXQgdG9rZW5MaXN0W2ldLm5hdmlnYXRlKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICAgIHlpZWxkICogaXRlcmF0b3I7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZFBhcmVudDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubXVyZS5kZWJ1ZyAmJiAhcGFyZW50WWllbGRlZFNvbWV0aGluZykge1xuICAgICAgICB5aWVsZCBgVG9rZW4geWllbGRlZCBub3RoaW5nOiAke3Rva2VuTGlzdFtpIC0gMV19YDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyAqIHNhbXBsZSAoeyBsaW1pdCA9IDEwIH0pIHtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZSgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGV4dGVuZCAoVG9rZW5DbGFzcywgYXJnTGlzdCwgZnVuY3Rpb25zID0ge30sIHN0cmVhbXMgPSB7fSkge1xuICAgIGNvbnN0IG5ld1N0cmVhbSA9IG5ldyBTdHJlYW0oe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgZnVuY3Rpb25zOiBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmZ1bmN0aW9ucywgZnVuY3Rpb25zKSxcbiAgICAgIHN0cmVhbXM6IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuc3RyZWFtcywgc3RyZWFtcyksXG4gICAgICBtb2RlOiB0aGlzLm1vZGVcbiAgICB9KTtcbiAgICBuZXdTdHJlYW0udG9rZW5MaXN0ID0gdGhpcy50b2tlbkxpc3QuY29uY2F0KFsgbmV3IFRva2VuQ2xhc3MobmV3U3RyZWFtLCBhcmdMaXN0KSBdKTtcbiAgICByZXR1cm4gbmV3U3RyZWFtO1xuICB9XG5cbiAgaXNTdXBlclNldE9mVG9rZW5MaXN0ICh0b2tlbkxpc3QpIHtcbiAgICBpZiAodG9rZW5MaXN0Lmxlbmd0aCAhPT0gdGhpcy50b2tlbkxpc3QubGVuZ3RoKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5ldmVyeSgodG9rZW4sIGkpID0+IHRva2VuLmlzU3VwZXJTZXRPZih0b2tlbkxpc3RbaV0pKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RyZWFtO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEJhc2VUb2tlbiBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zdHJlYW0gPSBzdHJlYW07XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIC8vIFRoZSBzdHJpbmcgdmVyc2lvbiBvZiBtb3N0IHRva2VucyBjYW4ganVzdCBiZSBkZXJpdmVkIGZyb20gdGhlIGNsYXNzIHR5cGVcbiAgICByZXR1cm4gYC4ke3RoaXMudHlwZS50b0xvd2VyQ2FzZSgpfSgpYDtcbiAgfVxuICBpc1N1cGVyU2V0T2YgKG90aGVyVG9rZW4pIHtcbiAgICByZXR1cm4gb3RoZXJUb2tlbi5jb25zdHJ1Y3RvciA9PT0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXNlVG9rZW4sICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRva2VuLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQmFzZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFJvb3RUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gICogbmF2aWdhdGUgKCkge1xuICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICB3cmFwcGVkUGFyZW50OiBudWxsLFxuICAgICAgdG9rZW46IHRoaXMsXG4gICAgICByYXdJdGVtOiB0aGlzLnN0cmVhbS5tdXJlLnJvb3RcbiAgICB9KTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGByb290YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUm9vdFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEtleXNUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIGFyZ0xpc3QsIHsgbWF0Y2hBbGwsIGtleXMsIHJhbmdlcyB9ID0ge30pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmIChrZXlzIHx8IHJhbmdlcykge1xuICAgICAgdGhpcy5rZXlzID0ga2V5cztcbiAgICAgIHRoaXMucmFuZ2VzID0gcmFuZ2VzO1xuICAgIH0gZWxzZSBpZiAoKGFyZ0xpc3QgJiYgYXJnTGlzdC5sZW5ndGggPT09IDEgJiYgYXJnTGlzdFswXSA9PT0gdW5kZWZpbmVkKSB8fCBtYXRjaEFsbCkge1xuICAgICAgdGhpcy5tYXRjaEFsbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFyZ0xpc3QuZm9yRWFjaChhcmcgPT4ge1xuICAgICAgICBsZXQgdGVtcCA9IGFyZy5tYXRjaCgvKFxcZCspLShbXFxk4oieXSspLyk7XG4gICAgICAgIGlmICh0ZW1wICYmIHRlbXBbMl0gPT09ICfiiJ4nKSB7XG4gICAgICAgICAgdGVtcFsyXSA9IEluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSB0ZW1wID8gdGVtcC5tYXAoZCA9PiBkLnBhcnNlSW50KGQpKSA6IG51bGw7XG4gICAgICAgIGlmICh0ZW1wICYmICFpc05hTih0ZW1wWzFdKSAmJiAhaXNOYU4odGVtcFsyXSkpIHtcbiAgICAgICAgICBmb3IgKGxldCBpID0gdGVtcFsxXTsgaSA8PSB0ZW1wWzJdOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5yYW5nZXMgfHwgW107XG4gICAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiB0ZW1wWzFdLCBoaWdoOiB0ZW1wWzJdIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IGFyZy5tYXRjaCgvJyguKiknLyk7XG4gICAgICAgIHRlbXAgPSB0ZW1wICYmIHRlbXBbMV0gPyB0ZW1wWzFdIDogYXJnO1xuICAgICAgICBsZXQgbnVtID0gTnVtYmVyKHRlbXApO1xuICAgICAgICBpZiAoaXNOYU4obnVtKSB8fCBudW0gIT09IHBhcnNlSW50KHRlbXApKSB7IC8vIGxlYXZlIG5vbi1pbnRlZ2VyIG51bWJlcnMgYXMgc3RyaW5nc1xuICAgICAgICAgIHRoaXMua2V5cyA9IHRoaXMua2V5cyB8fCB7fTtcbiAgICAgICAgICB0aGlzLmtleXNbdGVtcF0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5yYW5nZXMgfHwgW107XG4gICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogbnVtLCBoaWdoOiBudW0gfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKCF0aGlzLmtleXMgJiYgIXRoaXMucmFuZ2VzKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgQmFkIHRva2VuIGtleShzKSAvIHJhbmdlKHMpOiAke0pTT04uc3RyaW5naWZ5KGFyZ0xpc3QpfWApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5jb25zb2xpZGF0ZVJhbmdlcyh0aGlzLnJhbmdlcyk7XG4gICAgfVxuICB9XG4gIGdldCBzZWxlY3RzTm90aGluZyAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1hdGNoQWxsICYmICF0aGlzLmtleXMgJiYgIXRoaXMucmFuZ2VzO1xuICB9XG4gIGNvbnNvbGlkYXRlUmFuZ2VzIChyYW5nZXMpIHtcbiAgICAvLyBNZXJnZSBhbnkgb3ZlcmxhcHBpbmcgcmFuZ2VzXG4gICAgY29uc3QgbmV3UmFuZ2VzID0gW107XG4gICAgY29uc3QgdGVtcCA9IHJhbmdlcy5zb3J0KChhLCBiKSA9PiBhLmxvdyAtIGIubG93KTtcbiAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRlbXAubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICghY3VycmVudFJhbmdlKSB7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9IGVsc2UgaWYgKHRlbXBbaV0ubG93IDw9IGN1cnJlbnRSYW5nZS5oaWdoKSB7XG4gICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gdGVtcFtpXS5oaWdoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGN1cnJlbnRSYW5nZSkge1xuICAgICAgLy8gQ29ybmVyIGNhc2U6IGFkZCB0aGUgbGFzdCByYW5nZVxuICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld1Jhbmdlcy5sZW5ndGggPiAwID8gbmV3UmFuZ2VzIDogdW5kZWZpbmVkO1xuICB9XG4gIGRpZmZlcmVuY2UgKG90aGVyVG9rZW4pIHtcbiAgICAvLyBDb21wdXRlIHdoYXQgaXMgbGVmdCBvZiB0aGlzIGFmdGVyIHN1YnRyYWN0aW5nIG91dCBldmVyeXRoaW5nIGluIG90aGVyVG9rZW5cbiAgICBpZiAoIShvdGhlclRva2VuIGluc3RhbmNlb2YgS2V5c1Rva2VuKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBjb21wdXRlIHRoZSBkaWZmZXJlbmNlIG9mIHR3byBkaWZmZXJlbnQgdG9rZW4gdHlwZXNgKTtcbiAgICB9IGVsc2UgaWYgKG90aGVyVG9rZW4ubWF0Y2hBbGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAodGhpcy5tYXRjaEFsbCkge1xuICAgICAgY29uc29sZS53YXJuKGBJbmFjY3VyYXRlIGRpZmZlcmVuY2UgY29tcHV0ZWQhIFRPRE86IG5lZWQgdG8gZmlndXJlIG91dCBob3cgdG8gaW52ZXJ0IGNhdGVnb3JpY2FsIGtleXMhYCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmV3S2V5cyA9IHt9O1xuICAgICAgZm9yIChsZXQga2V5IGluICh0aGlzLmtleXMgfHwge30pKSB7XG4gICAgICAgIGlmICghb3RoZXJUb2tlbi5rZXlzIHx8ICFvdGhlclRva2VuLmtleXNba2V5XSkge1xuICAgICAgICAgIG5ld0tleXNba2V5XSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdSYW5nZXMgPSBbXTtcbiAgICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgICBpZiAob3RoZXJUb2tlbi5yYW5nZXMpIHtcbiAgICAgICAgICBsZXQgYWxsUG9pbnRzID0gdGhpcy5yYW5nZXMucmVkdWNlKChhZ2csIHJhbmdlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYWdnLmNvbmNhdChbXG4gICAgICAgICAgICAgIHsgaW5jbHVkZTogdHJ1ZSwgbG93OiB0cnVlLCB2YWx1ZTogcmFuZ2UubG93IH0sXG4gICAgICAgICAgICAgIHsgaW5jbHVkZTogdHJ1ZSwgaGlnaDogdHJ1ZSwgdmFsdWU6IHJhbmdlLmhpZ2ggfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgfSwgW10pO1xuICAgICAgICAgIGFsbFBvaW50cyA9IGFsbFBvaW50cy5jb25jYXQob3RoZXJUb2tlbi5yYW5nZXMucmVkdWNlKChhZ2csIHJhbmdlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYWdnLmNvbmNhdChbXG4gICAgICAgICAgICAgIHsgZXhjbHVkZTogdHJ1ZSwgbG93OiB0cnVlLCB2YWx1ZTogcmFuZ2UubG93IH0sXG4gICAgICAgICAgICAgIHsgZXhjbHVkZTogdHJ1ZSwgaGlnaDogdHJ1ZSwgdmFsdWU6IHJhbmdlLmhpZ2ggfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgfSwgW10pKS5zb3J0KCk7XG4gICAgICAgICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxQb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSB7IGxvdzogYWxsUG9pbnRzW2ldLnZhbHVlIH07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmhpZ2gpIHtcbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0udmFsdWU7XG4gICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uZXhjbHVkZSkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLmxvdyAtIDE7XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmhpZ2gpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UubG93ID0gYWxsUG9pbnRzW2ldLmhpZ2ggKyAxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5ld1JhbmdlcyA9IHRoaXMucmFuZ2VzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IEtleXNUb2tlbih0aGlzLm11cmUsIG51bGwsIHsga2V5czogbmV3S2V5cywgcmFuZ2VzOiBuZXdSYW5nZXMgfSk7XG4gICAgfVxuICB9XG4gIGlzU3VwZXJTZXRPZiAob3RoZXJUb2tlbikge1xuICAgIGlmICghKG90aGVyVG9rZW4gaW5zdGFuY2VvZiBLZXlzVG9rZW4pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGRpZmYgPSBvdGhlclRva2VuLmRpZmZlcmVuY2UodGhpcyk7XG4gICAgICByZXR1cm4gZGlmZiA9PT0gbnVsbCB8fCBkaWZmLnNlbGVjdHNOb3RoaW5nO1xuICAgIH1cbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHsgcmV0dXJuICcua2V5cygpJzsgfVxuICAgIHJldHVybiAnLmtleXMoJyArICh0aGlzLnJhbmdlcyB8fCBbXSkubWFwKCh7bG93LCBoaWdofSkgPT4ge1xuICAgICAgcmV0dXJuIGxvdyA9PT0gaGlnaCA/IGxvdyA6IGAke2xvd30tJHtoaWdofWA7XG4gICAgfSkuY29uY2F0KE9iamVjdC5rZXlzKHRoaXMua2V5cyB8fCB7fSkubWFwKGtleSA9PiBgJyR7a2V5fSdgKSlcbiAgICAgIC5qb2luKCcsJykgKyAnKSc7XG4gIH1cbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGlmICh0eXBlb2Ygd3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEtleXNUb2tlbiBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBmb3IgKGxldCBrZXkgaW4gd3JhcHBlZFBhcmVudC5yYXdJdGVtKSB7XG4gICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAobGV0IHtsb3csIGhpZ2h9IG9mIHRoaXMucmFuZ2VzIHx8IFtdKSB7XG4gICAgICAgIGxvdyA9IE1hdGgubWF4KDAsIGxvdyk7XG4gICAgICAgIGhpZ2ggPSBNYXRoLm1pbih3cmFwcGVkUGFyZW50LnJhd0l0ZW0ubGVuZ3RoIC0gMSwgaGlnaCk7XG4gICAgICAgIGZvciAobGV0IGkgPSBsb3c7IGkgPD0gaGlnaDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgcmF3SXRlbTogaVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKGxldCBrZXkgaW4gdGhpcy5rZXlzIHx8IHt9KSB7XG4gICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW0uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgS2V5c1Rva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFZhbHVlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgY29uc3Qgb2JqID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgY29uc3Qga2V5ID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgY29uc3Qga2V5VHlwZSA9IHR5cGVvZiBrZXk7XG4gICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IChrZXlUeXBlICE9PSAnc3RyaW5nJyAmJiBrZXlUeXBlICE9PSAnbnVtYmVyJykpIHtcbiAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBWYWx1ZVRva2VuIHVzZWQgb24gYSBub24tb2JqZWN0LCBvciB3aXRob3V0IGEgc3RyaW5nIC8gbnVtZXJpYyBrZXlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBFdmFsdWF0ZVRva2VuIGlzIG5vdCBhIHN0cmluZ2ApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBsZXQgbmV3U3RyZWFtO1xuICAgIHRyeSB7XG4gICAgICBuZXdTdHJlYW0gPSB0aGlzLnN0cmVhbS5tdXJlLnN0cmVhbSh7XG4gICAgICAgIHNlbGVjdG9yOiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0sXG4gICAgICAgIGZ1bmN0aW9uczogdGhpcy5zdHJlYW0uZnVuY3Rpb25zLFxuICAgICAgICBzdHJlYW1zOiB0aGlzLnN0cmVhbS5zdHJlYW1zLFxuICAgICAgICB0cmF2ZXJzYWxNb2RlOiB0aGlzLnN0cmVhbS50cmF2ZXJzYWxNb2RlXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1ZyB8fCAhKGVyciBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSkge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGl0ZXJhdG9yID0gYXdhaXQgbmV3U3RyZWFtLml0ZXJhdGUoKTtcbiAgICB5aWVsZCAqIGl0ZXJhdG9yO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFdmFsdWF0ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIE1hcFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBnZW5lcmF0b3IgPSAnaWRlbnRpdHknIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmICghc3RyZWFtLmZ1bmN0aW9uc1tnZW5lcmF0b3JdKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gZnVuY3Rpb246ICR7Z2VuZXJhdG9yfWApO1xuICAgIH1cbiAgICB0aGlzLmdlbmVyYXRvciA9IGdlbmVyYXRvcjtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAubWFwKCR7dGhpcy5nZW5lcmF0b3J9KWA7XG4gIH1cbiAgaXNTdXBlclNldE9mIChvdGhlclRva2VuKSB7XG4gICAgcmV0dXJuIG90aGVyVG9rZW4uY29uc3RydWN0b3IgPT09IE1hcFRva2VuICYmIG90aGVyVG9rZW4uZ2VuZXJhdG9yID09PSB0aGlzLmdlbmVyYXRvcjtcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIHRoaXMuc3RyZWFtLmZ1bmN0aW9uc1t0aGlzLmdlbmVyYXRvcl0od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFwVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUHJvbW90ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgbWFwLCBoYXNoLCByZWR1Y2VJbnN0YW5jZXMgXSkge1xuICAgICAgaWYgKCFzdHJlYW0uZnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICB0aGlzLmhhc2ggPSBoYXNoO1xuICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID0gcmVkdWNlSW5zdGFuY2VzO1xuXG4gICAgdGhpcy5zZWVuSXRlbXMgPSB7fTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAucHJvbW90ZSgke3RoaXMubWFwfSwgJHt0aGlzLmhhc2h9LCAke3RoaXMucmVkdWNlSW5zdGFuY2VzfSlgO1xuICB9XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgdGhpcy5zdHJlYW0uZnVuY3Rpb25zW3RoaXMubWFwXSh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgY29uc3QgaGFzaCA9IHRoaXMuc3RyZWFtLmZ1bmN0aW9uc1t0aGlzLmhhc2hdKG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgaWYgKHRoaXMuc2Vlbkl0ZW1zW2hhc2hdKSB7XG4gICAgICAgIGlmICh0aGlzLnJlZHVjZUluc3RhbmNlcyAhPT0gJ25vb3AnKSB7XG4gICAgICAgICAgdGhpcy5zdHJlYW0uZnVuY3Rpb25zW3RoaXMucmVkdWNlSW5zdGFuY2VzXSh0aGlzLnNlZW5JdGVtc1toYXNoXSwgbWFwcGVkUmF3SXRlbSk7XG4gICAgICAgICAgdGhpcy5zZWVuSXRlbXNbaGFzaF0udHJpZ2dlcigndXBkYXRlJyk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2Vlbkl0ZW1zW2hhc2hdID0gdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW1cbiAgICAgICAgfSk7XG4gICAgICAgIHlpZWxkIHRoaXMuc2Vlbkl0ZW1zW2hhc2hdO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlVG9rZW47XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY0NvbnN0cnVjdCBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgc2VsZWN0b3IsIGNsYXNzTmFtZXMgPSBbXSB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm11cmUgPSBtdXJlO1xuICAgIHRoaXMuc2VsZWN0b3IgPSBzZWxlY3RvcjtcbiAgICB0aGlzLnN0cmVhbSA9IHRoaXMubXVyZS5zdHJlYW0oeyBzZWxlY3Rvcjogc2VsZWN0b3IgfSk7XG4gICAgdGhpcy5jbGFzc05hbWVzID0gY2xhc3NOYW1lcztcbiAgICB0aGlzLmFubm90YXRpb25zID0gW107XG4gIH1cbiAgd3JhcCAob3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NvbnN0cnVjdCwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ29uc3RydWN0Ly5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NvbnN0cnVjdDtcbiIsImltcG9ydCBHZW5lcmljQ29uc3RydWN0IGZyb20gJy4vR2VuZXJpY0NvbnN0cnVjdC5qcyc7XG5cbmNsYXNzIE5vZGVDb25zdHJ1Y3QgZXh0ZW5kcyBHZW5lcmljQ29uc3RydWN0IHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ29uc3RydWN0O1xuIiwiaW1wb3J0IEdlbmVyaWNDb25zdHJ1Y3QgZnJvbSAnLi9HZW5lcmljQ29uc3RydWN0LmpzJztcblxuY2xhc3MgRWRnZUNvbnN0cnVjdCBleHRlbmRzIEdlbmVyaWNDb25zdHJ1Y3Qge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDb25zdHJ1Y3Q7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMud3JhcHBlZFBhcmVudCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMucmF3SXRlbSA9IHJhd0l0ZW07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4vU3RyZWFtLmpzJztcbmltcG9ydCAqIGFzIFRPS0VOUyBmcm9tICcuL1Rva2Vucy9Ub2tlbnMuanMnO1xuaW1wb3J0ICogYXMgQ09OU1RSVUNUUyBmcm9tICcuL0NvbnN0cnVjdHMvQ29uc3RydWN0cy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMucm9vdCA9IHt9O1xuICAgIHRoaXMuY2xhc3NlcyA9IHt9O1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgdGhpcy5UUlVUSFlfU1RSSU5HUyA9IHtcbiAgICAgICd0cnVlJzogdHJ1ZSxcbiAgICAgICd5ZXMnOiB0cnVlLFxuICAgICAgJ3knOiB0cnVlXG4gICAgfTtcbiAgICB0aGlzLkZBTFNFWV9TVFJJTkdTID0ge1xuICAgICAgJ2ZhbHNlJzogdHJ1ZSxcbiAgICAgICdubyc6IHRydWUsXG4gICAgICAnbic6IHRydWVcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UT0tFTlMgPSBUT0tFTlM7XG4gICAgdGhpcy5DT05TVFJVQ1RTID0gQ09OU1RSVUNUUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG5cbiAgICAvLyBNb25rZXktcGF0Y2ggYXZhaWxhYmxlIHRva2VucyBhcyBmdW5jdGlvbnMgb250byB0aGUgU3RyZWFtIGNsYXNzXG4gICAgZm9yIChjb25zdCB0b2tlbkNsYXNzTmFtZSBpbiB0aGlzLlRPS0VOUykge1xuICAgICAgY29uc3QgVG9rZW5DbGFzcyA9IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXTtcbiAgICAgIFN0cmVhbS5wcm90b3R5cGVbVG9rZW5DbGFzcy5sb3dlckNhbWVsQ2FzZVR5cGVdID0gZnVuY3Rpb24gKGFyZ0xpc3QsIGZ1bmN0aW9ucywgc3RyZWFtcykge1xuICAgICAgICByZXR1cm4gdGhpcy5leHRlbmQoVG9rZW5DbGFzcywgYXJnTGlzdCwgZnVuY3Rpb25zLCBzdHJlYW1zKTtcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgc3RyZWFtIChvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG4gIHdyYXAgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIGNvbnN0IHRva2VuTGlzdCA9IFt0b2tlbl07XG4gICAgbGV0IHRlbXAgPSB3cmFwcGVkUGFyZW50O1xuICAgIHdoaWxlICh0ZW1wICE9PSBudWxsKSB7XG4gICAgICB0b2tlbkxpc3QudW5zaGlmdCh0ZW1wLnRva2VuKTtcbiAgICAgIHRlbXAgPSB0ZW1wLndyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGZvciAobGV0IGNsYXNzU2VsZWN0b3IgaW4gdGhpcy5jbGFzc2VzKSB7XG4gICAgICBjb25zdCBjb25zdHJ1Y3QgPSB0aGlzLmNsYXNzZXNbY2xhc3NTZWxlY3Rvcl07XG4gICAgICBpZiAoY29uc3RydWN0LnN0cmVhbS5pc1N1cGVyU2V0T2ZUb2tlbkxpc3QodG9rZW5MaXN0KSkge1xuICAgICAgICByZXR1cm4gY29uc3RydWN0LndyYXAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyB0aGlzLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gIH1cblxuICBuZXdDbGFzcyAoeyBDbGFzc1R5cGUsIHNlbGVjdG9yLCBjbGFzc05hbWVzIH0pIHtcbiAgICBpZiAodGhpcy5jbGFzc2VzW3NlbGVjdG9yXSkge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tzZWxlY3Rvcl07XG4gICAgfVxuICAgIHRoaXMuY2xhc3Nlc1tzZWxlY3Rvcl0gPSBuZXcgQ2xhc3NUeXBlKHsgbXVyZTogdGhpcywgc2VsZWN0b3IsIGNsYXNzTmFtZXMgfSk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tzZWxlY3Rvcl07XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNEYXRhU291cmNlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlKHtcbiAgICAgIGtleTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFzeW5jIGFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGtleSxcbiAgICBleHRlbnNpb24gPSAndHh0JyxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICBsZXQgb2JqO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBvYmogPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGRlbGV0ZSBvYmouY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNEYXRhU291cmNlKGtleSwgb2JqKTtcbiAgfVxuICBhc3luYyBhZGRTdGF0aWNEYXRhU291cmNlIChrZXksIG9iaikge1xuICAgIHRoaXMucm9vdFtrZXldID0gb2JqO1xuICAgIHJldHVybiB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHNlbGVjdG9yOiBgcm9vdC52YWx1ZXMoJyR7a2V5fScpLnZhbHVlcygpYCxcbiAgICAgIENsYXNzVHlwZTogdGhpcy5DT05TVFJVQ1RTLkdlbmVyaWNDb25zdHJ1Y3QsXG4gICAgICBjbGFzc05hbWVzOiBbIGtleSBdXG4gICAgfSk7XG4gIH1cblxuICByZW1vdmVEYXRhU291cmNlIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5yb290W2tleV07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXVyZTtcbiIsImltcG9ydCBNdXJlIGZyb20gJy4vTXVyZS5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5pbXBvcnQgRmlsZVJlYWRlciBmcm9tICdmaWxlcmVhZGVyJztcblxubGV0IG11cmUgPSBuZXcgTXVyZShGaWxlUmVhZGVyKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycyIsImluZGV4T2YiLCJwdXNoIiwiaW5kZXgiLCJzcGxpY2UiLCJhcmdzIiwiZm9yRWFjaCIsImFwcGx5IiwiYXJnT2JqIiwiZGVsYXkiLCJhc3NpZ24iLCJ0aW1lb3V0Iiwic2V0VGltZW91dCIsInRyaWdnZXIiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwiaSIsIkRFRkFVTFRfRlVOQ1RJT05TIiwid3JhcHBlZFBhcmVudCIsInJhd0l0ZW0iLCJzaGExIiwiSlNPTiIsInN0cmluZ2lmeSIsIlN0cmVhbSIsIm11cmUiLCJmdW5jdGlvbnMiLCJzdHJlYW1zIiwidHJhdmVyc2FsTW9kZSIsInRva2VuTGlzdCIsInBhcnNlU2VsZWN0b3IiLCJzZWxlY3RvciIsImpvaW4iLCJzZWxlY3RvclN0cmluZyIsInN0YXJ0c1dpdGgiLCJTeW50YXhFcnJvciIsInRva2VuU3RyaW5ncyIsIm1hdGNoIiwiVE9LRU5TIiwiUm9vdFRva2VuIiwiY2h1bmsiLCJ0ZW1wIiwidG9rZW5DbGFzc05hbWUiLCJ0b1VwcGVyQ2FzZSIsInNsaWNlIiwiYXJnTGlzdCIsInNwbGl0IiwibWFwIiwiZCIsInRyaW0iLCJ1bmRlZmluZWQiLCJLZXlzVG9rZW4iLCJWYWx1ZVRva2VuIiwiRXJyb3IiLCJkZWVwSGVscGVyIiwibGVuZ3RoIiwid3JhcHBlZEl0ZW0iLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwiZGVidWciLCJ3YXJuIiwibmF2aWdhdGUiLCJwYXJlbnRZaWVsZGVkU29tZXRoaW5nIiwiaXRlcmF0b3IiLCJsaW1pdCIsIml0ZXJhdGUiLCJuZXh0IiwiZG9uZSIsInZhbHVlIiwiVG9rZW5DbGFzcyIsIm5ld1N0cmVhbSIsIm1vZGUiLCJjb25jYXQiLCJldmVyeSIsInRva2VuIiwiaXNTdXBlclNldE9mIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwiY29uc3RydWN0b3IiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkJhc2VUb2tlbiIsInN0cmVhbSIsInRvTG93ZXJDYXNlIiwib3RoZXJUb2tlbiIsImV4ZWMiLCJuYW1lIiwid3JhcCIsInJvb3QiLCJtYXRjaEFsbCIsImtleXMiLCJyYW5nZXMiLCJhcmciLCJJbmZpbml0eSIsInBhcnNlSW50IiwiaXNOYU4iLCJsb3ciLCJoaWdoIiwibnVtIiwiTnVtYmVyIiwiY29uc29saWRhdGVSYW5nZXMiLCJzZWxlY3RzTm90aGluZyIsIm5ld1JhbmdlcyIsInNvcnQiLCJhIiwiYiIsImN1cnJlbnRSYW5nZSIsIm5ld0tleXMiLCJrZXkiLCJhbGxQb2ludHMiLCJyZWR1Y2UiLCJhZ2ciLCJyYW5nZSIsImluY2x1ZGUiLCJleGNsdWRlIiwiZGlmZiIsImRpZmZlcmVuY2UiLCJUeXBlRXJyb3IiLCJNYXRoIiwibWF4IiwibWluIiwiaGFzT3duUHJvcGVydHkiLCJvYmoiLCJrZXlUeXBlIiwiRXZhbHVhdGVUb2tlbiIsImVyciIsIk1hcFRva2VuIiwiZ2VuZXJhdG9yIiwibWFwcGVkUmF3SXRlbSIsIlByb21vdGVUb2tlbiIsImhhc2giLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwic2Vlbkl0ZW1zIiwiR2VuZXJpY0NvbnN0cnVjdCIsImNsYXNzTmFtZXMiLCJhbm5vdGF0aW9ucyIsIm9wdGlvbnMiLCJOb2RlQ29uc3RydWN0IiwiRWRnZUNvbnN0cnVjdCIsIk5vZGVXcmFwcGVyIiwiRWRnZVdyYXBwZXIiLCJNdXJlIiwiRmlsZVJlYWRlciIsIm1pbWUiLCJjbGFzc2VzIiwiREFUQUxJQl9GT1JNQVRTIiwiVFJVVEhZX1NUUklOR1MiLCJGQUxTRVlfU1RSSU5HUyIsIkNPTlNUUlVDVFMiLCJwcm90b3R5cGUiLCJleHRlbmQiLCJ1bnNoaWZ0IiwiY2xhc3NTZWxlY3RvciIsImNvbnN0cnVjdCIsImlzU3VwZXJTZXRPZlRva2VuTGlzdCIsIkNsYXNzVHlwZSIsImNoYXJzZXQiLCJmaWxlT2JqIiwiZmlsZU1CIiwic2l6ZSIsInNraXBTaXplQ2hlY2siLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZXN1bHQiLCJyZWFkQXNUZXh0IiwiZW5jb2RpbmciLCJhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UiLCJleHRlbnNpb25PdmVycmlkZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY0RhdGFTb3VyY2UiLCJuZXdDbGFzcyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE1BQU1BLG1CQUFtQixVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7a0JBQ2Y7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGFBQUwsR0FBcUIsRUFBckI7V0FDS0MsY0FBTCxHQUFzQixFQUF0Qjs7T0FFRUMsU0FBSixFQUFlQyxRQUFmLEVBQXlCQyx1QkFBekIsRUFBa0Q7VUFDNUMsQ0FBQyxLQUFLSixhQUFMLENBQW1CRSxTQUFuQixDQUFMLEVBQW9DO2FBQzdCRixhQUFMLENBQW1CRSxTQUFuQixJQUFnQyxFQUFo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
