import mime from 'mime-types';
import datalib from 'datalib';
import sha1 from 'sha1';

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
    this.traversalMode = options.traversalMode || 'DFS';
    this.launchedFromClass = options.launchedFromClass || null;
    this.indexes = options.indexes || {};

    // Reminder: this always needs to be after initializing this.namedFunctions
    // and this.namedStreams
    this.tokenList = options.tokenClassList.map(({ TokenClass, argList }) => {
      return new TokenClass(this, argList);
    });
    // Reminder: this always needs to be after initializing this.tokenList
    this.Wrappers = this.getWrapperList();
  }

  completeIndex(hashFunctionName) {
    var _this = this;

    return asyncToGenerator(function* () {
      const hashFunction = _this.namedFunctions[hashFunctionName];
      if (!hashFunction) {
        throw new Error(`Unknown named function: ${hashFunctionName}`);
      }
      const index = _this.getIndex(hashFunctionName);
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterate({ limit: Infinity })), _step, _value; _step = yield _iterator.next(), _iteratorNormalCompletion = _step.done, _value = yield _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
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
    })();
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

  wrap({ wrappedParent, token, rawItem, hashes = {} }) {
    var _this2 = this;

    return asyncToGenerator(function* () {
      let wrapperIndex = 0;
      let temp = wrappedParent;
      while (temp !== null) {
        wrapperIndex += 1;
        temp = temp.wrappedParent;
      }
      const wrappedItem = new _this2.Wrappers[wrapperIndex]({ wrappedParent, token, rawItem });
      yield Promise.all(Object.entries(hashes).reduce(function (promiseList, [hashFunctionName, hash]) {
        const index = _this2.getIndex(hashFunctionName);
        if (!index.complete) {
          return promiseList.concat([index.addValue(hash, wrappedItem)]);
        }
      }, []));
      return wrappedItem;
    })();
  }

  iterate() {
    var _this3 = this;

    return asyncGenerator.wrap(function* () {
      const lastToken = _this3.tokenList[_this3.tokenList.length - 1];
      const temp = _this3.tokenList.slice(0, _this3.tokenList.length - 1);
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
  constructor(stream, [otherStream, thisHash = 'key', otherHash = 'key', finish = 'defaultFinish']) {
    super(stream);
    for (const func of [finish, thisHash, finish]) {
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
            for (var _iterator = asyncIterator(thisIndex.iterValues()), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
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
  RootToken: RootToken,
  KeysToken: KeysToken,
  ValueToken: ValueToken,
  EvaluateToken: EvaluateToken,
  MapToken: MapToken,
  PromoteToken: PromoteToken,
  JoinToken: JoinToken
});

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this.mure = options.mure;
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.selector = options.selector || `root.values()`;
    this._customClassName = options.customName || null;
    this.tokenClassList = this.mure.parseSelector(options.selector);
    this.indexes = options.indexes || {};
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      const result = {
        classType: _this.constructor.name,
        selector: _this.selector,
        customName: _this._customClassName,
        indexes: {}
      };
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
    return new this.mure.WRAPPERS.GenericWrapper(options);
  }
  get className() {
    return this._customClassName || 'class name auto-inference not implemented';
  }
  getStream(options = {}) {
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
  isSuperSetOfTokenList(tokenList) {
    if (tokenList.length !== this.tokenList.length) {
      return false;
    }
    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }
  interpretAsNodes() {
    throw new Error(`unimplemented`);
  }
  interpretAsEdges() {
    throw new Error(`unimplemented`);
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
    this.edgeSelectors = options.edgeSelectors || {};
    Object.entries(this.edgeSelectors).forEach(([selector, { nodeHash, edgeHash }]) => {
      if (typeof nodeHash === 'string') {
        nodeHash = new Function(nodeHash); // eslint-disable-line no-new-func
      }
      if (typeof edgeHash === 'string') {
        edgeHash = new Function(edgeHash); // eslint-disable-line no-new-func
      }
      this.edgeSelectors[selector] = { nodeHash, edgeHash };
    });
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
      // prevents `await super`; this is a workaround:
      const result = yield GenericClass.prototype.toRawObject();
      result.edgeSelectors = {};
      Object.entries(_this.edgeSelectors).forEach(function ([selector, { nodeHash, edgeHash }]) {
        nodeHash = nodeHash.toString();
        edgeHash = edgeHash.toString();
        result.edgeSelectors[selector] = { nodeHash, edgeHash };
      });
      return result;
    })();
  }
  connectToNodeClass({ nodeClass, thisHash, otherHash }) {
    throw new Error(`unimplemented`);
  }
  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    edgeClass.connectToNodeClass(options);
  }
}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.EdgeWrapper;
    this.sourceSelector = options.sourceSelector || null;
    this.targetSelector = options.targetSelector || null;
    this.directed = options.directed || false;
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
      // prevents `await super`; this is a workaround:
      const result = yield GenericClass.prototype.toRawObject();
      result.sourceSelector = _this.sourceSelector;
      result.targetSelector = _this.targetSelector;
      result.directed = _this.directed;
    })();
  }
  connectToNodeClass({ nodeClass, direction, nodeHash, edgeHash }) {
    if (direction === 'source') {
      if (this.sourceSelector) {
        delete this.mure.classes[this.sourceSelector].edgeSelectors[this.selector];
      }
      this.sourceSelector = nodeClass.selector;
    } else if (direction === 'target') {
      if (this.targetSelector) {
        delete this.mure.classes[this.targetSelector].edgeSelectors[this.selector];
      }
      this.targetSelector = nodeClass.selector;
    } else {
      if (!this.sourceSelector) {
        this.sourceSelector = nodeClass.selector;
      } else if (!this.targetSelector) {
        this.targetSelector = nodeClass.selector;
      } else {
        throw new Error(`Source and target are already defined; please specify a direction to override`);
      }
    }
    nodeClass.edgeSelectors[this.selector] = { nodeHash, edgeHash };
  }
  getStream(options) {
    throw new Error(`unimplemented`);
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

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader, localStorage) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node
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
        yield [thisWrappedItem.rawItem, otherWrappedItem.rawItem];
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
    })();
  }
  loadClasses() {
    let classes = this.localStorage && this.localStorage.getItem('mure_classes');
    classes = classes ? JSON.parse(classes) : {};
    Object.entries(classes).forEach(([classSelector, rawClassObj]) => {
      Object.entries(rawClassObj.indexes).forEach(([funcName, rawIndexObj]) => {
        rawClassObj.indexes[funcName] = new this.INDEXES.InMemoryIndex({
          entries: rawIndexObj, complete: true
        });
      });
      const classType = rawClassObj.classType;
      delete rawClassObj.classType;
      rawClassObj.mure = this;
      classes[classSelector] = new this.CLASSES[classType](rawClassObj);
    });
    return classes;
  }
  saveClasses() {
    var _this2 = this;

    return asyncToGenerator(function* () {
      if (_this2.localStorage) {
        const rawClasses = {};
        yield Promise.all(Object.entries(_this2.classes).map((() => {
          var _ref = asyncToGenerator(function* ([classSelector, classObj]) {
            rawClasses[classSelector] = yield classObj.toRawObject();
          });

          return function (_x) {
            return _ref.apply(this, arguments);
          };
        })()));
        _this2.localStorage.setItem('mure_classes', JSON.stringify(rawClasses));
      }
    })();
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
    options.mure = this;
    options.tokenClassList = this.parseSelector(options.selector || `root.values()`);
    return new Stream(options);
  }

  newClass(options = { selector: `root.values()` }) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      if (_this3.classes[options.selector]) {
        return _this3.classes[options.selector];
      }
      const ClassType = options.ClassType || _this3.CLASSES.GenericClass;
      delete options.ClassType;
      options.mure = _this3;
      _this3.classes[options.selector] = new ClassType(options);
      yield _this3.saveClasses();
      return _this3.classes[options.selector];
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
var version = "0.4.3";
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

let mure = new Mure(window.FileReader, window.localStorage);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIFN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgdGhpcy5uYW1lZFN0cmVhbXMgPSBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fTtcbiAgICB0aGlzLnRyYXZlcnNhbE1vZGUgPSBvcHRpb25zLnRyYXZlcnNhbE1vZGUgfHwgJ0RGUyc7XG4gICAgdGhpcy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgbnVsbDtcbiAgICB0aGlzLmluZGV4ZXMgPSBvcHRpb25zLmluZGV4ZXMgfHwge307XG5cbiAgICAvLyBSZW1pbmRlcjogdGhpcyBhbHdheXMgbmVlZHMgdG8gYmUgYWZ0ZXIgaW5pdGlhbGl6aW5nIHRoaXMubmFtZWRGdW5jdGlvbnNcbiAgICAvLyBhbmQgdGhpcy5uYW1lZFN0cmVhbXNcbiAgICB0aGlzLnRva2VuTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QubWFwKCh7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBUb2tlbkNsYXNzKHRoaXMsIGFyZ0xpc3QpO1xuICAgIH0pO1xuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy50b2tlbkxpc3RcbiAgICB0aGlzLldyYXBwZXJzID0gdGhpcy5nZXRXcmFwcGVyTGlzdCgpO1xuICB9XG5cbiAgYXN5bmMgY29tcGxldGVJbmRleCAoaGFzaEZ1bmN0aW9uTmFtZSkge1xuICAgIGNvbnN0IGhhc2hGdW5jdGlvbiA9IHRoaXMubmFtZWRGdW5jdGlvbnNbaGFzaEZ1bmN0aW9uTmFtZV07XG4gICAgaWYgKCFoYXNoRnVuY3Rpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtoYXNoRnVuY3Rpb25OYW1lfWApO1xuICAgIH1cbiAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXgoaGFzaEZ1bmN0aW9uTmFtZSk7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoeyBsaW1pdDogSW5maW5pdHkgfSkpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBoYXNoRnVuY3Rpb24od3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgIGluZGV4LmFkZFZhbHVlKGhhc2gsIHdyYXBwZWRJdGVtKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXRXcmFwcGVyTGlzdCAoKSB7XG4gICAgLy8gTG9vayB1cCB3aGljaCwgaWYgYW55LCBjbGFzc2VzIGRlc2NyaWJlIHRoZSByZXN1bHQgb2YgZWFjaCB0b2tlbiwgc28gdGhhdFxuICAgIC8vIHdlIGNhbiB3cmFwIGl0ZW1zIGFwcHJvcHJpYXRlbHk6XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0Lm1hcCgodG9rZW4sIGluZGV4KSA9PiB7XG4gICAgICBpZiAoaW5kZXggPT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEgJiYgdGhpcy5sYXVuY2hlZEZyb21DbGFzcykge1xuICAgICAgICAvLyBJZiB0aGlzIHN0cmVhbSB3YXMgc3RhcnRlZCBmcm9tIGEgY2xhc3MsIHdlIGFscmVhZHkga25vdyB3ZSBzaG91bGRcbiAgICAgICAgLy8gdXNlIHRoYXQgY2xhc3MncyB3cmFwcGVyIGZvciB0aGUgbGFzdCB0b2tlblxuICAgICAgICByZXR1cm4gdGhpcy5sYXVuY2hlZEZyb21DbGFzcy5XcmFwcGVyO1xuICAgICAgfVxuICAgICAgLy8gRmluZCBhIGNsYXNzIHRoYXQgZGVzY3JpYmVzIGV4YWN0bHkgZWFjaCBzZXJpZXMgb2YgdG9rZW5zXG4gICAgICBjb25zdCBsb2NhbFRva2VuTGlzdCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIGluZGV4ICsgMSk7XG4gICAgICBjb25zdCBwb3RlbnRpYWxXcmFwcGVycyA9IE9iamVjdC52YWx1ZXModGhpcy5tdXJlLmNsYXNzZXMpXG4gICAgICAgIC5maWx0ZXIoY2xhc3NPYmogPT4ge1xuICAgICAgICAgIGlmICghY2xhc3NPYmoudG9rZW5DbGFzc0xpc3QubGVuZ3RoICE9PSBsb2NhbFRva2VuTGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW5MaXN0LmV2ZXJ5KChsb2NhbFRva2VuLCBsb2NhbEluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbkNsYXNzU3BlYyA9IGNsYXNzT2JqLnRva2VuQ2xhc3NMaXN0W2xvY2FsSW5kZXhdO1xuICAgICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW4gaW5zdGFuY2VvZiB0b2tlbkNsYXNzU3BlYy5Ub2tlbkNsYXNzICYmXG4gICAgICAgICAgICAgIHRva2VuLmlzU3Vic2V0T2YodG9rZW5DbGFzc1NwZWMuYXJnTGlzdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBObyBjbGFzc2VzIGRlc2NyaWJlIHRoaXMgc2VyaWVzIG9mIHRva2Vucywgc28gdXNlIHRoZSBnZW5lcmljIHdyYXBwZXJcbiAgICAgICAgcmV0dXJuIHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBNdWx0aXBsZSBjbGFzc2VzIGRlc2NyaWJlIHRoZSBzYW1lIGl0ZW0hIEFyYml0cmFyaWx5IGNob29zaW5nIG9uZS4uLmApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwb3RlbnRpYWxXcmFwcGVyc1swXS5XcmFwcGVyO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3Quam9pbignJyk7XG4gIH1cblxuICBmb3JrIChzZWxlY3Rvcikge1xuICAgIHJldHVybiBuZXcgU3RyZWFtKHtcbiAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB0aGlzLm5hbWVkRnVuY3Rpb25zLFxuICAgICAgdHJhdmVyc2FsTW9kZTogdGhpcy50cmF2ZXJzYWxNb2RlLFxuICAgICAgdG9rZW5DbGFzc0xpc3Q6IHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKHNlbGVjdG9yKSxcbiAgICAgIGxhdW5jaGVkRnJvbUNsYXNzOiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzXG4gICAgfSk7XG4gIH1cblxuICBleHRlbmQgKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICBvcHRpb25zLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5uYW1lZEZ1bmN0aW9ucywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMudG9rZW5DbGFzc0xpc3QuY29uY2F0KHsgVG9rZW5DbGFzcywgYXJnTGlzdCB9KTtcbiAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzO1xuICAgIG9wdGlvbnMudHJhdmVyc2FsTW9kZSA9IG9wdGlvbnMudHJhdmVyc2FsTW9kZSB8fCB0aGlzLnRyYXZlcnNhbE1vZGU7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICBhc3luYyB3cmFwICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtLCBoYXNoZXMgPSB7fSB9KSB7XG4gICAgbGV0IHdyYXBwZXJJbmRleCA9IDA7XG4gICAgbGV0IHRlbXAgPSB3cmFwcGVkUGFyZW50O1xuICAgIHdoaWxlICh0ZW1wICE9PSBudWxsKSB7XG4gICAgICB3cmFwcGVySW5kZXggKz0gMTtcbiAgICAgIHRlbXAgPSB0ZW1wLndyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gbmV3IHRoaXMuV3JhcHBlcnNbd3JhcHBlckluZGV4XSh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKGhhc2hlcykucmVkdWNlKChwcm9taXNlTGlzdCwgW2hhc2hGdW5jdGlvbk5hbWUsIGhhc2hdKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXgoaGFzaEZ1bmN0aW9uTmFtZSk7XG4gICAgICBpZiAoIWluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlTGlzdC5jb25jYXQoWyBpbmRleC5hZGRWYWx1ZShoYXNoLCB3cmFwcGVkSXRlbSkgXSk7XG4gICAgICB9XG4gICAgfSwgW10pKTtcbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cblxuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIGNvbnN0IGxhc3RUb2tlbiA9IHRoaXMudG9rZW5MaXN0W3RoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxKTtcbiAgICB5aWVsZCAqIGF3YWl0IGxhc3RUb2tlbi5pdGVyYXRlKHRlbXApO1xuICB9XG5cbiAgZ2V0SW5kZXggKGhhc2hGdW5jdGlvbk5hbWUpIHtcbiAgICBpZiAoIXRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXSkge1xuICAgICAgLy8gVE9ETzogaWYgdXNpbmcgbm9kZS5qcywgc3RhcnQgd2l0aCBleHRlcm5hbCAvIG1vcmUgc2NhbGFibGUgaW5kZXhlc1xuICAgICAgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdID0gbmV3IHRoaXMubXVyZS5JTkRFWEVTLkluTWVtb3J5SW5kZXgoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgfVxuXG4gIGFzeW5jICogc2FtcGxlICh7IGxpbWl0ID0gMTAsIHJlYnVpbGRJbmRleGVzID0gZmFsc2UgfSkge1xuICAgIC8vIEJlZm9yZSB3ZSBzdGFydCwgY2xlYW4gb3V0IGFueSBvbGQgaW5kZXhlcyB0aGF0IHdlcmUgbmV2ZXIgZmluaXNoZWRcbiAgICBPYmplY3QuZW50cmllcyh0aGlzLmluZGV4ZXMpLmZvckVhY2goKFtoYXNoRnVuY3Rpb25OYW1lLCBpbmRleF0pID0+IHtcbiAgICAgIGlmIChyZWJ1aWxkSW5kZXhlcyB8fCAhaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZSgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgLy8gV2UgYWN0dWFsbHkgZmluaXNoZWQgYSBmdWxsIHBhc3M7IGZsYWcgYWxsIG9mIG91ciBpbmRleGVzIGFzIGNvbXBsZXRlXG4gICAgICAgIE9iamVjdC52YWx1ZXModGhpcy5pbmRleGVzKS5mb3JFYWNoKGluZGV4ID0+IHtcbiAgICAgICAgICBpbmRleC5jb21wbGV0ZSA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW07XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZVRva2VuIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgLy8gVGhlIHN0cmluZyB2ZXJzaW9uIG9mIG1vc3QgdG9rZW5zIGNhbiBqdXN0IGJlIGRlcml2ZWQgZnJvbSB0aGUgY2xhc3MgdHlwZVxuICAgIHJldHVybiBgLiR7dGhpcy50eXBlLnRvTG93ZXJDYXNlKCl9KClgO1xuICB9XG4gIGlzU3ViU2V0T2YgKCkge1xuICAgIC8vIEJ5IGRlZmF1bHQgKHdpdGhvdXQgYW55IGFyZ3VtZW50cyksIHRva2VucyBvZiB0aGUgc2FtZSBjbGFzcyBhcmUgc3Vic2V0c1xuICAgIC8vIG9mIGVhY2ggb3RoZXJcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlUGFyZW50IChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IHBhcmVudFRva2VuID0gYW5jZXN0b3JUb2tlbnNbYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IGFuY2VzdG9yVG9rZW5zLnNsaWNlKDAsIGFuY2VzdG9yVG9rZW5zLmxlbmd0aCAtIDEpO1xuICAgIGxldCB5aWVsZGVkU29tZXRoaW5nID0gZmFsc2U7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRva2VuLml0ZXJhdGUodGVtcCkpIHtcbiAgICAgIHlpZWxkZWRTb21ldGhpbmcgPSB0cnVlO1xuICAgICAgeWllbGQgd3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgaWYgKCF5aWVsZGVkU29tZXRoaW5nICYmIHRoaXMubXVyZS5kZWJ1Zykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVG9rZW4geWllbGRlZCBubyByZXN1bHRzOiAke3BhcmVudFRva2VufWApO1xuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQ6IG51bGwsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IHRoaXMuc3RyZWFtLm11cmUucm9vdFxuICAgIH0pO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYHJvb3RgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgS2V5c1Rva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgYXJnTGlzdCwgeyBtYXRjaEFsbCwga2V5cywgcmFuZ2VzIH0gPSB7fSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKGtleXMgfHwgcmFuZ2VzKSB7XG4gICAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgICAgdGhpcy5yYW5nZXMgPSByYW5nZXM7XG4gICAgfSBlbHNlIGlmICgoYXJnTGlzdCAmJiBhcmdMaXN0Lmxlbmd0aCA9PT0gMSAmJiBhcmdMaXN0WzBdID09PSB1bmRlZmluZWQpIHx8IG1hdGNoQWxsKSB7XG4gICAgICB0aGlzLm1hdGNoQWxsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnTGlzdC5mb3JFYWNoKGFyZyA9PiB7XG4gICAgICAgIGxldCB0ZW1wID0gYXJnLm1hdGNoKC8oXFxkKyktKFtcXGTiiJ5dKykvKTtcbiAgICAgICAgaWYgKHRlbXAgJiYgdGVtcFsyXSA9PT0gJ+KInicpIHtcbiAgICAgICAgICB0ZW1wWzJdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IHRlbXAgPyB0ZW1wLm1hcChkID0+IGQucGFyc2VJbnQoZCkpIDogbnVsbDtcbiAgICAgICAgaWYgKHRlbXAgJiYgIWlzTmFOKHRlbXBbMV0pICYmICFpc05hTih0ZW1wWzJdKSkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSB0ZW1wWzFdOyBpIDw9IHRlbXBbMl07IGkrKykge1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IHRlbXBbMV0sIGhpZ2g6IHRlbXBbMl0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gYXJnLm1hdGNoKC8nKC4qKScvKTtcbiAgICAgICAgdGVtcCA9IHRlbXAgJiYgdGVtcFsxXSA/IHRlbXBbMV0gOiBhcmc7XG4gICAgICAgIGxldCBudW0gPSBOdW1iZXIodGVtcCk7XG4gICAgICAgIGlmIChpc05hTihudW0pIHx8IG51bSAhPT0gcGFyc2VJbnQodGVtcCkpIHsgLy8gbGVhdmUgbm9uLWludGVnZXIgbnVtYmVycyBhcyBzdHJpbmdzXG4gICAgICAgICAgdGhpcy5rZXlzID0gdGhpcy5rZXlzIHx8IHt9O1xuICAgICAgICAgIHRoaXMua2V5c1t0ZW1wXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiBudW0sIGhpZ2g6IG51bSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBCYWQgdG9rZW4ga2V5KHMpIC8gcmFuZ2Uocyk6ICR7SlNPTi5zdHJpbmdpZnkoYXJnTGlzdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLmNvbnNvbGlkYXRlUmFuZ2VzKHRoaXMucmFuZ2VzKTtcbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdHNOb3RoaW5nICgpIHtcbiAgICByZXR1cm4gIXRoaXMubWF0Y2hBbGwgJiYgIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXM7XG4gIH1cbiAgY29uc29saWRhdGVSYW5nZXMgKHJhbmdlcykge1xuICAgIC8vIE1lcmdlIGFueSBvdmVybGFwcGluZyByYW5nZXNcbiAgICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcbiAgICBjb25zdCB0ZW1wID0gcmFuZ2VzLnNvcnQoKGEsIGIpID0+IGEubG93IC0gYi5sb3cpO1xuICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFjdXJyZW50UmFuZ2UpIHtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH0gZWxzZSBpZiAodGVtcFtpXS5sb3cgPD0gY3VycmVudFJhbmdlLmhpZ2gpIHtcbiAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSB0ZW1wW2ldLmhpZ2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgICAvLyBDb3JuZXIgY2FzZTogYWRkIHRoZSBsYXN0IHJhbmdlXG4gICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UmFuZ2VzLmxlbmd0aCA+IDAgPyBuZXdSYW5nZXMgOiB1bmRlZmluZWQ7XG4gIH1cbiAgZGlmZmVyZW5jZSAob3RoZXJUb2tlbikge1xuICAgIC8vIENvbXB1dGUgd2hhdCBpcyBsZWZ0IG9mIHRoaXMgYWZ0ZXIgc3VidHJhY3Rpbmcgb3V0IGV2ZXJ5dGhpbmcgaW4gb3RoZXJUb2tlblxuICAgIGlmICghKG90aGVyVG9rZW4gaW5zdGFuY2VvZiBLZXlzVG9rZW4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNvbXB1dGUgdGhlIGRpZmZlcmVuY2Ugb2YgdHdvIGRpZmZlcmVudCB0b2tlbiB0eXBlc2ApO1xuICAgIH0gZWxzZSBpZiAob3RoZXJUb2tlbi5tYXRjaEFsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEluYWNjdXJhdGUgZGlmZmVyZW5jZSBjb21wdXRlZCEgVE9ETzogbmVlZCB0byBmaWd1cmUgb3V0IGhvdyB0byBpbnZlcnQgY2F0ZWdvcmljYWwga2V5cyFgKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdLZXlzID0ge307XG4gICAgICBmb3IgKGxldCBrZXkgaW4gKHRoaXMua2V5cyB8fCB7fSkpIHtcbiAgICAgICAgaWYgKCFvdGhlclRva2VuLmtleXMgfHwgIW90aGVyVG9rZW4ua2V5c1trZXldKSB7XG4gICAgICAgICAgbmV3S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1JhbmdlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICAgIGlmIChvdGhlclRva2VuLnJhbmdlcykge1xuICAgICAgICAgIGxldCBhbGxQb2ludHMgPSB0aGlzLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgYWxsUG9pbnRzID0gYWxsUG9pbnRzLmNvbmNhdChvdGhlclRva2VuLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSkpLnNvcnQoKTtcbiAgICAgICAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbFBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IHsgbG93OiBhbGxQb2ludHNbaV0udmFsdWUgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS52YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5leGNsdWRlKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0ubG93IC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5sb3cgPSBhbGxQb2ludHNbaV0uaGlnaCArIDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3UmFuZ2VzID0gdGhpcy5yYW5nZXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgS2V5c1Rva2VuKHRoaXMubXVyZSwgbnVsbCwgeyBrZXlzOiBuZXdLZXlzLCByYW5nZXM6IG5ld1JhbmdlcyB9KTtcbiAgICB9XG4gIH1cbiAgaXNTdWJTZXRPZiAoYXJnTGlzdCkge1xuICAgIGNvbnN0IG90aGVyVG9rZW4gPSBuZXcgS2V5c1Rva2VuKHRoaXMuc3RyZWFtLCBhcmdMaXN0KTtcbiAgICBjb25zdCBkaWZmID0gb3RoZXJUb2tlbi5kaWZmZXJlbmNlKHRoaXMpO1xuICAgIHJldHVybiBkaWZmID09PSBudWxsIHx8IGRpZmYuc2VsZWN0c05vdGhpbmc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7IHJldHVybiAnLmtleXMoKSc7IH1cbiAgICByZXR1cm4gJy5rZXlzKCcgKyAodGhpcy5yYW5nZXMgfHwgW10pLm1hcCgoe2xvdywgaGlnaH0pID0+IHtcbiAgICAgIHJldHVybiBsb3cgPT09IGhpZ2ggPyBsb3cgOiBgJHtsb3d9LSR7aGlnaH1gO1xuICAgIH0pLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLmtleXMgfHwge30pLm1hcChrZXkgPT4gYCcke2tleX0nYCkpXG4gICAgICAuam9pbignLCcpICsgJyknO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEtleXNUb2tlbiBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICAgIGZvciAobGV0IGtleSBpbiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0pIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxldCB7bG93LCBoaWdofSBvZiB0aGlzLnJhbmdlcyB8fCBbXSkge1xuICAgICAgICAgIGxvdyA9IE1hdGgubWF4KDAsIGxvdyk7XG4gICAgICAgICAgaGlnaCA9IE1hdGgubWluKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5sZW5ndGggLSAxLCBoaWdoKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gbG93OyBpIDw9IGhpZ2g7IGkrKykge1xuICAgICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgcmF3SXRlbTogaVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMua2V5cyB8fCB7fSkge1xuICAgICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW0uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgS2V5c1Rva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFZhbHVlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgY29uc3Qga2V5ID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXlUeXBlID0gdHlwZW9mIGtleTtcbiAgICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCAoa2V5VHlwZSAhPT0gJ3N0cmluZycgJiYga2V5VHlwZSAhPT0gJ251bWJlcicpKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEV2YWx1YXRlVG9rZW4gaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdTdHJlYW07XG4gICAgICB0cnkge1xuICAgICAgICBuZXdTdHJlYW0gPSB0aGlzLnN0cmVhbS5mb3JrKHdyYXBwZWRQYXJlbnQucmF3SXRlbSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnIHx8ICEoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpKSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCAqIGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFdmFsdWF0ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIE1hcFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBnZW5lcmF0b3IgPSAnaWRlbnRpdHknIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2dlbmVyYXRvcl0pIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtnZW5lcmF0b3J9YCk7XG4gICAgfVxuICAgIHRoaXMuZ2VuZXJhdG9yID0gZ2VuZXJhdG9yO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5tYXAoJHt0aGlzLmdlbmVyYXRvcn0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiBnZW5lcmF0b3IgPT09IHRoaXMuZ2VuZXJhdG9yO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZ2VuZXJhdG9yXSh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1hcFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFByb21vdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIG1hcCwgaGFzaCwgcmVkdWNlSW5zdGFuY2VzIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICB0aGlzLmhhc2ggPSBoYXNoO1xuICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID0gcmVkdWNlSW5zdGFuY2VzO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5wcm9tb3RlKCR7dGhpcy5tYXB9LCAke3RoaXMuaGFzaH0sICR7dGhpcy5yZWR1Y2VJbnN0YW5jZXN9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHJldHVybiB0aGlzLm1hcCA9PT0gbWFwICYmXG4gICAgICB0aGlzLmhhc2ggPT09IGhhc2ggJiZcbiAgICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID09PSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBjb25zdCBtYXBGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMubWFwXTtcbiAgICAgIGNvbnN0IGhhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuaGFzaF07XG4gICAgICBjb25zdCByZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMucmVkdWNlSW5zdGFuY2VzXTtcbiAgICAgIGNvbnN0IGhhc2hJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMuaGFzaCk7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgbWFwRnVuY3Rpb24od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgICAgY29uc3QgaGFzaCA9IGhhc2hGdW5jdGlvbihtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgbGV0IG9yaWdpbmFsV3JhcHBlZEl0ZW0gPSAoYXdhaXQgaGFzaEluZGV4LmdldFZhbHVlTGlzdChoYXNoKSlbMF07XG4gICAgICAgIGlmIChvcmlnaW5hbFdyYXBwZWRJdGVtKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVkdWNlSW5zdGFuY2VzICE9PSAnbm9vcCcpIHtcbiAgICAgICAgICAgIHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgaGFzaGVzID0ge307XG4gICAgICAgICAgaGFzaGVzW3RoaXMuaGFzaF0gPSBoYXNoO1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbSxcbiAgICAgICAgICAgIGhhc2hlc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBKb2luVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2RlZmF1bHRGaW5pc2gnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIGZpbmlzaCwgdGhpc0hhc2gsIGZpbmlzaCBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tmdW5jXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7ZnVuY31gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wID0gc3RyZWFtLm5hbWVkU3RyZWFtc1tvdGhlclN0cmVhbV07XG4gICAgaWYgKCF0ZW1wKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgc3RyZWFtOiAke290aGVyU3RyZWFtfWApO1xuICAgIH1cbiAgICAvLyBSZXF1aXJlIG90aGVySGFzaCBvbiB0aGUgb3RoZXIgc3RyZWFtLCBvciBjb3B5IG91cnMgb3ZlciBpZiBpdCBpc24ndFxuICAgIC8vIGFscmVhZHkgZGVmaW5lZFxuICAgIGlmICghdGVtcC5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBoYXNoIGZ1bmN0aW9uIG9uIGVpdGhlciBzdHJlYW06ICR7b3RoZXJIYXNofWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGVtcC5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdID0gc3RyZWFtLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5vdGhlclN0cmVhbSA9IG90aGVyU3RyZWFtO1xuICAgIHRoaXMudGhpc0hhc2ggPSB0aGlzSGFzaDtcbiAgICB0aGlzLm90aGVySGFzaCA9IG90aGVySGFzaDtcbiAgICB0aGlzLmZpbmlzaCA9IGZpbmlzaDtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAuam9pbigke3RoaXMub3RoZXJTdHJlYW19LCAke3RoaXMudGhpc0hhc2h9LCAke3RoaXMub3RoZXJIYXNofSwgJHt0aGlzLmZpbmlzaH0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIHRoaXMub3RoZXJTdHJlYW0gPT09IG90aGVyU3RyZWFtICYmXG4gICAgICB0aGlzLnRoaXNIYXNoID09PSB0aGlzSGFzaCAmJlxuICAgICAgdGhpcy5vdGhlckhhc2ggPT09IG90aGVySGFzaCAmJlxuICAgICAgdGhpcy5maW5pc2ggPT09IGZpbmlzaDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgY29uc3Qgb3RoZXJTdHJlYW0gPSB0aGlzLnN0cmVhbS5uYW1lZFN0cmVhbXNbdGhpcy5vdGhlclN0cmVhbV07XG4gICAgY29uc3QgdGhpc0hhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMudGhpc0hhc2hdO1xuICAgIGNvbnN0IG90aGVySGFzaEZ1bmN0aW9uID0gb3RoZXJTdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5vdGhlckhhc2hdO1xuICAgIGNvbnN0IGZpbmlzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5maW5pc2hdO1xuXG4gICAgLy8gY29uc3QgdGhpc0l0ZXJhdG9yID0gdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKTtcbiAgICAvLyBjb25zdCBvdGhlckl0ZXJhdG9yID0gb3RoZXJTdHJlYW0uaXRlcmF0ZSgpO1xuXG4gICAgY29uc3QgdGhpc0luZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy50aGlzSGFzaCk7XG4gICAgY29uc3Qgb3RoZXJJbmRleCA9IG90aGVyU3RyZWFtLmdldEluZGV4KHRoaXMub3RoZXJIYXNoKTtcblxuICAgIGlmICh0aGlzSW5kZXguY29tcGxldGUpIHtcbiAgICAgIGlmIChvdGhlckluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIC8vIEJlc3Qgb2YgYWxsIHdvcmxkczsgd2UgY2FuIGp1c3Qgam9pbiB0aGUgaW5kZXhlc1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgaGFzaCwgdmFsdWVMaXN0IH0gb2YgdGhpc0luZGV4Lml0ZXJWYWx1ZXMoKSkge1xuICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHZhbHVlTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5lZWQgdG8gaXRlcmF0ZSB0aGUgb3RoZXIgaXRlbXMsIGFuZCB0YWtlIGFkdmFudGFnZSBvZiBvdXIgY29tcGxldGVcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyU3RyZWFtLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgLy8gQWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleDpcbiAgICAgICAgICAgIGF3YWl0IG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG90aGVySW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIG91ciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIHRoZSBvdGhlciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIHRoaXNIYXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgLy8gYWRkIHRoaXNXcmFwcGVkSXRlbSB0byB0aGlzSW5kZXhcbiAgICAgICAgICAgIGF3YWl0IHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVpdGhlciBzdHJlYW0gaXMgZnVsbHkgaW5kZXhlZDsgZm9yIG1vcmUgZGlzdHJpYnV0ZWQgc2FtcGxpbmcsIGdyYWJcbiAgICAgICAgLy8gb25lIGl0ZW0gZnJvbSBlYWNoIHN0cmVhbSBhdCBhIHRpbWUsIGFuZCB1c2UgdGhlIHBhcnRpYWwgaW5kZXhlc1xuICAgICAgICBjb25zdCB0aGlzSXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpO1xuICAgICAgICBsZXQgdGhpc0lzRG9uZSA9IGZhbHNlO1xuICAgICAgICBjb25zdCBvdGhlckl0ZXJhdG9yID0gb3RoZXJTdHJlYW0uaXRlcmF0ZSgpO1xuICAgICAgICBsZXQgb3RoZXJJc0RvbmUgPSBmYWxzZTtcblxuICAgICAgICB3aGlsZSAoIXRoaXNJc0RvbmUgfHwgIW90aGVySXNEb25lKSB7XG4gICAgICAgICAgLy8gVGFrZSBvbmUgc2FtcGxlIGZyb20gdGhpcyBzdHJlYW1cbiAgICAgICAgICBsZXQgdGVtcCA9IGF3YWl0IHRoaXNJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgdGhpc0lzRG9uZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICAgIHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm93IGZvciBhIHNhbXBsZSBmcm9tIHRoZSBvdGhlciBzdHJlYW1cbiAgICAgICAgICB0ZW1wID0gYXdhaXQgb3RoZXJJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgb3RoZXJJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBvdGhlcldyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4XG4gICAgICAgICAgICAgIG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBKb2luVG9rZW47XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi4vU3RyZWFtLmpzJztcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIHRoaXMuc2VsZWN0b3IgPSBvcHRpb25zLnNlbGVjdG9yIHx8IGByb290LnZhbHVlcygpYDtcbiAgICB0aGlzLl9jdXN0b21DbGFzc05hbWUgPSBvcHRpb25zLmN1c3RvbU5hbWUgfHwgbnVsbDtcbiAgICB0aGlzLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3Iob3B0aW9ucy5zZWxlY3Rvcik7XG4gICAgdGhpcy5pbmRleGVzID0gb3B0aW9ucy5pbmRleGVzIHx8IHt9O1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBjbGFzc1R5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZSxcbiAgICAgIHNlbGVjdG9yOiB0aGlzLnNlbGVjdG9yLFxuICAgICAgY3VzdG9tTmFtZTogdGhpcy5fY3VzdG9tQ2xhc3NOYW1lLFxuICAgICAgaW5kZXhlczoge31cbiAgICB9O1xuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKHRoaXMuaW5kZXhlcykubWFwKGFzeW5jIChbZnVuY05hbWUsIGluZGV4XSkgPT4ge1xuICAgICAgaWYgKGluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIHJlc3VsdC5pbmRleGVzW2Z1bmNOYW1lXSA9IGF3YWl0IGluZGV4LnRvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgfSkpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgd3JhcCAob3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jdXN0b21DbGFzc05hbWUgfHwgJ2NsYXNzIG5hbWUgYXV0by1pbmZlcmVuY2Ugbm90IGltcGxlbWVudGVkJztcbiAgfVxuICBnZXRTdHJlYW0gKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmIChvcHRpb25zLnJlc2V0IHx8ICF0aGlzLl9zdHJlYW0pIHtcbiAgICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnRva2VuQ2xhc3NMaXN0O1xuICAgICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IHRoaXMubmFtZWRGdW5jdGlvbnM7XG4gICAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gdGhpcztcbiAgICAgIG9wdGlvbnMuaW5kZXhlcyA9IHRoaXMuaW5kZXhlcztcbiAgICAgIHRoaXMuX3N0cmVhbSA9IG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9zdHJlYW07XG4gIH1cbiAgaXNTdXBlclNldE9mVG9rZW5MaXN0ICh0b2tlbkxpc3QpIHtcbiAgICBpZiAodG9rZW5MaXN0Lmxlbmd0aCAhPT0gdGhpcy50b2tlbkxpc3QubGVuZ3RoKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5ldmVyeSgodG9rZW4sIGkpID0+IHRva2VuLmlzU3VwZXJTZXRPZih0b2tlbkxpc3RbaV0pKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXI7XG4gICAgdGhpcy5lZGdlU2VsZWN0b3JzID0gb3B0aW9ucy5lZGdlU2VsZWN0b3JzIHx8IHt9O1xuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuZWRnZVNlbGVjdG9ycykuZm9yRWFjaCgoW3NlbGVjdG9yLCB7IG5vZGVIYXNoLCBlZGdlSGFzaCB9XSkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBub2RlSGFzaCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgbm9kZUhhc2ggPSBuZXcgRnVuY3Rpb24obm9kZUhhc2gpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIGVkZ2VIYXNoID09PSAnc3RyaW5nJykge1xuICAgICAgICBlZGdlSGFzaCA9IG5ldyBGdW5jdGlvbihlZGdlSGFzaCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgIH1cbiAgICAgIHRoaXMuZWRnZVNlbGVjdG9yc1tzZWxlY3Rvcl0gPSB7IG5vZGVIYXNoLCBlZGdlSGFzaCB9O1xuICAgIH0pO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICAvLyBUT0RPOiBhIGJhYmVsIGJ1ZyAoaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8zOTMwKVxuICAgIC8vIHByZXZlbnRzIGBhd2FpdCBzdXBlcmA7IHRoaXMgaXMgYSB3b3JrYXJvdW5kOlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEdlbmVyaWNDbGFzcy5wcm90b3R5cGUudG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuZWRnZVNlbGVjdG9ycyA9IHt9O1xuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuZWRnZVNlbGVjdG9ycykuZm9yRWFjaCgoW3NlbGVjdG9yLCB7IG5vZGVIYXNoLCBlZGdlSGFzaCB9XSkgPT4ge1xuICAgICAgbm9kZUhhc2ggPSBub2RlSGFzaC50b1N0cmluZygpO1xuICAgICAgZWRnZUhhc2ggPSBlZGdlSGFzaC50b1N0cmluZygpO1xuICAgICAgcmVzdWx0LmVkZ2VTZWxlY3RvcnNbc2VsZWN0b3JdID0geyBub2RlSGFzaCwgZWRnZUhhc2ggfTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIHRoaXNIYXNoLCBvdGhlckhhc2ggfSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG4gICAgdGhpcy5zb3VyY2VTZWxlY3RvciA9IG9wdGlvbnMuc291cmNlU2VsZWN0b3IgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldFNlbGVjdG9yID0gb3B0aW9ucy50YXJnZXRTZWxlY3RvciB8fCBudWxsO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICAvLyBUT0RPOiBhIGJhYmVsIGJ1ZyAoaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8zOTMwKVxuICAgIC8vIHByZXZlbnRzIGBhd2FpdCBzdXBlcmA7IHRoaXMgaXMgYSB3b3JrYXJvdW5kOlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEdlbmVyaWNDbGFzcy5wcm90b3R5cGUudG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuc291cmNlU2VsZWN0b3IgPSB0aGlzLnNvdXJjZVNlbGVjdG9yO1xuICAgIHJlc3VsdC50YXJnZXRTZWxlY3RvciA9IHRoaXMudGFyZ2V0U2VsZWN0b3I7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCBkaXJlY3Rpb24sIG5vZGVIYXNoLCBlZGdlSGFzaCB9KSB7XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIGlmICh0aGlzLnNvdXJjZVNlbGVjdG9yKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZVNlbGVjdG9yXS5lZGdlU2VsZWN0b3JzW3RoaXMuc2VsZWN0b3JdO1xuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VTZWxlY3RvciA9IG5vZGVDbGFzcy5zZWxlY3RvcjtcbiAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIGlmICh0aGlzLnRhcmdldFNlbGVjdG9yKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldFNlbGVjdG9yXS5lZGdlU2VsZWN0b3JzW3RoaXMuc2VsZWN0b3JdO1xuICAgICAgfVxuICAgICAgdGhpcy50YXJnZXRTZWxlY3RvciA9IG5vZGVDbGFzcy5zZWxlY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF0aGlzLnNvdXJjZVNlbGVjdG9yKSB7XG4gICAgICAgIHRoaXMuc291cmNlU2VsZWN0b3IgPSBub2RlQ2xhc3Muc2VsZWN0b3I7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLnRhcmdldFNlbGVjdG9yKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0U2VsZWN0b3IgPSBub2RlQ2xhc3Muc2VsZWN0b3I7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNvdXJjZSBhbmQgdGFyZ2V0IGFyZSBhbHJlYWR5IGRlZmluZWQ7IHBsZWFzZSBzcGVjaWZ5IGEgZGlyZWN0aW9uIHRvIG92ZXJyaWRlYCk7XG4gICAgICB9XG4gICAgfVxuICAgIG5vZGVDbGFzcy5lZGdlU2VsZWN0b3JzW3RoaXMuc2VsZWN0b3JdID0geyBub2RlSGFzaCwgZWRnZUhhc2ggfTtcbiAgfVxuICBnZXRTdHJlYW0gKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMud3JhcHBlZFBhcmVudCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMucmF3SXRlbSA9IHJhd0l0ZW07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJjbGFzcyBJbk1lbW9yeUluZGV4IHtcbiAgY29uc3RydWN0b3IgKHsgZW50cmllcyA9IHt9LCBjb21wbGV0ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXM7XG4gICAgdGhpcy5jb21wbGV0ZSA9IGNvbXBsZXRlO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzO1xuICB9XG4gIGFzeW5jICogaXRlckVudHJpZXMgKCkge1xuICAgIGZvciAoY29uc3QgW2hhc2gsIHZhbHVlTGlzdF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgeyBoYXNoLCB2YWx1ZUxpc3QgfTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVySGFzaGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IGhhc2ggb2YgT2JqZWN0LmtleXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgaGFzaDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyVmFsdWVMaXN0cyAoKSB7XG4gICAgZm9yIChjb25zdCB2YWx1ZUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB2YWx1ZUxpc3Q7XG4gICAgfVxuICB9XG4gIGFzeW5jIGdldFZhbHVlTGlzdCAoaGFzaCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXNbaGFzaF0gfHwgW107XG4gIH1cbiAgYXN5bmMgYWRkVmFsdWUgKGhhc2gsIHZhbHVlKSB7XG4gICAgLy8gVE9ETzogYWRkIHNvbWUga2luZCBvZiB3YXJuaW5nIGlmIHRoaXMgaXMgZ2V0dGluZyBiaWc/XG4gICAgdGhpcy5lbnRyaWVzW2hhc2hdID0gYXdhaXQgdGhpcy5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbk1lbW9yeUluZGV4O1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4vU3RyZWFtLmpzJztcbmltcG9ydCAqIGFzIFRPS0VOUyBmcm9tICcuL1Rva2Vucy9Ub2tlbnMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcbmltcG9ydCAqIGFzIElOREVYRVMgZnJvbSAnLi9JbmRleGVzL0luZGV4ZXMuanMnO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoRmlsZVJlYWRlciwgbG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBlaXRoZXIgd2luZG93LmxvY2FsU3RvcmFnZSBvciBudWxsXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG4gICAgdGhpcy5EQVRBTElCX0ZPUk1BVFMgPSB7XG4gICAgICAnanNvbic6ICdqc29uJyxcbiAgICAgICdjc3YnOiAnY3N2JyxcbiAgICAgICd0c3YnOiAndHN2JyxcbiAgICAgICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICAgICAndHJlZWpzb24nOiAndHJlZWpzb24nXG4gICAgfTtcblxuICAgIHRoaXMuVFJVVEhZX1NUUklOR1MgPSB7XG4gICAgICAndHJ1ZSc6IHRydWUsXG4gICAgICAneWVzJzogdHJ1ZSxcbiAgICAgICd5JzogdHJ1ZVxuICAgIH07XG4gICAgdGhpcy5GQUxTRVlfU1RSSU5HUyA9IHtcbiAgICAgICdmYWxzZSc6IHRydWUsXG4gICAgICAnbm8nOiB0cnVlLFxuICAgICAgJ24nOiB0cnVlXG4gICAgfTtcblxuICAgIC8vIEFjY2VzcyB0byBjb3JlIGNsYXNzZXMgdmlhIHRoZSBtYWluIGxpYnJhcnkgaGVscHMgYXZvaWQgY2lyY3VsYXIgaW1wb3J0c1xuICAgIHRoaXMuVE9LRU5TID0gVE9LRU5TO1xuICAgIHRoaXMuQ0xBU1NFUyA9IENMQVNTRVM7XG4gICAgdGhpcy5XUkFQUEVSUyA9IFdSQVBQRVJTO1xuICAgIHRoaXMuSU5ERVhFUyA9IElOREVYRVM7XG5cbiAgICAvLyBNb25rZXktcGF0Y2ggYXZhaWxhYmxlIHRva2VucyBhcyBmdW5jdGlvbnMgb250byB0aGUgU3RyZWFtIGNsYXNzXG4gICAgZm9yIChjb25zdCB0b2tlbkNsYXNzTmFtZSBpbiB0aGlzLlRPS0VOUykge1xuICAgICAgY29uc3QgVG9rZW5DbGFzcyA9IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXTtcbiAgICAgIFN0cmVhbS5wcm90b3R5cGVbVG9rZW5DbGFzcy5sb3dlckNhbWVsQ2FzZVR5cGVdID0gZnVuY3Rpb24gKGFyZ0xpc3QsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXh0ZW5kKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBEZWZhdWx0IG5hbWVkIGZ1bmN0aW9uc1xuICAgIHRoaXMuTkFNRURfRlVOQ1RJT05TID0ge1xuICAgICAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7IHlpZWxkIHdyYXBwZWRJdGVtLnJhd0l0ZW07IH0sXG4gICAgICBrZXk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7XG4gICAgICAgIGlmICghd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEdyYW5kcGFyZW50IGlzIG5vdCBhbiBvYmplY3QgLyBhcnJheWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICBpZiAoIShwYXJlbnRUeXBlID09PSAnbnVtYmVyJyB8fCBwYXJlbnRUeXBlID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXJlbnQgaXNuJ3QgYSBrZXkgLyBpbmRleGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRGaW5pc2g6IGZ1bmN0aW9uICogKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkge1xuICAgICAgICB5aWVsZCBbXG4gICAgICAgICAgdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0sXG4gICAgICAgICAgb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgIF07XG4gICAgICB9LFxuICAgICAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgICAgIG5vb3A6ICgpID0+IHt9XG4gICAgfTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMucm9vdCA9IHRoaXMubG9hZFJvb3QoKTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMubG9hZENsYXNzZXMoKTtcbiAgfVxuXG4gIGxvYWRSb290ICgpIHtcbiAgICBsZXQgcm9vdCA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ211cmVfcm9vdCcpO1xuICAgIHJvb3QgPSByb290ID8gSlNPTi5wYXJzZShyb290KSA6IHt9O1xuICAgIHJldHVybiByb290O1xuICB9XG4gIGFzeW5jIHNhdmVSb290ICgpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ211cmVfcm9vdCcsIEpTT04uc3RyaW5naWZ5KHRoaXMucm9vdCkpO1xuICAgIH1cbiAgfVxuICBsb2FkQ2xhc3NlcyAoKSB7XG4gICAgbGV0IGNsYXNzZXMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtdXJlX2NsYXNzZXMnKTtcbiAgICBjbGFzc2VzID0gY2xhc3NlcyA/IEpTT04ucGFyc2UoY2xhc3NlcykgOiB7fTtcbiAgICBPYmplY3QuZW50cmllcyhjbGFzc2VzKS5mb3JFYWNoKChbIGNsYXNzU2VsZWN0b3IsIHJhd0NsYXNzT2JqIF0pID0+IHtcbiAgICAgIE9iamVjdC5lbnRyaWVzKHJhd0NsYXNzT2JqLmluZGV4ZXMpLmZvckVhY2goKFtmdW5jTmFtZSwgcmF3SW5kZXhPYmpdKSA9PiB7XG4gICAgICAgIHJhd0NsYXNzT2JqLmluZGV4ZXNbZnVuY05hbWVdID0gbmV3IHRoaXMuSU5ERVhFUy5Jbk1lbW9yeUluZGV4KHtcbiAgICAgICAgICBlbnRyaWVzOiByYXdJbmRleE9iaiwgY29tcGxldGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNsYXNzVHlwZSA9IHJhd0NsYXNzT2JqLmNsYXNzVHlwZTtcbiAgICAgIGRlbGV0ZSByYXdDbGFzc09iai5jbGFzc1R5cGU7XG4gICAgICByYXdDbGFzc09iai5tdXJlID0gdGhpcztcbiAgICAgIGNsYXNzZXNbY2xhc3NTZWxlY3Rvcl0gPSBuZXcgdGhpcy5DTEFTU0VTW2NsYXNzVHlwZV0ocmF3Q2xhc3NPYmopO1xuICAgIH0pO1xuICAgIHJldHVybiBjbGFzc2VzO1xuICB9XG4gIGFzeW5jIHNhdmVDbGFzc2VzICgpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJhd0NsYXNzZXMgPSB7fTtcbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKHRoaXMuY2xhc3NlcylcbiAgICAgICAgLm1hcChhc3luYyAoWyBjbGFzc1NlbGVjdG9yLCBjbGFzc09iaiBdKSA9PiB7XG4gICAgICAgICAgcmF3Q2xhc3Nlc1tjbGFzc1NlbGVjdG9yXSA9IGF3YWl0IGNsYXNzT2JqLnRvUmF3T2JqZWN0KCk7XG4gICAgICAgIH0pKTtcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ211cmVfY2xhc3NlcycsIEpTT04uc3RyaW5naWZ5KHJhd0NsYXNzZXMpKTtcbiAgICB9XG4gIH1cblxuICBwYXJzZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZykge1xuICAgIGlmICghc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgncm9vdCcpKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFNlbGVjdG9ycyBtdXN0IHN0YXJ0IHdpdGggJ3Jvb3QnYCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yU3RyaW5nLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBpZiAoIXRva2VuU3RyaW5ncykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yIHN0cmluZzogJHtzZWxlY3RvclN0cmluZ31gKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5DbGFzc0xpc3QgPSBbe1xuICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuUm9vdFRva2VuXG4gICAgfV07XG4gICAgdG9rZW5TdHJpbmdzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IGNodW5rLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAoIXRlbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuOiAke2NodW5rfWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdG9rZW5DbGFzc05hbWUgPSB0ZW1wWzFdWzBdLnRvVXBwZXJDYXNlKCkgKyB0ZW1wWzFdLnNsaWNlKDEpICsgJ1Rva2VuJztcbiAgICAgIGNvbnN0IGFyZ0xpc3QgPSB0ZW1wWzJdLnNwbGl0KC8oPzwhXFxcXCksLykubWFwKGQgPT4ge1xuICAgICAgICBkID0gZC50cmltKCk7XG4gICAgICAgIHJldHVybiBkID09PSAnJyA/IHVuZGVmaW5lZCA6IGQ7XG4gICAgICB9KTtcbiAgICAgIGlmICh0b2tlbkNsYXNzTmFtZSA9PT0gJ1ZhbHVlc1Rva2VuJykge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5LZXlzVG9rZW4sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuVmFsdWVUb2tlblxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSxcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIHRva2VuOiAke3RlbXBbMV19YCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRva2VuQ2xhc3NMaXN0O1xuICB9XG5cbiAgc3RyZWFtIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy5wYXJzZVNlbGVjdG9yKG9wdGlvbnMuc2VsZWN0b3IgfHwgYHJvb3QudmFsdWVzKClgKTtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIGFzeW5jIG5ld0NsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYHJvb3QudmFsdWVzKClgIH0pIHtcbiAgICBpZiAodGhpcy5jbGFzc2VzW29wdGlvbnMuc2VsZWN0b3JdKSB7XG4gICAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuc2VsZWN0b3JdO1xuICAgIH1cbiAgICBjb25zdCBDbGFzc1R5cGUgPSBvcHRpb25zLkNsYXNzVHlwZSB8fCB0aGlzLkNMQVNTRVMuR2VuZXJpY0NsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLkNsYXNzVHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLnNlbGVjdG9yXSA9IG5ldyBDbGFzc1R5cGUob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5zZWxlY3Rvcl07XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNEYXRhU291cmNlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlKHtcbiAgICAgIGtleTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFzeW5jIGFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGtleSxcbiAgICBleHRlbnNpb24gPSAndHh0JyxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICBsZXQgb2JqO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBvYmogPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGRlbGV0ZSBvYmouY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNEYXRhU291cmNlKGtleSwgb2JqKTtcbiAgfVxuICBhc3luYyBhZGRTdGF0aWNEYXRhU291cmNlIChrZXksIG9iaikge1xuICAgIHRoaXMucm9vdFtrZXldID0gb2JqO1xuICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBQcm9taXNlLmFsbChbdGhpcy5zYXZlUm9vdCgpLCB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHNlbGVjdG9yOiBgcm9vdC52YWx1ZXMoJyR7a2V5fScpLnZhbHVlcygpYFxuICAgIH0pXSk7XG4gICAgcmV0dXJuIHRlbXBbMV07XG4gIH1cbiAgYXN5bmMgcmVtb3ZlRGF0YVNvdXJjZSAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMucm9vdFtrZXldO1xuICAgIGF3YWl0IHRoaXMuc2F2ZVJvb3QoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG11cmUgPSBuZXcgTXVyZSh3aW5kb3cuRmlsZVJlYWRlciwgd2luZG93LmxvY2FsU3RvcmFnZSk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsImluZGV4Iiwic3BsaWNlIiwiYXJncyIsImZvckVhY2giLCJhcHBseSIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwidGltZW91dCIsInNldFRpbWVvdXQiLCJ0cmlnZ2VyIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsImkiLCJTdHJlYW0iLCJvcHRpb25zIiwibXVyZSIsIm5hbWVkRnVuY3Rpb25zIiwiTkFNRURfRlVOQ1RJT05TIiwibmFtZWRTdHJlYW1zIiwidHJhdmVyc2FsTW9kZSIsImxhdW5jaGVkRnJvbUNsYXNzIiwiaW5kZXhlcyIsInRva2VuTGlzdCIsInRva2VuQ2xhc3NMaXN0IiwibWFwIiwiVG9rZW5DbGFzcyIsImFyZ0xpc3QiLCJXcmFwcGVycyIsImdldFdyYXBwZXJMaXN0IiwiaGFzaEZ1bmN0aW9uTmFtZSIsImhhc2hGdW5jdGlvbiIsIkVycm9yIiwiZ2V0SW5kZXgiLCJpdGVyYXRlIiwibGltaXQiLCJJbmZpbml0eSIsIndyYXBwZWRJdGVtIiwiaGFzaCIsImFkZFZhbHVlIiwidG9rZW4iLCJsZW5ndGgiLCJXcmFwcGVyIiwibG9jYWxUb2tlbkxpc3QiLCJzbGljZSIsInBvdGVudGlhbFdyYXBwZXJzIiwidmFsdWVzIiwiY2xhc3NlcyIsImZpbHRlciIsImNsYXNzT2JqIiwiZXZlcnkiLCJsb2NhbFRva2VuIiwibG9jYWxJbmRleCIsInRva2VuQ2xhc3NTcGVjIiwiaXNTdWJzZXRPZiIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJ3YXJuIiwic2VsZWN0b3IiLCJqb2luIiwicGFyc2VTZWxlY3RvciIsImNvbmNhdCIsIndyYXBwZWRQYXJlbnQiLCJyYXdJdGVtIiwiaGFzaGVzIiwid3JhcHBlckluZGV4IiwidGVtcCIsIlByb21pc2UiLCJhbGwiLCJlbnRyaWVzIiwicmVkdWNlIiwicHJvbWlzZUxpc3QiLCJjb21wbGV0ZSIsImxhc3RUb2tlbiIsIklOREVYRVMiLCJJbk1lbW9yeUluZGV4IiwicmVidWlsZEluZGV4ZXMiLCJpdGVyYXRvciIsIm5leHQiLCJkb25lIiwidmFsdWUiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJjb25zdHJ1Y3RvciIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiQmFzZVRva2VuIiwic3RyZWFtIiwidG9Mb3dlckNhc2UiLCJhbmNlc3RvclRva2VucyIsInBhcmVudFRva2VuIiwieWllbGRlZFNvbWV0aGluZyIsImRlYnVnIiwiVHlwZUVycm9yIiwiZXhlYyIsIm5hbWUiLCJSb290VG9rZW4iLCJ3cmFwIiwicm9vdCIsIktleXNUb2tlbiIsIm1hdGNoQWxsIiwia2V5cyIsInJhbmdlcyIsInVuZGVmaW5lZCIsImFyZyIsIm1hdGNoIiwiZCIsInBhcnNlSW50IiwiaXNOYU4iLCJsb3ciLCJoaWdoIiwibnVtIiwiTnVtYmVyIiwiU3ludGF4RXJyb3IiLCJKU09OIiwic3RyaW5naWZ5IiwiY29uc29saWRhdGVSYW5nZXMiLCJzZWxlY3RzTm90aGluZyIsIm5ld1JhbmdlcyIsInNvcnQiLCJhIiwiYiIsImN1cnJlbnRSYW5nZSIsIm90aGVyVG9rZW4iLCJuZXdLZXlzIiwia2V5IiwiYWxsUG9pbnRzIiwiYWdnIiwicmFuZ2UiLCJpbmNsdWRlIiwiZXhjbHVkZSIsImRpZmYiLCJkaWZmZXJlbmNlIiwiaXRlcmF0ZVBhcmVudCIsIk1hdGgiLCJtYXgiLCJtaW4iLCJoYXNPd25Qcm9wZXJ0eSIsIlZhbHVlVG9rZW4iLCJvYmoiLCJrZXlUeXBlIiwiRXZhbHVhdGVUb2tlbiIsIm5ld1N0cmVhbSIsImZvcmsiLCJlcnIiLCJNYXBUb2tlbiIsImdlbmVyYXRvciIsIm1hcHBlZFJhd0l0ZW0iLCJQcm9tb3RlVG9rZW4iLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwibWFwRnVuY3Rpb24iLCJyZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiIsImhhc2hJbmRleCIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJnZXRWYWx1ZUxpc3QiLCJKb2luVG9rZW4iLCJvdGhlclN0cmVhbSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiZmluaXNoIiwidGhpc0hhc2hGdW5jdGlvbiIsIm90aGVySGFzaEZ1bmN0aW9uIiwiZmluaXNoRnVuY3Rpb24iLCJ0aGlzSW5kZXgiLCJvdGhlckluZGV4IiwiaXRlclZhbHVlcyIsInZhbHVlTGlzdCIsIm90aGVyTGlzdCIsIm90aGVyV3JhcHBlZEl0ZW0iLCJ0aGlzV3JhcHBlZEl0ZW0iLCJ0aGlzTGlzdCIsInRoaXNJdGVyYXRvciIsInRoaXNJc0RvbmUiLCJvdGhlckl0ZXJhdG9yIiwib3RoZXJJc0RvbmUiLCJHZW5lcmljQ2xhc3MiLCJfY3VzdG9tQ2xhc3NOYW1lIiwiY3VzdG9tTmFtZSIsInJlc3VsdCIsImZ1bmNOYW1lIiwidG9SYXdPYmplY3QiLCJjbGFzc05hbWUiLCJyZXNldCIsIl9zdHJlYW0iLCJpc1N1cGVyU2V0T2YiLCJOb2RlQ2xhc3MiLCJOb2RlV3JhcHBlciIsImVkZ2VTZWxlY3RvcnMiLCJub2RlSGFzaCIsImVkZ2VIYXNoIiwiRnVuY3Rpb24iLCJwcm90b3R5cGUiLCJ0b1N0cmluZyIsIm5vZGVDbGFzcyIsImVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIkVkZ2VDbGFzcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlU2VsZWN0b3IiLCJ0YXJnZXRTZWxlY3RvciIsImRpcmVjdGVkIiwiZGlyZWN0aW9uIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiREFUQUxJQl9GT1JNQVRTIiwiVFJVVEhZX1NUUklOR1MiLCJGQUxTRVlfU1RSSU5HUyIsIlRPS0VOUyIsIkNMQVNTRVMiLCJ0b2tlbkNsYXNzTmFtZSIsImV4dGVuZCIsInBhcmVudFR5cGUiLCJzaGExIiwibG9hZFJvb3QiLCJsb2FkQ2xhc3NlcyIsImdldEl0ZW0iLCJwYXJzZSIsInNldEl0ZW0iLCJjbGFzc1NlbGVjdG9yIiwicmF3Q2xhc3NPYmoiLCJyYXdJbmRleE9iaiIsImNsYXNzVHlwZSIsInJhd0NsYXNzZXMiLCJzZWxlY3RvclN0cmluZyIsInN0YXJ0c1dpdGgiLCJ0b2tlblN0cmluZ3MiLCJjaHVuayIsInRvVXBwZXJDYXNlIiwic3BsaXQiLCJ0cmltIiwiQ2xhc3NUeXBlIiwic2F2ZUNsYXNzZXMiLCJjaGFyc2V0IiwiZmlsZU9iaiIsImZpbGVNQiIsInNpemUiLCJza2lwU2l6ZUNoZWNrIiwidGV4dCIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiZW5jb2RpbmciLCJhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UiLCJleHRlbnNpb25PdmVycmlkZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY0RhdGFTb3VyY2UiLCJzYXZlUm9vdCIsIm5ld0NsYXNzIiwid2luZG93IiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLE1BQU1BLG1CQUFtQixVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7a0JBQ2Y7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGFBQUwsR0FBcUIsRUFBckI7V0FDS0MsY0FBTCxHQUFzQixFQUF0Qjs7T0FFRUMsU0FBSixFQUFlQyxRQUFmLEVBQXlCQyx1QkFBekIsRUFBa0Q7VUFDNUMsQ0FBQyxLQUFLSixhQUFMLENBQW1CRSxTQUFuQixDQUFMLEVBQW9DO2FBQzdCRixhQUFMLENBQW1CRSxTQUFuQixJQUFnQyxFQUFoQzs7VUFFRSxDQUFDRSx1QkFBTCxFQUE4QjtZQUN4QixLQUFLSixhQUFMLENBQW1CRSxTQUFuQixFQUE4QkcsT0FBOUIsQ0FBc0NGLFFBQXRDLE1BQW9ELENBQUMsQ0FBekQsRUFBNEQ7Ozs7V0FJekRILGFBQUwsQ0FBbUJFLFNBQW5CLEVBQThCSSxJQUE5QixDQUFtQ0gsUUFBbkM7O1FBRUdELFNBQUwsRUFBZ0JDLFFBQWhCLEVBQTBCO1VBQ3BCLEtBQUtILGFBQUwsQ0FBbUJFLFNBQW5CLENBQUosRUFBbUM7WUFDN0IsQ0FBQ0MsUUFBTCxFQUFlO2lCQUNOLEtBQUtILGFBQUwsQ0FBbUJFLFNBQW5CLENBQVA7U0FERixNQUVPO2NBQ0RLLFFBQVEsS0FBS1AsYUFBTCxDQUFtQkUsU0FBbkIsRUFBOEJHLE9BQTlCLENBQXNDRixRQUF0QyxDQUFaO2NBQ0lJLFNBQVMsQ0FBYixFQUFnQjtpQkFDVFAsYUFBTCxDQUFtQkUsU0FBbkIsRUFBOEJNLE1BQTlCLENBQXFDRCxLQUFyQyxFQUE0QyxDQUE1Qzs7Ozs7WUFLQ0wsU0FBVCxFQUFvQixHQUFHTyxJQUF2QixFQUE2QjtVQUN2QixLQUFLVCxhQUFMLENBQW1CRSxTQUFuQixDQUFKLEVBQW1D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
