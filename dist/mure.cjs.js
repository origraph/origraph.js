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
  constructor(options) {
    this.mure = options.mure;
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.namedStreams = options.namedStreams || {};
    this.launchedFromClass = options.launchedFromClass || null;
    this.indexes = options.indexes || {};
    this.tokenClassList = options.tokenClassList || [];

    // Reminder: this always needs to be after initializing this.namedFunctions
    // and this.namedStreams
    this.tokenList = options.tokenClassList.map(({ TokenClass, argList }) => {
      return new TokenClass(this, argList);
    });
    // Reminder: this always needs to be after initializing this.tokenList
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
      namedStreams: this.namedStreams,
      tokenClassList: this.mure.parseSelector(selector),
      launchedFromClass: this.launchedFromClass,
      indexes: this.indexes
    });
  }

  extend(TokenClass, argList, options = {}) {
    options.mure = this.mure;
    options.namedFunctions = Object.assign({}, this.namedFunctions, options.namedFunctions || {});
    options.namedStreams = Object.assign({}, this.namedStreams, options.namedStreams || {});
    options.tokenClassList = this.tokenClassList.concat([{ TokenClass, argList }]);
    options.launchedFromClass = options.launchedFromClass || this.launchedFromClass;
    options.indexes = Object.assign({}, this.indexes, options.indexes || {});
    return new Stream(options);
  }

  wrap({ wrappedParent, token, rawItem, hashes = {} }) {
    var _this = this;

    return asyncToGenerator(function* () {
      let wrapperIndex = 0;
      let temp = wrappedParent;
      while (temp !== null) {
        wrapperIndex += 1;
        temp = temp.wrappedParent;
      }
      const wrappedItem = new _this.Wrappers[wrapperIndex]({ wrappedParent, token, rawItem });
      yield Promise.all(Object.entries(hashes).reduce(function (promiseList, [hashFunctionName, hash]) {
        const index = _this.getIndex(hashFunctionName);
        if (!index.complete) {
          return promiseList.concat([index.addValue(hash, wrappedItem)]);
        }
      }, []));
      return wrappedItem;
    })();
  }

  iterate() {
    var _this2 = this;

    return asyncGenerator.wrap(function* () {
      const lastToken = _this2.tokenList[_this2.tokenList.length - 1];
      const temp = _this2.tokenList.slice(0, _this2.tokenList.length - 1);
      yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(lastToken.iterate(temp)))), asyncGenerator.await);
    })();
  }

  getIndex(hashFunctionName) {
    if (!this.indexes[hashFunctionName]) {
      // TODO: if using node.js, start with external / more scalable indexes
      this.indexes[hashFunctionName] = new this.mure.INDEXES.InMemoryIndex();
    }
    return this.indexes[hashFunctionName];
  }

  buildIndex(hashFunctionName) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      const hashFunction = _this3.namedFunctions[hashFunctionName];
      if (!hashFunction) {
        throw new Error(`Unknown named function: ${hashFunctionName}`);
      }
      const index = _this3.getIndex(hashFunctionName);
      if (index.complete) {
        return;
      }
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this3.iterate()), _step, _value; _step = yield _iterator.next(), _iteratorNormalCompletion = _step.done, _value = yield _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedItem = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = asyncIterator(hashFunction(wrappedItem)), _step2, _value2; _step2 = yield _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const hash = _value2;

              index.addValue(hash, wrappedItem);
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                yield _iterator2.return();
              }
            } finally {
              if (_didIteratorError2) {
                throw _iteratorError2;
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            yield _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      index.complete = true;
    })();
  }

  sample({ limit = 10, rebuildIndexes = false }) {
    var _this4 = this;

    return asyncGenerator.wrap(function* () {
      // Before we start, clean out any old indexes that were never finished
      Object.entries(_this4.indexes).forEach(function ([hashFunctionName, index]) {
        if (rebuildIndexes || !index.complete) {
          delete _this4.indexes[hashFunctionName];
        }
      });
      const iterator = _this4.iterate();
      for (let i = 0; i < limit; i++) {
        const temp = yield asyncGenerator.await(iterator.next());
        if (temp.done) {
          // We actually finished a full pass; flag all of our indexes as complete
          Object.values(_this4.indexes).forEach(function (index) {
            index.complete = true;
          });
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
  iterate(ancestorTokens) {
    return asyncGenerator.wrap(function* () {
      throw new Error(`This function should be overridden`);
    })();
  }
  iterateParent(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      const parentToken = ancestorTokens[ancestorTokens.length - 1];
      const temp = ancestorTokens.slice(0, ancestorTokens.length - 1);
      let yieldedSomething = false;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(parentToken.iterate(temp)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          yieldedSomething = true;
          yield wrappedParent;
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

      if (!yieldedSomething && _this.mure.debug) {
        throw new TypeError(`Token yielded no results: ${parentToken}`);
      }
    })();
  }
}
Object.defineProperty(BaseToken, 'type', {
  get() {
    return (/(.*)Token/.exec(this.name)[1]
    );
  }
});

class EmptyToken extends BaseToken {
  iterate() {
    // yield nothing

    return asyncGenerator.wrap(function* () {})();
  }
  toString() {
    return `empty`;
  }
}

class RootToken extends BaseToken {
  iterate() {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      yield _this.stream.wrap({
        wrappedParent: null,
        token: _this,
        rawItem: _this.stream.mure.root
      });
    })();
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
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if (typeof wrappedParent.rawItem !== 'object') {
            if (!_this.stream.mure.debug) {
              throw new TypeError(`Input to KeysToken is not an object`);
            } else {
              continue;
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

class ValueToken extends BaseToken {
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          const obj = wrappedParent && wrappedParent.wrappedParent && wrappedParent.wrappedParent.rawItem;
          const key = wrappedParent && wrappedParent.rawItem;
          const keyType = typeof key;
          if (typeof obj !== 'object' || keyType !== 'string' && keyType !== 'number') {
            if (!_this.stream.mure.debug) {
              throw new TypeError(`ValueToken used on a non-object, or without a string / numeric key`);
            } else {
              continue;
            }
          }
          yield _this.stream.wrap({
            wrappedParent,
            token: _this,
            rawItem: obj[key]
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

class EvaluateToken extends BaseToken {
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if (typeof wrappedParent.rawItem !== 'string') {
            if (!_this.stream.mure.debug) {
              throw new TypeError(`Input to EvaluateToken is not a string`);
            } else {
              continue;
            }
          }
          let newStream;
          try {
            newStream = _this.stream.fork(wrappedParent.rawItem);
          } catch (err) {
            if (!_this.stream.mure.debug || !(err instanceof SyntaxError)) {
              throw err;
            } else {
              continue;
            }
          }
          yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(newStream.iterate()))), asyncGenerator.await);
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
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = asyncIterator(_this.stream.namedFunctions[_this.generator](wrappedParent)), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const mappedRawItem = _value2;

              yield _this.stream.wrap({
                wrappedParent,
                token: _this,
                rawItem: mappedRawItem
              });
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
  }
  toString() {
    return `.promote(${this.map}, ${this.hash}, ${this.reduceInstances})`;
  }
  isSubSetOf([map = 'identity', hash = 'sha1', reduceInstances = 'noop']) {
    return this.map === map && this.hash === hash && this.reduceInstances === reduceInstances;
  }
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          const mapFunction = _this.stream.namedFunctions[_this.map];
          const hashFunction = _this.stream.namedFunctions[_this.hash];
          const reduceInstancesFunction = _this.stream.namedFunctions[_this.reduceInstances];
          const hashIndex = _this.stream.getIndex(_this.hash);
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = asyncIterator(mapFunction(wrappedParent)), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const mappedRawItem = _value2;

              const hash = hashFunction(mappedRawItem);
              let originalWrappedItem = (yield asyncGenerator.await(hashIndex.getValueList(hash)))[0];
              if (originalWrappedItem) {
                if (_this.reduceInstances !== 'noop') {
                  reduceInstancesFunction(originalWrappedItem, mappedRawItem);
                  originalWrappedItem.trigger('update');
                }
              } else {
                const hashes = {};
                hashes[_this.hash] = hash;
                yield _this.stream.wrap({
                  wrappedParent,
                  token: _this,
                  rawItem: mappedRawItem,
                  hashes
                });
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

class JoinToken extends BaseToken {
  constructor(stream, [otherStream, thisHash = 'key', otherHash = 'key', finish = 'defaultFinish', nthJoin = 0]) {
    super(stream);
    for (const func of [thisHash, finish]) {
      if (!stream.namedFunctions[func]) {
        throw new SyntaxError(`Unknown named function: ${func}`);
      }
    }

    const temp = stream.namedStreams[otherStream];
    if (!temp) {
      throw new SyntaxError(`Unknown named stream: ${otherStream}`);
    }
    // Require otherHash on the other stream, or copy ours over if it isn't
    // already defined
    if (!temp.namedFunctions[otherHash]) {
      if (!stream.namedFunctions[otherHash]) {
        throw new SyntaxError(`Unknown hash function on either stream: ${otherHash}`);
      } else {
        temp.namedFunctions[otherHash] = stream.namedFunctions[otherHash];
      }
    }

    this.otherStream = otherStream;
    this.thisHash = thisHash;
    this.otherHash = otherHash;
    this.finish = finish;
    this.nthJoin = nthJoin;
  }
  toString() {
    return `.join(${this.otherStream}, ${this.thisHash}, ${this.otherHash}, ${this.finish})`;
  }
  isSubSetOf([otherStream, thisHash = 'key', otherHash = 'key', finish = 'identity']) {
    return this.otherStream === otherStream && this.thisHash === thisHash && this.otherHash === otherHash && this.finish === finish;
  }
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      const otherStream = _this.stream.namedStreams[_this.otherStream];
      const thisHashFunction = _this.stream.namedFunctions[_this.thisHash];
      const otherHashFunction = otherStream.namedFunctions[_this.otherHash];
      const finishFunction = _this.stream.namedFunctions[_this.finish];

      // const thisIterator = this.iterateParent(ancestorTokens);
      // const otherIterator = otherStream.iterate();

      const thisIndex = _this.stream.getIndex(_this.thisHash);
      const otherIndex = otherStream.getIndex(_this.otherHash);

      if (thisIndex.complete) {
        if (otherIndex.complete) {
          // Best of all worlds; we can just join the indexes
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = asyncIterator(thisIndex.iterEntries()), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
              const { hash, valueList } = _value;

              const otherList = yield asyncGenerator.await(otherIndex.getValueList(hash));
              var _iteratorNormalCompletion2 = true;
              var _didIteratorError2 = false;
              var _iteratorError2 = undefined;

              try {
                for (var _iterator2 = asyncIterator(otherList), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                  const otherWrappedItem = _value2;
                  var _iteratorNormalCompletion3 = true;
                  var _didIteratorError3 = false;
                  var _iteratorError3 = undefined;

                  try {
                    for (var _iterator3 = asyncIterator(valueList), _step3, _value3; _step3 = yield asyncGenerator.await(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield asyncGenerator.await(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
                      const thisWrappedItem = _value3;
                      var _iteratorNormalCompletion4 = true;
                      var _didIteratorError4 = false;
                      var _iteratorError4 = undefined;

                      try {
                        for (var _iterator4 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step4, _value4; _step4 = yield asyncGenerator.await(_iterator4.next()), _iteratorNormalCompletion4 = _step4.done, _value4 = yield asyncGenerator.await(_step4.value), !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                          const rawItem = _value4;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError4 = true;
                        _iteratorError4 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion4 && _iterator4.return) {
                            yield asyncGenerator.await(_iterator4.return());
                          }
                        } finally {
                          if (_didIteratorError4) {
                            throw _iteratorError4;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError3 = true;
                    _iteratorError3 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion3 && _iterator3.return) {
                        yield asyncGenerator.await(_iterator3.return());
                      }
                    } finally {
                      if (_didIteratorError3) {
                        throw _iteratorError3;
                      }
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
          // Need to iterate the other items, and take advantage of our complete
          // index
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;
          var _iteratorError5 = undefined;

          try {
            for (var _iterator5 = asyncIterator(otherStream.iterate()), _step5, _value5; _step5 = yield asyncGenerator.await(_iterator5.next()), _iteratorNormalCompletion5 = _step5.done, _value5 = yield asyncGenerator.await(_step5.value), !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
              const otherWrappedItem = _value5;
              var _iteratorNormalCompletion6 = true;
              var _didIteratorError6 = false;
              var _iteratorError6 = undefined;

              try {
                for (var _iterator6 = asyncIterator(otherHashFunction(otherWrappedItem)), _step6, _value6; _step6 = yield asyncGenerator.await(_iterator6.next()), _iteratorNormalCompletion6 = _step6.done, _value6 = yield asyncGenerator.await(_step6.value), !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
                  const hash = _value6;

                  // Add otherWrappedItem to otherIndex:
                  yield asyncGenerator.await(otherIndex.addValue(hash, otherWrappedItem));
                  const thisList = yield asyncGenerator.await(thisIndex.getValueList(hash));
                  var _iteratorNormalCompletion7 = true;
                  var _didIteratorError7 = false;
                  var _iteratorError7 = undefined;

                  try {
                    for (var _iterator7 = asyncIterator(thisList), _step7, _value7; _step7 = yield asyncGenerator.await(_iterator7.next()), _iteratorNormalCompletion7 = _step7.done, _value7 = yield asyncGenerator.await(_step7.value), !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
                      const thisWrappedItem = _value7;
                      var _iteratorNormalCompletion8 = true;
                      var _didIteratorError8 = false;
                      var _iteratorError8 = undefined;

                      try {
                        for (var _iterator8 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step8, _value8; _step8 = yield asyncGenerator.await(_iterator8.next()), _iteratorNormalCompletion8 = _step8.done, _value8 = yield asyncGenerator.await(_step8.value), !_iteratorNormalCompletion8; _iteratorNormalCompletion8 = true) {
                          const rawItem = _value8;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError8 = true;
                        _iteratorError8 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion8 && _iterator8.return) {
                            yield asyncGenerator.await(_iterator8.return());
                          }
                        } finally {
                          if (_didIteratorError8) {
                            throw _iteratorError8;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError7 = true;
                    _iteratorError7 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion7 && _iterator7.return) {
                        yield asyncGenerator.await(_iterator7.return());
                      }
                    } finally {
                      if (_didIteratorError7) {
                        throw _iteratorError7;
                      }
                    }
                  }
                }
              } catch (err) {
                _didIteratorError6 = true;
                _iteratorError6 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion6 && _iterator6.return) {
                    yield asyncGenerator.await(_iterator6.return());
                  }
                } finally {
                  if (_didIteratorError6) {
                    throw _iteratorError6;
                  }
                }
              }
            }
          } catch (err) {
            _didIteratorError5 = true;
            _iteratorError5 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion5 && _iterator5.return) {
                yield asyncGenerator.await(_iterator5.return());
              }
            } finally {
              if (_didIteratorError5) {
                throw _iteratorError5;
              }
            }
          }
        }
      } else {
        if (otherIndex.complete) {
          // Need to iterate our items, and take advantage of the other complete
          // index
          var _iteratorNormalCompletion9 = true;
          var _didIteratorError9 = false;
          var _iteratorError9 = undefined;

          try {
            for (var _iterator9 = asyncIterator(_this.iterateParent(ancestorTokens)), _step9, _value9; _step9 = yield asyncGenerator.await(_iterator9.next()), _iteratorNormalCompletion9 = _step9.done, _value9 = yield asyncGenerator.await(_step9.value), !_iteratorNormalCompletion9; _iteratorNormalCompletion9 = true) {
              const thisWrappedItem = _value9;
              var _iteratorNormalCompletion10 = true;
              var _didIteratorError10 = false;
              var _iteratorError10 = undefined;

              try {
                for (var _iterator10 = asyncIterator(thisHashFunction(thisWrappedItem)), _step10, _value10; _step10 = yield asyncGenerator.await(_iterator10.next()), _iteratorNormalCompletion10 = _step10.done, _value10 = yield asyncGenerator.await(_step10.value), !_iteratorNormalCompletion10; _iteratorNormalCompletion10 = true) {
                  const hash = _value10;

                  // add thisWrappedItem to thisIndex
                  yield asyncGenerator.await(thisIndex.addValue(hash, thisWrappedItem));
                  const otherList = yield asyncGenerator.await(otherIndex.getValueList(hash));
                  var _iteratorNormalCompletion11 = true;
                  var _didIteratorError11 = false;
                  var _iteratorError11 = undefined;

                  try {
                    for (var _iterator11 = asyncIterator(otherList), _step11, _value11; _step11 = yield asyncGenerator.await(_iterator11.next()), _iteratorNormalCompletion11 = _step11.done, _value11 = yield asyncGenerator.await(_step11.value), !_iteratorNormalCompletion11; _iteratorNormalCompletion11 = true) {
                      const otherWrappedItem = _value11;
                      var _iteratorNormalCompletion12 = true;
                      var _didIteratorError12 = false;
                      var _iteratorError12 = undefined;

                      try {
                        for (var _iterator12 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step12, _value12; _step12 = yield asyncGenerator.await(_iterator12.next()), _iteratorNormalCompletion12 = _step12.done, _value12 = yield asyncGenerator.await(_step12.value), !_iteratorNormalCompletion12; _iteratorNormalCompletion12 = true) {
                          const rawItem = _value12;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError12 = true;
                        _iteratorError12 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion12 && _iterator12.return) {
                            yield asyncGenerator.await(_iterator12.return());
                          }
                        } finally {
                          if (_didIteratorError12) {
                            throw _iteratorError12;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError11 = true;
                    _iteratorError11 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion11 && _iterator11.return) {
                        yield asyncGenerator.await(_iterator11.return());
                      }
                    } finally {
                      if (_didIteratorError11) {
                        throw _iteratorError11;
                      }
                    }
                  }
                }
              } catch (err) {
                _didIteratorError10 = true;
                _iteratorError10 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion10 && _iterator10.return) {
                    yield asyncGenerator.await(_iterator10.return());
                  }
                } finally {
                  if (_didIteratorError10) {
                    throw _iteratorError10;
                  }
                }
              }
            }
          } catch (err) {
            _didIteratorError9 = true;
            _iteratorError9 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion9 && _iterator9.return) {
                yield asyncGenerator.await(_iterator9.return());
              }
            } finally {
              if (_didIteratorError9) {
                throw _iteratorError9;
              }
            }
          }
        } else {
          // Neither stream is fully indexed; for more distributed sampling, grab
          // one item from each stream at a time, and use the partial indexes
          const thisIterator = _this.iterateParent(ancestorTokens);
          let thisIsDone = false;
          const otherIterator = otherStream.iterate();
          let otherIsDone = false;

          while (!thisIsDone || !otherIsDone) {
            // Take one sample from this stream
            let temp = yield asyncGenerator.await(thisIterator.next());
            if (temp.done) {
              thisIsDone = true;
            } else {
              const thisWrappedItem = yield asyncGenerator.await(temp.value);
              var _iteratorNormalCompletion13 = true;
              var _didIteratorError13 = false;
              var _iteratorError13 = undefined;

              try {
                for (var _iterator13 = asyncIterator(thisHashFunction(thisWrappedItem)), _step13, _value13; _step13 = yield asyncGenerator.await(_iterator13.next()), _iteratorNormalCompletion13 = _step13.done, _value13 = yield asyncGenerator.await(_step13.value), !_iteratorNormalCompletion13; _iteratorNormalCompletion13 = true) {
                  const hash = _value13;

                  // add thisWrappedItem to thisIndex
                  thisIndex.addValue(hash, thisWrappedItem);
                  const otherList = yield asyncGenerator.await(otherIndex.getValueList(hash));
                  var _iteratorNormalCompletion14 = true;
                  var _didIteratorError14 = false;
                  var _iteratorError14 = undefined;

                  try {
                    for (var _iterator14 = asyncIterator(otherList), _step14, _value14; _step14 = yield asyncGenerator.await(_iterator14.next()), _iteratorNormalCompletion14 = _step14.done, _value14 = yield asyncGenerator.await(_step14.value), !_iteratorNormalCompletion14; _iteratorNormalCompletion14 = true) {
                      const otherWrappedItem = _value14;
                      var _iteratorNormalCompletion15 = true;
                      var _didIteratorError15 = false;
                      var _iteratorError15 = undefined;

                      try {
                        for (var _iterator15 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step15, _value15; _step15 = yield asyncGenerator.await(_iterator15.next()), _iteratorNormalCompletion15 = _step15.done, _value15 = yield asyncGenerator.await(_step15.value), !_iteratorNormalCompletion15; _iteratorNormalCompletion15 = true) {
                          const rawItem = _value15;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError15 = true;
                        _iteratorError15 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion15 && _iterator15.return) {
                            yield asyncGenerator.await(_iterator15.return());
                          }
                        } finally {
                          if (_didIteratorError15) {
                            throw _iteratorError15;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError14 = true;
                    _iteratorError14 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion14 && _iterator14.return) {
                        yield asyncGenerator.await(_iterator14.return());
                      }
                    } finally {
                      if (_didIteratorError14) {
                        throw _iteratorError14;
                      }
                    }
                  }
                }
              } catch (err) {
                _didIteratorError13 = true;
                _iteratorError13 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion13 && _iterator13.return) {
                    yield asyncGenerator.await(_iterator13.return());
                  }
                } finally {
                  if (_didIteratorError13) {
                    throw _iteratorError13;
                  }
                }
              }
            }

            // Now for a sample from the other stream
            temp = yield asyncGenerator.await(otherIterator.next());
            if (temp.done) {
              otherIsDone = true;
            } else {
              const otherWrappedItem = yield asyncGenerator.await(temp.value);
              var _iteratorNormalCompletion16 = true;
              var _didIteratorError16 = false;
              var _iteratorError16 = undefined;

              try {
                for (var _iterator16 = asyncIterator(otherHashFunction(otherWrappedItem)), _step16, _value16; _step16 = yield asyncGenerator.await(_iterator16.next()), _iteratorNormalCompletion16 = _step16.done, _value16 = yield asyncGenerator.await(_step16.value), !_iteratorNormalCompletion16; _iteratorNormalCompletion16 = true) {
                  const hash = _value16;

                  // add otherWrappedItem to otherIndex
                  otherIndex.addValue(hash, otherWrappedItem);
                  const thisList = yield asyncGenerator.await(thisIndex.getValueList(hash));
                  var _iteratorNormalCompletion17 = true;
                  var _didIteratorError17 = false;
                  var _iteratorError17 = undefined;

                  try {
                    for (var _iterator17 = asyncIterator(thisList), _step17, _value17; _step17 = yield asyncGenerator.await(_iterator17.next()), _iteratorNormalCompletion17 = _step17.done, _value17 = yield asyncGenerator.await(_step17.value), !_iteratorNormalCompletion17; _iteratorNormalCompletion17 = true) {
                      const thisWrappedItem = _value17;
                      var _iteratorNormalCompletion18 = true;
                      var _didIteratorError18 = false;
                      var _iteratorError18 = undefined;

                      try {
                        for (var _iterator18 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step18, _value18; _step18 = yield asyncGenerator.await(_iterator18.next()), _iteratorNormalCompletion18 = _step18.done, _value18 = yield asyncGenerator.await(_step18.value), !_iteratorNormalCompletion18; _iteratorNormalCompletion18 = true) {
                          const rawItem = _value18;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError18 = true;
                        _iteratorError18 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion18 && _iterator18.return) {
                            yield asyncGenerator.await(_iterator18.return());
                          }
                        } finally {
                          if (_didIteratorError18) {
                            throw _iteratorError18;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError17 = true;
                    _iteratorError17 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion17 && _iterator17.return) {
                        yield asyncGenerator.await(_iterator17.return());
                      }
                    } finally {
                      if (_didIteratorError17) {
                        throw _iteratorError17;
                      }
                    }
                  }
                }
              } catch (err) {
                _didIteratorError16 = true;
                _iteratorError16 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion16 && _iterator16.return) {
                    yield asyncGenerator.await(_iterator16.return());
                  }
                } finally {
                  if (_didIteratorError16) {
                    throw _iteratorError16;
                  }
                }
              }
            }
          }
        }
      }
    })();
  }
}



var TOKENS = /*#__PURE__*/Object.freeze({
  EmptyToken: EmptyToken,
  RootToken: RootToken,
  KeysToken: KeysToken,
  ValueToken: ValueToken,
  EvaluateToken: EvaluateToken,
  MapToken: MapToken,
  PromoteToken: PromoteToken,
  JoinToken: JoinToken
});

const ASTERISKS = {
  'evaluate': '↬',
  'join': '⨯',
  'map': '↦',
  'promote': '↑',
  'value': '→'
};

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this.mure = options.mure;
    this.classId = options.classId;
    this._selector = options.selector;
    this.customClassName = options.customClassName || null;
    this.customNameTokenIndex = options.customNameTokenIndex || null;
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.indexes = options.indexes || {};
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    for (let [funcName, func] of Object.entries(this.namedFunctions)) {
      if (typeof func === 'string') {
        this.namedFunctions[funcName] = new Function(`return ${func}`)(); // eslint-disable-line no-new-func
      }
    }
  }
  get selector() {
    return this._selector;
  }
  get tokenClassList() {
    return this.mure.parseSelector(this.selector);
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      const result = {
        classType: _this.constructor.name,
        selector: _this._selector,
        customClassName: _this.customClassName,
        customNameTokenIndex: _this.customNameTokenIndex,
        classId: _this.classId,
        indexes: {},
        namedFunctions: {}
      };
      for (let [funcName, func] of Object.entries(_this.namedFunctions)) {
        result.namedFunctions[funcName] = func.toString();
      }
      yield Promise.all(Object.entries(_this.indexes).map((() => {
        var _ref = asyncToGenerator(function* ([funcName, index]) {
          if (index.complete) {
            result.indexes[funcName] = yield index.toRawObject();
          }
        });

        return function (_x) {
          return _ref.apply(this, arguments);
        };
      })()));
      return result;
    })();
  }
  wrap(options) {
    return new this.Wrapper(options);
  }
  setClassName(value) {
    var _this2 = this;

    return asyncToGenerator(function* () {
      if (_this2.customClassName !== value) {
        _this2.customClassName = value;
        _this2.customNameTokenIndex = _this2.selector.match(/\.([^(]*)\(([^)]*)\)/g).length;
        yield _this2.mure.saveClasses();
      }
    })();
  }
  get hasCustomName() {
    return this.customClassName !== null && this.customNameTokenIndex === this.selector.match(/\.([^(]*)\(([^)]*)\)/g).length;
  }
  get className() {
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
  setNamedFunction(funcName, func) {
    this.namedFunctions[funcName] = func;
  }
  populateStreamOptions(options = {}) {
    options.mure = this.mure;
    options.tokenClassList = this.tokenClassList;
    options.namedFunctions = this.namedFunctions;
    options.launchedFromClass = this;
    options.indexes = this.indexes;
    return options;
  }
  getStream(options = {}) {
    if (options.reset || !this._stream) {
      this._stream = new Stream(this.populateStreamOptions(options));
    }
    return this._stream;
  }
  isSuperSetOfTokenList(tokenList) {
    if (tokenList.length !== this.tokenList.length) {
      return false;
    }
    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }
  interpretAsNodes() {
    var _this3 = this;

    return asyncToGenerator(function* () {
      const options = yield _this3.toRawObject();
      options.mure = _this3.mure;
      _this3.mure.classes[_this3.classId] = new _this3.mure.CLASSES.NodeClass(options);
      yield _this3.mure.saveClasses();
      return _this3.mure.classes[_this3.classId];
    })();
  }
  interpretAsEdges() {
    var _this4 = this;

    return asyncToGenerator(function* () {
      const options = yield _this4.toRawObject();
      options.mure = _this4.mure;
      _this4.mure.classes[_this4.classId] = new _this4.mure.CLASSES.EdgeClass(options);
      yield _this4.mure.saveClasses();
      return _this4.mure.classes[_this4.classId];
    })();
  }
  aggregate(hash, reduce) {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  expand(map) {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  filter(filter) {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  split(hash) {
    return asyncGenerator.wrap(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  delete() {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
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
    this.edgeConnections = options.edgeConnections || {};
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
      // prevents `await super`; this is a workaround:
      const result = yield GenericClass.prototype.toRawObject.call(_this);
      // TODO: need to deep copy edgeConnections?
      result.edgeConnections = _this.edgeConnections;
      return result;
    })();
  }
  interpretAsNodes() {
    var _this2 = this;

    return asyncToGenerator(function* () {
      return _this2;
    })();
  }
  interpretAsEdges() {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  connectToNodeClass({ nodeClass, thisHashName, otherHashName }) {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  connectToEdgeClass(options) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      const edgeClass = options.edgeClass;
      delete options.edgeClass;
      options.nodeClass = _this3;
      edgeClass.connectToNodeClass(options);
    })();
  }
}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.EdgeWrapper;
    this.sourceClassId = options.sourceClassId || null;
    this.targetClassId = options.targetClassId || null;
    this.directed = options.directed || false;
  }
  get selector() {
    const sourceClass = this.mure.classes[this.sourceClassId];
    const targetClass = this.mure.classes[this.targetClassId];

    if (!this._selector) {
      if (!sourceClass || !targetClass) {
        throw new Error(`Partial connections without an edge table should never happen`);
      } else {
        // No edge table (simple join between two nodes)
        const sourceHash = sourceClass.edgeConnections[this.classId].nodeHashName;
        const targetHash = targetClass.edgeConnections[this.classId].nodeHashName;
        return sourceClass.selector + `.join(target, ${sourceHash}, ${targetHash}, defaultFinish)`;
      }
    } else {
      let result = this._selector;
      if (!sourceClass) {
        if (!targetClass) {
          // No connections yet; just yield the raw edge table
          return result;
        } else {
          // Partial edge-target connections
          const { edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId];
          return result + `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        }
      } else if (!targetClass) {
        // Partial source-edge connections
        const { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        return result + `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
      } else {
        // Full connections
        let { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        result += `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        ({ edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId]);
        result += `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, 1)`;
        return result;
      }
    }
  }
  populateStreamOptions(options = {}) {
    const sourceClass = this.mure.classes[this.sourceClassId];
    const targetClass = this.mure.classes[this.targetClassId];
    options.namedStreams = {};
    if (!this._selector) {
      // Use the options from the source stream instead of our class
      options = sourceClass.populateStreamOptions(options);
      options.namedStreams.target = targetClass.getStream();
    } else {
      options = super.populateStreamOptions(options);
      if (sourceClass) {
        options.namedStreams.source = sourceClass.getStream();
      }
      if (targetClass) {
        options.namedStreams.target = targetClass.getStream();
      }
    }
    return options;
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
      // prevents `await super`; this is a workaround:
      const result = yield GenericClass.prototype.toRawObject.call(_this);
      result.sourceClassId = _this.sourceClassId;
      result.targetClassId = _this.targetClassId;
      result.directed = _this.directed;
      return result;
    })();
  }
  interpretAsNodes() {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  interpretAsEdges() {
    var _this2 = this;

    return asyncToGenerator(function* () {
      return _this2;
    })();
  }
  connectToNodeClass({ nodeClass, direction, nodeHashName, edgeHashName }) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      if (direction === 'source') {
        if (_this3.sourceClassId) {
          delete _this3.mure.classes[_this3.sourceClassId].edgeConnections[_this3.classId];
        }
        _this3.sourceClassId = nodeClass.classId;
      } else if (direction === 'target') {
        if (_this3.targetClassId) {
          delete _this3.mure.classes[_this3.targetClassId].edgeConnections[_this3.classId];
        }
        _this3.targetClassId = nodeClass.classId;
      } else {
        if (!_this3.sourceClassId) {
          _this3.sourceClassId = nodeClass.classId;
        } else if (!_this3.targetClassId) {
          _this3.targetClassId = nodeClass.classId;
        } else {
          throw new Error(`Source and target are already defined; please specify a direction to override`);
        }
      }
      nodeClass.edgeConnections[_this3.classId] = { nodeHashName, edgeHashName };
      delete _this3._stream;
      yield _this3.mure.saveClasses();
    })();
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

class InMemoryIndex {
  constructor({ entries = {}, complete = false } = {}) {
    this.entries = entries;
    this.complete = complete;
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      return _this.entries;
    })();
  }
  iterEntries() {
    var _this2 = this;

    return asyncGenerator.wrap(function* () {
      for (const [hash, valueList] of Object.entries(_this2.entries)) {
        yield { hash, valueList };
      }
    })();
  }
  iterHashes() {
    var _this3 = this;

    return asyncGenerator.wrap(function* () {
      for (const hash of Object.keys(_this3.entries)) {
        yield hash;
      }
    })();
  }
  iterValueLists() {
    var _this4 = this;

    return asyncGenerator.wrap(function* () {
      for (const valueList of Object.values(_this4.entries)) {
        yield valueList;
      }
    })();
  }
  getValueList(hash) {
    var _this5 = this;

    return asyncToGenerator(function* () {
      return _this5.entries[hash] || [];
    })();
  }
  addValue(hash, value) {
    var _this6 = this;

    return asyncToGenerator(function* () {
      // TODO: add some kind of warning if this is getting big?
      _this6.entries[hash] = yield _this6.getValueList(hash);
      _this6.entries[hash].push(value);
    })();
  }
}



var INDEXES = /*#__PURE__*/Object.freeze({
  InMemoryIndex: InMemoryIndex
});

let NEXT_CLASS_ID = 1;

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader$$1, localStorage) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node
    this.localStorage = localStorage; // either window.localStorage or null
    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set mure.debug to true to debug streams

    // extensions that we want datalib to handle
    this.DATALIB_FORMATS = {
      'json': 'json',
      'csv': 'csv',
      'tsv': 'tsv',
      'topojson': 'topojson',
      'treejson': 'treejson'
    };

    // Access to core classes via the main library helps avoid circular imports
    this.TOKENS = TOKENS;
    this.CLASSES = CLASSES;
    this.WRAPPERS = WRAPPERS;
    this.INDEXES = INDEXES;

    // Monkey-patch available tokens as functions onto the Stream class
    for (const tokenClassName in this.TOKENS) {
      const TokenClass = this.TOKENS[tokenClassName];
      Stream.prototype[TokenClass.lowerCamelCaseType] = function (argList, options) {
        return this.extend(TokenClass, argList, options);
      };
    }

    // Default named functions
    this.NAMED_FUNCTIONS = {
      identity: function* (wrappedItem) {
        yield wrappedItem.rawItem;
      },
      key: function* (wrappedItem) {
        if (!wrappedItem.wrappedParent || !wrappedItem.wrappedParent.wrappedParent || typeof wrappedItem.wrappedParent.wrappedParent.rawItem !== 'object') {
          throw new TypeError(`Grandparent is not an object / array`);
        }
        const parentType = typeof wrappedItem.wrappedParent.rawItem;
        if (!(parentType === 'number' || parentType === 'string')) {
          throw new TypeError(`Parent isn't a key / index`);
        } else {
          yield wrappedItem.wrappedParent.rawItem;
        }
      },
      defaultFinish: function* (thisWrappedItem, otherWrappedItem) {
        if (thisWrappedItem.rawItem instanceof Array) {
          // if relevant, merge the results of a series of joins into a single
          // array
          yield thisWrappedItem.rawItem.concat([otherWrappedItem.rawItem]);
        } else {
          // otherwise just yield the two results as an array
          yield [thisWrappedItem.rawItem, otherWrappedItem.rawItem];
        }
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    };

    // Object containing each of our data sources
    this.root = this.loadRoot();

    // Object containing our class specifications
    this.classes = this.loadClasses();
  }

  loadRoot() {
    let root = this.localStorage && this.localStorage.getItem('mure_root');
    root = root ? JSON.parse(root) : {};
    return root;
  }
  saveRoot() {
    var _this = this;

    return asyncToGenerator(function* () {
      if (_this.localStorage) {
        _this.localStorage.setItem('mure_root', JSON.stringify(_this.root));
      }
      _this.trigger('rootUpdate');
    })();
  }
  loadClasses() {
    let classes = this.localStorage && this.localStorage.getItem('mure_classes');
    classes = classes ? JSON.parse(classes) : {};
    Object.entries(classes).forEach(([classId, rawClassObj]) => {
      Object.entries(rawClassObj.indexes).forEach(([funcName, rawIndexObj]) => {
        rawClassObj.indexes[funcName] = new this.INDEXES.InMemoryIndex({
          entries: rawIndexObj, complete: true
        });
      });
      const classType = rawClassObj.classType;
      delete rawClassObj.classType;
      rawClassObj.mure = this;
      classes[classId] = new this.CLASSES[classType](rawClassObj);
    });
    return classes;
  }
  saveClasses() {
    var _this2 = this;

    return asyncToGenerator(function* () {
      if (_this2.localStorage) {
        const rawClasses = {};
        yield Promise.all(Object.entries(_this2.classes).map((() => {
          var _ref = asyncToGenerator(function* ([classId, classObj]) {
            rawClasses[classId] = yield classObj.toRawObject();
          });

          return function (_x) {
            return _ref.apply(this, arguments);
          };
        })()));
        _this2.localStorage.setItem('mure_classes', JSON.stringify(rawClasses));
      }
      _this2.trigger('classUpdate');
    })();
  }

  parseSelector(selectorString) {
    const startsWithRoot = selectorString.startsWith('root');
    if (!(startsWithRoot || selectorString.startsWith('empty'))) {
      throw new SyntaxError(`Selectors must start with 'root' or 'empty'`);
    }
    const tokenStrings = selectorString.match(/\.([^(]*)\(([^)]*)\)/g);
    if (!tokenStrings) {
      throw new SyntaxError(`Invalid selector string: ${selectorString}`);
    }
    const tokenClassList = [{
      TokenClass: startsWithRoot ? this.TOKENS.RootToken : this.TOKENS.EmptyToken
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
    options.mure = this;
    options.tokenClassList = this.parseSelector(options.selector || `root.values()`);
    return new Stream(options);
  }

  newClass(options = { selector: `root` }) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      options.classId = `class${NEXT_CLASS_ID}`;
      NEXT_CLASS_ID += 1;
      const ClassType = options.ClassType || _this3.CLASSES.GenericClass;
      delete options.ClassType;
      options.mure = _this3;
      _this3.classes[options.classId] = new ClassType(options);
      yield _this3.saveClasses();
      return _this3.classes[options.classId];
    })();
  }

  addFileAsStaticDataSource({
    fileObj,
    encoding = mime.charset(fileObj.type),
    extensionOverride = null,
    skipSizeCheck = false
  } = {}) {
    var _this4 = this;

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
        let reader = new _this4.FileReader();
        reader.onload = function () {
          resolve(reader.result);
        };
        reader.readAsText(fileObj, encoding);
      });
      return _this4.addStringAsStaticDataSource({
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
    var _this5 = this;

    return asyncToGenerator(function* () {
      let obj;
      if (_this5.DATALIB_FORMATS[extension]) {
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
      return _this5.addStaticDataSource(key, obj);
    })();
  }
  addStaticDataSource(key, obj) {
    var _this6 = this;

    return asyncToGenerator(function* () {
      _this6.root[key] = obj;
      const temp = yield Promise.all([_this6.saveRoot(), _this6.newClass({
        selector: `root.values('${key}').values()`
      })]);
      return temp[1];
    })();
  }
  removeDataSource(key) {
    var _this7 = this;

    return asyncToGenerator(function* () {
      delete _this7.root[key];
      yield _this7.saveRoot();
    })();
  }
}

var name = "mure";
var version = "0.4.8r3";
var description = "A library for flexible graph reshaping";
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
	rollup: "^0.65.0",
	"rollup-plugin-babel": "^3.0.7",
	"rollup-plugin-commonjs": "^9.1.6",
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

let mure = new Mure(FileReader, null);
mure.version = pkg.version;

module.exports = mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBTdHJlYW0ge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIHRoaXMubmFtZWRTdHJlYW1zID0gb3B0aW9ucy5uYW1lZFN0cmVhbXMgfHwge307XG4gICAgdGhpcy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgbnVsbDtcbiAgICB0aGlzLmluZGV4ZXMgPSBvcHRpb25zLmluZGV4ZXMgfHwge307XG4gICAgdGhpcy50b2tlbkNsYXNzTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgfHwgW107XG5cbiAgICAvLyBSZW1pbmRlcjogdGhpcyBhbHdheXMgbmVlZHMgdG8gYmUgYWZ0ZXIgaW5pdGlhbGl6aW5nIHRoaXMubmFtZWRGdW5jdGlvbnNcbiAgICAvLyBhbmQgdGhpcy5uYW1lZFN0cmVhbXNcbiAgICB0aGlzLnRva2VuTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QubWFwKCh7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBUb2tlbkNsYXNzKHRoaXMsIGFyZ0xpc3QpO1xuICAgIH0pO1xuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy50b2tlbkxpc3RcbiAgICB0aGlzLldyYXBwZXJzID0gdGhpcy5nZXRXcmFwcGVyTGlzdCgpO1xuICB9XG5cbiAgZ2V0V3JhcHBlckxpc3QgKCkge1xuICAgIC8vIExvb2sgdXAgd2hpY2gsIGlmIGFueSwgY2xhc3NlcyBkZXNjcmliZSB0aGUgcmVzdWx0IG9mIGVhY2ggdG9rZW4sIHNvIHRoYXRcbiAgICAvLyB3ZSBjYW4gd3JhcCBpdGVtcyBhcHByb3ByaWF0ZWx5OlxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5tYXAoKHRva2VuLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKGluZGV4ID09PSB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxICYmIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MpIHtcbiAgICAgICAgLy8gSWYgdGhpcyBzdHJlYW0gd2FzIHN0YXJ0ZWQgZnJvbSBhIGNsYXNzLCB3ZSBhbHJlYWR5IGtub3cgd2Ugc2hvdWxkXG4gICAgICAgIC8vIHVzZSB0aGF0IGNsYXNzJ3Mgd3JhcHBlciBmb3IgdGhlIGxhc3QgdG9rZW5cbiAgICAgICAgcmV0dXJuIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MuV3JhcHBlcjtcbiAgICAgIH1cbiAgICAgIC8vIEZpbmQgYSBjbGFzcyB0aGF0IGRlc2NyaWJlcyBleGFjdGx5IGVhY2ggc2VyaWVzIG9mIHRva2Vuc1xuICAgICAgY29uc3QgbG9jYWxUb2tlbkxpc3QgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCBpbmRleCArIDEpO1xuICAgICAgY29uc3QgcG90ZW50aWFsV3JhcHBlcnMgPSBPYmplY3QudmFsdWVzKHRoaXMubXVyZS5jbGFzc2VzKVxuICAgICAgICAuZmlsdGVyKGNsYXNzT2JqID0+IHtcbiAgICAgICAgICBpZiAoIWNsYXNzT2JqLnRva2VuQ2xhc3NMaXN0Lmxlbmd0aCAhPT0gbG9jYWxUb2tlbkxpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBsb2NhbFRva2VuTGlzdC5ldmVyeSgobG9jYWxUb2tlbiwgbG9jYWxJbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdG9rZW5DbGFzc1NwZWMgPSBjbGFzc09iai50b2tlbkNsYXNzTGlzdFtsb2NhbEluZGV4XTtcbiAgICAgICAgICAgIHJldHVybiBsb2NhbFRva2VuIGluc3RhbmNlb2YgdG9rZW5DbGFzc1NwZWMuVG9rZW5DbGFzcyAmJlxuICAgICAgICAgICAgICB0b2tlbi5pc1N1YnNldE9mKHRva2VuQ2xhc3NTcGVjLmFyZ0xpc3QpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgLy8gTm8gY2xhc3NlcyBkZXNjcmliZSB0aGlzIHNlcmllcyBvZiB0b2tlbnMsIHNvIHVzZSB0aGUgZ2VuZXJpYyB3cmFwcGVyXG4gICAgICAgIHJldHVybiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgTXVsdGlwbGUgY2xhc3NlcyBkZXNjcmliZSB0aGUgc2FtZSBpdGVtISBBcmJpdHJhcmlseSBjaG9vc2luZyBvbmUuLi5gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcG90ZW50aWFsV3JhcHBlcnNbMF0uV3JhcHBlcjtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmpvaW4oJycpO1xuICB9XG5cbiAgZm9yayAoc2VsZWN0b3IpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICBuYW1lZEZ1bmN0aW9uczogdGhpcy5uYW1lZEZ1bmN0aW9ucyxcbiAgICAgIG5hbWVkU3RyZWFtczogdGhpcy5uYW1lZFN0cmVhbXMsXG4gICAgICB0b2tlbkNsYXNzTGlzdDogdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3Ioc2VsZWN0b3IpLFxuICAgICAgbGF1bmNoZWRGcm9tQ2xhc3M6IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MsXG4gICAgICBpbmRleGVzOiB0aGlzLmluZGV4ZXNcbiAgICB9KTtcbiAgfVxuXG4gIGV4dGVuZCAoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm5hbWVkRnVuY3Rpb25zLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICBvcHRpb25zLm5hbWVkU3RyZWFtcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMubmFtZWRTdHJlYW1zLCBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fSk7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMudG9rZW5DbGFzc0xpc3QuY29uY2F0KFt7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfV0pO1xuICAgIG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgPSBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzIHx8IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3M7XG4gICAgb3B0aW9ucy5pbmRleGVzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5pbmRleGVzLCBvcHRpb25zLmluZGV4ZXMgfHwge30pO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG5cbiAgYXN5bmMgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSwgaGFzaGVzID0ge30gfSkge1xuICAgIGxldCB3cmFwcGVySW5kZXggPSAwO1xuICAgIGxldCB0ZW1wID0gd3JhcHBlZFBhcmVudDtcbiAgICB3aGlsZSAodGVtcCAhPT0gbnVsbCkge1xuICAgICAgd3JhcHBlckluZGV4ICs9IDE7XG4gICAgICB0ZW1wID0gdGVtcC53cmFwcGVkUGFyZW50O1xuICAgIH1cbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IG5ldyB0aGlzLldyYXBwZXJzW3dyYXBwZXJJbmRleF0oeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyhoYXNoZXMpLnJlZHVjZSgocHJvbWlzZUxpc3QsIFtoYXNoRnVuY3Rpb25OYW1lLCBoYXNoXSkgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmdldEluZGV4KGhhc2hGdW5jdGlvbk5hbWUpO1xuICAgICAgaWYgKCFpbmRleC5jb21wbGV0ZSkge1xuICAgICAgICByZXR1cm4gcHJvbWlzZUxpc3QuY29uY2F0KFsgaW5kZXguYWRkVmFsdWUoaGFzaCwgd3JhcHBlZEl0ZW0pIF0pO1xuICAgICAgfVxuICAgIH0sIFtdKSk7XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG5cbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICBjb25zdCBsYXN0VG9rZW4gPSB0aGlzLnRva2VuTGlzdFt0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxXTtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50b2tlbkxpc3Quc2xpY2UoMCwgdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSk7XG4gICAgeWllbGQgKiBhd2FpdCBsYXN0VG9rZW4uaXRlcmF0ZSh0ZW1wKTtcbiAgfVxuXG4gIGdldEluZGV4IChoYXNoRnVuY3Rpb25OYW1lKSB7XG4gICAgaWYgKCF0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV0pIHtcbiAgICAgIC8vIFRPRE86IGlmIHVzaW5nIG5vZGUuanMsIHN0YXJ0IHdpdGggZXh0ZXJuYWwgLyBtb3JlIHNjYWxhYmxlIGluZGV4ZXNcbiAgICAgIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXSA9IG5ldyB0aGlzLm11cmUuSU5ERVhFUy5Jbk1lbW9yeUluZGV4KCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV07XG4gIH1cblxuICBhc3luYyBidWlsZEluZGV4IChoYXNoRnVuY3Rpb25OYW1lKSB7XG4gICAgY29uc3QgaGFzaEZ1bmN0aW9uID0gdGhpcy5uYW1lZEZ1bmN0aW9uc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgICBpZiAoIWhhc2hGdW5jdGlvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2hhc2hGdW5jdGlvbk5hbWV9YCk7XG4gICAgfVxuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJbmRleChoYXNoRnVuY3Rpb25OYW1lKTtcbiAgICBpZiAoaW5kZXguY29tcGxldGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIGhhc2hGdW5jdGlvbih3cmFwcGVkSXRlbSkpIHtcbiAgICAgICAgaW5kZXguYWRkVmFsdWUoaGFzaCwgd3JhcHBlZEl0ZW0pO1xuICAgICAgfVxuICAgIH1cbiAgICBpbmRleC5jb21wbGV0ZSA9IHRydWU7XG4gIH1cblxuICBhc3luYyAqIHNhbXBsZSAoeyBsaW1pdCA9IDEwLCByZWJ1aWxkSW5kZXhlcyA9IGZhbHNlIH0pIHtcbiAgICAvLyBCZWZvcmUgd2Ugc3RhcnQsIGNsZWFuIG91dCBhbnkgb2xkIGluZGV4ZXMgdGhhdCB3ZXJlIG5ldmVyIGZpbmlzaGVkXG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5pbmRleGVzKS5mb3JFYWNoKChbaGFzaEZ1bmN0aW9uTmFtZSwgaW5kZXhdKSA9PiB7XG4gICAgICBpZiAocmVidWlsZEluZGV4ZXMgfHwgIWluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV07XG4gICAgICB9XG4gICAgfSk7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGUoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIC8vIFdlIGFjdHVhbGx5IGZpbmlzaGVkIGEgZnVsbCBwYXNzOyBmbGFnIGFsbCBvZiBvdXIgaW5kZXhlcyBhcyBjb21wbGV0ZVxuICAgICAgICBPYmplY3QudmFsdWVzKHRoaXMuaW5kZXhlcykuZm9yRWFjaChpbmRleCA9PiB7XG4gICAgICAgICAgaW5kZXguY29tcGxldGUgPSB0cnVlO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RyZWFtO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEJhc2VUb2tlbiBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zdHJlYW0gPSBzdHJlYW07XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIC8vIFRoZSBzdHJpbmcgdmVyc2lvbiBvZiBtb3N0IHRva2VucyBjYW4ganVzdCBiZSBkZXJpdmVkIGZyb20gdGhlIGNsYXNzIHR5cGVcbiAgICByZXR1cm4gYC4ke3RoaXMudHlwZS50b0xvd2VyQ2FzZSgpfSgpYDtcbiAgfVxuICBpc1N1YlNldE9mICgpIHtcbiAgICAvLyBCeSBkZWZhdWx0ICh3aXRob3V0IGFueSBhcmd1bWVudHMpLCB0b2tlbnMgb2YgdGhlIHNhbWUgY2xhc3MgYXJlIHN1YnNldHNcbiAgICAvLyBvZiBlYWNoIG90aGVyXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgVGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZVBhcmVudCAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUb2tlbiA9IGFuY2VzdG9yVG9rZW5zW2FuY2VzdG9yVG9rZW5zLmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRlbXAgPSBhbmNlc3RvclRva2Vucy5zbGljZSgwLCBhbmNlc3RvclRva2Vucy5sZW5ndGggLSAxKTtcbiAgICBsZXQgeWllbGRlZFNvbWV0aGluZyA9IGZhbHNlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUb2tlbi5pdGVyYXRlKHRlbXApKSB7XG4gICAgICB5aWVsZGVkU29tZXRoaW5nID0gdHJ1ZTtcbiAgICAgIHlpZWxkIHdyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGlmICgheWllbGRlZFNvbWV0aGluZyAmJiB0aGlzLm11cmUuZGVidWcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFRva2VuIHlpZWxkZWQgbm8gcmVzdWx0czogJHtwYXJlbnRUb2tlbn1gKTtcbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXNlVG9rZW4sICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRva2VuLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQmFzZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEVtcHR5VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIC8vIHlpZWxkIG5vdGhpbmdcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGBlbXB0eWA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEVtcHR5VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQ6IG51bGwsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IHRoaXMuc3RyZWFtLm11cmUucm9vdFxuICAgIH0pO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYHJvb3RgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgS2V5c1Rva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgYXJnTGlzdCwgeyBtYXRjaEFsbCwga2V5cywgcmFuZ2VzIH0gPSB7fSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKGtleXMgfHwgcmFuZ2VzKSB7XG4gICAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgICAgdGhpcy5yYW5nZXMgPSByYW5nZXM7XG4gICAgfSBlbHNlIGlmICgoYXJnTGlzdCAmJiBhcmdMaXN0Lmxlbmd0aCA9PT0gMSAmJiBhcmdMaXN0WzBdID09PSB1bmRlZmluZWQpIHx8IG1hdGNoQWxsKSB7XG4gICAgICB0aGlzLm1hdGNoQWxsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnTGlzdC5mb3JFYWNoKGFyZyA9PiB7XG4gICAgICAgIGxldCB0ZW1wID0gYXJnLm1hdGNoKC8oXFxkKyktKFtcXGTiiJ5dKykvKTtcbiAgICAgICAgaWYgKHRlbXAgJiYgdGVtcFsyXSA9PT0gJ+KInicpIHtcbiAgICAgICAgICB0ZW1wWzJdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IHRlbXAgPyB0ZW1wLm1hcChkID0+IGQucGFyc2VJbnQoZCkpIDogbnVsbDtcbiAgICAgICAgaWYgKHRlbXAgJiYgIWlzTmFOKHRlbXBbMV0pICYmICFpc05hTih0ZW1wWzJdKSkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSB0ZW1wWzFdOyBpIDw9IHRlbXBbMl07IGkrKykge1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IHRlbXBbMV0sIGhpZ2g6IHRlbXBbMl0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gYXJnLm1hdGNoKC8nKC4qKScvKTtcbiAgICAgICAgdGVtcCA9IHRlbXAgJiYgdGVtcFsxXSA/IHRlbXBbMV0gOiBhcmc7XG4gICAgICAgIGxldCBudW0gPSBOdW1iZXIodGVtcCk7XG4gICAgICAgIGlmIChpc05hTihudW0pIHx8IG51bSAhPT0gcGFyc2VJbnQodGVtcCkpIHsgLy8gbGVhdmUgbm9uLWludGVnZXIgbnVtYmVycyBhcyBzdHJpbmdzXG4gICAgICAgICAgdGhpcy5rZXlzID0gdGhpcy5rZXlzIHx8IHt9O1xuICAgICAgICAgIHRoaXMua2V5c1t0ZW1wXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiBudW0sIGhpZ2g6IG51bSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBCYWQgdG9rZW4ga2V5KHMpIC8gcmFuZ2Uocyk6ICR7SlNPTi5zdHJpbmdpZnkoYXJnTGlzdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLmNvbnNvbGlkYXRlUmFuZ2VzKHRoaXMucmFuZ2VzKTtcbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdHNOb3RoaW5nICgpIHtcbiAgICByZXR1cm4gIXRoaXMubWF0Y2hBbGwgJiYgIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXM7XG4gIH1cbiAgY29uc29saWRhdGVSYW5nZXMgKHJhbmdlcykge1xuICAgIC8vIE1lcmdlIGFueSBvdmVybGFwcGluZyByYW5nZXNcbiAgICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcbiAgICBjb25zdCB0ZW1wID0gcmFuZ2VzLnNvcnQoKGEsIGIpID0+IGEubG93IC0gYi5sb3cpO1xuICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFjdXJyZW50UmFuZ2UpIHtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH0gZWxzZSBpZiAodGVtcFtpXS5sb3cgPD0gY3VycmVudFJhbmdlLmhpZ2gpIHtcbiAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSB0ZW1wW2ldLmhpZ2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgICAvLyBDb3JuZXIgY2FzZTogYWRkIHRoZSBsYXN0IHJhbmdlXG4gICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UmFuZ2VzLmxlbmd0aCA+IDAgPyBuZXdSYW5nZXMgOiB1bmRlZmluZWQ7XG4gIH1cbiAgZGlmZmVyZW5jZSAob3RoZXJUb2tlbikge1xuICAgIC8vIENvbXB1dGUgd2hhdCBpcyBsZWZ0IG9mIHRoaXMgYWZ0ZXIgc3VidHJhY3Rpbmcgb3V0IGV2ZXJ5dGhpbmcgaW4gb3RoZXJUb2tlblxuICAgIGlmICghKG90aGVyVG9rZW4gaW5zdGFuY2VvZiBLZXlzVG9rZW4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNvbXB1dGUgdGhlIGRpZmZlcmVuY2Ugb2YgdHdvIGRpZmZlcmVudCB0b2tlbiB0eXBlc2ApO1xuICAgIH0gZWxzZSBpZiAob3RoZXJUb2tlbi5tYXRjaEFsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEluYWNjdXJhdGUgZGlmZmVyZW5jZSBjb21wdXRlZCEgVE9ETzogbmVlZCB0byBmaWd1cmUgb3V0IGhvdyB0byBpbnZlcnQgY2F0ZWdvcmljYWwga2V5cyFgKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdLZXlzID0ge307XG4gICAgICBmb3IgKGxldCBrZXkgaW4gKHRoaXMua2V5cyB8fCB7fSkpIHtcbiAgICAgICAgaWYgKCFvdGhlclRva2VuLmtleXMgfHwgIW90aGVyVG9rZW4ua2V5c1trZXldKSB7XG4gICAgICAgICAgbmV3S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1JhbmdlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICAgIGlmIChvdGhlclRva2VuLnJhbmdlcykge1xuICAgICAgICAgIGxldCBhbGxQb2ludHMgPSB0aGlzLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgYWxsUG9pbnRzID0gYWxsUG9pbnRzLmNvbmNhdChvdGhlclRva2VuLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSkpLnNvcnQoKTtcbiAgICAgICAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbFBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IHsgbG93OiBhbGxQb2ludHNbaV0udmFsdWUgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS52YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5leGNsdWRlKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0ubG93IC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5sb3cgPSBhbGxQb2ludHNbaV0uaGlnaCArIDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3UmFuZ2VzID0gdGhpcy5yYW5nZXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgS2V5c1Rva2VuKHRoaXMubXVyZSwgbnVsbCwgeyBrZXlzOiBuZXdLZXlzLCByYW5nZXM6IG5ld1JhbmdlcyB9KTtcbiAgICB9XG4gIH1cbiAgaXNTdWJTZXRPZiAoYXJnTGlzdCkge1xuICAgIGNvbnN0IG90aGVyVG9rZW4gPSBuZXcgS2V5c1Rva2VuKHRoaXMuc3RyZWFtLCBhcmdMaXN0KTtcbiAgICBjb25zdCBkaWZmID0gb3RoZXJUb2tlbi5kaWZmZXJlbmNlKHRoaXMpO1xuICAgIHJldHVybiBkaWZmID09PSBudWxsIHx8IGRpZmYuc2VsZWN0c05vdGhpbmc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7IHJldHVybiAnLmtleXMoKSc7IH1cbiAgICByZXR1cm4gJy5rZXlzKCcgKyAodGhpcy5yYW5nZXMgfHwgW10pLm1hcCgoe2xvdywgaGlnaH0pID0+IHtcbiAgICAgIHJldHVybiBsb3cgPT09IGhpZ2ggPyBsb3cgOiBgJHtsb3d9LSR7aGlnaH1gO1xuICAgIH0pLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLmtleXMgfHwge30pLm1hcChrZXkgPT4gYCcke2tleX0nYCkpXG4gICAgICAuam9pbignLCcpICsgJyknO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEtleXNUb2tlbiBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICAgIGZvciAobGV0IGtleSBpbiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0pIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxldCB7bG93LCBoaWdofSBvZiB0aGlzLnJhbmdlcyB8fCBbXSkge1xuICAgICAgICAgIGxvdyA9IE1hdGgubWF4KDAsIGxvdyk7XG4gICAgICAgICAgaGlnaCA9IE1hdGgubWluKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5sZW5ndGggLSAxLCBoaWdoKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gbG93OyBpIDw9IGhpZ2g7IGkrKykge1xuICAgICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgcmF3SXRlbTogaVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMua2V5cyB8fCB7fSkge1xuICAgICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW0uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgS2V5c1Rva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFZhbHVlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgY29uc3Qga2V5ID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXlUeXBlID0gdHlwZW9mIGtleTtcbiAgICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCAoa2V5VHlwZSAhPT0gJ3N0cmluZycgJiYga2V5VHlwZSAhPT0gJ251bWJlcicpKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEV2YWx1YXRlVG9rZW4gaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdTdHJlYW07XG4gICAgICB0cnkge1xuICAgICAgICBuZXdTdHJlYW0gPSB0aGlzLnN0cmVhbS5mb3JrKHdyYXBwZWRQYXJlbnQucmF3SXRlbSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnIHx8ICEoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpKSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCAqIGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFdmFsdWF0ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIE1hcFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBnZW5lcmF0b3IgPSAnaWRlbnRpdHknIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2dlbmVyYXRvcl0pIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtnZW5lcmF0b3J9YCk7XG4gICAgfVxuICAgIHRoaXMuZ2VuZXJhdG9yID0gZ2VuZXJhdG9yO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5tYXAoJHt0aGlzLmdlbmVyYXRvcn0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiBnZW5lcmF0b3IgPT09IHRoaXMuZ2VuZXJhdG9yO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZ2VuZXJhdG9yXSh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1hcFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFByb21vdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIG1hcCwgaGFzaCwgcmVkdWNlSW5zdGFuY2VzIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICB0aGlzLmhhc2ggPSBoYXNoO1xuICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID0gcmVkdWNlSW5zdGFuY2VzO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5wcm9tb3RlKCR7dGhpcy5tYXB9LCAke3RoaXMuaGFzaH0sICR7dGhpcy5yZWR1Y2VJbnN0YW5jZXN9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHJldHVybiB0aGlzLm1hcCA9PT0gbWFwICYmXG4gICAgICB0aGlzLmhhc2ggPT09IGhhc2ggJiZcbiAgICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID09PSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBjb25zdCBtYXBGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMubWFwXTtcbiAgICAgIGNvbnN0IGhhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuaGFzaF07XG4gICAgICBjb25zdCByZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMucmVkdWNlSW5zdGFuY2VzXTtcbiAgICAgIGNvbnN0IGhhc2hJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMuaGFzaCk7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgbWFwRnVuY3Rpb24od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgICAgY29uc3QgaGFzaCA9IGhhc2hGdW5jdGlvbihtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgbGV0IG9yaWdpbmFsV3JhcHBlZEl0ZW0gPSAoYXdhaXQgaGFzaEluZGV4LmdldFZhbHVlTGlzdChoYXNoKSlbMF07XG4gICAgICAgIGlmIChvcmlnaW5hbFdyYXBwZWRJdGVtKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVkdWNlSW5zdGFuY2VzICE9PSAnbm9vcCcpIHtcbiAgICAgICAgICAgIHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgaGFzaGVzID0ge307XG4gICAgICAgICAgaGFzaGVzW3RoaXMuaGFzaF0gPSBoYXNoO1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbSxcbiAgICAgICAgICAgIGhhc2hlc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBKb2luVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2RlZmF1bHRGaW5pc2gnLCBudGhKb2luID0gMCBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBmb3IgKGNvbnN0IGZ1bmMgb2YgWyB0aGlzSGFzaCwgZmluaXNoIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHRlbXAgPSBzdHJlYW0ubmFtZWRTdHJlYW1zW290aGVyU3RyZWFtXTtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBzdHJlYW06ICR7b3RoZXJTdHJlYW19YCk7XG4gICAgfVxuICAgIC8vIFJlcXVpcmUgb3RoZXJIYXNoIG9uIHRoZSBvdGhlciBzdHJlYW0sIG9yIGNvcHkgb3VycyBvdmVyIGlmIGl0IGlzbid0XG4gICAgLy8gYWxyZWFkeSBkZWZpbmVkXG4gICAgaWYgKCF0ZW1wLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIGhhc2ggZnVuY3Rpb24gb24gZWl0aGVyIHN0cmVhbTogJHtvdGhlckhhc2h9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZW1wLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0gPSBzdHJlYW0ubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLm90aGVyU3RyZWFtID0gb3RoZXJTdHJlYW07XG4gICAgdGhpcy50aGlzSGFzaCA9IHRoaXNIYXNoO1xuICAgIHRoaXMub3RoZXJIYXNoID0gb3RoZXJIYXNoO1xuICAgIHRoaXMuZmluaXNoID0gZmluaXNoO1xuICAgIHRoaXMubnRoSm9pbiA9IG50aEpvaW47XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLmpvaW4oJHt0aGlzLm90aGVyU3RyZWFtfSwgJHt0aGlzLnRoaXNIYXNofSwgJHt0aGlzLm90aGVySGFzaH0sICR7dGhpcy5maW5pc2h9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBvdGhlclN0cmVhbSwgdGhpc0hhc2ggPSAna2V5Jywgb3RoZXJIYXNoID0gJ2tleScsIGZpbmlzaCA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiB0aGlzLm90aGVyU3RyZWFtID09PSBvdGhlclN0cmVhbSAmJlxuICAgICAgdGhpcy50aGlzSGFzaCA9PT0gdGhpc0hhc2ggJiZcbiAgICAgIHRoaXMub3RoZXJIYXNoID09PSBvdGhlckhhc2ggJiZcbiAgICAgIHRoaXMuZmluaXNoID09PSBmaW5pc2g7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IG90aGVyU3RyZWFtID0gdGhpcy5zdHJlYW0ubmFtZWRTdHJlYW1zW3RoaXMub3RoZXJTdHJlYW1dO1xuICAgIGNvbnN0IHRoaXNIYXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLnRoaXNIYXNoXTtcbiAgICBjb25zdCBvdGhlckhhc2hGdW5jdGlvbiA9IG90aGVyU3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMub3RoZXJIYXNoXTtcbiAgICBjb25zdCBmaW5pc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZmluaXNoXTtcblxuICAgIC8vIGNvbnN0IHRoaXNJdGVyYXRvciA9IHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2Vucyk7XG4gICAgLy8gY29uc3Qgb3RoZXJJdGVyYXRvciA9IG90aGVyU3RyZWFtLml0ZXJhdGUoKTtcblxuICAgIGNvbnN0IHRoaXNJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMudGhpc0hhc2gpO1xuICAgIGNvbnN0IG90aGVySW5kZXggPSBvdGhlclN0cmVhbS5nZXRJbmRleCh0aGlzLm90aGVySGFzaCk7XG5cbiAgICBpZiAodGhpc0luZGV4LmNvbXBsZXRlKSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBCZXN0IG9mIGFsbCB3b3JsZHM7IHdlIGNhbiBqdXN0IGpvaW4gdGhlIGluZGV4ZXNcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB7IGhhc2gsIHZhbHVlTGlzdCB9IG9mIHRoaXNJbmRleC5pdGVyRW50cmllcygpKSB7XG4gICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdmFsdWVMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIHRoZSBvdGhlciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIG91ciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJTdHJlYW0uaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIG90aGVySGFzaEZ1bmN0aW9uKG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAvLyBBZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4OlxuICAgICAgICAgICAgYXdhaXQgb3RoZXJJbmRleC5hZGRWYWx1ZShoYXNoLCBvdGhlcldyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBOZWVkIHRvIGl0ZXJhdGUgb3VyIGl0ZW1zLCBhbmQgdGFrZSBhZHZhbnRhZ2Ugb2YgdGhlIG90aGVyIGNvbXBsZXRlXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgYXdhaXQgdGhpc0luZGV4LmFkZFZhbHVlKGhhc2gsIHRoaXNXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWl0aGVyIHN0cmVhbSBpcyBmdWxseSBpbmRleGVkOyBmb3IgbW9yZSBkaXN0cmlidXRlZCBzYW1wbGluZywgZ3JhYlxuICAgICAgICAvLyBvbmUgaXRlbSBmcm9tIGVhY2ggc3RyZWFtIGF0IGEgdGltZSwgYW5kIHVzZSB0aGUgcGFydGlhbCBpbmRleGVzXG4gICAgICAgIGNvbnN0IHRoaXNJdGVyYXRvciA9IHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2Vucyk7XG4gICAgICAgIGxldCB0aGlzSXNEb25lID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IG90aGVySXRlcmF0b3IgPSBvdGhlclN0cmVhbS5pdGVyYXRlKCk7XG4gICAgICAgIGxldCBvdGhlcklzRG9uZSA9IGZhbHNlO1xuXG4gICAgICAgIHdoaWxlICghdGhpc0lzRG9uZSB8fCAhb3RoZXJJc0RvbmUpIHtcbiAgICAgICAgICAvLyBUYWtlIG9uZSBzYW1wbGUgZnJvbSB0aGlzIHN0cmVhbVxuICAgICAgICAgIGxldCB0ZW1wID0gYXdhaXQgdGhpc0l0ZXJhdG9yLm5leHQoKTtcbiAgICAgICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgICAgICB0aGlzSXNEb25lID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdGhpc1dyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiB0aGlzSGFzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgLy8gYWRkIHRoaXNXcmFwcGVkSXRlbSB0byB0aGlzSW5kZXhcbiAgICAgICAgICAgICAgdGhpc0luZGV4LmFkZFZhbHVlKGhhc2gsIHRoaXNXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBOb3cgZm9yIGEgc2FtcGxlIGZyb20gdGhlIG90aGVyIHN0cmVhbVxuICAgICAgICAgIHRlbXAgPSBhd2FpdCBvdGhlckl0ZXJhdG9yLm5leHQoKTtcbiAgICAgICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgICAgICBvdGhlcklzRG9uZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gPSBhd2FpdCB0ZW1wLnZhbHVlO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIG90aGVySGFzaEZ1bmN0aW9uKG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgIC8vIGFkZCBvdGhlcldyYXBwZWRJdGVtIHRvIG90aGVySW5kZXhcbiAgICAgICAgICAgICAgb3RoZXJJbmRleC5hZGRWYWx1ZShoYXNoLCBvdGhlcldyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgICAgY29uc3QgdGhpc0xpc3QgPSBhd2FpdCB0aGlzSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzTGlzdCkge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEpvaW5Ub2tlbjtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFN0cmVhbSBmcm9tICcuLi9TdHJlYW0uanMnO1xuXG5jb25zdCBBU1RFUklTS1MgPSB7XG4gICdldmFsdWF0ZSc6ICfihqwnLFxuICAnam9pbic6ICfiqK8nLFxuICAnbWFwJzogJ+KGpicsXG4gICdwcm9tb3RlJzogJ+KGkScsXG4gICd2YWx1ZSc6ICfihpInXG59O1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm11cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy5jbGFzc0lkID0gb3B0aW9ucy5jbGFzc0lkO1xuICAgIHRoaXMuX3NlbGVjdG9yID0gb3B0aW9ucy5zZWxlY3RvcjtcbiAgICB0aGlzLmN1c3RvbUNsYXNzTmFtZSA9IG9wdGlvbnMuY3VzdG9tQ2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCA9IG9wdGlvbnMuY3VzdG9tTmFtZVRva2VuSW5kZXggfHwgbnVsbDtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgdGhpcy5pbmRleGVzID0gb3B0aW9ucy5pbmRleGVzIHx8IHt9O1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgZm9yIChsZXQgW2Z1bmNOYW1lLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm5hbWVkRnVuY3Rpb25zKSkge1xuICAgICAgaWYgKHR5cGVvZiBmdW5jID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IG5ldyBGdW5jdGlvbihgcmV0dXJuICR7ZnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gICAgICB9XG4gICAgfVxuICB9XG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NlbGVjdG9yO1xuICB9XG4gIGdldCB0b2tlbkNsYXNzTGlzdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKHRoaXMuc2VsZWN0b3IpO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBjbGFzc1R5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZSxcbiAgICAgIHNlbGVjdG9yOiB0aGlzLl9zZWxlY3RvcixcbiAgICAgIGN1c3RvbUNsYXNzTmFtZTogdGhpcy5jdXN0b21DbGFzc05hbWUsXG4gICAgICBjdXN0b21OYW1lVG9rZW5JbmRleDogdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCxcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIGluZGV4ZXM6IHt9LFxuICAgICAgbmFtZWRGdW5jdGlvbnM6IHt9XG4gICAgfTtcbiAgICBmb3IgKGxldCBbZnVuY05hbWUsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubmFtZWRGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gZnVuYy50b1N0cmluZygpO1xuICAgIH1cbiAgICBhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyh0aGlzLmluZGV4ZXMpLm1hcChhc3luYyAoW2Z1bmNOYW1lLCBpbmRleF0pID0+IHtcbiAgICAgIGlmIChpbmRleC5jb21wbGV0ZSkge1xuICAgICAgICByZXN1bHQuaW5kZXhlc1tmdW5jTmFtZV0gPSBhd2FpdCBpbmRleC50b1Jhd09iamVjdCgpO1xuICAgICAgfVxuICAgIH0pKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHdyYXAgKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMuV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBhc3luYyBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSB2YWx1ZSkge1xuICAgICAgdGhpcy5jdXN0b21DbGFzc05hbWUgPSB2YWx1ZTtcbiAgICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPSB0aGlzLnNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKS5sZW5ndGg7XG4gICAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICB9XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gbnVsbCAmJlxuICAgICAgdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCA9PT0gdGhpcy5zZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZykubGVuZ3RoO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIGNvbnN0IHNlbGVjdG9yID0gdGhpcy5zZWxlY3RvcjtcbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgIGZvciAobGV0IGkgPSB0b2tlblN0cmluZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmICh0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gbnVsbCAmJiBpIDw9IHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VzdG9tQ2xhc3NOYW1lICsgcmVzdWx0O1xuICAgICAgfVxuICAgICAgY29uc3QgdGVtcCA9IHRva2VuU3RyaW5nc1tpXS5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKHRlbXBbMV0gPT09ICdrZXlzJyB8fCB0ZW1wWzFdID09PSAndmFsdWVzJykge1xuICAgICAgICBpZiAodGVtcFsyXSA9PT0gJycpIHtcbiAgICAgICAgICByZXN1bHQgPSAnKicgKyByZXN1bHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0ID0gdGVtcFsyXS5yZXBsYWNlKC8nKFteJ10qKScvLCAnJDEnKSArIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0ID0gQVNURVJJU0tTW3RlbXBbMV1dICsgcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gKHNlbGVjdG9yLnN0YXJ0c1dpdGgoJ2VtcHR5JykgPyAn4oiFJyA6ICcnKSArIHJlc3VsdDtcbiAgfVxuICBzZXROYW1lZEZ1bmN0aW9uIChmdW5jTmFtZSwgZnVuYykge1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gZnVuYztcbiAgfVxuICBwb3B1bGF0ZVN0cmVhbU9wdGlvbnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdDtcbiAgICBvcHRpb25zLm5hbWVkRnVuY3Rpb25zID0gdGhpcy5uYW1lZEZ1bmN0aW9ucztcbiAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gdGhpcztcbiAgICBvcHRpb25zLmluZGV4ZXMgPSB0aGlzLmluZGV4ZXM7XG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cbiAgZ2V0U3RyZWFtIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAob3B0aW9ucy5yZXNldCB8fCAhdGhpcy5fc3RyZWFtKSB7XG4gICAgICB0aGlzLl9zdHJlYW0gPSBuZXcgU3RyZWFtKHRoaXMucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbTtcbiAgfVxuICBpc1N1cGVyU2V0T2ZUb2tlbkxpc3QgKHRva2VuTGlzdCkge1xuICAgIGlmICh0b2tlbkxpc3QubGVuZ3RoICE9PSB0aGlzLnRva2VuTGlzdC5sZW5ndGgpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmV2ZXJ5KCh0b2tlbiwgaSkgPT4gdG9rZW4uaXNTdXBlclNldE9mKHRva2VuTGlzdFtpXSkpO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhd2FpdCB0aGlzLnRvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF0gPSBuZXcgdGhpcy5tdXJlLkNMQVNTRVMuTm9kZUNsYXNzKG9wdGlvbnMpO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhd2FpdCB0aGlzLnRvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF0gPSBuZXcgdGhpcy5tdXJlLkNMQVNTRVMuRWRnZUNsYXNzKG9wdGlvbnMpO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICB9XG4gIGFzeW5jIGFnZ3JlZ2F0ZSAoaGFzaCwgcmVkdWNlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZXhwYW5kIChtYXApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBmaWx0ZXIgKGZpbHRlcikge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jICogc3BsaXQgKGhhc2gpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBkZWxldGUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcjtcbiAgICB0aGlzLmVkZ2VDb25uZWN0aW9ucyA9IG9wdGlvbnMuZWRnZUNvbm5lY3Rpb25zIHx8IHt9O1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICAvLyBUT0RPOiBhIGJhYmVsIGJ1ZyAoaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8zOTMwKVxuICAgIC8vIHByZXZlbnRzIGBhd2FpdCBzdXBlcmA7IHRoaXMgaXMgYSB3b3JrYXJvdW5kOlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEdlbmVyaWNDbGFzcy5wcm90b3R5cGUudG9SYXdPYmplY3QuY2FsbCh0aGlzKTtcbiAgICAvLyBUT0RPOiBuZWVkIHRvIGRlZXAgY29weSBlZGdlQ29ubmVjdGlvbnM/XG4gICAgcmVzdWx0LmVkZ2VDb25uZWN0aW9ucyA9IHRoaXMuZWRnZUNvbm5lY3Rpb25zO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgdGhpc0hhc2hOYW1lLCBvdGhlckhhc2hOYW1lIH0pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyO1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcblxuICAgIGlmICghdGhpcy5fc2VsZWN0b3IpIHtcbiAgICAgIGlmICghc291cmNlQ2xhc3MgfHwgIXRhcmdldENsYXNzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFydGlhbCBjb25uZWN0aW9ucyB3aXRob3V0IGFuIGVkZ2UgdGFibGUgc2hvdWxkIG5ldmVyIGhhcHBlbmApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm8gZWRnZSB0YWJsZSAoc2ltcGxlIGpvaW4gYmV0d2VlbiB0d28gbm9kZXMpXG4gICAgICAgIGNvbnN0IHNvdXJjZUhhc2ggPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXS5ub2RlSGFzaE5hbWU7XG4gICAgICAgIGNvbnN0IHRhcmdldEhhc2ggPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXS5ub2RlSGFzaE5hbWU7XG4gICAgICAgIHJldHVybiBzb3VyY2VDbGFzcy5zZWxlY3RvciArIGAuam9pbih0YXJnZXQsICR7c291cmNlSGFzaH0sICR7dGFyZ2V0SGFzaH0sIGRlZmF1bHRGaW5pc2gpYDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHJlc3VsdCA9IHRoaXMuX3NlbGVjdG9yO1xuICAgICAgaWYgKCFzb3VyY2VDbGFzcykge1xuICAgICAgICBpZiAoIXRhcmdldENsYXNzKSB7XG4gICAgICAgICAgLy8gTm8gY29ubmVjdGlvbnMgeWV0OyBqdXN0IHlpZWxkIHRoZSByYXcgZWRnZSB0YWJsZVxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gUGFydGlhbCBlZGdlLXRhcmdldCBjb25uZWN0aW9uc1xuICAgICAgICAgIGNvbnN0IHsgZWRnZUhhc2hOYW1lLCBub2RlSGFzaE5hbWUgfSA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICAgIHJldHVybiByZXN1bHQgKyBgLmpvaW4odGFyZ2V0LCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaClgO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCF0YXJnZXRDbGFzcykge1xuICAgICAgICAvLyBQYXJ0aWFsIHNvdXJjZS1lZGdlIGNvbm5lY3Rpb25zXG4gICAgICAgIGNvbnN0IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICByZXR1cm4gcmVzdWx0ICsgYC5qb2luKHNvdXJjZSwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gpYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEZ1bGwgY29ubmVjdGlvbnNcbiAgICAgICAgbGV0IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICByZXN1bHQgKz0gYC5qb2luKHNvdXJjZSwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gpYDtcbiAgICAgICAgKHsgZWRnZUhhc2hOYW1lLCBub2RlSGFzaE5hbWUgfSA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdKTtcbiAgICAgICAgcmVzdWx0ICs9IGAuam9pbih0YXJnZXQsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoLCAxKWA7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHBvcHVsYXRlU3RyZWFtT3B0aW9ucyAob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBvcHRpb25zLm5hbWVkU3RyZWFtcyA9IHt9O1xuICAgIGlmICghdGhpcy5fc2VsZWN0b3IpIHtcbiAgICAgIC8vIFVzZSB0aGUgb3B0aW9ucyBmcm9tIHRoZSBzb3VyY2Ugc3RyZWFtIGluc3RlYWQgb2Ygb3VyIGNsYXNzXG4gICAgICBvcHRpb25zID0gc291cmNlQ2xhc3MucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpO1xuICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMudGFyZ2V0ID0gdGFyZ2V0Q2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMgPSBzdXBlci5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICBpZiAoc291cmNlQ2xhc3MpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMuc291cmNlID0gc291cmNlQ2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgICB9XG4gICAgICBpZiAodGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMudGFyZ2V0ID0gdGFyZ2V0Q2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICAvLyBUT0RPOiBhIGJhYmVsIGJ1ZyAoaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8zOTMwKVxuICAgIC8vIHByZXZlbnRzIGBhd2FpdCBzdXBlcmA7IHRoaXMgaXMgYSB3b3JrYXJvdW5kOlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEdlbmVyaWNDbGFzcy5wcm90b3R5cGUudG9SYXdPYmplY3QuY2FsbCh0aGlzKTtcbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgYXN5bmMgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgZGlyZWN0aW9uLCBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9KSB7XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICB9XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNvdXJjZSBhbmQgdGFyZ2V0IGFyZSBhbHJlYWR5IGRlZmluZWQ7IHBsZWFzZSBzcGVjaWZ5IGEgZGlyZWN0aW9uIHRvIG92ZXJyaWRlYCk7XG4gICAgICB9XG4gICAgfVxuICAgIG5vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXSA9IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfTtcbiAgICBkZWxldGUgdGhpcy5fc3RyZWFtO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy53cmFwcGVkUGFyZW50ID0gd3JhcHBlZFBhcmVudDtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5yYXdJdGVtID0gcmF3SXRlbTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluTWVtb3J5SW5kZXg7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IHNoYTEgZnJvbSAnc2hhMSc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi9TdHJlYW0uanMnO1xuaW1wb3J0ICogYXMgVE9LRU5TIGZyb20gJy4vVG9rZW5zL1Rva2Vucy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRPS0VOUyA9IFRPS0VOUztcbiAgICB0aGlzLkNMQVNTRVMgPSBDTEFTU0VTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcbiAgICB0aGlzLklOREVYRVMgPSBJTkRFWEVTO1xuXG4gICAgLy8gTW9ua2V5LXBhdGNoIGF2YWlsYWJsZSB0b2tlbnMgYXMgZnVuY3Rpb25zIG9udG8gdGhlIFN0cmVhbSBjbGFzc1xuICAgIGZvciAoY29uc3QgdG9rZW5DbGFzc05hbWUgaW4gdGhpcy5UT0tFTlMpIHtcbiAgICAgIGNvbnN0IFRva2VuQ2xhc3MgPSB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV07XG4gICAgICBTdHJlYW0ucHJvdG90eXBlW1Rva2VuQ2xhc3MubG93ZXJDYW1lbENhc2VUeXBlXSA9IGZ1bmN0aW9uIChhcmdMaXN0LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmV4dGVuZChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRGVmYXVsdCBuYW1lZCBmdW5jdGlvbnNcbiAgICB0aGlzLk5BTUVEX0ZVTkNUSU9OUyA9IHtcbiAgICAgIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkgeyB5aWVsZCB3cmFwcGVkSXRlbS5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAoIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgICF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBHcmFuZHBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgaWYgKCEocGFyZW50VHlwZSA9PT0gJ251bWJlcicgfHwgcGFyZW50VHlwZSA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyZW50IGlzbid0IGEga2V5IC8gaW5kZXhgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0RmluaXNoOiBmdW5jdGlvbiAqICh0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAvLyBpZiByZWxldmFudCwgbWVyZ2UgdGhlIHJlc3VsdHMgb2YgYSBzZXJpZXMgb2Ygam9pbnMgaW50byBhIHNpbmdsZVxuICAgICAgICAgIC8vIGFycmF5XG4gICAgICAgICAgeWllbGQgdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0uY29uY2F0KFsgb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtIF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG90aGVyd2lzZSBqdXN0IHlpZWxkIHRoZSB0d28gcmVzdWx0cyBhcyBhbiBhcnJheVxuICAgICAgICAgIHlpZWxkIFtcbiAgICAgICAgICAgIHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLFxuICAgICAgICAgICAgb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgICAgXTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHNoYTE6IHJhd0l0ZW0gPT4gc2hhMShKU09OLnN0cmluZ2lmeShyYXdJdGVtKSksXG4gICAgICBub29wOiAoKSA9PiB7fVxuICAgIH07XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnJvb3QgPSB0aGlzLmxvYWRSb290KCk7XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBvdXIgY2xhc3Mgc3BlY2lmaWNhdGlvbnNcbiAgICB0aGlzLmNsYXNzZXMgPSB0aGlzLmxvYWRDbGFzc2VzKCk7XG4gIH1cblxuICBsb2FkUm9vdCAoKSB7XG4gICAgbGV0IHJvb3QgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtdXJlX3Jvb3QnKTtcbiAgICByb290ID0gcm9vdCA/IEpTT04ucGFyc2Uocm9vdCkgOiB7fTtcbiAgICByZXR1cm4gcm9vdDtcbiAgfVxuICBhc3luYyBzYXZlUm9vdCAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX3Jvb3QnLCBKU09OLnN0cmluZ2lmeSh0aGlzLnJvb3QpKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyb290VXBkYXRlJyk7XG4gIH1cbiAgbG9hZENsYXNzZXMgKCkge1xuICAgIGxldCBjbGFzc2VzID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbXVyZV9jbGFzc2VzJyk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMgPyBKU09OLnBhcnNlKGNsYXNzZXMpIDoge307XG4gICAgT2JqZWN0LmVudHJpZXMoY2xhc3NlcykuZm9yRWFjaCgoWyBjbGFzc0lkLCByYXdDbGFzc09iaiBdKSA9PiB7XG4gICAgICBPYmplY3QuZW50cmllcyhyYXdDbGFzc09iai5pbmRleGVzKS5mb3JFYWNoKChbZnVuY05hbWUsIHJhd0luZGV4T2JqXSkgPT4ge1xuICAgICAgICByYXdDbGFzc09iai5pbmRleGVzW2Z1bmNOYW1lXSA9IG5ldyB0aGlzLklOREVYRVMuSW5NZW1vcnlJbmRleCh7XG4gICAgICAgICAgZW50cmllczogcmF3SW5kZXhPYmosIGNvbXBsZXRlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgICBjb25zdCBjbGFzc1R5cGUgPSByYXdDbGFzc09iai5jbGFzc1R5cGU7XG4gICAgICBkZWxldGUgcmF3Q2xhc3NPYmouY2xhc3NUeXBlO1xuICAgICAgcmF3Q2xhc3NPYmoubXVyZSA9IHRoaXM7XG4gICAgICBjbGFzc2VzW2NsYXNzSWRdID0gbmV3IHRoaXMuQ0xBU1NFU1tjbGFzc1R5cGVdKHJhd0NsYXNzT2JqKTtcbiAgICB9KTtcbiAgICByZXR1cm4gY2xhc3NlcztcbiAgfVxuICBhc3luYyBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCByYXdDbGFzc2VzID0ge307XG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyh0aGlzLmNsYXNzZXMpXG4gICAgICAgIC5tYXAoYXN5bmMgKFsgY2xhc3NJZCwgY2xhc3NPYmogXSkgPT4ge1xuICAgICAgICAgIHJhd0NsYXNzZXNbY2xhc3NJZF0gPSBhd2FpdCBjbGFzc09iai50b1Jhd09iamVjdCgpO1xuICAgICAgICB9KSk7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX2NsYXNzZXMnLCBKU09OLnN0cmluZ2lmeShyYXdDbGFzc2VzKSk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcignY2xhc3NVcGRhdGUnKTtcbiAgfVxuXG4gIHBhcnNlU2VsZWN0b3IgKHNlbGVjdG9yU3RyaW5nKSB7XG4gICAgY29uc3Qgc3RhcnRzV2l0aFJvb3QgPSBzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdyb290Jyk7XG4gICAgaWYgKCEoc3RhcnRzV2l0aFJvb3QgfHwgc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgnZW1wdHknKSkpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgU2VsZWN0b3JzIG11c3Qgc3RhcnQgd2l0aCAncm9vdCcgb3IgJ2VtcHR5J2ApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3RvclN0cmluZy5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgaWYgKCF0b2tlblN0cmluZ3MpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCBzZWxlY3RvciBzdHJpbmc6ICR7c2VsZWN0b3JTdHJpbmd9YCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuQ2xhc3NMaXN0ID0gW3tcbiAgICAgIFRva2VuQ2xhc3M6IHN0YXJ0c1dpdGhSb290ID8gdGhpcy5UT0tFTlMuUm9vdFRva2VuIDogdGhpcy5UT0tFTlMuRW1wdHlUb2tlblxuICAgIH1dO1xuICAgIHRva2VuU3RyaW5ncy5mb3JFYWNoKGNodW5rID0+IHtcbiAgICAgIGNvbnN0IHRlbXAgPSBjaHVuay5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKCF0ZW1wKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCB0b2tlbjogJHtjaHVua31gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRva2VuQ2xhc3NOYW1lID0gdGVtcFsxXVswXS50b1VwcGVyQ2FzZSgpICsgdGVtcFsxXS5zbGljZSgxKSArICdUb2tlbic7XG4gICAgICBjb25zdCBhcmdMaXN0ID0gdGVtcFsyXS5zcGxpdCgvKD88IVxcXFwpLC8pLm1hcChkID0+IHtcbiAgICAgICAgZCA9IGQudHJpbSgpO1xuICAgICAgICByZXR1cm4gZCA9PT0gJycgPyB1bmRlZmluZWQgOiBkO1xuICAgICAgfSk7XG4gICAgICBpZiAodG9rZW5DbGFzc05hbWUgPT09ICdWYWx1ZXNUb2tlbicpIHtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuS2V5c1Rva2VuLFxuICAgICAgICAgIGFyZ0xpc3RcbiAgICAgICAgfSk7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLlZhbHVlVG9rZW5cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSkge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biB0b2tlbjogJHt0ZW1wWzFdfWApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0b2tlbkNsYXNzTGlzdDtcbiAgfVxuXG4gIHN0cmVhbSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMucGFyc2VTZWxlY3RvcihvcHRpb25zLnNlbGVjdG9yIHx8IGByb290LnZhbHVlcygpYCk7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICBhc3luYyBuZXdDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGByb290YCB9KSB7XG4gICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgTkVYVF9DTEFTU19JRCArPSAxO1xuICAgIGNvbnN0IENsYXNzVHlwZSA9IG9wdGlvbnMuQ2xhc3NUeXBlIHx8IHRoaXMuQ0xBU1NFUy5HZW5lcmljQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuQ2xhc3NUeXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ2xhc3NUeXBlKG9wdGlvbnMpO1xuICAgIGF3YWl0IHRoaXMuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNEYXRhU291cmNlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlKHtcbiAgICAgIGtleTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFzeW5jIGFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGtleSxcbiAgICBleHRlbnNpb24gPSAndHh0JyxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICBsZXQgb2JqO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBvYmogPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGRlbGV0ZSBvYmouY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNEYXRhU291cmNlKGtleSwgb2JqKTtcbiAgfVxuICBhc3luYyBhZGRTdGF0aWNEYXRhU291cmNlIChrZXksIG9iaikge1xuICAgIHRoaXMucm9vdFtrZXldID0gb2JqO1xuICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBQcm9taXNlLmFsbChbdGhpcy5zYXZlUm9vdCgpLCB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHNlbGVjdG9yOiBgcm9vdC52YWx1ZXMoJyR7a2V5fScpLnZhbHVlcygpYFxuICAgIH0pXSk7XG4gICAgcmV0dXJuIHRlbXBbMV07XG4gIH1cbiAgYXN5bmMgcmVtb3ZlRGF0YVNvdXJjZSAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMucm9vdFtrZXldO1xuICAgIGF3YWl0IHRoaXMuc2F2ZVJvb3QoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCBGaWxlUmVhZGVyIGZyb20gJ2ZpbGVyZWFkZXInO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKEZpbGVSZWFkZXIsIG51bGwpO1xubXVyZS52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJpbmRleCIsInNwbGljZSIsImFyZ3MiLCJmb3JFYWNoIiwiYXBwbHkiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsInRpbWVvdXQiLCJzZXRUaW1lb3V0IiwidHJpZ2dlciIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJpIiwiU3RyZWFtIiwib3B0aW9ucyIsIm11cmUiLCJuYW1lZEZ1bmN0aW9ucyIsIk5BTUVEX0ZVTkNUSU9OUyIsIm5hbWVkU3RyZWFtcyIsImxhdW5jaGVkRnJvbUNsYXNzIiwiaW5kZXhlcyIsInRva2VuQ2xhc3NMaXN0IiwidG9rZW5MaXN0IiwibWFwIiwiVG9rZW5DbGFzcyIsImFyZ0xpc3QiLCJXcmFwcGVycyIsImdldFdyYXBwZXJMaXN0IiwidG9rZW4iLCJsZW5ndGgiLCJXcmFwcGVyIiwibG9jYWxUb2tlbkxpc3QiLCJzbGljZSIsInBvdGVudGlhbFdyYXBwZXJzIiwidmFsdWVzIiwiY2xhc3NlcyIsImZpbHRlciIsImNsYXNzT2JqIiwiZXZlcnkiLCJsb2NhbFRva2VuIiwibG9jYWxJbmRleCIsInRva2VuQ2xhc3NTcGVjIiwiaXNTdWJzZXRPZiIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJ3YXJuIiwic2VsZWN0b3IiLCJqb2luIiwicGFyc2VTZWxlY3RvciIsImNvbmNhdCIsIndyYXBwZWRQYXJlbnQiLCJyYXdJdGVtIiwiaGFzaGVzIiwid3JhcHBlckluZGV4IiwidGVtcCIsIndyYXBwZWRJdGVtIiwiUHJvbWlzZSIsImFsbCIsImVudHJpZXMiLCJyZWR1Y2UiLCJwcm9taXNlTGlzdCIsImhhc2hGdW5jdGlvbk5hbWUiLCJoYXNoIiwiZ2V0SW5kZXgiLCJjb21wbGV0ZSIsImFkZFZhbHVlIiwibGFzdFRva2VuIiwiaXRlcmF0ZSIsIklOREVYRVMiLCJJbk1lbW9yeUluZGV4IiwiaGFzaEZ1bmN0aW9uIiwiRXJyb3IiLCJsaW1pdCIsInJlYnVpbGRJbmRleGVzIiwiaXRlcmF0b3IiLCJuZXh0IiwiZG9uZSIsInZhbHVlIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwiY29uc3RydWN0b3IiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkJhc2VUb2tlbiIsInN0cmVhbSIsInRvTG93ZXJDYXNlIiwiYW5jZXN0b3JUb2tlbnMiLCJwYXJlbnRUb2tlbiIsInlpZWxkZWRTb21ldGhpbmciLCJkZWJ1ZyIsIlR5cGVFcnJvciIsImV4ZWMiLCJuYW1lIiwiRW1wdHlUb2tlbiIsIlJvb3RUb2tlbiIsIndyYXAiLCJyb290IiwiS2V5c1Rva2VuIiwibWF0Y2hBbGwiLCJrZXlzIiwicmFuZ2VzIiwidW5kZWZpbmVkIiwiYXJnIiwibWF0Y2giLCJJbmZpbml0eSIsImQiLCJwYXJzZUludCIsImlzTmFOIiwibG93IiwiaGlnaCIsIm51bSIsIk51bWJlciIsIlN5bnRheEVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsImNvbnNvbGlkYXRlUmFuZ2VzIiwic2VsZWN0c05vdGhpbmciLCJuZXdSYW5nZXMiLCJzb3J0IiwiYSIsImIiLCJjdXJyZW50UmFuZ2UiLCJvdGhlclRva2VuIiwibmV3S2V5cyIsImtleSIsImFsbFBvaW50cyIsImFnZyIsInJhbmdlIiwiaW5jbHVkZSIsImV4Y2x1ZGUiLCJkaWZmIiwiZGlmZmVyZW5jZSIsIml0ZXJhdGVQYXJlbnQiLCJNYXRoIiwibWF4IiwibWluIiwiaGFzT3duUHJvcGVydHkiLCJWYWx1ZVRva2VuIiwib2JqIiwia2V5VHlwZSIsIkV2YWx1YXRlVG9rZW4iLCJuZXdTdHJlYW0iLCJmb3JrIiwiZXJyIiwiTWFwVG9rZW4iLCJnZW5lcmF0b3IiLCJtYXBwZWRSYXdJdGVtIiwiUHJvbW90ZVRva2VuIiwicmVkdWNlSW5zdGFuY2VzIiwiZnVuYyIsIm1hcEZ1bmN0aW9uIiwicmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24iLCJoYXNoSW5kZXgiLCJvcmlnaW5hbFdyYXBwZWRJdGVtIiwiZ2V0VmFsdWVMaXN0IiwiSm9pblRva2VuIiwib3RoZXJTdHJlYW0iLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImZpbmlzaCIsIm50aEpvaW4iLCJ0aGlzSGFzaEZ1bmN0aW9uIiwib3RoZXJIYXNoRnVuY3Rpb24iLCJmaW5pc2hGdW5jdGlvbiIsInRoaXNJbmRleCIsIm90aGVySW5kZXgiLCJpdGVyRW50cmllcyIsInZhbHVlTGlzdCIsIm90aGVyTGlzdCIsIm90aGVyV3JhcHBlZEl0ZW0iLCJ0aGlzV3JhcHBlZEl0ZW0iLCJ0aGlzTGlzdCIsInRoaXNJdGVyYXRvciIsInRoaXNJc0RvbmUiLCJvdGhlckl0ZXJhdG9yIiwib3RoZXJJc0RvbmUiLCJBU1RFUklTS1MiLCJHZW5lcmljQ2xhc3MiLCJjbGFzc0lkIiwiX3NlbGVjdG9yIiwiY3VzdG9tQ2xhc3NOYW1lIiwiY3VzdG9tTmFtZVRva2VuSW5kZXgiLCJmdW5jTmFtZSIsIkZ1bmN0aW9uIiwicmVzdWx0IiwidG9TdHJpbmciLCJ0b1Jhd09iamVjdCIsInNhdmVDbGFzc2VzIiwiaGFzQ3VzdG9tTmFtZSIsImNsYXNzTmFtZSIsInRva2VuU3RyaW5ncyIsInN0YXJ0c1dpdGgiLCJyZXNldCIsIl9zdHJlYW0iLCJwb3B1bGF0ZVN0cmVhbU9wdGlvbnMiLCJpc1N1cGVyU2V0T2YiLCJDTEFTU0VTIiwiTm9kZUNsYXNzIiwiRWRnZUNsYXNzIiwiTm9kZVdyYXBwZXIiLCJlZGdlQ29ubmVjdGlvbnMiLCJwcm90b3R5cGUiLCJjYWxsIiwibm9kZUNsYXNzIiwidGhpc0hhc2hOYW1lIiwib3RoZXJIYXNoTmFtZSIsImVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJkaXJlY3RlZCIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJzb3VyY2VIYXNoIiwibm9kZUhhc2hOYW1lIiwidGFyZ2V0SGFzaCIsImVkZ2VIYXNoTmFtZSIsInRhcmdldCIsImdldFN0cmVhbSIsInNvdXJjZSIsImRpcmVjdGlvbiIsIk5FWFRfQ0xBU1NfSUQiLCJNdXJlIiwiRmlsZVJlYWRlciIsImxvY2FsU3RvcmFnZSIsIm1pbWUiLCJEQVRBTElCX0ZPUk1BVFMiLCJUT0tFTlMiLCJ0b2tlbkNsYXNzTmFtZSIsImV4dGVuZCIsInBhcmVudFR5cGUiLCJBcnJheSIsInNoYTEiLCJsb2FkUm9vdCIsImxvYWRDbGFzc2VzIiwiZ2V0SXRlbSIsInBhcnNlIiwic2V0SXRlbSIsInJhd0NsYXNzT2JqIiwicmF3SW5kZXhPYmoiLCJjbGFzc1R5cGUiLCJyYXdDbGFzc2VzIiwic2VsZWN0b3JTdHJpbmciLCJzdGFydHNXaXRoUm9vdCIsImNodW5rIiwidG9VcHBlckNhc2UiLCJzcGxpdCIsInRyaW0iLCJDbGFzc1R5cGUiLCJjaGFyc2V0IiwiZmlsZU9iaiIsImZpbGVNQiIsInNpemUiLCJza2lwU2l6ZUNoZWNrIiwidGV4dCIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiZW5jb2RpbmciLCJhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UiLCJleHRlbnNpb25PdmVycmlkZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY0RhdGFTb3VyY2UiLCJzYXZlUm9vdCIsIm5ld0NsYXNzIiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsTUFBTUEsbUJBQW1CLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtrQkFDZjtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsYUFBTCxHQUFxQixFQUFyQjtXQUNLQyxjQUFMLEdBQXNCLEVBQXRCOztP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
