import mime from 'mime-types';
import datalib from 'datalib';
import JSZip from 'jszip';

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

  get label() {
    return this.classObj.annotations.labelAttr ? this.row[this.classObj.annotations.labelAttr] : this.index;
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

    for (const func of Object.values(this._attributeFilters)) {
      keep = keep && (await func(wrappedItem));

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

  get suppressedAttributes() {
    return Object.keys(this._suppressedAttributes);
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

  unSuppressAttribute(attribute) {
    if (attribute === null) {
      this._suppressIndex = false;
    } else {
      delete this._suppressedAttributes[attribute];
    }

    this.reset();
    this.model.trigger('update');
  }

  addFilter(func, attribute = null) {
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

  project(tableIds) {
    const newTable = this.model.createTable({
      type: 'ProjectedTable',
      tableOrder: [this.tableId].concat(tableIds)
    });
    this._derivedTables[newTable.tableId] = true;

    for (const otherTableId of tableIds) {
      const otherTable = this.model.tables[otherTableId];
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

  delete(force = false) {
    if (!force && this.inUse) {
      const err = new Error(`Can't delete in-use table ${this.tableId}`);
      err.inUse = true;
      throw err;
    }

    for (const parentTable of this.parentTables) {
      delete parentTable._derivedTables[this.tableId];
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
    return this.parentTables.map(parentTable => parentTable.name).join('=');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join('=');
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

class ProjectedTable extends Table {
  constructor(options) {
    super(options);
    this.tableOrder = options.tableOrder;

    if (!this.tableOrder) {
      throw new Error(`tableOrder is required`);
    }
  }

  get name() {
    return this.tableOrder.map(tableId => this.model.tables[tableId].name).join('⨯');
  }

  getSortHash() {
    return super.getSortHash() + this.tableOrder.map(tableId => this.model.tables[tableId].getSortHash()).join('⨯');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const self = _this;
      const firstTable = _this.model.tables[_this.tableOrder[0]];

      const remainingIds = _this.tableOrder.slice(1);

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(firstTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const sourceItem = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator(sourceItem.iterateAcrossConnections(remainingIds)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const lastItem = _value2;

              const newItem = _this._wrap({
                index: sourceItem.index + '⨯' + lastItem.index,
                itemsToConnect: [sourceItem, lastItem]
              });

              if (yield _awaitAsyncGenerator(self._finishItem(newItem))) {
                yield newItem;
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
  ParentChildTable: ParentChildTable,
  ProjectedTable: ProjectedTable
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

  setAnnotation(key, value) {
    this.annotations[key] = value;
    this.model.trigger('update');
  }

  deleteAnnotation(key) {
    delete this.annotations[key];
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
    this.model.optimizeTables();
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

  pairwiseNeighborhood(options) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this2.edges()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const edge = _value;
          yield* _asyncGeneratorDelegate(_asyncIterator(edge.pairwiseNeighborhood(options)), _awaitAsyncGenerator);
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
    const classList = [this].concat(classIdList.map(classId => {
      return this.model.classes[classId];
    }));

    if (classList.length < 3 || classList[classList.length - 1].type !== 'Node') {
      throw new Error(`Invalid classIdList`);
    }

    const sourceClassId = this.classId;
    const targetClassId = classList[classList.length - 1].classId;
    let tableOrder = [];

    for (let i = 1; i < classList.length; i++) {
      const classObj = classList[i];

      if (classObj.type === 'Node') {
        tableOrder.push(classObj.tableId);
      } else {
        const edgeRole = classList[i - 1].getEdgeRole(classObj);

        if (edgeRole === 'source' || edgeRole === 'both') {
          tableOrder = tableOrder.concat(Array.from(classObj.sourceTableIds).reverse());
          tableOrder.push(classObj.tableId);
          tableOrder = tableOrder.concat(classObj.targetTableIds);
        } else {
          tableOrder = tableOrder.concat(Array.from(classObj.targetTableIds).reverse());
          tableOrder.push(classObj.tableId);
          tableOrder = tableOrder.concat(classObj.sourceTableIds);
        }
      }
    }

    const newTable = this.table.project(tableOrder);
    const newClass = this.model.createClass({
      type: 'EdgeClass',
      tableId: newTable.tableId,
      sourceClassId,
      targetClassId,
      sourceTableIds: [],
      targetTableIds: []
    });
    this.edgeClassIds[newClass.classId] = true;
    classList[classList.length - 1].edgeClassIds[newClass.classId] = true;
    return newClass;
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

  pairwiseNeighborhood(options) {
    var _this4 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this4.sourceNodes(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const source = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator(_this4.targetNodes(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const target = _value2;
              yield {
                source,
                target,
                edge: _this4
              };
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

    let result = {
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

          if (classAttribute) {
            row[classAttribute] = node.classObj.className;
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
      result.nodes = '  "nodes": [\n    ' + result.nodes.map(row => JSON.stringify(row)).join(',\n    ') + '\n  ]';
      result.links = '  "links": [\n    ' + result.links.map(row => JSON.stringify(row)).join(',\n    ') + '\n  ]';

      if (result.other) {
        result.other = ',\n  "other": [\n    ' + result.other.map(row => JSON.stringify(row)).join(',\n    ') + '\n  ]';
      }

      result = `{\n${result.nodes},\n${result.links}${result.other || ''}\n}\n`;
    } else {
      result = JSON.stringify(result);
    }

    return {
      data: 'data:text/json;base64,' + Buffer.from(result).toString('base64'),
      type: 'text/json',
      extension: 'json'
    };
  }

}

var D3Json$1 = new D3Json();

class CsvZip extends FileFormat {
  async importData({
    model,
    text
  }) {
    throw new Error(`unimplemented`);
  }

  async formatData({
    model,
    includeClasses = Object.values(model.classes),
    indexName = 'index'
  }) {
    const zip = new JSZip();

    for (const classObj of includeClasses) {
      const attributes = classObj.table.attributes;
      let contents = `${indexName},${attributes.join(',')}\n`;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(classObj.table.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const item = _value;
          const row = attributes.map(attr => item.row[attr]);
          contents += `${item.index},${row.join(',')}\n`;
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

      zip.file(classObj.className + '.csv', contents);
    }

    return {
      data: 'data:application/zip;base64,' + (await zip.generateAsync({
        type: 'base64'
      })),
      type: 'application/zip',
      extension: 'zip'
    };
  }

}

var CsvZip$1 = new CsvZip();

const escapeChars = {
  '&quot;': /"/g,
  '&apos;': /'/g,
  '&lt;': /</g,
  '&gt;': />/g
};

class GEXF extends FileFormat {
  async importData({
    model,
    text
  }) {
    throw new Error(`unimplemented`);
  }

  escape(str) {
    str = str.replace(/&/g, '&amp;');

    for (const [repl, exp] of Object.entries(escapeChars)) {
      str = str.replace(exp, repl);
    }

    return str;
  }

  async formatData({
    model,
    includeClasses = Object.values(model.classes),
    classAttribute = 'class'
  }) {
    let nodeChunk = '';
    let edgeChunk = '';

    for (const classObj of includeClasses) {
      if (classObj.type === 'Node') {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(classObj.table.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const node = _value;
            nodeChunk += `
    <node id="${this.escape(node.exportId)}" label="${this.escape(node.label)}">
      <attvalues>
        <attvalue for="0" value="${this.escape(classObj.className)}"/>
      </attvalues>
    </node>`;
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
      } else if (classObj.type === 'Edge') {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;

        var _iteratorError2;

        try {
          for (var _iterator2 = _asyncIterator(classObj.table.iterate()), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
            const edge = _value2;
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;

            var _iteratorError3;

            try {
              for (var _iterator3 = _asyncIterator(edge.sourceNodes({
                classes: includeClasses
              })), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
                const source = _value3;
                var _iteratorNormalCompletion4 = true;
                var _didIteratorError4 = false;

                var _iteratorError4;

                try {
                  for (var _iterator4 = _asyncIterator(edge.targetNodes({
                    classes: includeClasses
                  })), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                    const target = _value4;
                    edgeChunk += `
    <edge id="${this.escape(edge.exportId)}" source="${this.escape(source.exportId)}" target="${this.escape(target.exportId)}">
      <attvalues>
        <attvalue for="0" value="${this.escape(classObj.className)}"/>
      </attvalues>
    </edge>`;
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
      }
    }

    const result = `\
<?xml version="1.0" encoding="UTF-8"?>
<gexf  xmlns="http://www.gexf.net/1.2draft" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.gexf.net/1.2draft http://www.gexf.net/1.2draft/gexf.xsd" version="1.2">
<meta lastmodifieddate="2009-03-20">
  <creator>origraph.github.io</creator>
  <description>${model.name}</description>
</meta>
<graph mode="static" defaultedgetype="directed">
  <attributes class="node">
    <attribute id="0" title="${classAttribute}" type="string"/>
  </attributes>
  <attributes class="edge">
    <attribute id="0" title="${classAttribute}" type="string"/>
  </attributes>
  <nodes>${nodeChunk}
  </nodes>
  <edges>${edgeChunk}
  </edges>
</graph>
</gexf>
  `;
    return {
      data: 'data:text/xml;base64,' + Buffer.from(result).toString('base64'),
      type: 'text/xml',
      extension: 'gexf'
    };
  }

}

var GEXF$1 = new GEXF();



var FILE_FORMATS = /*#__PURE__*/Object.freeze({
  D3Json: D3Json$1,
  CsvZip: CsvZip$1,
  GEXF: GEXF$1
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

    if (this.tables[options.tableId].classObj && !options.overwrite) {
      options.tableId = this.tables[options.tableId].duplicate().tableId;
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

  optimizeTables() {
    const tablesInUse = {};

    for (const classObj of Object.values(this.classes)) {
      tablesInUse[classObj.tableId] = true;

      for (const tableId of classObj.sourceTableIds || []) {
        tablesInUse[tableId] = true;
      }

      for (const tableId of classObj.targetTableIds || []) {
        tablesInUse[tableId] = true;
      }
    }

    const parentsVisited = {};
    const queue = Object.keys(tablesInUse);

    while (queue.length > 0) {
      const tableId = queue.shift();

      if (!parentsVisited[tableId]) {
        tablesInUse[tableId] = true;
        parentsVisited[tableId] = true;
        const table = this.tables[tableId];

        for (const parentTable of table.parentTables) {
          queue.push(parentTable.tableId);
        }
      }
    }

    for (const tableId of Object.keys(this.tables)) {
      const table = this.tables[tableId];

      if (!tablesInUse[tableId] && table.type !== 'Static' && table.type !== 'StaticDict') {
        table.delete(true);
      }
    } // TODO: If any DuplicatedTable is in use, but the original isn't, swap for the real one

  }

  async getArbitraryInstanceList(seedCount = 2, nodeCount = 5, edgeCount = 10) {
    // Try to get instancesPerClass instances from each class, starting with the
    // class that was passed in as an argument
    let iterationReset = false;
    const nodeInstances = {};
    const edgeInstances = {};
    const nodeCounts = {};
    const edgeCounts = {};
    const unSeenClassIds = {};

    for (const classId of Object.keys(this.classes)) {
      unSeenClassIds[classId] = true;
    }

    const populateClassCounts = async instance => {
      if (instance === null) {
        iterationReset = true;
        return false;
      }

      const classId = instance.classObj.classId;
      const instanceId = instance.instanceId;

      if (instance.type === 'Node') {
        nodeCounts[classId] = nodeCounts[classId] || 0;

        if (nodeCounts[classId] >= nodeCount || nodeInstances[instanceId]) {
          return false;
        }

        delete unSeenClassIds[classId];
        nodeCounts[classId]++;
        nodeInstances[instanceId] = instance;
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(instance.edges({
            limit: seedCount,
            classIds: Object.keys(unSeenClassIds)
          })), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const edge = _value;

            if (!(await populateClassCounts(edge))) {
              break;
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
      } else if (instance.type === 'Edge') {
        edgeCounts[classId] = edgeCounts[classId] || 0;

        if (edgeCounts[classId] >= edgeCount || edgeInstances[instanceId]) {
          return false;
        }

        delete unSeenClassIds[classId];
        edgeCounts[classId]++;
        edgeInstances[instanceId] = instance;
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;

        var _iteratorError2;

        try {
          for (var _iterator2 = _asyncIterator(instance.nodes({
            limit: seedCount,
            classIds: Object.keys(unSeenClassIds)
          })), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
            const node = _value2;

            if (!(await populateClassCounts(node))) {
              break;
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
        return false;
      }

      return true;
    };

    for (const classObj of Object.values(this.classes)) {
      await classObj.table.buildCache();

      for (let i = 0; i < seedCount; i++) {
        if (iterationReset) {
          return null;
        }

        const randIndex = Math.floor(Math.random() * classObj.table._cache.length);
        const instance = classObj.table._cache[randIndex];

        if (!(await populateClassCounts(instance))) {
          break;
        }
      }
    }

    return Object.keys(nodeInstances).concat(Object.keys(edgeInstances));
  }

  async getInstanceGraph(instanceIdList) {
    const nodeInstances = {};
    const edgeInstances = {};
    const extraNodes = {};
    const extraEdges = {};
    const graph = {
      nodes: [],
      nodeLookup: {},
      edges: []
    };

    if (!instanceIdList) {
      return graph;
    } else {
      // Get the specified items
      for (const instanceId of instanceIdList) {
        const {
          classId,
          index
        } = JSON.parse(instanceId);
        const instance = await this.classes[classId].table.getItem(index);

        if (instance) {
          if (instance.type === 'Node') {
            nodeInstances[instanceId] = instance;
          } else if (instance.type === 'Edge') {
            edgeInstances[instanceId] = instance;
          }
        }
      }
    } // At this point, we have all the nodes that we NEED, but for a cleaner
    // graph, we want to make sure to only show dangling edges that are actually
    // dangling in the network model (need to make sure each edge has at least
    // one source and one target node)


    const seedSide = async (edgeId, iterFunc) => {
      let aNode;
      let isSeeded = false;
      var _iteratorNormalCompletion10 = true;
      var _didIteratorError10 = false;

      var _iteratorError10;

      try {
        for (var _iterator10 = _asyncIterator(edgeInstances[edgeId][iterFunc]()), _step10, _value10; _step10 = await _iterator10.next(), _iteratorNormalCompletion10 = _step10.done, _value10 = await _step10.value, !_iteratorNormalCompletion10; _iteratorNormalCompletion10 = true) {
          const source = _value10;
          aNode = aNode || source;

          if (nodeInstances[source.instanceId]) {
            isSeeded = true;
            break;
          }
        }
      } catch (err) {
        _didIteratorError10 = true;
        _iteratorError10 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion10 && _iterator10.return != null) {
            await _iterator10.return();
          }
        } finally {
          if (_didIteratorError10) {
            throw _iteratorError10;
          }
        }
      }

      if (!isSeeded && aNode) {
        extraNodes[aNode.instanceId] = aNode;
      }
    };

    for (const edgeId in edgeInstances) {
      seedSide(edgeId, 'sourceNodes');
      seedSide(edgeId, 'targetNodes');
    } // We also want to add any edges that exist that connect any of the nodes
    // that we've included


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
    } // At this point we have a complete set of nodes and edges that we want to
    // include. Now we need to populate the graph:
    // Add all the nodes to the graph, and populate a lookup for where they are in the list


    for (const node of Object.values(nodeInstances).concat(Object.values(extraNodes))) {
      graph.nodeLookup[node.instanceId] = graph.nodes.length;
      graph.nodes.push({
        nodeInstance: node,
        dummy: false
      });
    } // Add all the edges, including dummy nodes for dangling edges


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
	jszip: "^3.1.5",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0F0dHJUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9tb3RlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0R1cGxpY2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ2hpbGRUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9QYXJlbnRDaGlsZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9qZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0LmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL1BhcnNlRmFpbHVyZS5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9EM0pzb24uanMiLCIuLi9zcmMvRmlsZUZvcm1hdHMvQ3N2WmlwLmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL0dFWEYuanMiLCIuLi9zcmMvQ29tbW9uL05ldHdvcmtNb2RlbC5qcyIsIi4uL3NyYy9PcmlncmFwaC5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSB8fFxuICAgICAgICB7ICcnOiBbXSB9O1xuICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnB1c2goY2FsbGJhY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSA9IGNhbGxiYWNrO1xuICAgICAgfVxuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXSA9IFtdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnQsIC4uLmFyZ3MpIHtcbiAgICAgIGNvbnN0IGhhbmRsZUNhbGxiYWNrID0gY2FsbGJhY2sgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH07XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgZm9yIChjb25zdCBuYW1lc3BhY2Ugb2YgT2JqZWN0LmtleXModGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pKSB7XG4gICAgICAgICAgaWYgKG5hbWVzcGFjZSA9PT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5mb3JFYWNoKGhhbmRsZUNhbGxiYWNrKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGFuZGxlQ2FsbGJhY2sodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zID0gb3B0aW9ucy5kdXBsaWNhdGVJdGVtcyB8fCBbXTtcbiAgfVxuICByZWdpc3RlckR1cGxpY2F0ZSAoaXRlbSkge1xuICAgIHRoaXMuZHVwbGljYXRlSXRlbXMucHVzaChpdGVtKTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBkdXAgb2YgdGhpcy5kdXBsaWNhdGVJdGVtcykge1xuICAgICAgaXRlbS5jb25uZWN0SXRlbShkdXApO1xuICAgICAgZHVwLmNvbm5lY3RJdGVtKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBge1wiY2xhc3NJZFwiOlwiJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XCIsXCJpbmRleFwiOlwiJHt0aGlzLmluZGV4fVwifWA7XG4gIH1cbiAgZ2V0IGV4cG9ydElkICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jbGFzc09iai5jbGFzc0lkfV8ke3RoaXMuaW5kZXh9YDtcbiAgfVxuICBnZXQgbGFiZWwgKCkge1xuICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLmFubm90YXRpb25zLmxhYmVsQXR0ciA/IHRoaXMucm93W3RoaXMuY2xhc3NPYmouYW5ub3RhdGlvbnMubGFiZWxBdHRyXSA6IHRoaXMuaW5kZXg7XG4gIH1cbiAgZXF1YWxzIChpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zdGFuY2VJZCA9PT0gaXRlbS5pbnN0YW5jZUlkO1xuICB9XG4gIGFzeW5jICogaGFuZGxlTGltaXQgKG9wdGlvbnMsIGl0ZXJhdG9ycykge1xuICAgIGxldCBsaW1pdCA9IEluZmluaXR5O1xuICAgIGlmIChvcHRpb25zLmxpbWl0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxpbWl0ID0gb3B0aW9ucy5saW1pdDtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIH1cbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBpdGVyYXRvciBvZiBpdGVyYXRvcnMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBpdGVyYXRvcikge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICBpKys7XG4gICAgICAgIGlmIChpdGVtID09PSBudWxsIHx8IGkgPj0gbGltaXQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIHlpZWxkICogdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKTtcbiAgfVxuICAqIF9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgaWYgKHRoaXMucmVzZXQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbmV4dFRhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW25leHRUYWJsZUlkXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1tuZXh0VGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9saW1pdFByb21pc2VzID0ge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaGFzIGFscmVhZHkgYmVlbiBidWlsdDsganVzdCBncmFiIGRhdGEgZnJvbSBpdCBkaXJlY3RseVxuICAgICAgeWllbGQgKiB0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGUgJiYgdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkLCBidXQgaXQncyBhbHJlYWR5IGxvbmcgZW5vdWdoIHRvIHNhdGlzZnkgdGhpc1xuICAgICAgLy8gcmVxdWVzdFxuICAgICAgeWllbGQgKiB0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQgYnVpbGRpbmcgKGFuZCBtYXliZSBkaWRuJ3QgZXZlbiBzdGFydCB5ZXQpO1xuICAgICAgLy8ga2ljayBpdCBvZmYsIGFuZCB0aGVuIHdhaXQgZm9yIGVub3VnaCBpdGVtcyB0byBiZSBwcm9jZXNzZWQgdG8gc2F0aXNmeVxuICAgICAgLy8gdGhlIGxpbWl0XG4gICAgICB0aGlzLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIHlpZWxkICogYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSA9IHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdIHx8IFtdO1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgdGVtcCA9PT0gbnVsbCkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSkpIHtcbiAgICAgICAgICAvLyBPa2F5LCB0aGlzIGl0ZW0gcGFzc2VkIGFsbCBmaWx0ZXJzLCBhbmQgaXMgcmVhZHkgdG8gYmUgc2VudCBvdXRcbiAgICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt0ZW1wLnZhbHVlLmluZGV4XSA9IHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGg7XG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBkYXRhIG5vdyB0byBzYXRpc2Z5IGFueSB3YWl0aW5nIHJlcXVlc3RzXG4gICAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB0aGlzLl9jYWNoZUxvb2t1cCA9IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NhY2hlQnVpbHQnKTtcbiAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgfVxuICBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy8gVGhlIHNldFRpbWVvdXQgaGVyZSBpcyBhYnNvbHV0ZWx5IG5lY2Vzc2FyeSwgb3IgdGhpcy5fY2FjaGVQcm9taXNlXG4gICAgICAgIC8vIHdvbid0IGJlIHN0b3JlZCBpbiB0aW1lIGZvciB0aGUgbmV4dCBidWlsZENhY2hlKCkgY2FsbCB0aGF0IGNvbWVzXG4gICAgICAgIC8vIHRocm91Z2hcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5fYnVpbGRDYWNoZShyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBjb25zdCBpdGVtc1RvUmVzZXQgPSAodGhpcy5fY2FjaGUgfHwgW10pXG4gICAgICAuY29uY2F0KHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSk7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zVG9SZXNldCkge1xuICAgICAgaXRlbS5yZXNldCA9IHRydWU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGhhbmRsZVJlc2V0IChyZWplY3QpIHtcbiAgICBmb3IgKGNvbnN0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5yZWplY3QoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzO1xuICAgIH1cbiAgICByZWplY3QoKTtcbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5idWlsZENhY2hlKCkpLmxlbmd0aDtcbiAgfVxuICBhc3luYyBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgICBpZiAod3JhcHBlZEl0ZW0ucm93W2F0dHJdIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3cgPSB3cmFwcGVkSXRlbS5kZWxheWVkUm93IHx8IHt9O1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3dbYXR0cl0gPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgZGVsZXRlIHdyYXBwZWRJdGVtLnJvd1thdHRyXTtcbiAgICB9XG4gICAgbGV0IGtlZXAgPSB0cnVlO1xuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAga2VlcCA9IHRoaXMuX2luZGV4RmlsdGVyKHdyYXBwZWRJdGVtLmluZGV4KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIE9iamVjdC52YWx1ZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIGtlZXAgPSBrZWVwICYmIGF3YWl0IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IG90aGVySXRlbSBvZiBvcHRpb25zLml0ZW1zVG9Db25uZWN0IHx8IFtdKSB7XG4gICAgICB3cmFwcGVkSXRlbS5jb25uZWN0SXRlbShvdGhlckl0ZW0pO1xuICAgICAgb3RoZXJJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBnZXRJbmRleERldGFpbHMgKCkge1xuICAgIGNvbnN0IGRldGFpbHMgPSB7IG5hbWU6IG51bGwgfTtcbiAgICBpZiAodGhpcy5fc3VwcHJlc3NJbmRleCkge1xuICAgICAgZGV0YWlscy5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBkZXRhaWxzLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGRldGFpbHM7XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZXhwZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ub2JzZXJ2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmRlcml2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0QXR0cmlidXRlRGV0YWlscygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIC8vIEFsbG93IHByb2JpbmcgdG8gc2VlIHdoYXRldmVyIGRhdGEgaGFwcGVucyB0byBiZSBhdmFpbGFibGVcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IFtdLFxuICAgICAgbG9va3VwOiB0aGlzLl9jYWNoZUxvb2t1cCB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgYXN5bmMgZ2V0SXRlbSAoaW5kZXggPSBudWxsKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlTG9va3VwKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9jYWNoZVswXSA6IHRoaXMuX2NhY2hlW3RoaXMuX2NhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgJiZcbiAgICAgICAgKChpbmRleCA9PT0gbnVsbCAmJiB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9wYXJ0aWFsQ2FjaGVbMF1cbiAgICAgICAgOiB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfVxuICAgIC8vIFN0dXBpZCBhcHByb2FjaCB3aGVuIHRoZSBjYWNoZSBpc24ndCBidWlsdDogaW50ZXJhdGUgdW50aWwgd2Ugc2VlIHRoZVxuICAgIC8vIGluZGV4LiBTdWJjbGFzc2VzIGNvdWxkIG92ZXJyaWRlIHRoaXNcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChpdGVtID09PSBudWxsIHx8IGl0ZW0uaW5kZXggPT09IGluZGV4KSB7XG4gICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0IHN1cHByZXNzZWRBdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpO1xuICB9XG4gIHN1cHByZXNzQXR0cmlidXRlIChhdHRyaWJ1dGUpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHVuU3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVsZXRlIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZV07XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFkZEZpbHRlciAoZnVuYywgYXR0cmlidXRlID0gbnVsbCkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2luZGV4RmlsdGVyID0gZnVuYztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZSA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZSAmJiB0aGlzLm1vZGVsLnRhYmxlc1tleGlzdGluZ1RhYmxlLnRhYmxlSWRdKSB8fCBudWxsO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnUHJvbW90ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdFeHBhbmRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgdW5yb2xsIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ1Vucm9sbGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZShsaW1pdCkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiBpbmRleGVzLm1hcChpbmRleCA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXhcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZShsaW1pdCkpIHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleDogd3JhcHBlZEl0ZW0uaW5kZXhcbiAgICAgIH07XG4gICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuICBkdXBsaWNhdGUgKCkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVUYWJsZSh7XG4gICAgICB0eXBlOiAnRHVwbGljYXRlZFRhYmxlJ1xuICAgIH0pO1xuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0LCB0eXBlID0gJ0Nvbm5lY3RlZFRhYmxlJykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZSh7IHR5cGUgfSk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgZm9yIChjb25zdCBvdGhlclRhYmxlIG9mIG90aGVyVGFibGVMaXN0KSB7XG4gICAgICBvdGhlclRhYmxlLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgcHJvamVjdCAodGFibGVJZHMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUoe1xuICAgICAgdHlwZTogJ1Byb2plY3RlZFRhYmxlJyxcbiAgICAgIHRhYmxlT3JkZXI6IFt0aGlzLnRhYmxlSWRdLmNvbmNhdCh0YWJsZUlkcylcbiAgICB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGVJZCBvZiB0YWJsZUlkcykge1xuICAgICAgY29uc3Qgb3RoZXJUYWJsZSA9IHRoaXMubW9kZWwudGFibGVzW290aGVyVGFibGVJZF07XG4gICAgICBvdGhlclRhYmxlLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGdldCBpblVzZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLmNsYXNzZXMpLnNvbWUoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlSWQgPT09IHRoaXMudGFibGVJZCB8fFxuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xIHx8XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTE7XG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlIChmb3JjZSA9IGZhbHNlKSB7XG4gICAgaWYgKCFmb3JjZSAmJiB0aGlzLmluVXNlKSB7XG4gICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBpbi11c2UgdGFibGUgJHt0aGlzLnRhYmxlSWR9YCk7XG4gICAgICBlcnIuaW5Vc2UgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9uYW1lO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLl9kYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93OiB0aGlzLl9kYXRhW2luZGV4XSB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljRGljdFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB7fTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX25hbWU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpcmVkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNvbnN0IEF0dHJUYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oc3VwZXJjbGFzcykge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgICB9XG4gICAgfVxuICAgIF90b1Jhd09iamVjdCAoKSB7XG4gICAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgICB9XG4gICAgZ2V0IG5hbWUgKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEF0dHJUYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mQXR0clRhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQXR0clRhYmxlTWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgQXR0clRhYmxlTWl4aW4gZnJvbSAnLi9BdHRyVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFByb21vdGVkVGFibGUgZXh0ZW5kcyBBdHRyVGFibGVNaXhpbihUYWJsZSkge1xuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgLy8gV2Ugb3ZlcnJpZGUgX2J1aWxkQ2FjaGUgYmVjYXVzZSB3ZSBkb24ndCBhY3R1YWxseSB3YW50IHRvIGNhbGwgX2ZpbmlzaEl0ZW1cbiAgICAvLyB1bnRpbCBhbGwgdW5pcXVlIHZhbHVlcyBoYXZlIGJlZW4gc2VlblxuICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZSA9IFtdO1xuICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cCA9IHt9O1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IFtdO1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZSgpO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgdGVtcCA9PT0gbnVsbCkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW3RlbXAudmFsdWUuaW5kZXhdID0gdGhpcy5fdW5maW5pc2hlZENhY2hlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdW5maW5pc2hlZENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIE9rYXksIG5vdyB3ZSd2ZSBzZWVuIGV2ZXJ5dGhpbmc7IHdlIGNhbiBjYWxsIF9maW5pc2hJdGVtIG9uIGVhY2ggb2YgdGhlXG4gICAgLy8gdW5pcXVlIHZhbHVlc1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHRoaXMuX3VuZmluaXNoZWRDYWNoZSkge1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odmFsdWUpKSB7XG4gICAgICAgIC8vIE9rYXksIHRoaXMgaXRlbSBwYXNzZWQgYWxsIGZpbHRlcnMsIGFuZCBpcyByZWFkeSB0byBiZSBzZW50IG91dFxuICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbdmFsdWUuaW5kZXhdID0gdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godmFsdWUpO1xuICAgICAgICBpKys7XG4gICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGRhdGEgbm93IHRvIHNhdGlzZnkgYW55IHdhaXRpbmcgcmVxdWVzdHNcbiAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICAgICAgICByZXNvbHZlKHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBEb25lIGl0ZXJhdGluZyEgV2UgY2FuIGdyYWR1YXRlIHRoZSBwYXJ0aWFsIGNhY2hlIC8gbG9va3VwcyBpbnRvXG4gICAgLy8gZmluaXNoZWQgb25lcywgYW5kIHNhdGlzZnkgYWxsIHRoZSByZXF1ZXN0c1xuICAgIGRlbGV0ZSB0aGlzLl91bmZpbmlzaGVkQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cDtcbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIHRoaXMuX2NhY2hlTG9va3VwID0gdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIHRoaXMudHJpZ2dlcignY2FjaGVCdWlsdCcpO1xuICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IFN0cmluZyhhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQhXG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW2luZGV4XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSXRlbSA9IHRoaXMuX3VuZmluaXNoZWRDYWNoZVt0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbaW5kZXhdXTtcbiAgICAgICAgZXhpc3RpbmdJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB3cmFwcGVkUGFyZW50LmNvbm5lY3RJdGVtKGV4aXN0aW5nSXRlbSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmFjZXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICB0aGlzLl92YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlICsgdGhpcy5fdmFsdWU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBTdHJpbmcodGhpcy5fdmFsdWUpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAvLyBOb3JtYWwgZmFjZXRpbmcganVzdCBnaXZlcyBhIHN1YnNldCBvZiB0aGUgb3JpZ2luYWwgdGFibGVcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogT2JqZWN0LmFzc2lnbih7fSwgd3JhcHBlZFBhcmVudC5yb3cpLFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGYWNldGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIFRyYW5zcG9zZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5faW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIGlmICh0aGlzLl9pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmluZGV4ID0gdGhpcy5faW5kZXg7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9pbmRleDtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGAke3RoaXMuX2luZGV4fWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGF3YWl0IHRoaXMucGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuXG4gICAgLy8gSXRlcmF0ZSB0aGUgcm93J3MgYXR0cmlidXRlcyBhcyBpbmRleGVzXG4gICAgY29uc3Qgd3JhcHBlZFBhcmVudCA9IHRoaXMucGFyZW50VGFibGUuX2NhY2hlW3RoaXMucGFyZW50VGFibGUuX2NhY2hlTG9va3VwW3RoaXMuX2luZGV4XV0gfHwgeyByb3c6IHt9IH07XG4gICAgZm9yIChjb25zdCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgcm93OiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gdmFsdWUgOiB7IHZhbHVlIH0sXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVHJhbnNwb3NlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbignPScpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5nZXRTb3J0SGFzaCgpKS5qb2luKCc9Jyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgLy8gRG9uJ3QgdHJ5IHRvIGNvbm5lY3QgdmFsdWVzIHVudGlsIGFsbCBvZiB0aGUgcGFyZW50IHRhYmxlcycgY2FjaGVzIGFyZVxuICAgIC8vIGJ1aWx0OyBUT0RPOiBtaWdodCBiZSBhYmxlIHRvIGRvIHNvbWV0aGluZyBtb3JlIHJlc3BvbnNpdmUgaGVyZT9cbiAgICBhd2FpdCBQcm9taXNlLmFsbChwYXJlbnRUYWJsZXMubWFwKHBUYWJsZSA9PiBwVGFibGUuYnVpbGRDYWNoZSgpKSk7XG5cbiAgICAvLyBOb3cgdGhhdCB0aGUgY2FjaGVzIGFyZSBidWlsdCwganVzdCBpdGVyYXRlIHRoZWlyIGtleXMgZGlyZWN0bHkuIFdlIG9ubHlcbiAgICAvLyBjYXJlIGFib3V0IGluY2x1ZGluZyByb3dzIHRoYXQgaGF2ZSBleGFjdCBtYXRjaGVzIGFjcm9zcyBhbGwgdGFibGVzLCBzb1xuICAgIC8vIHdlIGNhbiBqdXN0IHBpY2sgb25lIHBhcmVudCB0YWJsZSB0byBpdGVyYXRlXG4gICAgY29uc3QgYmFzZVBhcmVudFRhYmxlID0gcGFyZW50VGFibGVzWzBdO1xuICAgIGNvbnN0IG90aGVyUGFyZW50VGFibGVzID0gcGFyZW50VGFibGVzLnNsaWNlKDEpO1xuICAgIGZvciAoY29uc3QgaW5kZXggaW4gYmFzZVBhcmVudFRhYmxlLl9jYWNoZUxvb2t1cCkge1xuICAgICAgaWYgKCFwYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlTG9va3VwKSkge1xuICAgICAgICAvLyBPbmUgb2YgdGhlIHBhcmVudCB0YWJsZXMgd2FzIHJlc2V0XG4gICAgICAgIHRoaXMucmVzZXQoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCFvdGhlclBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICAgIC8vIE5vIG1hdGNoIGluIG9uZSBvZiB0aGUgb3RoZXIgdGFibGVzOyBvbWl0IHRoaXMgaXRlbVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIFRPRE86IGFkZCBlYWNoIHBhcmVudCB0YWJsZXMnIGtleXMgYXMgYXR0cmlidXRlIHZhbHVlc1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IHBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuX2NhY2hlW3RhYmxlLl9jYWNoZUxvb2t1cFtpbmRleF1dKVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIER1cGxpY2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICAvLyBZaWVsZCB0aGUgc2FtZSBpdGVtcyB3aXRoIHRoZSBzYW1lIGNvbm5lY3Rpb25zLCBidXQgd3JhcHBlZCBhbmQgZmluaXNoZWRcbiAgICAvLyBieSB0aGlzIHRhYmxlXG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMucGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4OiBpdGVtLmluZGV4LFxuICAgICAgICByb3c6IGl0ZW0ucm93LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogT2JqZWN0LnZhbHVlcyhpdGVtLmNvbm5lY3RlZEl0ZW1zKS5yZWR1Y2UoKGFnZywgaXRlbUxpc3QpID0+IHtcbiAgICAgICAgICByZXR1cm4gYWdnLmNvbmNhdChpdGVtTGlzdCk7XG4gICAgICAgIH0sIFtdKVxuICAgICAgfSk7XG4gICAgICBpdGVtLnJlZ2lzdGVyRHVwbGljYXRlKG5ld0l0ZW0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IER1cGxpY2F0ZWRUYWJsZTtcbiIsImltcG9ydCBBdHRyVGFibGVNaXhpbiBmcm9tICcuL0F0dHJUYWJsZU1peGluLmpzJztcblxuY29uc3QgQ2hpbGRUYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgQXR0clRhYmxlTWl4aW4oc3VwZXJjbGFzcykge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZDaGlsZFRhYmxlTWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBfd3JhcCAob3B0aW9ucykge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHN1cGVyLl93cmFwKG9wdGlvbnMpO1xuICAgICAgbmV3SXRlbS5wYXJlbnRJbmRleCA9IG9wdGlvbnMucGFyZW50SW5kZXg7XG4gICAgICByZXR1cm4gbmV3SXRlbTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KENoaWxkVGFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBDaGlsZFRhYmxlTWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgQ2hpbGRUYWJsZU1peGluIGZyb20gJy4vQ2hpbGRUYWJsZU1peGluLmpzJztcblxuY2xhc3MgRXhwYW5kZWRUYWJsZSBleHRlbmRzIENoaWxkVGFibGVNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3Qgcm93ID0gd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXTtcbiAgICAgIGlmIChyb3cgIT09IHVuZGVmaW5lZCAmJiByb3cgIT09IG51bGwgJiYgT2JqZWN0LmtleXMocm93KS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3csXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdLFxuICAgICAgICAgIHBhcmVudEluZGV4OiB3cmFwcGVkUGFyZW50LmluZGV4XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBDaGlsZFRhYmxlTWl4aW4gZnJvbSAnLi9DaGlsZFRhYmxlTWl4aW4uanMnO1xuXG5jbGFzcyBVbnJvbGxlZFRhYmxlIGV4dGVuZHMgQ2hpbGRUYWJsZU1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCByb3dzID0gd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXTtcbiAgICAgIGlmIChyb3dzICE9PSB1bmRlZmluZWQgJiYgcm93cyAhPT0gbnVsbCAmJlxuICAgICAgICAgIHR5cGVvZiByb3dzW1N5bWJvbC5pdGVyYXRvcl0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZm9yIChjb25zdCByb3cgb2Ygcm93cykge1xuICAgICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICAgIGluZGV4LFxuICAgICAgICAgICAgcm93LFxuICAgICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdLFxuICAgICAgICAgICAgcGFyZW50SW5kZXg6IHdyYXBwZWRQYXJlbnQuaW5kZXhcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBVbnJvbGxlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBQYXJlbnRDaGlsZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS5uYW1lKS5qb2luKCcvJyk7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLmdldFNvcnRIYXNoKCkpLmpvaW4oJywnKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBsZXQgcGFyZW50VGFibGUsIGNoaWxkVGFibGU7XG4gICAgaWYgKHRoaXMucGFyZW50VGFibGVzWzBdLnBhcmVudFRhYmxlID09PSB0aGlzLnBhcmVudFRhYmxlc1sxXSkge1xuICAgICAgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlc1sxXTtcbiAgICAgIGNoaWxkVGFibGUgPSB0aGlzLnBhcmVudFRhYmxlc1swXTtcbiAgICB9IGVsc2UgaWYgKHRoaXMucGFyZW50VGFibGVzWzFdLnBhcmVudFRhYmxlID09PSB0aGlzLnBhcmVudFRhYmxlc1swXSkge1xuICAgICAgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlc1swXTtcbiAgICAgIGNoaWxkVGFibGUgPSB0aGlzLnBhcmVudFRhYmxlc1sxXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnRDaGlsZFRhYmxlIG5vdCBzZXQgdXAgcHJvcGVybHlgKTtcbiAgICB9XG5cbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2hpbGQgb2YgY2hpbGRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHBhcmVudCA9IGF3YWl0IHBhcmVudFRhYmxlLmdldEl0ZW0oY2hpbGQucGFyZW50SW5kZXgpO1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFtwYXJlbnQsIGNoaWxkXVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUGFyZW50Q2hpbGRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgUHJvamVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy50YWJsZU9yZGVyID0gb3B0aW9ucy50YWJsZU9yZGVyO1xuICAgIGlmICghdGhpcy50YWJsZU9yZGVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhYmxlT3JkZXIgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnRhYmxlT3JkZXIubWFwKHRhYmxlSWQgPT4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0ubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy50YWJsZU9yZGVyXG4gICAgICAubWFwKHRhYmxlSWQgPT4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0uZ2V0U29ydEhhc2goKSkuam9pbign4qivJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBjb25zdCBmaXJzdFRhYmxlID0gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZU9yZGVyWzBdXTtcbiAgICBjb25zdCByZW1haW5pbmdJZHMgPSB0aGlzLnRhYmxlT3JkZXIuc2xpY2UoMSk7XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2VJdGVtIG9mIGZpcnN0VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGxhc3RJdGVtIG9mIHNvdXJjZUl0ZW0uaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHJlbWFpbmluZ0lkcykpIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4OiBzb3VyY2VJdGVtLmluZGV4ICsgJ+KorycgKyBsYXN0SXRlbS5pbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogW3NvdXJjZUl0ZW0sIGxhc3RJdGVtXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHNlbGYuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQcm9qZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy5jbGFzc0lkID0gb3B0aW9ucy5jbGFzc0lkO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMubW9kZWwgfHwgIXRoaXMuY2xhc3NJZCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsLCBjbGFzc0lkLCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBvcHRpb25zLmFubm90YXRpb25zIHx8IHt9O1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGNsYXNzTmFtZTogdGhpcy5fY2xhc3NOYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnNcbiAgICB9O1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlICsgdGhpcy5jbGFzc05hbWU7XG4gIH1cbiAgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIHRoaXMuX2NsYXNzTmFtZSA9IHZhbHVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgc2V0QW5ub3RhdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYW5ub3RhdGlvbnNba2V5XSA9IHZhbHVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlQW5ub3RhdGlvbiAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMuYW5ub3RhdGlvbnNba2V5XTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lICE9PSBudWxsO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHwgdGhpcy50YWJsZS5uYW1lO1xuICB9XG4gIGdldCB2YXJpYWJsZU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUudG9Mb2NhbGVMb3dlckNhc2UoKSArICdfJyArXG4gICAgICB0aGlzLmNsYXNzTmFtZVxuICAgICAgICAuc3BsaXQoL1xcVysvZylcbiAgICAgICAgLmZpbHRlcihkID0+IGQubGVuZ3RoID4gMClcbiAgICAgICAgLm1hcChkID0+IGRbMF0udG9Mb2NhbGVVcHBlckNhc2UoKSArIGQuc2xpY2UoMSkpXG4gICAgICAgIC5qb2luKCcnKTtcbiAgfVxuICBnZXQgdGFibGUgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICB9XG4gIGdldCBkZWxldGVkICgpIHtcbiAgICByZXR1cm4gIXRoaXMubW9kZWwuZGVsZXRlZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIF9kZXJpdmVOZXdDbGFzcyAobmV3VGFibGUsIHR5cGUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgdHlwZVxuICAgIH0pO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLCAnR2VuZXJpY0NsYXNzJyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5leHBhbmQoYXR0cmlidXRlKSk7XG4gIH1cbiAgdW5yb2xsIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS51bnJvbGwoYXR0cmlidXRlKSk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkVHJhbnNwb3NlKGluZGV4ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAoKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5UcmFuc3Bvc2UoKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLm1vZGVsLm9wdGltaXplVGFibGVzKCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0ge30pIHtcbiAgICBsZXQgZWRnZUlkcyA9IG9wdGlvbnMuY2xhc3Nlc1xuICAgICAgPyBvcHRpb25zLmNsYXNzZXMubWFwKGNsYXNzT2JqID0+IGNsYXNzT2JqLmNsYXNzSWQpXG4gICAgICA6IG9wdGlvbnMuY2xhc3NJZHMgfHwgT2JqZWN0LmtleXModGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IGl0ZXJhdG9ycyA9IFtdO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIGVkZ2VJZHMpIHtcbiAgICAgIGlmICghdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHNbZWRnZUlkXSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuY2xhc3NPYmoubW9kZWwuY2xhc3Nlc1tlZGdlSWRdO1xuICAgICAgY29uc3Qgcm9sZSA9IHRoaXMuY2xhc3NPYmouZ2V0RWRnZVJvbGUoZWRnZUNsYXNzKTtcbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAndGFyZ2V0Jykge1xuICAgICAgICBjb25zdCB0YWJsZUlkcyA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGl0ZXJhdG9ycy5wdXNoKHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBpdGVyYXRvcnMpO1xuICB9XG4gIGFzeW5jICogcGFpcndpc2VOZWlnaGJvcmhvb2QgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgdGhpcy5lZGdlcygpKSB7XG4gICAgICB5aWVsZCAqIGVkZ2UucGFpcndpc2VOZWlnaGJvcmhvb2Qob3B0aW9ucyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gIH1cbiAgKiBlZGdlQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGdldEVkZ2VSb2xlIChlZGdlQ2xhc3MpIHtcbiAgICBpZiAoIXRoaXMuZWRnZUNsYXNzSWRzW2VkZ2VDbGFzcy5jbGFzc0lkXSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICByZXR1cm4gJ2JvdGgnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICdzb3VyY2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgcmV0dXJuICd0YXJnZXQnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIG1pc21hdGNoIGJldHdlZW4gbm9kZSBhbmQgZWRnZSBjbGFzc0lkc2ApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBOb2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICh7IGF1dG9jb25uZWN0ID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmICghYXV0b2Nvbm5lY3QgfHwgZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgLy8gQXJlIHdlIHRoZSBzb3VyY2Ugb3IgdGFyZ2V0IG9mIHRoZSBleGlzdGluZyBlZGdlIChpbnRlcm5hbGx5LCBpbiB0ZXJtc1xuICAgICAgLy8gb2Ygc291cmNlSWQgLyB0YXJnZXRJZCwgbm90IGVkZ2VDbGFzcy5kaXJlY3Rpb24pP1xuICAgICAgY29uc3QgaXNTb3VyY2UgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkO1xuXG4gICAgICAvLyBBcyB3ZSdyZSBjb252ZXJ0ZWQgdG8gYW4gZWRnZSwgb3VyIG5ldyByZXN1bHRpbmcgc291cmNlIEFORCB0YXJnZXRcbiAgICAgIC8vIHNob3VsZCBiZSB3aGF0ZXZlciBpcyBhdCB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcyAoaWYgYW55dGhpbmcpXG4gICAgICBpZiAoaXNTb3VyY2UpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgbm9kZSBjbGFzcyBvbiB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcywgYWRkIG91clxuICAgICAgLy8gaWQgdG8gaXRzIGxpc3Qgb2YgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG5vZGVDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgaWYgKG5vZGVDbGFzcykge1xuICAgICAgICBub2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoIWlzU291cmNlKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAvLyBPa2F5LCB3ZSd2ZSBnb3QgdHdvIGVkZ2VzLCBzbyB0aGlzIGlzIGEgbGl0dGxlIG1vcmUgc3RyYWlnaHRmb3J3YXJkXG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgICBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgLy8gQWRkIHRoaXMgY2xhc3MgdG8gdGhlIHNvdXJjZSdzIC8gdGFyZ2V0J3MgZWRnZUNsYXNzSWRzXG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEaXNjb25uZWN0IHRoZSBleGlzdGluZyBlZGdlIGNsYXNzZXMgZnJvbSB0aGUgbmV3IChub3cgZWRnZSkgY2xhc3NcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfVxuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgbGV0IHRoaXNIYXNoLCBvdGhlckhhc2gsIHNvdXJjZVRhYmxlSWRzLCB0YXJnZXRUYWJsZUlkcztcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGU7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbIHRoaXNIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgaWYgKG90aGVyQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlLnByb21vdGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbIG90aGVySGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkcyxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSksICdOb2RlQ2xhc3MnKTtcbiAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIChjaGlsZENsYXNzKSB7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzLnRhYmxlLmNvbm5lY3QoW2NoaWxkQ2xhc3MudGFibGVdLCAnUGFyZW50Q2hpbGRUYWJsZScpO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFtdLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogY2hpbGRDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHM6IFtdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBjaGlsZENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9DaGlsZE5vZGVDbGFzcyhuZXdOb2RlQ2xhc3MpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgdW5yb2xsIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLnVucm9sbChhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9DaGlsZE5vZGVDbGFzcyhuZXdOb2RlQ2xhc3MpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgcHJvamVjdE5ld0VkZ2UgKGNsYXNzSWRMaXN0KSB7XG4gICAgY29uc3QgY2xhc3NMaXN0ID0gW3RoaXNdLmNvbmNhdChjbGFzc0lkTGlzdC5tYXAoY2xhc3NJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC5jbGFzc2VzW2NsYXNzSWRdO1xuICAgIH0pKTtcbiAgICBpZiAoY2xhc3NMaXN0Lmxlbmd0aCA8IDMgfHwgY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS50eXBlICE9PSAnTm9kZScpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjbGFzc0lkTGlzdGApO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VDbGFzc0lkID0gdGhpcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzSWQgPSBjbGFzc0xpc3RbY2xhc3NMaXN0Lmxlbmd0aCAtIDFdLmNsYXNzSWQ7XG4gICAgbGV0IHRhYmxlT3JkZXIgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGNsYXNzTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgY2xhc3NPYmogPSBjbGFzc0xpc3RbaV07XG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIHRhYmxlT3JkZXIucHVzaChjbGFzc09iai50YWJsZUlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGVkZ2VSb2xlID0gY2xhc3NMaXN0W2kgLSAxXS5nZXRFZGdlUm9sZShjbGFzc09iaik7XG4gICAgICAgIGlmIChlZGdlUm9sZSA9PT0gJ3NvdXJjZScgfHwgZWRnZVJvbGUgPT09ICdib3RoJykge1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChcbiAgICAgICAgICAgIEFycmF5LmZyb20oY2xhc3NPYmouc291cmNlVGFibGVJZHMpLnJldmVyc2UoKSk7XG4gICAgICAgICAgdGFibGVPcmRlci5wdXNoKGNsYXNzT2JqLnRhYmxlSWQpO1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChjbGFzc09iai50YXJnZXRUYWJsZUlkcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGFibGVPcmRlciA9IHRhYmxlT3JkZXIuY29uY2F0KFxuICAgICAgICAgICAgQXJyYXkuZnJvbShjbGFzc09iai50YXJnZXRUYWJsZUlkcykucmV2ZXJzZSgpKTtcbiAgICAgICAgICB0YWJsZU9yZGVyLnB1c2goY2xhc3NPYmoudGFibGVJZCk7XG4gICAgICAgICAgdGFibGVPcmRlciA9IHRhYmxlT3JkZXIuY29uY2F0KGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMudGFibGUucHJvamVjdCh0YWJsZU9yZGVyKTtcbiAgICBjb25zdCBuZXdDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZCxcbiAgICAgIHRhcmdldENsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkczogW10sXG4gICAgICB0YXJnZXRUYWJsZUlkczogW11cbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS5lZGdlQ2xhc3NJZHNbbmV3Q2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHJldHVybiBuZXdDbGFzcztcbiAgfVxuICBkaXNjb25uZWN0QWxsRWRnZXMgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiB0aGlzLmNvbm5lY3RlZENsYXNzZXMoKSkge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2Uob3B0aW9ucyk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogc291cmNlTm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlVGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZF0udGFibGVJZDtcbiAgICBjb25zdCB0YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmouc291cmNlVGFibGVJZHMuY29uY2F0KFsgc291cmNlVGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkXS50YWJsZUlkO1xuICAgIGNvbnN0IHRhYmxlSWRzID0gdGhpcy5jbGFzc09iai50YXJnZXRUYWJsZUlkcy5jb25jYXQoWyB0YXJnZXRUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIG5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSxcbiAgICAgIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlTmVpZ2hib3Job29kIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgc291cmNlLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICBlZGdlOiB0aGlzXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gc291cmNlVGFibGVJZHMgYW5kIHRhcmdldFRhYmxlSWRzIGFyZSBsaXN0cyBvZiBhbnkgaW50ZXJtZWRpYXRlIHRhYmxlcyxcbiAgICAvLyBiZWdpbm5pbmcgd2l0aCB0aGUgZWRnZSB0YWJsZSAoYnV0IG5vdCBpbmNsdWRpbmcgaXQpLCB0aGF0IGxlYWQgdG8gdGhlXG4gICAgLy8gc291cmNlIC8gdGFyZ2V0IG5vZGUgdGFibGVzIChidXQgbm90IGluY2x1ZGluZykgdGhvc2VcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnNvdXJjZVRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBzb3VyY2VDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgZ2V0IHRhcmdldENsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMudGFyZ2V0Q2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5wcm9tb3RlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MudGFibGUucHJvbW90ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUucHJvbW90ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLnByb21vdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0U291cmNlICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHJldHVybiBzdXBlci5wcm9tb3RlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgICB0eXBlOiAnTm9kZUNsYXNzJ1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgIG5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgICBzaWRlOiAhdGhpcy5zb3VyY2VDbGFzc0lkID8gJ3NvdXJjZScgOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogYXR0cmlidXRlXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gICAgfVxuICB9XG4gIGNvbm5lY3RGYWNldGVkQ2xhc3MgKG5ld0VkZ2VDbGFzcykge1xuICAgIC8vIFdoZW4gYW4gZWRnZSBjbGFzcyBpcyBmYWNldGVkLCB3ZSB3YW50IHRvIGtlZXAgdGhlIHNhbWUgY29ubmVjdGlvbnMuIFRoaXNcbiAgICAvLyBtZWFucyB3ZSBuZWVkIHRvIGNsb25lIGVhY2ggdGFibGUgY2hhaW4sIGFuZCBhZGQgb3VyIG93biB0YWJsZSB0byBpdFxuICAgIC8vIChiZWNhdXNlIG91ciB0YWJsZSBpcyB0aGUgcGFyZW50VGFibGUgb2YgdGhlIG5ldyBvbmUpXG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBuZXdFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMgPSBBcnJheS5mcm9tKHRoaXMuc291cmNlVGFibGVJZHMpO1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGhpcy50YWJsZUlkKTtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgbmV3RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzID0gQXJyYXkuZnJvbSh0aGlzLnRhcmdldFRhYmxlSWRzKTtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgICB0aGlzLnRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIGNvbnN0IG5ld0NsYXNzZXMgPSBzdXBlci5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcyk7XG4gICAgZm9yIChjb25zdCBuZXdDbGFzcyBvZiBuZXdDbGFzc2VzKSB7XG4gICAgICB0aGlzLmNvbm5lY3RGYWNldGVkQ2xhc3MobmV3Q2xhc3MpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3Q2xhc3NlcztcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdDbGFzcyBvZiBzdXBlci5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgdGhpcy5jb25uZWN0RmFjZXRlZENsYXNzKG5ld0NsYXNzKTtcbiAgICAgIHlpZWxkIG5ld0NsYXNzO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImNsYXNzIEZpbGVGb3JtYXQge1xuICBhc3luYyBidWlsZFJvdyAoaXRlbSkge1xuICAgIGNvbnN0IHJvdyA9IHt9O1xuICAgIGZvciAobGV0IGF0dHIgaW4gaXRlbS5yb3cpIHtcbiAgICAgIHJvd1thdHRyXSA9IGF3YWl0IGl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICByZXR1cm4gcm93O1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGaWxlRm9ybWF0O1xuIiwiY2xhc3MgUGFyc2VGYWlsdXJlIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvciAoZmlsZUZvcm1hdCkge1xuICAgIHN1cGVyKGBGYWlsZWQgdG8gcGFyc2UgZm9ybWF0OiAke2ZpbGVGb3JtYXQuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUGFyc2VGYWlsdXJlO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcbmltcG9ydCBQYXJzZUZhaWx1cmUgZnJvbSAnLi9QYXJzZUZhaWx1cmUuanMnO1xuXG5jb25zdCBOT0RFX05BTUVTID0gWydub2RlcycsICdOb2RlcyddO1xuY29uc3QgRURHRV9OQU1FUyA9IFsnZWRnZXMnLCAnbGlua3MnLCAnRWRnZXMnLCAnTGlua3MnXTtcblxuY2xhc3MgRDNKc29uIGV4dGVuZHMgRmlsZUZvcm1hdCB7XG4gIGFzeW5jIGltcG9ydERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICB0ZXh0LFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNvdXJjZUF0dHJpYnV0ZSA9ICdzb3VyY2UnLFxuICAgIHRhcmdldEF0dHJpYnV0ZSA9ICd0YXJnZXQnLFxuICAgIGNsYXNzQXR0cmlidXRlID0gbnVsbFxuICB9KSB7XG4gICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgY29uc3Qgbm9kZU5hbWUgPSBOT0RFX05BTUVTLmZpbmQobmFtZSA9PiBkYXRhW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpO1xuICAgIGNvbnN0IGVkZ2VOYW1lID0gRURHRV9OQU1FUy5maW5kKG5hbWUgPT4gZGF0YVtuYW1lXSBpbnN0YW5jZW9mIEFycmF5KTtcbiAgICBpZiAoIW5vZGVOYW1lIHx8ICFlZGdlTmFtZSkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlRmFpbHVyZSh0aGlzKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb3JlVGFibGUgPSBtb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnU3RhdGljRGljdFRhYmxlJyxcbiAgICAgIG5hbWU6ICdjb3JlVGFibGUnLFxuICAgICAgZGF0YTogZGF0YVxuICAgIH0pO1xuICAgIGNvbnN0IGNvcmVDbGFzcyA9IG1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29yZVRhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgICBsZXQgW25vZGVzLCBlZGdlc10gPSBjb3JlQ2xhc3MuY2xvc2VkVHJhbnNwb3NlKFtub2RlTmFtZSwgZWRnZU5hbWVdKTtcblxuICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgaWYgKG5vZGVBdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBpbXBvcnQgY2xhc3NlcyBmcm9tIEQzLXN0eWxlIEpTT04gd2l0aG91dCBub2RlQXR0cmlidXRlYCk7XG4gICAgICB9XG4gICAgICBjb25zdCBub2RlQ2xhc3NlcyA9IFtdO1xuICAgICAgY29uc3Qgbm9kZUNsYXNzTG9va3VwID0ge307XG4gICAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlQ2xhc3Mgb2Ygbm9kZXMub3BlbkZhY2V0KGNsYXNzQXR0cmlidXRlKSkge1xuICAgICAgICBub2RlQ2xhc3NMb29rdXBbbm9kZUNsYXNzLmNsYXNzTmFtZV0gPSBub2RlQ2xhc3Nlcy5sZW5ndGg7XG4gICAgICAgIG5vZGVDbGFzc2VzLnB1c2gobm9kZUNsYXNzLmludGVycHJldEFzTm9kZXMoKSk7XG4gICAgICB9XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlcy5vcGVuRmFjZXQoY2xhc3NBdHRyaWJ1dGUpKSB7XG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goZWRnZUNsYXNzLmludGVycHJldEFzRWRnZXMoKSk7XG4gICAgICAgIGNvbnN0IHNhbXBsZSA9IGF3YWl0IGVkZ2VDbGFzcy50YWJsZS5nZXRJdGVtKCk7XG4gICAgICAgIGNvbnN0IHNvdXJjZUNsYXNzTmFtZSA9IHNhbXBsZS5yb3dbc291cmNlQXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdO1xuICAgICAgICBpZiAobm9kZUNsYXNzTG9va3VwW3NvdXJjZUNsYXNzTmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgICAgICAgbm9kZUNsYXNzOiBub2RlQ2xhc3Nlc1tub2RlQ2xhc3NMb29rdXBbc291cmNlQ2xhc3NOYW1lXV0sXG4gICAgICAgICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgICAgICBlZGdlQXR0cmlidXRlOiBzb3VyY2VBdHRyaWJ1dGVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0YXJnZXRDbGFzc05hbWUgPSBzYW1wbGUucm93W3RhcmdldEF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXTtcbiAgICAgICAgaWYgKG5vZGVDbGFzc0xvb2t1cFt0YXJnZXRDbGFzc05hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgICAgICAgIG5vZGVDbGFzczogbm9kZUNsYXNzZXNbbm9kZUNsYXNzTG9va3VwW3RhcmdldENsYXNzTmFtZV1dLFxuICAgICAgICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICAgICAgZWRnZUF0dHJpYnV0ZTogdGFyZ2V0QXR0cmlidXRlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbm9kZXMgPSBub2Rlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgICBub2Rlcy5zZXRDbGFzc05hbWUobm9kZU5hbWUpO1xuICAgICAgZWRnZXMgPSBlZGdlcy5pbnRlcnByZXRBc0VkZ2VzKCk7XG4gICAgICBlZGdlcy5zZXRDbGFzc05hbWUoZWRnZU5hbWUpO1xuICAgICAgbm9kZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgICAgZWRnZUNsYXNzOiBlZGdlcyxcbiAgICAgICAgc2lkZTogJ3NvdXJjZScsXG4gICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHNvdXJjZUF0dHJpYnV0ZVxuICAgICAgfSk7XG4gICAgICBub2Rlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgICBlZGdlQ2xhc3M6IGVkZ2VzLFxuICAgICAgICBzaWRlOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZSxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogdGFyZ2V0QXR0cmlidXRlXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBwcmV0dHkgPSB0cnVlLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNvdXJjZUF0dHJpYnV0ZSA9ICdzb3VyY2UnLFxuICAgIHRhcmdldEF0dHJpYnV0ZSA9ICd0YXJnZXQnLFxuICAgIGNsYXNzQXR0cmlidXRlID0gbnVsbFxuICB9KSB7XG4gICAgaWYgKGNsYXNzQXR0cmlidXRlICYmICFub2RlQXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGV4cG9ydCBEMy1zdHlsZSBKU09OIHdpdGggY2xhc3Nlcywgd2l0aG91dCBhIG5vZGVBdHRyaWJ1dGVgKTtcbiAgICB9XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIGxpbmtzOiBbXVxuICAgIH07XG4gICAgY29uc3Qgbm9kZUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IG5vZGVDbGFzc2VzID0gW107XG4gICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGluY2x1ZGVDbGFzc2VzKSB7XG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIG5vZGVDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZWRnZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQub3RoZXIgPSByZXN1bHQub3RoZXIgfHwgW107XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICByZXN1bHQub3RoZXIucHVzaChhd2FpdCB0aGlzLmJ1aWxkUm93KGl0ZW0pKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IG5vZGVDbGFzcyBvZiBub2RlQ2xhc3Nlcykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIG5vZGVDbGFzcy50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgbm9kZUxvb2t1cFtub2RlLmV4cG9ydElkXSA9IHJlc3VsdC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHRoaXMuYnVpbGRSb3cobm9kZSk7XG4gICAgICAgIGlmIChub2RlQXR0cmlidXRlKSB7XG4gICAgICAgICAgcm93W25vZGVBdHRyaWJ1dGVdID0gbm9kZS5leHBvcnRJZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgICAgICByb3dbY2xhc3NBdHRyaWJ1dGVdID0gbm9kZS5jbGFzc09iai5jbGFzc05hbWU7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0Lm5vZGVzLnB1c2gocm93KTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZUNsYXNzZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiBlZGdlQ2xhc3MudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHRoaXMuYnVpbGRSb3coZWRnZSk7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIGVkZ2Uuc291cmNlTm9kZXMoeyBjbGFzc2VzOiBub2RlQ2xhc3NlcyB9KSkge1xuICAgICAgICAgIHJvd1tzb3VyY2VBdHRyaWJ1dGVdID0gbm9kZUF0dHJpYnV0ZSA/IHNvdXJjZS5leHBvcnRJZCA6IG5vZGVMb29rdXBbc291cmNlLmV4cG9ydElkXTtcbiAgICAgICAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIHJvd1tzb3VyY2VBdHRyaWJ1dGUgKyAnXycgKyBjbGFzc0F0dHJpYnV0ZV0gPSBzb3VyY2UuY2xhc3NPYmouY2xhc3NOYW1lO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlLnRhcmdldE5vZGVzKHsgY2xhc3Nlczogbm9kZUNsYXNzZXMgfSkpIHtcbiAgICAgICAgICAgIHJvd1t0YXJnZXRBdHRyaWJ1dGVdID0gbm9kZUF0dHJpYnV0ZSA/IHRhcmdldC5leHBvcnRJZCA6IG5vZGVMb29rdXBbdGFyZ2V0LmV4cG9ydElkXTtcbiAgICAgICAgICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICByb3dbdGFyZ2V0QXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdID0gdGFyZ2V0LmNsYXNzT2JqLmNsYXNzTmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5saW5rcy5wdXNoKE9iamVjdC5hc3NpZ24oe30sIHJvdykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAocHJldHR5KSB7XG4gICAgICByZXN1bHQubm9kZXMgPSAnICBcIm5vZGVzXCI6IFtcXG4gICAgJyArIHJlc3VsdC5ub2Rlcy5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgIC5qb2luKCcsXFxuICAgICcpICsgJ1xcbiAgXSc7XG4gICAgICByZXN1bHQubGlua3MgPSAnICBcImxpbmtzXCI6IFtcXG4gICAgJyArIHJlc3VsdC5saW5rcy5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgIC5qb2luKCcsXFxuICAgICcpICsgJ1xcbiAgXSc7XG4gICAgICBpZiAocmVzdWx0Lm90aGVyKSB7XG4gICAgICAgIHJlc3VsdC5vdGhlciA9ICcsXFxuICBcIm90aGVyXCI6IFtcXG4gICAgJyArIHJlc3VsdC5vdGhlci5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgICAgLmpvaW4oJyxcXG4gICAgJykgKyAnXFxuICBdJztcbiAgICAgIH1cbiAgICAgIHJlc3VsdCA9IGB7XFxuJHtyZXN1bHQubm9kZXN9LFxcbiR7cmVzdWx0LmxpbmtzfSR7cmVzdWx0Lm90aGVyIHx8ICcnfVxcbn1cXG5gO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBKU09OLnN0cmluZ2lmeShyZXN1bHQpO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogJ2RhdGE6dGV4dC9qc29uO2Jhc2U2NCwnICsgQnVmZmVyLmZyb20ocmVzdWx0KS50b1N0cmluZygnYmFzZTY0JyksXG4gICAgICB0eXBlOiAndGV4dC9qc29uJyxcbiAgICAgIGV4dGVuc2lvbjogJ2pzb24nXG4gICAgfTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgbmV3IEQzSnNvbigpO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcbmltcG9ydCBKU1ppcCBmcm9tICdqc3ppcCc7XG5cbmNsYXNzIENzdlppcCBleHRlbmRzIEZpbGVGb3JtYXQge1xuICBhc3luYyBpbXBvcnREYXRhICh7XG4gICAgbW9kZWwsXG4gICAgdGV4dFxuICB9KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBpbmRleE5hbWUgPSAnaW5kZXgnXG4gIH0pIHtcbiAgICBjb25zdCB6aXAgPSBuZXcgSlNaaXAoKTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgaW5jbHVkZUNsYXNzZXMpIHtcbiAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBjbGFzc09iai50YWJsZS5hdHRyaWJ1dGVzO1xuICAgICAgbGV0IGNvbnRlbnRzID0gYCR7aW5kZXhOYW1lfSwke2F0dHJpYnV0ZXMuam9pbignLCcpfVxcbmA7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGF0dHJpYnV0ZXMubWFwKGF0dHIgPT4gaXRlbS5yb3dbYXR0cl0pO1xuICAgICAgICBjb250ZW50cyArPSBgJHtpdGVtLmluZGV4fSwke3Jvdy5qb2luKCcsJyl9XFxuYDtcbiAgICAgIH1cbiAgICAgIHppcC5maWxlKGNsYXNzT2JqLmNsYXNzTmFtZSArICcuY3N2JywgY29udGVudHMpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiAnZGF0YTphcHBsaWNhdGlvbi96aXA7YmFzZTY0LCcgKyBhd2FpdCB6aXAuZ2VuZXJhdGVBc3luYyh7IHR5cGU6ICdiYXNlNjQnIH0pLFxuICAgICAgdHlwZTogJ2FwcGxpY2F0aW9uL3ppcCcsXG4gICAgICBleHRlbnNpb246ICd6aXAnXG4gICAgfTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgbmV3IENzdlppcCgpO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcblxuY29uc3QgZXNjYXBlQ2hhcnMgPSB7XG4gICcmcXVvdDsnOiAvXCIvZyxcbiAgJyZhcG9zOyc6IC8nL2csXG4gICcmbHQ7JzogLzwvZyxcbiAgJyZndDsnOiAvPi9nXG59O1xuXG5jbGFzcyBHRVhGIGV4dGVuZHMgRmlsZUZvcm1hdCB7XG4gIGFzeW5jIGltcG9ydERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBlc2NhcGUgKHN0cikge1xuICAgIHN0ciA9IHN0ci5yZXBsYWNlKC8mL2csICcmYW1wOycpO1xuICAgIGZvciAoY29uc3QgWyByZXBsLCBleHAgXSBvZiBPYmplY3QuZW50cmllcyhlc2NhcGVDaGFycykpIHtcbiAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKGV4cCwgcmVwbCk7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBjbGFzc0F0dHJpYnV0ZSA9ICdjbGFzcydcbiAgfSkge1xuICAgIGxldCBub2RlQ2h1bmsgPSAnJztcbiAgICBsZXQgZWRnZUNodW5rID0gJyc7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGluY2x1ZGVDbGFzc2VzKSB7XG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICBub2RlQ2h1bmsgKz0gYFxuICAgIDxub2RlIGlkPVwiJHt0aGlzLmVzY2FwZShub2RlLmV4cG9ydElkKX1cIiBsYWJlbD1cIiR7dGhpcy5lc2NhcGUobm9kZS5sYWJlbCl9XCI+XG4gICAgICA8YXR0dmFsdWVzPlxuICAgICAgICA8YXR0dmFsdWUgZm9yPVwiMFwiIHZhbHVlPVwiJHt0aGlzLmVzY2FwZShjbGFzc09iai5jbGFzc05hbWUpfVwiLz5cbiAgICAgIDwvYXR0dmFsdWVzPlxuICAgIDwvbm9kZT5gO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgZWRnZS5zb3VyY2VOb2Rlcyh7IGNsYXNzZXM6IGluY2x1ZGVDbGFzc2VzIH0pKSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlLnRhcmdldE5vZGVzKHsgY2xhc3NlczogaW5jbHVkZUNsYXNzZXMgfSkpIHtcbiAgICAgICAgICAgICAgZWRnZUNodW5rICs9IGBcbiAgICA8ZWRnZSBpZD1cIiR7dGhpcy5lc2NhcGUoZWRnZS5leHBvcnRJZCl9XCIgc291cmNlPVwiJHt0aGlzLmVzY2FwZShzb3VyY2UuZXhwb3J0SWQpfVwiIHRhcmdldD1cIiR7dGhpcy5lc2NhcGUodGFyZ2V0LmV4cG9ydElkKX1cIj5cbiAgICAgIDxhdHR2YWx1ZXM+XG4gICAgICAgIDxhdHR2YWx1ZSBmb3I9XCIwXCIgdmFsdWU9XCIke3RoaXMuZXNjYXBlKGNsYXNzT2JqLmNsYXNzTmFtZSl9XCIvPlxuICAgICAgPC9hdHR2YWx1ZXM+XG4gICAgPC9lZGdlPmA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gYFxcXG48P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz5cbjxnZXhmICB4bWxucz1cImh0dHA6Ly93d3cuZ2V4Zi5uZXQvMS4yZHJhZnRcIiB4bWxuczp4c2k9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAxL1hNTFNjaGVtYS1pbnN0YW5jZVwiIHhzaTpzY2hlbWFMb2NhdGlvbj1cImh0dHA6Ly93d3cuZ2V4Zi5uZXQvMS4yZHJhZnQgaHR0cDovL3d3dy5nZXhmLm5ldC8xLjJkcmFmdC9nZXhmLnhzZFwiIHZlcnNpb249XCIxLjJcIj5cbjxtZXRhIGxhc3Rtb2RpZmllZGRhdGU9XCIyMDA5LTAzLTIwXCI+XG4gIDxjcmVhdG9yPm9yaWdyYXBoLmdpdGh1Yi5pbzwvY3JlYXRvcj5cbiAgPGRlc2NyaXB0aW9uPiR7bW9kZWwubmFtZX08L2Rlc2NyaXB0aW9uPlxuPC9tZXRhPlxuPGdyYXBoIG1vZGU9XCJzdGF0aWNcIiBkZWZhdWx0ZWRnZXR5cGU9XCJkaXJlY3RlZFwiPlxuICA8YXR0cmlidXRlcyBjbGFzcz1cIm5vZGVcIj5cbiAgICA8YXR0cmlidXRlIGlkPVwiMFwiIHRpdGxlPVwiJHtjbGFzc0F0dHJpYnV0ZX1cIiB0eXBlPVwic3RyaW5nXCIvPlxuICA8L2F0dHJpYnV0ZXM+XG4gIDxhdHRyaWJ1dGVzIGNsYXNzPVwiZWRnZVwiPlxuICAgIDxhdHRyaWJ1dGUgaWQ9XCIwXCIgdGl0bGU9XCIke2NsYXNzQXR0cmlidXRlfVwiIHR5cGU9XCJzdHJpbmdcIi8+XG4gIDwvYXR0cmlidXRlcz5cbiAgPG5vZGVzPiR7bm9kZUNodW5rfVxuICA8L25vZGVzPlxuICA8ZWRnZXM+JHtlZGdlQ2h1bmt9XG4gIDwvZWRnZXM+XG48L2dyYXBoPlxuPC9nZXhmPlxuICBgO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6ICdkYXRhOnRleHQveG1sO2Jhc2U2NCwnICsgQnVmZmVyLmZyb20ocmVzdWx0KS50b1N0cmluZygnYmFzZTY0JyksXG4gICAgICB0eXBlOiAndGV4dC94bWwnLFxuICAgICAgZXh0ZW5zaW9uOiAnZ2V4ZidcbiAgICB9O1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBuZXcgR0VYRigpO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIEZJTEVfRk9STUFUUyBmcm9tICcuLi9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0cy5qcyc7XG5cbmNvbnN0IERBVEFMSUJfRk9STUFUUyA9IHtcbiAgJ2pzb24nOiAnanNvbicsXG4gICdjc3YnOiAnY3N2JyxcbiAgJ3Rzdic6ICd0c3YnXG59O1xuXG5jbGFzcyBOZXR3b3JrTW9kZWwgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgb3JpZ3JhcGgsXG4gICAgbW9kZWxJZCxcbiAgICBuYW1lID0gbW9kZWxJZCxcbiAgICBhbm5vdGF0aW9ucyA9IHt9LFxuICAgIGNsYXNzZXMgPSB7fSxcbiAgICB0YWJsZXMgPSB7fVxuICB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9yaWdyYXBoO1xuICAgIHRoaXMubW9kZWxJZCA9IG1vZGVsSWQ7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmFubm90YXRpb25zID0gYW5ub3RhdGlvbnM7XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG4gICAgdGhpcy50YWJsZXMgPSB7fTtcblxuICAgIHRoaXMuX25leHRDbGFzc0lkID0gMTtcbiAgICB0aGlzLl9uZXh0VGFibGVJZCA9IDE7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXMoY2xhc3NlcykpIHtcbiAgICAgIHRoaXMuY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IHRoaXMuaHlkcmF0ZShjbGFzc09iaiwgQ0xBU1NFUyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgT2JqZWN0LnZhbHVlcyh0YWJsZXMpKSB7XG4gICAgICB0aGlzLnRhYmxlc1t0YWJsZS50YWJsZUlkXSA9IHRoaXMuaHlkcmF0ZSh0YWJsZSwgVEFCTEVTKTtcbiAgICB9XG5cbiAgICB0aGlzLm9uKCd1cGRhdGUnLCAoKSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc2F2ZVRpbWVvdXQpO1xuICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5fb3JpZ3JhcGguc2F2ZSgpO1xuICAgICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHVuZGVmaW5lZDtcbiAgICAgIH0sIDApO1xuICAgIH0pO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgY2xhc3NlcyA9IHt9O1xuICAgIGNvbnN0IHRhYmxlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpKSB7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0gPSB0YWJsZU9iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXS50eXBlID0gdGFibGVPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIG1vZGVsSWQ6IHRoaXMubW9kZWxJZCxcbiAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zLFxuICAgICAgY2xhc3NlcyxcbiAgICAgIHRhYmxlc1xuICAgIH07XG4gIH1cbiAgZ2V0IHVuc2F2ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9zYXZlVGltZW91dCAhPT0gdW5kZWZpbmVkO1xuICB9XG4gIGh5ZHJhdGUgKHJhd09iamVjdCwgVFlQRVMpIHtcbiAgICByYXdPYmplY3QubW9kZWwgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgVFlQRVNbcmF3T2JqZWN0LnR5cGVdKHJhd09iamVjdCk7XG4gIH1cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMudGFibGVJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0pKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke3RoaXMuX25leHRUYWJsZUlkfWA7XG4gICAgICB0aGlzLl9uZXh0VGFibGVJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFRBQkxFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMuY2xhc3NJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdKSkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHt0aGlzLl9uZXh0Q2xhc3NJZH1gO1xuICAgICAgdGhpcy5fbmV4dENsYXNzSWQgKz0gMTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0uY2xhc3NPYmogJiYgIW9wdGlvbnMub3ZlcndyaXRlKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdLmR1cGxpY2F0ZSgpLnRhYmxlSWQ7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdID0gbmV3IENMQVNTRVNbb3B0aW9ucy50eXBlXShvcHRpb25zKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuICBmaW5kQ2xhc3MgKGNsYXNzTmFtZSkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiBjbGFzc09iai5jbGFzc05hbWUgPT09IGNsYXNzTmFtZSk7XG4gIH1cbiAgcmVuYW1lIChuZXdOYW1lKSB7XG4gICAgdGhpcy5uYW1lID0gbmV3TmFtZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFubm90YXRlIChrZXksIHZhbHVlKSB7XG4gICAgdGhpcy5hbm5vdGF0aW9uc1trZXldID0gdmFsdWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGVBbm5vdGF0aW9uIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5hbm5vdGF0aW9uc1trZXldO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLl9vcmlncmFwaC5kZWxldGVNb2RlbCh0aGlzLm1vZGVsSWQpO1xuICB9XG4gIGdldCBkZWxldGVkICgpIHtcbiAgICByZXR1cm4gdGhpcy5fb3JpZ3JhcGgubW9kZWxzW3RoaXMubW9kZWxJZF07XG4gIH1cbiAgYXN5bmMgYWRkVGV4dEZpbGUgKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMuZm9ybWF0KSB7XG4gICAgICBvcHRpb25zLmZvcm1hdCA9IG1pbWUuZXh0ZW5zaW9uKG1pbWUubG9va3VwKG9wdGlvbnMubmFtZSkpO1xuICAgIH1cbiAgICBpZiAoRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgICByZXR1cm4gRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XS5pbXBvcnREYXRhKG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAoREFUQUxJQl9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgb3B0aW9ucy5kYXRhID0gZGF0YWxpYi5yZWFkKG9wdGlvbnMudGV4dCwgeyB0eXBlOiBvcHRpb25zLmZvcm1hdCB9KTtcbiAgICAgIGlmIChvcHRpb25zLmZvcm1hdCA9PT0gJ2NzdicgfHwgb3B0aW9ucy5mb3JtYXQgPT09ICd0c3YnKSB7XG4gICAgICAgIG9wdGlvbnMuYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2Ygb3B0aW9ucy5kYXRhLmNvbHVtbnMpIHtcbiAgICAgICAgICBvcHRpb25zLmF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBvcHRpb25zLmRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY1RhYmxlKG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZm9ybWF0OiAke29wdGlvbnMuZm9ybWF0fWApO1xuICAgIH1cbiAgfVxuICBhc3luYyBmb3JtYXREYXRhIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgaWYgKEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIHJldHVybiBGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdLmZvcm1hdERhdGEob3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChEQVRBTElCX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFJhdyAke29wdGlvbnMuZm9ybWF0fSBleHBvcnQgbm90IHlldCBzdXBwb3J0ZWRgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBleHBvcnQgdW5rbm93biBmb3JtYXQ6ICR7b3B0aW9ucy5mb3JtYXR9YCk7XG4gICAgfVxuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBvcHRpbWl6ZVRhYmxlcyAoKSB7XG4gICAgY29uc3QgdGFibGVzSW5Vc2UgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgdGFibGVzSW5Vc2VbY2xhc3NPYmoudGFibGVJZF0gPSB0cnVlO1xuICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzIHx8IFtdKSB7XG4gICAgICAgIHRhYmxlc0luVXNlW3RhYmxlSWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc09iai50YXJnZXRUYWJsZUlkcyB8fCBbXSkge1xuICAgICAgICB0YWJsZXNJblVzZVt0YWJsZUlkXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHBhcmVudHNWaXNpdGVkID0ge307XG4gICAgY29uc3QgcXVldWUgPSBPYmplY3Qua2V5cyh0YWJsZXNJblVzZSk7XG4gICAgd2hpbGUgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHRhYmxlSWQgPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgaWYgKCFwYXJlbnRzVmlzaXRlZFt0YWJsZUlkXSkge1xuICAgICAgICB0YWJsZXNJblVzZVt0YWJsZUlkXSA9IHRydWU7XG4gICAgICAgIHBhcmVudHNWaXNpdGVkW3RhYmxlSWRdID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgdGFibGUgPSB0aGlzLnRhYmxlc1t0YWJsZUlkXTtcbiAgICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0YWJsZS5wYXJlbnRUYWJsZXMpIHtcbiAgICAgICAgICBxdWV1ZS5wdXNoKHBhcmVudFRhYmxlLnRhYmxlSWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBPYmplY3Qua2V5cyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIGNvbnN0IHRhYmxlID0gdGhpcy50YWJsZXNbdGFibGVJZF07XG4gICAgICBpZiAoIXRhYmxlc0luVXNlW3RhYmxlSWRdICYmIHRhYmxlLnR5cGUgIT09ICdTdGF0aWMnICYmIHRhYmxlLnR5cGUgIT09ICdTdGF0aWNEaWN0Jykge1xuICAgICAgICB0YWJsZS5kZWxldGUodHJ1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFRPRE86IElmIGFueSBEdXBsaWNhdGVkVGFibGUgaXMgaW4gdXNlLCBidXQgdGhlIG9yaWdpbmFsIGlzbid0LCBzd2FwIGZvciB0aGUgcmVhbCBvbmVcbiAgfVxuICBhc3luYyBnZXRBcmJpdHJhcnlJbnN0YW5jZUxpc3QgKHNlZWRDb3VudCA9IDIsIG5vZGVDb3VudCA9IDUsIGVkZ2VDb3VudCA9IDEwKSB7XG4gICAgLy8gVHJ5IHRvIGdldCBpbnN0YW5jZXNQZXJDbGFzcyBpbnN0YW5jZXMgZnJvbSBlYWNoIGNsYXNzLCBzdGFydGluZyB3aXRoIHRoZVxuICAgIC8vIGNsYXNzIHRoYXQgd2FzIHBhc3NlZCBpbiBhcyBhbiBhcmd1bWVudFxuICAgIGxldCBpdGVyYXRpb25SZXNldCA9IGZhbHNlO1xuICAgIGNvbnN0IG5vZGVJbnN0YW5jZXMgPSB7fTtcbiAgICBjb25zdCBlZGdlSW5zdGFuY2VzID0ge307XG4gICAgY29uc3Qgbm9kZUNvdW50cyA9IHt9O1xuICAgIGNvbnN0IGVkZ2VDb3VudHMgPSB7fTtcbiAgICBjb25zdCB1blNlZW5DbGFzc0lkcyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICB1blNlZW5DbGFzc0lkc1tjbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuXG4gICAgY29uc3QgcG9wdWxhdGVDbGFzc0NvdW50cyA9IGFzeW5jIChpbnN0YW5jZSkgPT4ge1xuICAgICAgaWYgKGluc3RhbmNlID09PSBudWxsKSB7XG4gICAgICAgIGl0ZXJhdGlvblJlc2V0ID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgY29uc3QgY2xhc3NJZCA9IGluc3RhbmNlLmNsYXNzT2JqLmNsYXNzSWQ7XG4gICAgICBjb25zdCBpbnN0YW5jZUlkID0gaW5zdGFuY2UuaW5zdGFuY2VJZDtcbiAgICAgIGlmIChpbnN0YW5jZS50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgbm9kZUNvdW50c1tjbGFzc0lkXSA9IG5vZGVDb3VudHNbY2xhc3NJZF0gfHwgMDtcbiAgICAgICAgaWYgKG5vZGVDb3VudHNbY2xhc3NJZF0gPj0gbm9kZUNvdW50IHx8IG5vZGVJbnN0YW5jZXNbaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIHVuU2VlbkNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgICBub2RlQ291bnRzW2NsYXNzSWRdKys7XG4gICAgICAgIG5vZGVJbnN0YW5jZXNbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIGluc3RhbmNlLmVkZ2VzKHsgbGltaXQ6IHNlZWRDb3VudCwgY2xhc3NJZHM6IE9iamVjdC5rZXlzKHVuU2VlbkNsYXNzSWRzKSB9KSkge1xuICAgICAgICAgIGlmICghYXdhaXQgcG9wdWxhdGVDbGFzc0NvdW50cyhlZGdlKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGluc3RhbmNlLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBlZGdlQ291bnRzW2NsYXNzSWRdID0gZWRnZUNvdW50c1tjbGFzc0lkXSB8fCAwO1xuICAgICAgICBpZiAoZWRnZUNvdW50c1tjbGFzc0lkXSA+PSBlZGdlQ291bnQgfHwgZWRnZUluc3RhbmNlc1tpbnN0YW5jZUlkXSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgdW5TZWVuQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICAgIGVkZ2VDb3VudHNbY2xhc3NJZF0rKztcbiAgICAgICAgZWRnZUluc3RhbmNlc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgaW5zdGFuY2Uubm9kZXMoeyBsaW1pdDogc2VlZENvdW50LCBjbGFzc0lkczogT2JqZWN0LmtleXModW5TZWVuQ2xhc3NJZHMpIH0pKSB7XG4gICAgICAgICAgaWYgKCFhd2FpdCBwb3B1bGF0ZUNsYXNzQ291bnRzKG5vZGUpKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGF3YWl0IGNsYXNzT2JqLnRhYmxlLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VlZENvdW50OyBpKyspIHtcbiAgICAgICAgaWYgKGl0ZXJhdGlvblJlc2V0KSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmFuZEluZGV4ID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogY2xhc3NPYmoudGFibGUuX2NhY2hlLmxlbmd0aCk7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlID0gY2xhc3NPYmoudGFibGUuX2NhY2hlW3JhbmRJbmRleF07XG4gICAgICAgIGlmICghYXdhaXQgcG9wdWxhdGVDbGFzc0NvdW50cyhpbnN0YW5jZSkpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gT2JqZWN0LmtleXMobm9kZUluc3RhbmNlcykuY29uY2F0KE9iamVjdC5rZXlzKGVkZ2VJbnN0YW5jZXMpKTtcbiAgfVxuICBhc3luYyBnZXRJbnN0YW5jZUdyYXBoIChpbnN0YW5jZUlkTGlzdCkge1xuICAgIGNvbnN0IG5vZGVJbnN0YW5jZXMgPSB7fTtcbiAgICBjb25zdCBlZGdlSW5zdGFuY2VzID0ge307XG4gICAgY29uc3QgZXh0cmFOb2RlcyA9IHt9O1xuICAgIGNvbnN0IGV4dHJhRWRnZXMgPSB7fTtcbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdXG4gICAgfTtcblxuICAgIGlmICghaW5zdGFuY2VJZExpc3QpIHtcbiAgICAgIHJldHVybiBncmFwaDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gR2V0IHRoZSBzcGVjaWZpZWQgaXRlbXNcbiAgICAgIGZvciAoY29uc3QgaW5zdGFuY2VJZCBvZiBpbnN0YW5jZUlkTGlzdCkge1xuICAgICAgICBjb25zdCB7IGNsYXNzSWQsIGluZGV4IH0gPSBKU09OLnBhcnNlKGluc3RhbmNlSWQpO1xuICAgICAgICBjb25zdCBpbnN0YW5jZSA9IGF3YWl0IHRoaXMuY2xhc3Nlc1tjbGFzc0lkXS50YWJsZS5nZXRJdGVtKGluZGV4KTtcbiAgICAgICAgaWYgKGluc3RhbmNlKSB7XG4gICAgICAgICAgaWYgKGluc3RhbmNlLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICAgICAgbm9kZUluc3RhbmNlc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2VzW2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQXQgdGhpcyBwb2ludCwgd2UgaGF2ZSBhbGwgdGhlIG5vZGVzIHRoYXQgd2UgTkVFRCwgYnV0IGZvciBhIGNsZWFuZXJcbiAgICAvLyBncmFwaCwgd2Ugd2FudCB0byBtYWtlIHN1cmUgdG8gb25seSBzaG93IGRhbmdsaW5nIGVkZ2VzIHRoYXQgYXJlIGFjdHVhbGx5XG4gICAgLy8gZGFuZ2xpbmcgaW4gdGhlIG5ldHdvcmsgbW9kZWwgKG5lZWQgdG8gbWFrZSBzdXJlIGVhY2ggZWRnZSBoYXMgYXQgbGVhc3RcbiAgICAvLyBvbmUgc291cmNlIGFuZCBvbmUgdGFyZ2V0IG5vZGUpXG4gICAgY29uc3Qgc2VlZFNpZGUgPSBhc3luYyAoZWRnZUlkLCBpdGVyRnVuYykgPT4ge1xuICAgICAgbGV0IGFOb2RlO1xuICAgICAgbGV0IGlzU2VlZGVkID0gZmFsc2U7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiBlZGdlSW5zdGFuY2VzW2VkZ2VJZF1baXRlckZ1bmNdKCkpIHtcbiAgICAgICAgYU5vZGUgPSBhTm9kZSB8fCBzb3VyY2U7XG4gICAgICAgIGlmIChub2RlSW5zdGFuY2VzW3NvdXJjZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgIGlzU2VlZGVkID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFpc1NlZWRlZCAmJiBhTm9kZSkge1xuICAgICAgICBleHRyYU5vZGVzW2FOb2RlLmluc3RhbmNlSWRdID0gYU5vZGU7XG4gICAgICB9XG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VJZCBpbiBlZGdlSW5zdGFuY2VzKSB7XG4gICAgICBzZWVkU2lkZShlZGdlSWQsICdzb3VyY2VOb2RlcycpO1xuICAgICAgc2VlZFNpZGUoZWRnZUlkLCAndGFyZ2V0Tm9kZXMnKTtcbiAgICB9XG4gICAgLy8gV2UgYWxzbyB3YW50IHRvIGFkZCBhbnkgZWRnZXMgdGhhdCBleGlzdCB0aGF0IGNvbm5lY3QgYW55IG9mIHRoZSBub2Rlc1xuICAgIC8vIHRoYXQgd2UndmUgaW5jbHVkZWRcbiAgICBmb3IgKGNvbnN0IG5vZGVJZCBpbiBub2RlSW5zdGFuY2VzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2Ygbm9kZUluc3RhbmNlc1tub2RlSWRdLmVkZ2VzKCkpIHtcbiAgICAgICAgaWYgKCFlZGdlSW5zdGFuY2VzW2VkZ2UuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAvLyBDaGVjayB0aGF0IGJvdGggZW5kcyBvZiB0aGUgZWRnZSBjb25uZWN0IGF0IGxlYXN0IG9uZVxuICAgICAgICAgIC8vIG9mIG91ciBub2Rlc1xuICAgICAgICAgIGxldCBjb25uZWN0c1NvdXJjZSA9IGZhbHNlO1xuICAgICAgICAgIGxldCBjb25uZWN0c1RhcmdldCA9IGZhbHNlO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2RlSW5zdGFuY2VzW25vZGUuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAgICAgY29ubmVjdHNTb3VyY2UgPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICAgICAgaWYgKG5vZGVJbnN0YW5jZXNbbm9kZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgICAgICBjb25uZWN0c1RhcmdldCA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoY29ubmVjdHNTb3VyY2UgJiYgY29ubmVjdHNUYXJnZXQpIHtcbiAgICAgICAgICAgIGV4dHJhRWRnZXNbZWRnZS5pbnN0YW5jZUlkXSA9IGVkZ2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQXQgdGhpcyBwb2ludCB3ZSBoYXZlIGEgY29tcGxldGUgc2V0IG9mIG5vZGVzIGFuZCBlZGdlcyB0aGF0IHdlIHdhbnQgdG9cbiAgICAvLyBpbmNsdWRlLiBOb3cgd2UgbmVlZCB0byBwb3B1bGF0ZSB0aGUgZ3JhcGg6XG5cbiAgICAvLyBBZGQgYWxsIHRoZSBub2RlcyB0byB0aGUgZ3JhcGgsIGFuZCBwb3B1bGF0ZSBhIGxvb2t1cCBmb3Igd2hlcmUgdGhleSBhcmUgaW4gdGhlIGxpc3RcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2YgT2JqZWN0LnZhbHVlcyhub2RlSW5zdGFuY2VzKS5jb25jYXQoT2JqZWN0LnZhbHVlcyhleHRyYU5vZGVzKSkpIHtcbiAgICAgIGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9IGdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICBub2RlSW5zdGFuY2U6IG5vZGUsXG4gICAgICAgIGR1bW15OiBmYWxzZVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGFsbCB0aGUgZWRnZXMsIGluY2x1ZGluZyBkdW1teSBub2RlcyBmb3IgZGFuZ2xpbmcgZWRnZXNcbiAgICBmb3IgKGNvbnN0IGVkZ2Ugb2YgT2JqZWN0LnZhbHVlcyhlZGdlSW5zdGFuY2VzKS5jb25jYXQoT2JqZWN0LnZhbHVlcyhleHRyYUVkZ2VzKSkpIHtcbiAgICAgIGlmICghZWRnZS5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmICghZWRnZS5jbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgLy8gTWlzc2luZyBib3RoIHNvdXJjZSBhbmQgdGFyZ2V0IGNsYXNzZXM7IGFkZCBkdW1teSBub2RlcyBmb3IgYm90aCBlbmRzXG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoICsgMVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQWRkIGR1bW15IHNvdXJjZSBub2Rlc1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIWVkZ2UuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAvLyBBZGQgZHVtbXkgdGFyZ2V0IG5vZGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdLFxuICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGVyZSBzaG91bGQgYmUgYm90aCBzb3VyY2UgYW5kIHRhcmdldCBub2RlcyBmb3IgZWFjaCBlZGdlXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlTm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2VOb2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0Tm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Tm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVMb29rdXBbc291cmNlTm9kZS5pbnN0YW5jZUlkXSxcbiAgICAgICAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXROb2RlLmluc3RhbmNlSWRdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE5ldHdvcmtNb2RlbEdyYXBoICh7XG4gICAgcmF3ID0gdHJ1ZSxcbiAgICBpbmNsdWRlRHVtbWllcyA9IGZhbHNlLFxuICAgIGNsYXNzTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGxldCBncmFwaCA9IHtcbiAgICAgIGNsYXNzZXM6IFtdLFxuICAgICAgY2xhc3NMb29rdXA6IHt9LFxuICAgICAgY2xhc3NDb25uZWN0aW9uczogW11cbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIC8vIEFkZCBhbmQgaW5kZXggdGhlIGNsYXNzIGFzIGEgbm9kZVxuICAgICAgY29uc3QgY2xhc3NTcGVjID0gcmF3ID8gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCkgOiB7IGNsYXNzT2JqIH07XG4gICAgICBjbGFzc1NwZWMudHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC5jbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGdyYXBoLmNsYXNzZXMubGVuZ3RoO1xuICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKGNsYXNzU3BlYyk7XG5cbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgLy8gU3RvcmUgdGhlIGVkZ2UgY2xhc3Mgc28gd2UgY2FuIGNyZWF0ZSBjbGFzc0Nvbm5lY3Rpb25zIGxhdGVyXG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgJiYgaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgbm9kZVxuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtjbGFzc09iai5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCAtIDEsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZmFsc2UsXG4gICAgICAgICAgbG9jYXRpb246ICdub2RlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGV4aXN0aW5nIGNsYXNzQ29ubmVjdGlvbnNcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlQ2xhc3Nlcykge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIHNvdXJjZSBub2RlIGNsYXNzIHRvIHRoZSBlZGdlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkfT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZSdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHNvdXJjZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgZHVtbXk+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIGVkZ2UgY2xhc3MgdG8gdGhlIHRhcmdldCBub2RlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT4ke2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHRhcmdldCBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCcsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICB0YWJsZXM6IFtdLFxuICAgICAgdGFibGVMb29rdXA6IHt9LFxuICAgICAgdGFibGVMaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IHRhYmxlTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpO1xuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBjb25zdCB0YWJsZVNwZWMgPSB0YWJsZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlU3BlYy50eXBlID0gdGFibGUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gZ3JhcGgudGFibGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLnRhYmxlcy5wdXNoKHRhYmxlU3BlYyk7XG4gICAgfVxuICAgIC8vIEZpbGwgdGhlIGdyYXBoIHdpdGggbGlua3MgYmFzZWQgb24gcGFyZW50VGFibGVzLi4uXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgIGdyYXBoLnRhYmxlTGlua3MucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBncmFwaC50YWJsZUxvb2t1cFtwYXJlbnRUYWJsZS50YWJsZUlkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TW9kZWxEdW1wICgpIHtcbiAgICAvLyBCZWNhdXNlIG9iamVjdCBrZXkgb3JkZXJzIGFyZW4ndCBkZXRlcm1pbmlzdGljLCBpdCBjYW4gYmUgcHJvYmxlbWF0aWNcbiAgICAvLyBmb3IgdGVzdGluZyAoYmVjYXVzZSBpZHMgY2FuIHJhbmRvbWx5IGNoYW5nZSBmcm9tIHRlc3QgcnVuIHRvIHRlc3QgcnVuKS5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIHNvcnRzIGVhY2gga2V5LCBhbmQganVzdCByZXBsYWNlcyBJRHMgd2l0aCBpbmRleCBudW1iZXJzXG4gICAgY29uc3QgcmF3T2JqID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0aGlzLl90b1Jhd09iamVjdCgpKSk7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NlczogT2JqZWN0LnZhbHVlcyhyYXdPYmouY2xhc3Nlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMuY2xhc3Nlc1thLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy5jbGFzc2VzW2IuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3MgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICB0YWJsZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLnRhYmxlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMudGFibGVzW2EudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLnRhYmxlc1tiLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhYmxlIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfTtcbiAgICBjb25zdCBjbGFzc0xvb2t1cCA9IHt9O1xuICAgIGNvbnN0IHRhYmxlTG9va3VwID0ge307XG4gICAgcmVzdWx0LmNsYXNzZXMuZm9yRWFjaCgoY2xhc3NPYmosIGluZGV4KSA9PiB7XG4gICAgICBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGluZGV4O1xuICAgIH0pO1xuICAgIHJlc3VsdC50YWJsZXMuZm9yRWFjaCgodGFibGUsIGluZGV4KSA9PiB7XG4gICAgICB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGluZGV4O1xuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiByZXN1bHQudGFibGVzKSB7XG4gICAgICB0YWJsZS50YWJsZUlkID0gdGFibGVMb29rdXBbdGFibGUudGFibGVJZF07XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgT2JqZWN0LmtleXModGFibGUuZGVyaXZlZFRhYmxlcykpIHtcbiAgICAgICAgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUxvb2t1cFt0YWJsZUlkXV0gPSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgICBkZWxldGUgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0YWJsZS5kYXRhOyAvLyBkb24ndCBpbmNsdWRlIGFueSBvZiB0aGUgZGF0YTsgd2UganVzdCB3YW50IHRoZSBtb2RlbCBzdHJ1Y3R1cmVcbiAgICB9XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiByZXN1bHQuY2xhc3Nlcykge1xuICAgICAgY2xhc3NPYmouY2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdO1xuICAgICAgY2xhc3NPYmoudGFibGVJZCA9IHRhYmxlTG9va3VwW2NsYXNzT2JqLnRhYmxlSWRdO1xuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzID0gY2xhc3NPYmouc291cmNlVGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnRhcmdldENsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzID0gY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBjbGFzc0lkIG9mIE9iamVjdC5rZXlzKGNsYXNzT2JqLmVkZ2VDbGFzc0lkcyB8fCB7fSkpIHtcbiAgICAgICAgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzTG9va3VwW2NsYXNzSWRdXSA9IGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgICAgZGVsZXRlIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBjcmVhdGVTY2hlbWFNb2RlbCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB0aGlzLmdldE1vZGVsRHVtcCgpO1xuXG4gICAgZ3JhcGgudGFibGVzLmZvckVhY2godGFibGUgPT4ge1xuICAgICAgdGFibGUuZGVyaXZlZFRhYmxlcyA9IE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbmV3TW9kZWwgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVNb2RlbCh7IG5hbWU6IHRoaXMubmFtZSArICdfc2NoZW1hJyB9KTtcbiAgICBjb25zdCByYXcgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaCxcbiAgICAgIG5hbWU6ICdSYXcgRHVtcCdcbiAgICB9KTtcbiAgICBsZXQgWyBjbGFzc2VzLCB0YWJsZXMgXSA9IHJhdy5jbG9zZWRUcmFuc3Bvc2UoWydjbGFzc2VzJywgJ3RhYmxlcyddKTtcbiAgICBjbGFzc2VzID0gY2xhc3Nlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgY2xhc3Nlcy5zZXRDbGFzc05hbWUoJ0NsYXNzZXMnKTtcbiAgICByYXcuZGVsZXRlKCk7XG5cbiAgICBjb25zdCBzb3VyY2VDbGFzc2VzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IGNsYXNzZXMsXG4gICAgICBhdHRyaWJ1dGU6ICdzb3VyY2VDbGFzc0lkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgc291cmNlQ2xhc3Nlcy5zZXRDbGFzc05hbWUoJ1NvdXJjZSBDbGFzcycpO1xuICAgIHNvdXJjZUNsYXNzZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAndGFyZ2V0Q2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhcmdldENsYXNzZXMuc2V0Q2xhc3NOYW1lKCdUYXJnZXQgQ2xhc3MnKTtcbiAgICB0YXJnZXRDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgdGFibGVzID0gdGFibGVzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICB0YWJsZXMuc2V0Q2xhc3NOYW1lKCdUYWJsZXMnKTtcblxuICAgIGNvbnN0IHRhYmxlRGVwZW5kZW5jaWVzID0gdGFibGVzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAnZGVyaXZlZFRhYmxlcycsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnNldENsYXNzTmFtZSgnSXMgUGFyZW50IE9mJyk7XG4gICAgdGFibGVEZXBlbmRlbmNpZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG5cbiAgICBjb25zdCBjb3JlVGFibGVzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhYmxlSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICBjb3JlVGFibGVzLnNldENsYXNzTmFtZSgnQ29yZSBUYWJsZScpO1xuICAgIHJldHVybiBuZXdNb2RlbDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTmV0d29ya01vZGVsO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgTmV0d29ya01vZGVsIGZyb20gJy4vQ29tbW9uL05ldHdvcmtNb2RlbC5qcyc7XG5cbmxldCBORVhUX01PREVMX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBvbmx5IGRlZmluZWQgaW4gdGhlIGJyb3dzZXIgY29udGV4dFxuXG4gICAgdGhpcy5wbHVnaW5zID0ge307XG5cbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIGxldCBleGlzdGluZ01vZGVscyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ29yaWdyYXBoX21vZGVscycpO1xuICAgIGlmIChleGlzdGluZ01vZGVscykge1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKEpTT04ucGFyc2UoZXhpc3RpbmdNb2RlbHMpKSkge1xuICAgICAgICBtb2RlbC5vcmlncmFwaCA9IHRoaXM7XG4gICAgICAgIHRoaXMubW9kZWxzW21vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChtb2RlbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICB9XG4gIHJlZ2lzdGVyUGx1Z2luIChuYW1lLCBwbHVnaW4pIHtcbiAgICB0aGlzLnBsdWdpbnNbbmFtZV0gPSBwbHVnaW47XG4gIH1cbiAgc2F2ZSAoKSB7XG4gICAgLypcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IG1vZGVscyA9IHt9O1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubW9kZWxzKSkge1xuICAgICAgICBtb2RlbHNbbW9kZWxJZF0gPSBtb2RlbC5fdG9SYXdPYmplY3QoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ29yaWdyYXBoX21vZGVscycsIEpTT04uc3RyaW5naWZ5KG1vZGVscykpO1xuICAgICAgdGhpcy50cmlnZ2VyKCdzYXZlJyk7XG4gICAgfVxuICAgICovXG4gIH1cbiAgY2xvc2VDdXJyZW50TW9kZWwgKCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGdldCBjdXJyZW50TW9kZWwgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1t0aGlzLl9jdXJyZW50TW9kZWxJZF0gfHwgbnVsbDtcbiAgfVxuICBzZXQgY3VycmVudE1vZGVsIChtb2RlbCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbW9kZWwgPyBtb2RlbC5tb2RlbElkIDogbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGFzeW5jIGxvYWRNb2RlbCAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld01vZGVsID0gdGhpcy5jcmVhdGVNb2RlbCh7IG1vZGVsSWQ6IG9wdGlvbnMubmFtZSB9KTtcbiAgICBhd2FpdCBuZXdNb2RlbC5hZGRUZXh0RmlsZShvcHRpb25zKTtcbiAgICByZXR1cm4gbmV3TW9kZWw7XG4gIH1cbiAgY3JlYXRlTW9kZWwgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5tb2RlbElkIHx8IHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWxJZCA9IGBtb2RlbCR7TkVYVF9NT0RFTF9JRH1gO1xuICAgICAgTkVYVF9NT0RFTF9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChvcHRpb25zKTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG9wdGlvbnMubW9kZWxJZDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdO1xuICB9XG4gIGRlbGV0ZU1vZGVsIChtb2RlbElkID0gdGhpcy5jdXJyZW50TW9kZWxJZCkge1xuICAgIGlmICghdGhpcy5tb2RlbHNbbW9kZWxJZF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIG5vbi1leGlzdGVudCBtb2RlbDogJHttb2RlbElkfWApO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbHNbbW9kZWxJZF07XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRNb2RlbElkID09PSBtb2RlbElkKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIH1cbiAgICB0aGlzLnNhdmUoKTtcbiAgfVxuICBkZWxldGVBbGxNb2RlbHMgKCkge1xuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3JpZ3JhcGg7XG4iLCJpbXBvcnQgT3JpZ3JhcGggZnJvbSAnLi9PcmlncmFwaC5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBvcmlncmFwaCA9IG5ldyBPcmlncmFwaCh3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm9yaWdyYXBoLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgb3JpZ3JhcGg7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsIl9ldmVudEhhbmRsZXJzIiwiX3N0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImV2ZW50IiwibmFtZXNwYWNlIiwic3BsaXQiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJpbmRleE9mIiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJoYW5kbGVDYWxsYmFjayIsInNldFRpbWVvdXQiLCJhcHBseSIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJHZW5lcmljV3JhcHBlciIsIm9wdGlvbnMiLCJ0YWJsZSIsInVuZGVmaW5lZCIsIkVycm9yIiwiY2xhc3NPYmoiLCJyb3ciLCJjb25uZWN0ZWRJdGVtcyIsImR1cGxpY2F0ZUl0ZW1zIiwicmVnaXN0ZXJEdXBsaWNhdGUiLCJpdGVtIiwiY29ubmVjdEl0ZW0iLCJ0YWJsZUlkIiwiZHVwIiwiZGlzY29ubmVjdCIsIml0ZW1MaXN0IiwidmFsdWVzIiwiaW5zdGFuY2VJZCIsImNsYXNzSWQiLCJleHBvcnRJZCIsImxhYmVsIiwiYW5ub3RhdGlvbnMiLCJsYWJlbEF0dHIiLCJlcXVhbHMiLCJoYW5kbGVMaW1pdCIsIml0ZXJhdG9ycyIsImxpbWl0IiwiSW5maW5pdHkiLCJpdGVyYXRvciIsIml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInRhYmxlSWRzIiwiUHJvbWlzZSIsImFsbCIsIm1hcCIsIm1vZGVsIiwidGFibGVzIiwiYnVpbGRDYWNoZSIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJyZXNldCIsIm5leHRUYWJsZUlkIiwibGVuZ3RoIiwicmVtYWluaW5nVGFibGVJZHMiLCJzbGljZSIsImV4ZWMiLCJuYW1lIiwiVGFibGUiLCJfZXhwZWN0ZWRBdHRyaWJ1dGVzIiwiYXR0cmlidXRlcyIsIl9vYnNlcnZlZEF0dHJpYnV0ZXMiLCJfZGVyaXZlZFRhYmxlcyIsImRlcml2ZWRUYWJsZXMiLCJfZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImF0dHIiLCJzdHJpbmdpZmllZEZ1bmMiLCJlbnRyaWVzIiwiZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImh5ZHJhdGVGdW5jdGlvbiIsIl9zdXBwcmVzc2VkQXR0cmlidXRlcyIsInN1cHByZXNzZWRBdHRyaWJ1dGVzIiwiX3N1cHByZXNzSW5kZXgiLCJzdXBwcmVzc0luZGV4IiwiX2luZGV4RmlsdGVyIiwiaW5kZXhGaWx0ZXIiLCJfYXR0cmlidXRlRmlsdGVycyIsImF0dHJpYnV0ZUZpbHRlcnMiLCJfbGltaXRQcm9taXNlcyIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwiZ2V0U29ydEhhc2giLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiaXRlcmF0ZSIsIl9jYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJyZXNvbHZlIiwicmVqZWN0IiwiX2l0ZXJhdGUiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGVMb29rdXAiLCJkb25lIiwibmV4dCIsImhhbmRsZVJlc2V0IiwiX2ZpbmlzaEl0ZW0iLCJOdW1iZXIiLCJfY2FjaGVMb29rdXAiLCJfY2FjaGVQcm9taXNlIiwiaXRlbXNUb1Jlc2V0IiwiY29uY2F0IiwiZGVyaXZlZFRhYmxlIiwiY291bnRSb3dzIiwid3JhcHBlZEl0ZW0iLCJkZWxheWVkUm93Iiwia2VlcCIsIl93cmFwIiwib3RoZXJJdGVtIiwiaXRlbXNUb0Nvbm5lY3QiLCJnZXRJbmRleERldGFpbHMiLCJkZXRhaWxzIiwic3VwcHJlc3NlZCIsImZpbHRlcmVkIiwiZ2V0QXR0cmlidXRlRGV0YWlscyIsImFsbEF0dHJzIiwiZXhwZWN0ZWQiLCJvYnNlcnZlZCIsImRlcml2ZWQiLCJjdXJyZW50RGF0YSIsImRhdGEiLCJsb29rdXAiLCJjb21wbGV0ZSIsImdldEl0ZW0iLCJkZXJpdmVBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJzdXBwcmVzc0F0dHJpYnV0ZSIsInVuU3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJwcm9tb3RlIiwiZXhwYW5kIiwidW5yb2xsIiwiY2xvc2VkRmFjZXQiLCJvcGVuRmFjZXQiLCJjbG9zZWRUcmFuc3Bvc2UiLCJpbmRleGVzIiwib3BlblRyYW5zcG9zZSIsImR1cGxpY2F0ZSIsImNvbm5lY3QiLCJvdGhlclRhYmxlTGlzdCIsIm90aGVyVGFibGUiLCJwcm9qZWN0IiwidGFibGVPcmRlciIsIm90aGVyVGFibGVJZCIsImNsYXNzZXMiLCJwYXJlbnRUYWJsZXMiLCJyZWR1Y2UiLCJhZ2ciLCJpblVzZSIsInNvbWUiLCJzb3VyY2VUYWJsZUlkcyIsInRhcmdldFRhYmxlSWRzIiwiZGVsZXRlIiwiZm9yY2UiLCJlcnIiLCJwYXJlbnRUYWJsZSIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIlN0YXRpY0RpY3RUYWJsZSIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIkF0dHJUYWJsZU1peGluIiwiX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpbiIsIl9hdHRyaWJ1dGUiLCJQcm9tb3RlZFRhYmxlIiwiX3VuZmluaXNoZWRDYWNoZSIsIl91bmZpbmlzaGVkQ2FjaGVMb29rdXAiLCJ3cmFwcGVkUGFyZW50IiwiU3RyaW5nIiwiZXhpc3RpbmdJdGVtIiwibmV3SXRlbSIsIkZhY2V0ZWRUYWJsZSIsIl92YWx1ZSIsIlRyYW5zcG9zZWRUYWJsZSIsIl9pbmRleCIsIkNvbm5lY3RlZFRhYmxlIiwiam9pbiIsInBUYWJsZSIsImJhc2VQYXJlbnRUYWJsZSIsIm90aGVyUGFyZW50VGFibGVzIiwiRHVwbGljYXRlZFRhYmxlIiwiQ2hpbGRUYWJsZU1peGluIiwiX2luc3RhbmNlT2ZDaGlsZFRhYmxlTWl4aW4iLCJwYXJlbnRJbmRleCIsIkV4cGFuZGVkVGFibGUiLCJVbnJvbGxlZFRhYmxlIiwicm93cyIsIlBhcmVudENoaWxkVGFibGUiLCJjaGlsZFRhYmxlIiwiY2hpbGQiLCJwYXJlbnQiLCJQcm9qZWN0ZWRUYWJsZSIsInNlbGYiLCJmaXJzdFRhYmxlIiwicmVtYWluaW5nSWRzIiwic291cmNlSXRlbSIsImxhc3RJdGVtIiwiR2VuZXJpY0NsYXNzIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsInNldENsYXNzTmFtZSIsInNldEFubm90YXRpb24iLCJrZXkiLCJkZWxldGVBbm5vdGF0aW9uIiwiaGFzQ3VzdG9tTmFtZSIsInZhcmlhYmxlTmFtZSIsImZpbHRlciIsImQiLCJ0b0xvY2FsZVVwcGVyQ2FzZSIsImRlbGV0ZWQiLCJpbnRlcnByZXRBc05vZGVzIiwib3ZlcndyaXRlIiwiY3JlYXRlQ2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiX2Rlcml2ZU5ld0NsYXNzIiwib3B0aW1pemVUYWJsZXMiLCJOb2RlV3JhcHBlciIsImVkZ2VzIiwiZWRnZUlkcyIsImNsYXNzSWRzIiwiZWRnZUNsYXNzSWRzIiwiZWRnZUlkIiwiZWRnZUNsYXNzIiwicm9sZSIsImdldEVkZ2VSb2xlIiwicmV2ZXJzZSIsInBhaXJ3aXNlTmVpZ2hib3Job29kIiwiZWRnZSIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc2VzIiwiZWRnZUNsYXNzSWQiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsImF1dG9jb25uZWN0IiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiaXNTb3VyY2UiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIm5vZGVDbGFzcyIsInRhYmxlSWRMaXN0IiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5ld05vZGVDbGFzcyIsImNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIiwiY2hpbGRDbGFzcyIsInByb2plY3ROZXdFZGdlIiwiY2xhc3NJZExpc3QiLCJjbGFzc0xpc3QiLCJlZGdlUm9sZSIsIkFycmF5IiwiZnJvbSIsIm5ld0NsYXNzIiwiY29ubmVjdGVkQ2xhc3NlcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlTm9kZXMiLCJzb3VyY2VUYWJsZUlkIiwidGFyZ2V0Tm9kZXMiLCJ0YXJnZXRUYWJsZUlkIiwibm9kZXMiLCJzb3VyY2UiLCJ0YXJnZXQiLCJFZGdlQ2xhc3MiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwiX3NwbGl0VGFibGVJZExpc3QiLCJvdGhlckNsYXNzIiwibm9kZVRhYmxlSWRMaXN0IiwiZWRnZVRhYmxlSWQiLCJlZGdlVGFibGVJZExpc3QiLCJzdGF0aWNFeGlzdHMiLCJ0YWJsZURpc3RhbmNlcyIsInN0YXJ0c1dpdGgiLCJkaXN0IiwiTWF0aCIsImFicyIsInNvcnQiLCJhIiwiYiIsInNpZGUiLCJjb25uZWN0U291cmNlIiwiY29ubmVjdFRhcmdldCIsInRvZ2dsZURpcmVjdGlvbiIsInN3YXBwZWREaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImVkZ2VIYXNoIiwibm9kZUhhc2giLCJ1bnNoaWZ0IiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJjb25uZWN0RmFjZXRlZENsYXNzIiwibmV3Q2xhc3NlcyIsIkZpbGVGb3JtYXQiLCJidWlsZFJvdyIsIlBhcnNlRmFpbHVyZSIsImZpbGVGb3JtYXQiLCJOT0RFX05BTUVTIiwiRURHRV9OQU1FUyIsIkQzSnNvbiIsImltcG9ydERhdGEiLCJ0ZXh0Iiwic291cmNlQXR0cmlidXRlIiwidGFyZ2V0QXR0cmlidXRlIiwiY2xhc3NBdHRyaWJ1dGUiLCJKU09OIiwicGFyc2UiLCJub2RlTmFtZSIsImVkZ2VOYW1lIiwiY29yZVRhYmxlIiwiY29yZUNsYXNzIiwibm9kZUNsYXNzZXMiLCJub2RlQ2xhc3NMb29rdXAiLCJzYW1wbGUiLCJzb3VyY2VDbGFzc05hbWUiLCJ0YXJnZXRDbGFzc05hbWUiLCJmb3JtYXREYXRhIiwiaW5jbHVkZUNsYXNzZXMiLCJwcmV0dHkiLCJsaW5rcyIsIm5vZGVMb29rdXAiLCJvdGhlciIsIm5vZGUiLCJzdHJpbmdpZnkiLCJCdWZmZXIiLCJleHRlbnNpb24iLCJDc3ZaaXAiLCJpbmRleE5hbWUiLCJ6aXAiLCJKU1ppcCIsImNvbnRlbnRzIiwiZmlsZSIsImdlbmVyYXRlQXN5bmMiLCJlc2NhcGVDaGFycyIsIkdFWEYiLCJlc2NhcGUiLCJzdHIiLCJyZXBsIiwiZXhwIiwibm9kZUNodW5rIiwiZWRnZUNodW5rIiwiREFUQUxJQl9GT1JNQVRTIiwiTmV0d29ya01vZGVsIiwib3JpZ3JhcGgiLCJtb2RlbElkIiwiX29yaWdyYXBoIiwiX25leHRDbGFzc0lkIiwiX25leHRUYWJsZUlkIiwiaHlkcmF0ZSIsIkNMQVNTRVMiLCJUQUJMRVMiLCJfc2F2ZVRpbWVvdXQiLCJzYXZlIiwidW5zYXZlZCIsInJhd09iamVjdCIsIlRZUEVTIiwic2VsZWN0b3IiLCJmaW5kQ2xhc3MiLCJyZW5hbWUiLCJuZXdOYW1lIiwiYW5ub3RhdGUiLCJkZWxldGVNb2RlbCIsIm1vZGVscyIsImFkZFRleHRGaWxlIiwiZm9ybWF0IiwibWltZSIsIkZJTEVfRk9STUFUUyIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwidGFibGVzSW5Vc2UiLCJwYXJlbnRzVmlzaXRlZCIsInF1ZXVlIiwic2hpZnQiLCJnZXRBcmJpdHJhcnlJbnN0YW5jZUxpc3QiLCJzZWVkQ291bnQiLCJub2RlQ291bnQiLCJlZGdlQ291bnQiLCJpdGVyYXRpb25SZXNldCIsIm5vZGVJbnN0YW5jZXMiLCJlZGdlSW5zdGFuY2VzIiwibm9kZUNvdW50cyIsImVkZ2VDb3VudHMiLCJ1blNlZW5DbGFzc0lkcyIsInBvcHVsYXRlQ2xhc3NDb3VudHMiLCJpbnN0YW5jZSIsInJhbmRJbmRleCIsImZsb29yIiwicmFuZG9tIiwiZ2V0SW5zdGFuY2VHcmFwaCIsImluc3RhbmNlSWRMaXN0IiwiZXh0cmFOb2RlcyIsImV4dHJhRWRnZXMiLCJncmFwaCIsInNlZWRTaWRlIiwiaXRlckZ1bmMiLCJhTm9kZSIsImlzU2VlZGVkIiwibm9kZUlkIiwiY29ubmVjdHNTb3VyY2UiLCJjb25uZWN0c1RhcmdldCIsIm5vZGVJbnN0YW5jZSIsImR1bW15IiwiZWRnZUluc3RhbmNlIiwic291cmNlTm9kZSIsInRhcmdldE5vZGUiLCJnZXROZXR3b3JrTW9kZWxHcmFwaCIsInJhdyIsImluY2x1ZGVEdW1taWVzIiwiY2xhc3NMb29rdXAiLCJjbGFzc0Nvbm5lY3Rpb25zIiwiY2xhc3NTcGVjIiwiaWQiLCJsb2NhdGlvbiIsImdldFRhYmxlRGVwZW5kZW5jeUdyYXBoIiwidGFibGVMb29rdXAiLCJ0YWJsZUxpbmtzIiwidGFibGVMaXN0IiwidGFibGVTcGVjIiwiZ2V0TW9kZWxEdW1wIiwicmF3T2JqIiwiYUhhc2giLCJiSGFzaCIsImNyZWF0ZVNjaGVtYU1vZGVsIiwibmV3TW9kZWwiLCJjcmVhdGVNb2RlbCIsInNvdXJjZUNsYXNzZXMiLCJ0YXJnZXRDbGFzc2VzIiwidGFibGVEZXBlbmRlbmNpZXMiLCJjb3JlVGFibGVzIiwiTkVYVF9NT0RFTF9JRCIsIk9yaWdyYXBoIiwibG9jYWxTdG9yYWdlIiwicGx1Z2lucyIsImV4aXN0aW5nTW9kZWxzIiwiX2N1cnJlbnRNb2RlbElkIiwicmVnaXN0ZXJQbHVnaW4iLCJwbHVnaW4iLCJjbG9zZUN1cnJlbnRNb2RlbCIsImN1cnJlbnRNb2RlbCIsImxvYWRNb2RlbCIsImN1cnJlbnRNb2RlbElkIiwiZGVsZXRlQWxsTW9kZWxzIiwid2luZG93IiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxjQUFMLEdBQXNCLEVBQXRCO1dBQ0tDLGVBQUwsR0FBdUIsRUFBdkI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNuQixDQUFDQyxLQUFELEVBQVFDLFNBQVIsSUFBcUJILFNBQVMsQ0FBQ0ksS0FBVixDQUFnQixHQUFoQixDQUF6QjtXQUNLUCxjQUFMLENBQW9CSyxLQUFwQixJQUE2QixLQUFLTCxjQUFMLENBQW9CSyxLQUFwQixLQUMzQjtZQUFNO09BRFI7O1VBRUksQ0FBQ0MsU0FBTCxFQUFnQjthQUNUTixjQUFMLENBQW9CSyxLQUFwQixFQUEyQixFQUEzQixFQUErQkcsSUFBL0IsQ0FBb0NKLFFBQXBDO09BREYsTUFFTzthQUNBSixjQUFMLENBQW9CSyxLQUFwQixFQUEyQkMsU0FBM0IsSUFBd0NGLFFBQXhD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
