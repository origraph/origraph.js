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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL0NvbnN0cnVjdHMvR2VuZXJpY0NvbnN0cnVjdC5qcyIsIi4uL3NyYy9Db25zdHJ1Y3RzL05vZGVDb25zdHJ1Y3QuanMiLCIuLi9zcmMvQ29uc3RydWN0cy9FZGdlQ29uc3RydWN0LmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJpbXBvcnQgbWQ1IGZyb20gJ2JsdWVpbXAtbWQ1JztcblxuY29uc3QgREVGQVVMVF9GVU5DVElPTlMgPSB7XG4gIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkUGFyZW50KSB7IHlpZWxkIHdyYXBwZWRQYXJlbnQucmF3SXRlbTsgfSxcbiAgbWQ1OiAod3JhcHBlZFBhcmVudCkgPT4gbWQ1KHdyYXBwZWRQYXJlbnQucmF3SXRlbSksXG4gIG5vb3A6ICgpID0+IHt9XG59O1xuXG5jbGFzcyBTdHJlYW0ge1xuICBjb25zdHJ1Y3RvciAoe1xuICAgIG11cmUsXG4gICAgc2VsZWN0b3IgPSAncm9vdCcsXG4gICAgZnVuY3Rpb25zID0ge30sXG4gICAgc3RyZWFtcyA9IHt9LFxuICAgIGVycm9yTW9kZSA9ICdwZXJtaXNzaXZlJyxcbiAgICB0cmF2ZXJzYWxNb2RlID0gJ0RGUydcbiAgfSkge1xuICAgIHRoaXMubXVyZSA9IG11cmU7XG5cbiAgICB0aGlzLnRva2VuTGlzdCA9IHRoaXMucGFyc2VTZWxlY3RvcihzZWxlY3Rvcik7XG5cbiAgICB0aGlzLmZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfRlVOQ1RJT05TLCBmdW5jdGlvbnMpO1xuICAgIHRoaXMuc3RyZWFtcyA9IHN0cmVhbXM7XG4gICAgdGhpcy5lcnJvck1vZGUgPSBlcnJvck1vZGU7XG4gICAgdGhpcy50cmF2ZXJzYWxNb2RlID0gdHJhdmVyc2FsTW9kZTtcbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5qb2luKCcnKTtcbiAgfVxuICBwYXJzZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZykge1xuICAgIGlmICghc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgncm9vdCcpKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFNlbGVjdG9ycyBtdXN0IHN0YXJ0IHdpdGggJ3Jvb3QnYCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yU3RyaW5nLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBpZiAoIXRva2VuU3RyaW5ncykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yIHN0cmluZzogJHtzZWxlY3RvclN0cmluZ31gKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5MaXN0ID0gW25ldyB0aGlzLm11cmUuVE9LRU5TLlJvb3RUb2tlbih0aGlzKV07XG4gICAgdG9rZW5TdHJpbmdzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IGNodW5rLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAoIXRlbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuOiAke2NodW5rfWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdG9rZW5DbGFzc05hbWUgPSB0ZW1wWzFdWzBdLnRvVXBwZXJDYXNlKCkgKyB0ZW1wWzFdLnNsaWNlKDEpICsgJ1Rva2VuJztcbiAgICAgIGNvbnN0IGFyZ0xpc3QgPSB0ZW1wWzJdLnNwbGl0KC8oPzwhXFxcXCksLykubWFwKGQgPT4gZC50cmltKCkpO1xuICAgICAgaWYgKHRva2VuQ2xhc3NOYW1lID09PSAnVmFsdWVzVG9rZW4nKSB7XG4gICAgICAgIHRva2VuTGlzdC5wdXNoKG5ldyB0aGlzLm11cmUuVE9LRU5TLktleXNUb2tlbih0aGlzLCBhcmdMaXN0KSk7XG4gICAgICAgIHRva2VuTGlzdC5wdXNoKG5ldyB0aGlzLm11cmUuVE9LRU5TLlZhbHVlVG9rZW4odGhpcywgW10pKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5tdXJlLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0pIHtcbiAgICAgICAgdG9rZW5MaXN0LnB1c2gobmV3IHRoaXMubXVyZS5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKHRoaXMsIGFyZ0xpc3QpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biB0b2tlbjogJHt0ZW1wWzFdfWApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0b2tlbkxpc3Q7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICBpZiAodGhpcy50cmF2ZXJzYWxNb2RlID09PSAnQkZTJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBCcmVhZHRoLWZpcnN0IGl0ZXJhdGlvbiBpcyBub3QgeWV0IGltcGxlbWVudGVkLmApO1xuICAgIH0gZWxzZSBpZiAodGhpcy50cmF2ZXJzYWxNb2RlID09PSAnREZTJykge1xuICAgICAgY29uc3QgZGVlcEhlbHBlciA9IHRoaXMuZGVlcEhlbHBlcih0aGlzLnRva2VuTGlzdCwgdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSk7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIGRlZXBIZWxwZXIpIHtcbiAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0cmF2ZXJzYWxNb2RlOiAke3RoaXMudHJhdmVyc2FsTW9kZX1gKTtcbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIFRoaXMgaGVscHMgZGVwdGgtZmlyc3QgaXRlcmF0aW9uICh3ZSBvbmx5IHdhbnQgdG8geWllbGQgZmluaXNoZWQgcGF0aHMsIHNvXG4gICAqIGl0IGxhemlseSBhc2tzIGZvciB0aGVtIG9uZSBhdCBhIHRpbWUgZnJvbSB0aGUgKmZpbmFsKiB0b2tlbiwgcmVjdXJzaXZlbHlcbiAgICogYXNraW5nIGVhY2ggcHJlY2VkaW5nIHRva2VuIHRvIHlpZWxkIGRlcGVuZGVudCBwYXRocyBvbmx5IGFzIG5lZWRlZClcbiAgICovXG4gIGFzeW5jICogZGVlcEhlbHBlciAodG9rZW5MaXN0LCBpKSB7XG4gICAgaWYgKGkgPT09IDApIHtcbiAgICAgIHlpZWxkICogYXdhaXQgdG9rZW5MaXN0WzBdLm5hdmlnYXRlKCk7IC8vIFRoZSBmaXJzdCB0b2tlbiBpcyBhbHdheXMgdGhlIHJvb3RcbiAgICB9IGVsc2Uge1xuICAgICAgZm9yIGF3YWl0IChsZXQgd3JhcHBlZFBhcmVudCBvZiB0aGlzLmRlZXBIZWxwZXIodG9rZW5MaXN0LCBpIC0gMSkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB5aWVsZCAqIGF3YWl0IHRva2VuTGlzdFtpXS5uYXZpZ2F0ZSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKHRoaXMuZXJyb3JNb2RlICE9PSAncGVybWlzc2l2ZScgfHxcbiAgICAgICAgICAgICEoZXJyIGluc3RhbmNlb2YgVHlwZUVycm9yICYmIGVyciBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSkge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jICogc2FtcGxlICh7IGxpbWl0ID0gMTAgfSkge1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgfVxuICB9XG5cbiAgZXh0ZW5kIChUb2tlbkNsYXNzLCBhcmdMaXN0LCBmdW5jdGlvbnMgPSB7fSwgc3RyZWFtcyA9IHt9KSB7XG4gICAgY29uc3QgbmV3U3RyZWFtID0gbmV3IFN0cmVhbSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICBmdW5jdGlvbnM6IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuZnVuY3Rpb25zLCBmdW5jdGlvbnMpLFxuICAgICAgc3RyZWFtczogT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5zdHJlYW1zLCBzdHJlYW1zKSxcbiAgICAgIG1vZGU6IHRoaXMubW9kZVxuICAgIH0pO1xuICAgIG5ld1N0cmVhbS50b2tlbkxpc3QgPSB0aGlzLnRva2VuTGlzdC5jb25jYXQoWyBuZXcgVG9rZW5DbGFzcyhuZXdTdHJlYW0sIGFyZ0xpc3QpIF0pO1xuICAgIHJldHVybiBuZXdTdHJlYW07XG4gIH1cblxuICBpc1N1cGVyU2V0T2ZUb2tlbkxpc3QgKHRva2VuTGlzdCkge1xuICAgIGlmICh0b2tlbkxpc3QubGVuZ3RoICE9PSB0aGlzLnRva2VuTGlzdC5sZW5ndGgpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmV2ZXJ5KCh0b2tlbiwgaSkgPT4gdG9rZW4uaXNTdXBlclNldE9mKHRva2VuTGlzdFtpXSkpO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW07XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZVRva2VuIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgLy8gVGhlIHN0cmluZyB2ZXJzaW9uIG9mIG1vc3QgdG9rZW5zIGNhbiBqdXN0IGJlIGRlcml2ZWQgZnJvbSB0aGUgY2xhc3MgdHlwZVxuICAgIHJldHVybiBgLiR7dGhpcy50eXBlLnRvTG93ZXJDYXNlKCl9KClgO1xuICB9XG4gIGlzU3VwZXJTZXRPZiAob3RoZXJUb2tlbikge1xuICAgIHJldHVybiBvdGhlclRva2VuLmNvbnN0cnVjdG9yID09PSB0aGlzLmNvbnN0cnVjdG9yO1xuICB9XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgKiBuYXZpZ2F0ZSAoKSB7XG4gICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQ6IG51bGwsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IHRoaXMuc3RyZWFtLm11cmUucm9vdFxuICAgIH0pO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYHJvb3RgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgS2V5c1Rva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgYXJnTGlzdCwgeyBtYXRjaEFsbCwga2V5cywgcmFuZ2VzIH0gPSB7fSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKGtleXMgfHwgcmFuZ2VzKSB7XG4gICAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgICAgdGhpcy5yYW5nZXMgPSByYW5nZXM7XG4gICAgfSBlbHNlIGlmICgoYXJnTGlzdCAmJiBhcmdMaXN0Lmxlbmd0aCA9PT0gMSAmJiBhcmdMaXN0WzBdID09PSAnJykgfHwgbWF0Y2hBbGwpIHtcbiAgICAgIHRoaXMubWF0Y2hBbGwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdMaXN0LmZvckVhY2goYXJnID0+IHtcbiAgICAgICAgbGV0IHRlbXAgPSBhcmcubWF0Y2goLyhcXGQrKS0oW1xcZOKInl0rKS8pO1xuICAgICAgICBpZiAodGVtcCAmJiB0ZW1wWzJdID09PSAn4oieJykge1xuICAgICAgICAgIHRlbXBbMl0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gdGVtcCA/IHRlbXAubWFwKGQgPT4gZC5wYXJzZUludChkKSkgOiBudWxsO1xuICAgICAgICBpZiAodGVtcCAmJiAhaXNOYU4odGVtcFsxXSkgJiYgIWlzTmFOKHRlbXBbMl0pKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IHRlbXBbMV07IGkgPD0gdGVtcFsyXTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogdGVtcFsxXSwgaGlnaDogdGVtcFsyXSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSBhcmcubWF0Y2goLycoLiopJy8pO1xuICAgICAgICB0ZW1wID0gdGVtcCAmJiB0ZW1wWzFdID8gdGVtcFsxXSA6IGFyZztcbiAgICAgICAgbGV0IG51bSA9IE51bWJlcih0ZW1wKTtcbiAgICAgICAgaWYgKGlzTmFOKG51bSkgfHwgbnVtICE9PSBwYXJzZUludCh0ZW1wKSkgeyAvLyBsZWF2ZSBub24taW50ZWdlciBudW1iZXJzIGFzIHN0cmluZ3NcbiAgICAgICAgICB0aGlzLmtleXMgPSB0aGlzLmtleXMgfHwge307XG4gICAgICAgICAgdGhpcy5rZXlzW3RlbXBdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IG51bSwgaGlnaDogbnVtIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGlmICghdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEJhZCB0b2tlbiBrZXkocykgLyByYW5nZShzKTogJHtKU09OLnN0cmluZ2lmeShhcmdMaXN0KX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICB0aGlzLnJhbmdlcyA9IHRoaXMuY29uc29saWRhdGVSYW5nZXModGhpcy5yYW5nZXMpO1xuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0c05vdGhpbmcgKCkge1xuICAgIHJldHVybiAhdGhpcy5tYXRjaEFsbCAmJiAhdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcztcbiAgfVxuICBjb25zb2xpZGF0ZVJhbmdlcyAocmFuZ2VzKSB7XG4gICAgLy8gTWVyZ2UgYW55IG92ZXJsYXBwaW5nIHJhbmdlc1xuICAgIGNvbnN0IG5ld1JhbmdlcyA9IFtdO1xuICAgIGNvbnN0IHRlbXAgPSByYW5nZXMuc29ydCgoYSwgYikgPT4gYS5sb3cgLSBiLmxvdyk7XG4gICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWN1cnJlbnRSYW5nZSkge1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfSBlbHNlIGlmICh0ZW1wW2ldLmxvdyA8PSBjdXJyZW50UmFuZ2UuaGlnaCkge1xuICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IHRlbXBbaV0uaGlnaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjdXJyZW50UmFuZ2UpIHtcbiAgICAgIC8vIENvcm5lciBjYXNlOiBhZGQgdGhlIGxhc3QgcmFuZ2VcbiAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgfVxuICAgIHJldHVybiBuZXdSYW5nZXMubGVuZ3RoID4gMCA/IG5ld1JhbmdlcyA6IHVuZGVmaW5lZDtcbiAgfVxuICBkaWZmZXJlbmNlIChvdGhlclRva2VuKSB7XG4gICAgLy8gQ29tcHV0ZSB3aGF0IGlzIGxlZnQgb2YgdGhpcyBhZnRlciBzdWJ0cmFjdGluZyBvdXQgZXZlcnl0aGluZyBpbiBvdGhlclRva2VuXG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgY29tcHV0ZSB0aGUgZGlmZmVyZW5jZSBvZiB0d28gZGlmZmVyZW50IHRva2VuIHR5cGVzYCk7XG4gICAgfSBlbHNlIGlmIChvdGhlclRva2VuLm1hdGNoQWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGNvbnNvbGUud2FybihgSW5hY2N1cmF0ZSBkaWZmZXJlbmNlIGNvbXB1dGVkISBUT0RPOiBuZWVkIHRvIGZpZ3VyZSBvdXQgaG93IHRvIGludmVydCBjYXRlZ29yaWNhbCBrZXlzIWApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld0tleXMgPSB7fTtcbiAgICAgIGZvciAobGV0IGtleSBpbiAodGhpcy5rZXlzIHx8IHt9KSkge1xuICAgICAgICBpZiAoIW90aGVyVG9rZW4ua2V5cyB8fCAhb3RoZXJUb2tlbi5rZXlzW2tleV0pIHtcbiAgICAgICAgICBuZXdLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3UmFuZ2VzID0gW107XG4gICAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgICAgaWYgKG90aGVyVG9rZW4ucmFuZ2VzKSB7XG4gICAgICAgICAgbGV0IGFsbFBvaW50cyA9IHRoaXMucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICBhbGxQb2ludHMgPSBhbGxQb2ludHMuY29uY2F0KG90aGVyVG9rZW4ucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKSkuc29ydCgpO1xuICAgICAgICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsUG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0geyBsb3c6IGFsbFBvaW50c1tpXS52YWx1ZSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmV4Y2x1ZGUpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS5sb3cgLSAxO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmxvdyA9IGFsbFBvaW50c1tpXS5oaWdoICsgMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdSYW5nZXMgPSB0aGlzLnJhbmdlcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBLZXlzVG9rZW4odGhpcy5tdXJlLCBudWxsLCB7IGtleXM6IG5ld0tleXMsIHJhbmdlczogbmV3UmFuZ2VzIH0pO1xuICAgIH1cbiAgfVxuICBpc1N1cGVyU2V0T2YgKG90aGVyVG9rZW4pIHtcbiAgICBpZiAoIShvdGhlclRva2VuIGluc3RhbmNlb2YgS2V5c1Rva2VuKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBkaWZmID0gb3RoZXJUb2tlbi5kaWZmZXJlbmNlKHRoaXMpO1xuICAgICAgcmV0dXJuIGRpZmYgPT09IG51bGwgfHwgZGlmZi5zZWxlY3RzTm90aGluZztcbiAgICB9XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7IHJldHVybiAnLmtleXMoKSc7IH1cbiAgICByZXR1cm4gJy5rZXlzKCcgKyB0aGlzLnJhbmdlcy5tYXAoKHtsb3csIGhpZ2h9KSA9PiBgJHtsb3d9LSR7aGlnaH1gKVxuICAgICAgLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLmtleXMpLm1hcChrZXkgPT4gYCcke2tleX0nYCkpXG4gICAgICAuam9pbignLCcpICsgJyknO1xuICB9XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEtleXNUb2tlbiBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgfVxuICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBmb3IgKGxldCBrZXkgaW4gd3JhcHBlZFBhcmVudC5yYXdJdGVtKSB7XG4gICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAobGV0IHtsb3csIGhpZ2h9IG9mIHRoaXMucmFuZ2VzIHx8IFtdKSB7XG4gICAgICAgIGxvdyA9IE1hdGgubWF4KDAsIGxvdyk7XG4gICAgICAgIGhpZ2ggPSBNYXRoLm1pbih3cmFwcGVkUGFyZW50LnJhd0l0ZW0ubGVuZ3RoIC0gMSwgaGlnaCk7XG4gICAgICAgIGZvciAobGV0IGkgPSBsb3c7IGkgPD0gaGlnaDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgcmF3SXRlbTogaVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKGxldCBrZXkgaW4gdGhpcy5rZXlzIHx8IHt9KSB7XG4gICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW0uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgS2V5c1Rva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFZhbHVlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgY29uc3Qgb2JqID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgY29uc3Qga2V5ID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgY29uc3Qga2V5VHlwZSA9IHR5cGVvZiBrZXk7XG4gICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IChrZXlUeXBlICE9PSAnc3RyaW5nJyAmJiBrZXlUeXBlICE9PSAnbnVtYmVyJykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgIH1cbiAgICB5aWVsZCB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgcmF3SXRlbTogb2JqW2tleV1cbiAgICB9KTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVmFsdWVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBFdmFsdWF0ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGlmICh0eXBlb2Ygd3JhcHBlZFBhcmVudC52YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEV2YWx1YXRlVG9rZW4gaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgfVxuICAgIGxldCBuZXdTdHJlYW0gPSB0aGlzLnN0cmVhbS5tdXJlLnN0cmVhbSh7XG4gICAgICBzZWxlY3Rvcjogd3JhcHBlZFBhcmVudC52YWx1ZSxcbiAgICAgIGZ1bmN0aW9uczogdGhpcy5zdHJlYW0uZnVuY3Rpb25zLFxuICAgICAgc3RyZWFtczogdGhpcy5zdHJlYW0uc3RyZWFtcyxcbiAgICAgIGVycm9yTW9kZTogdGhpcy5zdHJlYW0uZXJyb3JNb2RlLFxuICAgICAgdHJhdmVyc2FsTW9kZTogdGhpcy5zdHJlYW0udHJhdmVyc2FsTW9kZVxuICAgIH0pO1xuICAgIHlpZWxkICogYXdhaXQgbmV3U3RyZWFtLml0ZXJhdGUoKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXZhbHVhdGVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBNYXBUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoIXN0cmVhbS5mdW5jdGlvbnNbZ2VuZXJhdG9yXSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIGZ1bmN0aW9uOiAke2dlbmVyYXRvcn1gKTtcbiAgICB9XG4gICAgdGhpcy5nZW5lcmF0b3IgPSBzdHJlYW0uZnVuY3Rpb25zW2dlbmVyYXRvcl07XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLm1hcCgke3RoaXMuZ2VuZXJhdG9yfSlgO1xuICB9XG4gIGlzU3VwZXJTZXRPZiAob3RoZXJUb2tlbikge1xuICAgIHJldHVybiBvdGhlclRva2VuLmNvbnN0cnVjdG9yID09PSBNYXBUb2tlbiAmJiBvdGhlclRva2VuLmdlbmVyYXRvciA9PT0gdGhpcy5nZW5lcmF0b3I7XG4gIH1cbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiB0aGlzLmdlbmVyYXRvcih3cmFwcGVkUGFyZW50KSkge1xuICAgICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNYXBUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBQcm9tb3RlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnbWQ1JywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIG1hcCwgaGFzaCwgcmVkdWNlSW5zdGFuY2VzIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLmZ1bmN0aW9uc1tmdW5jXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gZnVuY3Rpb246ICR7ZnVuY31gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5tYXAgPSBtYXA7XG4gICAgdGhpcy5oYXNoID0gaGFzaDtcbiAgICB0aGlzLnJlZHVjZUluc3RhbmNlcyA9IHJlZHVjZUluc3RhbmNlcztcblxuICAgIHRoaXMuc2Vlbkl0ZW1zID0ge307XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLnByb21vdGUoJHt0aGlzLm1hcH0sICR7dGhpcy5oYXNofSwgJHt0aGlzLnJlZHVjZUluc3RhbmNlc30pYDtcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIHRoaXMubWFwKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICBjb25zdCBoYXNoID0gdGhpcy5oYXNoKG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgaWYgKHRoaXMuc2Vlbkl0ZW1zW2hhc2hdKSB7XG4gICAgICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzKHRoaXMuc2Vlbkl0ZW1zW2hhc2hdLCBtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgdGhpcy5zZWVuSXRlbXNbaGFzaF0udHJpZ2dlcigndXBkYXRlJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNlZW5JdGVtc1toYXNoXSA9IHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlVG9rZW47XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY0NvbnN0cnVjdCBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgc2VsZWN0b3IsIGNsYXNzTmFtZXMgPSBbXSB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm11cmUgPSBtdXJlO1xuICAgIHRoaXMuc2VsZWN0b3IgPSBzZWxlY3RvcjtcbiAgICB0aGlzLnN0cmVhbSA9IHRoaXMubXVyZS5zdHJlYW0oeyBzZWxlY3Rvcjogc2VsZWN0b3IgfSk7XG4gICAgdGhpcy5jbGFzc05hbWVzID0gY2xhc3NOYW1lcztcbiAgICB0aGlzLmFubm90YXRpb25zID0gW107XG4gIH1cbiAgd3JhcCAob3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NvbnN0cnVjdCwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ29uc3RydWN0Ly5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NvbnN0cnVjdDtcbiIsImltcG9ydCBHZW5lcmljQ29uc3RydWN0IGZyb20gJy4vR2VuZXJpY0NvbnN0cnVjdC5qcyc7XG5cbmNsYXNzIE5vZGVDb25zdHJ1Y3QgZXh0ZW5kcyBHZW5lcmljQ29uc3RydWN0IHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ29uc3RydWN0O1xuIiwiaW1wb3J0IEdlbmVyaWNDb25zdHJ1Y3QgZnJvbSAnLi9HZW5lcmljQ29uc3RydWN0LmpzJztcblxuY2xhc3MgRWRnZUNvbnN0cnVjdCBleHRlbmRzIEdlbmVyaWNDb25zdHJ1Y3Qge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDb25zdHJ1Y3Q7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMud3JhcHBlZFBhcmVudCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMucmF3SXRlbSA9IHJhd0l0ZW07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4vU3RyZWFtLmpzJztcbmltcG9ydCAqIGFzIFRPS0VOUyBmcm9tICcuL1Rva2Vucy9Ub2tlbnMuanMnO1xuaW1wb3J0ICogYXMgQ09OU1RSVUNUUyBmcm9tICcuL0NvbnN0cnVjdHMvQ29uc3RydWN0cy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy5yb290ID0ge307XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICB0aGlzLlRSVVRIWV9TVFJJTkdTID0ge1xuICAgICAgJ3RydWUnOiB0cnVlLFxuICAgICAgJ3llcyc6IHRydWUsXG4gICAgICAneSc6IHRydWVcbiAgICB9O1xuICAgIHRoaXMuRkFMU0VZX1NUUklOR1MgPSB7XG4gICAgICAnZmFsc2UnOiB0cnVlLFxuICAgICAgJ25vJzogdHJ1ZSxcbiAgICAgICduJzogdHJ1ZVxuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRPS0VOUyA9IFRPS0VOUztcbiAgICB0aGlzLkNPTlNUUlVDVFMgPSBDT05TVFJVQ1RTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcblxuICAgIC8vIE1vbmtleS1wYXRjaCBhdmFpbGFibGUgdG9rZW5zIGFzIGZ1bmN0aW9ucyBvbnRvIHRoZSBTdHJlYW0gY2xhc3NcbiAgICBmb3IgKGNvbnN0IHRva2VuQ2xhc3NOYW1lIGluIHRoaXMuVE9LRU5TKSB7XG4gICAgICBjb25zdCBUb2tlbkNsYXNzID0gdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdO1xuICAgICAgU3RyZWFtLnByb3RvdHlwZVtUb2tlbkNsYXNzLmxvd2VyQ2FtZWxDYXNlVHlwZV0gPSBmdW5jdGlvbiAoYXJnTGlzdCwgZnVuY3Rpb25zLCBzdHJlYW1zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmV4dGVuZChUb2tlbkNsYXNzLCBhcmdMaXN0LCBmdW5jdGlvbnMsIHN0cmVhbXMpO1xuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBzdHJlYW0gKG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cbiAgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgY29uc3QgdG9rZW5MaXN0ID0gW3Rva2VuXTtcbiAgICBsZXQgdGVtcCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgd2hpbGUgKHRlbXAgIT09IG51bGwpIHtcbiAgICAgIHRva2VuTGlzdC51bnNoaWZ0KHRlbXAudG9rZW4pO1xuICAgICAgdGVtcCA9IHRlbXAud3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgZm9yIChsZXQgY2xhc3NTZWxlY3RvciBpbiB0aGlzLmNsYXNzZXMpIHtcbiAgICAgIGNvbnN0IGNvbnN0cnVjdCA9IHRoaXMuY2xhc3Nlc1tjbGFzc1NlbGVjdG9yXTtcbiAgICAgIGlmIChjb25zdHJ1Y3Quc3RyZWFtLmlzU3VwZXJTZXRPZlRva2VuTGlzdCh0b2tlbkxpc3QpKSB7XG4gICAgICAgIHJldHVybiBjb25zdHJ1Y3Qud3JhcCh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IHRoaXMuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgfVxuXG4gIG5ld0NsYXNzICh7IENsYXNzVHlwZSwgc2VsZWN0b3IsIGNsYXNzTmFtZXMgfSkge1xuICAgIGlmICh0aGlzLmNsYXNzZXNbc2VsZWN0b3JdKSB7XG4gICAgICByZXR1cm4gdGhpcy5jbGFzc2VzW3NlbGVjdG9yXTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc2VzW3NlbGVjdG9yXSA9IG5ldyBDbGFzc1R5cGUoeyBtdXJlOiB0aGlzLCBzZWxlY3RvciwgY2xhc3NOYW1lcyB9KTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW3NlbGVjdG9yXTtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY0RhdGFTb3VyY2UoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2Uoe1xuICAgICAga2V5OiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAga2V5LFxuICAgIGV4dGVuc2lvbiA9ICd0eHQnLFxuICAgIHRleHRcbiAgfSkge1xuICAgIGxldCBvYmo7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIG9iaiA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgZGVsZXRlIG9iai5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY0RhdGFTb3VyY2Uoa2V5LCBvYmopO1xuICB9XG4gIGFzeW5jIGFkZFN0YXRpY0RhdGFTb3VyY2UgKGtleSwgb2JqKSB7XG4gICAgdGhpcy5yb290W2tleV0gPSBvYmo7XG4gICAgcmV0dXJuIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IGByb290LnZhbHVlcygnJHtrZXl9JykudmFsdWVzKClgLFxuICAgICAgQ2xhc3NUeXBlOiB0aGlzLkNPTlNUUlVDVFMuR2VuZXJpY0NvbnN0cnVjdCxcbiAgICAgIGNsYXNzTmFtZXM6IFsga2V5IF1cbiAgICB9KTtcbiAgfVxuXG4gIHJlbW92ZURhdGFTb3VyY2UgKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLnJvb3Rba2V5XTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG11cmUgPSBuZXcgTXVyZSh3aW5kb3cuRmlsZVJlYWRlcik7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsImluZGV4Iiwic3BsaWNlIiwiYXJncyIsImZvckVhY2giLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsInRpbWVvdXQiLCJ0cmlnZ2VyIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsImkiLCJERUZBVUxUX0ZVTkNUSU9OUyIsIndyYXBwZWRQYXJlbnQiLCJyYXdJdGVtIiwibWQ1IiwiU3RyZWFtIiwibXVyZSIsInRva2VuTGlzdCIsInBhcnNlU2VsZWN0b3IiLCJzZWxlY3RvciIsImZ1bmN0aW9ucyIsInN0cmVhbXMiLCJlcnJvck1vZGUiLCJ0cmF2ZXJzYWxNb2RlIiwiam9pbiIsInNlbGVjdG9yU3RyaW5nIiwic3RhcnRzV2l0aCIsIlN5bnRheEVycm9yIiwidG9rZW5TdHJpbmdzIiwibWF0Y2giLCJUT0tFTlMiLCJSb290VG9rZW4iLCJjaHVuayIsInRlbXAiLCJ0b2tlbkNsYXNzTmFtZSIsInRvVXBwZXJDYXNlIiwic2xpY2UiLCJhcmdMaXN0Iiwic3BsaXQiLCJtYXAiLCJkIiwidHJpbSIsIktleXNUb2tlbiIsIlZhbHVlVG9rZW4iLCJFcnJvciIsImRlZXBIZWxwZXIiLCJsZW5ndGgiLCJ3cmFwcGVkSXRlbSIsIm5hdmlnYXRlIiwiZXJyIiwiVHlwZUVycm9yIiwibGltaXQiLCJpdGVyYXRvciIsIml0ZXJhdGUiLCJuZXh0IiwiZG9uZSIsInZhbHVlIiwiVG9rZW5DbGFzcyIsIm5ld1N0cmVhbSIsIm1vZGUiLCJjb25jYXQiLCJldmVyeSIsInRva2VuIiwiaXNTdXBlclNldE9mIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwiY29uc3RydWN0b3IiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkJhc2VUb2tlbiIsInN0cmVhbSIsInRvTG93ZXJDYXNlIiwib3RoZXJUb2tlbiIsImV4ZWMiLCJuYW1lIiwid3JhcCIsInJvb3QiLCJtYXRjaEFsbCIsImtleXMiLCJyYW5nZXMiLCJhcmciLCJJbmZpbml0eSIsInBhcnNlSW50IiwiaXNOYU4iLCJsb3ciLCJoaWdoIiwibnVtIiwiTnVtYmVyIiwiSlNPTiIsInN0cmluZ2lmeSIsImNvbnNvbGlkYXRlUmFuZ2VzIiwic2VsZWN0c05vdGhpbmciLCJuZXdSYW5nZXMiLCJzb3J0IiwiYSIsImIiLCJjdXJyZW50UmFuZ2UiLCJ1bmRlZmluZWQiLCJ3YXJuIiwibmV3S2V5cyIsImtleSIsImFsbFBvaW50cyIsInJlZHVjZSIsImFnZyIsInJhbmdlIiwiaW5jbHVkZSIsImV4Y2x1ZGUiLCJkaWZmIiwiZGlmZmVyZW5jZSIsIk1hdGgiLCJtYXgiLCJtaW4iLCJoYXNPd25Qcm9wZXJ0eSIsIm9iaiIsImtleVR5cGUiLCJFdmFsdWF0ZVRva2VuIiwiTWFwVG9rZW4iLCJnZW5lcmF0b3IiLCJtYXBwZWRSYXdJdGVtIiwiUHJvbW90ZVRva2VuIiwiaGFzaCIsInJlZHVjZUluc3RhbmNlcyIsImZ1bmMiLCJzZWVuSXRlbXMiLCJHZW5lcmljQ29uc3RydWN0IiwiY2xhc3NOYW1lcyIsImFubm90YXRpb25zIiwib3B0aW9ucyIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJOb2RlQ29uc3RydWN0IiwiRWRnZUNvbnN0cnVjdCIsIk5vZGVXcmFwcGVyIiwiRWRnZVdyYXBwZXIiLCJNdXJlIiwiRmlsZVJlYWRlciIsIm1pbWUiLCJjbGFzc2VzIiwiREFUQUxJQl9GT1JNQVRTIiwiVFJVVEhZX1NUUklOR1MiLCJGQUxTRVlfU1RSSU5HUyIsIkNPTlNUUlVDVFMiLCJwcm90b3R5cGUiLCJleHRlbmQiLCJ1bnNoaWZ0IiwiY2xhc3NTZWxlY3RvciIsImNvbnN0cnVjdCIsImlzU3VwZXJTZXRPZlRva2VuTGlzdCIsIkNsYXNzVHlwZSIsImNoYXJzZXQiLCJmaWxlT2JqIiwiZmlsZU1CIiwic2l6ZSIsInNraXBTaXplQ2hlY2siLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZXN1bHQiLCJyZWFkQXNUZXh0IiwiZW5jb2RpbmciLCJhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UiLCJleHRlbnNpb25PdmVycmlkZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY0RhdGFTb3VyY2UiLCJuZXdDbGFzcyIsIndpbmRvdyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7QUFBQSxNQUFNQSxtQkFBbUIsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO2tCQUNmO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7O09BRUVDLFNBQUosRUFBZUMsUUFBZixFQUF5QkMsdUJBQXpCLEVBQWtEO1VBQzVDLENBQUMsS0FBS0osYUFBTCxDQUFtQkUsU0FBbkIsQ0FBTCxFQUFvQzthQUM3QkYsYUFBTCxDQUFtQkUsU0FBbkIsSUFBZ0MsRUFBaEM7O1VBRUUsQ0FBQ0UsdUJBQUwsRUFBOEI7WUFDeEIsS0FBS0osYUFBTCxDQUFtQkUsU0FBbkIsRUFBOEJHLE9BQTlCLENBQXNDRixRQUF0QyxNQUFvRCxDQUFDLENBQXpELEVBQTREOzs7O1dBSXpESCxhQUFMLENBQW1CRSxTQUFuQixFQUE4QkksSUFBOUIsQ0FBbUNILFFBQW5DOztRQUVHRCxTQUFMLEVBQWdCQyxRQUFoQixFQUEwQjtVQUNwQixLQUFLSCxhQUFMLENBQW1CRSxTQUFuQixDQUFKLEVBQW1DO1lBQzdCLENB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
