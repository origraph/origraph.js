import mime from 'mime-types';
import datalib from 'datalib';

const TriggerableMixin = function (superclass) {
  return class extends superclass {
    constructor() {
      super(...arguments);
      this._instanceOfTriggerableMixin = true;
      this._eventHandlers = {};
      this._stickyTriggers = {};
    }

    on(eventName, callback) {
      let [event, namespace] = eventName.split(':');
      this._eventHandlers[event] = this._eventHandlers[event] || {
        '': []
      };

      if (!namespace) {
        this._eventHandlers[event][''].push(callback);
      } else {
        this._eventHandlers[event][namespace] = callback;
      }
    }

    off(eventName, callback) {
      let [event, namespace] = eventName.split(':');

      if (this._eventHandlers[event]) {
        if (!namespace) {
          if (!callback) {
            this._eventHandlers[event][''] = [];
          } else {
            let index = this._eventHandlers[event][''].indexOf(callback);

            if (index >= 0) {
              this._eventHandlers[event][''].splice(index, 1);
            }
          }
        } else {
          delete this._eventHandlers[event][namespace];
        }
      }
    }

    trigger(event, ...args) {
      const handleCallback = callback => {
        setTimeout(() => {
          // Add timeout to prevent blocking
          callback.apply(this, args);
        }, 0);
      };

      if (this._eventHandlers[event]) {
        for (const namespace of Object.keys(this._eventHandlers[event])) {
          if (namespace === '') {
            this._eventHandlers[event][''].forEach(handleCallback);
          } else {
            handleCallback(this._eventHandlers[event][namespace]);
          }
        }
      }
    }

    stickyTrigger(eventName, argObj, delay = 10) {
      this._stickyTriggers[eventName] = this._stickyTriggers[eventName] || {
        argObj: {}
      };
      Object.assign(this._stickyTriggers[eventName].argObj, argObj);
      clearTimeout(this._stickyTriggers.timeout);
      this._stickyTriggers.timeout = setTimeout(() => {
        let argObj = this._stickyTriggers[eventName].argObj;
        delete this._stickyTriggers[eventName];
        this.trigger(eventName, argObj);
      }, delay);
    }

  };
};

Object.defineProperty(TriggerableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfTriggerableMixin
});

function _asyncIterator(iterable) {
  var method;

  if (typeof Symbol === "function") {
    if (Symbol.asyncIterator) {
      method = iterable[Symbol.asyncIterator];
      if (method != null) return method.call(iterable);
    }

    if (Symbol.iterator) {
      method = iterable[Symbol.iterator];
      if (method != null) return method.call(iterable);
    }
  }

  throw new TypeError("Object is not async iterable");
}

function _AwaitValue(value) {
  this.wrapped = value;
}

function _AsyncGenerator(gen) {
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
      var wrappedAwait = value instanceof _AwaitValue;
      Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) {
        if (wrappedAwait) {
          resume("next", arg);
          return;
        }

        settle(result.done ? "return" : "normal", arg);
      }, function (err) {
        resume("throw", err);
      });
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
  _AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
    return this;
  };
}

_AsyncGenerator.prototype.next = function (arg) {
  return this._invoke("next", arg);
};

_AsyncGenerator.prototype.throw = function (arg) {
  return this._invoke("throw", arg);
};

_AsyncGenerator.prototype.return = function (arg) {
  return this._invoke("return", arg);
};

function _wrapAsyncGenerator(fn) {
  return function () {
    return new _AsyncGenerator(fn.apply(this, arguments));
  };
}

function _awaitAsyncGenerator(value) {
  return new _AwaitValue(value);
}

function _asyncGeneratorDelegate(inner, awaitWrap) {
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

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor(options) {
    super();
    this.index = options.index;
    this.table = options.table;

    if (this.index === undefined || !this.table) {
      throw new Error(`index and table are required`);
    }

    this.classObj = options.classObj || null;
    this.row = options.row || {};
    this.connectedItems = options.connectedItems || {};
    this.duplicateItems = options.duplicateItems || [];
  }

  registerDuplicate(item) {
    this.duplicateItems.push(item);
  }

  connectItem(item) {
    this.connectedItems[item.table.tableId] = this.connectedItems[item.table.tableId] || [];

    if (this.connectedItems[item.table.tableId].indexOf(item) === -1) {
      this.connectedItems[item.table.tableId].push(item);
    }

    for (const dup of this.duplicateItems) {
      item.connectItem(dup);
      dup.connectItem(item);
    }
  }

  disconnect() {
    for (const itemList of Object.values(this.connectedItems)) {
      for (const item of itemList) {
        const index = (item.connectedItems[this.table.tableId] || []).indexOf(this);

        if (index !== -1) {
          item.connectedItems[this.table.tableId].splice(index, 1);
        }
      }
    }

    this.connectedItems = {};
  }

  get instanceId() {
    return `{"classId":"${this.classObj.classId}","index":"${this.index}"}`;
  }

  get exportId() {
    return `${this.classObj.classId}_${this.index}`;
  }

  equals(item) {
    return this.instanceId === item.instanceId;
  }

  handleLimit(options, iterators) {
    return _wrapAsyncGenerator(function* () {
      let limit = Infinity;

      if (options.limit !== undefined) {
        limit = options.limit;
        delete options.limit;
      }

      let i = 0;

      for (const iterator of iterators) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(iterator), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const item = _value;
            yield item;
            i++;

            if (item === null || i >= limit) {
              return;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
              yield _awaitAsyncGenerator(_iterator.return());
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      }
    })();
  }

  iterateAcrossConnections(tableIds) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // First make sure that all the table caches have been fully built and
      // connected
      yield _awaitAsyncGenerator(Promise.all(tableIds.map(tableId => {
        return _this.classObj.model.tables[tableId].buildCache();
      })));
      yield* _asyncGeneratorDelegate(_asyncIterator(_this._iterateAcrossConnections(tableIds)), _awaitAsyncGenerator);
    })();
  }

  *_iterateAcrossConnections(tableIds) {
    if (this.reset) {
      return;
    }

    const nextTableId = tableIds[0];

    if (tableIds.length === 1) {
      yield* this.connectedItems[nextTableId] || [];
    } else {
      const remainingTableIds = tableIds.slice(1);

      for (const item of this.connectedItems[nextTableId] || []) {
        yield* item._iterateAcrossConnections(remainingTableIds);
      }
    }
  }

}

Object.defineProperty(GenericWrapper, 'type', {
  get() {
    return /(.*)Wrapper/.exec(this.name)[1];
  }

});

class Table extends TriggerableMixin(Introspectable) {
  constructor(options) {
    super();
    this.model = options.model;
    this.tableId = options.tableId;

    if (!this.model || !this.tableId) {
      throw new Error(`model and tableId are required`);
    }

    this._expectedAttributes = options.attributes || {};
    this._observedAttributes = {};
    this._derivedTables = options.derivedTables || {};
    this._derivedAttributeFunctions = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions || {})) {
      this._derivedAttributeFunctions[attr] = this.hydrateFunction(stringifiedFunc);
    }

    this._suppressedAttributes = options.suppressedAttributes || {};
    this._suppressIndex = !!options.suppressIndex;
    this._indexFilter = options.indexFilter && this.hydrateFunction(options.indexFilter) || null;
    this._attributeFilters = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.attributeFilters || {})) {
      this._attributeFilters[attr] = this.hydrateFunction(stringifiedFunc);
    }

    this._limitPromises = {};
  }

  _toRawObject() {
    const result = {
      tableId: this.tableId,
      attributes: this._attributes,
      derivedTables: this._derivedTables,
      derivedAttributeFunctions: {},
      suppressedAttributes: this._suppressedAttributes,
      suppressIndex: this._suppressIndex,
      attributeFilters: {},
      indexFilter: this._indexFilter && this.dehydrateFunction(this._indexFilter) || null
    };

    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this.dehydrateFunction(func);
    }

    for (const [attr, func] of Object.entries(this._attributeFilters)) {
      result.attributeFilters[attr] = this.dehydrateFunction(func);
    }

    return result;
  }

  getSortHash() {
    return this.type;
  }

  hydrateFunction(stringifiedFunc) {
    return new Function(`return ${stringifiedFunc}`)(); // eslint-disable-line no-new-func
  }

  dehydrateFunction(func) {
    let stringifiedFunc = func.toString(); // Istanbul adds some code to functions for computing coverage, that gets
    // included in the stringification process during testing. See:
    // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022

    stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
    return stringifiedFunc;
  }

  iterate(limit = Infinity) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      if (_this._cache) {
        // The cache has already been built; just grab data from it directly
        yield* _asyncGeneratorDelegate(_asyncIterator(_this._cache.slice(0, limit)), _awaitAsyncGenerator);
      } else if (_this._partialCache && _this._partialCache.length >= limit) {
        // The cache isn't finished, but it's already long enough to satisfy this
        // request
        yield* _asyncGeneratorDelegate(_asyncIterator(_this._partialCache.slice(0, limit)), _awaitAsyncGenerator);
      } else {
        // The cache isn't finished building (and maybe didn't even start yet);
        // kick it off, and then wait for enough items to be processed to satisfy
        // the limit
        _this.buildCache();

        yield* _asyncGeneratorDelegate(_asyncIterator((yield _awaitAsyncGenerator(new Promise((resolve, reject) => {
          _this._limitPromises[limit] = _this._limitPromises[limit] || [];

          _this._limitPromises[limit].push({
            resolve,
            reject
          });
        })))), _awaitAsyncGenerator);
      }
    })();
  }

  _iterate(options) {
    return _wrapAsyncGenerator(function* () {
      throw new Error(`this function should be overridden`);
    })();
  }

  async _buildCache(resolve, reject) {
    this._partialCache = [];
    this._partialCacheLookup = {};

    const iterator = this._iterate();

    let i = 0;
    let temp = {
      done: false
    };

    while (!temp.done) {
      temp = await iterator.next();

      if (!this._partialCache || temp === null) {
        // reset() was called before we could finish; we need to let everyone
        // that was waiting on us know that we can't comply
        this.handleReset(reject);
        return;
      }

      if (!temp.done) {
        if (await this._finishItem(temp.value)) {
          // Okay, this item passed all filters, and is ready to be sent out
          // into the world
          this._partialCacheLookup[temp.value.index] = this._partialCache.length;

          this._partialCache.push(temp.value);

          i++;

          for (let limit of Object.keys(this._limitPromises)) {
            limit = Number(limit); // check if we have enough data now to satisfy any waiting requests

            if (limit <= i) {
              for (const {
                resolve
              } of this._limitPromises[limit]) {
                resolve(this._partialCache.slice(0, limit));
              }

              delete this._limitPromises[limit];
            }
          }
        }
      }
    } // Done iterating! We can graduate the partial cache / lookups into
    // finished ones, and satisfy all the requests


    this._cache = this._partialCache;
    delete this._partialCache;
    this._cacheLookup = this._partialCacheLookup;
    delete this._partialCacheLookup;

    for (let limit of Object.keys(this._limitPromises)) {
      limit = Number(limit);

      for (const {
        resolve
      } of this._limitPromises[limit]) {
        resolve(this._cache.slice(0, limit));
      }

      delete this._limitPromises[limit];
    }

    delete this._cachePromise;
    this.trigger('cacheBuilt');
    resolve(this._cache);
  }

  buildCache() {
    if (this._cache) {
      return this._cache;
    } else if (!this._cachePromise) {
      this._cachePromise = new Promise((resolve, reject) => {
        // The setTimeout here is absolutely necessary, or this._cachePromise
        // won't be stored in time for the next buildCache() call that comes
        // through
        setTimeout(() => {
          this._buildCache(resolve, reject);
        }, 0);
      });
    }

    return this._cachePromise;
  }

  reset() {
    const itemsToReset = (this._cache || []).concat(this._partialCache || []);

    for (const item of itemsToReset) {
      item.reset = true;
    }

    delete this._cache;
    delete this._cacheLookup;
    delete this._partialCache;
    delete this._partialCacheLookup;
    delete this._cachePromise;

    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }

    this.trigger('reset');
  }

  handleReset(reject) {
    for (const limit of Object.keys(this._limitPromises)) {
      this._limitPromises[limit].reject();

      delete this._limitPromises;
    }

    reject();
  }

  async countRows() {
    return (await this.buildCache()).length;
  }

  async _finishItem(wrappedItem) {
    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      wrappedItem.row[attr] = func(wrappedItem);

      if (wrappedItem.row[attr] instanceof Promise) {
        (async () => {
          wrappedItem.delayedRow = wrappedItem.delayedRow || {};
          wrappedItem.delayedRow[attr] = await wrappedItem.row[attr];
        })();
      }
    }

    for (const attr in wrappedItem.row) {
      this._observedAttributes[attr] = true;
    }

    for (const attr in this._suppressedAttributes) {
      delete wrappedItem.row[attr];
    }

    let keep = true;

    if (this._indexFilter) {
      keep = this._indexFilter(wrappedItem.index);
    }

    for (const [attr, func] of Object.entries(this._attributeFilters)) {
      keep = keep && (await func((await wrappedItem.row[attr])));

      if (!keep) {
        break;
      }
    }

    if (keep) {
      wrappedItem.trigger('finish');
    } else {
      wrappedItem.disconnect();
      wrappedItem.trigger('filter');
    }

    return keep;
  }

  _wrap(options) {
    options.table = this;
    const classObj = this.classObj;
    const wrappedItem = classObj ? classObj._wrap(options) : new GenericWrapper(options);

    for (const otherItem of options.itemsToConnect || []) {
      wrappedItem.connectItem(otherItem);
      otherItem.connectItem(wrappedItem);
    }

    return wrappedItem;
  }

  get name() {
    throw new Error(`this function should be overridden`);
  }

  getIndexDetails() {
    const details = {
      name: null
    };

    if (this._suppressIndex) {
      details.suppressed = true;
    }

    if (this._indexFilter) {
      details.filtered = true;
    }

    return details;
  }

  getAttributeDetails() {
    const allAttrs = {};

    for (const attr in this._expectedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].expected = true;
    }

    for (const attr in this._observedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].observed = true;
    }

    for (const attr in this._derivedAttributeFunctions) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].derived = true;
    }

    for (const attr in this._suppressedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].suppressed = true;
    }

    for (const attr in this._attributeFilters) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].filtered = true;
    }

    return allAttrs;
  }

  get attributes() {
    return Object.keys(this.getAttributeDetails());
  }

  get currentData() {
    // Allow probing to see whatever data happens to be available
    return {
      data: this._cache || this._partialCache || [],
      lookup: this._cacheLookup || this._partialCacheLookup || {},
      complete: !!this._cache
    };
  }

  async getItem(index = null) {
    if (this._cacheLookup) {
      return index === null ? this._cache[0] : this._cache[this._cacheLookup[index]];
    } else if (this._partialCacheLookup && (index === null && this._partialCache.length > 0 || this._partialCacheLookup[index] !== undefined)) {
      return index === null ? this._partialCache[0] : this._partialCache[this._partialCacheLookup[index]];
    } // Stupid approach when the cache isn't built: interate until we see the
    // index. Subclasses could override this


    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;

    var _iteratorError;

    try {
      for (var _iterator = _asyncIterator(this.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
        const item = _value;

        if (item === null || item.index === index) {
          return item;
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return != null) {
          await _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    return null;
  }

  deriveAttribute(attribute, func) {
    this._derivedAttributeFunctions[attribute] = func;
    this.reset();
    this.model.trigger('update');
  }

  suppressAttribute(attribute) {
    if (attribute === null) {
      this._suppressIndex = true;
    } else {
      this._suppressedAttributes[attribute] = true;
    }

    this.reset();
    this.model.trigger('update');
  }

  addFilter(attribute, func) {
    if (attribute === null) {
      this._indexFilter = func;
    } else {
      this._attributeFilters[attribute] = func;
    }

    this.reset();
    this.model.trigger('update');
  }

  _deriveTable(options) {
    const newTable = this.model.createTable(options);
    this._derivedTables[newTable.tableId] = true;
    this.model.trigger('update');
    return newTable;
  }

  _getExistingTable(options) {
    // Check if the derived table has already been defined
    const existingTable = this.derivedTables.find(tableObj => {
      return Object.entries(options).every(([optionName, optionValue]) => {
        if (optionName === 'type') {
          return tableObj.constructor.name === optionValue;
        } else {
          return tableObj['_' + optionName] === optionValue;
        }
      });
    });
    return existingTable && this.model.tables[existingTable.tableId] || null;
  }

  promote(attribute) {
    const options = {
      type: 'PromotedTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  expand(attribute) {
    const options = {
      type: 'ExpandedTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  unroll(attribute) {
    const options = {
      type: 'UnrolledTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  closedFacet(attribute, values) {
    return values.map(value => {
      const options = {
        type: 'FacetedTable',
        attribute,
        value
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }

  openFacet(attribute, limit = Infinity) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      const values = {};
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this2.iterate(limit)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedItem = _value2;
          const value = yield _awaitAsyncGenerator(wrappedItem.row[attribute]);

          if (!values[value]) {
            values[value] = true;
            const options = {
              type: 'FacetedTable',
              attribute,
              value
            };
            yield _this2._getExistingTable(options) || _this2._deriveTable(options);
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            yield _awaitAsyncGenerator(_iterator2.return());
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    })();
  }

  closedTranspose(indexes) {
    return indexes.map(index => {
      const options = {
        type: 'TransposedTable',
        index
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }

  openTranspose(limit = Infinity) {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator(_this3.iterate(limit)), _step3, _value3; _step3 = yield _awaitAsyncGenerator(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield _awaitAsyncGenerator(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
          const wrappedItem = _value3;
          const options = {
            type: 'TransposedTable',
            index: wrappedItem.index
          };
          yield _this3._getExistingTable(options) || _this3._deriveTable(options);
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
            yield _awaitAsyncGenerator(_iterator3.return());
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }
    })();
  }

  duplicate() {
    return this._deriveTable({
      type: 'DuplicatedTable'
    });
  }

  connect(otherTableList, type = 'ConnectedTable') {
    const newTable = this.model.createTable({
      type
    });
    this._derivedTables[newTable.tableId] = true;

    for (const otherTable of otherTableList) {
      otherTable._derivedTables[newTable.tableId] = true;
    }

    this.model.trigger('update');
    return newTable;
  }

  get classObj() {
    return Object.values(this.model.classes).find(classObj => {
      return classObj.table === this;
    });
  }

  get parentTables() {
    return Object.values(this.model.tables).reduce((agg, tableObj) => {
      if (tableObj._derivedTables[this.tableId]) {
        agg.push(tableObj);
      }

      return agg;
    }, []);
  }

  get derivedTables() {
    return Object.keys(this._derivedTables).map(tableId => {
      return this.model.tables[tableId];
    });
  }

  get inUse() {
    if (Object.keys(this._derivedTables).length > 0) {
      return true;
    }

    return Object.values(this.model.classes).some(classObj => {
      return classObj.tableId === this.tableId || classObj.sourceTableIds.indexOf(this.tableId) !== -1 || classObj.targetTableIds.indexOf(this.tableId) !== -1;
    });
  }

  delete() {
    if (this.inUse) {
      const err = new Error(`Can't delete in-use table ${this.tableId}`);
      err.inUse = true;
      throw err;
    }

    for (const parentTable of this.parentTables) {
      delete parentTable.derivedTables[this.tableId];
    }

    delete this.model.tables[this.tableId];
    this.model.trigger('update');
  }

}

Object.defineProperty(Table, 'type', {
  get() {
    return /(.*)Table/.exec(this.name)[1];
  }

});

class StaticTable extends Table {
  constructor(options) {
    super(options);
    this._name = options.name;
    this._data = options.data || [];

    if (!this._name || !this._data) {
      throw new Error(`name and data are required`);
    }
  }

  get name() {
    return this._name;
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.name = this._name;
    obj.data = this._data;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this._name;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (let index = 0; index < _this._data.length; index++) {
        const item = _this._wrap({
          index,
          row: _this._data[index]
        });

        if (yield _awaitAsyncGenerator(_this._finishItem(item))) {
          yield item;
        }
      }
    })();
  }

}

class StaticDictTable extends Table {
  constructor(options) {
    super(options);
    this._name = options.name;
    this._data = options.data || {};

    if (!this._name || !this._data) {
      throw new Error(`name and data are required`);
    }
  }

  get name() {
    return this._name;
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.name = this._name;
    obj.data = this._data;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this._name;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (const [index, row] of Object.entries(_this._data)) {
        const item = _this._wrap({
          index,
          row
        });

        if (yield _awaitAsyncGenerator(_this._finishItem(item))) {
          yield item;
        }
      }
    })();
  }

}

const SingleParentMixin = function (superclass) {
  return class extends superclass {
    constructor(options) {
      super(options);
      this._instanceOfSingleParentMixin = true;
    }

    get parentTable() {
      const parentTables = this.parentTables;

      if (parentTables.length === 0) {
        throw new Error(`Parent table is required for table of type ${this.type}`);
      } else if (parentTables.length > 1) {
        throw new Error(`Only one parent table allowed for table of type ${this.type}`);
      }

      return parentTables[0];
    }

  };
};

Object.defineProperty(SingleParentMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfSingleParentMixin
});

const AttrTableMixin = function (superclass) {
  return class extends SingleParentMixin(superclass) {
    constructor(options) {
      super(options);
      this._instanceOfAttrTableMixin = true;
      this._attribute = options.attribute;

      if (!this._attribute) {
        throw new Error(`attribute is required`);
      }
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.attribute = this._attribute;
      return obj;
    }

    getSortHash() {
      return super.getSortHash() + this.parentTable.getSortHash() + this._attribute;
    }

    get name() {
      return this._attribute;
    }

  };
};

Object.defineProperty(AttrTableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfAttrTableMixin
});

class PromotedTable extends AttrTableMixin(Table) {
  async _buildCache(resolve, reject) {
    // We override _buildCache because we don't actually want to call _finishItem
    // until all unique values have been seen
    this._unfinishedCache = [];
    this._unfinishedCacheLookup = {};
    this._partialCache = [];
    this._partialCacheLookup = {};

    const iterator = this._iterate();

    let temp = {
      done: false
    };

    while (!temp.done) {
      temp = await iterator.next();

      if (!this._partialCache || temp === null) {
        // reset() was called before we could finish; we need to let everyone
        // that was waiting on us know that we can't comply
        this.handleReset(reject);
        return;
      }

      if (!temp.done) {
        this._unfinishedCacheLookup[temp.value.index] = this._unfinishedCache.length;

        this._unfinishedCache.push(temp.value);
      }
    } // Okay, now we've seen everything; we can call _finishItem on each of the
    // unique values


    let i = 0;

    for (const value of this._unfinishedCache) {
      if (await this._finishItem(value)) {
        // Okay, this item passed all filters, and is ready to be sent out
        // into the world
        this._partialCacheLookup[value.index] = this._partialCache.length;

        this._partialCache.push(value);

        i++;

        for (let limit of Object.keys(this._limitPromises)) {
          limit = Number(limit); // check if we have enough data now to satisfy any waiting requests

          if (limit <= i) {
            for (const {
              resolve
            } of this._limitPromises[limit]) {
              resolve(this._partialCache.slice(0, limit));
            }

            delete this._limitPromises[limit];
          }
        }
      }
    } // Done iterating! We can graduate the partial cache / lookups into
    // finished ones, and satisfy all the requests


    delete this._unfinishedCache;
    delete this._unfinishedCacheLookup;
    this._cache = this._partialCache;
    delete this._partialCache;
    this._cacheLookup = this._partialCacheLookup;
    delete this._partialCacheLookup;

    for (let limit of Object.keys(this._limitPromises)) {
      limit = Number(limit);

      for (const {
        resolve
      } of this._limitPromises[limit]) {
        resolve(this._cache.slice(0, limit));
      }

      delete this._limitPromises[limit];
    }

    delete this._cachePromise;
    this.trigger('cacheBuilt');
    resolve(this._cache);
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const index = String((yield _awaitAsyncGenerator(wrappedParent.row[_this._attribute])));

          if (!_this._partialCache) {
            // We were reset!
            return;
          } else if (_this._unfinishedCacheLookup[index] !== undefined) {
            const existingItem = _this._unfinishedCache[_this._unfinishedCacheLookup[index]];
            existingItem.connectItem(wrappedParent);
            wrappedParent.connectItem(existingItem);
          } else {
            const newItem = _this._wrap({
              index,
              itemsToConnect: [wrappedParent]
            });

            yield newItem;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class FacetedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;
    this._value = options.value;

    if (!this._attribute || !this._value === undefined) {
      throw new Error(`attribute and value are required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.value = this._value;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this._attribute + this._value;
  }

  get name() {
    return String(this._value);
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let index = 0;
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if ((yield _awaitAsyncGenerator(wrappedParent.row[_this._attribute])) === _this._value) {
            // Normal faceting just gives a subset of the original table
            const newItem = _this._wrap({
              index,
              row: Object.assign({}, wrappedParent.row),
              itemsToConnect: [wrappedParent]
            });

            if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
              yield newItem;
            }

            index++;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class TransposedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._index = options.index;

    if (this._index === undefined) {
      throw new Error(`index is required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.index = this._index;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash() + this._index;
  }

  get name() {
    return `${this._index}`;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Pre-build the parent table's cache
      yield _awaitAsyncGenerator(_this.parentTable.buildCache()); // Iterate the row's attributes as indexes

      const wrappedParent = _this.parentTable._cache[_this.parentTable._cacheLookup[_this._index]] || {
        row: {}
      };

      for (const [index, value] of Object.entries(wrappedParent.row)) {
        const newItem = _this._wrap({
          index,
          row: typeof value === 'object' ? value : {
            value
          },
          itemsToConnect: [wrappedParent]
        });

        if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
          yield newItem;
        }
      }
    })();
  }

}

class ConnectedTable extends Table {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('⨯');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join(',');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTables = _this.parentTables; // Don't try to connect values until all of the parent tables' caches are
      // built; TODO: might be able to do something more responsive here?

      yield _awaitAsyncGenerator(Promise.all(parentTables.map(pTable => pTable.buildCache()))); // Now that the caches are built, just iterate their keys directly. We only
      // care about including rows that have exact matches across all tables, so
      // we can just pick one parent table to iterate

      const baseParentTable = parentTables[0];
      const otherParentTables = parentTables.slice(1);

      for (const index in baseParentTable._cacheLookup) {
        if (!parentTables.every(table => table._cacheLookup)) {
          // One of the parent tables was reset
          _this.reset();

          return;
        }

        if (!otherParentTables.every(table => table._cacheLookup[index] !== undefined)) {
          // No match in one of the other tables; omit this item
          continue;
        } // TODO: add each parent tables' keys as attribute values


        const newItem = _this._wrap({
          index,
          itemsToConnect: parentTables.map(table => table._cache[table._cacheLookup[index]])
        });

        if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
          yield newItem;
        }
      }
    })();
  }

}

class DuplicatedTable extends SingleParentMixin(Table) {
  get name() {
    return this.parentTable.name;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash();
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Yield the same items with the same connections, but wrapped and finished
      // by this table
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this.parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const item = _value;

          const newItem = _this._wrap({
            index: item.index,
            row: item.row,
            itemsToConnect: Object.values(item.connectedItems).reduce((agg, itemList) => {
              return agg.concat(itemList);
            }, [])
          });

          item.registerDuplicate(newItem);

          if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
            yield newItem;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

const ChildTableMixin = function (superclass) {
  return class extends AttrTableMixin(superclass) {
    constructor(options) {
      super(options);
      this._instanceOfChildTableMixin = true;
    }

    _wrap(options) {
      const newItem = super._wrap(options);

      newItem.parentIndex = options.parentIndex;
      return newItem;
    }

  };
};

Object.defineProperty(ChildTableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfChildTableMixin
});

class ExpandedTable extends ChildTableMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash() + this._attribute;
  }

  get name() {
    return this._attribute;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTable = _this.parentTable;
      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const row = wrappedParent.row[_this._attribute];

          if (row !== undefined && row !== null && Object.keys(row).length > 0) {
            const newItem = _this._wrap({
              index,
              row,
              itemsToConnect: [wrappedParent],
              parentIndex: wrappedParent.index
            });

            if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
              yield newItem;
              index++;
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class UnrolledTable extends ChildTableMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash() + this._attribute;
  }

  get name() {
    return this._attribute;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTable = _this.parentTable;
      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const rows = wrappedParent.row[_this._attribute];

          if (rows !== undefined && rows !== null && typeof rows[Symbol.iterator] === 'function') {
            for (const row of rows) {
              const newItem = _this._wrap({
                index,
                row,
                itemsToConnect: [wrappedParent],
                parentIndex: wrappedParent.index
              });

              if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
                yield newItem;
                index++;
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class ParentChildTable extends Table {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('/');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join(',');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let parentTable, childTable;

      if (_this.parentTables[0].parentTable === _this.parentTables[1]) {
        parentTable = _this.parentTables[1];
        childTable = _this.parentTables[0];
      } else if (_this.parentTables[1].parentTable === _this.parentTables[0]) {
        parentTable = _this.parentTables[0];
        childTable = _this.parentTables[1];
      } else {
        throw new Error(`ParentChildTable not set up properly`);
      }

      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(childTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const child = _value;
          const parent = yield _awaitAsyncGenerator(parentTable.getItem(child.parentIndex));

          const newItem = _this._wrap({
            index,
            itemsToConnect: [parent, child]
          });

          if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
            yield newItem;
            index++;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDictTable: StaticDictTable,
  PromotedTable: PromotedTable,
  FacetedTable: FacetedTable,
  ConnectedTable: ConnectedTable,
  TransposedTable: TransposedTable,
  DuplicatedTable: DuplicatedTable,
  ExpandedTable: ExpandedTable,
  UnrolledTable: UnrolledTable,
  ParentChildTable: ParentChildTable
});

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this.model = options.model;
    this.classId = options.classId;
    this.tableId = options.tableId;

    if (!this.model || !this.classId || !this.tableId) {
      throw new Error(`model, classId, and tableId are required`);
    }

    this._className = options.className || null;
    this.annotations = options.annotations || {};
  }

  _toRawObject() {
    return {
      classId: this.classId,
      tableId: this.tableId,
      className: this._className,
      annotations: this.annotations
    };
  }

  getSortHash() {
    return this.type + this.className;
  }

  setClassName(value) {
    this._className = value;
    this.model.trigger('update');
  }

  get hasCustomName() {
    return this._className !== null;
  }

  get className() {
    return this._className || this.table.name;
  }

  get variableName() {
    return this.type.toLocaleLowerCase() + '_' + this.className.split(/\W+/g).filter(d => d.length > 0).map(d => d[0].toLocaleUpperCase() + d.slice(1)).join('');
  }

  get table() {
    return this.model.tables[this.tableId];
  }

  get deleted() {
    return !this.model.deleted && this.model.classes[this.classId];
  }

  _wrap(options) {
    options.classObj = this;
    return new GenericWrapper(options);
  }

  interpretAsNodes() {
    const options = this._toRawObject();

    options.type = 'NodeClass';
    options.overwrite = true;
    this.table.reset();
    return this.model.createClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    options.overwrite = true;
    this.table.reset();
    return this.model.createClass(options);
  }

  _deriveNewClass(newTable, type = this.constructor.name) {
    return this.model.createClass({
      tableId: newTable.tableId,
      type
    });
  }

  promote(attribute) {
    return this._deriveNewClass(this.table.promote(attribute).tableId, 'GenericClass');
  }

  expand(attribute) {
    return this._deriveNewClass(this.table.expand(attribute));
  }

  unroll(attribute) {
    return this._deriveNewClass(this.table.unroll(attribute));
  }

  closedFacet(attribute, values) {
    return this.table.closedFacet(attribute, values).map(newTable => {
      return this._deriveNewClass(newTable);
    });
  }

  openFacet(attribute) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this.table.openFacet(attribute)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const newTable = _value;
          yield _this._deriveNewClass(newTable);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }

  closedTranspose(indexes) {
    return this.table.closedTranspose(indexes).map(newTable => {
      return this._deriveNewClass(newTable);
    });
  }

  openTranspose() {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this2.table.openTranspose()), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const newTable = _value2;
          yield _this2._deriveNewClass(newTable);
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            yield _awaitAsyncGenerator(_iterator2.return());
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    })();
  }

  delete() {
    delete this.model.classes[this.classId];
    this.model.trigger('update');
  }

}

Object.defineProperty(GenericClass, 'type', {
  get() {
    return /(.*)Class/.exec(this.name)[1];
  }

});

class NodeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  edges(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let edgeIds = options.classes ? options.classes.map(classObj => classObj.classId) : options.classIds || Object.keys(_this.classObj.edgeClassIds);
      const iterators = [];

      for (const edgeId of edgeIds) {
        if (!_this.classObj.edgeClassIds[edgeId]) {
          continue;
        }

        const edgeClass = _this.classObj.model.classes[edgeId];

        const role = _this.classObj.getEdgeRole(edgeClass);

        if (role === 'both' || role === 'source') {
          const tableIds = edgeClass.sourceTableIds.slice().reverse().concat([edgeClass.tableId]);
          iterators.push(_this.iterateAcrossConnections(tableIds));
        }

        if (role === 'both' || role === 'target') {
          const tableIds = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]);
          iterators.push(_this.iterateAcrossConnections(tableIds));
        }
      }

      yield* _asyncGeneratorDelegate(_asyncIterator(_this.handleLimit(options, iterators)), _awaitAsyncGenerator);
    })();
  }

}

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.edgeClassIds = options.edgeClassIds || {};
  }

  *edgeClasses() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      yield this.model.classes[edgeClassId];
    }
  }

  getEdgeRole(edgeClass) {
    if (!this.edgeClassIds[edgeClass.classId]) {
      return null;
    } else if (edgeClass.sourceClassId === this.classId) {
      if (edgeClass.targetClassId === this.classId) {
        return 'both';
      } else {
        return 'source';
      }
    } else if (edgeClass.targetClassId === this.classId) {
      return 'target';
    } else {
      throw new Error(`Internal mismatch between node and edge classIds`);
    }
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.edgeClassIds = this.edgeClassIds;
    return result;
  }

  _wrap(options) {
    options.classObj = this;
    return new NodeWrapper(options);
  }

  interpretAsNodes() {
    return this;
  }

  interpretAsEdges({
    autoconnect = false
  } = {}) {
    const edgeClassIds = Object.keys(this.edgeClassIds);

    const options = super._toRawObject();

    if (!autoconnect || edgeClassIds.length > 2) {
      // If there are more than two edges, break all connections and make
      // this a floating edge (for now, we're not dealing in hyperedges)
      this.disconnectAllEdges();
    } else if (autoconnect && edgeClassIds.length === 1) {
      // With only one connection, this node should become a self-edge
      const edgeClass = this.model.classes[edgeClassIds[0]]; // Are we the source or target of the existing edge (internally, in terms
      // of sourceId / targetId, not edgeClass.direction)?

      const isSource = edgeClass.sourceClassId === this.classId; // As we're converted to an edge, our new resulting source AND target
      // should be whatever is at the other end of edgeClass (if anything)

      if (isSource) {
        options.sourceClassId = options.targetClassId = edgeClass.targetClassId;
        edgeClass.disconnectSource();
      } else {
        options.sourceClassId = options.targetClassId = edgeClass.sourceClassId;
        edgeClass.disconnectTarget();
      } // If there is a node class on the other end of edgeClass, add our
      // id to its list of connections


      const nodeClass = this.model.classes[options.sourceClassId];

      if (nodeClass) {
        nodeClass.edgeClassIds[this.classId] = true;
      } // tableId lists should emanate out from the (new) edge table; assuming
      // (for a moment) that isSource === true, we'd construct the tableId list
      // like this:


      let tableIdList = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]).concat(edgeClass.sourceTableIds);

      if (!isSource) {
        // Whoops, got it backwards!
        tableIdList.reverse();
      }

      options.directed = edgeClass.directed;
      options.sourceTableIds = options.targetTableIds = tableIdList;
    } else if (autoconnect && edgeClassIds.length === 2) {
      // Okay, we've got two edges, so this is a little more straightforward
      let sourceEdgeClass = this.model.classes[edgeClassIds[0]];
      let targetEdgeClass = this.model.classes[edgeClassIds[1]]; // Figure out the direction, if there is one

      options.directed = false;

      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        if (sourceEdgeClass.targetClassId === this.classId && targetEdgeClass.sourceClassId === this.classId) {
          // We happened to get the edges in order; set directed to true
          options.directed = true;
        } else if (sourceEdgeClass.sourceClassId === this.classId && targetEdgeClass.targetClassId === this.classId) {
          // We got the edges backwards; swap them and set directed to true
          targetEdgeClass = this.model.classes[edgeClassIds[0]];
          sourceEdgeClass = this.model.classes[edgeClassIds[1]];
          options.directed = true;
        }
      } // Okay, now we know how to set source / target ids


      options.sourceClassId = sourceEdgeClass.sourceClassId;
      options.targetClassId = targetEdgeClass.targetClassId; // Add this class to the source's / target's edgeClassIds

      this.model.classes[options.sourceClassId].edgeClassIds[this.classId] = true;
      this.model.classes[options.targetClassId].edgeClassIds[this.classId] = true; // Concatenate the intermediate tableId lists, emanating out from the
      // (new) edge table

      options.sourceTableIds = sourceEdgeClass.targetTableIds.slice().reverse().concat([sourceEdgeClass.tableId]).concat(sourceEdgeClass.sourceTableIds);

      if (sourceEdgeClass.targetClassId === this.classId) {
        options.sourceTableIds.reverse();
      }

      options.targetTableIds = targetEdgeClass.sourceTableIds.slice().reverse().concat([targetEdgeClass.tableId]).concat(targetEdgeClass.targetTableIds);

      if (targetEdgeClass.targetClassId === this.classId) {
        options.targetTableIds.reverse();
      } // Disconnect the existing edge classes from the new (now edge) class


      this.disconnectAllEdges();
    }

    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    options.overwrite = true;
    this.table.reset();
    return this.model.createClass(options);
  }

  connectToNodeClass({
    otherNodeClass,
    attribute,
    otherAttribute
  }) {
    let thisHash, otherHash, sourceTableIds, targetTableIds;

    if (attribute === null) {
      thisHash = this.table;
      sourceTableIds = [];
    } else {
      thisHash = this.table.promote(attribute);
      sourceTableIds = [thisHash.tableId];
    }

    if (otherAttribute === null) {
      otherHash = otherNodeClass.table;
      targetTableIds = [];
    } else {
      otherHash = otherNodeClass.table.promote(otherAttribute);
      targetTableIds = [otherHash.tableId];
    }

    const connectedTable = thisHash.connect([otherHash]);
    const newEdgeClass = this.model.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceTableIds,
      targetClassId: otherNodeClass.classId,
      targetTableIds
    });
    this.edgeClassIds[newEdgeClass.classId] = true;
    otherNodeClass.edgeClassIds[newEdgeClass.classId] = true;
    this.model.trigger('update');
    return newEdgeClass;
  }

  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    return edgeClass.connectToNodeClass(options);
  }

  promote(attribute) {
    const newNodeClass = this._deriveNewClass(this.table.promote(attribute), 'NodeClass');

    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });
    return newNodeClass;
  }

  connectToChildNodeClass(childClass) {
    const connectedTable = this.table.connect([childClass.table], 'ParentChildTable');
    const newEdgeClass = this.model.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceTableIds: [],
      targetClassId: childClass.classId,
      targetTableIds: []
    });
    this.edgeClassIds[newEdgeClass.classId] = true;
    childClass.edgeClassIds[newEdgeClass.classId] = true;
    this.model.trigger('update');
  }

  expand(attribute) {
    const newNodeClass = this._deriveNewClass(this.table.expand(attribute), 'NodeClass');

    this.connectToChildNodeClass(newNodeClass);
    return newNodeClass;
  }

  unroll(attribute) {
    const newNodeClass = this._deriveNewClass(this.table.unroll(attribute), 'NodeClass');

    this.connectToChildNodeClass(newNodeClass);
    return newNodeClass;
  }

  projectNewEdge(classIdList) {
    const classList = classIdList.map(classId => {
      return this.model.classes[classId];
    });

    if (classList.length < 2 || classList[classList.length - 1].type !== 'Node') {
      throw new Error(`Invalid classIdList`);
    }

    const sourceClassId = this.classId;
    const targetClassId = classList[classList.length - 1].classId;
    const sourceTableIds = [];
    const targetTableIds = [];
    let tableId;
    const middleIndex = Math.floor((classList.length - 1) / 2);

    for (let i = 0; i < classList.length - 1; i++) {
      if (i < middleIndex) {
        if (classList[i].type === 'Node') {
          sourceTableIds.unshift(classList[i].tableId);
        } else {
          const temp = Array.from(classList[i].sourceTableIds).reverse();

          for (const tableId of temp) {
            sourceTableIds.unshift(tableId);
          }

          sourceTableIds.unshift(classList[i].tableId);

          for (const tableId of classList[i].targetTableIds) {
            sourceTableIds.unshift(tableId);
          }
        }
      } else if (i === middleIndex) {
        tableId = classList[i].table.duplicate().tableId;

        if (classList[i].type === 'Edge') {
          const temp = Array.from(classList[i].sourceTableIds).reverse();

          for (const tableId of temp) {
            sourceTableIds.unshift(tableId);
          }

          for (const tableId of classList[i].targetTableIds) {
            targetTableIds.unshift(tableId);
          }
        }
      } else {
        if (classList[i].type === 'Node') {
          targetTableIds.unshift(classList[i].tableId);
        } else {
          const temp = Array.from(classList[i].sourceTableIds).reverse();

          for (const tableId of temp) {
            targetTableIds.unshift(tableId);
          }

          targetTableIds.unshift(classList[i].tableId);

          for (const tableId of classList[i].targetTableIds) {
            targetTableIds.unshift(tableId);
          }
        }
      }
    }

    return this.model.createClass({
      type: 'EdgeClass',
      tableId,
      sourceClassId,
      targetClassId,
      sourceTableIds,
      targetTableIds
    });
  }

  disconnectAllEdges(options) {
    for (const edgeClass of this.connectedClasses()) {
      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSource(options);
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTarget(options);
      }
    }
  }

  *connectedClasses() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      yield this.model.classes[edgeClassId];
    }
  }

  delete() {
    this.disconnectAllEdges();
    super.delete();
  }

}

class EdgeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  sourceNodes(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      if (_this.classObj.sourceClassId === null || options.classes && !options.classes.find(d => _this.classObj.sourceClassId === d.classId) || options.classIds && options.classIds.indexOf(_this.classObj.sourceClassId) === -1) {
        return;
      }

      const sourceTableId = _this.classObj.model.classes[_this.classObj.sourceClassId].tableId;

      const tableIds = _this.classObj.sourceTableIds.concat([sourceTableId]);

      yield* _asyncGeneratorDelegate(_asyncIterator(_this.handleLimit(options, [_this.iterateAcrossConnections(tableIds)])), _awaitAsyncGenerator);
    })();
  }

  targetNodes(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      if (_this2.classObj.targetClassId === null || options.classes && !options.classes.find(d => _this2.classObj.targetClassId === d.classId) || options.classIds && options.classIds.indexOf(_this2.classObj.targetClassId) === -1) {
        return;
      }

      const targetTableId = _this2.classObj.model.classes[_this2.classObj.targetClassId].tableId;

      const tableIds = _this2.classObj.targetTableIds.concat([targetTableId]);

      yield* _asyncGeneratorDelegate(_asyncIterator(_this2.handleLimit(options, [_this2.iterateAcrossConnections(tableIds)])), _awaitAsyncGenerator);
    })();
  }

  nodes(options = {}) {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      yield* _asyncGeneratorDelegate(_asyncIterator(_this3.handleLimit(options, [_this3.sourceNodes(options), _this3.targetNodes(options)])), _awaitAsyncGenerator);
    })();
  }

}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options); // sourceTableIds and targetTableIds are lists of any intermediate tables,
    // beginning with the edge table (but not including it), that lead to the
    // source / target node tables (but not including) those

    this.sourceClassId = options.sourceClassId || null;
    this.sourceTableIds = options.sourceTableIds || [];
    this.targetClassId = options.targetClassId || null;
    this.targetTableIds = options.targetTableIds || [];
    this.directed = options.directed || false;
  }

  get className() {
    return this._className || (this.sourceClass && this.sourceClass.className || '?') + '-' + (this.targetClass && this.targetClass.className || '?');
  }

  get sourceClass() {
    return this.sourceClassId && this.model.classes[this.sourceClassId] || null;
  }

  get targetClass() {
    return this.targetClassId && this.model.classes[this.targetClassId] || null;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.sourceTableIds = this.sourceTableIds;
    result.targetClassId = this.targetClassId;
    result.targetTableIds = this.targetTableIds;
    result.directed = this.directed;
    return result;
  }

  _wrap(options) {
    options.classObj = this;
    return new EdgeWrapper(options);
  }

  _splitTableIdList(tableIdList, otherClass) {
    let result = {
      nodeTableIdList: [],
      edgeTableId: null,
      edgeTableIdList: []
    };

    if (tableIdList.length === 0) {
      // Weird corner case where we're trying to create an edge between
      // adjacent or identical tables... create a ConnectedTable
      result.edgeTableId = this.table.connect(otherClass.table).tableId;
      return result;
    } else {
      // Use a table in the middle as the new edge table; prioritize
      // StaticTable and StaticDictTable
      let staticExists = false;
      let tableDistances = tableIdList.map((tableId, index) => {
        staticExists = staticExists || this.model.tables[tableId].type.startsWith('Static');
        return {
          tableId,
          index,
          dist: Math.abs(tableIdList / 2 - index)
        };
      });

      if (staticExists) {
        tableDistances = tableDistances.filter(({
          tableId
        }) => {
          return this.model.tables[tableId].type.startsWith('Static');
        });
      }

      const {
        tableId,
        index
      } = tableDistances.sort((a, b) => a.dist - b.dist)[0];
      result.edgeTableId = tableId;
      result.edgeTableIdList = tableIdList.slice(0, index).reverse();
      result.nodeTableIdList = tableIdList.slice(index + 1);
    }

    return result;
  }

  interpretAsNodes() {
    const temp = this._toRawObject();

    this.disconnectSource();
    this.disconnectTarget();
    temp.type = 'NodeClass';
    temp.overwrite = true;
    const newNodeClass = this.model.createClass(temp);

    if (temp.sourceClassId) {
      const sourceClass = this.model.classes[temp.sourceClassId];

      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.sourceTableIds, sourceClass);

      const sourceEdgeClass = this.model.createClass({
        type: 'EdgeClass',
        tableId: edgeTableId,
        directed: temp.directed,
        sourceClassId: temp.sourceClassId,
        sourceTableIds: nodeTableIdList,
        targetClassId: newNodeClass.classId,
        targetTableIds: edgeTableIdList
      });
      sourceClass.edgeClassIds[sourceEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[sourceEdgeClass.classId] = true;
    }

    if (temp.targetClassId && temp.sourceClassId !== temp.targetClassId) {
      const targetClass = this.model.classes[temp.targetClassId];

      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.targetTableIds, targetClass);

      const targetEdgeClass = this.model.createClass({
        type: 'EdgeClass',
        tableId: edgeTableId,
        directed: temp.directed,
        sourceClassId: newNodeClass.classId,
        sourceTableIds: edgeTableIdList,
        targetClassId: temp.targetClassId,
        targetTableIds: nodeTableIdList
      });
      targetClass.edgeClassIds[targetEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[targetEdgeClass.classId] = true;
    }

    this.table.reset();
    this.model.trigger('update');
    return newNodeClass;
  }

  *connectedClasses() {
    if (this.sourceClassId) {
      yield this.model.classes[this.sourceClassId];
    }

    if (this.targetClassId) {
      yield this.model.classes[this.targetClassId];
    }
  }

  interpretAsEdges() {
    return this;
  }

  connectToNodeClass(options) {
    if (options.side === 'source') {
      this.connectSource(options);
    } else if (options.side === 'target') {
      this.connectTarget(options);
    } else {
      throw new Error(`PoliticalOutsiderError: "${options.side}" is an invalid side`);
    }
  }

  toggleDirection(directed) {
    if (directed === false || this.swappedDirection === true) {
      this.directed = false;
      delete this.swappedDirection;
    } else if (!this.directed) {
      this.directed = true;
      this.swappedDirection = false;
    } else {
      // Directed was already true, just switch source and target
      let temp = this.sourceClassId;
      this.sourceClassId = this.targetClassId;
      this.targetClassId = temp;
      temp = this.sourceTableIds;
      this.sourceTableIds = this.targetTableIds;
      this.targetTableIds = temp;
      this.swappedDirection = true;
    }

    this.model.trigger('update');
  }

  connectSource({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null
  } = {}) {
    if (this.sourceClassId) {
      this.disconnectSource();
    }

    this.sourceClassId = nodeClass.classId;
    const sourceClass = this.model.classes[this.sourceClassId];
    sourceClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.table.promote(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.table.promote(nodeAttribute);
    this.sourceTableIds = [edgeHash.connect([nodeHash]).tableId];

    if (edgeAttribute !== null) {
      this.sourceTableIds.unshift(edgeHash.tableId);
    }

    if (nodeAttribute !== null) {
      this.sourceTableIds.push(nodeHash.tableId);
    }

    this.model.trigger('update');
  }

  connectTarget({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null
  } = {}) {
    if (this.targetClassId) {
      this.disconnectTarget();
    }

    this.targetClassId = nodeClass.classId;
    const targetClass = this.model.classes[this.targetClassId];
    targetClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.table.promote(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.table.promote(nodeAttribute);
    this.targetTableIds = [edgeHash.connect([nodeHash]).tableId];

    if (edgeAttribute !== null) {
      this.targetTableIds.unshift(edgeHash.tableId);
    }

    if (nodeAttribute !== null) {
      this.targetTableIds.push(nodeHash.tableId);
    }

    this.model.trigger('update');
  }

  disconnectSource() {
    const existingSourceClass = this.model.classes[this.sourceClassId];

    if (existingSourceClass) {
      delete existingSourceClass.edgeClassIds[this.classId];
    }

    this.sourceTableIds = [];
    this.sourceClassId = null;
    this.model.trigger('update');
  }

  disconnectTarget() {
    const existingTargetClass = this.model.classes[this.targetClassId];

    if (existingTargetClass) {
      delete existingTargetClass.edgeClassIds[this.classId];
    }

    this.targetTableIds = [];
    this.targetClassId = null;
    this.model.trigger('update');
  }

  promote(attribute) {
    if (this.sourceClassId && this.targetClassId) {
      return super.promote();
    } else {
      const newNodeClass = this.model.createClass({
        tableId: this.table.promote(attribute).tableId,
        type: 'NodeClass'
      });
      this.connectToNodeClass({
        nodeClass: newNodeClass,
        side: !this.sourceClassId ? 'source' : 'target',
        nodeAttribute: null,
        edgeAttribute: attribute
      });
      return newNodeClass;
    }
  }

  connectFacetedClass(newEdgeClass) {
    // When an edge class is faceted, we want to keep the same connections. This
    // means we need to clone each table chain, and add our own table to it
    // (because our table is the parentTable of the new one)
    if (this.sourceClassId) {
      newEdgeClass.sourceClassId = this.sourceClassId;
      newEdgeClass.sourceTableIds = Array.from(this.sourceTableIds);
      newEdgeClass.sourceTableIds.unshift(this.tableId);
      this.sourceClass.edgeClassIds[newEdgeClass.classId] = true;
    }

    if (this.targetClassId) {
      newEdgeClass.targetClassId = this.targetClassId;
      newEdgeClass.targetTableIds = Array.from(this.targetTableIds);
      newEdgeClass.targetTableIds.unshift(this.tableId);
      this.targetClass.edgeClassIds[newEdgeClass.classId] = true;
    }

    this.model.trigger('update');
  }

  closedFacet(attribute, values) {
    const newClasses = super.closedFacet(attribute, values);

    for (const newClass of newClasses) {
      this.connectFacetedClass(newClass);
    }

    return newClasses;
  }

  openFacet(attribute) {
    var _this = this,
        _superprop_callOpenFacet = (..._args) => super.openFacet(..._args);

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_superprop_callOpenFacet(attribute)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const newClass = _value;

          _this.connectFacetedClass(newClass);

          yield newClass;
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }

  delete() {
    this.disconnectSource();
    this.disconnectTarget();
    super.delete();
  }

}



var CLASSES = /*#__PURE__*/Object.freeze({
  GenericClass: GenericClass,
  NodeClass: NodeClass,
  EdgeClass: EdgeClass
});

class FileFormat {
  async buildRow(item) {
    const row = {};

    for (let attr in item.row) {
      row[attr] = await item.row[attr];
    }

    return row;
  }

}

class ParseFailure extends Error {
  constructor(fileFormat) {
    super(`Failed to parse format: ${fileFormat.constructor.name}`);
  }

}

const NODE_NAMES = ['nodes', 'Nodes'];
const EDGE_NAMES = ['edges', 'links', 'Edges', 'Links'];

class D3Json extends FileFormat {
  async importData({
    model,
    text,
    nodeAttribute = null,
    sourceAttribute = 'source',
    targetAttribute = 'target',
    classAttribute = null
  }) {
    const data = JSON.parse(text);
    const nodeName = NODE_NAMES.find(name => data[name] instanceof Array);
    const edgeName = EDGE_NAMES.find(name => data[name] instanceof Array);

    if (!nodeName || !edgeName) {
      throw new ParseFailure(this);
    }

    const coreTable = model.createTable({
      type: 'StaticDictTable',
      name: 'coreTable',
      data: data
    });
    const coreClass = model.createClass({
      type: 'GenericClass',
      tableId: coreTable.tableId
    });
    let [nodes, edges] = coreClass.closedTranspose([nodeName, edgeName]);

    if (classAttribute) {
      if (nodeAttribute === null) {
        throw new Error(`Can't import classes from D3-style JSON without nodeAttribute`);
      }

      const nodeClasses = [];
      const nodeClassLookup = {};
      const edgeClasses = [];
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(nodes.openFacet(classAttribute)), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const nodeClass = _value;
          nodeClassLookup[nodeClass.className] = nodeClasses.length;
          nodeClasses.push(nodeClass.interpretAsNodes());
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            await _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(edges.openFacet(classAttribute)), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const edgeClass = _value2;
          edgeClasses.push(edgeClass.interpretAsEdges());
          const sample = await edgeClass.table.getItem();
          const sourceClassName = sample.row[sourceAttribute + '_' + classAttribute];

          if (nodeClassLookup[sourceClassName] !== undefined) {
            edgeClass.connectToNodeClass({
              nodeClass: nodeClasses[nodeClassLookup[sourceClassName]],
              side: 'source',
              nodeAttribute,
              edgeAttribute: sourceAttribute
            });
          }

          const targetClassName = sample.row[targetAttribute + '_' + classAttribute];

          if (nodeClassLookup[targetClassName] !== undefined) {
            edgeClass.connectToNodeClass({
              nodeClass: nodeClasses[nodeClassLookup[targetClassName]],
              side: 'target',
              nodeAttribute,
              edgeAttribute: targetAttribute
            });
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            await _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    } else {
      nodes = nodes.interpretAsNodes();
      nodes.setClassName(nodeName);
      edges = edges.interpretAsEdges();
      edges.setClassName(edgeName);
      nodes.connectToEdgeClass({
        edgeClass: edges,
        side: 'source',
        nodeAttribute,
        edgeAttribute: sourceAttribute
      });
      nodes.connectToEdgeClass({
        edgeClass: edges,
        side: 'target',
        nodeAttribute,
        edgeAttribute: targetAttribute
      });
    }
  }

  async formatData({
    model,
    includeClasses = Object.values(model.classes),
    pretty = true,
    nodeAttribute = null,
    sourceAttribute = 'source',
    targetAttribute = 'target',
    classAttribute = null
  }) {
    if (classAttribute && !nodeAttribute) {
      throw new Error(`Can't export D3-style JSON with classes, without a nodeAttribute`);
    }

    const result = {
      nodes: [],
      links: []
    };
    const nodeLookup = {};
    const nodeClasses = [];
    const edgeClasses = [];

    for (const classObj of includeClasses) {
      if (classObj.type === 'Node') {
        nodeClasses.push(classObj);
      } else if (classObj.type === 'Edge') {
        edgeClasses.push(classObj);
      } else {
        result.other = result.other || [];
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;

        var _iteratorError3;

        try {
          for (var _iterator3 = _asyncIterator(classObj.table.iterate()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
            const item = _value3;
            result.other.push((await this.buildRow(item)));
          }
        } catch (err) {
          _didIteratorError3 = true;
          _iteratorError3 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
              await _iterator3.return();
            }
          } finally {
            if (_didIteratorError3) {
              throw _iteratorError3;
            }
          }
        }
      }
    }

    for (const nodeClass of nodeClasses) {
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;

      var _iteratorError4;

      try {
        for (var _iterator4 = _asyncIterator(nodeClass.table.iterate()), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
          const node = _value4;
          nodeLookup[node.exportId] = result.nodes.length;
          const row = await this.buildRow(node);

          if (nodeAttribute) {
            row[nodeAttribute] = node.exportId;
          }

          result.nodes.push(row);
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
            await _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }
    }

    for (const edgeClass of edgeClasses) {
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;

      var _iteratorError5;

      try {
        for (var _iterator5 = _asyncIterator(edgeClass.table.iterate()), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
          const edge = _value5;
          const row = await this.buildRow(edge);
          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;

          var _iteratorError6;

          try {
            for (var _iterator6 = _asyncIterator(edge.sourceNodes({
              classes: nodeClasses
            })), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
              const source = _value6;
              row[sourceAttribute] = nodeAttribute ? source.exportId : nodeLookup[source.exportId];

              if (classAttribute) {
                row[sourceAttribute + '_' + classAttribute] = source.classObj.className;
              }

              var _iteratorNormalCompletion7 = true;
              var _didIteratorError7 = false;

              var _iteratorError7;

              try {
                for (var _iterator7 = _asyncIterator(edge.targetNodes({
                  classes: nodeClasses
                })), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
                  const target = _value7;
                  row[targetAttribute] = nodeAttribute ? target.exportId : nodeLookup[target.exportId];

                  if (classAttribute) {
                    row[targetAttribute + '_' + classAttribute] = target.classObj.className;
                  }

                  result.links.push(Object.assign({}, row));
                }
              } catch (err) {
                _didIteratorError7 = true;
                _iteratorError7 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion7 && _iterator7.return != null) {
                    await _iterator7.return();
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
              if (!_iteratorNormalCompletion6 && _iterator6.return != null) {
                await _iterator6.return();
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
          if (!_iteratorNormalCompletion5 && _iterator5.return != null) {
            await _iterator5.return();
          }
        } finally {
          if (_didIteratorError5) {
            throw _iteratorError5;
          }
        }
      }
    }

    if (pretty) {
      result.nodes = '  "nodes": [\n    ' + result.nodes.map(row => JSON.stringify(row)).join('    ,\n') + '\n  ]';
      result.links = '  "links": [\n    ' + result.links.map(row => JSON.stringify(row)).join('    ,\n') + '\n  ]';

      if (result.other) {
        result.other = ',\n  "other": [\n    ' + result.other.map(row => JSON.stringify(row)).join('    ,\n') + '\n  ]';
      }

      return `{\n${result.nodes},\n${result.links}${result.other || ''}\n}\n`;
    } else {
      return JSON.stringify(result);
    }
  }

}

var D3Json$1 = new D3Json();



var FILE_FORMATS = /*#__PURE__*/Object.freeze({
  D3Json: D3Json$1
});

const DATALIB_FORMATS = {
  'json': 'json',
  'csv': 'csv',
  'tsv': 'tsv'
};

class NetworkModel extends TriggerableMixin(class {}) {
  constructor({
    origraph,
    modelId,
    name = modelId,
    annotations = {},
    classes = {},
    tables = {}
  }) {
    super();
    this._origraph = origraph;
    this.modelId = modelId;
    this.name = name;
    this.annotations = annotations;
    this.classes = {};
    this.tables = {};
    this._nextClassId = 1;
    this._nextTableId = 1;

    for (const classObj of Object.values(classes)) {
      this.classes[classObj.classId] = this.hydrate(classObj, CLASSES);
    }

    for (const table of Object.values(tables)) {
      this.tables[table.tableId] = this.hydrate(table, TABLES);
    }

    this.on('update', () => {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = setTimeout(() => {
        this._origraph.save();

        this._saveTimeout = undefined;
      }, 0);
    });
  }

  _toRawObject() {
    const classes = {};
    const tables = {};

    for (const classObj of Object.values(this.classes)) {
      classes[classObj.classId] = classObj._toRawObject();
      classes[classObj.classId].type = classObj.constructor.name;
    }

    for (const tableObj of Object.values(this.tables)) {
      tables[tableObj.tableId] = tableObj._toRawObject();
      tables[tableObj.tableId].type = tableObj.constructor.name;
    }

    return {
      modelId: this.modelId,
      name: this.name,
      annotations: this.annotations,
      classes,
      tables
    };
  }

  get unsaved() {
    return this._saveTimeout !== undefined;
  }

  hydrate(rawObject, TYPES) {
    rawObject.model = this;
    return new TYPES[rawObject.type](rawObject);
  }

  createTable(options) {
    while (!options.tableId || !options.overwrite && this.tables[options.tableId]) {
      options.tableId = `table${this._nextTableId}`;
      this._nextTableId += 1;
    }

    options.model = this;
    this.tables[options.tableId] = new TABLES[options.type](options);
    this.trigger('update');
    return this.tables[options.tableId];
  }

  createClass(options = {
    selector: `empty`
  }) {
    while (!options.classId || !options.overwrite && this.classes[options.classId]) {
      options.classId = `class${this._nextClassId}`;
      this._nextClassId += 1;
    }

    options.model = this;
    this.classes[options.classId] = new CLASSES[options.type](options);
    this.trigger('update');
    return this.classes[options.classId];
  }

  findClass(className) {
    return Object.values(this.classes).find(classObj => classObj.className === className);
  }

  rename(newName) {
    this.name = newName;
    this.trigger('update');
  }

  annotate(key, value) {
    this.annotations[key] = value;
    this.trigger('update');
  }

  deleteAnnotation(key) {
    delete this.annotations[key];
    this.trigger('update');
  }

  delete() {
    this._origraph.deleteModel(this.modelId);
  }

  get deleted() {
    return this._origraph.models[this.modelId];
  }

  async addTextFile(options) {
    if (!options.format) {
      options.format = mime.extension(mime.lookup(options.name));
    }

    if (FILE_FORMATS[options.format]) {
      options.model = this;
      return FILE_FORMATS[options.format].importData(options);
    } else if (DATALIB_FORMATS[options.format]) {
      options.data = datalib.read(options.text, {
        type: options.format
      });

      if (options.format === 'csv' || options.format === 'tsv') {
        options.attributes = {};

        for (const attr of options.data.columns) {
          options.attributes[attr] = true;
        }

        delete options.data.columns;
      }

      return this.addStaticTable(options);
    } else {
      throw new Error(`Unsupported file format: ${options.format}`);
    }
  }

  async formatData(options) {
    options.model = this;

    if (FILE_FORMATS[options.format]) {
      return FILE_FORMATS[options.format].formatData(options);
    } else if (DATALIB_FORMATS[options.format]) {
      throw new Error(`Raw ${options.format} export not yet supported`);
    } else {
      throw new Error(`Can't export unknown format: ${options.format}`);
    }
  }

  addStaticTable(options) {
    options.type = options.data instanceof Array ? 'StaticTable' : 'StaticDictTable';
    let newTable = this.createTable(options);
    return this.createClass({
      type: 'GenericClass',
      tableId: newTable.tableId
    });
  }

  deleteAllUnusedTables() {
    for (const tableId in this.tables) {
      if (this.tables[tableId]) {
        try {
          this.tables[tableId].delete();
        } catch (err) {
          if (!err.inUse) {
            throw err;
          }
        }
      }
    }

    this.trigger('update');
  }

  async getInstanceGraph(instanceIdList) {
    if (!instanceIdList) {
      // Without specified instances, just pick the first 5 from each node
      // and edge class
      instanceIdList = [];

      for (const classObj of Object.values(this.classes)) {
        if (classObj.type === 'Node' || classObj.type === 'Edge') {
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;

          var _iteratorError;

          try {
            for (var _iterator = _asyncIterator(classObj.table.iterate(5)), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
              const item = _value;
              instanceIdList.push(item.instanceId);
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return != null) {
                await _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        }
      }
    } // Get the specified items


    const nodeInstances = {};
    const edgeInstances = {};

    for (const instanceId of instanceIdList) {
      const {
        classId,
        index
      } = JSON.parse(instanceId);
      const instance = await this.classes[classId].table.getItem(index);

      if (instance.type === 'Node') {
        nodeInstances[instanceId] = instance;
      } else if (instance.type === 'Edge') {
        edgeInstances[instanceId] = instance;
      }
    } // Add any nodes connected to our edges


    const extraNodes = {};

    for (const edgeId in edgeInstances) {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(edgeInstances[edgeId].nodes()), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const node = _value2;

          if (!nodeInstances[node.instanceId]) {
            extraNodes[node.instanceId] = node;
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            await _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    } // Add any edges that connect our nodes


    const extraEdges = {};

    for (const nodeId in nodeInstances) {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator(nodeInstances[nodeId].edges()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
          const edge = _value3;

          if (!edgeInstances[edge.instanceId]) {
            // Check that both ends of the edge connect at least one
            // of our nodes
            let connectsSource = false;
            let connectsTarget = false;
            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;

            var _iteratorError4;

            try {
              for (var _iterator4 = _asyncIterator(edge.sourceNodes()), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                const node = _value4;

                if (nodeInstances[node.instanceId]) {
                  connectsSource = true;
                  break;
                }
              }
            } catch (err) {
              _didIteratorError4 = true;
              _iteratorError4 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
                  await _iterator4.return();
                }
              } finally {
                if (_didIteratorError4) {
                  throw _iteratorError4;
                }
              }
            }

            var _iteratorNormalCompletion5 = true;
            var _didIteratorError5 = false;

            var _iteratorError5;

            try {
              for (var _iterator5 = _asyncIterator(edge.targetNodes()), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
                const node = _value5;

                if (nodeInstances[node.instanceId]) {
                  connectsTarget = true;
                  break;
                }
              }
            } catch (err) {
              _didIteratorError5 = true;
              _iteratorError5 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion5 && _iterator5.return != null) {
                  await _iterator5.return();
                }
              } finally {
                if (_didIteratorError5) {
                  throw _iteratorError5;
                }
              }
            }

            if (connectsSource && connectsTarget) {
              extraEdges[edge.instanceId] = edge;
            }
          }
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
            await _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }
    } // Okay, now we have a complete set of nodes and edges that we want to
    // include; create pairwise edge entries for every connection


    const graph = {
      nodes: [],
      nodeLookup: {},
      edges: []
    }; // Add all the nodes, and populate a lookup for where they are in the list

    for (const node of Object.values(nodeInstances).concat(Object.values(extraNodes))) {
      graph.nodeLookup[node.instanceId] = graph.nodes.length;
      graph.nodes.push({
        nodeInstance: node,
        dummy: false
      });
    } // Add all the edges...


    for (const edge of Object.values(edgeInstances).concat(Object.values(extraEdges))) {
      if (!edge.classObj.sourceClassId) {
        if (!edge.classObj.targetClassId) {
          // Missing both source and target classes; add dummy nodes for both ends
          graph.edges.push({
            edgeInstance: edge,
            source: graph.nodes.length,
            target: graph.nodes.length + 1
          });
          graph.nodes.push({
            dummy: true
          });
          graph.nodes.push({
            dummy: true
          });
        } else {
          // Add dummy source nodes
          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;

          var _iteratorError6;

          try {
            for (var _iterator6 = _asyncIterator(edge.targetNodes()), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
              const node = _value6;

              if (graph.nodeLookup[node.instanceId] !== undefined) {
                graph.edges.push({
                  edgeInstance: edge,
                  source: graph.nodes.length,
                  target: graph.nodeLookup[node.instanceId]
                });
                graph.nodes.push({
                  dummy: true
                });
              }
            }
          } catch (err) {
            _didIteratorError6 = true;
            _iteratorError6 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion6 && _iterator6.return != null) {
                await _iterator6.return();
              }
            } finally {
              if (_didIteratorError6) {
                throw _iteratorError6;
              }
            }
          }
        }
      } else if (!edge.classObj.targetClassId) {
        // Add dummy target nodes
        var _iteratorNormalCompletion7 = true;
        var _didIteratorError7 = false;

        var _iteratorError7;

        try {
          for (var _iterator7 = _asyncIterator(edge.sourceNodes()), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
            const node = _value7;

            if (graph.nodeLookup[node.instanceId] !== undefined) {
              graph.edges.push({
                edgeInstance: edge,
                source: graph.nodeLookup[node.instanceId],
                target: graph.nodes.length
              });
              graph.nodes.push({
                dummy: true
              });
            }
          }
        } catch (err) {
          _didIteratorError7 = true;
          _iteratorError7 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion7 && _iterator7.return != null) {
              await _iterator7.return();
            }
          } finally {
            if (_didIteratorError7) {
              throw _iteratorError7;
            }
          }
        }
      } else {
        // There should be both source and target nodes for each edge
        var _iteratorNormalCompletion8 = true;
        var _didIteratorError8 = false;

        var _iteratorError8;

        try {
          for (var _iterator8 = _asyncIterator(edge.sourceNodes()), _step8, _value8; _step8 = await _iterator8.next(), _iteratorNormalCompletion8 = _step8.done, _value8 = await _step8.value, !_iteratorNormalCompletion8; _iteratorNormalCompletion8 = true) {
            const sourceNode = _value8;

            if (graph.nodeLookup[sourceNode.instanceId] !== undefined) {
              var _iteratorNormalCompletion9 = true;
              var _didIteratorError9 = false;

              var _iteratorError9;

              try {
                for (var _iterator9 = _asyncIterator(edge.targetNodes()), _step9, _value9; _step9 = await _iterator9.next(), _iteratorNormalCompletion9 = _step9.done, _value9 = await _step9.value, !_iteratorNormalCompletion9; _iteratorNormalCompletion9 = true) {
                  const targetNode = _value9;

                  if (graph.nodeLookup[targetNode.instanceId] !== undefined) {
                    graph.edges.push({
                      edgeInstance: edge,
                      source: graph.nodeLookup[sourceNode.instanceId],
                      target: graph.nodeLookup[targetNode.instanceId]
                    });
                  }
                }
              } catch (err) {
                _didIteratorError9 = true;
                _iteratorError9 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion9 && _iterator9.return != null) {
                    await _iterator9.return();
                  }
                } finally {
                  if (_didIteratorError9) {
                    throw _iteratorError9;
                  }
                }
              }
            }
          }
        } catch (err) {
          _didIteratorError8 = true;
          _iteratorError8 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion8 && _iterator8.return != null) {
              await _iterator8.return();
            }
          } finally {
            if (_didIteratorError8) {
              throw _iteratorError8;
            }
          }
        }
      }
    }

    return graph;
  }

  getNetworkModelGraph({
    raw = true,
    includeDummies = false,
    classList = Object.values(this.classes)
  } = {}) {
    const edgeClasses = [];
    let graph = {
      classes: [],
      classLookup: {},
      classConnections: []
    };

    for (const classObj of classList) {
      // Add and index the class as a node
      const classSpec = raw ? classObj._toRawObject() : {
        classObj
      };
      classSpec.type = classObj.constructor.name;
      graph.classLookup[classObj.classId] = graph.classes.length;
      graph.classes.push(classSpec);

      if (classObj.type === 'Edge') {
        // Store the edge class so we can create classConnections later
        edgeClasses.push(classObj);
      } else if (classObj.type === 'Node' && includeDummies) {
        // Create a "potential" connection + dummy node
        graph.classConnections.push({
          id: `${classObj.classId}>dummy`,
          source: graph.classes.length - 1,
          target: graph.classes.length,
          directed: false,
          location: 'node',
          dummy: true
        });
        graph.classes.push({
          dummy: true
        });
      }
    } // Create existing classConnections


    for (const edgeClass of edgeClasses) {
      if (edgeClass.sourceClassId !== null) {
        // Connect the source node class to the edge class
        graph.classConnections.push({
          id: `${edgeClass.sourceClassId}>${edgeClass.classId}`,
          source: graph.classLookup[edgeClass.sourceClassId],
          target: graph.classLookup[edgeClass.classId],
          directed: edgeClass.directed,
          location: 'source'
        });
      } else if (includeDummies) {
        // Create a "potential" connection + dummy source class
        graph.classConnections.push({
          id: `dummy>${edgeClass.classId}`,
          source: graph.classes.length,
          target: graph.classLookup[edgeClass.classId],
          directed: edgeClass.directed,
          location: 'source',
          dummy: true
        });
        graph.classes.push({
          dummy: true
        });
      }

      if (edgeClass.targetClassId !== null) {
        // Connect the edge class to the target node class
        graph.classConnections.push({
          id: `${edgeClass.classId}>${edgeClass.targetClassId}`,
          source: graph.classLookup[edgeClass.classId],
          target: graph.classLookup[edgeClass.targetClassId],
          directed: edgeClass.directed,
          location: 'target'
        });
      } else if (includeDummies) {
        // Create a "potential" connection + dummy target class
        graph.classConnections.push({
          id: `${edgeClass.classId}>dummy`,
          source: graph.classLookup[edgeClass.classId],
          target: graph.classes.length,
          directed: edgeClass.directed,
          location: 'target',
          dummy: true
        });
        graph.classes.push({
          dummy: true
        });
      }
    }

    return graph;
  }

  getTableDependencyGraph() {
    const graph = {
      tables: [],
      tableLookup: {},
      tableLinks: []
    };
    const tableList = Object.values(this.tables);

    for (const table of tableList) {
      const tableSpec = table._toRawObject();

      tableSpec.type = table.constructor.name;
      graph.tableLookup[table.tableId] = graph.tables.length;
      graph.tables.push(tableSpec);
    } // Fill the graph with links based on parentTables...


    for (const table of tableList) {
      for (const parentTable of table.parentTables) {
        graph.tableLinks.push({
          source: graph.tableLookup[parentTable.tableId],
          target: graph.tableLookup[table.tableId]
        });
      }
    }

    return graph;
  }

  getModelDump() {
    // Because object key orders aren't deterministic, it can be problematic
    // for testing (because ids can randomly change from test run to test run).
    // This function sorts each key, and just replaces IDs with index numbers
    const rawObj = JSON.parse(JSON.stringify(this._toRawObject()));
    const result = {
      classes: Object.values(rawObj.classes).sort((a, b) => {
        const aHash = this.classes[a.classId].getSortHash();
        const bHash = this.classes[b.classId].getSortHash();

        if (aHash < bHash) {
          return -1;
        } else if (aHash > bHash) {
          return 1;
        } else {
          throw new Error(`class hash collision`);
        }
      }),
      tables: Object.values(rawObj.tables).sort((a, b) => {
        const aHash = this.tables[a.tableId].getSortHash();
        const bHash = this.tables[b.tableId].getSortHash();

        if (aHash < bHash) {
          return -1;
        } else if (aHash > bHash) {
          return 1;
        } else {
          throw new Error(`table hash collision`);
        }
      })
    };
    const classLookup = {};
    const tableLookup = {};
    result.classes.forEach((classObj, index) => {
      classLookup[classObj.classId] = index;
    });
    result.tables.forEach((table, index) => {
      tableLookup[table.tableId] = index;
    });

    for (const table of result.tables) {
      table.tableId = tableLookup[table.tableId];

      for (const tableId of Object.keys(table.derivedTables)) {
        table.derivedTables[tableLookup[tableId]] = table.derivedTables[tableId];
        delete table.derivedTables[tableId];
      }

      delete table.data; // don't include any of the data; we just want the model structure
    }

    for (const classObj of result.classes) {
      classObj.classId = classLookup[classObj.classId];
      classObj.tableId = tableLookup[classObj.tableId];

      if (classObj.sourceClassId) {
        classObj.sourceClassId = classLookup[classObj.sourceClassId];
      }

      if (classObj.sourceTableIds) {
        classObj.sourceTableIds = classObj.sourceTableIds.map(tableId => tableLookup[tableId]);
      }

      if (classObj.targetClassId) {
        classObj.targetClassId = classLookup[classObj.targetClassId];
      }

      if (classObj.targetTableIds) {
        classObj.targetTableIds = classObj.targetTableIds.map(tableId => tableLookup[tableId]);
      }

      for (const classId of Object.keys(classObj.edgeClassIds || {})) {
        classObj.edgeClassIds[classLookup[classId]] = classObj.edgeClassIds[classId];
        delete classObj.edgeClassIds[classId];
      }
    }

    return result;
  }

  createSchemaModel() {
    const graph = this.getModelDump();
    graph.tables.forEach(table => {
      table.derivedTables = Object.keys(table.derivedTables);
    });

    const newModel = this._origraph.createModel({
      name: this.name + '_schema'
    });

    const raw = newModel.addStaticTable({
      data: graph,
      name: 'Raw Dump'
    });
    let [classes, tables] = raw.closedTranspose(['classes', 'tables']);
    classes = classes.interpretAsNodes();
    classes.setClassName('Classes');
    raw.delete();
    const sourceClasses = classes.connectToNodeClass({
      otherNodeClass: classes,
      attribute: 'sourceClassId',
      otherAttribute: null
    });
    sourceClasses.setClassName('Source Class');
    sourceClasses.toggleDirection();
    const targetClasses = classes.connectToNodeClass({
      otherNodeClass: classes,
      attribute: 'targetClassId',
      otherAttribute: null
    });
    targetClasses.setClassName('Target Class');
    targetClasses.toggleDirection();
    tables = tables.interpretAsNodes();
    tables.setClassName('Tables');
    const tableDependencies = tables.connectToNodeClass({
      otherNodeClass: tables,
      attribute: 'derivedTables',
      otherAttribute: null
    });
    tableDependencies.setClassName('Is Parent Of');
    tableDependencies.toggleDirection();
    const coreTables = classes.connectToNodeClass({
      otherNodeClass: tables,
      attribute: 'tableId',
      otherAttribute: null
    });
    coreTables.setClassName('Core Table');
    return newModel;
  }

}

let NEXT_MODEL_ID = 1;

class Origraph extends TriggerableMixin(class {}) {
  constructor(localStorage) {
    super();
    this.localStorage = localStorage; // only defined in the browser context

    this.plugins = {};
    this.models = {};
    let existingModels = this.localStorage && this.localStorage.getItem('origraph_models');

    if (existingModels) {
      for (const [modelId, model] of Object.entries(JSON.parse(existingModels))) {
        model.origraph = this;
        this.models[modelId] = new NetworkModel(model);
      }
    }

    this._currentModelId = null;
  }

  registerPlugin(name, plugin) {
    this.plugins[name] = plugin;
  }

  save() {
    /*
    if (this.localStorage) {
      const models = {};
      for (const [modelId, model] of Object.entries(this.models)) {
        models[modelId] = model._toRawObject();
      }
      this.localStorage.setItem('origraph_models', JSON.stringify(models));
      this.trigger('save');
    }
    */
  }

  closeCurrentModel() {
    this._currentModelId = null;
    this.trigger('changeCurrentModel');
  }

  get currentModel() {
    return this.models[this._currentModelId] || null;
  }

  set currentModel(model) {
    this._currentModelId = model ? model.modelId : null;
    this.trigger('changeCurrentModel');
  }

  async loadModel(options) {
    const newModel = this.createModel({
      modelId: options.name
    });
    await newModel.addTextFile(options);
    return newModel;
  }

  createModel(options = {}) {
    while (!options.modelId || this.models[options.modelId]) {
      options.modelId = `model${NEXT_MODEL_ID}`;
      NEXT_MODEL_ID += 1;
    }

    options.origraph = this;
    this.models[options.modelId] = new NetworkModel(options);
    this._currentModelId = options.modelId;
    this.save();
    this.trigger('changeCurrentModel');
    return this.models[options.modelId];
  }

  deleteModel(modelId = this.currentModelId) {
    if (!this.models[modelId]) {
      throw new Error(`Can't delete non-existent model: ${modelId}`);
    }

    delete this.models[modelId];

    if (this._currentModelId === modelId) {
      this._currentModelId = null;
      this.trigger('changeCurrentModel');
    }

    this.save();
  }

  deleteAllModels() {
    this.models = {};
    this._currentModelId = null;
    this.save();
    this.trigger('changeCurrentModel');
  }

}

var name = "origraph";
var version = "0.2.3";
var description = "A library for flexible graph reshaping";
var main = "dist/origraph.cjs.js";
var module$1 = "dist/origraph.esm.js";
var browser = "dist/origraph.umd.js";
var scripts = {
	build: "rollup -c --environment TARGET:all",
	watch: "rollup -c -w",
	watchcjs: "rollup -c -w --environment TARGET:cjs",
	watchumd: "rollup -c -w --environment TARGET:umd",
	watchesm: "rollup -c -w --environment TARGET:esm",
	test: "jest --runInBand",
	pretest: "rollup -c --environment TARGET:cjs",
	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && node --inspect-brk node_modules/.bin/jest --runInBand -t --detectOpenHandles",
	coveralls: "cat ./coverage/lcov.info | node node_modules/.bin/coveralls"
};
var files = [
	"dist"
];
var repository = {
	type: "git",
	url: "git+https://github.com/origraph/origraph.js.git"
};
var author = "Alex Bigelow";
var license = "MIT";
var bugs = {
	url: "https://github.com/origraph/origraph.js/issues"
};
var homepage = "https://github.com/origraph/origraph.js#readme";
var devDependencies = {
	"@babel/core": "^7.1.6",
	"@babel/plugin-proposal-async-generator-functions": "^7.1.0",
	"@babel/preset-env": "^7.1.6",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.6.0",
	coveralls: "^3.0.2",
	jest: "^23.6.0",
	rollup: "^0.67.3",
	"rollup-plugin-babel": "^4.0.3",
	"rollup-plugin-commonjs": "^9.2.0",
	"rollup-plugin-istanbul": "^2.0.1",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.4.0",
	"rollup-plugin-node-resolve": "^3.4.0",
	"rollup-plugin-string": "^2.0.2",
	sha1: "^1.1.1"
};
var dependencies = {
	datalib: "^1.9.2",
	filereader: "^0.10.3",
	"mime-types": "^2.1.21"
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
	"jsnext:main": "dist/origraph.esm.js",
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

let origraph = new Origraph(window.localStorage);
origraph.version = pkg.version;

export default origraph;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0F0dHJUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9tb3RlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0R1cGxpY2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ2hpbGRUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9QYXJlbnRDaGlsZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL0ZpbGVGb3JtYXQuanMiLCIuLi9zcmMvRmlsZUZvcm1hdHMvUGFyc2VGYWlsdXJlLmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL0QzSnNvbi5qcyIsIi4uL3NyYy9Db21tb24vTmV0d29ya01vZGVsLmpzIiwiLi4vc3JjL09yaWdyYXBoLmpzIiwiLi4vc3JjL21vZHVsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdIHx8XG4gICAgICAgIHsgJyc6IFtdIH07XG4gICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10ucHVzaChjYWxsYmFjayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdID0gY2FsbGJhY2s7XG4gICAgICB9XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddID0gW107XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudCwgLi4uYXJncykge1xuICAgICAgY29uc3QgaGFuZGxlQ2FsbGJhY2sgPSBjYWxsYmFjayA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWVzcGFjZSBvZiBPYmplY3Qua2V5cyh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkpIHtcbiAgICAgICAgICBpZiAobmFtZXNwYWNlID09PSAnJykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmZvckVhY2goaGFuZGxlQ2FsbGJhY2spO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoYW5kbGVDYWxsYmFjayh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICB0aGlzLnRhYmxlID0gb3B0aW9ucy50YWJsZTtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLnRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGFuZCB0YWJsZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc09iaiA9IG9wdGlvbnMuY2xhc3NPYmogfHwgbnVsbDtcbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSBvcHRpb25zLmNvbm5lY3RlZEl0ZW1zIHx8IHt9O1xuICAgIHRoaXMuZHVwbGljYXRlSXRlbXMgPSBvcHRpb25zLmR1cGxpY2F0ZUl0ZW1zIHx8IFtdO1xuICB9XG4gIHJlZ2lzdGVyRHVwbGljYXRlIChpdGVtKSB7XG4gICAgdGhpcy5kdXBsaWNhdGVJdGVtcy5wdXNoKGl0ZW0pO1xuICB9XG4gIGNvbm5lY3RJdGVtIChpdGVtKSB7XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdID0gdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdIHx8IFtdO1xuICAgIGlmICh0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0uaW5kZXhPZihpdGVtKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGR1cCBvZiB0aGlzLmR1cGxpY2F0ZUl0ZW1zKSB7XG4gICAgICBpdGVtLmNvbm5lY3RJdGVtKGR1cCk7XG4gICAgICBkdXAuY29ubmVjdEl0ZW0oaXRlbSk7XG4gICAgfVxuICB9XG4gIGRpc2Nvbm5lY3QgKCkge1xuICAgIGZvciAoY29uc3QgaXRlbUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNvbm5lY3RlZEl0ZW1zKSkge1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1MaXN0KSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gKGl0ZW0uY29ubmVjdGVkSXRlbXNbdGhpcy50YWJsZS50YWJsZUlkXSB8fCBbXSkuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgIGl0ZW0uY29ubmVjdGVkSXRlbXNbdGhpcy50YWJsZS50YWJsZUlkXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSB7fTtcbiAgfVxuICBnZXQgaW5zdGFuY2VJZCAoKSB7XG4gICAgcmV0dXJuIGB7XCJjbGFzc0lkXCI6XCIke3RoaXMuY2xhc3NPYmouY2xhc3NJZH1cIixcImluZGV4XCI6XCIke3RoaXMuaW5kZXh9XCJ9YDtcbiAgfVxuICBnZXQgZXhwb3J0SWQgKCkge1xuICAgIHJldHVybiBgJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XyR7dGhpcy5pbmRleH1gO1xuICB9XG4gIGVxdWFscyAoaXRlbSkge1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlSWQgPT09IGl0ZW0uaW5zdGFuY2VJZDtcbiAgfVxuICBhc3luYyAqIGhhbmRsZUxpbWl0IChvcHRpb25zLCBpdGVyYXRvcnMpIHtcbiAgICBsZXQgbGltaXQgPSBJbmZpbml0eTtcbiAgICBpZiAob3B0aW9ucy5saW1pdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsaW1pdCA9IG9wdGlvbnMubGltaXQ7XG4gICAgICBkZWxldGUgb3B0aW9ucy5saW1pdDtcbiAgICB9XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgaXRlcmF0b3Igb2YgaXRlcmF0b3JzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgaXRlcmF0b3IpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgaSsrO1xuICAgICAgICBpZiAoaXRlbSA9PT0gbnVsbCB8fCBpID49IGxpbWl0KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIC8vIEZpcnN0IG1ha2Ugc3VyZSB0aGF0IGFsbCB0aGUgdGFibGUgY2FjaGVzIGhhdmUgYmVlbiBmdWxseSBidWlsdCBhbmRcbiAgICAvLyBjb25uZWN0ZWRcbiAgICBhd2FpdCBQcm9taXNlLmFsbCh0YWJsZUlkcy5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5jbGFzc09iai5tb2RlbC50YWJsZXNbdGFibGVJZF0uYnVpbGRDYWNoZSgpO1xuICAgIH0pKTtcbiAgICB5aWVsZCAqIHRoaXMuX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcyk7XG4gIH1cbiAgKiBfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0aGlzLnJlc2V0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IG5leHRUYWJsZUlkID0gdGFibGVJZHNbMF07XG4gICAgaWYgKHRhYmxlSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgeWllbGQgKiAodGhpcy5jb25uZWN0ZWRJdGVtc1tuZXh0VGFibGVJZF0gfHwgW10pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCByZW1haW5pbmdUYWJsZUlkcyA9IHRhYmxlSWRzLnNsaWNlKDEpO1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuY29ubmVjdGVkSXRlbXNbbmV4dFRhYmxlSWRdIHx8IFtdKSB7XG4gICAgICAgIHlpZWxkICogaXRlbS5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHJlbWFpbmluZ1RhYmxlSWRzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBUYWJsZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMubW9kZWwgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG5cbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzID0gb3B0aW9ucy5kZXJpdmVkVGFibGVzIHx8IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIHx8IHt9KSkge1xuICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLnN1cHByZXNzZWRBdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSAhIW9wdGlvbnMuc3VwcHJlc3NJbmRleDtcblxuICAgIHRoaXMuX2luZGV4RmlsdGVyID0gKG9wdGlvbnMuaW5kZXhGaWx0ZXIgJiYgdGhpcy5oeWRyYXRlRnVuY3Rpb24ob3B0aW9ucy5pbmRleEZpbHRlcikpIHx8IG51bGw7XG4gICAgdGhpcy5fYXR0cmlidXRlRmlsdGVycyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5hdHRyaWJ1dGVGaWx0ZXJzIHx8IHt9KSkge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fbGltaXRQcm9taXNlcyA9IHt9O1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgYXR0cmlidXRlczogdGhpcy5fYXR0cmlidXRlcyxcbiAgICAgIGRlcml2ZWRUYWJsZXM6IHRoaXMuX2Rlcml2ZWRUYWJsZXMsXG4gICAgICBkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zOiB7fSxcbiAgICAgIHN1cHByZXNzZWRBdHRyaWJ1dGVzOiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyxcbiAgICAgIHN1cHByZXNzSW5kZXg6IHRoaXMuX3N1cHByZXNzSW5kZXgsXG4gICAgICBhdHRyaWJ1dGVGaWx0ZXJzOiB7fSxcbiAgICAgIGluZGV4RmlsdGVyOiAodGhpcy5faW5kZXhGaWx0ZXIgJiYgdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbih0aGlzLl9pbmRleEZpbHRlcikpIHx8IG51bGxcbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICByZXN1bHQuYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGU7XG4gIH1cbiAgaHlkcmF0ZUZ1bmN0aW9uIChzdHJpbmdpZmllZEZ1bmMpIHtcbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgLy8gVGhlIGNhY2hlIGhhcyBhbHJlYWR5IGJlZW4gYnVpbHQ7IGp1c3QgZ3JhYiBkYXRhIGZyb20gaXQgZGlyZWN0bHlcbiAgICAgIHlpZWxkICogdGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlICYmIHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGggPj0gbGltaXQpIHtcbiAgICAgIC8vIFRoZSBjYWNoZSBpc24ndCBmaW5pc2hlZCwgYnV0IGl0J3MgYWxyZWFkeSBsb25nIGVub3VnaCB0byBzYXRpc2Z5IHRoaXNcbiAgICAgIC8vIHJlcXVlc3RcbiAgICAgIHlpZWxkICogdGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkIGJ1aWxkaW5nIChhbmQgbWF5YmUgZGlkbid0IGV2ZW4gc3RhcnQgeWV0KTtcbiAgICAgIC8vIGtpY2sgaXQgb2ZmLCBhbmQgdGhlbiB3YWl0IGZvciBlbm91Z2ggaXRlbXMgdG8gYmUgcHJvY2Vzc2VkIHRvIHNhdGlzZnlcbiAgICAgIC8vIHRoZSBsaW1pdFxuICAgICAgdGhpcy5idWlsZENhY2hlKCk7XG4gICAgICB5aWVsZCAqIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0gPSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSB8fCBbXTtcbiAgICAgICAgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0ucHVzaCh7IHJlc29sdmUsIHJlamVjdCB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgX2J1aWxkQ2FjaGUgKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IFtdO1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZSgpO1xuICAgIGxldCBpID0gMDtcbiAgICBsZXQgdGVtcCA9IHsgZG9uZTogZmFsc2UgfTtcbiAgICB3aGlsZSAoIXRlbXAuZG9uZSkge1xuICAgICAgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlIHx8IHRlbXAgPT09IG51bGwpIHtcbiAgICAgICAgLy8gcmVzZXQoKSB3YXMgY2FsbGVkIGJlZm9yZSB3ZSBjb3VsZCBmaW5pc2g7IHdlIG5lZWQgdG8gbGV0IGV2ZXJ5b25lXG4gICAgICAgIC8vIHRoYXQgd2FzIHdhaXRpbmcgb24gdXMga25vdyB0aGF0IHdlIGNhbid0IGNvbXBseVxuICAgICAgICB0aGlzLmhhbmRsZVJlc2V0KHJlamVjdCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghdGVtcC5kb25lKSB7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKHRlbXAudmFsdWUpKSB7XG4gICAgICAgICAgLy8gT2theSwgdGhpcyBpdGVtIHBhc3NlZCBhbGwgZmlsdGVycywgYW5kIGlzIHJlYWR5IHRvIGJlIHNlbnQgb3V0XG4gICAgICAgICAgLy8gaW50byB0aGUgd29ybGRcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbdGVtcC52YWx1ZS5pbmRleF0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoO1xuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZS5wdXNoKHRlbXAudmFsdWUpO1xuICAgICAgICAgIGkrKztcbiAgICAgICAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggZGF0YSBub3cgdG8gc2F0aXNmeSBhbnkgd2FpdGluZyByZXF1ZXN0c1xuICAgICAgICAgICAgaWYgKGxpbWl0IDw9IGkpIHtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBEb25lIGl0ZXJhdGluZyEgV2UgY2FuIGdyYWR1YXRlIHRoZSBwYXJ0aWFsIGNhY2hlIC8gbG9va3VwcyBpbnRvXG4gICAgLy8gZmluaXNoZWQgb25lcywgYW5kIHNhdGlzZnkgYWxsIHRoZSByZXF1ZXN0c1xuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgdGhpcy5fY2FjaGVMb29rdXAgPSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICB9XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgdGhpcy50cmlnZ2VyKCdjYWNoZUJ1aWx0Jyk7XG4gICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gIH1cbiAgYnVpbGRDYWNoZSAoKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGU7XG4gICAgfSBlbHNlIGlmICghdGhpcy5fY2FjaGVQcm9taXNlKSB7XG4gICAgICB0aGlzLl9jYWNoZVByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vIFRoZSBzZXRUaW1lb3V0IGhlcmUgaXMgYWJzb2x1dGVseSBuZWNlc3NhcnksIG9yIHRoaXMuX2NhY2hlUHJvbWlzZVxuICAgICAgICAvLyB3b24ndCBiZSBzdG9yZWQgaW4gdGltZSBmb3IgdGhlIG5leHQgYnVpbGRDYWNoZSgpIGNhbGwgdGhhdCBjb21lc1xuICAgICAgICAvLyB0aHJvdWdoXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIHRoaXMuX2J1aWxkQ2FjaGUocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgY29uc3QgaXRlbXNUb1Jlc2V0ID0gKHRoaXMuX2NhY2hlIHx8IFtdKVxuICAgICAgLmNvbmNhdCh0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgW10pO1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtc1RvUmVzZXQpIHtcbiAgICAgIGl0ZW0ucmVzZXQgPSB0cnVlO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIGZvciAoY29uc3QgZGVyaXZlZFRhYmxlIG9mIHRoaXMuZGVyaXZlZFRhYmxlcykge1xuICAgICAgZGVyaXZlZFRhYmxlLnJlc2V0KCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncmVzZXQnKTtcbiAgfVxuICBoYW5kbGVSZXNldCAocmVqZWN0KSB7XG4gICAgZm9yIChjb25zdCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0ucmVqZWN0KCk7XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlcztcbiAgICB9XG4gICAgcmVqZWN0KCk7XG4gIH1cbiAgYXN5bmMgY291bnRSb3dzICgpIHtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpKS5sZW5ndGg7XG4gIH1cbiAgYXN5bmMgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgICAgaWYgKHdyYXBwZWRJdGVtLnJvd1thdHRyXSBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB3cmFwcGVkSXRlbS5kZWxheWVkUm93ID0gd3JhcHBlZEl0ZW0uZGVsYXllZFJvdyB8fCB7fTtcbiAgICAgICAgICB3cmFwcGVkSXRlbS5kZWxheWVkUm93W2F0dHJdID0gYXdhaXQgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgICAgICB9KSgpO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gd3JhcHBlZEl0ZW0ucm93KSB7XG4gICAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGRlbGV0ZSB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBhd2FpdCBmdW5jKGF3YWl0IHdyYXBwZWRJdGVtLnJvd1thdHRyXSk7XG4gICAgICBpZiAoIWtlZXApIHsgYnJlYWs7IH1cbiAgICB9XG4gICAgaWYgKGtlZXApIHtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbmlzaCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3cmFwcGVkSXRlbS5kaXNjb25uZWN0KCk7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaWx0ZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIGtlZXA7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBjbGFzc09iaiA/IGNsYXNzT2JqLl93cmFwKG9wdGlvbnMpIDogbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3Qgb3RoZXJJdGVtIG9mIG9wdGlvbnMuaXRlbXNUb0Nvbm5lY3QgfHwgW10pIHtcbiAgICAgIHdyYXBwZWRJdGVtLmNvbm5lY3RJdGVtKG90aGVySXRlbSk7XG4gICAgICBvdGhlckl0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGdldEluZGV4RGV0YWlscyAoKSB7XG4gICAgY29uc3QgZGV0YWlscyA9IHsgbmFtZTogbnVsbCB9O1xuICAgIGlmICh0aGlzLl9zdXBwcmVzc0luZGV4KSB7XG4gICAgICBkZXRhaWxzLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGRldGFpbHMuZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZGV0YWlscztcbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHt9O1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5leHBlY3RlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5vYnNlcnZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZGVyaXZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fYXR0cmlidXRlRmlsdGVycykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG4gIGdldCBhdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5nZXRBdHRyaWJ1dGVEZXRhaWxzKCkpO1xuICB9XG4gIGdldCBjdXJyZW50RGF0YSAoKSB7XG4gICAgLy8gQWxsb3cgcHJvYmluZyB0byBzZWUgd2hhdGV2ZXIgZGF0YSBoYXBwZW5zIHRvIGJlIGF2YWlsYWJsZVxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgW10sXG4gICAgICBsb29rdXA6IHRoaXMuX2NhY2hlTG9va3VwIHx8IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cCB8fCB7fSxcbiAgICAgIGNvbXBsZXRlOiAhIXRoaXMuX2NhY2hlXG4gICAgfTtcbiAgfVxuICBhc3luYyBnZXRJdGVtIChpbmRleCA9IG51bGwpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVMb29rdXApIHtcbiAgICAgIHJldHVybiBpbmRleCA9PT0gbnVsbCA/IHRoaXMuX2NhY2hlWzBdIDogdGhpcy5fY2FjaGVbdGhpcy5fY2FjaGVMb29rdXBbaW5kZXhdXTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cCAmJlxuICAgICAgICAoKGluZGV4ID09PSBudWxsICYmIHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGggPiAwKSB8fFxuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgIHJldHVybiBpbmRleCA9PT0gbnVsbCA/IHRoaXMuX3BhcnRpYWxDYWNoZVswXVxuICAgICAgICA6IHRoaXMuX3BhcnRpYWxDYWNoZVt0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbaW5kZXhdXTtcbiAgICB9XG4gICAgLy8gU3R1cGlkIGFwcHJvYWNoIHdoZW4gdGhlIGNhY2hlIGlzbid0IGJ1aWx0OiBpbnRlcmF0ZSB1bnRpbCB3ZSBzZWUgdGhlXG4gICAgLy8gaW5kZXguIFN1YmNsYXNzZXMgY291bGQgb3ZlcnJpZGUgdGhpc1xuICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZXJhdGUoKSkge1xuICAgICAgaWYgKGl0ZW0gPT09IG51bGwgfHwgaXRlbS5pbmRleCA9PT0gaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBzdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZV0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhZGRGaWx0ZXIgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2luZGV4RmlsdGVyID0gZnVuYztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZSA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZSAmJiB0aGlzLm1vZGVsLnRhYmxlc1tleGlzdGluZ1RhYmxlLnRhYmxlSWRdKSB8fCBudWxsO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnUHJvbW90ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdFeHBhbmRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgdW5yb2xsIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ1Vucm9sbGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZShsaW1pdCkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiBpbmRleGVzLm1hcChpbmRleCA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXhcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZShsaW1pdCkpIHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleDogd3JhcHBlZEl0ZW0uaW5kZXhcbiAgICAgIH07XG4gICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuICBkdXBsaWNhdGUgKCkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVUYWJsZSh7XG4gICAgICB0eXBlOiAnRHVwbGljYXRlZFRhYmxlJ1xuICAgIH0pO1xuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0LCB0eXBlID0gJ0Nvbm5lY3RlZFRhYmxlJykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZSh7IHR5cGUgfSk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgZm9yIChjb25zdCBvdGhlclRhYmxlIG9mIG90aGVyVGFibGVMaXN0KSB7XG4gICAgICBvdGhlclRhYmxlLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGdldCBpblVzZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLmNsYXNzZXMpLnNvbWUoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlSWQgPT09IHRoaXMudGFibGVJZCB8fFxuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xIHx8XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTE7XG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBpZiAodGhpcy5pblVzZSkge1xuICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgICAgZXJyLmluVXNlID0gdHJ1ZTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0aGlzLnBhcmVudFRhYmxlcykge1xuICAgICAgZGVsZXRlIHBhcmVudFRhYmxlLmRlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9uYW1lO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLl9kYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93OiB0aGlzLl9kYXRhW2luZGV4XSB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljRGljdFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB7fTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX25hbWU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpcmVkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNvbnN0IEF0dHJUYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oc3VwZXJjbGFzcykge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgICB9XG4gICAgfVxuICAgIF90b1Jhd09iamVjdCAoKSB7XG4gICAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgICB9XG4gICAgZ2V0IG5hbWUgKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEF0dHJUYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mQXR0clRhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQXR0clRhYmxlTWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgQXR0clRhYmxlTWl4aW4gZnJvbSAnLi9BdHRyVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFByb21vdGVkVGFibGUgZXh0ZW5kcyBBdHRyVGFibGVNaXhpbihUYWJsZSkge1xuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgLy8gV2Ugb3ZlcnJpZGUgX2J1aWxkQ2FjaGUgYmVjYXVzZSB3ZSBkb24ndCBhY3R1YWxseSB3YW50IHRvIGNhbGwgX2ZpbmlzaEl0ZW1cbiAgICAvLyB1bnRpbCBhbGwgdW5pcXVlIHZhbHVlcyBoYXZlIGJlZW4gc2VlblxuICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZSA9IFtdO1xuICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cCA9IHt9O1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IFtdO1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZSgpO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgdGVtcCA9PT0gbnVsbCkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW3RlbXAudmFsdWUuaW5kZXhdID0gdGhpcy5fdW5maW5pc2hlZENhY2hlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdW5maW5pc2hlZENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIE9rYXksIG5vdyB3ZSd2ZSBzZWVuIGV2ZXJ5dGhpbmc7IHdlIGNhbiBjYWxsIF9maW5pc2hJdGVtIG9uIGVhY2ggb2YgdGhlXG4gICAgLy8gdW5pcXVlIHZhbHVlc1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHRoaXMuX3VuZmluaXNoZWRDYWNoZSkge1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odmFsdWUpKSB7XG4gICAgICAgIC8vIE9rYXksIHRoaXMgaXRlbSBwYXNzZWQgYWxsIGZpbHRlcnMsIGFuZCBpcyByZWFkeSB0byBiZSBzZW50IG91dFxuICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbdmFsdWUuaW5kZXhdID0gdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godmFsdWUpO1xuICAgICAgICBpKys7XG4gICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGRhdGEgbm93IHRvIHNhdGlzZnkgYW55IHdhaXRpbmcgcmVxdWVzdHNcbiAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICAgICAgICByZXNvbHZlKHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBEb25lIGl0ZXJhdGluZyEgV2UgY2FuIGdyYWR1YXRlIHRoZSBwYXJ0aWFsIGNhY2hlIC8gbG9va3VwcyBpbnRvXG4gICAgLy8gZmluaXNoZWQgb25lcywgYW5kIHNhdGlzZnkgYWxsIHRoZSByZXF1ZXN0c1xuICAgIGRlbGV0ZSB0aGlzLl91bmZpbmlzaGVkQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cDtcbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIHRoaXMuX2NhY2hlTG9va3VwID0gdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIHRoaXMudHJpZ2dlcignY2FjaGVCdWlsdCcpO1xuICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IFN0cmluZyhhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQhXG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW2luZGV4XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSXRlbSA9IHRoaXMuX3VuZmluaXNoZWRDYWNoZVt0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbaW5kZXhdXTtcbiAgICAgICAgZXhpc3RpbmdJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB3cmFwcGVkUGFyZW50LmNvbm5lY3RJdGVtKGV4aXN0aW5nSXRlbSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmFjZXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICB0aGlzLl92YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlICsgdGhpcy5fdmFsdWU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBTdHJpbmcodGhpcy5fdmFsdWUpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAvLyBOb3JtYWwgZmFjZXRpbmcganVzdCBnaXZlcyBhIHN1YnNldCBvZiB0aGUgb3JpZ2luYWwgdGFibGVcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogT2JqZWN0LmFzc2lnbih7fSwgd3JhcHBlZFBhcmVudC5yb3cpLFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGYWNldGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIFRyYW5zcG9zZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5faW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIGlmICh0aGlzLl9pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmluZGV4ID0gdGhpcy5faW5kZXg7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9pbmRleDtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGAke3RoaXMuX2luZGV4fWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGF3YWl0IHRoaXMucGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuXG4gICAgLy8gSXRlcmF0ZSB0aGUgcm93J3MgYXR0cmlidXRlcyBhcyBpbmRleGVzXG4gICAgY29uc3Qgd3JhcHBlZFBhcmVudCA9IHRoaXMucGFyZW50VGFibGUuX2NhY2hlW3RoaXMucGFyZW50VGFibGUuX2NhY2hlTG9va3VwW3RoaXMuX2luZGV4XV0gfHwgeyByb3c6IHt9IH07XG4gICAgZm9yIChjb25zdCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgcm93OiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gdmFsdWUgOiB7IHZhbHVlIH0sXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVHJhbnNwb3NlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLmdldFNvcnRIYXNoKCkpLmpvaW4oJywnKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBEb24ndCB0cnkgdG8gY29ubmVjdCB2YWx1ZXMgdW50aWwgYWxsIG9mIHRoZSBwYXJlbnQgdGFibGVzJyBjYWNoZXMgYXJlXG4gICAgLy8gYnVpbHQ7IFRPRE86IG1pZ2h0IGJlIGFibGUgdG8gZG8gc29tZXRoaW5nIG1vcmUgcmVzcG9uc2l2ZSBoZXJlP1xuICAgIGF3YWl0IFByb21pc2UuYWxsKHBhcmVudFRhYmxlcy5tYXAocFRhYmxlID0+IHBUYWJsZS5idWlsZENhY2hlKCkpKTtcblxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlTG9va3VwKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVMb29rdXApKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXRcbiAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XV0pXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRHVwbGljYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIC8vIFlpZWxkIHRoZSBzYW1lIGl0ZW1zIHdpdGggdGhlIHNhbWUgY29ubmVjdGlvbnMsIGJ1dCB3cmFwcGVkIGFuZCBmaW5pc2hlZFxuICAgIC8vIGJ5IHRoaXMgdGFibGVcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5wYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXg6IGl0ZW0uaW5kZXgsXG4gICAgICAgIHJvdzogaXRlbS5yb3csXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBPYmplY3QudmFsdWVzKGl0ZW0uY29ubmVjdGVkSXRlbXMpLnJlZHVjZSgoYWdnLCBpdGVtTGlzdCkgPT4ge1xuICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KGl0ZW1MaXN0KTtcbiAgICAgICAgfSwgW10pXG4gICAgICB9KTtcbiAgICAgIGl0ZW0ucmVnaXN0ZXJEdXBsaWNhdGUobmV3SXRlbSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRHVwbGljYXRlZFRhYmxlO1xuIiwiaW1wb3J0IEF0dHJUYWJsZU1peGluIGZyb20gJy4vQXR0clRhYmxlTWl4aW4uanMnO1xuXG5jb25zdCBDaGlsZFRhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBBdHRyVGFibGVNaXhpbihzdXBlcmNsYXNzKSB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIF93cmFwIChvcHRpb25zKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gc3VwZXIuX3dyYXAob3B0aW9ucyk7XG4gICAgICBuZXdJdGVtLnBhcmVudEluZGV4ID0gb3B0aW9ucy5wYXJlbnRJbmRleDtcbiAgICAgIHJldHVybiBuZXdJdGVtO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQ2hpbGRUYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mQ2hpbGRUYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IENoaWxkVGFibGVNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBDaGlsZFRhYmxlTWl4aW4gZnJvbSAnLi9DaGlsZFRhYmxlTWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgQ2hpbGRUYWJsZU1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCByb3cgPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKHJvdyAhPT0gdW5kZWZpbmVkICYmIHJvdyAhPT0gbnVsbCAmJiBPYmplY3Qua2V5cyhyb3cpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdyxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF0sXG4gICAgICAgICAgcGFyZW50SW5kZXg6IHdyYXBwZWRQYXJlbnQuaW5kZXhcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgICBpbmRleCsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFeHBhbmRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IENoaWxkVGFibGVNaXhpbiBmcm9tICcuL0NoaWxkVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFVucm9sbGVkVGFibGUgZXh0ZW5kcyBDaGlsZFRhYmxlTWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHJvd3MgPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKHJvd3MgIT09IHVuZGVmaW5lZCAmJiByb3dzICE9PSBudWxsICYmXG4gICAgICAgICAgdHlwZW9mIHJvd3NbU3ltYm9sLml0ZXJhdG9yXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzKSB7XG4gICAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgICByb3csXG4gICAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF0sXG4gICAgICAgICAgICBwYXJlbnRJbmRleDogd3JhcHBlZFBhcmVudC5pbmRleFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFVucm9sbGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFBhcmVudENoaWxkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJy8nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuZ2V0U29ydEhhc2goKSkuam9pbignLCcpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGxldCBwYXJlbnRUYWJsZSwgY2hpbGRUYWJsZTtcbiAgICBpZiAodGhpcy5wYXJlbnRUYWJsZXNbMF0ucGFyZW50VGFibGUgPT09IHRoaXMucGFyZW50VGFibGVzWzFdKSB7XG4gICAgICBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzFdO1xuICAgICAgY2hpbGRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzBdO1xuICAgIH0gZWxzZSBpZiAodGhpcy5wYXJlbnRUYWJsZXNbMV0ucGFyZW50VGFibGUgPT09IHRoaXMucGFyZW50VGFibGVzWzBdKSB7XG4gICAgICBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzBdO1xuICAgICAgY2hpbGRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzFdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudENoaWxkVGFibGUgbm90IHNldCB1cCBwcm9wZXJseWApO1xuICAgIH1cblxuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaGlsZCBvZiBjaGlsZFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgcGFyZW50ID0gYXdhaXQgcGFyZW50VGFibGUuZ2V0SXRlbShjaGlsZC5wYXJlbnRJbmRleCk7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogW3BhcmVudCwgY2hpbGRdXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQYXJlbnRDaGlsZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9uc1xuICAgIH07XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUgKyB0aGlzLmNsYXNzTmFtZTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlTmV3Q2xhc3MgKG5ld1RhYmxlLCB0eXBlID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGVcbiAgICB9KTtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCwgJ0dlbmVyaWNDbGFzcycpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSkpO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUudW5yb2xsKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuVHJhbnNwb3NlKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0ge30pIHtcbiAgICBsZXQgZWRnZUlkcyA9IG9wdGlvbnMuY2xhc3Nlc1xuICAgICAgPyBvcHRpb25zLmNsYXNzZXMubWFwKGNsYXNzT2JqID0+IGNsYXNzT2JqLmNsYXNzSWQpXG4gICAgICA6IG9wdGlvbnMuY2xhc3NJZHMgfHwgT2JqZWN0LmtleXModGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IGl0ZXJhdG9ycyA9IFtdO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIGVkZ2VJZHMpIHtcbiAgICAgIGlmICghdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHNbZWRnZUlkXSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuY2xhc3NPYmoubW9kZWwuY2xhc3Nlc1tlZGdlSWRdO1xuICAgICAgY29uc3Qgcm9sZSA9IHRoaXMuY2xhc3NPYmouZ2V0RWRnZVJvbGUoZWRnZUNsYXNzKTtcbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAndGFyZ2V0Jykge1xuICAgICAgICBjb25zdCB0YWJsZUlkcyA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGl0ZXJhdG9ycy5wdXNoKHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBpdGVyYXRvcnMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gIH1cbiAgKiBlZGdlQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGdldEVkZ2VSb2xlIChlZGdlQ2xhc3MpIHtcbiAgICBpZiAoIXRoaXMuZWRnZUNsYXNzSWRzW2VkZ2VDbGFzcy5jbGFzc0lkXSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICByZXR1cm4gJ2JvdGgnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICdzb3VyY2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgcmV0dXJuICd0YXJnZXQnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIG1pc21hdGNoIGJldHdlZW4gbm9kZSBhbmQgZWRnZSBjbGFzc0lkc2ApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBOb2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICh7IGF1dG9jb25uZWN0ID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmICghYXV0b2Nvbm5lY3QgfHwgZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgLy8gQXJlIHdlIHRoZSBzb3VyY2Ugb3IgdGFyZ2V0IG9mIHRoZSBleGlzdGluZyBlZGdlIChpbnRlcm5hbGx5LCBpbiB0ZXJtc1xuICAgICAgLy8gb2Ygc291cmNlSWQgLyB0YXJnZXRJZCwgbm90IGVkZ2VDbGFzcy5kaXJlY3Rpb24pP1xuICAgICAgY29uc3QgaXNTb3VyY2UgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkO1xuXG4gICAgICAvLyBBcyB3ZSdyZSBjb252ZXJ0ZWQgdG8gYW4gZWRnZSwgb3VyIG5ldyByZXN1bHRpbmcgc291cmNlIEFORCB0YXJnZXRcbiAgICAgIC8vIHNob3VsZCBiZSB3aGF0ZXZlciBpcyBhdCB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcyAoaWYgYW55dGhpbmcpXG4gICAgICBpZiAoaXNTb3VyY2UpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgbm9kZSBjbGFzcyBvbiB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcywgYWRkIG91clxuICAgICAgLy8gaWQgdG8gaXRzIGxpc3Qgb2YgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG5vZGVDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgaWYgKG5vZGVDbGFzcykge1xuICAgICAgICBub2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoIWlzU291cmNlKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAvLyBPa2F5LCB3ZSd2ZSBnb3QgdHdvIGVkZ2VzLCBzbyB0aGlzIGlzIGEgbGl0dGxlIG1vcmUgc3RyYWlnaHRmb3J3YXJkXG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgICBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgLy8gQWRkIHRoaXMgY2xhc3MgdG8gdGhlIHNvdXJjZSdzIC8gdGFyZ2V0J3MgZWRnZUNsYXNzSWRzXG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEaXNjb25uZWN0IHRoZSBleGlzdGluZyBlZGdlIGNsYXNzZXMgZnJvbSB0aGUgbmV3IChub3cgZWRnZSkgY2xhc3NcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfVxuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgbGV0IHRoaXNIYXNoLCBvdGhlckhhc2gsIHNvdXJjZVRhYmxlSWRzLCB0YXJnZXRUYWJsZUlkcztcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGU7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbIHRoaXNIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgaWYgKG90aGVyQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlLnByb21vdGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbIG90aGVySGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkcyxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSksICdOb2RlQ2xhc3MnKTtcbiAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIChjaGlsZENsYXNzKSB7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzLnRhYmxlLmNvbm5lY3QoW2NoaWxkQ2xhc3MudGFibGVdLCAnUGFyZW50Q2hpbGRUYWJsZScpO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFtdLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogY2hpbGRDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHM6IFtdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBjaGlsZENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9DaGlsZE5vZGVDbGFzcyhuZXdOb2RlQ2xhc3MpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgdW5yb2xsIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLnVucm9sbChhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9DaGlsZE5vZGVDbGFzcyhuZXdOb2RlQ2xhc3MpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgcHJvamVjdE5ld0VkZ2UgKGNsYXNzSWRMaXN0KSB7XG4gICAgY29uc3QgY2xhc3NMaXN0ID0gY2xhc3NJZExpc3QubWFwKGNsYXNzSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY2xhc3Nlc1tjbGFzc0lkXTtcbiAgICB9KTtcbiAgICBpZiAoY2xhc3NMaXN0Lmxlbmd0aCA8IDIgfHwgY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS50eXBlICE9PSAnTm9kZScpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjbGFzc0lkTGlzdGApO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VDbGFzc0lkID0gdGhpcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzSWQgPSBjbGFzc0xpc3RbY2xhc3NMaXN0Lmxlbmd0aCAtIDFdLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIGxldCB0YWJsZUlkO1xuICAgIGNvbnN0IG1pZGRsZUluZGV4ID0gTWF0aC5mbG9vcigoY2xhc3NMaXN0Lmxlbmd0aCAtIDEpIC8gMik7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbGFzc0xpc3QubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICBpZiAoaSA8IG1pZGRsZUluZGV4KSB7XG4gICAgICAgIGlmIChjbGFzc0xpc3RbaV0udHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgICAgc291cmNlVGFibGVJZHMudW5zaGlmdChjbGFzc0xpc3RbaV0udGFibGVJZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgdGVtcCA9IEFycmF5LmZyb20oY2xhc3NMaXN0W2ldLnNvdXJjZVRhYmxlSWRzKS5yZXZlcnNlKCk7XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIHRlbXApIHtcbiAgICAgICAgICAgIHNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNvdXJjZVRhYmxlSWRzLnVuc2hpZnQoY2xhc3NMaXN0W2ldLnRhYmxlSWQpO1xuICAgICAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc0xpc3RbaV0udGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgICAgIHNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGkgPT09IG1pZGRsZUluZGV4KSB7XG4gICAgICAgIHRhYmxlSWQgPSBjbGFzc0xpc3RbaV0udGFibGUuZHVwbGljYXRlKCkudGFibGVJZDtcbiAgICAgICAgaWYgKGNsYXNzTGlzdFtpXS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgICBjb25zdCB0ZW1wID0gQXJyYXkuZnJvbShjbGFzc0xpc3RbaV0uc291cmNlVGFibGVJZHMpLnJldmVyc2UoKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgdGVtcCkge1xuICAgICAgICAgICAgc291cmNlVGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzTGlzdFtpXS50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICAgICAgdGFyZ2V0VGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChjbGFzc0xpc3RbaV0udHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgICAgdGFyZ2V0VGFibGVJZHMudW5zaGlmdChjbGFzc0xpc3RbaV0udGFibGVJZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgdGVtcCA9IEFycmF5LmZyb20oY2xhc3NMaXN0W2ldLnNvdXJjZVRhYmxlSWRzKS5yZXZlcnNlKCk7XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIHRlbXApIHtcbiAgICAgICAgICAgIHRhcmdldFRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRhcmdldFRhYmxlSWRzLnVuc2hpZnQoY2xhc3NMaXN0W2ldLnRhYmxlSWQpO1xuICAgICAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc0xpc3RbaV0udGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgICAgIHRhcmdldFRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIHRoaXMuY29ubmVjdGVkQ2xhc3NlcygpKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBzb3VyY2VOb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkXS50YWJsZUlkO1xuICAgIGNvbnN0IHRhYmxlSWRzID0gdGhpcy5jbGFzc09iai5zb3VyY2VUYWJsZUlkcy5jb25jYXQoWyBzb3VyY2VUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIHRhcmdldE5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkID09PSBudWxsIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzZXMgJiYgIW9wdGlvbnMuY2xhc3Nlcy5maW5kKGQgPT4gdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkID09PSBkLmNsYXNzSWQpKSB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc0lkcyAmJiBvcHRpb25zLmNsYXNzSWRzLmluZGV4T2YodGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkKSA9PT0gLTEpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHRhcmdldFRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWRdLnRhYmxlSWQ7XG4gICAgY29uc3QgdGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLmNvbmNhdChbIHRhcmdldFRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogbm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpLFxuICAgICAgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKVxuICAgIF0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gc291cmNlVGFibGVJZHMgYW5kIHRhcmdldFRhYmxlSWRzIGFyZSBsaXN0cyBvZiBhbnkgaW50ZXJtZWRpYXRlIHRhYmxlcyxcbiAgICAvLyBiZWdpbm5pbmcgd2l0aCB0aGUgZWRnZSB0YWJsZSAoYnV0IG5vdCBpbmNsdWRpbmcgaXQpLCB0aGF0IGxlYWQgdG8gdGhlXG4gICAgLy8gc291cmNlIC8gdGFyZ2V0IG5vZGUgdGFibGVzIChidXQgbm90IGluY2x1ZGluZykgdGhvc2VcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnNvdXJjZVRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHxcbiAgICAgICgodGhpcy5zb3VyY2VDbGFzcyAmJiB0aGlzLnNvdXJjZUNsYXNzLmNsYXNzTmFtZSkgfHwgJz8nKSArXG4gICAgICAnLScgK1xuICAgICAgKCh0aGlzLnRhcmdldENsYXNzICYmIHRoaXMudGFyZ2V0Q2xhc3MuY2xhc3NOYW1lKSB8fCAnPycpO1xuICB9XG4gIGdldCBzb3VyY2VDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgZ2V0IHRhcmdldENsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMudGFyZ2V0Q2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5wcm9tb3RlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MudGFibGUucHJvbW90ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUucHJvbW90ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLnByb21vdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0U291cmNlICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHJldHVybiBzdXBlci5wcm9tb3RlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgICB0eXBlOiAnTm9kZUNsYXNzJ1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgIG5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgICBzaWRlOiAhdGhpcy5zb3VyY2VDbGFzc0lkID8gJ3NvdXJjZScgOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogYXR0cmlidXRlXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gICAgfVxuICB9XG4gIGNvbm5lY3RGYWNldGVkQ2xhc3MgKG5ld0VkZ2VDbGFzcykge1xuICAgIC8vIFdoZW4gYW4gZWRnZSBjbGFzcyBpcyBmYWNldGVkLCB3ZSB3YW50IHRvIGtlZXAgdGhlIHNhbWUgY29ubmVjdGlvbnMuIFRoaXNcbiAgICAvLyBtZWFucyB3ZSBuZWVkIHRvIGNsb25lIGVhY2ggdGFibGUgY2hhaW4sIGFuZCBhZGQgb3VyIG93biB0YWJsZSB0byBpdFxuICAgIC8vIChiZWNhdXNlIG91ciB0YWJsZSBpcyB0aGUgcGFyZW50VGFibGUgb2YgdGhlIG5ldyBvbmUpXG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBuZXdFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMgPSBBcnJheS5mcm9tKHRoaXMuc291cmNlVGFibGVJZHMpO1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGhpcy50YWJsZUlkKTtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgbmV3RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzID0gQXJyYXkuZnJvbSh0aGlzLnRhcmdldFRhYmxlSWRzKTtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgICB0aGlzLnRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIGNvbnN0IG5ld0NsYXNzZXMgPSBzdXBlci5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcyk7XG4gICAgZm9yIChjb25zdCBuZXdDbGFzcyBvZiBuZXdDbGFzc2VzKSB7XG4gICAgICB0aGlzLmNvbm5lY3RGYWNldGVkQ2xhc3MobmV3Q2xhc3MpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3Q2xhc3NlcztcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdDbGFzcyBvZiBzdXBlci5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgdGhpcy5jb25uZWN0RmFjZXRlZENsYXNzKG5ld0NsYXNzKTtcbiAgICAgIHlpZWxkIG5ld0NsYXNzO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImNsYXNzIEZpbGVGb3JtYXQge1xuICBhc3luYyBidWlsZFJvdyAoaXRlbSkge1xuICAgIGNvbnN0IHJvdyA9IHt9O1xuICAgIGZvciAobGV0IGF0dHIgaW4gaXRlbS5yb3cpIHtcbiAgICAgIHJvd1thdHRyXSA9IGF3YWl0IGl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICByZXR1cm4gcm93O1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGaWxlRm9ybWF0O1xuIiwiY2xhc3MgUGFyc2VGYWlsdXJlIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvciAoZmlsZUZvcm1hdCkge1xuICAgIHN1cGVyKGBGYWlsZWQgdG8gcGFyc2UgZm9ybWF0OiAke2ZpbGVGb3JtYXQuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUGFyc2VGYWlsdXJlO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcbmltcG9ydCBQYXJzZUZhaWx1cmUgZnJvbSAnLi9QYXJzZUZhaWx1cmUuanMnO1xuXG5jb25zdCBOT0RFX05BTUVTID0gWydub2RlcycsICdOb2RlcyddO1xuY29uc3QgRURHRV9OQU1FUyA9IFsnZWRnZXMnLCAnbGlua3MnLCAnRWRnZXMnLCAnTGlua3MnXTtcblxuY2xhc3MgRDNKc29uIGV4dGVuZHMgRmlsZUZvcm1hdCB7XG4gIGFzeW5jIGltcG9ydERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICB0ZXh0LFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNvdXJjZUF0dHJpYnV0ZSA9ICdzb3VyY2UnLFxuICAgIHRhcmdldEF0dHJpYnV0ZSA9ICd0YXJnZXQnLFxuICAgIGNsYXNzQXR0cmlidXRlID0gbnVsbFxuICB9KSB7XG4gICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgY29uc3Qgbm9kZU5hbWUgPSBOT0RFX05BTUVTLmZpbmQobmFtZSA9PiBkYXRhW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpO1xuICAgIGNvbnN0IGVkZ2VOYW1lID0gRURHRV9OQU1FUy5maW5kKG5hbWUgPT4gZGF0YVtuYW1lXSBpbnN0YW5jZW9mIEFycmF5KTtcbiAgICBpZiAoIW5vZGVOYW1lIHx8ICFlZGdlTmFtZSkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlRmFpbHVyZSh0aGlzKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb3JlVGFibGUgPSBtb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnU3RhdGljRGljdFRhYmxlJyxcbiAgICAgIG5hbWU6ICdjb3JlVGFibGUnLFxuICAgICAgZGF0YTogZGF0YVxuICAgIH0pO1xuICAgIGNvbnN0IGNvcmVDbGFzcyA9IG1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29yZVRhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgICBsZXQgW25vZGVzLCBlZGdlc10gPSBjb3JlQ2xhc3MuY2xvc2VkVHJhbnNwb3NlKFtub2RlTmFtZSwgZWRnZU5hbWVdKTtcblxuICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgaWYgKG5vZGVBdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBpbXBvcnQgY2xhc3NlcyBmcm9tIEQzLXN0eWxlIEpTT04gd2l0aG91dCBub2RlQXR0cmlidXRlYCk7XG4gICAgICB9XG4gICAgICBjb25zdCBub2RlQ2xhc3NlcyA9IFtdO1xuICAgICAgY29uc3Qgbm9kZUNsYXNzTG9va3VwID0ge307XG4gICAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlQ2xhc3Mgb2Ygbm9kZXMub3BlbkZhY2V0KGNsYXNzQXR0cmlidXRlKSkge1xuICAgICAgICBub2RlQ2xhc3NMb29rdXBbbm9kZUNsYXNzLmNsYXNzTmFtZV0gPSBub2RlQ2xhc3Nlcy5sZW5ndGg7XG4gICAgICAgIG5vZGVDbGFzc2VzLnB1c2gobm9kZUNsYXNzLmludGVycHJldEFzTm9kZXMoKSk7XG4gICAgICB9XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlcy5vcGVuRmFjZXQoY2xhc3NBdHRyaWJ1dGUpKSB7XG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goZWRnZUNsYXNzLmludGVycHJldEFzRWRnZXMoKSk7XG4gICAgICAgIGNvbnN0IHNhbXBsZSA9IGF3YWl0IGVkZ2VDbGFzcy50YWJsZS5nZXRJdGVtKCk7XG4gICAgICAgIGNvbnN0IHNvdXJjZUNsYXNzTmFtZSA9IHNhbXBsZS5yb3dbc291cmNlQXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdO1xuICAgICAgICBpZiAobm9kZUNsYXNzTG9va3VwW3NvdXJjZUNsYXNzTmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgICAgICAgbm9kZUNsYXNzOiBub2RlQ2xhc3Nlc1tub2RlQ2xhc3NMb29rdXBbc291cmNlQ2xhc3NOYW1lXV0sXG4gICAgICAgICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgICAgICBlZGdlQXR0cmlidXRlOiBzb3VyY2VBdHRyaWJ1dGVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0YXJnZXRDbGFzc05hbWUgPSBzYW1wbGUucm93W3RhcmdldEF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXTtcbiAgICAgICAgaWYgKG5vZGVDbGFzc0xvb2t1cFt0YXJnZXRDbGFzc05hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgICAgICAgIG5vZGVDbGFzczogbm9kZUNsYXNzZXNbbm9kZUNsYXNzTG9va3VwW3RhcmdldENsYXNzTmFtZV1dLFxuICAgICAgICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICAgICAgZWRnZUF0dHJpYnV0ZTogdGFyZ2V0QXR0cmlidXRlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbm9kZXMgPSBub2Rlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgICBub2Rlcy5zZXRDbGFzc05hbWUobm9kZU5hbWUpO1xuICAgICAgZWRnZXMgPSBlZGdlcy5pbnRlcnByZXRBc0VkZ2VzKCk7XG4gICAgICBlZGdlcy5zZXRDbGFzc05hbWUoZWRnZU5hbWUpO1xuICAgICAgbm9kZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgICAgZWRnZUNsYXNzOiBlZGdlcyxcbiAgICAgICAgc2lkZTogJ3NvdXJjZScsXG4gICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHNvdXJjZUF0dHJpYnV0ZVxuICAgICAgfSk7XG4gICAgICBub2Rlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgICBlZGdlQ2xhc3M6IGVkZ2VzLFxuICAgICAgICBzaWRlOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZSxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogdGFyZ2V0QXR0cmlidXRlXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBwcmV0dHkgPSB0cnVlLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNvdXJjZUF0dHJpYnV0ZSA9ICdzb3VyY2UnLFxuICAgIHRhcmdldEF0dHJpYnV0ZSA9ICd0YXJnZXQnLFxuICAgIGNsYXNzQXR0cmlidXRlID0gbnVsbFxuICB9KSB7XG4gICAgaWYgKGNsYXNzQXR0cmlidXRlICYmICFub2RlQXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGV4cG9ydCBEMy1zdHlsZSBKU09OIHdpdGggY2xhc3Nlcywgd2l0aG91dCBhIG5vZGVBdHRyaWJ1dGVgKTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbGlua3M6IFtdXG4gICAgfTtcbiAgICBjb25zdCBub2RlTG9va3VwID0ge307XG4gICAgY29uc3Qgbm9kZUNsYXNzZXMgPSBbXTtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgaW5jbHVkZUNsYXNzZXMpIHtcbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgbm9kZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC5vdGhlciA9IHJlc3VsdC5vdGhlciB8fCBbXTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIHJlc3VsdC5vdGhlci5wdXNoKGF3YWl0IHRoaXMuYnVpbGRSb3coaXRlbSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3Qgbm9kZUNsYXNzIG9mIG5vZGVDbGFzc2VzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2Ygbm9kZUNsYXNzLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICBub2RlTG9va3VwW25vZGUuZXhwb3J0SWRdID0gcmVzdWx0Lm5vZGVzLmxlbmd0aDtcbiAgICAgICAgY29uc3Qgcm93ID0gYXdhaXQgdGhpcy5idWlsZFJvdyhub2RlKTtcbiAgICAgICAgaWYgKG5vZGVBdHRyaWJ1dGUpIHtcbiAgICAgICAgICByb3dbbm9kZUF0dHJpYnV0ZV0gPSBub2RlLmV4cG9ydElkO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5ub2Rlcy5wdXNoKHJvdyk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIGVkZ2VDbGFzc2VzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgZWRnZUNsYXNzLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICBjb25zdCByb3cgPSBhd2FpdCB0aGlzLmJ1aWxkUm93KGVkZ2UpO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiBlZGdlLnNvdXJjZU5vZGVzKHsgY2xhc3Nlczogbm9kZUNsYXNzZXMgfSkpIHtcbiAgICAgICAgICByb3dbc291cmNlQXR0cmlidXRlXSA9IG5vZGVBdHRyaWJ1dGUgPyBzb3VyY2UuZXhwb3J0SWQgOiBub2RlTG9va3VwW3NvdXJjZS5leHBvcnRJZF07XG4gICAgICAgICAgaWYgKGNsYXNzQXR0cmlidXRlKSB7XG4gICAgICAgICAgICByb3dbc291cmNlQXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdID0gc291cmNlLmNsYXNzT2JqLmNsYXNzTmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgZWRnZS50YXJnZXROb2Rlcyh7IGNsYXNzZXM6IG5vZGVDbGFzc2VzIH0pKSB7XG4gICAgICAgICAgICByb3dbdGFyZ2V0QXR0cmlidXRlXSA9IG5vZGVBdHRyaWJ1dGUgPyB0YXJnZXQuZXhwb3J0SWQgOiBub2RlTG9va3VwW3RhcmdldC5leHBvcnRJZF07XG4gICAgICAgICAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgcm93W3RhcmdldEF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXSA9IHRhcmdldC5jbGFzc09iai5jbGFzc05hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQubGlua3MucHVzaChPYmplY3QuYXNzaWduKHt9LCByb3cpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHByZXR0eSkge1xuICAgICAgcmVzdWx0Lm5vZGVzID0gJyAgXCJub2Rlc1wiOiBbXFxuICAgICcgKyByZXN1bHQubm9kZXMubWFwKHJvdyA9PiBKU09OLnN0cmluZ2lmeShyb3cpKVxuICAgICAgICAuam9pbignICAgICxcXG4nKSArICdcXG4gIF0nO1xuICAgICAgcmVzdWx0LmxpbmtzID0gJyAgXCJsaW5rc1wiOiBbXFxuICAgICcgKyByZXN1bHQubGlua3MubWFwKHJvdyA9PiBKU09OLnN0cmluZ2lmeShyb3cpKVxuICAgICAgICAuam9pbignICAgICxcXG4nKSArICdcXG4gIF0nO1xuICAgICAgaWYgKHJlc3VsdC5vdGhlcikge1xuICAgICAgICByZXN1bHQub3RoZXIgPSAnLFxcbiAgXCJvdGhlclwiOiBbXFxuICAgICcgKyByZXN1bHQub3RoZXIubWFwKHJvdyA9PiBKU09OLnN0cmluZ2lmeShyb3cpKVxuICAgICAgICAgIC5qb2luKCcgICAgLFxcbicpICsgJ1xcbiAgXSc7XG4gICAgICB9XG4gICAgICByZXR1cm4gYHtcXG4ke3Jlc3VsdC5ub2Rlc30sXFxuJHtyZXN1bHQubGlua3N9JHtyZXN1bHQub3RoZXIgfHwgJyd9XFxufVxcbmA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXN1bHQpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgbmV3IEQzSnNvbigpO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIEZJTEVfRk9STUFUUyBmcm9tICcuLi9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0cy5qcyc7XG5cbmNvbnN0IERBVEFMSUJfRk9STUFUUyA9IHtcbiAgJ2pzb24nOiAnanNvbicsXG4gICdjc3YnOiAnY3N2JyxcbiAgJ3Rzdic6ICd0c3YnXG59O1xuXG5jbGFzcyBOZXR3b3JrTW9kZWwgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgb3JpZ3JhcGgsXG4gICAgbW9kZWxJZCxcbiAgICBuYW1lID0gbW9kZWxJZCxcbiAgICBhbm5vdGF0aW9ucyA9IHt9LFxuICAgIGNsYXNzZXMgPSB7fSxcbiAgICB0YWJsZXMgPSB7fVxuICB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9yaWdyYXBoO1xuICAgIHRoaXMubW9kZWxJZCA9IG1vZGVsSWQ7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmFubm90YXRpb25zID0gYW5ub3RhdGlvbnM7XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG4gICAgdGhpcy50YWJsZXMgPSB7fTtcblxuICAgIHRoaXMuX25leHRDbGFzc0lkID0gMTtcbiAgICB0aGlzLl9uZXh0VGFibGVJZCA9IDE7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXMoY2xhc3NlcykpIHtcbiAgICAgIHRoaXMuY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IHRoaXMuaHlkcmF0ZShjbGFzc09iaiwgQ0xBU1NFUyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgT2JqZWN0LnZhbHVlcyh0YWJsZXMpKSB7XG4gICAgICB0aGlzLnRhYmxlc1t0YWJsZS50YWJsZUlkXSA9IHRoaXMuaHlkcmF0ZSh0YWJsZSwgVEFCTEVTKTtcbiAgICB9XG5cbiAgICB0aGlzLm9uKCd1cGRhdGUnLCAoKSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc2F2ZVRpbWVvdXQpO1xuICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5fb3JpZ3JhcGguc2F2ZSgpO1xuICAgICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHVuZGVmaW5lZDtcbiAgICAgIH0sIDApO1xuICAgIH0pO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgY2xhc3NlcyA9IHt9O1xuICAgIGNvbnN0IHRhYmxlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpKSB7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0gPSB0YWJsZU9iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXS50eXBlID0gdGFibGVPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIG1vZGVsSWQ6IHRoaXMubW9kZWxJZCxcbiAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zLFxuICAgICAgY2xhc3NlcyxcbiAgICAgIHRhYmxlc1xuICAgIH07XG4gIH1cbiAgZ2V0IHVuc2F2ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9zYXZlVGltZW91dCAhPT0gdW5kZWZpbmVkO1xuICB9XG4gIGh5ZHJhdGUgKHJhd09iamVjdCwgVFlQRVMpIHtcbiAgICByYXdPYmplY3QubW9kZWwgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgVFlQRVNbcmF3T2JqZWN0LnR5cGVdKHJhd09iamVjdCk7XG4gIH1cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMudGFibGVJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0pKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke3RoaXMuX25leHRUYWJsZUlkfWA7XG4gICAgICB0aGlzLl9uZXh0VGFibGVJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFRBQkxFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMuY2xhc3NJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdKSkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHt0aGlzLl9uZXh0Q2xhc3NJZH1gO1xuICAgICAgdGhpcy5fbmV4dENsYXNzSWQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ0xBU1NFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG4gIGZpbmRDbGFzcyAoY2xhc3NOYW1lKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IGNsYXNzT2JqLmNsYXNzTmFtZSA9PT0gY2xhc3NOYW1lKTtcbiAgfVxuICByZW5hbWUgKG5ld05hbWUpIHtcbiAgICB0aGlzLm5hbWUgPSBuZXdOYW1lO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYW5ub3RhdGUgKGtleSwgdmFsdWUpIHtcbiAgICB0aGlzLmFubm90YXRpb25zW2tleV0gPSB2YWx1ZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZUFubm90YXRpb24gKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLmFubm90YXRpb25zW2tleV07XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuX29yaWdyYXBoLmRlbGV0ZU1vZGVsKHRoaXMubW9kZWxJZCk7XG4gIH1cbiAgZ2V0IGRlbGV0ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5tb2RlbHNbdGhpcy5tb2RlbElkXTtcbiAgfVxuICBhc3luYyBhZGRUZXh0RmlsZSAob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy5mb3JtYXQpIHtcbiAgICAgIG9wdGlvbnMuZm9ybWF0ID0gbWltZS5leHRlbnNpb24obWltZS5sb29rdXAob3B0aW9ucy5uYW1lKSk7XG4gICAgfVxuICAgIGlmIChGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICAgIHJldHVybiBGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdLmltcG9ydERhdGEob3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChEQVRBTElCX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICBvcHRpb25zLmRhdGEgPSBkYXRhbGliLnJlYWQob3B0aW9ucy50ZXh0LCB7IHR5cGU6IG9wdGlvbnMuZm9ybWF0IH0pO1xuICAgICAgaWYgKG9wdGlvbnMuZm9ybWF0ID09PSAnY3N2JyB8fCBvcHRpb25zLmZvcm1hdCA9PT0gJ3RzdicpIHtcbiAgICAgICAgb3B0aW9ucy5hdHRyaWJ1dGVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBvcHRpb25zLmRhdGEuY29sdW1ucykge1xuICAgICAgICAgIG9wdGlvbnMuYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIG9wdGlvbnMuZGF0YS5jb2x1bW5zO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUob3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBmb3JtYXQ6ICR7b3B0aW9ucy5mb3JtYXR9YCk7XG4gICAgfVxuICB9XG4gIGFzeW5jIGZvcm1hdERhdGEgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICBpZiAoRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgcmV0dXJuIEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0uZm9ybWF0RGF0YShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKERBVEFMSUJfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUmF3ICR7b3B0aW9ucy5mb3JtYXR9IGV4cG9ydCBub3QgeWV0IHN1cHBvcnRlZGApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGV4cG9ydCB1bmtub3duIGZvcm1hdDogJHtvcHRpb25zLmZvcm1hdH1gKTtcbiAgICB9XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKCFlcnIuaW5Vc2UpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyBnZXRJbnN0YW5jZUdyYXBoIChpbnN0YW5jZUlkTGlzdCkge1xuICAgIGlmICghaW5zdGFuY2VJZExpc3QpIHtcbiAgICAgIC8vIFdpdGhvdXQgc3BlY2lmaWVkIGluc3RhbmNlcywganVzdCBwaWNrIHRoZSBmaXJzdCA1IGZyb20gZWFjaCBub2RlXG4gICAgICAvLyBhbmQgZWRnZSBjbGFzc1xuICAgICAgaW5zdGFuY2VJZExpc3QgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgfHwgY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoNSkpIHtcbiAgICAgICAgICAgIGluc3RhbmNlSWRMaXN0LnB1c2goaXRlbS5pbnN0YW5jZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBHZXQgdGhlIHNwZWNpZmllZCBpdGVtc1xuICAgIGNvbnN0IG5vZGVJbnN0YW5jZXMgPSB7fTtcbiAgICBjb25zdCBlZGdlSW5zdGFuY2VzID0ge307XG4gICAgZm9yIChjb25zdCBpbnN0YW5jZUlkIG9mIGluc3RhbmNlSWRMaXN0KSB7XG4gICAgICBjb25zdCB7IGNsYXNzSWQsIGluZGV4IH0gPSBKU09OLnBhcnNlKGluc3RhbmNlSWQpO1xuICAgICAgY29uc3QgaW5zdGFuY2UgPSBhd2FpdCB0aGlzLmNsYXNzZXNbY2xhc3NJZF0udGFibGUuZ2V0SXRlbShpbmRleCk7XG4gICAgICBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIG5vZGVJbnN0YW5jZXNbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIH0gZWxzZSBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIGVkZ2VJbnN0YW5jZXNbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQWRkIGFueSBub2RlcyBjb25uZWN0ZWQgdG8gb3VyIGVkZ2VzXG4gICAgY29uc3QgZXh0cmFOb2RlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgZWRnZUlkIGluIGVkZ2VJbnN0YW5jZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlSW5zdGFuY2VzW2VkZ2VJZF0ubm9kZXMoKSkge1xuICAgICAgICBpZiAoIW5vZGVJbnN0YW5jZXNbbm9kZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgIGV4dHJhTm9kZXNbbm9kZS5pbnN0YW5jZUlkXSA9IG5vZGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQWRkIGFueSBlZGdlcyB0aGF0IGNvbm5lY3Qgb3VyIG5vZGVzXG4gICAgY29uc3QgZXh0cmFFZGdlcyA9IHt9O1xuICAgIGZvciAoY29uc3Qgbm9kZUlkIGluIG5vZGVJbnN0YW5jZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiBub2RlSW5zdGFuY2VzW25vZGVJZF0uZWRnZXMoKSkge1xuICAgICAgICBpZiAoIWVkZ2VJbnN0YW5jZXNbZWRnZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgIC8vIENoZWNrIHRoYXQgYm90aCBlbmRzIG9mIHRoZSBlZGdlIGNvbm5lY3QgYXQgbGVhc3Qgb25lXG4gICAgICAgICAgLy8gb2Ygb3VyIG5vZGVzXG4gICAgICAgICAgbGV0IGNvbm5lY3RzU291cmNlID0gZmFsc2U7XG4gICAgICAgICAgbGV0IGNvbm5lY3RzVGFyZ2V0ID0gZmFsc2U7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICAgICAgaWYgKG5vZGVJbnN0YW5jZXNbbm9kZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgICAgICBjb25uZWN0c1NvdXJjZSA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgICAgICBpZiAobm9kZUluc3RhbmNlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzVGFyZ2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjb25uZWN0c1NvdXJjZSAmJiBjb25uZWN0c1RhcmdldCkge1xuICAgICAgICAgICAgZXh0cmFFZGdlc1tlZGdlLmluc3RhbmNlSWRdID0gZWRnZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPa2F5LCBub3cgd2UgaGF2ZSBhIGNvbXBsZXRlIHNldCBvZiBub2RlcyBhbmQgZWRnZXMgdGhhdCB3ZSB3YW50IHRvXG4gICAgLy8gaW5jbHVkZTsgY3JlYXRlIHBhaXJ3aXNlIGVkZ2UgZW50cmllcyBmb3IgZXZlcnkgY29ubmVjdGlvblxuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW11cbiAgICB9O1xuXG4gICAgLy8gQWRkIGFsbCB0aGUgbm9kZXMsIGFuZCBwb3B1bGF0ZSBhIGxvb2t1cCBmb3Igd2hlcmUgdGhleSBhcmUgaW4gdGhlIGxpc3RcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2YgT2JqZWN0LnZhbHVlcyhub2RlSW5zdGFuY2VzKS5jb25jYXQoT2JqZWN0LnZhbHVlcyhleHRyYU5vZGVzKSkpIHtcbiAgICAgIGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9IGdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICBub2RlSW5zdGFuY2U6IG5vZGUsXG4gICAgICAgIGR1bW15OiBmYWxzZVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGFsbCB0aGUgZWRnZXMuLi5cbiAgICBmb3IgKGNvbnN0IGVkZ2Ugb2YgT2JqZWN0LnZhbHVlcyhlZGdlSW5zdGFuY2VzKS5jb25jYXQoT2JqZWN0LnZhbHVlcyhleHRyYUVkZ2VzKSkpIHtcbiAgICAgIGlmICghZWRnZS5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmICghZWRnZS5jbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgLy8gTWlzc2luZyBib3RoIHNvdXJjZSBhbmQgdGFyZ2V0IGNsYXNzZXM7IGFkZCBkdW1teSBub2RlcyBmb3IgYm90aCBlbmRzXG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoICsgMVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQWRkIGR1bW15IHNvdXJjZSBub2Rlc1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIWVkZ2UuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAvLyBBZGQgZHVtbXkgdGFyZ2V0IG5vZGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdLFxuICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGVyZSBzaG91bGQgYmUgYm90aCBzb3VyY2UgYW5kIHRhcmdldCBub2RlcyBmb3IgZWFjaCBlZGdlXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlTm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2VOb2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0Tm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Tm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVMb29rdXBbc291cmNlTm9kZS5pbnN0YW5jZUlkXSxcbiAgICAgICAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXROb2RlLmluc3RhbmNlSWRdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE5ldHdvcmtNb2RlbEdyYXBoICh7XG4gICAgcmF3ID0gdHJ1ZSxcbiAgICBpbmNsdWRlRHVtbWllcyA9IGZhbHNlLFxuICAgIGNsYXNzTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGxldCBncmFwaCA9IHtcbiAgICAgIGNsYXNzZXM6IFtdLFxuICAgICAgY2xhc3NMb29rdXA6IHt9LFxuICAgICAgY2xhc3NDb25uZWN0aW9uczogW11cbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIC8vIEFkZCBhbmQgaW5kZXggdGhlIGNsYXNzIGFzIGEgbm9kZVxuICAgICAgY29uc3QgY2xhc3NTcGVjID0gcmF3ID8gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCkgOiB7IGNsYXNzT2JqIH07XG4gICAgICBjbGFzc1NwZWMudHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC5jbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGdyYXBoLmNsYXNzZXMubGVuZ3RoO1xuICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKGNsYXNzU3BlYyk7XG5cbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgLy8gU3RvcmUgdGhlIGVkZ2UgY2xhc3Mgc28gd2UgY2FuIGNyZWF0ZSBjbGFzc0Nvbm5lY3Rpb25zIGxhdGVyXG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgJiYgaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgbm9kZVxuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtjbGFzc09iai5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCAtIDEsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZmFsc2UsXG4gICAgICAgICAgbG9jYXRpb246ICdub2RlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGV4aXN0aW5nIGNsYXNzQ29ubmVjdGlvbnNcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlQ2xhc3Nlcykge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIHNvdXJjZSBub2RlIGNsYXNzIHRvIHRoZSBlZGdlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkfT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZSdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHNvdXJjZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgZHVtbXk+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIGVkZ2UgY2xhc3MgdG8gdGhlIHRhcmdldCBub2RlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT4ke2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHRhcmdldCBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCcsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICB0YWJsZXM6IFtdLFxuICAgICAgdGFibGVMb29rdXA6IHt9LFxuICAgICAgdGFibGVMaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IHRhYmxlTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpO1xuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBjb25zdCB0YWJsZVNwZWMgPSB0YWJsZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlU3BlYy50eXBlID0gdGFibGUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gZ3JhcGgudGFibGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLnRhYmxlcy5wdXNoKHRhYmxlU3BlYyk7XG4gICAgfVxuICAgIC8vIEZpbGwgdGhlIGdyYXBoIHdpdGggbGlua3MgYmFzZWQgb24gcGFyZW50VGFibGVzLi4uXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgIGdyYXBoLnRhYmxlTGlua3MucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBncmFwaC50YWJsZUxvb2t1cFtwYXJlbnRUYWJsZS50YWJsZUlkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TW9kZWxEdW1wICgpIHtcbiAgICAvLyBCZWNhdXNlIG9iamVjdCBrZXkgb3JkZXJzIGFyZW4ndCBkZXRlcm1pbmlzdGljLCBpdCBjYW4gYmUgcHJvYmxlbWF0aWNcbiAgICAvLyBmb3IgdGVzdGluZyAoYmVjYXVzZSBpZHMgY2FuIHJhbmRvbWx5IGNoYW5nZSBmcm9tIHRlc3QgcnVuIHRvIHRlc3QgcnVuKS5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIHNvcnRzIGVhY2gga2V5LCBhbmQganVzdCByZXBsYWNlcyBJRHMgd2l0aCBpbmRleCBudW1iZXJzXG4gICAgY29uc3QgcmF3T2JqID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0aGlzLl90b1Jhd09iamVjdCgpKSk7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NlczogT2JqZWN0LnZhbHVlcyhyYXdPYmouY2xhc3Nlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMuY2xhc3Nlc1thLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy5jbGFzc2VzW2IuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3MgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICB0YWJsZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLnRhYmxlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMudGFibGVzW2EudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLnRhYmxlc1tiLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhYmxlIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfTtcbiAgICBjb25zdCBjbGFzc0xvb2t1cCA9IHt9O1xuICAgIGNvbnN0IHRhYmxlTG9va3VwID0ge307XG4gICAgcmVzdWx0LmNsYXNzZXMuZm9yRWFjaCgoY2xhc3NPYmosIGluZGV4KSA9PiB7XG4gICAgICBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGluZGV4O1xuICAgIH0pO1xuICAgIHJlc3VsdC50YWJsZXMuZm9yRWFjaCgodGFibGUsIGluZGV4KSA9PiB7XG4gICAgICB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGluZGV4O1xuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiByZXN1bHQudGFibGVzKSB7XG4gICAgICB0YWJsZS50YWJsZUlkID0gdGFibGVMb29rdXBbdGFibGUudGFibGVJZF07XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgT2JqZWN0LmtleXModGFibGUuZGVyaXZlZFRhYmxlcykpIHtcbiAgICAgICAgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUxvb2t1cFt0YWJsZUlkXV0gPSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgICBkZWxldGUgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0YWJsZS5kYXRhOyAvLyBkb24ndCBpbmNsdWRlIGFueSBvZiB0aGUgZGF0YTsgd2UganVzdCB3YW50IHRoZSBtb2RlbCBzdHJ1Y3R1cmVcbiAgICB9XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiByZXN1bHQuY2xhc3Nlcykge1xuICAgICAgY2xhc3NPYmouY2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdO1xuICAgICAgY2xhc3NPYmoudGFibGVJZCA9IHRhYmxlTG9va3VwW2NsYXNzT2JqLnRhYmxlSWRdO1xuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzID0gY2xhc3NPYmouc291cmNlVGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnRhcmdldENsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzID0gY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBjbGFzc0lkIG9mIE9iamVjdC5rZXlzKGNsYXNzT2JqLmVkZ2VDbGFzc0lkcyB8fCB7fSkpIHtcbiAgICAgICAgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzTG9va3VwW2NsYXNzSWRdXSA9IGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgICAgZGVsZXRlIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBjcmVhdGVTY2hlbWFNb2RlbCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB0aGlzLmdldE1vZGVsRHVtcCgpO1xuXG4gICAgZ3JhcGgudGFibGVzLmZvckVhY2godGFibGUgPT4ge1xuICAgICAgdGFibGUuZGVyaXZlZFRhYmxlcyA9IE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbmV3TW9kZWwgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVNb2RlbCh7IG5hbWU6IHRoaXMubmFtZSArICdfc2NoZW1hJyB9KTtcbiAgICBjb25zdCByYXcgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaCxcbiAgICAgIG5hbWU6ICdSYXcgRHVtcCdcbiAgICB9KTtcbiAgICBsZXQgWyBjbGFzc2VzLCB0YWJsZXMgXSA9IHJhdy5jbG9zZWRUcmFuc3Bvc2UoWydjbGFzc2VzJywgJ3RhYmxlcyddKTtcbiAgICBjbGFzc2VzID0gY2xhc3Nlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgY2xhc3Nlcy5zZXRDbGFzc05hbWUoJ0NsYXNzZXMnKTtcbiAgICByYXcuZGVsZXRlKCk7XG5cbiAgICBjb25zdCBzb3VyY2VDbGFzc2VzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IGNsYXNzZXMsXG4gICAgICBhdHRyaWJ1dGU6ICdzb3VyY2VDbGFzc0lkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgc291cmNlQ2xhc3Nlcy5zZXRDbGFzc05hbWUoJ1NvdXJjZSBDbGFzcycpO1xuICAgIHNvdXJjZUNsYXNzZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAndGFyZ2V0Q2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhcmdldENsYXNzZXMuc2V0Q2xhc3NOYW1lKCdUYXJnZXQgQ2xhc3MnKTtcbiAgICB0YXJnZXRDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgdGFibGVzID0gdGFibGVzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICB0YWJsZXMuc2V0Q2xhc3NOYW1lKCdUYWJsZXMnKTtcblxuICAgIGNvbnN0IHRhYmxlRGVwZW5kZW5jaWVzID0gdGFibGVzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAnZGVyaXZlZFRhYmxlcycsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnNldENsYXNzTmFtZSgnSXMgUGFyZW50IE9mJyk7XG4gICAgdGFibGVEZXBlbmRlbmNpZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG5cbiAgICBjb25zdCBjb3JlVGFibGVzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhYmxlSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICBjb3JlVGFibGVzLnNldENsYXNzTmFtZSgnQ29yZSBUYWJsZScpO1xuICAgIHJldHVybiBuZXdNb2RlbDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTmV0d29ya01vZGVsO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgTmV0d29ya01vZGVsIGZyb20gJy4vQ29tbW9uL05ldHdvcmtNb2RlbC5qcyc7XG5cbmxldCBORVhUX01PREVMX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBvbmx5IGRlZmluZWQgaW4gdGhlIGJyb3dzZXIgY29udGV4dFxuXG4gICAgdGhpcy5wbHVnaW5zID0ge307XG5cbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIGxldCBleGlzdGluZ01vZGVscyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ29yaWdyYXBoX21vZGVscycpO1xuICAgIGlmIChleGlzdGluZ01vZGVscykge1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKEpTT04ucGFyc2UoZXhpc3RpbmdNb2RlbHMpKSkge1xuICAgICAgICBtb2RlbC5vcmlncmFwaCA9IHRoaXM7XG4gICAgICAgIHRoaXMubW9kZWxzW21vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChtb2RlbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICB9XG4gIHJlZ2lzdGVyUGx1Z2luIChuYW1lLCBwbHVnaW4pIHtcbiAgICB0aGlzLnBsdWdpbnNbbmFtZV0gPSBwbHVnaW47XG4gIH1cbiAgc2F2ZSAoKSB7XG4gICAgLypcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IG1vZGVscyA9IHt9O1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubW9kZWxzKSkge1xuICAgICAgICBtb2RlbHNbbW9kZWxJZF0gPSBtb2RlbC5fdG9SYXdPYmplY3QoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ29yaWdyYXBoX21vZGVscycsIEpTT04uc3RyaW5naWZ5KG1vZGVscykpO1xuICAgICAgdGhpcy50cmlnZ2VyKCdzYXZlJyk7XG4gICAgfVxuICAgICovXG4gIH1cbiAgY2xvc2VDdXJyZW50TW9kZWwgKCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGdldCBjdXJyZW50TW9kZWwgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1t0aGlzLl9jdXJyZW50TW9kZWxJZF0gfHwgbnVsbDtcbiAgfVxuICBzZXQgY3VycmVudE1vZGVsIChtb2RlbCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbW9kZWwgPyBtb2RlbC5tb2RlbElkIDogbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGFzeW5jIGxvYWRNb2RlbCAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld01vZGVsID0gdGhpcy5jcmVhdGVNb2RlbCh7IG1vZGVsSWQ6IG9wdGlvbnMubmFtZSB9KTtcbiAgICBhd2FpdCBuZXdNb2RlbC5hZGRUZXh0RmlsZShvcHRpb25zKTtcbiAgICByZXR1cm4gbmV3TW9kZWw7XG4gIH1cbiAgY3JlYXRlTW9kZWwgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5tb2RlbElkIHx8IHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWxJZCA9IGBtb2RlbCR7TkVYVF9NT0RFTF9JRH1gO1xuICAgICAgTkVYVF9NT0RFTF9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChvcHRpb25zKTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG9wdGlvbnMubW9kZWxJZDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdO1xuICB9XG4gIGRlbGV0ZU1vZGVsIChtb2RlbElkID0gdGhpcy5jdXJyZW50TW9kZWxJZCkge1xuICAgIGlmICghdGhpcy5tb2RlbHNbbW9kZWxJZF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIG5vbi1leGlzdGVudCBtb2RlbDogJHttb2RlbElkfWApO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbHNbbW9kZWxJZF07XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRNb2RlbElkID09PSBtb2RlbElkKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIH1cbiAgICB0aGlzLnNhdmUoKTtcbiAgfVxuICBkZWxldGVBbGxNb2RlbHMgKCkge1xuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3JpZ3JhcGg7XG4iLCJpbXBvcnQgT3JpZ3JhcGggZnJvbSAnLi9PcmlncmFwaC5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBvcmlncmFwaCA9IG5ldyBPcmlncmFwaCh3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm9yaWdyYXBoLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgb3JpZ3JhcGg7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsIl9ldmVudEhhbmRsZXJzIiwiX3N0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImV2ZW50IiwibmFtZXNwYWNlIiwic3BsaXQiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJpbmRleE9mIiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJoYW5kbGVDYWxsYmFjayIsInNldFRpbWVvdXQiLCJhcHBseSIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJHZW5lcmljV3JhcHBlciIsIm9wdGlvbnMiLCJ0YWJsZSIsInVuZGVmaW5lZCIsIkVycm9yIiwiY2xhc3NPYmoiLCJyb3ciLCJjb25uZWN0ZWRJdGVtcyIsImR1cGxpY2F0ZUl0ZW1zIiwicmVnaXN0ZXJEdXBsaWNhdGUiLCJpdGVtIiwiY29ubmVjdEl0ZW0iLCJ0YWJsZUlkIiwiZHVwIiwiZGlzY29ubmVjdCIsIml0ZW1MaXN0IiwidmFsdWVzIiwiaW5zdGFuY2VJZCIsImNsYXNzSWQiLCJleHBvcnRJZCIsImVxdWFscyIsImhhbmRsZUxpbWl0IiwiaXRlcmF0b3JzIiwibGltaXQiLCJJbmZpbml0eSIsIml0ZXJhdG9yIiwiaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwidGFibGVJZHMiLCJQcm9taXNlIiwiYWxsIiwibWFwIiwibW9kZWwiLCJ0YWJsZXMiLCJidWlsZENhY2hlIiwiX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInJlc2V0IiwibmV4dFRhYmxlSWQiLCJsZW5ndGgiLCJyZW1haW5pbmdUYWJsZUlkcyIsInNsaWNlIiwiZXhlYyIsIm5hbWUiLCJUYWJsZSIsIl9leHBlY3RlZEF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVzIiwiX29ic2VydmVkQXR0cmlidXRlcyIsIl9kZXJpdmVkVGFibGVzIiwiZGVyaXZlZFRhYmxlcyIsIl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiaHlkcmF0ZUZ1bmN0aW9uIiwiX3N1cHByZXNzZWRBdHRyaWJ1dGVzIiwic3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJfc3VwcHJlc3NJbmRleCIsInN1cHByZXNzSW5kZXgiLCJfaW5kZXhGaWx0ZXIiLCJpbmRleEZpbHRlciIsIl9hdHRyaWJ1dGVGaWx0ZXJzIiwiYXR0cmlidXRlRmlsdGVycyIsIl9saW1pdFByb21pc2VzIiwiX3RvUmF3T2JqZWN0IiwicmVzdWx0IiwiX2F0dHJpYnV0ZXMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsImZ1bmMiLCJnZXRTb3J0SGFzaCIsIkZ1bmN0aW9uIiwidG9TdHJpbmciLCJpdGVyYXRlIiwiX2NhY2hlIiwiX3BhcnRpYWxDYWNoZSIsInJlc29sdmUiLCJyZWplY3QiLCJfaXRlcmF0ZSIsIl9idWlsZENhY2hlIiwiX3BhcnRpYWxDYWNoZUxvb2t1cCIsImRvbmUiLCJuZXh0IiwiaGFuZGxlUmVzZXQiLCJfZmluaXNoSXRlbSIsIk51bWJlciIsIl9jYWNoZUxvb2t1cCIsIl9jYWNoZVByb21pc2UiLCJpdGVtc1RvUmVzZXQiLCJjb25jYXQiLCJkZXJpdmVkVGFibGUiLCJjb3VudFJvd3MiLCJ3cmFwcGVkSXRlbSIsImRlbGF5ZWRSb3ciLCJrZWVwIiwiX3dyYXAiLCJvdGhlckl0ZW0iLCJpdGVtc1RvQ29ubmVjdCIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImxvb2t1cCIsImNvbXBsZXRlIiwiZ2V0SXRlbSIsImRlcml2ZUF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsInN1cHByZXNzQXR0cmlidXRlIiwiYWRkRmlsdGVyIiwiX2Rlcml2ZVRhYmxlIiwibmV3VGFibGUiLCJjcmVhdGVUYWJsZSIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZSIsImZpbmQiLCJ0YWJsZU9iaiIsImV2ZXJ5Iiwib3B0aW9uTmFtZSIsIm9wdGlvblZhbHVlIiwicHJvbW90ZSIsImV4cGFuZCIsInVucm9sbCIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY2xvc2VkVHJhbnNwb3NlIiwiaW5kZXhlcyIsIm9wZW5UcmFuc3Bvc2UiLCJkdXBsaWNhdGUiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJvdGhlclRhYmxlIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJlcnIiLCJwYXJlbnRUYWJsZSIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIlN0YXRpY0RpY3RUYWJsZSIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIkF0dHJUYWJsZU1peGluIiwiX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpbiIsIl9hdHRyaWJ1dGUiLCJQcm9tb3RlZFRhYmxlIiwiX3VuZmluaXNoZWRDYWNoZSIsIl91bmZpbmlzaGVkQ2FjaGVMb29rdXAiLCJ3cmFwcGVkUGFyZW50IiwiU3RyaW5nIiwiZXhpc3RpbmdJdGVtIiwibmV3SXRlbSIsIkZhY2V0ZWRUYWJsZSIsIl92YWx1ZSIsIlRyYW5zcG9zZWRUYWJsZSIsIl9pbmRleCIsIkNvbm5lY3RlZFRhYmxlIiwiam9pbiIsInBUYWJsZSIsImJhc2VQYXJlbnRUYWJsZSIsIm90aGVyUGFyZW50VGFibGVzIiwiRHVwbGljYXRlZFRhYmxlIiwiQ2hpbGRUYWJsZU1peGluIiwiX2luc3RhbmNlT2ZDaGlsZFRhYmxlTWl4aW4iLCJwYXJlbnRJbmRleCIsIkV4cGFuZGVkVGFibGUiLCJVbnJvbGxlZFRhYmxlIiwicm93cyIsIlBhcmVudENoaWxkVGFibGUiLCJjaGlsZFRhYmxlIiwiY2hpbGQiLCJwYXJlbnQiLCJHZW5lcmljQ2xhc3MiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbnMiLCJzZXRDbGFzc05hbWUiLCJoYXNDdXN0b21OYW1lIiwidmFyaWFibGVOYW1lIiwiZmlsdGVyIiwiZCIsInRvTG9jYWxlVXBwZXJDYXNlIiwiZGVsZXRlZCIsImludGVycHJldEFzTm9kZXMiLCJvdmVyd3JpdGUiLCJjcmVhdGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJfZGVyaXZlTmV3Q2xhc3MiLCJOb2RlV3JhcHBlciIsImVkZ2VzIiwiZWRnZUlkcyIsImNsYXNzSWRzIiwiZWRnZUNsYXNzSWRzIiwiZWRnZUlkIiwiZWRnZUNsYXNzIiwicm9sZSIsImdldEVkZ2VSb2xlIiwicmV2ZXJzZSIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc2VzIiwiZWRnZUNsYXNzSWQiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsImF1dG9jb25uZWN0IiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiaXNTb3VyY2UiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIm5vZGVDbGFzcyIsInRhYmxlSWRMaXN0IiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5ld05vZGVDbGFzcyIsImNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIiwiY2hpbGRDbGFzcyIsInByb2plY3ROZXdFZGdlIiwiY2xhc3NJZExpc3QiLCJjbGFzc0xpc3QiLCJtaWRkbGVJbmRleCIsIk1hdGgiLCJmbG9vciIsInVuc2hpZnQiLCJBcnJheSIsImZyb20iLCJjb25uZWN0ZWRDbGFzc2VzIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VOb2RlcyIsInNvdXJjZVRhYmxlSWQiLCJ0YXJnZXROb2RlcyIsInRhcmdldFRhYmxlSWQiLCJub2RlcyIsIkVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJfc3BsaXRUYWJsZUlkTGlzdCIsIm90aGVyQ2xhc3MiLCJub2RlVGFibGVJZExpc3QiLCJlZGdlVGFibGVJZCIsImVkZ2VUYWJsZUlkTGlzdCIsInN0YXRpY0V4aXN0cyIsInRhYmxlRGlzdGFuY2VzIiwic3RhcnRzV2l0aCIsImRpc3QiLCJhYnMiLCJzb3J0IiwiYSIsImIiLCJzaWRlIiwiY29ubmVjdFNvdXJjZSIsImNvbm5lY3RUYXJnZXQiLCJ0b2dnbGVEaXJlY3Rpb24iLCJzd2FwcGVkRGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJjb25uZWN0RmFjZXRlZENsYXNzIiwibmV3Q2xhc3NlcyIsIm5ld0NsYXNzIiwiRmlsZUZvcm1hdCIsImJ1aWxkUm93IiwiUGFyc2VGYWlsdXJlIiwiZmlsZUZvcm1hdCIsIk5PREVfTkFNRVMiLCJFREdFX05BTUVTIiwiRDNKc29uIiwiaW1wb3J0RGF0YSIsInRleHQiLCJzb3VyY2VBdHRyaWJ1dGUiLCJ0YXJnZXRBdHRyaWJ1dGUiLCJjbGFzc0F0dHJpYnV0ZSIsIkpTT04iLCJwYXJzZSIsIm5vZGVOYW1lIiwiZWRnZU5hbWUiLCJjb3JlVGFibGUiLCJjb3JlQ2xhc3MiLCJub2RlQ2xhc3NlcyIsIm5vZGVDbGFzc0xvb2t1cCIsInNhbXBsZSIsInNvdXJjZUNsYXNzTmFtZSIsInRhcmdldENsYXNzTmFtZSIsImZvcm1hdERhdGEiLCJpbmNsdWRlQ2xhc3NlcyIsInByZXR0eSIsImxpbmtzIiwibm9kZUxvb2t1cCIsIm90aGVyIiwibm9kZSIsImVkZ2UiLCJzb3VyY2UiLCJ0YXJnZXQiLCJzdHJpbmdpZnkiLCJEQVRBTElCX0ZPUk1BVFMiLCJOZXR3b3JrTW9kZWwiLCJvcmlncmFwaCIsIm1vZGVsSWQiLCJfb3JpZ3JhcGgiLCJfbmV4dENsYXNzSWQiLCJfbmV4dFRhYmxlSWQiLCJoeWRyYXRlIiwiQ0xBU1NFUyIsIlRBQkxFUyIsIl9zYXZlVGltZW91dCIsInNhdmUiLCJ1bnNhdmVkIiwicmF3T2JqZWN0IiwiVFlQRVMiLCJzZWxlY3RvciIsImZpbmRDbGFzcyIsInJlbmFtZSIsIm5ld05hbWUiLCJhbm5vdGF0ZSIsImtleSIsImRlbGV0ZUFubm90YXRpb24iLCJkZWxldGVNb2RlbCIsIm1vZGVscyIsImFkZFRleHRGaWxlIiwiZm9ybWF0IiwibWltZSIsImV4dGVuc2lvbiIsIkZJTEVfRk9STUFUUyIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiZGVsZXRlQWxsVW51c2VkVGFibGVzIiwiZ2V0SW5zdGFuY2VHcmFwaCIsImluc3RhbmNlSWRMaXN0Iiwibm9kZUluc3RhbmNlcyIsImVkZ2VJbnN0YW5jZXMiLCJpbnN0YW5jZSIsImV4dHJhTm9kZXMiLCJleHRyYUVkZ2VzIiwibm9kZUlkIiwiY29ubmVjdHNTb3VyY2UiLCJjb25uZWN0c1RhcmdldCIsImdyYXBoIiwibm9kZUluc3RhbmNlIiwiZHVtbXkiLCJlZGdlSW5zdGFuY2UiLCJzb3VyY2VOb2RlIiwidGFyZ2V0Tm9kZSIsImdldE5ldHdvcmtNb2RlbEdyYXBoIiwicmF3IiwiaW5jbHVkZUR1bW1pZXMiLCJjbGFzc0xvb2t1cCIsImNsYXNzQ29ubmVjdGlvbnMiLCJjbGFzc1NwZWMiLCJpZCIsImxvY2F0aW9uIiwiZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgiLCJ0YWJsZUxvb2t1cCIsInRhYmxlTGlua3MiLCJ0YWJsZUxpc3QiLCJ0YWJsZVNwZWMiLCJnZXRNb2RlbER1bXAiLCJyYXdPYmoiLCJhSGFzaCIsImJIYXNoIiwiY3JlYXRlU2NoZW1hTW9kZWwiLCJuZXdNb2RlbCIsImNyZWF0ZU1vZGVsIiwic291cmNlQ2xhc3NlcyIsInRhcmdldENsYXNzZXMiLCJ0YWJsZURlcGVuZGVuY2llcyIsImNvcmVUYWJsZXMiLCJORVhUX01PREVMX0lEIiwiT3JpZ3JhcGgiLCJsb2NhbFN0b3JhZ2UiLCJwbHVnaW5zIiwiZXhpc3RpbmdNb2RlbHMiLCJfY3VycmVudE1vZGVsSWQiLCJyZWdpc3RlclBsdWdpbiIsInBsdWdpbiIsImNsb3NlQ3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsIiwibG9hZE1vZGVsIiwiY3VycmVudE1vZGVsSWQiLCJkZWxldGVBbGxNb2RlbHMiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwi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
