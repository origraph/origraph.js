'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var sha1 = _interopDefault(require('sha1'));
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

class Stream {
  constructor({
    mure,
    tokenClassList,
    namedFunctions = {},
    traversalMode = 'DFS',
    launchedFromClass = null
  }) {
    this.mure = mure;
    this.namedFunctions = namedFunctions;
    this.traversalMode = traversalMode;
    this.tokenList = tokenClassList.map(({ TokenClass, argList }) => {
      return new TokenClass(this, argList);
    });
    this.launchedFromClass = launchedFromClass;
    this.Wrappers = this.getWrapperList();
  }

  getWrapperList() {
    // Look up which, if any, classes describe the result of each token, so that
    // we can wrap items appropriately:
    return this.tokenList.map((token, index) => {
      if (index === this.tokenList.length - 1 && this.launchedFromClass) {
        // If this stream was started from a class, we already know we should
        // use that class's wrapper for the last token
        return this.launchedFromClass.Wrapper;
      }
      // Find a class that describes exactly each series of tokens
      const localTokenList = this.tokenList.slice(0, index + 1);
      const potentialWrappers = Object.values(this.mure.classes).filter(classObj => {
        if (!classObj.tokenClassList.length !== localTokenList.length) {
          return false;
        }
        return localTokenList.every((localToken, localIndex) => {
          const tokenClassSpec = classObj.tokenClassList[localIndex];
          return localToken instanceof tokenClassSpec.TokenClass && token.isSubsetOf(tokenClassSpec.argList);
        });
      });
      if (potentialWrappers.length === 0) {
        // No classes describe this series of tokens, so use the generic wrapper
        return this.mure.WRAPPERS.GenericWrapper;
      } else {
        if (potentialWrappers.length > 1) {
          console.warn(`Multiple classes describe the same item! Arbitrarily choosing one...`);
        }
        return potentialWrappers[0].Wrapper;
      }
    });
  }

  get selector() {
    return this.tokenList.join('');
  }

  fork(selector) {
    return new Stream({
      mure: this.mure,
      namedFunctions: this.namedFunctions,
      traversalMode: this.traversalMode,
      tokenClassList: this.mure.parseSelector(selector),
      launchedFromClass: this.launchedFromClass
    });
  }

  extend(TokenClass, argList, options = {}) {
    options.mure = this.mure;
    options.namedFunctions = Object.assign({}, this.namedFunctions, options.namedFunctions || {});
    options.tokenClassList = this.tokenClassList.concat({ TokenClass, argList });
    options.launchedFromClass = options.launchedFromClass || this.launchedFromClass;
    options.traversalMode = options.traversalMode || this.traversalMode;
    return new Stream(options);
  }

  wrap({ wrappedParent, token, rawItem }) {
    let wrapperIndex = 0;
    let temp = wrappedParent;
    while (temp !== null) {
      wrapperIndex += 1;
      temp = temp.wrappedParent;
    }
    return new this.Wrappers[wrapperIndex]({ wrappedParent, token, rawItem });
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
  isSubSetOf() {
    // By default (without any arguments), tokens of the same class are subsets
    // of each other
    return true;
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
    yield this.stream.wrap({
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
  isSubSetOf(argList) {
    const otherToken = new KeysToken(this.stream, argList);
    const diff = otherToken.difference(this);
    return diff === null || diff.selectsNothing;
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
          yield _this.stream.wrap({
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
              yield _this.stream.wrap({
                wrappedParent,
                token: _this,
                rawItem: i
              });
            }
          }
        }
        for (let key in _this.keys || {}) {
          if (wrappedParent.rawItem.hasOwnProperty(key)) {
            yield _this.stream.wrap({
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
      yield _this.stream.wrap({
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
        newStream = _this.stream.fork(wrappedParent.rawItem);
      } catch (err) {
        if (!_this.stream.mure.debug || !(err instanceof SyntaxError)) {
          throw err;
        } else {
          return;
        }
      }
      yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(newStream.iterate()))), asyncGenerator.await);
    })();
  }
}

class MapToken extends BaseToken {
  constructor(stream, [generator = 'identity']) {
    super(stream);
    if (!stream.namedFunctions[generator]) {
      throw new SyntaxError(`Unknown named function: ${generator}`);
    }
    this.generator = generator;
  }
  toString() {
    return `.map(${this.generator})`;
  }
  isSubSetOf([generator = 'identity']) {
    return generator === this.generator;
  }
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.stream.namedFunctions[_this.generator](wrappedParent)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const mappedRawItem = _value;

          yield _this.stream.wrap({
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
      if (!stream.namedFunctions[func]) {
        throw new SyntaxError(`Unknown named function: ${func}`);
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
  isSubSetOf([map = 'identity', hash = 'sha1', reduceInstances = 'noop']) {
    return this.map === map && this.hash === hash && this.reduceInstances === 'noop';
  }
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.stream.namedFunctions[_this.map](wrappedParent)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const mappedRawItem = _value;

          const hash = _this.stream.namedFunctions[_this.hash](mappedRawItem);
          if (_this.seenItems[hash]) {
            if (_this.reduceInstances !== 'noop') {
              _this.stream.namedFunctions[_this.reduceInstances](_this.seenItems[hash], mappedRawItem);
              _this.seenItems[hash].trigger('update');
            }
          } else {
            _this.seenItems[hash] = _this.stream.wrap({
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

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this.mure = options.mure;
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.tokenClassList = this.mure.parseSelector(options.selector || `root.values()`);
  }
  wrap(options) {
    return new this.mure.WRAPPERS.GenericWrapper(options);
  }
  getStream() {
    return new Stream({
      mure: this.mure,
      tokenClassList: this.tokenClassList,
      namedFunctions: this.namedFunctions,
      launchedFromClass: this
    });
  }
  isSuperSetOfTokenList(tokenList) {
    if (tokenList.length !== this.tokenList.length) {
      return false;
    }
    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }
}
Object.defineProperty(GenericClass, 'type', {
  get() {
    return (/(.*)Class/.exec(this.name)[1]
    );
  }
});

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.NodeWrapper;
  }
}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.EdgeWrapper;
  }
}



var CLASSES = /*#__PURE__*/Object.freeze({
  GenericClass: GenericClass,
  NodeClass: NodeClass,
  EdgeClass: EdgeClass
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
    this.CLASSES = CLASSES;
    this.WRAPPERS = WRAPPERS;

    // Monkey-patch available tokens as functions onto the Stream class
    for (const tokenClassName in this.TOKENS) {
      const TokenClass = this.TOKENS[tokenClassName];
      Stream.prototype[TokenClass.lowerCamelCaseType] = function (argList, options) {
        return this.extend(TokenClass, argList, options);
      };
    }

    // Default named functions
    this.NAMED_FUNCTIONS = {
      identity: function* (wrappedParent) {
        yield wrappedParent.rawItem;
      },
      key: function* (wrappedParent) {
        yield wrappedParent.wrappedParent.rawItem;
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    };
  }

  parseSelector(selectorString) {
    if (!selectorString.startsWith('root')) {
      throw new SyntaxError(`Selectors must start with 'root'`);
    }
    const tokenStrings = selectorString.match(/\.([^(]*)\(([^)]*)\)/g);
    if (!tokenStrings) {
      throw new SyntaxError(`Invalid selector string: ${selectorString}`);
    }
    const tokenClassList = [{
      TokenClass: this.TOKENS.RootToken
    }];
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
        tokenClassList.push({
          TokenClass: this.TOKENS.KeysToken,
          argList
        });
        tokenClassList.push({
          TokenClass: this.TOKENS.ValueToken
        });
      } else if (this.TOKENS[tokenClassName]) {
        tokenClassList.push({
          TokenClass: this.TOKENS[tokenClassName],
          argList
        });
      } else {
        throw new SyntaxError(`Unknown token: ${temp[1]}`);
      }
    });
    return tokenClassList;
  }

  stream(options) {
    return new Stream({
      mure: this,
      namedFunctions: Object.assign({}, this.NAMED_FUNCTIONS, options.namedFunctions || {}),
      tokenClassList: this.parseSelector(options.selector || `root.values()`)
    });
  }

  newClass(options = { selector: `root.values()` }) {
    if (this.classes[options.selector]) {
      return this.classes[options.selector];
    }
    const ClassType = options.ClassType || this.CLASSES.GenericClass;
    delete options.ClassType;
    options.mure = this;
    this.classes[options.selector] = new ClassType(options);
    return this.classes[options.selector];
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
        selector: `root.values('${key}').values()`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBTdHJlYW0ge1xuICBjb25zdHJ1Y3RvciAoe1xuICAgIG11cmUsXG4gICAgdG9rZW5DbGFzc0xpc3QsXG4gICAgbmFtZWRGdW5jdGlvbnMgPSB7fSxcbiAgICB0cmF2ZXJzYWxNb2RlID0gJ0RGUycsXG4gICAgbGF1bmNoZWRGcm9tQ2xhc3MgPSBudWxsXG4gIH0pIHtcbiAgICB0aGlzLm11cmUgPSBtdXJlO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBuYW1lZEZ1bmN0aW9ucztcbiAgICB0aGlzLnRyYXZlcnNhbE1vZGUgPSB0cmF2ZXJzYWxNb2RlO1xuICAgIHRoaXMudG9rZW5MaXN0ID0gdG9rZW5DbGFzc0xpc3QubWFwKCh7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBUb2tlbkNsYXNzKHRoaXMsIGFyZ0xpc3QpO1xuICAgIH0pO1xuICAgIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MgPSBsYXVuY2hlZEZyb21DbGFzcztcbiAgICB0aGlzLldyYXBwZXJzID0gdGhpcy5nZXRXcmFwcGVyTGlzdCgpO1xuICB9XG5cbiAgZ2V0V3JhcHBlckxpc3QgKCkge1xuICAgIC8vIExvb2sgdXAgd2hpY2gsIGlmIGFueSwgY2xhc3NlcyBkZXNjcmliZSB0aGUgcmVzdWx0IG9mIGVhY2ggdG9rZW4sIHNvIHRoYXRcbiAgICAvLyB3ZSBjYW4gd3JhcCBpdGVtcyBhcHByb3ByaWF0ZWx5OlxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5tYXAoKHRva2VuLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKGluZGV4ID09PSB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxICYmIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MpIHtcbiAgICAgICAgLy8gSWYgdGhpcyBzdHJlYW0gd2FzIHN0YXJ0ZWQgZnJvbSBhIGNsYXNzLCB3ZSBhbHJlYWR5IGtub3cgd2Ugc2hvdWxkXG4gICAgICAgIC8vIHVzZSB0aGF0IGNsYXNzJ3Mgd3JhcHBlciBmb3IgdGhlIGxhc3QgdG9rZW5cbiAgICAgICAgcmV0dXJuIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MuV3JhcHBlcjtcbiAgICAgIH1cbiAgICAgIC8vIEZpbmQgYSBjbGFzcyB0aGF0IGRlc2NyaWJlcyBleGFjdGx5IGVhY2ggc2VyaWVzIG9mIHRva2Vuc1xuICAgICAgY29uc3QgbG9jYWxUb2tlbkxpc3QgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCBpbmRleCArIDEpO1xuICAgICAgY29uc3QgcG90ZW50aWFsV3JhcHBlcnMgPSBPYmplY3QudmFsdWVzKHRoaXMubXVyZS5jbGFzc2VzKVxuICAgICAgICAuZmlsdGVyKGNsYXNzT2JqID0+IHtcbiAgICAgICAgICBpZiAoIWNsYXNzT2JqLnRva2VuQ2xhc3NMaXN0Lmxlbmd0aCAhPT0gbG9jYWxUb2tlbkxpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBsb2NhbFRva2VuTGlzdC5ldmVyeSgobG9jYWxUb2tlbiwgbG9jYWxJbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdG9rZW5DbGFzc1NwZWMgPSBjbGFzc09iai50b2tlbkNsYXNzTGlzdFtsb2NhbEluZGV4XTtcbiAgICAgICAgICAgIHJldHVybiBsb2NhbFRva2VuIGluc3RhbmNlb2YgdG9rZW5DbGFzc1NwZWMuVG9rZW5DbGFzcyAmJlxuICAgICAgICAgICAgICB0b2tlbi5pc1N1YnNldE9mKHRva2VuQ2xhc3NTcGVjLmFyZ0xpc3QpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgLy8gTm8gY2xhc3NlcyBkZXNjcmliZSB0aGlzIHNlcmllcyBvZiB0b2tlbnMsIHNvIHVzZSB0aGUgZ2VuZXJpYyB3cmFwcGVyXG4gICAgICAgIHJldHVybiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgTXVsdGlwbGUgY2xhc3NlcyBkZXNjcmliZSB0aGUgc2FtZSBpdGVtISBBcmJpdHJhcmlseSBjaG9vc2luZyBvbmUuLi5gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcG90ZW50aWFsV3JhcHBlcnNbMF0uV3JhcHBlcjtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmpvaW4oJycpO1xuICB9XG5cbiAgZm9yayAoc2VsZWN0b3IpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICBuYW1lZEZ1bmN0aW9uczogdGhpcy5uYW1lZEZ1bmN0aW9ucyxcbiAgICAgIHRyYXZlcnNhbE1vZGU6IHRoaXMudHJhdmVyc2FsTW9kZSxcbiAgICAgIHRva2VuQ2xhc3NMaXN0OiB0aGlzLm11cmUucGFyc2VTZWxlY3RvcihzZWxlY3RvciksXG4gICAgICBsYXVuY2hlZEZyb21DbGFzczogdGhpcy5sYXVuY2hlZEZyb21DbGFzc1xuICAgIH0pO1xuICB9XG5cbiAgZXh0ZW5kIChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMubmFtZWRGdW5jdGlvbnMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnRva2VuQ2xhc3NMaXN0LmNvbmNhdCh7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfSk7XG4gICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgdGhpcy5sYXVuY2hlZEZyb21DbGFzcztcbiAgICBvcHRpb25zLnRyYXZlcnNhbE1vZGUgPSBvcHRpb25zLnRyYXZlcnNhbE1vZGUgfHwgdGhpcy50cmF2ZXJzYWxNb2RlO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG5cbiAgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgbGV0IHdyYXBwZXJJbmRleCA9IDA7XG4gICAgbGV0IHRlbXAgPSB3cmFwcGVkUGFyZW50O1xuICAgIHdoaWxlICh0ZW1wICE9PSBudWxsKSB7XG4gICAgICB3cmFwcGVySW5kZXggKz0gMTtcbiAgICAgIHRlbXAgPSB0ZW1wLndyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBuZXcgdGhpcy5XcmFwcGVyc1t3cmFwcGVySW5kZXhdKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gIH1cblxuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIGlmICh0aGlzLnRyYXZlcnNhbE1vZGUgPT09ICdCRlMnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEJyZWFkdGgtZmlyc3QgaXRlcmF0aW9uIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQuYCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLnRyYXZlcnNhbE1vZGUgPT09ICdERlMnKSB7XG4gICAgICBjb25zdCBkZWVwSGVscGVyID0gdGhpcy5kZWVwSGVscGVyKHRoaXMudG9rZW5MaXN0LCB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxKTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgZGVlcEhlbHBlcikge1xuICAgICAgICBpZiAoISh3cmFwcGVkSXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcikpIHtcbiAgICAgICAgICBpZiAodGhpcy5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4od3JhcHBlZEl0ZW0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gdHJhdmVyc2FsTW9kZTogJHt0aGlzLnRyYXZlcnNhbE1vZGV9YCk7XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBUaGlzIGhlbHBzIGRlcHRoLWZpcnN0IGl0ZXJhdGlvbiAod2Ugb25seSB3YW50IHRvIHlpZWxkIGZpbmlzaGVkIHBhdGhzLCBzb1xuICAgKiBpdCBsYXppbHkgYXNrcyBmb3IgdGhlbSBvbmUgYXQgYSB0aW1lIGZyb20gdGhlICpmaW5hbCogdG9rZW4sIHJlY3Vyc2l2ZWx5XG4gICAqIGFza2luZyBlYWNoIHByZWNlZGluZyB0b2tlbiB0byB5aWVsZCBkZXBlbmRlbnQgcGF0aHMgb25seSBhcyBuZWVkZWQpXG4gICAqL1xuICBhc3luYyAqIGRlZXBIZWxwZXIgKHRva2VuTGlzdCwgaSkge1xuICAgIGlmIChpID09PSAwKSB7XG4gICAgICB5aWVsZCAqIGF3YWl0IHRva2VuTGlzdFswXS5uYXZpZ2F0ZSgpOyAvLyBUaGUgZmlyc3QgdG9rZW4gaXMgYWx3YXlzIHRoZSByb290XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBwYXJlbnRZaWVsZGVkU29tZXRoaW5nID0gZmFsc2U7XG4gICAgICBmb3IgYXdhaXQgKGxldCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuZGVlcEhlbHBlcih0b2tlbkxpc3QsIGkgLSAxKSkge1xuICAgICAgICBwYXJlbnRZaWVsZGVkU29tZXRoaW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIpIHtcbiAgICAgICAgICBjb25zdCBpdGVyYXRvciA9IGF3YWl0IHRva2VuTGlzdFtpXS5uYXZpZ2F0ZSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgICB5aWVsZCAqIGl0ZXJhdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRQYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm11cmUuZGVidWcgJiYgIXBhcmVudFlpZWxkZWRTb21ldGhpbmcpIHtcbiAgICAgICAgeWllbGQgYFRva2VuIHlpZWxkZWQgbm90aGluZzogJHt0b2tlbkxpc3RbaSAtIDFdfWA7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgKiBzYW1wbGUgKHsgbGltaXQgPSAxMCB9KSB7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGUoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbTtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBCYXNlVG9rZW4gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICAvLyBUaGUgc3RyaW5nIHZlcnNpb24gb2YgbW9zdCB0b2tlbnMgY2FuIGp1c3QgYmUgZGVyaXZlZCBmcm9tIHRoZSBjbGFzcyB0eXBlXG4gICAgcmV0dXJuIGAuJHt0aGlzLnR5cGUudG9Mb3dlckNhc2UoKX0oKWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoKSB7XG4gICAgLy8gQnkgZGVmYXVsdCAod2l0aG91dCBhbnkgYXJndW1lbnRzKSwgdG9rZW5zIG9mIHRoZSBzYW1lIGNsYXNzIGFyZSBzdWJzZXRzXG4gICAgLy8gb2YgZWFjaCBvdGhlclxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgKiBuYXZpZ2F0ZSAoKSB7XG4gICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICB3cmFwcGVkUGFyZW50OiBudWxsLFxuICAgICAgdG9rZW46IHRoaXMsXG4gICAgICByYXdJdGVtOiB0aGlzLnN0cmVhbS5tdXJlLnJvb3RcbiAgICB9KTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGByb290YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUm9vdFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEtleXNUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIGFyZ0xpc3QsIHsgbWF0Y2hBbGwsIGtleXMsIHJhbmdlcyB9ID0ge30pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmIChrZXlzIHx8IHJhbmdlcykge1xuICAgICAgdGhpcy5rZXlzID0ga2V5cztcbiAgICAgIHRoaXMucmFuZ2VzID0gcmFuZ2VzO1xuICAgIH0gZWxzZSBpZiAoKGFyZ0xpc3QgJiYgYXJnTGlzdC5sZW5ndGggPT09IDEgJiYgYXJnTGlzdFswXSA9PT0gdW5kZWZpbmVkKSB8fCBtYXRjaEFsbCkge1xuICAgICAgdGhpcy5tYXRjaEFsbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFyZ0xpc3QuZm9yRWFjaChhcmcgPT4ge1xuICAgICAgICBsZXQgdGVtcCA9IGFyZy5tYXRjaCgvKFxcZCspLShbXFxk4oieXSspLyk7XG4gICAgICAgIGlmICh0ZW1wICYmIHRlbXBbMl0gPT09ICfiiJ4nKSB7XG4gICAgICAgICAgdGVtcFsyXSA9IEluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSB0ZW1wID8gdGVtcC5tYXAoZCA9PiBkLnBhcnNlSW50KGQpKSA6IG51bGw7XG4gICAgICAgIGlmICh0ZW1wICYmICFpc05hTih0ZW1wWzFdKSAmJiAhaXNOYU4odGVtcFsyXSkpIHtcbiAgICAgICAgICBmb3IgKGxldCBpID0gdGVtcFsxXTsgaSA8PSB0ZW1wWzJdOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5yYW5nZXMgfHwgW107XG4gICAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiB0ZW1wWzFdLCBoaWdoOiB0ZW1wWzJdIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IGFyZy5tYXRjaCgvJyguKiknLyk7XG4gICAgICAgIHRlbXAgPSB0ZW1wICYmIHRlbXBbMV0gPyB0ZW1wWzFdIDogYXJnO1xuICAgICAgICBsZXQgbnVtID0gTnVtYmVyKHRlbXApO1xuICAgICAgICBpZiAoaXNOYU4obnVtKSB8fCBudW0gIT09IHBhcnNlSW50KHRlbXApKSB7IC8vIGxlYXZlIG5vbi1pbnRlZ2VyIG51bWJlcnMgYXMgc3RyaW5nc1xuICAgICAgICAgIHRoaXMua2V5cyA9IHRoaXMua2V5cyB8fCB7fTtcbiAgICAgICAgICB0aGlzLmtleXNbdGVtcF0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5yYW5nZXMgfHwgW107XG4gICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogbnVtLCBoaWdoOiBudW0gfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKCF0aGlzLmtleXMgJiYgIXRoaXMucmFuZ2VzKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgQmFkIHRva2VuIGtleShzKSAvIHJhbmdlKHMpOiAke0pTT04uc3RyaW5naWZ5KGFyZ0xpc3QpfWApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5jb25zb2xpZGF0ZVJhbmdlcyh0aGlzLnJhbmdlcyk7XG4gICAgfVxuICB9XG4gIGdldCBzZWxlY3RzTm90aGluZyAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1hdGNoQWxsICYmICF0aGlzLmtleXMgJiYgIXRoaXMucmFuZ2VzO1xuICB9XG4gIGNvbnNvbGlkYXRlUmFuZ2VzIChyYW5nZXMpIHtcbiAgICAvLyBNZXJnZSBhbnkgb3ZlcmxhcHBpbmcgcmFuZ2VzXG4gICAgY29uc3QgbmV3UmFuZ2VzID0gW107XG4gICAgY29uc3QgdGVtcCA9IHJhbmdlcy5zb3J0KChhLCBiKSA9PiBhLmxvdyAtIGIubG93KTtcbiAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRlbXAubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICghY3VycmVudFJhbmdlKSB7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9IGVsc2UgaWYgKHRlbXBbaV0ubG93IDw9IGN1cnJlbnRSYW5nZS5oaWdoKSB7XG4gICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gdGVtcFtpXS5oaWdoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGN1cnJlbnRSYW5nZSkge1xuICAgICAgLy8gQ29ybmVyIGNhc2U6IGFkZCB0aGUgbGFzdCByYW5nZVxuICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld1Jhbmdlcy5sZW5ndGggPiAwID8gbmV3UmFuZ2VzIDogdW5kZWZpbmVkO1xuICB9XG4gIGRpZmZlcmVuY2UgKG90aGVyVG9rZW4pIHtcbiAgICAvLyBDb21wdXRlIHdoYXQgaXMgbGVmdCBvZiB0aGlzIGFmdGVyIHN1YnRyYWN0aW5nIG91dCBldmVyeXRoaW5nIGluIG90aGVyVG9rZW5cbiAgICBpZiAoIShvdGhlclRva2VuIGluc3RhbmNlb2YgS2V5c1Rva2VuKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBjb21wdXRlIHRoZSBkaWZmZXJlbmNlIG9mIHR3byBkaWZmZXJlbnQgdG9rZW4gdHlwZXNgKTtcbiAgICB9IGVsc2UgaWYgKG90aGVyVG9rZW4ubWF0Y2hBbGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAodGhpcy5tYXRjaEFsbCkge1xuICAgICAgY29uc29sZS53YXJuKGBJbmFjY3VyYXRlIGRpZmZlcmVuY2UgY29tcHV0ZWQhIFRPRE86IG5lZWQgdG8gZmlndXJlIG91dCBob3cgdG8gaW52ZXJ0IGNhdGVnb3JpY2FsIGtleXMhYCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmV3S2V5cyA9IHt9O1xuICAgICAgZm9yIChsZXQga2V5IGluICh0aGlzLmtleXMgfHwge30pKSB7XG4gICAgICAgIGlmICghb3RoZXJUb2tlbi5rZXlzIHx8ICFvdGhlclRva2VuLmtleXNba2V5XSkge1xuICAgICAgICAgIG5ld0tleXNba2V5XSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdSYW5nZXMgPSBbXTtcbiAgICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgICBpZiAob3RoZXJUb2tlbi5yYW5nZXMpIHtcbiAgICAgICAgICBsZXQgYWxsUG9pbnRzID0gdGhpcy5yYW5nZXMucmVkdWNlKChhZ2csIHJhbmdlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYWdnLmNvbmNhdChbXG4gICAgICAgICAgICAgIHsgaW5jbHVkZTogdHJ1ZSwgbG93OiB0cnVlLCB2YWx1ZTogcmFuZ2UubG93IH0sXG4gICAgICAgICAgICAgIHsgaW5jbHVkZTogdHJ1ZSwgaGlnaDogdHJ1ZSwgdmFsdWU6IHJhbmdlLmhpZ2ggfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgfSwgW10pO1xuICAgICAgICAgIGFsbFBvaW50cyA9IGFsbFBvaW50cy5jb25jYXQob3RoZXJUb2tlbi5yYW5nZXMucmVkdWNlKChhZ2csIHJhbmdlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYWdnLmNvbmNhdChbXG4gICAgICAgICAgICAgIHsgZXhjbHVkZTogdHJ1ZSwgbG93OiB0cnVlLCB2YWx1ZTogcmFuZ2UubG93IH0sXG4gICAgICAgICAgICAgIHsgZXhjbHVkZTogdHJ1ZSwgaGlnaDogdHJ1ZSwgdmFsdWU6IHJhbmdlLmhpZ2ggfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgfSwgW10pKS5zb3J0KCk7XG4gICAgICAgICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxQb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSB7IGxvdzogYWxsUG9pbnRzW2ldLnZhbHVlIH07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmhpZ2gpIHtcbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0udmFsdWU7XG4gICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uZXhjbHVkZSkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLmxvdyAtIDE7XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmhpZ2gpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UubG93ID0gYWxsUG9pbnRzW2ldLmhpZ2ggKyAxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5ld1JhbmdlcyA9IHRoaXMucmFuZ2VzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IEtleXNUb2tlbih0aGlzLm11cmUsIG51bGwsIHsga2V5czogbmV3S2V5cywgcmFuZ2VzOiBuZXdSYW5nZXMgfSk7XG4gICAgfVxuICB9XG4gIGlzU3ViU2V0T2YgKGFyZ0xpc3QpIHtcbiAgICBjb25zdCBvdGhlclRva2VuID0gbmV3IEtleXNUb2tlbih0aGlzLnN0cmVhbSwgYXJnTGlzdCk7XG4gICAgY29uc3QgZGlmZiA9IG90aGVyVG9rZW4uZGlmZmVyZW5jZSh0aGlzKTtcbiAgICByZXR1cm4gZGlmZiA9PT0gbnVsbCB8fCBkaWZmLnNlbGVjdHNOb3RoaW5nO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICBpZiAodGhpcy5tYXRjaEFsbCkgeyByZXR1cm4gJy5rZXlzKCknOyB9XG4gICAgcmV0dXJuICcua2V5cygnICsgKHRoaXMucmFuZ2VzIHx8IFtdKS5tYXAoKHtsb3csIGhpZ2h9KSA9PiB7XG4gICAgICByZXR1cm4gbG93ID09PSBoaWdoID8gbG93IDogYCR7bG93fS0ke2hpZ2h9YDtcbiAgICB9KS5jb25jYXQoT2JqZWN0LmtleXModGhpcy5rZXlzIHx8IHt9KS5tYXAoa2V5ID0+IGAnJHtrZXl9J2ApKVxuICAgICAgLmpvaW4oJywnKSArICcpJztcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gS2V5c1Rva2VuIGlzIG5vdCBhbiBvYmplY3RgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGZvciAobGV0IGtleSBpbiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0pIHtcbiAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAobGV0IHtsb3csIGhpZ2h9IG9mIHRoaXMucmFuZ2VzIHx8IFtdKSB7XG4gICAgICAgIGxvdyA9IE1hdGgubWF4KDAsIGxvdyk7XG4gICAgICAgIGhpZ2ggPSBNYXRoLm1pbih3cmFwcGVkUGFyZW50LnJhd0l0ZW0ubGVuZ3RoIC0gMSwgaGlnaCk7XG4gICAgICAgIGZvciAobGV0IGkgPSBsb3c7IGkgPD0gaGlnaDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMua2V5cyB8fCB7fSkge1xuICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBLZXlzVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgVmFsdWVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBjb25zdCBvYmogPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICBjb25zdCBrZXkgPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICBjb25zdCBrZXlUeXBlID0gdHlwZW9mIGtleTtcbiAgICBpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgfHwgKGtleVR5cGUgIT09ICdzdHJpbmcnICYmIGtleVR5cGUgIT09ICdudW1iZXInKSkge1xuICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBFdmFsdWF0ZVRva2VuIGlzIG5vdCBhIHN0cmluZ2ApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBsZXQgbmV3U3RyZWFtO1xuICAgIHRyeSB7XG4gICAgICBuZXdTdHJlYW0gPSB0aGlzLnN0cmVhbS5mb3JrKHdyYXBwZWRQYXJlbnQucmF3SXRlbSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcgfHwgIShlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikpIHtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCAqIGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZ2VuZXJhdG9yXSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2dlbmVyYXRvcn1gKTtcbiAgICB9XG4gICAgdGhpcy5nZW5lcmF0b3IgPSBnZW5lcmF0b3I7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLm1hcCgke3RoaXMuZ2VuZXJhdG9yfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRvciA9PT0gdGhpcy5nZW5lcmF0b3I7XG4gIH1cbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmdlbmVyYXRvcl0od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1hcFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFByb21vdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIG1hcCwgaGFzaCwgcmVkdWNlSW5zdGFuY2VzIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICB0aGlzLmhhc2ggPSBoYXNoO1xuICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID0gcmVkdWNlSW5zdGFuY2VzO1xuXG4gICAgdGhpcy5zZWVuSXRlbXMgPSB7fTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAucHJvbW90ZSgke3RoaXMubWFwfSwgJHt0aGlzLmhhc2h9LCAke3RoaXMucmVkdWNlSW5zdGFuY2VzfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICByZXR1cm4gdGhpcy5tYXAgPT09IG1hcCAmJiB0aGlzLmhhc2ggPT09IGhhc2ggJiYgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPT09ICdub29wJztcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMubWFwXSh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgY29uc3QgaGFzaCA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuaGFzaF0obWFwcGVkUmF3SXRlbSk7XG4gICAgICBpZiAodGhpcy5zZWVuSXRlbXNbaGFzaF0pIHtcbiAgICAgICAgaWYgKHRoaXMucmVkdWNlSW5zdGFuY2VzICE9PSAnbm9vcCcpIHtcbiAgICAgICAgICB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLnJlZHVjZUluc3RhbmNlc10odGhpcy5zZWVuSXRlbXNbaGFzaF0sIG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICAgIHRoaXMuc2Vlbkl0ZW1zW2hhc2hdLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNlZW5JdGVtc1toYXNoXSA9IHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgICAgeWllbGQgdGhpcy5zZWVuSXRlbXNbaGFzaF07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVUb2tlbjtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFN0cmVhbSBmcm9tICcuLi9TdHJlYW0uanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm11cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgdGhpcy50b2tlbkNsYXNzTGlzdCA9IHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKG9wdGlvbnMuc2VsZWN0b3IgfHwgYHJvb3QudmFsdWVzKClgKTtcbiAgfVxuICB3cmFwIChvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgZ2V0U3RyZWFtICgpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICB0b2tlbkNsYXNzTGlzdDogdGhpcy50b2tlbkNsYXNzTGlzdCxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB0aGlzLm5hbWVkRnVuY3Rpb25zLFxuICAgICAgbGF1bmNoZWRGcm9tQ2xhc3M6IHRoaXNcbiAgICB9KTtcbiAgfVxuICBpc1N1cGVyU2V0T2ZUb2tlbkxpc3QgKHRva2VuTGlzdCkge1xuICAgIGlmICh0b2tlbkxpc3QubGVuZ3RoICE9PSB0aGlzLnRva2VuTGlzdC5sZW5ndGgpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmV2ZXJ5KCh0b2tlbiwgaSkgPT4gdG9rZW4uaXNTdXBlclNldE9mKHRva2VuTGlzdFtpXSkpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcjtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLndyYXBwZWRQYXJlbnQgPSB3cmFwcGVkUGFyZW50O1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgICB0aGlzLnJhd0l0ZW0gPSByYXdJdGVtO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4vU3RyZWFtLmpzJztcbmltcG9ydCAqIGFzIFRPS0VOUyBmcm9tICcuL1Rva2Vucy9Ub2tlbnMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMucm9vdCA9IHt9O1xuICAgIHRoaXMuY2xhc3NlcyA9IHt9O1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgdGhpcy5UUlVUSFlfU1RSSU5HUyA9IHtcbiAgICAgICd0cnVlJzogdHJ1ZSxcbiAgICAgICd5ZXMnOiB0cnVlLFxuICAgICAgJ3knOiB0cnVlXG4gICAgfTtcbiAgICB0aGlzLkZBTFNFWV9TVFJJTkdTID0ge1xuICAgICAgJ2ZhbHNlJzogdHJ1ZSxcbiAgICAgICdubyc6IHRydWUsXG4gICAgICAnbic6IHRydWVcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UT0tFTlMgPSBUT0tFTlM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG5cbiAgICAvLyBNb25rZXktcGF0Y2ggYXZhaWxhYmxlIHRva2VucyBhcyBmdW5jdGlvbnMgb250byB0aGUgU3RyZWFtIGNsYXNzXG4gICAgZm9yIChjb25zdCB0b2tlbkNsYXNzTmFtZSBpbiB0aGlzLlRPS0VOUykge1xuICAgICAgY29uc3QgVG9rZW5DbGFzcyA9IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXTtcbiAgICAgIFN0cmVhbS5wcm90b3R5cGVbVG9rZW5DbGFzcy5sb3dlckNhbWVsQ2FzZVR5cGVdID0gZnVuY3Rpb24gKGFyZ0xpc3QsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXh0ZW5kKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBEZWZhdWx0IG5hbWVkIGZ1bmN0aW9uc1xuICAgIHRoaXMuTkFNRURfRlVOQ1RJT05TID0ge1xuICAgICAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRQYXJlbnQpIHsgeWllbGQgd3JhcHBlZFBhcmVudC5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkUGFyZW50KSB7XG4gICAgICAgIHlpZWxkIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgfSxcbiAgICAgIHNoYTE6IHJhd0l0ZW0gPT4gc2hhMShKU09OLnN0cmluZ2lmeShyYXdJdGVtKSksXG4gICAgICBub29wOiAoKSA9PiB7fVxuICAgIH07XG4gIH1cblxuICBwYXJzZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZykge1xuICAgIGlmICghc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgncm9vdCcpKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFNlbGVjdG9ycyBtdXN0IHN0YXJ0IHdpdGggJ3Jvb3QnYCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yU3RyaW5nLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBpZiAoIXRva2VuU3RyaW5ncykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yIHN0cmluZzogJHtzZWxlY3RvclN0cmluZ31gKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5DbGFzc0xpc3QgPSBbe1xuICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuUm9vdFRva2VuXG4gICAgfV07XG4gICAgdG9rZW5TdHJpbmdzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IGNodW5rLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAoIXRlbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuOiAke2NodW5rfWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdG9rZW5DbGFzc05hbWUgPSB0ZW1wWzFdWzBdLnRvVXBwZXJDYXNlKCkgKyB0ZW1wWzFdLnNsaWNlKDEpICsgJ1Rva2VuJztcbiAgICAgIGNvbnN0IGFyZ0xpc3QgPSB0ZW1wWzJdLnNwbGl0KC8oPzwhXFxcXCksLykubWFwKGQgPT4ge1xuICAgICAgICBkID0gZC50cmltKCk7XG4gICAgICAgIHJldHVybiBkID09PSAnJyA/IHVuZGVmaW5lZCA6IGQ7XG4gICAgICB9KTtcbiAgICAgIGlmICh0b2tlbkNsYXNzTmFtZSA9PT0gJ1ZhbHVlc1Rva2VuJykge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5LZXlzVG9rZW4sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuVmFsdWVUb2tlblxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSxcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIHRva2VuOiAke3RlbXBbMV19YCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRva2VuQ2xhc3NMaXN0O1xuICB9XG5cbiAgc3RyZWFtIChvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0oe1xuICAgICAgbXVyZTogdGhpcyxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiBPYmplY3QuYXNzaWduKHt9LCB0aGlzLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSksXG4gICAgICB0b2tlbkNsYXNzTGlzdDogdGhpcy5wYXJzZVNlbGVjdG9yKG9wdGlvbnMuc2VsZWN0b3IgfHwgYHJvb3QudmFsdWVzKClgKVxuICAgIH0pO1xuICB9XG5cbiAgbmV3Q2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgcm9vdC52YWx1ZXMoKWAgfSkge1xuICAgIGlmICh0aGlzLmNsYXNzZXNbb3B0aW9ucy5zZWxlY3Rvcl0pIHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5zZWxlY3Rvcl07XG4gICAgfVxuICAgIGNvbnN0IENsYXNzVHlwZSA9IG9wdGlvbnMuQ2xhc3NUeXBlIHx8IHRoaXMuQ0xBU1NFUy5HZW5lcmljQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuQ2xhc3NUeXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuc2VsZWN0b3JdID0gbmV3IENsYXNzVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuc2VsZWN0b3JdO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHk7IHRyeSBhZGREeW5hbWljRGF0YVNvdXJjZSgpIGluc3RlYWQuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSh7XG4gICAgICBrZXk6IGZpbGVPYmoubmFtZSxcbiAgICAgIGV4dGVuc2lvbjogZXh0ZW5zaW9uT3ZlcnJpZGUgfHwgbWltZS5leHRlbnNpb24oZmlsZU9iai50eXBlKSxcbiAgICAgIHRleHRcbiAgICB9KTtcbiAgfVxuICBhc3luYyBhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBrZXksXG4gICAgZXh0ZW5zaW9uID0gJ3R4dCcsXG4gICAgdGV4dFxuICB9KSB7XG4gICAgbGV0IG9iajtcbiAgICBpZiAodGhpcy5EQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgb2JqID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBkZWxldGUgb2JqLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljRGF0YVNvdXJjZShrZXksIG9iaik7XG4gIH1cbiAgYXN5bmMgYWRkU3RhdGljRGF0YVNvdXJjZSAoa2V5LCBvYmopIHtcbiAgICB0aGlzLnJvb3Rba2V5XSA9IG9iajtcbiAgICByZXR1cm4gdGhpcy5uZXdDbGFzcyh7XG4gICAgICBzZWxlY3RvcjogYHJvb3QudmFsdWVzKCcke2tleX0nKS52YWx1ZXMoKWBcbiAgICB9KTtcbiAgfVxuXG4gIHJlbW92ZURhdGFTb3VyY2UgKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLnJvb3Rba2V5XTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCBGaWxlUmVhZGVyIGZyb20gJ2ZpbGVyZWFkZXInO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKEZpbGVSZWFkZXIpO1xubXVyZS52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJpbmRleCIsInNwbGljZSIsImFyZ3MiLCJmb3JFYWNoIiwiYXBwbHkiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsInRpbWVvdXQiLCJzZXRUaW1lb3V0IiwidHJpZ2dlciIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJpIiwiU3RyZWFtIiwibXVyZSIsIm5hbWVkRnVuY3Rpb25zIiwidHJhdmVyc2FsTW9kZSIsInRva2VuTGlzdCIsInRva2VuQ2xhc3NMaXN0IiwibWFwIiwiVG9rZW5DbGFzcyIsImFyZ0xpc3QiLCJsYXVuY2hlZEZyb21DbGFzcyIsIldyYXBwZXJzIiwiZ2V0V3JhcHBlckxpc3QiLCJ0b2tlbiIsImxlbmd0aCIsIldyYXBwZXIiLCJsb2NhbFRva2VuTGlzdCIsInNsaWNlIiwicG90ZW50aWFsV3JhcHBlcnMiLCJ2YWx1ZXMiLCJjbGFzc2VzIiwiZmlsdGVyIiwiY2xhc3NPYmoiLCJldmVyeSIsImxvY2FsVG9rZW4iLCJsb2NhbEluZGV4IiwidG9rZW5DbGFzc1NwZWMiLCJpc1N1YnNldE9mIiwiV1JBUFBFUlMiLCJHZW5lcmljV3JhcHBlciIsIndhcm4iLCJzZWxlY3RvciIsImpvaW4iLCJwYXJzZVNlbGVjdG9yIiwib3B0aW9ucyIsImNvbmNhdCIsIndyYXBwZWRQYXJlbnQiLCJyYXdJdGVtIiwid3JhcHBlckluZGV4IiwidGVtcCIsIkVycm9yIiwiZGVlcEhlbHBlciIsIndyYXBwZWRJdGVtIiwiZGVidWciLCJuYXZpZ2F0ZSIsInBhcmVudFlpZWxkZWRTb21ldGhpbmciLCJpdGVyYXRvciIsImxpbWl0IiwiaXRlcmF0ZSIsIm5leHQiLCJkb25lIiwidmFsdWUiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJjb25zdHJ1Y3RvciIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiQmFzZVRva2VuIiwic3RyZWFtIiwidG9Mb3dlckNhc2UiLCJleGVjIiwibmFtZSIsIlJvb3RUb2tlbiIsIndyYXAiLCJyb290IiwiS2V5c1Rva2VuIiwibWF0Y2hBbGwiLCJrZXlzIiwicmFuZ2VzIiwidW5kZWZpbmVkIiwiYXJnIiwibWF0Y2giLCJJbmZpbml0eSIsImQiLCJwYXJzZUludCIsImlzTmFOIiwibG93IiwiaGlnaCIsIm51bSIsIk51bWJlciIsIlN5bnRheEVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsImNvbnNvbGlkYXRlUmFuZ2VzIiwic2VsZWN0c05vdGhpbmciLCJuZXdSYW5nZXMiLCJzb3J0IiwiYSIsImIiLCJjdXJyZW50UmFuZ2UiLCJvdGhlclRva2VuIiwibmV3S2V5cyIsImtleSIsImFsbFBvaW50cyIsInJlZHVjZSIsImFnZyIsInJhbmdlIiwiaW5jbHVkZSIsImV4Y2x1ZGUiLCJkaWZmIiwiZGlmZmVyZW5jZSIsIlR5cGVFcnJvciIsIk1hdGgiLCJtYXgiLCJtaW4iLCJoYXNPd25Qcm9wZXJ0eSIsIlZhbHVlVG9rZW4iLCJvYmoiLCJrZXlUeXBlIiwiRXZhbHVhdGVUb2tlbiIsIm5ld1N0cmVhbSIsImZvcmsiLCJlcnIiLCJNYXBUb2tlbiIsImdlbmVyYXRvciIsIm1hcHBlZFJhd0l0ZW0iLCJQcm9tb3RlVG9rZW4iLCJoYXNoIiwicmVkdWNlSW5zdGFuY2VzIiwiZnVuYyIsInNlZW5JdGVtcyIsIkdlbmVyaWNDbGFzcyIsIk5BTUVEX0ZVTkNUSU9OUyIsImlzU3VwZXJTZXRPZiIsIk5vZGVDbGFzcyIsIk5vZGVXcmFwcGVyIiwiRWRnZUNsYXNzIiwiRWRnZVdyYXBwZXIiLCJNdXJlIiwiRmlsZVJlYWRlciIsIm1pbWUiLCJEQVRBTElCX0ZPUk1BVFMiLCJUUlVUSFlfU1RSSU5HUyIsIkZBTFNFWV9TVFJJTkdTIiwiVE9LRU5TIiwiQ0xBU1NFUyIsInRva2VuQ2xhc3NOYW1lIiwicHJvdG90eXBlIiwiZXh0ZW5kIiwic2hhMSIsInNlbGVjdG9yU3RyaW5nIiwic3RhcnRzV2l0aCIsInRva2VuU3RyaW5ncyIsImNodW5rIiwidG9VcHBlckNhc2UiLCJzcGxpdCIsInRyaW0iLCJDbGFzc1R5cGUiLCJjaGFyc2V0IiwiZmlsZU9iaiIsImZpbGVNQiIsInNpemUiLCJza2lwU2l6ZUNoZWNrIiwidGV4dCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicmVhZGVyIiwib25sb2FkIiwicmVzdWx0IiwicmVhZEFzVGV4dCIsImVuY29kaW5nIiwiYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlIiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJleHRlbnNpb24iLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNEYXRhU291cmNlIiwibmV3Q2xhc3MiLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSxNQUFNQSxtQkFBbUIsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO2tCQUNmO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7O09BRUVDLFNBQUosRUFBZUMsUUFBZixFQUF5QkMsdUJBQXpCLEVBQWtEO1VBQzVDLENBQUMsS0FBS0osYUFBTCxDQUFtQkUsU0FBbkIsQ0FBTCxFQUFvQzthQUM3QkYsYUFBTCxDQUFtQkUsU0FBbkIsSUFBZ0MsRUFBaEM7O1VBRUUsQ0FBQ0UsdUJBQUws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
