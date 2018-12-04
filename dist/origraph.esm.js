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

            if (i >= limit) {
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
    if (tableIds.length === 1) {
      yield* this.connectedItems[tableIds[0]] || [];
    } else {
      const thisTableId = tableIds[0];
      const remainingTableIds = tableIds.slice(1);

      for (const item of this.connectedItems[thisTableId] || []) {
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
    this.iterationReset = new Error('Iteration reset');
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
      try {
        temp = await iterator.next();
      } catch (err) {
        // Something went wrong upstream (something that this._iterate
        // depends on was reset or threw a real error)
        if (err === this.iterationReset) {
          this.handleReset(reject);
        } else {
          throw err;
        }
      }

      if (!this._partialCache) {
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
      this._limitPromises[limit].reject(this.iterationReset);

      delete this._limitPromises;
    }

    reject(this.iterationReset);
  }

  async countRows() {
    return (await this.buildCache()).length;
  }

  async _finishItem(wrappedItem) {
    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      wrappedItem.row[attr] = func(wrappedItem);
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

  async getItem(index) {
    if (this._cacheLookup) {
      return this._cache[this._cacheLookup[index]];
    } else if (this._partialCacheLookup && this._partialCacheLookup[index] !== undefined) {
      return this._partialCache[this._partialCacheLookup[index]];
    } // Stupid approach when the cache isn't built: interate until we see the
    // index. Subclasses should override this


    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;

    var _iteratorError;

    try {
      for (var _iterator = _asyncIterator(this.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
        const item = _value;

        if (item.index === index) {
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

  connect(otherTableList) {
    const newTable = this.model.createTable({
      type: 'ConnectedTable'
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

class PromotedTable extends SingleParentMixin(Table) {
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
    return '↦' + this._attribute;
  }

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
      try {
        temp = await iterator.next();
      } catch (err) {
        // Something went wrong upstream (something that this._iterate
        // depends on was reset or threw a real error)
        if (err === this.iterationReset) {
          this.handleReset(reject);
        } else {
          throw err;
        }
      }

      if (!this._partialCache) {
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
            throw _this.iterationReset;
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
    return `[${this._value}]`;
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
    return `ᵀ${this._index}`;
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
          // One of the parent tables was reset, meaning we need to reset as well
          throw _this.iterationReset;
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
    return this.parentTable.name + '*';
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

class ExpandedTable extends SingleParentMixin(Table) {
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
    return '+' + this._attribute;
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
            yield _this._wrap({
              index,
              row,
              itemsToConnect: [wrappedParent]
            });
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

class UnrolledTable extends SingleParentMixin(Table) {
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
    return '_' + this._attribute;
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
              yield _this._wrap({
                index,
                row,
                itemsToConnect: [wrappedParent]
              });
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



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDictTable: StaticDictTable,
  PromotedTable: PromotedTable,
  FacetedTable: FacetedTable,
  ConnectedTable: ConnectedTable,
  TransposedTable: TransposedTable,
  DuplicatedTable: DuplicatedTable,
  ExpandedTable: ExpandedTable,
  UnrolledTable: UnrolledTable
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

  getSampleGraph(options) {
    options.rootClass = this;
    return this.model.getSampleGraph(options);
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

  pairwiseNeighborhood(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this2.edges(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const edge = _value;
          yield* _asyncGeneratorDelegate(_asyncIterator(edge.pairwiseEdges(options)), _awaitAsyncGenerator);
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

      options.targetTableIds = targetEdgeClass.targetTableIds.slice().reverse().concat([targetEdgeClass.tableId]).concat(targetEdgeClass.sourceTableIds);

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

  expand(attribute) {
    const newNodeClass = this._deriveNewClass(this.table.expand(attribute), 'NodeClass');

    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute: null,
      otherAttribute: null
    });
    return newNodeClass;
  }

  unroll(attribute) {
    const newNodeClass = this._deriveNewClass(this.table.unroll(attribute), 'NodeClass');

    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute: null,
      otherAttribute: null
    });
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

  pairwiseEdges(options = {}) {
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
                edge: _this4,
                target
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

  closedFacet(attribute, values) {
    const newClasses = super.closedFacet(attribute, values);

    for (const newClass of newClasses) {
      if (this.sourceClassId) {
        newClass.sourceClassId = this.sourceClassId;
        newClass.sourceTableIds = Array.from(this.sourceTableIds);
        this.sourceClass.edgeClassIds[newClass.classId] = true;
      }

      if (this.targetClassId) {
        newClass.targetClassId = this.targetClassId;
        newClass.targetTableIds = Array.from(this.targetTableIds);
        this.targetClass.edgeClassIds[newClass.classId] = true;
      }
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

          if (_this.sourceClassId) {
            newClass.sourceClassId = _this.sourceClassId;
            newClass.sourceTableIds = Array.from(_this.sourceTableIds);
            _this.sourceClass.edgeClassIds[newClass.classId] = true;
          }

          if (_this.targetClassId) {
            newClass.targetClassId = _this.targetClassId;
            newClass.targetTableIds = Array.from(_this.targetTableIds);
            _this.targetClass.edgeClassIds[newClass.classId] = true;
          }

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

const DATALIB_FORMATS = {
  'json': 'json',
  'csv': 'csv',
  'tsv': 'tsv',
  'topojson': 'topojson',
  'treejson': 'treejson'
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

  async addFileAsStaticTable({
    fileObj,
    encoding = mime.charset(fileObj.type),
    extensionOverride = null,
    skipSizeCheck = false
  } = {}) {
    const fileMB = fileObj.size / 1048576;

    if (fileMB >= 30) {
      if (skipSizeCheck) {
        console.warn(`Attempting to load ${fileMB}MB file into memory`);
      } else {
        throw new Error(`${fileMB}MB file is too large to load statically`);
      }
    } // extensionOverride allows things like topojson or treejson (that don't
    // have standardized mimeTypes) to be parsed correctly


    let text = await new Promise((resolve, reject) => {
      let reader = new this._origraph.FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.readAsText(fileObj, encoding);
    });
    return this.addStringAsStaticTable({
      name: fileObj.name,
      extension: extensionOverride || mime.extension(fileObj.type),
      text
    });
  }

  addStringAsStaticTable({
    name,
    extension,
    text
  }) {
    let data, attributes;

    if (!extension) {
      extension = mime.extension(mime.lookup(name));
    }

    if (DATALIB_FORMATS[extension]) {
      data = datalib.read(text, {
        type: extension
      });

      if (extension === 'csv' || extension === 'tsv') {
        attributes = {};

        for (const attr of data.columns) {
          attributes[attr] = true;
        }

        delete data.columns;
      }
    } else if (extension === 'xml') {
      throw new Error('unimplemented');
    } else if (extension === 'txt') {
      throw new Error('unimplemented');
    } else {
      throw new Error(`Unsupported file extension: ${extension}`);
    }

    return this.addStaticTable({
      name,
      data,
      attributes
    });
  }

  addStaticTable(options) {
    options.type = options.data instanceof Array ? 'StaticTable' : 'StaticDictTable';
    let newTable = this.createTable(options);
    return this.createClass({
      type: 'GenericClass',
      name: options.name,
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

  async getSampleGraph({
    rootClass = null,
    branchLimit = Infinity,
    nodeLimit = Infinity,
    edgeLimit = Infinity,
    tripleLimit = Infinity
  } = {}) {
    const sampleGraph = {
      nodes: [],
      nodeLookup: {},
      edges: [],
      edgeLookup: {},
      links: []
    };
    let numTriples = 0;

    const addNode = node => {
      if (sampleGraph.nodeLookup[node.instanceId] === undefined) {
        sampleGraph.nodeLookup[node.instanceId] = sampleGraph.nodes.length;
        sampleGraph.nodes.push(node);
      }

      return sampleGraph.nodes.length <= nodeLimit;
    };

    const addEdge = edge => {
      if (sampleGraph.edgeLookup[edge.instanceId] === undefined) {
        sampleGraph.edgeLookup[edge.instanceId] = sampleGraph.edges.length;
        sampleGraph.edges.push(edge);
      }

      return sampleGraph.edges.length <= edgeLimit;
    };

    const addTriple = (source, edge, target) => {
      if (addNode(source) && addNode(target) && addEdge(edge)) {
        sampleGraph.links.push({
          source: sampleGraph.nodeLookup[source.instanceId],
          target: sampleGraph.nodeLookup[target.instanceId],
          edge: sampleGraph.edgeLookup[edge.instanceId]
        });
        numTriples++;
        return numTriples <= tripleLimit;
      } else {
        return false;
      }
    };

    let classList = rootClass ? [rootClass] : Object.values(this.classes);

    for (const classObj of classList) {
      if (classObj.type === 'Node') {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(classObj.table.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const node = _value;

            if (!addNode(node)) {
              return sampleGraph;
            }

            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;

            var _iteratorError2;

            try {
              for (var _iterator2 = _asyncIterator(node.pairwiseNeighborhood({
                limit: branchLimit
              })), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                const {
                  source,
                  edge,
                  target
                } = _value2;

                if (!addTriple(source, edge, target)) {
                  return sampleGraph;
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
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;

        var _iteratorError3;

        try {
          for (var _iterator3 = _asyncIterator(classObj.table.iterate()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
            const edge = _value3;

            if (!addEdge(edge)) {
              return sampleGraph;
            }

            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;

            var _iteratorError4;

            try {
              for (var _iterator4 = _asyncIterator(edge.pairwiseEdges({
                limit: branchLimit
              })), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                const {
                  source,
                  target
                } = _value4;

                if (!addTriple(source, edge, target)) {
                  return sampleGraph;
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

    return sampleGraph;
  }

  async getInstanceGraph(instanceIdList) {
    if (!instanceIdList) {
      // Without specified instances, just pick the first 5 from each node
      // and edge class
      instanceIdList = [];

      for (const classObj of Object.values(this.classes)) {
        if (classObj.type === 'Node' || classObj.type === 'Edge') {
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;

          var _iteratorError5;

          try {
            for (var _iterator5 = _asyncIterator(classObj.table.iterate(5)), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
              const item = _value5;
              instanceIdList.push(item.instanceId);
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
      var _iteratorNormalCompletion6 = true;
      var _didIteratorError6 = false;

      var _iteratorError6;

      try {
        for (var _iterator6 = _asyncIterator(edgeInstances[edgeId].nodes()), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
          const node = _value6;

          if (!nodeInstances[node.instanceId]) {
            extraNodes[node.instanceId] = node;
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
    } // Add any edges that connect our nodes


    const extraEdges = {};

    for (const nodeId in nodeInstances) {
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;

      var _iteratorError7;

      try {
        for (var _iterator7 = _asyncIterator(nodeInstances[nodeId].edges()), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
          const edge = _value7;

          if (!edgeInstances[edge.instanceId]) {
            // Check that both ends of the edge connect at least one
            // of our nodes
            let connectsSource = false;
            let connectsTarget = false;
            var _iteratorNormalCompletion8 = true;
            var _didIteratorError8 = false;

            var _iteratorError8;

            try {
              for (var _iterator8 = _asyncIterator(edge.sourceNodes()), _step8, _value8; _step8 = await _iterator8.next(), _iteratorNormalCompletion8 = _step8.done, _value8 = await _step8.value, !_iteratorNormalCompletion8; _iteratorNormalCompletion8 = true) {
                const node = _value8;

                if (nodeInstances[node.instanceId]) {
                  connectsSource = true;
                  break;
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

            var _iteratorNormalCompletion9 = true;
            var _didIteratorError9 = false;

            var _iteratorError9;

            try {
              for (var _iterator9 = _asyncIterator(edge.targetNodes()), _step9, _value9; _step9 = await _iterator9.next(), _iteratorNormalCompletion9 = _step9.done, _value9 = await _step9.value, !_iteratorNormalCompletion9; _iteratorNormalCompletion9 = true) {
                const node = _value9;

                if (nodeInstances[node.instanceId]) {
                  connectsTarget = true;
                  break;
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

            if (connectsSource && connectsTarget) {
              extraEdges[edge.instanceId] = edge;
            }
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
          var _iteratorNormalCompletion10 = true;
          var _didIteratorError10 = false;

          var _iteratorError10;

          try {
            for (var _iterator10 = _asyncIterator(edge.targetNodes()), _step10, _value10; _step10 = await _iterator10.next(), _iteratorNormalCompletion10 = _step10.done, _value10 = await _step10.value, !_iteratorNormalCompletion10; _iteratorNormalCompletion10 = true) {
              const node = _value10;

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
        }
      } else if (!edge.classObj.targetClassId) {
        // Add dummy target nodes
        var _iteratorNormalCompletion11 = true;
        var _didIteratorError11 = false;

        var _iteratorError11;

        try {
          for (var _iterator11 = _asyncIterator(edge.sourceNodes()), _step11, _value11; _step11 = await _iterator11.next(), _iteratorNormalCompletion11 = _step11.done, _value11 = await _step11.value, !_iteratorNormalCompletion11; _iteratorNormalCompletion11 = true) {
            const node = _value11;

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
          _didIteratorError11 = true;
          _iteratorError11 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion11 && _iterator11.return != null) {
              await _iterator11.return();
            }
          } finally {
            if (_didIteratorError11) {
              throw _iteratorError11;
            }
          }
        }
      } else {
        // There should be both source and target nodes for each edge
        var _iteratorNormalCompletion12 = true;
        var _didIteratorError12 = false;

        var _iteratorError12;

        try {
          for (var _iterator12 = _asyncIterator(edge.sourceNodes()), _step12, _value12; _step12 = await _iterator12.next(), _iteratorNormalCompletion12 = _step12.done, _value12 = await _step12.value, !_iteratorNormalCompletion12; _iteratorNormalCompletion12 = true) {
            const sourceNode = _value12;

            if (graph.nodeLookup[sourceNode.instanceId] !== undefined) {
              var _iteratorNormalCompletion13 = true;
              var _didIteratorError13 = false;

              var _iteratorError13;

              try {
                for (var _iterator13 = _asyncIterator(edge.targetNodes()), _step13, _value13; _step13 = await _iterator13.next(), _iteratorNormalCompletion13 = _step13.done, _value13 = await _step13.value, !_iteratorNormalCompletion13; _iteratorNormalCompletion13 = true) {
                  const targetNode = _value13;

                  if (graph.nodeLookup[targetNode.instanceId] !== undefined) {
                    graph.edges.push({
                      edgeInstance: edge,
                      source: graph.nodeLookup[sourceNode.instanceId],
                      target: graph.nodeLookup[targetNode.instanceId]
                    });
                  }
                }
              } catch (err) {
                _didIteratorError13 = true;
                _iteratorError13 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion13 && _iterator13.return != null) {
                    await _iterator13.return();
                  }
                } finally {
                  if (_didIteratorError13) {
                    throw _iteratorError13;
                  }
                }
              }
            }
          }
        } catch (err) {
          _didIteratorError12 = true;
          _iteratorError12 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion12 && _iterator12.return != null) {
              await _iterator12.return();
            }
          } finally {
            if (_didIteratorError12) {
              throw _iteratorError12;
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
  constructor(FileReader, PouchDB) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node

    this.PouchDB = PouchDB; // either pouchdb-browser or pouchdb-node

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
    /*if (this.localStorage) {
      const models = {};
      for (const [modelId, model] of Object.entries(this.models)) {
        models[modelId] = model._toRawObject();
      }
      this.localStorage.setItem('origraph_models', JSON.stringify(models));
      this.trigger('save');
    }*/
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
var version = "0.2.2";
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
	"rollup-plugin-string": "^2.0.2"
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

let origraph = new Origraph(window.FileReader, window.localStorage);
origraph.version = pkg.version;

export default origraph;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL1Byb21vdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0ZhY2V0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvVHJhbnNwb3NlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Db25uZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRHVwbGljYXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gfHxcbiAgICAgICAgeyAnJzogW10gfTtcbiAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0gPSBjYWxsYmFjaztcbiAgICAgIH1cbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10gPSBbXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50LCAuLi5hcmdzKSB7XG4gICAgICBjb25zdCBoYW5kbGVDYWxsYmFjayA9IGNhbGxiYWNrID0+IHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9O1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGZvciAoY29uc3QgbmFtZXNwYWNlIG9mIE9iamVjdC5rZXlzKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSkge1xuICAgICAgICAgIGlmIChuYW1lc3BhY2UgPT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uZm9yRWFjaChoYW5kbGVDYWxsYmFjayk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbmRsZUNhbGxiYWNrKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIHRoaXMudGFibGUgPSBvcHRpb25zLnRhYmxlO1xuICAgIGlmICh0aGlzLmluZGV4ID09PSB1bmRlZmluZWQgfHwgIXRoaXMudGFibGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggYW5kIHRhYmxlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLmNsYXNzT2JqID0gb3B0aW9ucy5jbGFzc09iaiB8fCBudWxsO1xuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IG9wdGlvbnMuY29ubmVjdGVkSXRlbXMgfHwge307XG4gICAgdGhpcy5kdXBsaWNhdGVJdGVtcyA9IG9wdGlvbnMuZHVwbGljYXRlSXRlbXMgfHwgW107XG4gIH1cbiAgcmVnaXN0ZXJEdXBsaWNhdGUgKGl0ZW0pIHtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zLnB1c2goaXRlbSk7XG4gIH1cbiAgY29ubmVjdEl0ZW0gKGl0ZW0pIHtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gPSB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gfHwgW107XG4gICAgaWYgKHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5pbmRleE9mKGl0ZW0pID09PSAtMSkge1xuICAgICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLnB1c2goaXRlbSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZHVwIG9mIHRoaXMuZHVwbGljYXRlSXRlbXMpIHtcbiAgICAgIGl0ZW0uY29ubmVjdEl0ZW0oZHVwKTtcbiAgICAgIGR1cC5jb25uZWN0SXRlbShpdGVtKTtcbiAgICB9XG4gIH1cbiAgZGlzY29ubmVjdCAoKSB7XG4gICAgZm9yIChjb25zdCBpdGVtTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuY29ubmVjdGVkSXRlbXMpKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbUxpc3QpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSAoaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdIHx8IFtdKS5pbmRleE9mKHRoaXMpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IHt9O1xuICB9XG4gIGdldCBpbnN0YW5jZUlkICgpIHtcbiAgICByZXR1cm4gYHtcImNsYXNzSWRcIjpcIiR7dGhpcy5jbGFzc09iai5jbGFzc0lkfVwiLFwiaW5kZXhcIjpcIiR7dGhpcy5pbmRleH1cIn1gO1xuICB9XG4gIGVxdWFscyAoaXRlbSkge1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlSWQgPT09IGl0ZW0uaW5zdGFuY2VJZDtcbiAgfVxuICBhc3luYyAqIGhhbmRsZUxpbWl0IChvcHRpb25zLCBpdGVyYXRvcnMpIHtcbiAgICBsZXQgbGltaXQgPSBJbmZpbml0eTtcbiAgICBpZiAob3B0aW9ucy5saW1pdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsaW1pdCA9IG9wdGlvbnMubGltaXQ7XG4gICAgICBkZWxldGUgb3B0aW9ucy5saW1pdDtcbiAgICB9XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgaXRlcmF0b3Igb2YgaXRlcmF0b3JzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgaXRlcmF0b3IpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgaSsrO1xuICAgICAgICBpZiAoaSA+PSBsaW1pdCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICAvLyBGaXJzdCBtYWtlIHN1cmUgdGhhdCBhbGwgdGhlIHRhYmxlIGNhY2hlcyBoYXZlIGJlZW4gZnVsbHkgYnVpbHQgYW5kXG4gICAgLy8gY29ubmVjdGVkXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwodGFibGVJZHMubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3NPYmoubW9kZWwudGFibGVzW3RhYmxlSWRdLmJ1aWxkQ2FjaGUoKTtcbiAgICB9KSk7XG4gICAgeWllbGQgKiB0aGlzLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpO1xuICB9XG4gICogX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW3RhYmxlSWRzWzBdXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRoaXNUYWJsZUlkID0gdGFibGVJZHNbMF07XG4gICAgICBjb25zdCByZW1haW5pbmdUYWJsZUlkcyA9IHRhYmxlSWRzLnNsaWNlKDEpO1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuY29ubmVjdGVkSXRlbXNbdGhpc1RhYmxlSWRdIHx8IFtdKSB7XG4gICAgICAgIHlpZWxkICogaXRlbS5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHJlbWFpbmluZ1RhYmxlSWRzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBUYWJsZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMubW9kZWwgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG5cbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzID0gb3B0aW9ucy5kZXJpdmVkVGFibGVzIHx8IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIHx8IHt9KSkge1xuICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLnN1cHByZXNzZWRBdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSAhIW9wdGlvbnMuc3VwcHJlc3NJbmRleDtcblxuICAgIHRoaXMuX2luZGV4RmlsdGVyID0gKG9wdGlvbnMuaW5kZXhGaWx0ZXIgJiYgdGhpcy5oeWRyYXRlRnVuY3Rpb24ob3B0aW9ucy5pbmRleEZpbHRlcikpIHx8IG51bGw7XG4gICAgdGhpcy5fYXR0cmlidXRlRmlsdGVycyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5hdHRyaWJ1dGVGaWx0ZXJzIHx8IHt9KSkge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fbGltaXRQcm9taXNlcyA9IHt9O1xuXG4gICAgdGhpcy5pdGVyYXRpb25SZXNldCA9IG5ldyBFcnJvcignSXRlcmF0aW9uIHJlc2V0Jyk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaGFzIGFscmVhZHkgYmVlbiBidWlsdDsganVzdCBncmFiIGRhdGEgZnJvbSBpdCBkaXJlY3RseVxuICAgICAgeWllbGQgKiB0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGUgJiYgdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkLCBidXQgaXQncyBhbHJlYWR5IGxvbmcgZW5vdWdoIHRvIHNhdGlzZnkgdGhpc1xuICAgICAgLy8gcmVxdWVzdFxuICAgICAgeWllbGQgKiB0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQgYnVpbGRpbmcgKGFuZCBtYXliZSBkaWRuJ3QgZXZlbiBzdGFydCB5ZXQpO1xuICAgICAgLy8ga2ljayBpdCBvZmYsIGFuZCB0aGVuIHdhaXQgZm9yIGVub3VnaCBpdGVtcyB0byBiZSBwcm9jZXNzZWQgdG8gc2F0aXNmeVxuICAgICAgLy8gdGhlIGxpbWl0XG4gICAgICB0aGlzLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIHlpZWxkICogYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSA9IHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdIHx8IFtdO1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIFNvbWV0aGluZyB3ZW50IHdyb25nIHVwc3RyZWFtIChzb21ldGhpbmcgdGhhdCB0aGlzLl9pdGVyYXRlXG4gICAgICAgIC8vIGRlcGVuZHMgb24gd2FzIHJlc2V0IG9yIHRocmV3IGEgcmVhbCBlcnJvcilcbiAgICAgICAgaWYgKGVyciA9PT0gdGhpcy5pdGVyYXRpb25SZXNldCkge1xuICAgICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAvLyB0aGF0IHdhcyB3YWl0aW5nIG9uIHVzIGtub3cgdGhhdCB3ZSBjYW4ndCBjb21wbHlcbiAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKSkge1xuICAgICAgICAgIC8vIE9rYXksIHRoaXMgaXRlbSBwYXNzZWQgYWxsIGZpbHRlcnMsIGFuZCBpcyByZWFkeSB0byBiZSBzZW50IG91dFxuICAgICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW3RlbXAudmFsdWUuaW5kZXhdID0gdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aDtcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGRhdGEgbm93IHRvIHNhdGlzZnkgYW55IHdhaXRpbmcgcmVxdWVzdHNcbiAgICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gRG9uZSBpdGVyYXRpbmchIFdlIGNhbiBncmFkdWF0ZSB0aGUgcGFydGlhbCBjYWNoZSAvIGxvb2t1cHMgaW50b1xuICAgIC8vIGZpbmlzaGVkIG9uZXMsIGFuZCBzYXRpc2Z5IGFsbCB0aGUgcmVxdWVzdHNcbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIHRoaXMuX2NhY2hlTG9va3VwID0gdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIHRoaXMudHJpZ2dlcignY2FjaGVCdWlsdCcpO1xuICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICB9XG4gIGJ1aWxkQ2FjaGUgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuX2NhY2hlUHJvbWlzZSkge1xuICAgICAgdGhpcy5fY2FjaGVQcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyBUaGUgc2V0VGltZW91dCBoZXJlIGlzIGFic29sdXRlbHkgbmVjZXNzYXJ5LCBvciB0aGlzLl9jYWNoZVByb21pc2VcbiAgICAgICAgLy8gd29uJ3QgYmUgc3RvcmVkIGluIHRpbWUgZm9yIHRoZSBuZXh0IGJ1aWxkQ2FjaGUoKSBjYWxsIHRoYXQgY29tZXNcbiAgICAgICAgLy8gdGhyb3VnaFxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICB0aGlzLl9idWlsZENhY2hlKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGhhbmRsZVJlc2V0IChyZWplY3QpIHtcbiAgICBmb3IgKGNvbnN0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5yZWplY3QodGhpcy5pdGVyYXRpb25SZXNldCk7XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlcztcbiAgICB9XG4gICAgcmVqZWN0KHRoaXMuaXRlcmF0aW9uUmVzZXQpO1xuICB9XG4gIGFzeW5jIGNvdW50Um93cyAoKSB7XG4gICAgcmV0dXJuIChhd2FpdCB0aGlzLmJ1aWxkQ2FjaGUoKSkubGVuZ3RoO1xuICB9XG4gIGFzeW5jIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHdyYXBwZWRJdGVtLnJvdykge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBkZWxldGUgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICBsZXQga2VlcCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBrZWVwID0gdGhpcy5faW5kZXhGaWx0ZXIod3JhcHBlZEl0ZW0uaW5kZXgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAga2VlcCA9IGtlZXAgJiYgYXdhaXQgZnVuYyhhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cl0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IG90aGVySXRlbSBvZiBvcHRpb25zLml0ZW1zVG9Db25uZWN0IHx8IFtdKSB7XG4gICAgICB3cmFwcGVkSXRlbS5jb25uZWN0SXRlbShvdGhlckl0ZW0pO1xuICAgICAgb3RoZXJJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBnZXRJbmRleERldGFpbHMgKCkge1xuICAgIGNvbnN0IGRldGFpbHMgPSB7IG5hbWU6IG51bGwgfTtcbiAgICBpZiAodGhpcy5fc3VwcHJlc3NJbmRleCkge1xuICAgICAgZGV0YWlscy5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBkZXRhaWxzLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGRldGFpbHM7XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZXhwZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ub2JzZXJ2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmRlcml2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0QXR0cmlidXRlRGV0YWlscygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIC8vIEFsbG93IHByb2JpbmcgdG8gc2VlIHdoYXRldmVyIGRhdGEgaGFwcGVucyB0byBiZSBhdmFpbGFibGVcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IFtdLFxuICAgICAgbG9va3VwOiB0aGlzLl9jYWNoZUxvb2t1cCB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgYXN5bmMgZ2V0SXRlbSAoaW5kZXgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVMb29rdXApIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVt0aGlzLl9jYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlTG9va3VwICYmIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3BhcnRpYWxDYWNoZVt0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbaW5kZXhdXTtcbiAgICB9XG4gICAgLy8gU3R1cGlkIGFwcHJvYWNoIHdoZW4gdGhlIGNhY2hlIGlzbid0IGJ1aWx0OiBpbnRlcmF0ZSB1bnRpbCB3ZSBzZWUgdGhlXG4gICAgLy8gaW5kZXguIFN1YmNsYXNzZXMgc2hvdWxkIG92ZXJyaWRlIHRoaXNcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChpdGVtLmluZGV4ID09PSBpbmRleCkge1xuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHN1cHByZXNzQXR0cmlidXRlIChhdHRyaWJ1dGUpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFkZEZpbHRlciAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdQcm9tb3RlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnVW5yb2xsZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGR1cGxpY2F0ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdEdXBsaWNhdGVkVGFibGUnXG4gICAgfSk7XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUoe1xuICAgICAgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJ1xuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIGdldCBjbGFzc09iaiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZSA9PT0gdGhpcztcbiAgICB9KTtcbiAgfVxuICBnZXQgcGFyZW50VGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLnRhYmxlcykucmVkdWNlKChhZ2csIHRhYmxlT2JqKSA9PiB7XG4gICAgICBpZiAodGFibGVPYmouX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXSkge1xuICAgICAgICBhZ2cucHVzaCh0YWJsZU9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKTtcbiAgfVxuICBnZXQgZGVyaXZlZFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXTtcbiAgICB9KTtcbiAgfVxuICBnZXQgaW5Vc2UgKCkge1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5zb21lKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZUlkID09PSB0aGlzLnRhYmxlSWQgfHxcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMSB8fFxuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUYWJsZSwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVGFibGUvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IFtdO1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3RUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9uYW1lO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdFRhYmxlO1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aXJlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBQcm9tb3RlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gJ+KGpicgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgYXN5bmMgX2J1aWxkQ2FjaGUgKHJlc29sdmUsIHJlamVjdCkge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugd2UgZG9uJ3QgYWN0dWFsbHkgd2FudCB0byBjYWxsIF9maW5pc2hJdGVtXG4gICAgLy8gdW50aWwgYWxsIHVuaXF1ZSB2YWx1ZXMgaGF2ZSBiZWVuIHNlZW5cbiAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXAgPSB7fTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgPSB7fTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUoKTtcbiAgICBsZXQgdGVtcCA9IHsgZG9uZTogZmFsc2UgfTtcbiAgICB3aGlsZSAoIXRlbXAuZG9uZSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBTb21ldGhpbmcgd2VudCB3cm9uZyB1cHN0cmVhbSAoc29tZXRoaW5nIHRoYXQgdGhpcy5faXRlcmF0ZVxuICAgICAgICAvLyBkZXBlbmRzIG9uIHdhcyByZXNldCBvciB0aHJldyBhIHJlYWwgZXJyb3IpXG4gICAgICAgIGlmIChlcnIgPT09IHRoaXMuaXRlcmF0aW9uUmVzZXQpIHtcbiAgICAgICAgICB0aGlzLmhhbmRsZVJlc2V0KHJlamVjdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW3RlbXAudmFsdWUuaW5kZXhdID0gdGhpcy5fdW5maW5pc2hlZENhY2hlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdW5maW5pc2hlZENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIE9rYXksIG5vdyB3ZSd2ZSBzZWVuIGV2ZXJ5dGhpbmc7IHdlIGNhbiBjYWxsIF9maW5pc2hJdGVtIG9uIGVhY2ggb2YgdGhlXG4gICAgLy8gdW5pcXVlIHZhbHVlc1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHRoaXMuX3VuZmluaXNoZWRDYWNoZSkge1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odmFsdWUpKSB7XG4gICAgICAgIC8vIE9rYXksIHRoaXMgaXRlbSBwYXNzZWQgYWxsIGZpbHRlcnMsIGFuZCBpcyByZWFkeSB0byBiZSBzZW50IG91dFxuICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbdmFsdWUuaW5kZXhdID0gdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godmFsdWUpO1xuICAgICAgICBpKys7XG4gICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGRhdGEgbm93IHRvIHNhdGlzZnkgYW55IHdhaXRpbmcgcmVxdWVzdHNcbiAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICAgICAgICByZXNvbHZlKHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBEb25lIGl0ZXJhdGluZyEgV2UgY2FuIGdyYWR1YXRlIHRoZSBwYXJ0aWFsIGNhY2hlIC8gbG9va3VwcyBpbnRvXG4gICAgLy8gZmluaXNoZWQgb25lcywgYW5kIHNhdGlzZnkgYWxsIHRoZSByZXF1ZXN0c1xuICAgIGRlbGV0ZSB0aGlzLl91bmZpbmlzaGVkQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cDtcbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIHRoaXMuX2NhY2hlTG9va3VwID0gdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIHRoaXMudHJpZ2dlcignY2FjaGVCdWlsdCcpO1xuICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IFN0cmluZyhhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQhXG4gICAgICAgIHRocm93IHRoaXMuaXRlcmF0aW9uUmVzZXQ7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0l0ZW0gPSB0aGlzLl91bmZpbmlzaGVkQ2FjaGVbdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW2luZGV4XV07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZSArIHRoaXMuX3ZhbHVlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYFske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAvLyBOb3JtYWwgZmFjZXRpbmcganVzdCBnaXZlcyBhIHN1YnNldCBvZiB0aGUgb3JpZ2luYWwgdGFibGVcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogT2JqZWN0LmFzc2lnbih7fSwgd3JhcHBlZFBhcmVudC5yb3cpLFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGYWNldGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIFRyYW5zcG9zZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5faW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIGlmICh0aGlzLl9pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmluZGV4ID0gdGhpcy5faW5kZXg7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9pbmRleDtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGDhtYAke3RoaXMuX2luZGV4fWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGF3YWl0IHRoaXMucGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuXG4gICAgLy8gSXRlcmF0ZSB0aGUgcm93J3MgYXR0cmlidXRlcyBhcyBpbmRleGVzXG4gICAgY29uc3Qgd3JhcHBlZFBhcmVudCA9IHRoaXMucGFyZW50VGFibGUuX2NhY2hlW3RoaXMucGFyZW50VGFibGUuX2NhY2hlTG9va3VwW3RoaXMuX2luZGV4XV0gfHwgeyByb3c6IHt9IH07XG4gICAgZm9yIChjb25zdCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgcm93OiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gdmFsdWUgOiB7IHZhbHVlIH0sXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVHJhbnNwb3NlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLmdldFNvcnRIYXNoKCkpLmpvaW4oJywnKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBEb24ndCB0cnkgdG8gY29ubmVjdCB2YWx1ZXMgdW50aWwgYWxsIG9mIHRoZSBwYXJlbnQgdGFibGVzJyBjYWNoZXMgYXJlXG4gICAgLy8gYnVpbHQ7IFRPRE86IG1pZ2h0IGJlIGFibGUgdG8gZG8gc29tZXRoaW5nIG1vcmUgcmVzcG9uc2l2ZSBoZXJlP1xuICAgIGF3YWl0IFByb21pc2UuYWxsKHBhcmVudFRhYmxlcy5tYXAocFRhYmxlID0+IHBUYWJsZS5idWlsZENhY2hlKCkpKTtcblxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlTG9va3VwKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVMb29rdXApKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQsIG1lYW5pbmcgd2UgbmVlZCB0byByZXNldCBhcyB3ZWxsXG4gICAgICAgIHRocm93IHRoaXMuaXRlcmF0aW9uUmVzZXQ7XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XV0pXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRHVwbGljYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAnKic7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIC8vIFlpZWxkIHRoZSBzYW1lIGl0ZW1zIHdpdGggdGhlIHNhbWUgY29ubmVjdGlvbnMsIGJ1dCB3cmFwcGVkIGFuZCBmaW5pc2hlZFxuICAgIC8vIGJ5IHRoaXMgdGFibGVcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5wYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXg6IGl0ZW0uaW5kZXgsXG4gICAgICAgIHJvdzogaXRlbS5yb3csXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBPYmplY3QudmFsdWVzKGl0ZW0uY29ubmVjdGVkSXRlbXMpLnJlZHVjZSgoYWdnLCBpdGVtTGlzdCkgPT4ge1xuICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KGl0ZW1MaXN0KTtcbiAgICAgICAgfSwgW10pXG4gICAgICB9KTtcbiAgICAgIGl0ZW0ucmVnaXN0ZXJEdXBsaWNhdGUobmV3SXRlbSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRHVwbGljYXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gJysnICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHJvdyA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93ICE9PSB1bmRlZmluZWQgJiYgcm93ICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHJvdykubGVuZ3RoID4gMCkge1xuICAgICAgICB5aWVsZCB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3csXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgVW5yb2xsZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuICdfJyArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCByb3dzID0gd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXTtcbiAgICAgIGlmIChyb3dzICE9PSB1bmRlZmluZWQgJiYgcm93cyAhPT0gbnVsbCAmJlxuICAgICAgICAgIHR5cGVvZiByb3dzW1N5bWJvbC5pdGVyYXRvcl0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZm9yIChjb25zdCByb3cgb2Ygcm93cykge1xuICAgICAgICAgIHlpZWxkIHRoaXMuX3dyYXAoe1xuICAgICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgICByb3csXG4gICAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpbmRleCsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBVbnJvbGxlZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9uc1xuICAgIH07XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUgKyB0aGlzLmNsYXNzTmFtZTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlTmV3Q2xhc3MgKG5ld1RhYmxlLCB0eXBlID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGVcbiAgICB9KTtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCwgJ0dlbmVyaWNDbGFzcycpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSkpO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUudW5yb2xsKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuVHJhbnNwb3NlKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXRTYW1wbGVHcmFwaCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMucm9vdENsYXNzID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5nZXRTYW1wbGVHcmFwaChvcHRpb25zKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0ge30pIHtcbiAgICBsZXQgZWRnZUlkcyA9IG9wdGlvbnMuY2xhc3Nlc1xuICAgICAgPyBvcHRpb25zLmNsYXNzZXMubWFwKGNsYXNzT2JqID0+IGNsYXNzT2JqLmNsYXNzSWQpXG4gICAgICA6IG9wdGlvbnMuY2xhc3NJZHMgfHwgT2JqZWN0LmtleXModGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IGl0ZXJhdG9ycyA9IFtdO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIGVkZ2VJZHMpIHtcbiAgICAgIGlmICghdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHNbZWRnZUlkXSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuY2xhc3NPYmoubW9kZWwuY2xhc3Nlc1tlZGdlSWRdO1xuICAgICAgY29uc3Qgcm9sZSA9IHRoaXMuY2xhc3NPYmouZ2V0RWRnZVJvbGUoZWRnZUNsYXNzKTtcbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAndGFyZ2V0Jykge1xuICAgICAgICBjb25zdCB0YWJsZUlkcyA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGl0ZXJhdG9ycy5wdXNoKHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBpdGVyYXRvcnMpO1xuICB9XG4gIGFzeW5jICogcGFpcndpc2VOZWlnaGJvcmhvb2QgKG9wdGlvbnMgPSB7fSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiB0aGlzLmVkZ2VzKG9wdGlvbnMpKSB7XG4gICAgICB5aWVsZCAqIGVkZ2UucGFpcndpc2VFZGdlcyhvcHRpb25zKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBOb2RlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgfVxuICAqIGVkZ2VDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgZ2V0RWRnZVJvbGUgKGVkZ2VDbGFzcykge1xuICAgIGlmICghdGhpcy5lZGdlQ2xhc3NJZHNbZWRnZUNsYXNzLmNsYXNzSWRdKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIHJldHVybiAnYm90aCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3NvdXJjZSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICByZXR1cm4gJ3RhcmdldCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW50ZXJuYWwgbWlzbWF0Y2ggYmV0d2VlbiBub2RlIGFuZCBlZGdlIGNsYXNzSWRzYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IE5vZGVXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKHsgYXV0b2Nvbm5lY3QgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgaWYgKCFhdXRvY29ubmVjdCB8fCBlZGdlQ2xhc3NJZHMubGVuZ3RoID4gMikge1xuICAgICAgLy8gSWYgdGhlcmUgYXJlIG1vcmUgdGhhbiB0d28gZWRnZXMsIGJyZWFrIGFsbCBjb25uZWN0aW9ucyBhbmQgbWFrZVxuICAgICAgLy8gdGhpcyBhIGZsb2F0aW5nIGVkZ2UgKGZvciBub3csIHdlJ3JlIG5vdCBkZWFsaW5nIGluIGh5cGVyZWRnZXMpXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gV2l0aCBvbmx5IG9uZSBjb25uZWN0aW9uLCB0aGlzIG5vZGUgc2hvdWxkIGJlY29tZSBhIHNlbGYtZWRnZVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAvLyBBcmUgd2UgdGhlIHNvdXJjZSBvciB0YXJnZXQgb2YgdGhlIGV4aXN0aW5nIGVkZ2UgKGludGVybmFsbHksIGluIHRlcm1zXG4gICAgICAvLyBvZiBzb3VyY2VJZCAvIHRhcmdldElkLCBub3QgZWRnZUNsYXNzLmRpcmVjdGlvbik/XG4gICAgICBjb25zdCBpc1NvdXJjZSA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQ7XG5cbiAgICAgIC8vIEFzIHdlJ3JlIGNvbnZlcnRlZCB0byBhbiBlZGdlLCBvdXIgbmV3IHJlc3VsdGluZyBzb3VyY2UgQU5EIHRhcmdldFxuICAgICAgLy8gc2hvdWxkIGJlIHdoYXRldmVyIGlzIGF0IHRoZSBvdGhlciBlbmQgb2YgZWRnZUNsYXNzIChpZiBhbnl0aGluZylcbiAgICAgIGlmIChpc1NvdXJjZSkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgICAgfVxuICAgICAgLy8gSWYgdGhlcmUgaXMgYSBub2RlIGNsYXNzIG9uIHRoZSBvdGhlciBlbmQgb2YgZWRnZUNsYXNzLCBhZGQgb3VyXG4gICAgICAvLyBpZCB0byBpdHMgbGlzdCBvZiBjb25uZWN0aW9uc1xuICAgICAgY29uc3Qgbm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF07XG4gICAgICBpZiAobm9kZUNsYXNzKSB7XG4gICAgICAgIG5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIHRhYmxlSWQgbGlzdHMgc2hvdWxkIGVtYW5hdGUgb3V0IGZyb20gdGhlIChuZXcpIGVkZ2UgdGFibGU7IGFzc3VtaW5nXG4gICAgICAvLyAoZm9yIGEgbW9tZW50KSB0aGF0IGlzU291cmNlID09PSB0cnVlLCB3ZSdkIGNvbnN0cnVjdCB0aGUgdGFibGVJZCBsaXN0XG4gICAgICAvLyBsaWtlIHRoaXM6XG4gICAgICBsZXQgdGFibGVJZExpc3QgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIGVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmICghaXNTb3VyY2UpIHtcbiAgICAgICAgLy8gV2hvb3BzLCBnb3QgaXQgYmFja3dhcmRzIVxuICAgICAgICB0YWJsZUlkTGlzdC5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZWRnZUNsYXNzLmRpcmVjdGVkO1xuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YWJsZUlkTGlzdDtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgIC8vIE9rYXksIHdlJ3ZlIGdvdCB0d28gZWRnZXMsIHNvIHRoaXMgaXMgYSBsaXR0bGUgbW9yZSBzdHJhaWdodGZvcndhcmRcbiAgICAgIGxldCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIGxldCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgIC8vIEZpZ3VyZSBvdXQgdGhlIGRpcmVjdGlvbiwgaWYgdGhlcmUgaXMgb25lXG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLmRpcmVjdGVkICYmIHRhcmdldEVkZ2VDbGFzcy5kaXJlY3RlZCkge1xuICAgICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGhhcHBlbmVkIHRvIGdldCB0aGUgZWRnZXMgaW4gb3JkZXI7IHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBnb3QgdGhlIGVkZ2VzIGJhY2t3YXJkczsgc3dhcCB0aGVtIGFuZCBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgICAgIHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBub3cgd2Uga25vdyBob3cgdG8gc2V0IHNvdXJjZSAvIHRhcmdldCBpZHNcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAvLyBBZGQgdGhpcyBjbGFzcyB0byB0aGUgc291cmNlJ3MgLyB0YXJnZXQncyBlZGdlQ2xhc3NJZHNcbiAgICAgIHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnRhcmdldENsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIC8vIENvbmNhdGVuYXRlIHRoZSBpbnRlcm1lZGlhdGUgdGFibGVJZCBsaXN0cywgZW1hbmF0aW5nIG91dCBmcm9tIHRoZVxuICAgICAgLy8gKG5ldykgZWRnZSB0YWJsZVxuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgc291cmNlRWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChzb3VyY2VFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFyZ2V0RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyB0YXJnZXRFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAodGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnRhcmdldFRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIC8vIERpc2Nvbm5lY3QgdGhlIGV4aXN0aW5nIGVkZ2UgY2xhc3NlcyBmcm9tIHRoZSBuZXcgKG5vdyBlZGdlKSBjbGFzc1xuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzSWRzO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBhdHRyaWJ1dGUsIG90aGVyQXR0cmlidXRlIH0pIHtcbiAgICBsZXQgdGhpc0hhc2gsIG90aGVySGFzaCwgc291cmNlVGFibGVJZHMsIHRhcmdldFRhYmxlSWRzO1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXNIYXNoID0gdGhpcy50YWJsZTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXNIYXNoID0gdGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSk7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFsgdGhpc0hhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBpZiAob3RoZXJBdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGUucHJvbW90ZShvdGhlckF0dHJpYnV0ZSk7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFsgb3RoZXJIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzSGFzaC5jb25uZWN0KFtvdGhlckhhc2hdKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldFRhYmxlSWRzXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdFZGdlQ2xhc3M7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKSwgJ05vZGVDbGFzcycpO1xuICAgIHRoaXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBuZXdOb2RlQ2xhc3MsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IG5ld05vZGVDbGFzcyxcbiAgICAgIGF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUudW5yb2xsKGF0dHJpYnV0ZSksICdOb2RlQ2xhc3MnKTtcbiAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgYXR0cmlidXRlOiBudWxsLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIHByb2plY3ROZXdFZGdlIChjbGFzc0lkTGlzdCkge1xuICAgIGNvbnN0IGNsYXNzTGlzdCA9IGNsYXNzSWRMaXN0Lm1hcChjbGFzc0lkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLmNsYXNzZXNbY2xhc3NJZF07XG4gICAgfSk7XG4gICAgaWYgKGNsYXNzTGlzdC5sZW5ndGggPCAyIHx8IGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0udHlwZSAhPT0gJ05vZGUnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY2xhc3NJZExpc3RgKTtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlQ2xhc3NJZCA9IHRoaXMuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzc0lkID0gY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgY29uc3QgdGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICBsZXQgdGFibGVJZDtcbiAgICBjb25zdCBtaWRkbGVJbmRleCA9IE1hdGguZmxvb3IoKGNsYXNzTGlzdC5sZW5ndGggLSAxKSAvIDIpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2xhc3NMaXN0Lmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgaWYgKGkgPCBtaWRkbGVJbmRleCkge1xuICAgICAgICBpZiAoY2xhc3NMaXN0W2ldLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICAgIHNvdXJjZVRhYmxlSWRzLnVuc2hpZnQoY2xhc3NMaXN0W2ldLnRhYmxlSWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHRlbXAgPSBBcnJheS5mcm9tKGNsYXNzTGlzdFtpXS5zb3VyY2VUYWJsZUlkcykucmV2ZXJzZSgpO1xuICAgICAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiB0ZW1wKSB7XG4gICAgICAgICAgICBzb3VyY2VUYWJsZUlkcy51bnNoaWZ0KHRhYmxlSWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGNsYXNzTGlzdFtpXS50YWJsZUlkKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgY2xhc3NMaXN0W2ldLnRhcmdldFRhYmxlSWRzKSB7XG4gICAgICAgICAgICBzb3VyY2VUYWJsZUlkcy51bnNoaWZ0KHRhYmxlSWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChpID09PSBtaWRkbGVJbmRleCkge1xuICAgICAgICB0YWJsZUlkID0gY2xhc3NMaXN0W2ldLnRhYmxlLmR1cGxpY2F0ZSgpLnRhYmxlSWQ7XG4gICAgICAgIGlmIChjbGFzc0xpc3RbaV0udHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgICAgY29uc3QgdGVtcCA9IEFycmF5LmZyb20oY2xhc3NMaXN0W2ldLnNvdXJjZVRhYmxlSWRzKS5yZXZlcnNlKCk7XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIHRlbXApIHtcbiAgICAgICAgICAgIHNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc0xpc3RbaV0udGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgICAgIHRhcmdldFRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoY2xhc3NMaXN0W2ldLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICAgIHRhcmdldFRhYmxlSWRzLnVuc2hpZnQoY2xhc3NMaXN0W2ldLnRhYmxlSWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHRlbXAgPSBBcnJheS5mcm9tKGNsYXNzTGlzdFtpXS5zb3VyY2VUYWJsZUlkcykucmV2ZXJzZSgpO1xuICAgICAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiB0ZW1wKSB7XG4gICAgICAgICAgICB0YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRhYmxlSWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0YXJnZXRUYWJsZUlkcy51bnNoaWZ0KGNsYXNzTGlzdFtpXS50YWJsZUlkKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgY2xhc3NMaXN0W2ldLnRhcmdldFRhYmxlSWRzKSB7XG4gICAgICAgICAgICB0YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRhYmxlSWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkLFxuICAgICAgdGFyZ2V0Q2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzLFxuICAgICAgdGFyZ2V0VGFibGVJZHNcbiAgICB9KTtcbiAgfVxuICBkaXNjb25uZWN0QWxsRWRnZXMgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiB0aGlzLmNvbm5lY3RlZENsYXNzZXMoKSkge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2Uob3B0aW9ucyk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogc291cmNlTm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlVGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZF0udGFibGVJZDtcbiAgICBjb25zdCB0YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmouc291cmNlVGFibGVJZHMuY29uY2F0KFsgc291cmNlVGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkXS50YWJsZUlkO1xuICAgIGNvbnN0IHRhYmxlSWRzID0gdGhpcy5jbGFzc09iai50YXJnZXRUYWJsZUlkcy5jb25jYXQoWyB0YXJnZXRUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIG5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSxcbiAgICAgIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlRWRnZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucykpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucykpIHtcbiAgICAgICAgeWllbGQgeyBzb3VyY2UsIGVkZ2U6IHRoaXMsIHRhcmdldCB9O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuaW1wb3J0IEVkZ2VXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIC8vIHNvdXJjZVRhYmxlSWRzIGFuZCB0YXJnZXRUYWJsZUlkcyBhcmUgbGlzdHMgb2YgYW55IGludGVybWVkaWF0ZSB0YWJsZXMsXG4gICAgLy8gYmVnaW5uaW5nIHdpdGggdGhlIGVkZ2UgdGFibGUgKGJ1dCBub3QgaW5jbHVkaW5nIGl0KSwgdGhhdCBsZWFkIHRvIHRoZVxuICAgIC8vIHNvdXJjZSAvIHRhcmdldCBub2RlIHRhYmxlcyAoYnV0IG5vdCBpbmNsdWRpbmcpIHRob3NlXG5cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8XG4gICAgICAoKHRoaXMuc291cmNlQ2xhc3MgJiYgdGhpcy5zb3VyY2VDbGFzcy5jbGFzc05hbWUpIHx8ICc/JykgK1xuICAgICAgJy0nICtcbiAgICAgICgodGhpcy50YXJnZXRDbGFzcyAmJiB0aGlzLnRhcmdldENsYXNzLmNsYXNzTmFtZSkgfHwgJz8nKTtcbiAgfVxuICBnZXQgc291cmNlQ2xhc3MgKCkge1xuICAgIHJldHVybiAodGhpcy5zb3VyY2VDbGFzc0lkICYmIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdKSB8fCBudWxsO1xuICB9XG4gIGdldCB0YXJnZXRDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnRhcmdldENsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC5zb3VyY2VUYWJsZUlkcyA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldFRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEVkZ2VXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIF9zcGxpdFRhYmxlSWRMaXN0ICh0YWJsZUlkTGlzdCwgb3RoZXJDbGFzcykge1xuICAgIGxldCByZXN1bHQgPSB7XG4gICAgICBub2RlVGFibGVJZExpc3Q6IFtdLFxuICAgICAgZWRnZVRhYmxlSWQ6IG51bGwsXG4gICAgICBlZGdlVGFibGVJZExpc3Q6IFtdXG4gICAgfTtcbiAgICBpZiAodGFibGVJZExpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBXZWlyZCBjb3JuZXIgY2FzZSB3aGVyZSB3ZSdyZSB0cnlpbmcgdG8gY3JlYXRlIGFuIGVkZ2UgYmV0d2VlblxuICAgICAgLy8gYWRqYWNlbnQgb3IgaWRlbnRpY2FsIHRhYmxlcy4uLiBjcmVhdGUgYSBDb25uZWN0ZWRUYWJsZVxuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGhpcy50YWJsZS5jb25uZWN0KG90aGVyQ2xhc3MudGFibGUpLnRhYmxlSWQ7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgYSB0YWJsZSBpbiB0aGUgbWlkZGxlIGFzIHRoZSBuZXcgZWRnZSB0YWJsZTsgcHJpb3JpdGl6ZVxuICAgICAgLy8gU3RhdGljVGFibGUgYW5kIFN0YXRpY0RpY3RUYWJsZVxuICAgICAgbGV0IHN0YXRpY0V4aXN0cyA9IGZhbHNlO1xuICAgICAgbGV0IHRhYmxlRGlzdGFuY2VzID0gdGFibGVJZExpc3QubWFwKCh0YWJsZUlkLCBpbmRleCkgPT4ge1xuICAgICAgICBzdGF0aWNFeGlzdHMgPSBzdGF0aWNFeGlzdHMgfHwgdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgcmV0dXJuIHsgdGFibGVJZCwgaW5kZXgsIGRpc3Q6IE1hdGguYWJzKHRhYmxlSWRMaXN0IC8gMiAtIGluZGV4KSB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIHRhYmxlRGlzdGFuY2VzID0gdGFibGVEaXN0YW5jZXMuZmlsdGVyKCh7IHRhYmxlSWQgfSkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHsgdGFibGVJZCwgaW5kZXggfSA9IHRhYmxlRGlzdGFuY2VzLnNvcnQoKGEsIGIpID0+IGEuZGlzdCAtIGIuZGlzdClbMF07XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0YWJsZUlkO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKDAsIGluZGV4KS5yZXZlcnNlKCk7XG4gICAgICByZXN1bHQubm9kZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoaW5kZXggKyAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICB0ZW1wLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICB0ZW1wLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh0ZW1wKTtcblxuICAgIGlmICh0ZW1wLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RlbXAuc291cmNlQ2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC5zb3VyY2VUYWJsZUlkcywgc291cmNlQ2xhc3MpO1xuICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IHRlbXAuc291cmNlQ2xhc3NJZCxcbiAgICAgICAgc291cmNlVGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0ZW1wLnRhcmdldENsYXNzSWQgJiYgdGVtcC5zb3VyY2VDbGFzc0lkICE9PSB0ZW1wLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RlbXAudGFyZ2V0Q2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC50YXJnZXRUYWJsZUlkcywgdGFyZ2V0Q2xhc3MpO1xuICAgICAgY29uc3QgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiB0ZW1wLnRhcmdldENsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBub2RlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLnNpZGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2Uob3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLnNpZGUgPT09ICd0YXJnZXQnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUG9saXRpY2FsT3V0c2lkZXJFcnJvcjogXCIke29wdGlvbnMuc2lkZX1cIiBpcyBhbiBpbnZhbGlkIHNpZGVgKTtcbiAgICB9XG4gIH1cbiAgdG9nZ2xlRGlyZWN0aW9uIChkaXJlY3RlZCkge1xuICAgIGlmIChkaXJlY3RlZCA9PT0gZmFsc2UgfHwgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBkZWxldGUgdGhpcy5zd2FwcGVkRGlyZWN0aW9uO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuZGlyZWN0ZWQpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERpcmVjdGVkIHdhcyBhbHJlYWR5IHRydWUsIGp1c3Qgc3dpdGNoIHNvdXJjZSBhbmQgdGFyZ2V0XG4gICAgICBsZXQgdGVtcCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IHRlbXA7XG4gICAgICB0ZW1wID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IHRlbXA7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RTb3VyY2UgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgfVxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUucHJvbW90ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyBzb3VyY2VDbGFzcy50YWJsZSA6IHNvdXJjZUNsYXNzLnRhYmxlLnByb21vdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLnByb21vdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gdGFyZ2V0Q2xhc3MudGFibGUgOiB0YXJnZXRDbGFzcy50YWJsZS5wcm9tb3RlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFNvdXJjZSAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdTb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1NvdXJjZUNsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdTb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1RhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nVGFyZ2V0Q2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1RhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICByZXR1cm4gc3VwZXIucHJvbW90ZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdGFibGVJZDogdGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgICAgdHlwZTogJ05vZGVDbGFzcydcbiAgICAgIH0pO1xuICAgICAgdGhpcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgICBub2RlQ2xhc3M6IG5ld05vZGVDbGFzcyxcbiAgICAgICAgc2lkZTogIXRoaXMuc291cmNlQ2xhc3NJZCA/ICdzb3VyY2UnIDogJ3RhcmdldCcsXG4gICAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICAgIGVkZ2VBdHRyaWJ1dGU6IGF0dHJpYnV0ZVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICAgIH1cbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICBjb25zdCBuZXdDbGFzc2VzID0gc3VwZXIuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpO1xuICAgIGZvciAoY29uc3QgbmV3Q2xhc3Mgb2YgbmV3Q2xhc3Nlcykge1xuICAgICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBuZXdDbGFzcy5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgICBuZXdDbGFzcy5zb3VyY2VUYWJsZUlkcyA9IEFycmF5LmZyb20odGhpcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0NsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgbmV3Q2xhc3MudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgbmV3Q2xhc3MudGFyZ2V0VGFibGVJZHMgPSBBcnJheS5mcm9tKHRoaXMudGFyZ2V0VGFibGVJZHMpO1xuICAgICAgICB0aGlzLnRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXdDbGFzc2VzO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld0NsYXNzIG9mIHN1cGVyLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIG5ld0NsYXNzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIG5ld0NsYXNzLnNvdXJjZVRhYmxlSWRzID0gQXJyYXkuZnJvbSh0aGlzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3Q2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICBuZXdDbGFzcy50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICBuZXdDbGFzcy50YXJnZXRUYWJsZUlkcyA9IEFycmF5LmZyb20odGhpcy50YXJnZXRUYWJsZUlkcyk7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW25ld0NsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHlpZWxkIG5ld0NsYXNzO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcblxuY29uc3QgREFUQUxJQl9GT1JNQVRTID0ge1xuICAnanNvbic6ICdqc29uJyxcbiAgJ2Nzdic6ICdjc3YnLFxuICAndHN2JzogJ3RzdicsXG4gICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICd0cmVlanNvbic6ICd0cmVlanNvbidcbn07XG5cbmNsYXNzIE5ldHdvcmtNb2RlbCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBvcmlncmFwaCxcbiAgICBtb2RlbElkLFxuICAgIG5hbWUgPSBtb2RlbElkLFxuICAgIGFubm90YXRpb25zID0ge30sXG4gICAgY2xhc3NlcyA9IHt9LFxuICAgIHRhYmxlcyA9IHt9XG4gIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX29yaWdyYXBoID0gb3JpZ3JhcGg7XG4gICAgdGhpcy5tb2RlbElkID0gbW9kZWxJZDtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBhbm5vdGF0aW9ucztcbiAgICB0aGlzLmNsYXNzZXMgPSB7fTtcbiAgICB0aGlzLnRhYmxlcyA9IHt9O1xuXG4gICAgdGhpcy5fbmV4dENsYXNzSWQgPSAxO1xuICAgIHRoaXMuX25leHRUYWJsZUlkID0gMTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyhjbGFzc2VzKSkge1xuICAgICAgdGhpcy5jbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gdGhpcy5oeWRyYXRlKGNsYXNzT2JqLCBDTEFTU0VTKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiBPYmplY3QudmFsdWVzKHRhYmxlcykpIHtcbiAgICAgIHRoaXMudGFibGVzW3RhYmxlLnRhYmxlSWRdID0gdGhpcy5oeWRyYXRlKHRhYmxlLCBUQUJMRVMpO1xuICAgIH1cblxuICAgIHRoaXMub24oJ3VwZGF0ZScsICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zYXZlVGltZW91dCk7XG4gICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLl9vcmlncmFwaC5zYXZlKCk7XG4gICAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuICAgICAgfSwgMCk7XG4gICAgfSk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBjbGFzc2VzID0ge307XG4gICAgY29uc3QgdGFibGVzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0udHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXSA9IHRhYmxlT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdLnR5cGUgPSB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgbW9kZWxJZDogdGhpcy5tb2RlbElkLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnMsXG4gICAgICBjbGFzc2VzLFxuICAgICAgdGFibGVzXG4gICAgfTtcbiAgfVxuICBnZXQgdW5zYXZlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NhdmVUaW1lb3V0ICE9PSB1bmRlZmluZWQ7XG4gIH1cbiAgaHlkcmF0ZSAocmF3T2JqZWN0LCBUWVBFUykge1xuICAgIHJhd09iamVjdC5tb2RlbCA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBUWVBFU1tyYXdPYmplY3QudHlwZV0ocmF3T2JqZWN0KTtcbiAgfVxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIHdoaWxlICghb3B0aW9ucy50YWJsZUlkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSkpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7dGhpcy5fbmV4dFRhYmxlSWR9YDtcbiAgICAgIHRoaXMuX25leHRUYWJsZUlkICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVEFCTEVTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDTEFTU0VTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cbiAgZmluZENsYXNzIChjbGFzc05hbWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NOYW1lID09PSBjbGFzc05hbWUpO1xuICB9XG4gIHJlbmFtZSAobmV3TmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5ld05hbWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhbm5vdGF0ZSAoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYW5ub3RhdGlvbnNba2V5XSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlQW5ub3RhdGlvbiAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMuYW5ub3RhdGlvbnNba2V5XTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5fb3JpZ3JhcGguZGVsZXRlTW9kZWwodGhpcy5tb2RlbElkKTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX29yaWdyYXBoLm1vZGVsc1t0aGlzLm1vZGVsSWRdO1xuICB9XG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY1RhYmxlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseWApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5fb3JpZ3JhcGguRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24sIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmICghZXh0ZW5zaW9uKSB7XG4gICAgICBleHRlbnNpb24gPSBtaW1lLmV4dGVuc2lvbihtaW1lLmxvb2t1cChuYW1lKSk7XG4gICAgfVxuICAgIGlmIChEQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgZGF0YSA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZSh7IG5hbWUsIGRhdGEsIGF0dHJpYnV0ZXMgfSk7XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKCFlcnIuaW5Vc2UpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyBnZXRTYW1wbGVHcmFwaCAoe1xuICAgIHJvb3RDbGFzcyA9IG51bGwsXG4gICAgYnJhbmNoTGltaXQgPSBJbmZpbml0eSxcbiAgICBub2RlTGltaXQgPSBJbmZpbml0eSxcbiAgICBlZGdlTGltaXQgPSBJbmZpbml0eSxcbiAgICB0cmlwbGVMaW1pdCA9IEluZmluaXR5XG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IHNhbXBsZUdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW10sXG4gICAgICBlZGdlTG9va3VwOiB7fSxcbiAgICAgIGxpbmtzOiBbXVxuICAgIH07XG5cbiAgICBsZXQgbnVtVHJpcGxlcyA9IDA7XG4gICAgY29uc3QgYWRkTm9kZSA9IG5vZGUgPT4ge1xuICAgICAgaWYgKHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGgubm9kZXMucHVzaChub2RlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5ub2Rlcy5sZW5ndGggPD0gbm9kZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkRWRnZSA9IGVkZ2UgPT4ge1xuICAgICAgaWYgKHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLmVkZ2VzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGguZWRnZXMucHVzaChlZGdlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5lZGdlcy5sZW5ndGggPD0gZWRnZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkVHJpcGxlID0gKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSA9PiB7XG4gICAgICBpZiAoYWRkTm9kZShzb3VyY2UpICYmIGFkZE5vZGUodGFyZ2V0KSAmJiBhZGRFZGdlKGVkZ2UpKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogc2FtcGxlR3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSxcbiAgICAgICAgICBlZGdlOiBzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF1cbiAgICAgICAgfSk7XG4gICAgICAgIG51bVRyaXBsZXMrKztcbiAgICAgICAgcmV0dXJuIG51bVRyaXBsZXMgPD0gdHJpcGxlTGltaXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxldCBjbGFzc0xpc3QgPSByb290Q2xhc3MgPyBbcm9vdENsYXNzXSA6IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKCFhZGROb2RlKG5vZGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIGVkZ2UsIHRhcmdldCB9IG9mIG5vZGUucGFpcndpc2VOZWlnaGJvcmhvb2QoeyBsaW1pdDogYnJhbmNoTGltaXQgfSkpIHtcbiAgICAgICAgICAgIGlmICghYWRkVHJpcGxlKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKCFhZGRFZGdlKGVkZ2UpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIHRhcmdldCB9IG9mIGVkZ2UucGFpcndpc2VFZGdlcyh7IGxpbWl0OiBicmFuY2hMaW1pdCB9KSkge1xuICAgICAgICAgICAgaWYgKCFhZGRUcmlwbGUoc291cmNlLCBlZGdlLCB0YXJnZXQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICB9XG4gIGFzeW5jIGdldEluc3RhbmNlR3JhcGggKGluc3RhbmNlSWRMaXN0KSB7XG4gICAgaWYgKCFpbnN0YW5jZUlkTGlzdCkge1xuICAgICAgLy8gV2l0aG91dCBzcGVjaWZpZWQgaW5zdGFuY2VzLCBqdXN0IHBpY2sgdGhlIGZpcnN0IDUgZnJvbSBlYWNoIG5vZGVcbiAgICAgIC8vIGFuZCBlZGdlIGNsYXNzXG4gICAgICBpbnN0YW5jZUlkTGlzdCA9IFtdO1xuICAgICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyB8fCBjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSg1KSkge1xuICAgICAgICAgICAgaW5zdGFuY2VJZExpc3QucHVzaChpdGVtLmluc3RhbmNlSWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEdldCB0aGUgc3BlY2lmaWVkIGl0ZW1zXG4gICAgY29uc3Qgbm9kZUluc3RhbmNlcyA9IHt9O1xuICAgIGNvbnN0IGVkZ2VJbnN0YW5jZXMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGluc3RhbmNlSWQgb2YgaW5zdGFuY2VJZExpc3QpIHtcbiAgICAgIGNvbnN0IHsgY2xhc3NJZCwgaW5kZXggfSA9IEpTT04ucGFyc2UoaW5zdGFuY2VJZCk7XG4gICAgICBjb25zdCBpbnN0YW5jZSA9IGF3YWl0IHRoaXMuY2xhc3Nlc1tjbGFzc0lkXS50YWJsZS5nZXRJdGVtKGluZGV4KTtcbiAgICAgIGlmIChpbnN0YW5jZS50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgbm9kZUluc3RhbmNlc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgfSBlbHNlIGlmIChpbnN0YW5jZS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZWRnZUluc3RhbmNlc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBBZGQgYW55IG5vZGVzIGNvbm5lY3RlZCB0byBvdXIgZWRnZXNcbiAgICBjb25zdCBleHRyYU5vZGVzID0ge307XG4gICAgZm9yIChjb25zdCBlZGdlSWQgaW4gZWRnZUluc3RhbmNlcykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2VJbnN0YW5jZXNbZWRnZUlkXS5ub2RlcygpKSB7XG4gICAgICAgIGlmICghbm9kZUluc3RhbmNlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgZXh0cmFOb2Rlc1tub2RlLmluc3RhbmNlSWRdID0gbm9kZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBBZGQgYW55IGVkZ2VzIHRoYXQgY29ubmVjdCBvdXIgbm9kZXNcbiAgICBjb25zdCBleHRyYUVkZ2VzID0ge307XG4gICAgZm9yIChjb25zdCBub2RlSWQgaW4gbm9kZUluc3RhbmNlcykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIG5vZGVJbnN0YW5jZXNbbm9kZUlkXS5lZGdlcygpKSB7XG4gICAgICAgIGlmICghZWRnZUluc3RhbmNlc1tlZGdlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgLy8gQ2hlY2sgdGhhdCBib3RoIGVuZHMgb2YgdGhlIGVkZ2UgY29ubmVjdCBhdCBsZWFzdCBvbmVcbiAgICAgICAgICAvLyBvZiBvdXIgbm9kZXNcbiAgICAgICAgICBsZXQgY29ubmVjdHNTb3VyY2UgPSBmYWxzZTtcbiAgICAgICAgICBsZXQgY29ubmVjdHNUYXJnZXQgPSBmYWxzZTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgICAgICBpZiAobm9kZUluc3RhbmNlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzU291cmNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2RlSW5zdGFuY2VzW25vZGUuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAgICAgY29ubmVjdHNUYXJnZXQgPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNvbm5lY3RzU291cmNlICYmIGNvbm5lY3RzVGFyZ2V0KSB7XG4gICAgICAgICAgICBleHRyYUVkZ2VzW2VkZ2UuaW5zdGFuY2VJZF0gPSBlZGdlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE9rYXksIG5vdyB3ZSBoYXZlIGEgY29tcGxldGUgc2V0IG9mIG5vZGVzIGFuZCBlZGdlcyB0aGF0IHdlIHdhbnQgdG9cbiAgICAvLyBpbmNsdWRlOyBjcmVhdGUgcGFpcndpc2UgZWRnZSBlbnRyaWVzIGZvciBldmVyeSBjb25uZWN0aW9uXG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBub2RlTG9va3VwOiB7fSxcbiAgICAgIGVkZ2VzOiBbXVxuICAgIH07XG5cbiAgICAvLyBBZGQgYWxsIHRoZSBub2RlcywgYW5kIHBvcHVsYXRlIGEgbG9va3VwIGZvciB3aGVyZSB0aGV5IGFyZSBpbiB0aGUgbGlzdFxuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBPYmplY3QudmFsdWVzKG5vZGVJbnN0YW5jZXMpLmNvbmNhdChPYmplY3QudmFsdWVzKGV4dHJhTm9kZXMpKSkge1xuICAgICAgZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdID0gZ3JhcGgubm9kZXMubGVuZ3RoO1xuICAgICAgZ3JhcGgubm9kZXMucHVzaCh7XG4gICAgICAgIG5vZGVJbnN0YW5jZTogbm9kZSxcbiAgICAgICAgZHVtbXk6IGZhbHNlXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBZGQgYWxsIHRoZSBlZGdlcy4uLlxuICAgIGZvciAoY29uc3QgZWRnZSBvZiBPYmplY3QudmFsdWVzKGVkZ2VJbnN0YW5jZXMpLmNvbmNhdChPYmplY3QudmFsdWVzKGV4dHJhRWRnZXMpKSkge1xuICAgICAgaWYgKCFlZGdlLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgaWYgKCFlZGdlLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgICAvLyBNaXNzaW5nIGJvdGggc291cmNlIGFuZCB0YXJnZXQgY2xhc3NlczsgYWRkIGR1bW15IG5vZGVzIGZvciBib3RoIGVuZHNcbiAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGggKyAxXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBBZGQgZHVtbXkgc291cmNlIG5vZGVzXG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghZWRnZS5jbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIC8vIEFkZCBkdW1teSB0YXJnZXQgbm9kZXNcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoZXJlIHNob3VsZCBiZSBib3RoIHNvdXJjZSBhbmQgdGFyZ2V0IG5vZGVzIGZvciBlYWNoIGVkZ2VcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2VOb2RlIG9mIGVkZ2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3NvdXJjZU5vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXROb2RlIG9mIGVkZ2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXROb2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2VOb2RlLmluc3RhbmNlSWRdLFxuICAgICAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2RlTG9va3VwW3RhcmdldE5vZGUuaW5zdGFuY2VJZF1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TmV0d29ya01vZGVsR3JhcGggKHtcbiAgICByYXcgPSB0cnVlLFxuICAgIGluY2x1ZGVEdW1taWVzID0gZmFsc2UsXG4gICAgY2xhc3NMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc2VzID0gW107XG4gICAgbGV0IGdyYXBoID0ge1xuICAgICAgY2xhc3NlczogW10sXG4gICAgICBjbGFzc0xvb2t1cDoge30sXG4gICAgICBjbGFzc0Nvbm5lY3Rpb25zOiBbXVxuICAgIH07XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgLy8gQWRkIGFuZCBpbmRleCB0aGUgY2xhc3MgYXMgYSBub2RlXG4gICAgICBjb25zdCBjbGFzc1NwZWMgPSByYXcgPyBjbGFzc09iai5fdG9SYXdPYmplY3QoKSA6IHsgY2xhc3NPYmogfTtcbiAgICAgIGNsYXNzU3BlYy50eXBlID0gY2xhc3NPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLmNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gZ3JhcGguY2xhc3Nlcy5sZW5ndGg7XG4gICAgICBncmFwaC5jbGFzc2VzLnB1c2goY2xhc3NTcGVjKTtcblxuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICAvLyBTdG9yZSB0aGUgZWRnZSBjbGFzcyBzbyB3ZSBjYW4gY3JlYXRlIGNsYXNzQ29ubmVjdGlvbnMgbGF0ZXJcbiAgICAgICAgZWRnZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyAmJiBpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBub2RlXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2NsYXNzT2JqLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoIC0gMSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBmYWxzZSxcbiAgICAgICAgICBsb2NhdGlvbjogJ25vZGUnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgZXhpc3RpbmcgY2xhc3NDb25uZWN0aW9uc1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIGVkZ2VDbGFzc2VzKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdCB0aGUgc291cmNlIG5vZGUgY2xhc3MgdG8gdGhlIGVkZ2UgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWR9PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJ1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgc291cmNlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGBkdW1teT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdCB0aGUgZWRnZSBjbGFzcyB0byB0aGUgdGFyZ2V0IG5vZGUgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PiR7ZWRnZUNsYXNzLnRhcmdldENsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0J1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgdGFyZ2V0IGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0JyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldFRhYmxlRGVwZW5kZW5jeUdyYXBoICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIHRhYmxlczogW10sXG4gICAgICB0YWJsZUxvb2t1cDoge30sXG4gICAgICB0YWJsZUxpbmtzOiBbXVxuICAgIH07XG4gICAgY29uc3QgdGFibGVMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcyk7XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGNvbnN0IHRhYmxlU3BlYyA9IHRhYmxlLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVTcGVjLnR5cGUgPSB0YWJsZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGgudGFibGVMb29rdXBbdGFibGUudGFibGVJZF0gPSBncmFwaC50YWJsZXMubGVuZ3RoO1xuICAgICAgZ3JhcGgudGFibGVzLnB1c2godGFibGVTcGVjKTtcbiAgICB9XG4gICAgLy8gRmlsbCB0aGUgZ3JhcGggd2l0aCBsaW5rcyBiYXNlZCBvbiBwYXJlbnRUYWJsZXMuLi5cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0YWJsZS5wYXJlbnRUYWJsZXMpIHtcbiAgICAgICAgZ3JhcGgudGFibGVMaW5rcy5wdXNoKHtcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLnRhYmxlTG9va3VwW3BhcmVudFRhYmxlLnRhYmxlSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGgudGFibGVMb29rdXBbdGFibGUudGFibGVJZF1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRNb2RlbER1bXAgKCkge1xuICAgIC8vIEJlY2F1c2Ugb2JqZWN0IGtleSBvcmRlcnMgYXJlbid0IGRldGVybWluaXN0aWMsIGl0IGNhbiBiZSBwcm9ibGVtYXRpY1xuICAgIC8vIGZvciB0ZXN0aW5nIChiZWNhdXNlIGlkcyBjYW4gcmFuZG9tbHkgY2hhbmdlIGZyb20gdGVzdCBydW4gdG8gdGVzdCBydW4pLlxuICAgIC8vIFRoaXMgZnVuY3Rpb24gc29ydHMgZWFjaCBrZXksIGFuZCBqdXN0IHJlcGxhY2VzIElEcyB3aXRoIGluZGV4IG51bWJlcnNcbiAgICBjb25zdCByYXdPYmogPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHRoaXMuX3RvUmF3T2JqZWN0KCkpKTtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBjbGFzc2VzOiBPYmplY3QudmFsdWVzKHJhd09iai5jbGFzc2VzKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGFIYXNoID0gdGhpcy5jbGFzc2VzW2EuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLmNsYXNzZXNbYi5jbGFzc0lkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBpZiAoYUhhc2ggPCBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIGlmIChhSGFzaCA+IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzcyBoYXNoIGNvbGxpc2lvbmApO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIHRhYmxlczogT2JqZWN0LnZhbHVlcyhyYXdPYmoudGFibGVzKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGFIYXNoID0gdGhpcy50YWJsZXNbYS50YWJsZUlkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBjb25zdCBiSGFzaCA9IHRoaXMudGFibGVzW2IudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgdGFibGUgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9O1xuICAgIGNvbnN0IGNsYXNzTG9va3VwID0ge307XG4gICAgY29uc3QgdGFibGVMb29rdXAgPSB7fTtcbiAgICByZXN1bHQuY2xhc3Nlcy5mb3JFYWNoKChjbGFzc09iaiwgaW5kZXgpID0+IHtcbiAgICAgIGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gaW5kZXg7XG4gICAgfSk7XG4gICAgcmVzdWx0LnRhYmxlcy5mb3JFYWNoKCh0YWJsZSwgaW5kZXgpID0+IHtcbiAgICAgIHRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gaW5kZXg7XG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHJlc3VsdC50YWJsZXMpIHtcbiAgICAgIHRhYmxlLnRhYmxlSWQgPSB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXTtcbiAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBPYmplY3Qua2V5cyh0YWJsZS5kZXJpdmVkVGFibGVzKSkge1xuICAgICAgICB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlTG9va3VwW3RhYmxlSWRdXSA9IHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVJZF07XG4gICAgICAgIGRlbGV0ZSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRhYmxlLmRhdGE7IC8vIGRvbid0IGluY2x1ZGUgYW55IG9mIHRoZSBkYXRhOyB3ZSBqdXN0IHdhbnQgdGhlIG1vZGVsIHN0cnVjdHVyZVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIHJlc3VsdC5jbGFzc2VzKSB7XG4gICAgICBjbGFzc09iai5jbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF07XG4gICAgICBjbGFzc09iai50YWJsZUlkID0gdGFibGVMb29rdXBbY2xhc3NPYmoudGFibGVJZF07XG4gICAgICBpZiAoY2xhc3NPYmouc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBjbGFzc09iai5zb3VyY2VDbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmouc291cmNlQ2xhc3NJZF07XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmouc291cmNlVGFibGVJZHMpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMgPSBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5tYXAodGFibGVJZCA9PiB0YWJsZUxvb2t1cFt0YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICBjbGFzc09iai50YXJnZXRDbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF07XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMgPSBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5tYXAodGFibGVJZCA9PiB0YWJsZUxvb2t1cFt0YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGNsYXNzSWQgb2YgT2JqZWN0LmtleXMoY2xhc3NPYmouZWRnZUNsYXNzSWRzIHx8IHt9KSkge1xuICAgICAgICBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NMb29rdXBbY2xhc3NJZF1dID0gY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgICBkZWxldGUgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGNyZWF0ZVNjaGVtYU1vZGVsICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHRoaXMuZ2V0TW9kZWxEdW1wKCk7XG5cbiAgICBncmFwaC50YWJsZXMuZm9yRWFjaCh0YWJsZSA9PiB7XG4gICAgICB0YWJsZS5kZXJpdmVkVGFibGVzID0gT2JqZWN0LmtleXModGFibGUuZGVyaXZlZFRhYmxlcyk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZU1vZGVsKHsgbmFtZTogdGhpcy5uYW1lICsgJ19zY2hlbWEnIH0pO1xuICAgIGNvbnN0IHJhdyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLFxuICAgICAgbmFtZTogJ1JhdyBEdW1wJ1xuICAgIH0pO1xuICAgIGxldCBbIGNsYXNzZXMsIHRhYmxlcyBdID0gcmF3LmNsb3NlZFRyYW5zcG9zZShbJ2NsYXNzZXMnLCAndGFibGVzJ10pO1xuICAgIGNsYXNzZXMgPSBjbGFzc2VzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBjbGFzc2VzLnNldENsYXNzTmFtZSgnQ2xhc3NlcycpO1xuICAgIHJhdy5kZWxldGUoKTtcblxuICAgIGNvbnN0IHNvdXJjZUNsYXNzZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogY2xhc3NlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3NvdXJjZUNsYXNzSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICBzb3VyY2VDbGFzc2VzLnNldENsYXNzTmFtZSgnU291cmNlIENsYXNzJyk7XG4gICAgc291cmNlQ2xhc3Nlcy50b2dnbGVEaXJlY3Rpb24oKTtcbiAgICBjb25zdCB0YXJnZXRDbGFzc2VzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IGNsYXNzZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YXJnZXRDbGFzc0lkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgdGFyZ2V0Q2xhc3Nlcy5zZXRDbGFzc05hbWUoJ1RhcmdldCBDbGFzcycpO1xuICAgIHRhcmdldENsYXNzZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG5cbiAgICB0YWJsZXMgPSB0YWJsZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgIHRhYmxlcy5zZXRDbGFzc05hbWUoJ1RhYmxlcycpO1xuXG4gICAgY29uc3QgdGFibGVEZXBlbmRlbmNpZXMgPSB0YWJsZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICdkZXJpdmVkVGFibGVzJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgdGFibGVEZXBlbmRlbmNpZXMuc2V0Q2xhc3NOYW1lKCdJcyBQYXJlbnQgT2YnKTtcbiAgICB0YWJsZURlcGVuZGVuY2llcy50b2dnbGVEaXJlY3Rpb24oKTtcblxuICAgIGNvbnN0IGNvcmVUYWJsZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAndGFibGVJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIGNvcmVUYWJsZXMuc2V0Q2xhc3NOYW1lKCdDb3JlIFRhYmxlJyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOZXR3b3JrTW9kZWw7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBOZXR3b3JrTW9kZWwgZnJvbSAnLi9Db21tb24vTmV0d29ya01vZGVsLmpzJztcblxubGV0IE5FWFRfTU9ERUxfSUQgPSAxO1xuXG5jbGFzcyBPcmlncmFwaCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIFBvdWNoREIpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5Qb3VjaERCID0gUG91Y2hEQjsgLy8gZWl0aGVyIHBvdWNoZGItYnJvd3NlciBvciBwb3VjaGRiLW5vZGVcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICBsZXQgZXhpc3RpbmdNb2RlbHMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnKTtcbiAgICBpZiAoZXhpc3RpbmdNb2RlbHMpIHtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyhKU09OLnBhcnNlKGV4aXN0aW5nTW9kZWxzKSkpIHtcbiAgICAgICAgbW9kZWwub3JpZ3JhcGggPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsc1ttb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwobW9kZWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgfVxuICByZWdpc3RlclBsdWdpbiAobmFtZSwgcGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW5zW25hbWVdID0gcGx1Z2luO1xuICB9XG4gIHNhdmUgKCkge1xuICAgIC8qaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH0qL1xuICB9XG4gIGNsb3NlQ3VycmVudE1vZGVsICgpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBnZXQgY3VycmVudE1vZGVsICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbdGhpcy5fY3VycmVudE1vZGVsSWRdIHx8IG51bGw7XG4gIH1cbiAgc2V0IGN1cnJlbnRNb2RlbCAobW9kZWwpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG1vZGVsID8gbW9kZWwubW9kZWxJZCA6IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBjcmVhdGVNb2RlbCAob3B0aW9ucyA9IHt9KSB7XG4gICAgd2hpbGUgKCFvcHRpb25zLm1vZGVsSWQgfHwgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSkge1xuICAgICAgb3B0aW9ucy5tb2RlbElkID0gYG1vZGVsJHtORVhUX01PREVMX0lEfWA7XG4gICAgICBORVhUX01PREVMX0lEICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMub3JpZ3JhcGggPSB0aGlzO1xuICAgIHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0gPSBuZXcgTmV0d29ya01vZGVsKG9wdGlvbnMpO1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gb3B0aW9ucy5tb2RlbElkO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF07XG4gIH1cbiAgZGVsZXRlTW9kZWwgKG1vZGVsSWQgPSB0aGlzLmN1cnJlbnRNb2RlbElkKSB7XG4gICAgaWYgKCF0aGlzLm1vZGVsc1ttb2RlbElkXSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgbm9uLWV4aXN0ZW50IG1vZGVsOiAke21vZGVsSWR9YCk7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsc1ttb2RlbElkXTtcbiAgICBpZiAodGhpcy5fY3VycmVudE1vZGVsSWQgPT09IG1vZGVsSWQpIHtcbiAgICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gICAgfVxuICAgIHRoaXMuc2F2ZSgpO1xuICB9XG4gIGRlbGV0ZUFsbE1vZGVscyAoKSB7XG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBPcmlncmFwaDtcbiIsImltcG9ydCBPcmlncmFwaCBmcm9tICcuL09yaWdyYXBoLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG9yaWdyYXBoID0gbmV3IE9yaWdyYXBoKHdpbmRvdy5GaWxlUmVhZGVyLCB3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm9yaWdyYXBoLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgb3JpZ3JhcGg7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsIl9ldmVudEhhbmRsZXJzIiwiX3N0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImV2ZW50IiwibmFtZXNwYWNlIiwic3BsaXQiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJpbmRleE9mIiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJoYW5kbGVDYWxsYmFjayIsInNldFRpbWVvdXQiLCJhcHBseSIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJHZW5lcmljV3JhcHBlciIsIm9wdGlvbnMiLCJ0YWJsZSIsInVuZGVmaW5lZCIsIkVycm9yIiwiY2xhc3NPYmoiLCJyb3ciLCJjb25uZWN0ZWRJdGVtcyIsImR1cGxpY2F0ZUl0ZW1zIiwicmVnaXN0ZXJEdXBsaWNhdGUiLCJpdGVtIiwiY29ubmVjdEl0ZW0iLCJ0YWJsZUlkIiwiZHVwIiwiZGlzY29ubmVjdCIsIml0ZW1MaXN0IiwidmFsdWVzIiwiaW5zdGFuY2VJZCIsImNsYXNzSWQiLCJlcXVhbHMiLCJoYW5kbGVMaW1pdCIsIml0ZXJhdG9ycyIsImxpbWl0IiwiSW5maW5pdHkiLCJpdGVyYXRvciIsIml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInRhYmxlSWRzIiwiUHJvbWlzZSIsImFsbCIsIm1hcCIsIm1vZGVsIiwidGFibGVzIiwiYnVpbGRDYWNoZSIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJsZW5ndGgiLCJ0aGlzVGFibGVJZCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX2xpbWl0UHJvbWlzZXMiLCJpdGVyYXRpb25SZXNldCIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwiZ2V0U29ydEhhc2giLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiaXRlcmF0ZSIsIl9jYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJyZXNvbHZlIiwicmVqZWN0IiwiX2l0ZXJhdGUiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGVMb29rdXAiLCJkb25lIiwibmV4dCIsImVyciIsImhhbmRsZVJlc2V0IiwiX2ZpbmlzaEl0ZW0iLCJOdW1iZXIiLCJfY2FjaGVMb29rdXAiLCJfY2FjaGVQcm9taXNlIiwicmVzZXQiLCJkZXJpdmVkVGFibGUiLCJjb3VudFJvd3MiLCJ3cmFwcGVkSXRlbSIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZ2V0SW5kZXhEZXRhaWxzIiwiZGV0YWlscyIsInN1cHByZXNzZWQiLCJmaWx0ZXJlZCIsImdldEF0dHJpYnV0ZURldGFpbHMiLCJhbGxBdHRycyIsImV4cGVjdGVkIiwib2JzZXJ2ZWQiLCJkZXJpdmVkIiwiY3VycmVudERhdGEiLCJkYXRhIiwibG9va3VwIiwiY29tcGxldGUiLCJnZXRJdGVtIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJwcm9tb3RlIiwiZXhwYW5kIiwidW5yb2xsIiwiY2xvc2VkRmFjZXQiLCJvcGVuRmFjZXQiLCJjbG9zZWRUcmFuc3Bvc2UiLCJpbmRleGVzIiwib3BlblRyYW5zcG9zZSIsImR1cGxpY2F0ZSIsImNvbm5lY3QiLCJvdGhlclRhYmxlTGlzdCIsIm90aGVyVGFibGUiLCJjbGFzc2VzIiwicGFyZW50VGFibGVzIiwicmVkdWNlIiwiYWdnIiwiaW5Vc2UiLCJzb21lIiwic291cmNlVGFibGVJZHMiLCJ0YXJnZXRUYWJsZUlkcyIsImRlbGV0ZSIsInBhcmVudFRhYmxlIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiUHJvbW90ZWRUYWJsZSIsIl9hdHRyaWJ1dGUiLCJfdW5maW5pc2hlZENhY2hlIiwiX3VuZmluaXNoZWRDYWNoZUxvb2t1cCIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicFRhYmxlIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJEdXBsaWNhdGVkVGFibGUiLCJjb25jYXQiLCJFeHBhbmRlZFRhYmxlIiwiVW5yb2xsZWRUYWJsZSIsInJvd3MiLCJHZW5lcmljQ2xhc3MiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbnMiLCJzZXRDbGFzc05hbWUiLCJoYXNDdXN0b21OYW1lIiwidmFyaWFibGVOYW1lIiwiZmlsdGVyIiwiZCIsInRvTG9jYWxlVXBwZXJDYXNlIiwiZGVsZXRlZCIsImludGVycHJldEFzTm9kZXMiLCJvdmVyd3JpdGUiLCJjcmVhdGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJfZGVyaXZlTmV3Q2xhc3MiLCJnZXRTYW1wbGVHcmFwaCIsInJvb3RDbGFzcyIsIk5vZGVXcmFwcGVyIiwiZWRnZXMiLCJlZGdlSWRzIiwiY2xhc3NJZHMiLCJlZGdlQ2xhc3NJZHMiLCJlZGdlSWQiLCJlZGdlQ2xhc3MiLCJyb2xlIiwiZ2V0RWRnZVJvbGUiLCJyZXZlcnNlIiwicGFpcndpc2VOZWlnaGJvcmhvb2QiLCJlZGdlIiwicGFpcndpc2VFZGdlcyIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc2VzIiwiZWRnZUNsYXNzSWQiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsImF1dG9jb25uZWN0IiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiaXNTb3VyY2UiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIm5vZGVDbGFzcyIsInRhYmxlSWRMaXN0IiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5ld05vZGVDbGFzcyIsInByb2plY3ROZXdFZGdlIiwiY2xhc3NJZExpc3QiLCJjbGFzc0xpc3QiLCJtaWRkbGVJbmRleCIsIk1hdGgiLCJmbG9vciIsInVuc2hpZnQiLCJBcnJheSIsImZyb20iLCJjb25uZWN0ZWRDbGFzc2VzIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VOb2RlcyIsInNvdXJjZVRhYmxlSWQiLCJ0YXJnZXROb2RlcyIsInRhcmdldFRhYmxlSWQiLCJub2RlcyIsInNvdXJjZSIsInRhcmdldCIsIkVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJfc3BsaXRUYWJsZUlkTGlzdCIsIm90aGVyQ2xhc3MiLCJub2RlVGFibGVJZExpc3QiLCJlZGdlVGFibGVJZCIsImVkZ2VUYWJsZUlkTGlzdCIsInN0YXRpY0V4aXN0cyIsInRhYmxlRGlzdGFuY2VzIiwic3RhcnRzV2l0aCIsImRpc3QiLCJhYnMiLCJzb3J0IiwiYSIsImIiLCJzaWRlIiwiY29ubmVjdFNvdXJjZSIsImNvbm5lY3RUYXJnZXQiLCJ0b2dnbGVEaXJlY3Rpb24iLCJzd2FwcGVkRGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJuZXdDbGFzc2VzIiwibmV3Q2xhc3MiLCJEQVRBTElCX0ZPUk1BVFMiLCJOZXR3b3JrTW9kZWwiLCJvcmlncmFwaCIsIm1vZGVsSWQiLCJfb3JpZ3JhcGgiLCJfbmV4dENsYXNzSWQiLCJfbmV4dFRhYmxlSWQiLCJoeWRyYXRlIiwiQ0xBU1NFUyIsIlRBQkxFUyIsIl9zYXZlVGltZW91dCIsInNhdmUiLCJ1bnNhdmVkIiwicmF3T2JqZWN0IiwiVFlQRVMiLCJzZWxlY3RvciIsImZpbmRDbGFzcyIsInJlbmFtZSIsIm5ld05hbWUiLCJhbm5vdGF0ZSIsImtleSIsImRlbGV0ZUFubm90YXRpb24iLCJkZWxldGVNb2RlbCIsIm1vZGVscyIsImFkZEZpbGVBc1N0YXRpY1RhYmxlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwibWltZSIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwiY29uc29sZSIsIndhcm4iLCJ0ZXh0IiwicmVhZGVyIiwiRmlsZVJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJhZGRTdHJpbmdBc1N0YXRpY1RhYmxlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJicmFuY2hMaW1pdCIsIm5vZGVMaW1pdCIsImVkZ2VMaW1pdCIsInRyaXBsZUxpbWl0Iiwic2FtcGxlR3JhcGgiLCJub2RlTG9va3VwIiwiZWRnZUxvb2t1cCIsImxpbmtzIiwibnVtVHJpcGxlcyIsImFkZE5vZGUiLCJub2RlIiwiYWRkRWRnZSIsImFkZFRyaXBsZSIsImdldEluc3RhbmNlR3JhcGgiLCJpbnN0YW5jZUlkTGlzdCIsIm5vZGVJbnN0YW5jZXMiLCJlZGdlSW5zdGFuY2VzIiwiSlNPTiIsInBhcnNlIiwiaW5zdGFuY2UiLCJleHRyYU5vZGVzIiwiZXh0cmFFZGdlcyIsIm5vZGVJZCIsImNvbm5lY3RzU291cmNlIiwiY29ubmVjdHNUYXJnZXQiLCJncmFwaCIsIm5vZGVJbnN0YW5jZSIsImR1bW15IiwiZWRnZUluc3RhbmNlIiwic291cmNlTm9kZSIsInRhcmdldE5vZGUiLCJnZXROZXR3b3JrTW9kZWxHcmFwaCIsInJhdyIsImluY2x1ZGVEdW1taWVzIiwiY2xhc3NMb29rdXAiLCJjbGFzc0Nvbm5lY3Rpb25zIiwiY2xhc3NTcGVjIiwiaWQiLCJsb2NhdGlvbiIsImdldFRhYmxlRGVwZW5kZW5jeUdyYXBoIiwidGFibGVMb29rdXAiLCJ0YWJsZUxpbmtzIiwidGFibGVMaXN0IiwidGFibGVTcGVjIiwiZ2V0TW9kZWxEdW1wIiwicmF3T2JqIiwic3RyaW5naWZ5IiwiYUhhc2giLCJiSGFzaCIsImNyZWF0ZVNjaGVtYU1vZGVsIiwibmV3TW9kZWwiLCJjcmVhdGVNb2RlbCIsInNvdXJjZUNsYXNzZXMiLCJ0YXJnZXRDbGFzc2VzIiwidGFibGVEZXBlbmRlbmNpZXMiLCJjb3JlVGFibGVzIiwiTkVYVF9NT0RFTF9JRCIsIk9yaWdyYXBoIiwiUG91Y2hEQiIsInBsdWdpbnMiLCJleGlzdGluZ01vZGVscyIsImxvY2FsU3RvcmFnZSIsIl9jdXJyZW50TW9kZWxJZCIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luIiwiY2xvc2VDdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWxJZCIsImRlbGV0ZUFsbE1vZGVscyIsIndpbmRvdyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxjQUFMLEdBQXNCLEVBQXRCO1dBQ0tDLGVBQUwsR0FBdUIsRUFBdkI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNuQixDQUFDQyxLQUFELEVBQVFDLFNBQVIsSUFBcUJILFNBQVMsQ0FBQ0ksS0FBVixDQUFnQixHQUFoQixDQUF6QjtXQUNLUCxjQUFMLENBQW9CSyxLQUFwQixJQUE2QixLQUFLTCxjQUFMLENBQW9CSyxLQUFwQixLQUMzQjtZQUFNO09BRFI7O1VBRUksQ0FBQ0MsU0FBTCxFQUFnQjthQUNUTixjQUFMLENBQW9CSyxLQUFwQixFQUEyQixFQUEzQixFQUErQkcsSUFBL0IsQ0FBb0NKLFFBQXBDO09BREYsTUFFTzthQUNBSixjQUFMLENBQW9CSyxLQUFwQixFQUEyQkMsU0FBM0IsSUFBd0NGLFFBQXhDOzs7O0lBR0pLLEdBQUcsQ0FBRU4sU0FB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
