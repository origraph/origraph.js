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

function _asyncGeneratorDelegate(inner, awaitWrap) { var iter = {}, waiting = false; function pump(key, value) { waiting = true; value = new Promise(function (resolve) { resolve(inner[key](value)); }); return { done: false, value: awaitWrap(value) }; } if (typeof Symbol === "function" && Symbol.iterator) { iter[Symbol.iterator] = function () { return this; }; } iter.next = function (value) { if (waiting) { waiting = false; return value; } return pump("next", value); }; if (typeof inner.throw === "function") { iter.throw = function (value) { if (waiting) { waiting = false; throw value; } return pump("throw", value); }; } if (typeof inner.return === "function") { iter.return = function (value) { return pump("return", value); }; } return iter; }

function _awaitAsyncGenerator(value) { return new _AwaitValue(value); }

function _wrapAsyncGenerator(fn) { return function () { return new _AsyncGenerator(fn.apply(this, arguments)); }; }

function _AsyncGenerator(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue(value) { this.wrapped = value; }

function _asyncIterator(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

function _wrapAsyncGenerator$1(fn) { return function () { return new _AsyncGenerator$1(fn.apply(this, arguments)); }; }

function _AsyncGenerator$1(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$1; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$1.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$1.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$1.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$1.prototype.return = function (arg) { return this._invoke("return", arg); };

function _awaitAsyncGenerator$1(value) { return new _AwaitValue$1(value); }

function _AwaitValue$1(value) { this.wrapped = value; }

function _asyncIterator$1(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

function _asyncGeneratorDelegate$1(inner, awaitWrap) { var iter = {}, waiting = false; function pump(key, value) { waiting = true; value = new Promise(function (resolve) { resolve(inner[key](value)); }); return { done: false, value: awaitWrap(value) }; } if (typeof Symbol === "function" && Symbol.iterator) { iter[Symbol.iterator] = function () { return this; }; } iter.next = function (value) { if (waiting) { waiting = false; return value; } return pump("next", value); }; if (typeof inner.throw === "function") { iter.throw = function (value) { if (waiting) { waiting = false; throw value; } return pump("throw", value); }; } if (typeof inner.return === "function") { iter.return = function (value) { return pump("return", value); }; } return iter; }

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

    return _wrapAsyncGenerator$1(function* () {
      if (_this._cache) {
        // The cache has already been built; just grab data from it directly
        yield* _asyncGeneratorDelegate$1(_asyncIterator$1(_this._cache.slice(0, limit)), _awaitAsyncGenerator$1);
      } else if (_this._partialCache && _this._partialCache.length >= limit) {
        // The cache isn't finished, but it's already long enough to satisfy this
        // request
        yield* _asyncGeneratorDelegate$1(_asyncIterator$1(_this._partialCache.slice(0, limit)), _awaitAsyncGenerator$1);
      } else {
        // The cache isn't finished building (and maybe didn't even start yet);
        // kick it off, and then wait for enough items to be processed to satisfy
        // the limit
        _this.buildCache();

        yield* _asyncGeneratorDelegate$1(_asyncIterator$1((yield _awaitAsyncGenerator$1(new Promise((resolve, reject) => {
          _this._limitPromises[limit] = _this._limitPromises[limit] || [];

          _this._limitPromises[limit].push({
            resolve,
            reject
          });
        })))), _awaitAsyncGenerator$1);
      }
    })();
  }

  _iterate(options) {
    return _wrapAsyncGenerator$1(function* () {
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

  async _getItem(index = null) {
    // Stupid approach when the cache isn't built: interate until we see the
    // index. Subclasses could override this
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;

    var _iteratorError;

    try {
      for (var _iterator = _asyncIterator$1(this.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
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

  async getItem(index = null) {
    if (this._cacheLookup) {
      return index === null ? this._cache[0] : this._cache[this._cacheLookup[index]];
    } else if (this._partialCacheLookup && (index === null && this._partialCache.length > 0 || this._partialCacheLookup[index] !== undefined)) {
      return index === null ? this._partialCache[0] : this._partialCache[this._partialCacheLookup[index]];
    }

    return this._getItem(index);
  }

  async getRandomItem() {
    const randIndex = Math.floor(Math.random() * (await this.countRows()));
    return this._cache[randIndex];
  }

  deriveAttribute(attribute, func) {
    this._derivedAttributeFunctions[attribute] = func;
    this.reset();
    this.model.trigger('update');
  }

  get suppressedAttributes() {
    return Object.keys(this._suppressedAttributes);
  }

  get unSuppressedAttributes() {
    return this.attributes.filter(attr => !this._suppressedAttributes[attr]);
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

    return _wrapAsyncGenerator$1(function* () {
      const values = {};
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator$1(_this2.iterate(limit)), _step2, _value2; _step2 = yield _awaitAsyncGenerator$1(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator$1(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedItem = _value2;
          const value = yield _awaitAsyncGenerator$1(wrappedItem.row[attribute]);

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
            yield _awaitAsyncGenerator$1(_iterator2.return());
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

    return _wrapAsyncGenerator$1(function* () {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator$1(_this3.iterate(limit)), _step3, _value3; _step3 = yield _awaitAsyncGenerator$1(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield _awaitAsyncGenerator$1(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
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
            yield _awaitAsyncGenerator$1(_iterator3.return());
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

function _awaitAsyncGenerator$2(value) { return new _AwaitValue$2(value); }

function _wrapAsyncGenerator$2(fn) { return function () { return new _AsyncGenerator$2(fn.apply(this, arguments)); }; }

function _AsyncGenerator$2(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$2; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$2.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$2.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$2.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$2.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$2(value) { this.wrapped = value; }

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

    return _wrapAsyncGenerator$2(function* () {
      for (let index = 0; index < _this._data.length; index++) {
        const item = _this._wrap({
          index,
          row: _this._data[index]
        });

        if (yield _awaitAsyncGenerator$2(_this._finishItem(item))) {
          yield item;
        }
      }
    })();
  }

}

function _awaitAsyncGenerator$3(value) { return new _AwaitValue$3(value); }

function _wrapAsyncGenerator$3(fn) { return function () { return new _AsyncGenerator$3(fn.apply(this, arguments)); }; }

function _AsyncGenerator$3(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$3; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$3.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$3.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$3.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$3.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$3(value) { this.wrapped = value; }

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

    return _wrapAsyncGenerator$3(function* () {
      for (const [index, row] of Object.entries(_this._data)) {
        const item = _this._wrap({
          index,
          row
        });

        if (yield _awaitAsyncGenerator$3(_this._finishItem(item))) {
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

function _awaitAsyncGenerator$4(value) { return new _AwaitValue$4(value); }

function _wrapAsyncGenerator$4(fn) { return function () { return new _AsyncGenerator$4(fn.apply(this, arguments)); }; }

function _AsyncGenerator$4(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$4; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$4.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$4.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$4.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$4.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$4(value) { this.wrapped = value; }

function _asyncIterator$2(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

    return _wrapAsyncGenerator$4(function* () {
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$2(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$4(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$4(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          let index = yield _awaitAsyncGenerator$4(wrappedParent.row[_this._attribute]);

          if (typeof index === 'object') {
            // Don't promote [object Object] as a value (ignore unhashable values)
            continue;
          }

          index = String(index);

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
            yield _awaitAsyncGenerator$4(_iterator.return());
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

function _awaitAsyncGenerator$5(value) { return new _AwaitValue$5(value); }

function _wrapAsyncGenerator$5(fn) { return function () { return new _AsyncGenerator$5(fn.apply(this, arguments)); }; }

function _AsyncGenerator$5(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$5; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$5.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$5.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$5.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$5.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$5(value) { this.wrapped = value; }

function _asyncIterator$3(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

    return _wrapAsyncGenerator$5(function* () {
      let index = 0;
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$3(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$5(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$5(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if ((yield _awaitAsyncGenerator$5(wrappedParent.row[_this._attribute])) === _this._value) {
            // Normal faceting just gives a subset of the original table
            const newItem = _this._wrap({
              index,
              row: Object.assign({}, wrappedParent.row),
              itemsToConnect: [wrappedParent]
            });

            if (yield _awaitAsyncGenerator$5(_this._finishItem(newItem))) {
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
            yield _awaitAsyncGenerator$5(_iterator.return());
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

function _awaitAsyncGenerator$6(value) { return new _AwaitValue$6(value); }

function _wrapAsyncGenerator$6(fn) { return function () { return new _AsyncGenerator$6(fn.apply(this, arguments)); }; }

function _AsyncGenerator$6(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$6; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$6.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$6.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$6.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$6.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$6(value) { this.wrapped = value; }

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

    return _wrapAsyncGenerator$6(function* () {
      // Pre-build the parent table's cache
      yield _awaitAsyncGenerator$6(_this.parentTable.buildCache()); // Iterate the row's attributes as indexes

      const wrappedParent = _this.parentTable._cache[_this.parentTable._cacheLookup[_this._index]] || {
        row: {}
      };

      for (let [index, value] of Object.entries(wrappedParent.row)) {
        value = yield _awaitAsyncGenerator$6(value);

        const newItem = _this._wrap({
          index,
          row: typeof value === 'object' ? value : {
            value
          },
          itemsToConnect: [wrappedParent]
        });

        if (yield _awaitAsyncGenerator$6(_this._finishItem(newItem))) {
          yield newItem;
        }
      }
    })();
  }

}

function _awaitAsyncGenerator$7(value) { return new _AwaitValue$7(value); }

function _wrapAsyncGenerator$7(fn) { return function () { return new _AsyncGenerator$7(fn.apply(this, arguments)); }; }

function _AsyncGenerator$7(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$7; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$7.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$7.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$7.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$7.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$7(value) { this.wrapped = value; }

class ConnectedTable extends Table {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('=');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join('=');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator$7(function* () {
      const parentTables = _this.parentTables; // Don't try to connect values until all of the parent tables' caches are
      // built; TODO: might be able to do something more responsive here?

      yield _awaitAsyncGenerator$7(Promise.all(parentTables.map(pTable => pTable.buildCache()))); // Now that the caches are built, just iterate their keys directly. We only
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

        if (yield _awaitAsyncGenerator$7(_this._finishItem(newItem))) {
          yield newItem;
        }
      }
    })();
  }

}

function _awaitAsyncGenerator$8(value) { return new _AwaitValue$8(value); }

function _wrapAsyncGenerator$8(fn) { return function () { return new _AsyncGenerator$8(fn.apply(this, arguments)); }; }

function _AsyncGenerator$8(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$8; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$8.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$8.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$8.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$8.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$8(value) { this.wrapped = value; }

function _asyncIterator$4(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

class DuplicatedTable extends SingleParentMixin(Table) {
  get name() {
    return this.parentTable.name;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash();
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator$8(function* () {
      // Yield the same items with the same connections, but wrapped and finished
      // by this table
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$4(_this.parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$8(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$8(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const item = _value;

          const newItem = _this._wrap({
            index: item.index,
            row: item.row,
            itemsToConnect: Object.values(item.connectedItems).reduce((agg, itemList) => {
              return agg.concat(itemList);
            }, [])
          });

          item.registerDuplicate(newItem);

          if (yield _awaitAsyncGenerator$8(_this._finishItem(newItem))) {
            yield newItem;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator$8(_iterator.return());
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

function _awaitAsyncGenerator$9(value) { return new _AwaitValue$9(value); }

function _wrapAsyncGenerator$9(fn) { return function () { return new _AsyncGenerator$9(fn.apply(this, arguments)); }; }

function _AsyncGenerator$9(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$9; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$9.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$9.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$9.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$9.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$9(value) { this.wrapped = value; }

function _asyncIterator$5(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

    return _wrapAsyncGenerator$9(function* () {
      const parentTable = _this.parentTable;
      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$5(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$9(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$9(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const row = yield _awaitAsyncGenerator$9(wrappedParent.row[_this._attribute]);

          if (row !== undefined && row !== null && Object.keys(row).length > 0) {
            const newItem = _this._wrap({
              index,
              row,
              itemsToConnect: [wrappedParent],
              parentIndex: wrappedParent.index
            });

            if (yield _awaitAsyncGenerator$9(_this._finishItem(newItem))) {
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
            yield _awaitAsyncGenerator$9(_iterator.return());
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

function _awaitAsyncGenerator$a(value) { return new _AwaitValue$a(value); }

function _wrapAsyncGenerator$a(fn) { return function () { return new _AsyncGenerator$a(fn.apply(this, arguments)); }; }

function _AsyncGenerator$a(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$a; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$a.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$a.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$a.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$a.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$a(value) { this.wrapped = value; }

function _asyncIterator$6(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

    return _wrapAsyncGenerator$a(function* () {
      const parentTable = _this.parentTable;
      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$6(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$a(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$a(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const rows = wrappedParent.row[_this._attribute];

          if (rows !== undefined && rows !== null && typeof rows[Symbol.iterator] === 'function') {
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;

            var _iteratorError2;

            try {
              for (var _iterator2 = _asyncIterator$6(rows), _step2, _value2; _step2 = yield _awaitAsyncGenerator$a(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator$a(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                const row = _value2;

                const newItem = _this._wrap({
                  index,
                  row,
                  itemsToConnect: [wrappedParent],
                  parentIndex: wrappedParent.index
                });

                if (yield _awaitAsyncGenerator$a(_this._finishItem(newItem))) {
                  yield newItem;
                  index++;
                }
              }
            } catch (err) {
              _didIteratorError2 = true;
              _iteratorError2 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                  yield _awaitAsyncGenerator$a(_iterator2.return());
                }
              } finally {
                if (_didIteratorError2) {
                  throw _iteratorError2;
                }
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
            yield _awaitAsyncGenerator$a(_iterator.return());
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

function _awaitAsyncGenerator$b(value) { return new _AwaitValue$b(value); }

function _wrapAsyncGenerator$b(fn) { return function () { return new _AsyncGenerator$b(fn.apply(this, arguments)); }; }

function _AsyncGenerator$b(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$b; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$b.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$b.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$b.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$b.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$b(value) { this.wrapped = value; }

function _asyncIterator$7(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

class ParentChildTable extends Table {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('/');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join(',');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator$b(function* () {
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
        for (var _iterator = _asyncIterator$7(childTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$b(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$b(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const child = _value;
          const parent = yield _awaitAsyncGenerator$b(parentTable.getItem(child.parentIndex));

          const newItem = _this._wrap({
            index,
            itemsToConnect: [parent, child]
          });

          if (yield _awaitAsyncGenerator$b(_this._finishItem(newItem))) {
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
            yield _awaitAsyncGenerator$b(_iterator.return());
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

function _awaitAsyncGenerator$c(value) { return new _AwaitValue$c(value); }

function _wrapAsyncGenerator$c(fn) { return function () { return new _AsyncGenerator$c(fn.apply(this, arguments)); }; }

function _AsyncGenerator$c(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$c; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$c.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$c.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$c.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$c.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$c(value) { this.wrapped = value; }

function _asyncIterator$8(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

    return _wrapAsyncGenerator$c(function* () {
      const self = _this;
      const firstTable = _this.model.tables[_this.tableOrder[0]];

      const remainingIds = _this.tableOrder.slice(1);

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$8(firstTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$c(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$c(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const sourceItem = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator$8(sourceItem.iterateAcrossConnections(remainingIds)), _step2, _value2; _step2 = yield _awaitAsyncGenerator$c(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator$c(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const lastItem = _value2;

              const newItem = _this._wrap({
                index: sourceItem.index + '⨯' + lastItem.index,
                itemsToConnect: [sourceItem, lastItem]
              });

              if (yield _awaitAsyncGenerator$c(self._finishItem(newItem))) {
                yield newItem;
              }
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                yield _awaitAsyncGenerator$c(_iterator2.return());
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
            yield _awaitAsyncGenerator$c(_iterator.return());
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

function _awaitAsyncGenerator$d(value) { return new _AwaitValue$d(value); }

function _wrapAsyncGenerator$d(fn) { return function () { return new _AsyncGenerator$d(fn.apply(this, arguments)); }; }

function _AsyncGenerator$d(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$d; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$d.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$d.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$d.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$d.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$d(value) { this.wrapped = value; }

function _asyncIterator$9(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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
    return this.model.createClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    options.overwrite = true;
    return this.model.createClass(options);
  }

  intepretAsGeneric() {
    const options = this._toRawObject();

    options.type = 'GenericClass';
    options.overwrite = true;
    return this.model.createClass(options);
  }

  expand(attribute) {
    return this.model.createClass({
      tableId: this.table.expand(attribute).tableId,
      type: this.constructor.name
    });
  }

  unroll(attribute) {
    return this.model.createClass({
      tableId: this.table.unroll(attribute).tableId,
      type: this.constructor.name
    });
  }

  promote(attribute) {
    return this.model.createClass({
      tableId: this.table.promote(attribute).tableId,
      type: this.constructor.name
    });
  }

  aggregate(attribute, options = {}) {
    options = Object.assign(this._toRawObject(), options, {
      classId: this.classId,
      overwrite: true,
      tableId: this.table.promote(attribute).tableId,
      type: this.constructor.name
    });
    return this.model.createClass(options);
  }

  dissolve(options = {}) {
    if (!this.canDissolve) {
      throw new Error(`Can't dissolve class that has table of type ${this.table.type}`);
    }

    options = Object.assign(this._toRawObject(), options, {
      classId: this.classId,
      overwrite: true,
      tableId: this.table.parentTable.tableId,
      type: this.constructor.name
    });
    return this.model.createClass(options);
  }

  get canDissolve() {
    return this.table.type === 'Promoted';
  }

  closedFacet(attribute, values) {
    return this.table.closedFacet(attribute, values).map(newTable => {
      return this.model.createClass({
        tableId: newTable.tableId,
        type: this.constructor.name
      });
    });
  }

  openFacet(attribute) {
    var _this = this;

    return _wrapAsyncGenerator$d(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$9(_this.table.openFacet(attribute)), _step, _value; _step = yield _awaitAsyncGenerator$d(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$d(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const newTable = _value;
          yield _this.model.createClass({
            tableId: newTable.tableId,
            type: _this.constructor.name
          });
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator$d(_iterator.return());
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
      return this.model.createClass({
        tableId: newTable.tableId,
        type: this.constructor.name
      });
    });
  }

  openTranspose() {
    var _this2 = this;

    return _wrapAsyncGenerator$d(function* () {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator$9(_this2.table.openTranspose()), _step2, _value2; _step2 = yield _awaitAsyncGenerator$d(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator$d(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const newTable = _value2;
          yield _this2.model.createClass({
            tableId: newTable.tableId,
            type: _this2.constructor.name
          });
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            yield _awaitAsyncGenerator$d(_iterator2.return());
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

  async countAllUniqueValues() {
    // TODO: this is wildly inefficient, especially for quantitative
    // attributes... currently doing this (under protest) for stats in the
    // connect interface. Maybe useful for writing histogram functions in
    // the future?
    const hashableBins = {};
    const unHashableCounts = {};
    const indexBin = {};
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;

    var _iteratorError3;

    try {
      for (var _iterator3 = _asyncIterator$9(this.table.iterate()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
        const item = _value3;
        indexBin[item.index] = 1; // always 1

        for (const [attr, value] of Object.entries(item.row)) {
          if (value === undefined || typeof value === 'object') {
            unHashableCounts[attr] = unHashableCounts[attr] || 0;
            unHashableCounts[attr]++;
          } else {
            hashableBins[attr] = hashableBins[attr] || {};
            hashableBins[attr][value] = hashableBins[attr][value] || 0;
            hashableBins[attr][value]++;
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

    return {
      hashableBins,
      unHashableCounts,
      indexBin
    };
  }

}

Object.defineProperty(GenericClass, 'type', {
  get() {
    return /(.*)Class/.exec(this.name)[1];
  }

});

function _wrapAsyncGenerator$e(fn) { return function () { return new _AsyncGenerator$e(fn.apply(this, arguments)); }; }

function _AsyncGenerator$e(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$e; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$e.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$e.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$e.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$e.prototype.return = function (arg) { return this._invoke("return", arg); };

function _awaitAsyncGenerator$e(value) { return new _AwaitValue$e(value); }

function _AwaitValue$e(value) { this.wrapped = value; }

function _asyncIterator$a(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

function _asyncGeneratorDelegate$2(inner, awaitWrap) { var iter = {}, waiting = false; function pump(key, value) { waiting = true; value = new Promise(function (resolve) { resolve(inner[key](value)); }); return { done: false, value: awaitWrap(value) }; } if (typeof Symbol === "function" && Symbol.iterator) { iter[Symbol.iterator] = function () { return this; }; } iter.next = function (value) { if (waiting) { waiting = false; return value; } return pump("next", value); }; if (typeof inner.throw === "function") { iter.throw = function (value) { if (waiting) { waiting = false; throw value; } return pump("throw", value); }; } if (typeof inner.return === "function") { iter.return = function (value) { return pump("return", value); }; } return iter; }

class NodeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  edges(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator$e(function* () {
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

      yield* _asyncGeneratorDelegate$2(_asyncIterator$a(_this.handleLimit(options, iterators)), _awaitAsyncGenerator$e);
    })();
  }

  neighborNodes(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator$e(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$a(_this2.edges()), _step, _value; _step = yield _awaitAsyncGenerator$e(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$e(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const edge = _value;

          const role = _this2.classObj.getEdgeRole(edge.classObj);

          if (role === 'both' || role === 'source') {
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;

            var _iteratorError2;

            try {
              for (var _iterator2 = _asyncIterator$a(edge.targetNodes(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator$e(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator$e(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                const target = _value2;

                if (_this2 !== target) {
                  yield target;
                }
              }
            } catch (err) {
              _didIteratorError2 = true;
              _iteratorError2 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                  yield _awaitAsyncGenerator$e(_iterator2.return());
                }
              } finally {
                if (_didIteratorError2) {
                  throw _iteratorError2;
                }
              }
            }
          }

          if (role === 'both' || role === 'target') {
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;

            var _iteratorError3;

            try {
              for (var _iterator3 = _asyncIterator$a(edge.sourceNodes(options)), _step3, _value3; _step3 = yield _awaitAsyncGenerator$e(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield _awaitAsyncGenerator$e(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
                const source = _value3;

                if (_this2 !== source) {
                  yield source;
                }
              }
            } catch (err) {
              _didIteratorError3 = true;
              _iteratorError3 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
                  yield _awaitAsyncGenerator$e(_iterator3.return());
                }
              } finally {
                if (_didIteratorError3) {
                  throw _iteratorError3;
                }
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
            yield _awaitAsyncGenerator$e(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }

  neighbors(options = {}) {
    var _this3 = this;

    return _wrapAsyncGenerator$e(function* () {
      yield* _asyncGeneratorDelegate$2(_asyncIterator$a(_this3.edges(options)), _awaitAsyncGenerator$e);
    })();
  }

  pairwiseNeighborhood(options) {
    var _this4 = this;

    return _wrapAsyncGenerator$e(function* () {
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;

      var _iteratorError4;

      try {
        for (var _iterator4 = _asyncIterator$a(_this4.edges()), _step4, _value4; _step4 = yield _awaitAsyncGenerator$e(_iterator4.next()), _iteratorNormalCompletion4 = _step4.done, _value4 = yield _awaitAsyncGenerator$e(_step4.value), !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
          const edge = _value4;
          yield* _asyncGeneratorDelegate$2(_asyncIterator$a(edge.pairwiseNeighborhood(options)), _awaitAsyncGenerator$e);
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
            yield _awaitAsyncGenerator$e(_iterator4.return());
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
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
    return this.model.createClass(options);
  }

  intepretAsGeneric() {
    this.disconnectAllEdges();
    return super.interpretAsGeneric();
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
    const newNodeClass = super.promote(attribute);
    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });
    return newNodeClass;
  }

  aggregate(attribute, options = {}) {
    const newClass = super.aggregate(attribute, options);

    for (const edgeClass of newClass.edgeClasses()) {
      const role = this.getEdgeRole(edgeClass);

      if (role === 'source' || role === 'both') {
        edgeClass.sourceTableIds.push(this.tableId);
      }

      if (role === 'target' || role === 'both') {
        edgeClass.targetTableIds.push(this.tableId);
      }
    }

    return newClass;
  }

  dissolve(options = {}) {
    const newClass = super.dissolve(options);

    for (const edgeClass of newClass.edgeClasses()) {
      const role = this.getEdgeRole(edgeClass);

      if (role === 'source' || role === 'both') {
        if (edgeClass.sourceTableIds.pop() !== newClass.tableId) {
          throw new Error(`Inconsistent tableIds when dissolving a node class`);
        }
      }

      if (role === 'target' || role === 'both') {
        if (edgeClass.targetTableIds.pop() !== newClass.tableId) {
          throw new Error(`Inconsistent tableIds when dissolving a node class`);
        }
      }
    }

    return newClass;
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
    const newNodeClass = super.expand(attribute);
    this.connectToChildNodeClass(newNodeClass);
    return newNodeClass;
  }

  unroll(attribute) {
    const newNodeClass = super.unroll(attribute);
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

function _wrapAsyncGenerator$f(fn) { return function () { return new _AsyncGenerator$f(fn.apply(this, arguments)); }; }

function _AsyncGenerator$f(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$f; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$f.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$f.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$f.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$f.prototype.return = function (arg) { return this._invoke("return", arg); };

function _awaitAsyncGenerator$f(value) { return new _AwaitValue$f(value); }

function _AwaitValue$f(value) { this.wrapped = value; }

function _asyncIterator$b(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

function _asyncGeneratorDelegate$3(inner, awaitWrap) { var iter = {}, waiting = false; function pump(key, value) { waiting = true; value = new Promise(function (resolve) { resolve(inner[key](value)); }); return { done: false, value: awaitWrap(value) }; } if (typeof Symbol === "function" && Symbol.iterator) { iter[Symbol.iterator] = function () { return this; }; } iter.next = function (value) { if (waiting) { waiting = false; return value; } return pump("next", value); }; if (typeof inner.throw === "function") { iter.throw = function (value) { if (waiting) { waiting = false; throw value; } return pump("throw", value); }; } if (typeof inner.return === "function") { iter.return = function (value) { return pump("return", value); }; } return iter; }

class EdgeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  sourceNodes(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator$f(function* () {
      if (_this.classObj.sourceClassId === null || options.classes && !options.classes.find(d => _this.classObj.sourceClassId === d.classId) || options.classIds && options.classIds.indexOf(_this.classObj.sourceClassId) === -1) {
        return;
      }

      const sourceTableId = _this.classObj.model.classes[_this.classObj.sourceClassId].tableId;

      const tableIds = _this.classObj.sourceTableIds.concat([sourceTableId]);

      yield* _asyncGeneratorDelegate$3(_asyncIterator$b(_this.handleLimit(options, [_this.iterateAcrossConnections(tableIds)])), _awaitAsyncGenerator$f);
    })();
  }

  targetNodes(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator$f(function* () {
      if (_this2.classObj.targetClassId === null || options.classes && !options.classes.find(d => _this2.classObj.targetClassId === d.classId) || options.classIds && options.classIds.indexOf(_this2.classObj.targetClassId) === -1) {
        return;
      }

      const targetTableId = _this2.classObj.model.classes[_this2.classObj.targetClassId].tableId;

      const tableIds = _this2.classObj.targetTableIds.concat([targetTableId]);

      yield* _asyncGeneratorDelegate$3(_asyncIterator$b(_this2.handleLimit(options, [_this2.iterateAcrossConnections(tableIds)])), _awaitAsyncGenerator$f);
    })();
  }

  nodes(options = {}) {
    var _this3 = this;

    return _wrapAsyncGenerator$f(function* () {
      yield* _asyncGeneratorDelegate$3(_asyncIterator$b(_this3.handleLimit(options, [_this3.sourceNodes(options), _this3.targetNodes(options)])), _awaitAsyncGenerator$f);
    })();
  }

  neighbors(options = {}) {
    var _this4 = this;

    return _wrapAsyncGenerator$f(function* () {
      yield* _asyncGeneratorDelegate$3(_asyncIterator$b(_this4.nodes(options)), _awaitAsyncGenerator$f);
    })();
  }

  pairwiseNeighborhood(options) {
    var _this5 = this;

    return _wrapAsyncGenerator$f(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$b(_this5.sourceNodes(options)), _step, _value; _step = yield _awaitAsyncGenerator$f(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$f(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const source = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator$b(_this5.targetNodes(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator$f(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator$f(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const target = _value2;
              yield {
                source,
                target,
                edge: _this5
              };
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                yield _awaitAsyncGenerator$f(_iterator2.return());
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
            yield _awaitAsyncGenerator$f(_iterator.return());
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

function _awaitAsyncGenerator$g(value) { return new _AwaitValue$g(value); }

function _wrapAsyncGenerator$g(fn) { return function () { return new _AsyncGenerator$g(fn.apply(this, arguments)); }; }

function _AsyncGenerator$g(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$g; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$g.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$g.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$g.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$g.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$g(value) { this.wrapped = value; }

function _asyncIterator$c(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

  *connectedClasses() {
    if (this.sourceClassId) {
      yield this.model.classes[this.sourceClassId];
    }

    if (this.targetClassId) {
      yield this.model.classes[this.targetClassId];
    }
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

    this.model.trigger('update');
    return newNodeClass;
  }

  interpretAsEdges() {
    return this;
  }

  intepretAsGeneric() {
    this.disconnectSource();
    this.disconnectTarget();
    return super.interpretAsGeneric();
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
      return super.promote(attribute);
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

  aggregate(attribute, options = {}) {
    const newClass = super.aggregate(attribute, options);
    newClass.sourceTableIds.unshift(this.tableId);
    newClass.targetTableIds.unshift(this.tableId);
    return newClass;
  }

  dissolve(options = {}) {
    const newClass = super.dissolve(options);

    if (newClass.sourceTableIds.shift() !== newClass.tableId) {
      throw new Error(`Inconsistent tableIds when dissolving an edge class`);
    }

    if (newClass.targetTableIds.shift() !== newClass.tableId) {
      throw new Error(`Inconsistent tableIds when dissolving an edge class`);
    }

    return newClass;
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

    return _wrapAsyncGenerator$g(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$c(_superprop_callOpenFacet(attribute)), _step, _value; _step = yield _awaitAsyncGenerator$g(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$g(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
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
            yield _awaitAsyncGenerator$g(_iterator.return());
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

function _asyncIterator$d(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }
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
        for (var _iterator = _asyncIterator$d(nodes.openFacet(classAttribute)), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
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
        for (var _iterator2 = _asyncIterator$d(edges.openFacet(classAttribute)), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const edgeClass = _value2;
          edgeClasses.push(edgeClass.interpretAsEdges());
          const sample = await edgeClass.table.getItem();
          const sourceClassName = await sample.row[sourceAttribute + '_' + classAttribute];

          if (nodeClassLookup[sourceClassName] !== undefined) {
            edgeClass.connectToNodeClass({
              nodeClass: nodeClasses[nodeClassLookup[sourceClassName]],
              side: 'source',
              nodeAttribute,
              edgeAttribute: sourceAttribute
            });
          }

          const targetClassName = await sample.row[targetAttribute + '_' + classAttribute];

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
          for (var _iterator3 = _asyncIterator$d(classObj.table.iterate()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
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
        for (var _iterator4 = _asyncIterator$d(nodeClass.table.iterate()), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
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
        for (var _iterator5 = _asyncIterator$d(edgeClass.table.iterate()), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
          const edge = _value5;
          const row = await this.buildRow(edge);
          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;

          var _iteratorError6;

          try {
            for (var _iterator6 = _asyncIterator$d(edge.sourceNodes({
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
                for (var _iterator7 = _asyncIterator$d(edge.targetNodes({
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

function _asyncIterator$e(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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
      const attributes = classObj.table.unSuppressedAttributes;
      let contents = `${indexName},${attributes.join(',')}\n`;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$e(classObj.table.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const item = _value;
          contents += `${item.index}`;

          for (const attr of attributes) {
            contents += `,${await item.row[attr]}`;
          }

          contents += `\n`;
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

function _asyncIterator$f(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }
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
          for (var _iterator = _asyncIterator$f(classObj.table.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
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
          for (var _iterator2 = _asyncIterator$f(classObj.table.iterate()), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
            const edge = _value2;
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;

            var _iteratorError3;

            try {
              for (var _iterator3 = _asyncIterator$f(edge.sourceNodes({
                classes: includeClasses
              })), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
                const source = _value3;
                var _iteratorNormalCompletion4 = true;
                var _didIteratorError4 = false;

                var _iteratorError4;

                try {
                  for (var _iterator4 = _asyncIterator$f(edge.targetNodes({
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

function _asyncIterator$g(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }
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

  createClass(options = {}) {
    while (!options.classId || !options.overwrite && this.classes[options.classId]) {
      options.classId = `class${this._nextClassId}`;
      this._nextClassId += 1;
    }

    if (this.tables[options.tableId].classObj && !options.overwrite) {
      options.tableId = this.tables[options.tableId].duplicate().tableId;
    }

    if (options.overwrite) {
      this.tables[options.tableId].reset();
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

  async getInstanceSample() {
    const seedLimit = 100;
    const clusterLimit = 5;
    const classCount = 5; // Try to get at most roughly seedCount nodes / edges, in clusters of about
    // clusterLimit, and try to include at least classCount instances per class
    // (may return null if caches are invalidated during iteration)

    let iterationReset = false;
    const instances = {};
    let totalCount = 0;
    const classCounts = {};

    const populateClassCounts = async instance => {
      if (instance.reset) {
        // Cache invalidated! Stop iterating and return null
        iterationReset = true;
        return false;
      }

      if (instances[instance.instanceId]) {
        // Don't add this instance if we already sampled it, but keep iterating
        return true;
      } // Add and count this instance to the sample


      instances[instance.instanceId] = instance;
      totalCount++;
      classCounts[instance.classObj.classId] = classCounts[instance.classObj.classId] || 0;
      classCounts[instance.classObj.classId]++;

      if (totalCount >= seedLimit) {
        // We have enough; stop iterating
        return false;
      } // Try to add the neighbors of this sample from classes where we don't have
      // enough samples yet


      const classIds = Object.keys(this.classes).filter(classId => {
        return (classCounts[classId] || 0) < classCount;
      });
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$g(instance.neighbors({
          limit: clusterLimit,
          classIds
        })), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const neighbor = _value;

          if (!(await populateClassCounts(neighbor))) {
            // Pass along the signal to stop iterating
            return false;
          }
        } // Signal that we should keep iterating

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

      return true;
    };

    for (const [classId, classObj] of Object.entries(this.classes)) {
      const rowCount = await classObj.table.countRows(); // Don't sample from GenericClasses

      if (classObj.type === 'Generic') {
        continue;
      } // Get at least classCount instances from this class (as long as we
      // haven't exhausted all the instances the class has to give)


      while ((classCounts[classId] || 0) < classCount && (classCounts[classId] || 0) < rowCount) {
        if (iterationReset) {
          // Cache invalidated; bail immediately
          return null;
        } // Add a random instance, and try to prioritize its neighbors in other classes


        if (!(await populateClassCounts((await classObj.table.getRandomItem())))) {
          break;
        }
      }
    }

    return instances;
  }

  validateInstanceSample(instances) {
    // Check if all the instances are still current; return null as a signal
    // that a cache was invalidated, and that a function needs to be called again
    for (const instance of Object.values(instances)) {
      if (instance.reset) {
        return null;
      }
    }

    return instances;
  }

  async updateInstanceSample(instances) {
    // Replace any out-of-date instances, and exclude instances that no longer exist
    const result = {};

    for (const [instanceId, instance] of Object.entries(instances)) {
      const {
        classId,
        index
      } = JSON.parse(instanceId);

      if (this.classes[classId]) {
        if (instance.reset) {
          const newInstance = await this.classes[classId].table.getItem(index);

          if (newInstance) {
            result[newInstance.instanceId] = newInstance;
          }
        } else {
          result[instanceId] = instance;
        }
      }
    }

    return this.validateInstanceSample(result);
  }

  partitionInstanceSample(instances) {
    // Separate samples by their type
    const result = {
      nodes: {},
      edges: {},
      generics: {}
    };

    for (const [instanceId, instance] of Object.entries(instances)) {
      if (instance.type === 'Node') {
        result.nodes[instanceId] = instance;
      } else if (instance.type === 'Edge') {
        result.edges[instanceId] = instance;
      } else {
        result.generics[instanceId] = instance;
      }
    }

    return result;
  }

  async fillInstanceSample(instances) {
    // Given a specific sample of the graph, add instances to ensure that:
    // 1. For every pair of nodes, any edges that exist between them should be added
    // 2. For every edge, ensure that at least one source and target node is added
    const {
      nodes,
      edges
    } = this.partitionInstanceSample(instances);
    const extraNodes = {};
    const extraEdges = {}; // Make sure that each edge has at least one source and one target (assuming
    // that source and target classes are connected)

    const seedSide = async (edge, iterFunc) => {
      let aNode;
      let isSeeded = false;
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;

      var _iteratorError5;

      try {
        for (var _iterator5 = _asyncIterator$g(edge[iterFunc]()), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
          const node = _value5;
          aNode = aNode || node;

          if (nodes[node.instanceId]) {
            isSeeded = true;
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

      if (!isSeeded && aNode) {
        extraNodes[aNode.instanceId] = aNode;
      }
    };

    for (const edge of Object.values(edges)) {
      await seedSide(edge, 'sourceNodes');
      await seedSide(edge, 'targetNodes');
    } // Add any edges that exist that connect any of the core nodes


    for (const node of Object.values(nodes)) {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator$g(node.edges()), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const edge = _value2;

          if (!edges[edge.instanceId]) {
            // Check that both ends of the edge connect at least one
            // of our nodes
            let connectsSource = false;
            let connectsTarget = false;
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;

            var _iteratorError3;

            try {
              for (var _iterator3 = _asyncIterator$g(edge.sourceNodes()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
                const node = _value3;

                if (nodes[node.instanceId]) {
                  connectsSource = true;
                  break;
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

            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;

            var _iteratorError4;

            try {
              for (var _iterator4 = _asyncIterator$g(edge.targetNodes()), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                const node = _value4;

                if (nodes[node.instanceId]) {
                  connectsTarget = true;
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

            if (connectsSource && connectsTarget) {
              extraEdges[edge.instanceId] = edge;
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
    } // At this point we have a complete set of nodes and edges that we want to
    // include. We just need to merge and validate the samples:


    instances = Object.assign({}, nodes, edges, extraNodes, extraEdges);
    return this.validateInstanceSample(instances);
  }

  async instanceSampleToGraph(instances) {
    const graph = {
      nodes: [],
      nodeLookup: {},
      edges: []
    };
    const {
      nodes,
      edges
    } = this.partitionInstanceSample(instances); // Make a list of nodes, plus a lookup to each node's index

    for (const [instanceId, node] of Object.entries(nodes)) {
      graph.nodeLookup[instanceId] = graph.nodes.length;
      graph.nodes.push({
        nodeInstance: node,
        dummy: false
      });
    } // Add all the edges, including dummy nodes for dangling edges


    for (const edge of Object.values(edges)) {
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
            for (var _iterator6 = _asyncIterator$g(edge.targetNodes()), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
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
          for (var _iterator7 = _asyncIterator$g(edge.sourceNodes()), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
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
        // (only create dummy nodes for edges that are actually disconnected)
        var _iteratorNormalCompletion8 = true;
        var _didIteratorError8 = false;

        var _iteratorError8;

        try {
          for (var _iterator8 = _asyncIterator$g(edge.sourceNodes()), _step8, _value8; _step8 = await _iterator8.next(), _iteratorNormalCompletion8 = _step8.done, _value8 = await _step8.value, !_iteratorNormalCompletion8; _iteratorNormalCompletion8 = true) {
            const sourceNode = _value8;

            if (graph.nodeLookup[sourceNode.instanceId] !== undefined) {
              var _iteratorNormalCompletion9 = true;
              var _didIteratorError9 = false;

              var _iteratorError9;

              try {
                for (var _iterator9 = _asyncIterator$g(edge.targetNodes()), _step9, _value9; _step9 = await _iterator9.next(), _iteratorNormalCompletion9 = _step9.done, _value9 = await _step9.value, !_iteratorNormalCompletion9; _iteratorNormalCompletion9 = true) {
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
var version = "0.2.7";
var description = "A library for flexible graph reshaping";
var main = "dist/origraph.cjs.js";
var module = "dist/origraph.esm.js";
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
	"@babel/core": "^7.3.4",
	"@babel/plugin-proposal-async-generator-functions": "^7.2.0",
	"@babel/preset-env": "^7.3.4",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^24.3.1",
	coveralls: "^3.0.3",
	jest: "^24.3.1",
	rollup: "^1.5.0",
	"rollup-plugin-babel": "^4.3.2",
	"rollup-plugin-commonjs": "^9.2.1",
	"rollup-plugin-istanbul": "^2.0.1",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.4.0",
	"rollup-plugin-node-resolve": "^4.0.1",
	sha1: "^1.1.1"
};
var dependencies = {
	d3: "^5.9.1",
	datalib: "^1.9.2",
	filereader: "^0.10.3",
	jszip: "^3.2.0",
	"mime-types": "^2.1.22"
};
var peerDependencies = {
	d3: "^5.4.0"
};
var pkg = {
	name: name,
	version: version,
	description: description,
	main: main,
	module: module,
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0F0dHJUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9tb3RlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0R1cGxpY2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ2hpbGRUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9QYXJlbnRDaGlsZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9qZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0LmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL1BhcnNlRmFpbHVyZS5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9EM0pzb24uanMiLCIuLi9zcmMvRmlsZUZvcm1hdHMvQ3N2WmlwLmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL0dFWEYuanMiLCIuLi9zcmMvQ29tbW9uL05ldHdvcmtNb2RlbC5qcyIsIi4uL3NyYy9PcmlncmFwaC5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSB8fFxuICAgICAgICB7ICcnOiBbXSB9O1xuICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnB1c2goY2FsbGJhY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSA9IGNhbGxiYWNrO1xuICAgICAgfVxuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXSA9IFtdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnQsIC4uLmFyZ3MpIHtcbiAgICAgIGNvbnN0IGhhbmRsZUNhbGxiYWNrID0gY2FsbGJhY2sgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH07XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgZm9yIChjb25zdCBuYW1lc3BhY2Ugb2YgT2JqZWN0LmtleXModGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pKSB7XG4gICAgICAgICAgaWYgKG5hbWVzcGFjZSA9PT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5mb3JFYWNoKGhhbmRsZUNhbGxiYWNrKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGFuZGxlQ2FsbGJhY2sodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zID0gb3B0aW9ucy5kdXBsaWNhdGVJdGVtcyB8fCBbXTtcbiAgfVxuICByZWdpc3RlckR1cGxpY2F0ZSAoaXRlbSkge1xuICAgIHRoaXMuZHVwbGljYXRlSXRlbXMucHVzaChpdGVtKTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBkdXAgb2YgdGhpcy5kdXBsaWNhdGVJdGVtcykge1xuICAgICAgaXRlbS5jb25uZWN0SXRlbShkdXApO1xuICAgICAgZHVwLmNvbm5lY3RJdGVtKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBge1wiY2xhc3NJZFwiOlwiJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XCIsXCJpbmRleFwiOlwiJHt0aGlzLmluZGV4fVwifWA7XG4gIH1cbiAgZ2V0IGV4cG9ydElkICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jbGFzc09iai5jbGFzc0lkfV8ke3RoaXMuaW5kZXh9YDtcbiAgfVxuICBnZXQgbGFiZWwgKCkge1xuICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLmFubm90YXRpb25zLmxhYmVsQXR0ciA/IHRoaXMucm93W3RoaXMuY2xhc3NPYmouYW5ub3RhdGlvbnMubGFiZWxBdHRyXSA6IHRoaXMuaW5kZXg7XG4gIH1cbiAgZXF1YWxzIChpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zdGFuY2VJZCA9PT0gaXRlbS5pbnN0YW5jZUlkO1xuICB9XG4gIGFzeW5jICogaGFuZGxlTGltaXQgKG9wdGlvbnMsIGl0ZXJhdG9ycykge1xuICAgIGxldCBsaW1pdCA9IEluZmluaXR5O1xuICAgIGlmIChvcHRpb25zLmxpbWl0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxpbWl0ID0gb3B0aW9ucy5saW1pdDtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIH1cbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBpdGVyYXRvciBvZiBpdGVyYXRvcnMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBpdGVyYXRvcikge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICBpKys7XG4gICAgICAgIGlmIChpdGVtID09PSBudWxsIHx8IGkgPj0gbGltaXQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIHlpZWxkICogdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKTtcbiAgfVxuICAqIF9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgaWYgKHRoaXMucmVzZXQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbmV4dFRhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW25leHRUYWJsZUlkXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1tuZXh0VGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9saW1pdFByb21pc2VzID0ge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaGFzIGFscmVhZHkgYmVlbiBidWlsdDsganVzdCBncmFiIGRhdGEgZnJvbSBpdCBkaXJlY3RseVxuICAgICAgeWllbGQgKiB0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGUgJiYgdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkLCBidXQgaXQncyBhbHJlYWR5IGxvbmcgZW5vdWdoIHRvIHNhdGlzZnkgdGhpc1xuICAgICAgLy8gcmVxdWVzdFxuICAgICAgeWllbGQgKiB0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQgYnVpbGRpbmcgKGFuZCBtYXliZSBkaWRuJ3QgZXZlbiBzdGFydCB5ZXQpO1xuICAgICAgLy8ga2ljayBpdCBvZmYsIGFuZCB0aGVuIHdhaXQgZm9yIGVub3VnaCBpdGVtcyB0byBiZSBwcm9jZXNzZWQgdG8gc2F0aXNmeVxuICAgICAgLy8gdGhlIGxpbWl0XG4gICAgICB0aGlzLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIHlpZWxkICogYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSA9IHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdIHx8IFtdO1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgdGVtcCA9PT0gbnVsbCkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSkpIHtcbiAgICAgICAgICAvLyBPa2F5LCB0aGlzIGl0ZW0gcGFzc2VkIGFsbCBmaWx0ZXJzLCBhbmQgaXMgcmVhZHkgdG8gYmUgc2VudCBvdXRcbiAgICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt0ZW1wLnZhbHVlLmluZGV4XSA9IHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGg7XG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBkYXRhIG5vdyB0byBzYXRpc2Z5IGFueSB3YWl0aW5nIHJlcXVlc3RzXG4gICAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB0aGlzLl9jYWNoZUxvb2t1cCA9IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NhY2hlQnVpbHQnKTtcbiAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgfVxuICBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy8gVGhlIHNldFRpbWVvdXQgaGVyZSBpcyBhYnNvbHV0ZWx5IG5lY2Vzc2FyeSwgb3IgdGhpcy5fY2FjaGVQcm9taXNlXG4gICAgICAgIC8vIHdvbid0IGJlIHN0b3JlZCBpbiB0aW1lIGZvciB0aGUgbmV4dCBidWlsZENhY2hlKCkgY2FsbCB0aGF0IGNvbWVzXG4gICAgICAgIC8vIHRocm91Z2hcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5fYnVpbGRDYWNoZShyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBjb25zdCBpdGVtc1RvUmVzZXQgPSAodGhpcy5fY2FjaGUgfHwgW10pXG4gICAgICAuY29uY2F0KHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSk7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zVG9SZXNldCkge1xuICAgICAgaXRlbS5yZXNldCA9IHRydWU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGhhbmRsZVJlc2V0IChyZWplY3QpIHtcbiAgICBmb3IgKGNvbnN0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5yZWplY3QoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzO1xuICAgIH1cbiAgICByZWplY3QoKTtcbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5idWlsZENhY2hlKCkpLmxlbmd0aDtcbiAgfVxuICBhc3luYyBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgICBpZiAod3JhcHBlZEl0ZW0ucm93W2F0dHJdIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3cgPSB3cmFwcGVkSXRlbS5kZWxheWVkUm93IHx8IHt9O1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3dbYXR0cl0gPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZnVuYyBvZiBPYmplY3QudmFsdWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBhd2FpdCBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICAgIGlmICgha2VlcCkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoa2VlcCkge1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyYXBwZWRJdGVtLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbHRlcicpO1xuICAgIH1cbiAgICByZXR1cm4ga2VlcDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gICAgZm9yIChjb25zdCBvdGhlckl0ZW0gb2Ygb3B0aW9ucy5pdGVtc1RvQ29ubmVjdCB8fCBbXSkge1xuICAgICAgd3JhcHBlZEl0ZW0uY29ubmVjdEl0ZW0ob3RoZXJJdGVtKTtcbiAgICAgIG90aGVySXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICAvLyBBbGxvdyBwcm9iaW5nIHRvIHNlZSB3aGF0ZXZlciBkYXRhIGhhcHBlbnMgdG8gYmUgYXZhaWxhYmxlXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6IHRoaXMuX2NhY2hlIHx8IHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSxcbiAgICAgIGxvb2t1cDogdGhpcy5fY2FjaGVMb29rdXAgfHwgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGFzeW5jIF9nZXRJdGVtIChpbmRleCA9IG51bGwpIHtcbiAgICAvLyBTdHVwaWQgYXBwcm9hY2ggd2hlbiB0aGUgY2FjaGUgaXNuJ3QgYnVpbHQ6IGludGVyYXRlIHVudGlsIHdlIHNlZSB0aGVcbiAgICAvLyBpbmRleC4gU3ViY2xhc3NlcyBjb3VsZCBvdmVycmlkZSB0aGlzXG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZSgpKSB7XG4gICAgICBpZiAoaXRlbSA9PT0gbnVsbCB8fCBpdGVtLmluZGV4ID09PSBpbmRleCkge1xuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYXN5bmMgZ2V0SXRlbSAoaW5kZXggPSBudWxsKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlTG9va3VwKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9jYWNoZVswXSA6IHRoaXMuX2NhY2hlW3RoaXMuX2NhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgJiZcbiAgICAgICAgKChpbmRleCA9PT0gbnVsbCAmJiB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9wYXJ0aWFsQ2FjaGVbMF1cbiAgICAgICAgOiB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9nZXRJdGVtKGluZGV4KTtcbiAgfVxuICBhc3luYyBnZXRSYW5kb21JdGVtICgpIHtcbiAgICBjb25zdCByYW5kSW5kZXggPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhd2FpdCB0aGlzLmNvdW50Um93cygpKTtcbiAgICByZXR1cm4gdGhpcy5fY2FjaGVbcmFuZEluZGV4XTtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0IHN1cHByZXNzZWRBdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpO1xuICB9XG4gIGdldCB1blN1cHByZXNzZWRBdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gdGhpcy5hdHRyaWJ1dGVzLmZpbHRlcihhdHRyID0+ICF0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyXSk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgdW5TdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYWRkRmlsdGVyIChmdW5jLCBhdHRyaWJ1dGUgPSBudWxsKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdQcm9tb3RlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnVW5yb2xsZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGR1cGxpY2F0ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdEdXBsaWNhdGVkVGFibGUnXG4gICAgfSk7XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QsIHR5cGUgPSAnQ29ubmVjdGVkVGFibGUnKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHsgdHlwZSB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBwcm9qZWN0ICh0YWJsZUlkcykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnUHJvamVjdGVkVGFibGUnLFxuICAgICAgdGFibGVPcmRlcjogW3RoaXMudGFibGVJZF0uY29uY2F0KHRhYmxlSWRzKVxuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZUlkIG9mIHRhYmxlSWRzKSB7XG4gICAgICBjb25zdCBvdGhlclRhYmxlID0gdGhpcy5tb2RlbC50YWJsZXNbb3RoZXJUYWJsZUlkXTtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3Nlcykuc29tZShjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGVJZCA9PT0gdGhpcy50YWJsZUlkIHx8XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTEgfHxcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKGZvcmNlID0gZmFsc2UpIHtcbiAgICBpZiAoIWZvcmNlICYmIHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX25hbWU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY0RpY3RUYWJsZTtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWlyZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY29uc3QgQXR0clRhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihzdXBlcmNsYXNzKSB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkF0dHJUYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuICAgIGdldFNvcnRIYXNoICgpIHtcbiAgICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgICBnZXQgbmFtZSAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQXR0clRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBBdHRyVGFibGVNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBBdHRyVGFibGVNaXhpbiBmcm9tICcuL0F0dHJUYWJsZU1peGluLmpzJztcblxuY2xhc3MgUHJvbW90ZWRUYWJsZSBleHRlbmRzIEF0dHJUYWJsZU1peGluKFRhYmxlKSB7XG4gIGFzeW5jIF9idWlsZENhY2hlIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHdlIGRvbid0IGFjdHVhbGx5IHdhbnQgdG8gY2FsbCBfZmluaXNoSXRlbVxuICAgIC8vIHVudGlsIGFsbCB1bmlxdWUgdmFsdWVzIGhhdmUgYmVlbiBzZWVuXG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlID0gW107XG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwID0ge307XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IHRlbXAgPSB7IGRvbmU6IGZhbHNlIH07XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUpIHtcbiAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSB8fCB0ZW1wID09PSBudWxsKSB7XG4gICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAvLyB0aGF0IHdhcyB3YWl0aW5nIG9uIHVzIGtub3cgdGhhdCB3ZSBjYW4ndCBjb21wbHlcbiAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbdGVtcC52YWx1ZS5pbmRleF0gPSB0aGlzLl91bmZpbmlzaGVkQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gT2theSwgbm93IHdlJ3ZlIHNlZW4gZXZlcnl0aGluZzsgd2UgY2FuIGNhbGwgX2ZpbmlzaEl0ZW0gb24gZWFjaCBvZiB0aGVcbiAgICAvLyB1bmlxdWUgdmFsdWVzXG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdGhpcy5fdW5maW5pc2hlZENhY2hlKSB7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh2YWx1ZSkpIHtcbiAgICAgICAgLy8gT2theSwgdGhpcyBpdGVtIHBhc3NlZCBhbGwgZmlsdGVycywgYW5kIGlzIHJlYWR5IHRvIGJlIHNlbnQgb3V0XG4gICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt2YWx1ZS5pbmRleF0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUucHVzaCh2YWx1ZSk7XG4gICAgICAgIGkrKztcbiAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggZGF0YSBub3cgdG8gc2F0aXNmeSBhbnkgd2FpdGluZyByZXF1ZXN0c1xuICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUodGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwO1xuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgdGhpcy5fY2FjaGVMb29rdXAgPSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICB9XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgdGhpcy50cmlnZ2VyKCdjYWNoZUJ1aWx0Jyk7XG4gICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGxldCBpbmRleCA9IGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAodHlwZW9mIGluZGV4ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBEb24ndCBwcm9tb3RlIFtvYmplY3QgT2JqZWN0XSBhcyBhIHZhbHVlIChpZ25vcmUgdW5oYXNoYWJsZSB2YWx1ZXMpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaW5kZXggPSBTdHJpbmcoaW5kZXgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldCFcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fdW5maW5pc2hlZENhY2hlW3RoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgICAgICBleGlzdGluZ0l0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0oZXhpc3RpbmdJdGVtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBGYWNldGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSB8fCAhdGhpcy5fdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgYW5kIHZhbHVlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGUgKyB0aGlzLl92YWx1ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIFN0cmluZyh0aGlzLl92YWx1ZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgaWYgKGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgVHJhbnNwb3NlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuX2luZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouaW5kZXggPSB0aGlzLl9pbmRleDtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2luZGV4O1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5faW5kZXh9YDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgYXdhaXQgdGhpcy5wYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG5cbiAgICAvLyBJdGVyYXRlIHRoZSByb3cncyBhdHRyaWJ1dGVzIGFzIGluZGV4ZXNcbiAgICBjb25zdCB3cmFwcGVkUGFyZW50ID0gdGhpcy5wYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5wYXJlbnRUYWJsZS5fY2FjaGVMb29rdXBbdGhpcy5faW5kZXhdXSB8fCB7IHJvdzoge30gfTtcbiAgICBmb3IgKGxldCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgdmFsdWUgPSBhd2FpdCB2YWx1ZTtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJz0nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuZ2V0U29ydEhhc2goKSkuam9pbignPScpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIERvbid0IHRyeSB0byBjb25uZWN0IHZhbHVlcyB1bnRpbCBhbGwgb2YgdGhlIHBhcmVudCB0YWJsZXMnIGNhY2hlcyBhcmVcbiAgICAvLyBidWlsdDsgVE9ETzogbWlnaHQgYmUgYWJsZSB0byBkbyBzb21ldGhpbmcgbW9yZSByZXNwb25zaXZlIGhlcmU/XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwocGFyZW50VGFibGVzLm1hcChwVGFibGUgPT4gcFRhYmxlLmJ1aWxkQ2FjaGUoKSkpO1xuXG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGVMb29rdXApIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cCkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldFxuICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XSAhPT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAvLyBObyBtYXRjaCBpbiBvbmUgb2YgdGhlIG90aGVyIHRhYmxlczsgb21pdCB0aGlzIGl0ZW1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPOiBhZGQgZWFjaCBwYXJlbnQgdGFibGVzJyBrZXlzIGFzIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBwYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLl9jYWNoZVt0YWJsZS5fY2FjaGVMb29rdXBbaW5kZXhdXSlcbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBEdXBsaWNhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gWWllbGQgdGhlIHNhbWUgaXRlbXMgd2l0aCB0aGUgc2FtZSBjb25uZWN0aW9ucywgYnV0IHdyYXBwZWQgYW5kIGZpbmlzaGVkXG4gICAgLy8gYnkgdGhpcyB0YWJsZVxuICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLnBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleDogaXRlbS5pbmRleCxcbiAgICAgICAgcm93OiBpdGVtLnJvdyxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IE9iamVjdC52YWx1ZXMoaXRlbS5jb25uZWN0ZWRJdGVtcykucmVkdWNlKChhZ2csIGl0ZW1MaXN0KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoaXRlbUxpc3QpO1xuICAgICAgICB9LCBbXSlcbiAgICAgIH0pO1xuICAgICAgaXRlbS5yZWdpc3RlckR1cGxpY2F0ZShuZXdJdGVtKTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBEdXBsaWNhdGVkVGFibGU7XG4iLCJpbXBvcnQgQXR0clRhYmxlTWl4aW4gZnJvbSAnLi9BdHRyVGFibGVNaXhpbi5qcyc7XG5cbmNvbnN0IENoaWxkVGFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIEF0dHJUYWJsZU1peGluKHN1cGVyY2xhc3MpIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mQ2hpbGRUYWJsZU1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSBzdXBlci5fd3JhcChvcHRpb25zKTtcbiAgICAgIG5ld0l0ZW0ucGFyZW50SW5kZXggPSBvcHRpb25zLnBhcmVudEluZGV4O1xuICAgICAgcmV0dXJuIG5ld0l0ZW07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDaGlsZFRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZDaGlsZFRhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQ2hpbGRUYWJsZU1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IENoaWxkVGFibGVNaXhpbiBmcm9tICcuL0NoaWxkVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBDaGlsZFRhYmxlTWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93ICE9PSB1bmRlZmluZWQgJiYgcm93ICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHJvdykubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXSxcbiAgICAgICAgICBwYXJlbnRJbmRleDogd3JhcHBlZFBhcmVudC5pbmRleFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgQ2hpbGRUYWJsZU1peGluIGZyb20gJy4vQ2hpbGRUYWJsZU1peGluLmpzJztcblxuY2xhc3MgVW5yb2xsZWRUYWJsZSBleHRlbmRzIENoaWxkVGFibGVNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3Qgcm93cyA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93cyAhPT0gdW5kZWZpbmVkICYmIHJvd3MgIT09IG51bGwgJiZcbiAgICAgICAgICB0eXBlb2Ygcm93c1tTeW1ib2wuaXRlcmF0b3JdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgcm93IG9mIHJvd3MpIHtcbiAgICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIHJvdyxcbiAgICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXSxcbiAgICAgICAgICAgIHBhcmVudEluZGV4OiB3cmFwcGVkUGFyZW50LmluZGV4XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVW5yb2xsZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgUGFyZW50Q2hpbGRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbignLycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5nZXRTb3J0SGFzaCgpKS5qb2luKCcsJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgbGV0IHBhcmVudFRhYmxlLCBjaGlsZFRhYmxlO1xuICAgIGlmICh0aGlzLnBhcmVudFRhYmxlc1swXS5wYXJlbnRUYWJsZSA9PT0gdGhpcy5wYXJlbnRUYWJsZXNbMV0pIHtcbiAgICAgIHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMV07XG4gICAgICBjaGlsZFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMF07XG4gICAgfSBlbHNlIGlmICh0aGlzLnBhcmVudFRhYmxlc1sxXS5wYXJlbnRUYWJsZSA9PT0gdGhpcy5wYXJlbnRUYWJsZXNbMF0pIHtcbiAgICAgIHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMF07XG4gICAgICBjaGlsZFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50Q2hpbGRUYWJsZSBub3Qgc2V0IHVwIHByb3Blcmx5YCk7XG4gICAgfVxuXG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNoaWxkIG9mIGNoaWxkVGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBwYXJlbnQgPSBhd2FpdCBwYXJlbnRUYWJsZS5nZXRJdGVtKGNoaWxkLnBhcmVudEluZGV4KTtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbcGFyZW50LCBjaGlsZF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFBhcmVudENoaWxkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFByb2plY3RlZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMudGFibGVPcmRlciA9IG9wdGlvbnMudGFibGVPcmRlcjtcbiAgICBpZiAoIXRoaXMudGFibGVPcmRlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YWJsZU9yZGVyIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZU9yZGVyLm1hcCh0YWJsZUlkID0+IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMudGFibGVPcmRlclxuICAgICAgLm1hcCh0YWJsZUlkID0+IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLmdldFNvcnRIYXNoKCkpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgY29uc3QgZmlyc3RUYWJsZSA9IHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVPcmRlclswXV07XG4gICAgY29uc3QgcmVtYWluaW5nSWRzID0gdGhpcy50YWJsZU9yZGVyLnNsaWNlKDEpO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlSXRlbSBvZiBmaXJzdFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBsYXN0SXRlbSBvZiBzb3VyY2VJdGVtLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhyZW1haW5pbmdJZHMpKSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleDogc291cmNlSXRlbS5pbmRleCArICfiqK8nICsgbGFzdEl0ZW0uaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFtzb3VyY2VJdGVtLCBsYXN0SXRlbV1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCBzZWxmLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUHJvamVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb25zID0gb3B0aW9ucy5hbm5vdGF0aW9ucyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zXG4gICAgfTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSArIHRoaXMuY2xhc3NOYW1lO1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHNldEFubm90YXRpb24gKGtleSwgdmFsdWUpIHtcbiAgICB0aGlzLmFubm90YXRpb25zW2tleV0gPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZUFubm90YXRpb24gKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLmFubm90YXRpb25zW2tleV07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXByZXRBc0dlbmVyaWMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdHZW5lcmljQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgIH0pO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZS51bnJvbGwoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgfSk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgIH0pO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlLCBvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zID0gT2JqZWN0LmFzc2lnbih0aGlzLl90b1Jhd09iamVjdCgpLCBvcHRpb25zLCB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBvdmVyd3JpdGU6IHRydWUsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgZGlzc29sdmUgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICghdGhpcy5jYW5EaXNzb2x2ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkaXNzb2x2ZSBjbGFzcyB0aGF0IGhhcyB0YWJsZSBvZiB0eXBlICR7dGhpcy50YWJsZS50eXBlfWApO1xuICAgIH1cbiAgICBvcHRpb25zID0gT2JqZWN0LmFzc2lnbih0aGlzLl90b1Jhd09iamVjdCgpLCBvcHRpb25zLCB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBvdmVyd3JpdGU6IHRydWUsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnBhcmVudFRhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWVcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBnZXQgY2FuRGlzc29sdmUgKCkge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLnR5cGUgPT09ICdQcm9tb3RlZCc7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgICB0eXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWVcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAoKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5UcmFuc3Bvc2UoKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMubW9kZWwub3B0aW1pemVUYWJsZXMoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jIGNvdW50QWxsVW5pcXVlVmFsdWVzICgpIHtcbiAgICAvLyBUT0RPOiB0aGlzIGlzIHdpbGRseSBpbmVmZmljaWVudCwgZXNwZWNpYWxseSBmb3IgcXVhbnRpdGF0aXZlXG4gICAgLy8gYXR0cmlidXRlcy4uLiBjdXJyZW50bHkgZG9pbmcgdGhpcyAodW5kZXIgcHJvdGVzdCkgZm9yIHN0YXRzIGluIHRoZVxuICAgIC8vIGNvbm5lY3QgaW50ZXJmYWNlLiBNYXliZSB1c2VmdWwgZm9yIHdyaXRpbmcgaGlzdG9ncmFtIGZ1bmN0aW9ucyBpblxuICAgIC8vIHRoZSBmdXR1cmU/XG4gICAgY29uc3QgaGFzaGFibGVCaW5zID0ge307XG4gICAgY29uc3QgdW5IYXNoYWJsZUNvdW50cyA9IHt9O1xuICAgIGNvbnN0IGluZGV4QmluID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBpbmRleEJpbltpdGVtLmluZGV4XSA9IDE7IC8vIGFsd2F5cyAxXG4gICAgICBmb3IgKGNvbnN0IFthdHRyLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoaXRlbS5yb3cpKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB1bkhhc2hhYmxlQ291bnRzW2F0dHJdID0gdW5IYXNoYWJsZUNvdW50c1thdHRyXSB8fCAwO1xuICAgICAgICAgIHVuSGFzaGFibGVDb3VudHNbYXR0cl0rKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBoYXNoYWJsZUJpbnNbYXR0cl0gPSBoYXNoYWJsZUJpbnNbYXR0cl0gfHwge307XG4gICAgICAgICAgaGFzaGFibGVCaW5zW2F0dHJdW3ZhbHVlXSA9IGhhc2hhYmxlQmluc1thdHRyXVt2YWx1ZV0gfHwgMDtcbiAgICAgICAgICBoYXNoYWJsZUJpbnNbYXR0cl1bdmFsdWVdKys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgaGFzaGFibGVCaW5zLCB1bkhhc2hhYmxlQ291bnRzLCBpbmRleEJpbiB9O1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogZWRnZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGxldCBlZGdlSWRzID0gb3B0aW9ucy5jbGFzc2VzXG4gICAgICA/IG9wdGlvbnMuY2xhc3Nlcy5tYXAoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NJZClcbiAgICAgIDogb3B0aW9ucy5jbGFzc0lkcyB8fCBPYmplY3Qua2V5cyh0aGlzLmNsYXNzT2JqLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3QgaXRlcmF0b3JzID0gW107XG4gICAgZm9yIChjb25zdCBlZGdlSWQgb2YgZWRnZUlkcykge1xuICAgICAgaWYgKCF0aGlzLmNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tlZGdlSWRdKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5jbGFzc09iai5tb2RlbC5jbGFzc2VzW2VkZ2VJZF07XG4gICAgICBjb25zdCByb2xlID0gdGhpcy5jbGFzc09iai5nZXRFZGdlUm9sZShlZGdlQ2xhc3MpO1xuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAnc291cmNlJykge1xuICAgICAgICBjb25zdCB0YWJsZUlkcyA9IGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGl0ZXJhdG9ycy5wdXNoKHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSk7XG4gICAgICB9XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnIHx8IHJvbGUgPT09ICd0YXJnZXQnKSB7XG4gICAgICAgIGNvbnN0IHRhYmxlSWRzID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgICAgaXRlcmF0b3JzLnB1c2godGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIGl0ZXJhdG9ycyk7XG4gIH1cbiAgYXN5bmMgKiBuZWlnaGJvck5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgdGhpcy5lZGdlcygpKSB7XG4gICAgICBjb25zdCByb2xlID0gdGhpcy5jbGFzc09iai5nZXRFZGdlUm9sZShlZGdlLmNsYXNzT2JqKTtcbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgZWRnZS50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgICAgIGlmICh0aGlzICE9PSB0YXJnZXQpIHtcbiAgICAgICAgICAgIHlpZWxkIHRhcmdldDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgZWRnZS5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgICAgIGlmICh0aGlzICE9PSBzb3VyY2UpIHtcbiAgICAgICAgICAgIHlpZWxkIHNvdXJjZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBuZWlnaGJvcnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIHlpZWxkICogdGhpcy5lZGdlcyhvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlTmVpZ2hib3Job29kIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIHRoaXMuZWRnZXMoKSkge1xuICAgICAgeWllbGQgKiBlZGdlLnBhaXJ3aXNlTmVpZ2hib3Job29kKG9wdGlvbnMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuaW1wb3J0IE5vZGVXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkcyA9IG9wdGlvbnMuZWRnZUNsYXNzSWRzIHx8IHt9O1xuICB9XG4gICogZWRnZUNsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBnZXRFZGdlUm9sZSAoZWRnZUNsYXNzKSB7XG4gICAgaWYgKCF0aGlzLmVkZ2VDbGFzc0lkc1tlZGdlQ2xhc3MuY2xhc3NJZF0pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgcmV0dXJuICdib3RoJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnc291cmNlJztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgIHJldHVybiAndGFyZ2V0JztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnRlcm5hbCBtaXNtYXRjaCBiZXR3ZWVuIG5vZGUgYW5kIGVkZ2UgY2xhc3NJZHNgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuZWRnZUNsYXNzSWRzID0gdGhpcy5lZGdlQ2xhc3NJZHM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgTm9kZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoeyBhdXRvY29ubmVjdCA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICBpZiAoIWF1dG9jb25uZWN0IHx8IGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIC8vIEFyZSB3ZSB0aGUgc291cmNlIG9yIHRhcmdldCBvZiB0aGUgZXhpc3RpbmcgZWRnZSAoaW50ZXJuYWxseSwgaW4gdGVybXNcbiAgICAgIC8vIG9mIHNvdXJjZUlkIC8gdGFyZ2V0SWQsIG5vdCBlZGdlQ2xhc3MuZGlyZWN0aW9uKT9cbiAgICAgIGNvbnN0IGlzU291cmNlID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZDtcblxuICAgICAgLy8gQXMgd2UncmUgY29udmVydGVkIHRvIGFuIGVkZ2UsIG91ciBuZXcgcmVzdWx0aW5nIHNvdXJjZSBBTkQgdGFyZ2V0XG4gICAgICAvLyBzaG91bGQgYmUgd2hhdGV2ZXIgaXMgYXQgdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MgKGlmIGFueXRoaW5nKVxuICAgICAgaWYgKGlzU291cmNlKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgICB9XG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIG5vZGUgY2xhc3Mgb24gdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MsIGFkZCBvdXJcbiAgICAgIC8vIGlkIHRvIGl0cyBsaXN0IG9mIGNvbm5lY3Rpb25zXG4gICAgICBjb25zdCBub2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGlmIChub2RlQ2xhc3MpIHtcbiAgICAgICAgbm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdGFibGVJZCBsaXN0cyBzaG91bGQgZW1hbmF0ZSBvdXQgZnJvbSB0aGUgKG5ldykgZWRnZSB0YWJsZTsgYXNzdW1pbmdcbiAgICAgIC8vIChmb3IgYSBtb21lbnQpIHRoYXQgaXNTb3VyY2UgPT09IHRydWUsIHdlJ2QgY29uc3RydWN0IHRoZSB0YWJsZUlkIGxpc3RcbiAgICAgIC8vIGxpa2UgdGhpczpcbiAgICAgIGxldCB0YWJsZUlkTGlzdCA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgZWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKCFpc1NvdXJjZSkge1xuICAgICAgICAvLyBXaG9vcHMsIGdvdCBpdCBiYWNrd2FyZHMhXG4gICAgICAgIHRhYmxlSWRMaXN0LnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBlZGdlQ2xhc3MuZGlyZWN0ZWQ7XG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhYmxlSWRMaXN0O1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgLy8gT2theSwgd2UndmUgZ290IHR3byBlZGdlcywgc28gdGhpcyBpcyBhIGxpdHRsZSBtb3JlIHN0cmFpZ2h0Zm9yd2FyZFxuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgbGV0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIG5vdyB3ZSBrbm93IGhvdyB0byBzZXQgc291cmNlIC8gdGFyZ2V0IGlkc1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIC8vIEFkZCB0aGlzIGNsYXNzIHRvIHRoZSBzb3VyY2UncyAvIHRhcmdldCdzIGVkZ2VDbGFzc0lkc1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgLy8gQ29uY2F0ZW5hdGUgdGhlIGludGVybWVkaWF0ZSB0YWJsZUlkIGxpc3RzLCBlbWFuYXRpbmcgb3V0IGZyb20gdGhlXG4gICAgICAvLyAobmV3KSBlZGdlIHRhYmxlXG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gc291cmNlRWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBzb3VyY2VFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YXJnZXRFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHRhcmdldEVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQodGFyZ2V0RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzKTtcbiAgICAgIGlmICh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgLy8gRGlzY29ubmVjdCB0aGUgZXhpc3RpbmcgZWRnZSBjbGFzc2VzIGZyb20gdGhlIG5ldyAobm93IGVkZ2UpIGNsYXNzXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH1cbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGludGVwcmV0QXNHZW5lcmljICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHJldHVybiBzdXBlci5pbnRlcnByZXRBc0dlbmVyaWMoKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGxldCB0aGlzSGFzaCwgb3RoZXJIYXNoLCBzb3VyY2VUYWJsZUlkcywgdGFyZ2V0VGFibGVJZHM7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gWyB0aGlzSGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGlmIChvdGhlckF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGU7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZS5wcm9tb3RlKG90aGVyQXR0cmlidXRlKTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gWyBvdGhlckhhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHNcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHN1cGVyLnByb21vdGUoYXR0cmlidXRlKTtcbiAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBuZXdDbGFzcyA9IHN1cGVyLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUsIG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIG5ld0NsYXNzLmVkZ2VDbGFzc2VzKCkpIHtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmdldEVkZ2VSb2xlKGVkZ2VDbGFzcyk7XG4gICAgICBpZiAocm9sZSA9PT0gJ3NvdXJjZScgfHwgcm9sZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5wdXNoKHRoaXMudGFibGVJZCk7XG4gICAgICB9XG4gICAgICBpZiAocm9sZSA9PT0gJ3RhcmdldCcgfHwgcm9sZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5wdXNoKHRoaXMudGFibGVJZCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXdDbGFzcztcbiAgfVxuICBkaXNzb2x2ZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgbmV3Q2xhc3MgPSBzdXBlci5kaXNzb2x2ZShvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBuZXdDbGFzcy5lZGdlQ2xhc3NlcygpKSB7XG4gICAgICBjb25zdCByb2xlID0gdGhpcy5nZXRFZGdlUm9sZShlZGdlQ2xhc3MpO1xuICAgICAgaWYgKHJvbGUgPT09ICdzb3VyY2UnIHx8IHJvbGUgPT09ICdib3RoJykge1xuICAgICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnBvcCgpICE9PSBuZXdDbGFzcy50YWJsZUlkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbmNvbnNpc3RlbnQgdGFibGVJZHMgd2hlbiBkaXNzb2x2aW5nIGEgbm9kZSBjbGFzc2ApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocm9sZSA9PT0gJ3RhcmdldCcgfHwgcm9sZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMucG9wKCkgIT09IG5ld0NsYXNzLnRhYmxlSWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEluY29uc2lzdGVudCB0YWJsZUlkcyB3aGVuIGRpc3NvbHZpbmcgYSBub2RlIGNsYXNzYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ld0NsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIChjaGlsZENsYXNzKSB7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzLnRhYmxlLmNvbm5lY3QoW2NoaWxkQ2xhc3MudGFibGVdLCAnUGFyZW50Q2hpbGRUYWJsZScpO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFtdLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogY2hpbGRDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHM6IFtdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBjaGlsZENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSBzdXBlci5leHBhbmQoYXR0cmlidXRlKTtcbiAgICB0aGlzLmNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzKG5ld05vZGVDbGFzcyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHN1cGVyLnVucm9sbChhdHRyaWJ1dGUpO1xuICAgIHRoaXMuY29ubmVjdFRvQ2hpbGROb2RlQ2xhc3MobmV3Tm9kZUNsYXNzKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIHByb2plY3ROZXdFZGdlIChjbGFzc0lkTGlzdCkge1xuICAgIGNvbnN0IGNsYXNzTGlzdCA9IFt0aGlzXS5jb25jYXQoY2xhc3NJZExpc3QubWFwKGNsYXNzSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY2xhc3Nlc1tjbGFzc0lkXTtcbiAgICB9KSk7XG4gICAgaWYgKGNsYXNzTGlzdC5sZW5ndGggPCAzIHx8IGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0udHlwZSAhPT0gJ05vZGUnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY2xhc3NJZExpc3RgKTtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlQ2xhc3NJZCA9IHRoaXMuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzc0lkID0gY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS5jbGFzc0lkO1xuICAgIGxldCB0YWJsZU9yZGVyID0gW107XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBjbGFzc0xpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGNsYXNzT2JqID0gY2xhc3NMaXN0W2ldO1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICB0YWJsZU9yZGVyLnB1c2goY2xhc3NPYmoudGFibGVJZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlZGdlUm9sZSA9IGNsYXNzTGlzdFtpIC0gMV0uZ2V0RWRnZVJvbGUoY2xhc3NPYmopO1xuICAgICAgICBpZiAoZWRnZVJvbGUgPT09ICdzb3VyY2UnIHx8IGVkZ2VSb2xlID09PSAnYm90aCcpIHtcbiAgICAgICAgICB0YWJsZU9yZGVyID0gdGFibGVPcmRlci5jb25jYXQoXG4gICAgICAgICAgICBBcnJheS5mcm9tKGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKS5yZXZlcnNlKCkpO1xuICAgICAgICAgIHRhYmxlT3JkZXIucHVzaChjbGFzc09iai50YWJsZUlkKTtcbiAgICAgICAgICB0YWJsZU9yZGVyID0gdGFibGVPcmRlci5jb25jYXQoY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChcbiAgICAgICAgICAgIEFycmF5LmZyb20oY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpLnJldmVyc2UoKSk7XG4gICAgICAgICAgdGFibGVPcmRlci5wdXNoKGNsYXNzT2JqLnRhYmxlSWQpO1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChjbGFzc09iai5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLnRhYmxlLnByb2plY3QodGFibGVPcmRlcik7XG4gICAgY29uc3QgbmV3Q2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFtdLFxuICAgICAgdGFyZ2V0VGFibGVJZHM6IFtdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3Q2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0uZWRnZUNsYXNzSWRzW25ld0NsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICByZXR1cm4gbmV3Q2xhc3M7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgdGhpcy5jb25uZWN0ZWRDbGFzc2VzKCkpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBudWxsIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzZXMgJiYgIW9wdGlvbnMuY2xhc3Nlcy5maW5kKGQgPT4gdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBkLmNsYXNzSWQpKSB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc0lkcyAmJiBvcHRpb25zLmNsYXNzSWRzLmluZGV4T2YodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSA9PT0gLTEpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgY29uc3QgdGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmNvbmNhdChbIHNvdXJjZVRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogdGFyZ2V0Tm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdGFyZ2V0VGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF0udGFibGVJZDtcbiAgICBjb25zdCB0YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuY29uY2F0KFsgdGFyZ2V0VGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiBub2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucyksXG4gICAgICB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiBuZWlnaGJvcnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIHlpZWxkICogdGhpcy5ub2RlcyhvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlTmVpZ2hib3Job29kIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgc291cmNlLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICBlZGdlOiB0aGlzXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gc291cmNlVGFibGVJZHMgYW5kIHRhcmdldFRhYmxlSWRzIGFyZSBsaXN0cyBvZiBhbnkgaW50ZXJtZWRpYXRlIHRhYmxlcyxcbiAgICAvLyBiZWdpbm5pbmcgd2l0aCB0aGUgZWRnZSB0YWJsZSAoYnV0IG5vdCBpbmNsdWRpbmcgaXQpLCB0aGF0IGxlYWQgdG8gdGhlXG4gICAgLy8gc291cmNlIC8gdGFyZ2V0IG5vZGUgdGFibGVzIChidXQgbm90IGluY2x1ZGluZykgdGhvc2VcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnNvdXJjZVRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBzb3VyY2VDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgZ2V0IHRhcmdldENsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMudGFyZ2V0Q2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC5zb3VyY2VUYWJsZUlkcyA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldFRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEVkZ2VXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIF9zcGxpdFRhYmxlSWRMaXN0ICh0YWJsZUlkTGlzdCwgb3RoZXJDbGFzcykge1xuICAgIGxldCByZXN1bHQgPSB7XG4gICAgICBub2RlVGFibGVJZExpc3Q6IFtdLFxuICAgICAgZWRnZVRhYmxlSWQ6IG51bGwsXG4gICAgICBlZGdlVGFibGVJZExpc3Q6IFtdXG4gICAgfTtcbiAgICBpZiAodGFibGVJZExpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBXZWlyZCBjb3JuZXIgY2FzZSB3aGVyZSB3ZSdyZSB0cnlpbmcgdG8gY3JlYXRlIGFuIGVkZ2UgYmV0d2VlblxuICAgICAgLy8gYWRqYWNlbnQgb3IgaWRlbnRpY2FsIHRhYmxlcy4uLiBjcmVhdGUgYSBDb25uZWN0ZWRUYWJsZVxuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGhpcy50YWJsZS5jb25uZWN0KG90aGVyQ2xhc3MudGFibGUpLnRhYmxlSWQ7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgYSB0YWJsZSBpbiB0aGUgbWlkZGxlIGFzIHRoZSBuZXcgZWRnZSB0YWJsZTsgcHJpb3JpdGl6ZVxuICAgICAgLy8gU3RhdGljVGFibGUgYW5kIFN0YXRpY0RpY3RUYWJsZVxuICAgICAgbGV0IHN0YXRpY0V4aXN0cyA9IGZhbHNlO1xuICAgICAgbGV0IHRhYmxlRGlzdGFuY2VzID0gdGFibGVJZExpc3QubWFwKCh0YWJsZUlkLCBpbmRleCkgPT4ge1xuICAgICAgICBzdGF0aWNFeGlzdHMgPSBzdGF0aWNFeGlzdHMgfHwgdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgcmV0dXJuIHsgdGFibGVJZCwgaW5kZXgsIGRpc3Q6IE1hdGguYWJzKHRhYmxlSWRMaXN0IC8gMiAtIGluZGV4KSB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIHRhYmxlRGlzdGFuY2VzID0gdGFibGVEaXN0YW5jZXMuZmlsdGVyKCh7IHRhYmxlSWQgfSkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHsgdGFibGVJZCwgaW5kZXggfSA9IHRhYmxlRGlzdGFuY2VzLnNvcnQoKGEsIGIpID0+IGEuZGlzdCAtIGIuZGlzdClbMF07XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0YWJsZUlkO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKDAsIGluZGV4KS5yZXZlcnNlKCk7XG4gICAgICByZXN1bHQubm9kZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoaW5kZXggKyAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICB0ZW1wLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICB0ZW1wLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh0ZW1wKTtcblxuICAgIGlmICh0ZW1wLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RlbXAuc291cmNlQ2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC5zb3VyY2VUYWJsZUlkcywgc291cmNlQ2xhc3MpO1xuICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IHRlbXAuc291cmNlQ2xhc3NJZCxcbiAgICAgICAgc291cmNlVGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0ZW1wLnRhcmdldENsYXNzSWQgJiYgdGVtcC5zb3VyY2VDbGFzc0lkICE9PSB0ZW1wLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RlbXAudGFyZ2V0Q2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC50YXJnZXRUYWJsZUlkcywgdGFyZ2V0Q2xhc3MpO1xuICAgICAgY29uc3QgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiB0ZW1wLnRhcmdldENsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBub2RlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcHJldEFzR2VuZXJpYyAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgcmV0dXJuIHN1cGVyLmludGVycHJldEFzR2VuZXJpYygpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLnNpZGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2Uob3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLnNpZGUgPT09ICd0YXJnZXQnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUG9saXRpY2FsT3V0c2lkZXJFcnJvcjogXCIke29wdGlvbnMuc2lkZX1cIiBpcyBhbiBpbnZhbGlkIHNpZGVgKTtcbiAgICB9XG4gIH1cbiAgdG9nZ2xlRGlyZWN0aW9uIChkaXJlY3RlZCkge1xuICAgIGlmIChkaXJlY3RlZCA9PT0gZmFsc2UgfHwgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBkZWxldGUgdGhpcy5zd2FwcGVkRGlyZWN0aW9uO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuZGlyZWN0ZWQpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERpcmVjdGVkIHdhcyBhbHJlYWR5IHRydWUsIGp1c3Qgc3dpdGNoIHNvdXJjZSBhbmQgdGFyZ2V0XG4gICAgICBsZXQgdGVtcCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IHRlbXA7XG4gICAgICB0ZW1wID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IHRlbXA7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RTb3VyY2UgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgfVxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUucHJvbW90ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyBzb3VyY2VDbGFzcy50YWJsZSA6IHNvdXJjZUNsYXNzLnRhYmxlLnByb21vdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLnByb21vdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gdGFyZ2V0Q2xhc3MudGFibGUgOiB0YXJnZXRDbGFzcy50YWJsZS5wcm9tb3RlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFNvdXJjZSAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdTb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1NvdXJjZUNsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdTb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1RhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nVGFyZ2V0Q2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1RhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICByZXR1cm4gc3VwZXIucHJvbW90ZShhdHRyaWJ1dGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdGFibGVJZDogdGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgICAgdHlwZTogJ05vZGVDbGFzcydcbiAgICAgIH0pO1xuICAgICAgdGhpcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgICBub2RlQ2xhc3M6IG5ld05vZGVDbGFzcyxcbiAgICAgICAgc2lkZTogIXRoaXMuc291cmNlQ2xhc3NJZCA/ICdzb3VyY2UnIDogJ3RhcmdldCcsXG4gICAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICAgIGVkZ2VBdHRyaWJ1dGU6IGF0dHJpYnV0ZVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICAgIH1cbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgbmV3Q2xhc3MgPSBzdXBlci5hZ2dyZWdhdGUoYXR0cmlidXRlLCBvcHRpb25zKTtcbiAgICBuZXdDbGFzcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgbmV3Q2xhc3MudGFyZ2V0VGFibGVJZHMudW5zaGlmdCh0aGlzLnRhYmxlSWQpO1xuICAgIHJldHVybiBuZXdDbGFzcztcbiAgfVxuICBkaXNzb2x2ZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgbmV3Q2xhc3MgPSBzdXBlci5kaXNzb2x2ZShvcHRpb25zKTtcbiAgICBpZiAobmV3Q2xhc3Muc291cmNlVGFibGVJZHMuc2hpZnQoKSAhPT0gbmV3Q2xhc3MudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbmNvbnNpc3RlbnQgdGFibGVJZHMgd2hlbiBkaXNzb2x2aW5nIGFuIGVkZ2UgY2xhc3NgKTtcbiAgICB9XG4gICAgaWYgKG5ld0NsYXNzLnRhcmdldFRhYmxlSWRzLnNoaWZ0KCkgIT09IG5ld0NsYXNzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW5jb25zaXN0ZW50IHRhYmxlSWRzIHdoZW4gZGlzc29sdmluZyBhbiBlZGdlIGNsYXNzYCk7XG4gICAgfVxuICAgIHJldHVybiBuZXdDbGFzcztcbiAgfVxuICBjb25uZWN0RmFjZXRlZENsYXNzIChuZXdFZGdlQ2xhc3MpIHtcbiAgICAvLyBXaGVuIGFuIGVkZ2UgY2xhc3MgaXMgZmFjZXRlZCwgd2Ugd2FudCB0byBrZWVwIHRoZSBzYW1lIGNvbm5lY3Rpb25zLiBUaGlzXG4gICAgLy8gbWVhbnMgd2UgbmVlZCB0byBjbG9uZSBlYWNoIHRhYmxlIGNoYWluLCBhbmQgYWRkIG91ciBvd24gdGFibGUgdG8gaXRcbiAgICAvLyAoYmVjYXVzZSBvdXIgdGFibGUgaXMgdGhlIHBhcmVudFRhYmxlIG9mIHRoZSBuZXcgb25lKVxuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIG5ld0VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzID0gQXJyYXkuZnJvbSh0aGlzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIG5ld0VkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBuZXdFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcyA9IEFycmF5LmZyb20odGhpcy50YXJnZXRUYWJsZUlkcyk7XG4gICAgICBuZXdFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMudW5zaGlmdCh0aGlzLnRhYmxlSWQpO1xuICAgICAgdGhpcy50YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICBjb25zdCBuZXdDbGFzc2VzID0gc3VwZXIuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpO1xuICAgIGZvciAoY29uc3QgbmV3Q2xhc3Mgb2YgbmV3Q2xhc3Nlcykge1xuICAgICAgdGhpcy5jb25uZWN0RmFjZXRlZENsYXNzKG5ld0NsYXNzKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld0NsYXNzZXM7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3Q2xhc3Mgb2Ygc3VwZXIub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHRoaXMuY29ubmVjdEZhY2V0ZWRDbGFzcyhuZXdDbGFzcyk7XG4gICAgICB5aWVsZCBuZXdDbGFzcztcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJjbGFzcyBGaWxlRm9ybWF0IHtcbiAgYXN5bmMgYnVpbGRSb3cgKGl0ZW0pIHtcbiAgICBjb25zdCByb3cgPSB7fTtcbiAgICBmb3IgKGxldCBhdHRyIGluIGl0ZW0ucm93KSB7XG4gICAgICByb3dbYXR0cl0gPSBhd2FpdCBpdGVtLnJvd1thdHRyXTtcbiAgICB9XG4gICAgcmV0dXJuIHJvdztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmlsZUZvcm1hdDtcbiIsImNsYXNzIFBhcnNlRmFpbHVyZSBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IgKGZpbGVGb3JtYXQpIHtcbiAgICBzdXBlcihgRmFpbGVkIHRvIHBhcnNlIGZvcm1hdDogJHtmaWxlRm9ybWF0LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFBhcnNlRmFpbHVyZTtcbiIsImltcG9ydCBGaWxlRm9ybWF0IGZyb20gJy4vRmlsZUZvcm1hdC5qcyc7XG5pbXBvcnQgUGFyc2VGYWlsdXJlIGZyb20gJy4vUGFyc2VGYWlsdXJlLmpzJztcblxuY29uc3QgTk9ERV9OQU1FUyA9IFsnbm9kZXMnLCAnTm9kZXMnXTtcbmNvbnN0IEVER0VfTkFNRVMgPSBbJ2VkZ2VzJywgJ2xpbmtzJywgJ0VkZ2VzJywgJ0xpbmtzJ107XG5cbmNsYXNzIEQzSnNvbiBleHRlbmRzIEZpbGVGb3JtYXQge1xuICBhc3luYyBpbXBvcnREYXRhICh7XG4gICAgbW9kZWwsXG4gICAgdGV4dCxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBzb3VyY2VBdHRyaWJ1dGUgPSAnc291cmNlJyxcbiAgICB0YXJnZXRBdHRyaWJ1dGUgPSAndGFyZ2V0JyxcbiAgICBjbGFzc0F0dHJpYnV0ZSA9IG51bGxcbiAgfSkge1xuICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKHRleHQpO1xuICAgIGNvbnN0IG5vZGVOYW1lID0gTk9ERV9OQU1FUy5maW5kKG5hbWUgPT4gZGF0YVtuYW1lXSBpbnN0YW5jZW9mIEFycmF5KTtcbiAgICBjb25zdCBlZGdlTmFtZSA9IEVER0VfTkFNRVMuZmluZChuYW1lID0+IGRhdGFbbmFtZV0gaW5zdGFuY2VvZiBBcnJheSk7XG4gICAgaWYgKCFub2RlTmFtZSB8fCAhZWRnZU5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZUZhaWx1cmUodGhpcyk7XG4gICAgfVxuXG4gICAgY29uc3QgY29yZVRhYmxlID0gbW9kZWwuY3JlYXRlVGFibGUoe1xuICAgICAgdHlwZTogJ1N0YXRpY0RpY3RUYWJsZScsXG4gICAgICBuYW1lOiAnY29yZVRhYmxlJyxcbiAgICAgIGRhdGE6IGRhdGFcbiAgICB9KTtcbiAgICBjb25zdCBjb3JlQ2xhc3MgPSBtb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvcmVUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gICAgbGV0IFtub2RlcywgZWRnZXNdID0gY29yZUNsYXNzLmNsb3NlZFRyYW5zcG9zZShbbm9kZU5hbWUsIGVkZ2VOYW1lXSk7XG5cbiAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgIGlmIChub2RlQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgaW1wb3J0IGNsYXNzZXMgZnJvbSBEMy1zdHlsZSBKU09OIHdpdGhvdXQgbm9kZUF0dHJpYnV0ZWApO1xuICAgICAgfVxuICAgICAgY29uc3Qgbm9kZUNsYXNzZXMgPSBbXTtcbiAgICAgIGNvbnN0IG5vZGVDbGFzc0xvb2t1cCA9IHt9O1xuICAgICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZUNsYXNzIG9mIG5vZGVzLm9wZW5GYWNldChjbGFzc0F0dHJpYnV0ZSkpIHtcbiAgICAgICAgbm9kZUNsYXNzTG9va3VwW25vZGVDbGFzcy5jbGFzc05hbWVdID0gbm9kZUNsYXNzZXMubGVuZ3RoO1xuICAgICAgICBub2RlQ2xhc3Nlcy5wdXNoKG5vZGVDbGFzcy5pbnRlcnByZXRBc05vZGVzKCkpO1xuICAgICAgfVxuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZXMub3BlbkZhY2V0KGNsYXNzQXR0cmlidXRlKSkge1xuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGVkZ2VDbGFzcy5pbnRlcnByZXRBc0VkZ2VzKCkpO1xuICAgICAgICBjb25zdCBzYW1wbGUgPSBhd2FpdCBlZGdlQ2xhc3MudGFibGUuZ2V0SXRlbSgpO1xuICAgICAgICBjb25zdCBzb3VyY2VDbGFzc05hbWUgPSBhd2FpdCBzYW1wbGUucm93W3NvdXJjZUF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXTtcbiAgICAgICAgaWYgKG5vZGVDbGFzc0xvb2t1cFtzb3VyY2VDbGFzc05hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgICAgICAgIG5vZGVDbGFzczogbm9kZUNsYXNzZXNbbm9kZUNsYXNzTG9va3VwW3NvdXJjZUNsYXNzTmFtZV1dLFxuICAgICAgICAgICAgc2lkZTogJ3NvdXJjZScsXG4gICAgICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICAgICAgZWRnZUF0dHJpYnV0ZTogc291cmNlQXR0cmlidXRlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdGFyZ2V0Q2xhc3NOYW1lID0gYXdhaXQgc2FtcGxlLnJvd1t0YXJnZXRBdHRyaWJ1dGUgKyAnXycgKyBjbGFzc0F0dHJpYnV0ZV07XG4gICAgICAgIGlmIChub2RlQ2xhc3NMb29rdXBbdGFyZ2V0Q2xhc3NOYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgICAgICBub2RlQ2xhc3M6IG5vZGVDbGFzc2VzW25vZGVDbGFzc0xvb2t1cFt0YXJnZXRDbGFzc05hbWVdXSxcbiAgICAgICAgICAgIHNpZGU6ICd0YXJnZXQnLFxuICAgICAgICAgICAgbm9kZUF0dHJpYnV0ZSxcbiAgICAgICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHRhcmdldEF0dHJpYnV0ZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGVzID0gbm9kZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgICAgbm9kZXMuc2V0Q2xhc3NOYW1lKG5vZGVOYW1lKTtcbiAgICAgIGVkZ2VzID0gZWRnZXMuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgICAgZWRnZXMuc2V0Q2xhc3NOYW1lKGVkZ2VOYW1lKTtcbiAgICAgIG5vZGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICAgIGVkZ2VDbGFzczogZWRnZXMsXG4gICAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICBlZGdlQXR0cmlidXRlOiBzb3VyY2VBdHRyaWJ1dGVcbiAgICAgIH0pO1xuICAgICAgbm9kZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgICAgZWRnZUNsYXNzOiBlZGdlcyxcbiAgICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHRhcmdldEF0dHJpYnV0ZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jIGZvcm1hdERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICBpbmNsdWRlQ2xhc3NlcyA9IE9iamVjdC52YWx1ZXMobW9kZWwuY2xhc3NlcyksXG4gICAgcHJldHR5ID0gdHJ1ZSxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBzb3VyY2VBdHRyaWJ1dGUgPSAnc291cmNlJyxcbiAgICB0YXJnZXRBdHRyaWJ1dGUgPSAndGFyZ2V0JyxcbiAgICBjbGFzc0F0dHJpYnV0ZSA9IG51bGxcbiAgfSkge1xuICAgIGlmIChjbGFzc0F0dHJpYnV0ZSAmJiAhbm9kZUF0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBleHBvcnQgRDMtc3R5bGUgSlNPTiB3aXRoIGNsYXNzZXMsIHdpdGhvdXQgYSBub2RlQXR0cmlidXRlYCk7XG4gICAgfVxuICAgIGxldCByZXN1bHQgPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBsaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IG5vZGVMb29rdXAgPSB7fTtcbiAgICBjb25zdCBub2RlQ2xhc3NlcyA9IFtdO1xuICAgIGNvbnN0IGVkZ2VDbGFzc2VzID0gW107XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBpbmNsdWRlQ2xhc3Nlcykge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBub2RlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0Lm90aGVyID0gcmVzdWx0Lm90aGVyIHx8IFtdO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgcmVzdWx0Lm90aGVyLnB1c2goYXdhaXQgdGhpcy5idWlsZFJvdyhpdGVtKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBub2RlQ2xhc3Mgb2Ygbm9kZUNsYXNzZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBub2RlQ2xhc3MudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgIG5vZGVMb29rdXBbbm9kZS5leHBvcnRJZF0gPSByZXN1bHQubm9kZXMubGVuZ3RoO1xuICAgICAgICBjb25zdCByb3cgPSBhd2FpdCB0aGlzLmJ1aWxkUm93KG5vZGUpO1xuICAgICAgICBpZiAobm9kZUF0dHJpYnV0ZSkge1xuICAgICAgICAgIHJvd1tub2RlQXR0cmlidXRlXSA9IG5vZGUuZXhwb3J0SWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNsYXNzQXR0cmlidXRlKSB7XG4gICAgICAgICAgcm93W2NsYXNzQXR0cmlidXRlXSA9IG5vZGUuY2xhc3NPYmouY2xhc3NOYW1lO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5ub2Rlcy5wdXNoKHJvdyk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIGVkZ2VDbGFzc2VzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgZWRnZUNsYXNzLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICBjb25zdCByb3cgPSBhd2FpdCB0aGlzLmJ1aWxkUm93KGVkZ2UpO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiBlZGdlLnNvdXJjZU5vZGVzKHsgY2xhc3Nlczogbm9kZUNsYXNzZXMgfSkpIHtcbiAgICAgICAgICByb3dbc291cmNlQXR0cmlidXRlXSA9IG5vZGVBdHRyaWJ1dGUgPyBzb3VyY2UuZXhwb3J0SWQgOiBub2RlTG9va3VwW3NvdXJjZS5leHBvcnRJZF07XG4gICAgICAgICAgaWYgKGNsYXNzQXR0cmlidXRlKSB7XG4gICAgICAgICAgICByb3dbc291cmNlQXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdID0gc291cmNlLmNsYXNzT2JqLmNsYXNzTmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgZWRnZS50YXJnZXROb2Rlcyh7IGNsYXNzZXM6IG5vZGVDbGFzc2VzIH0pKSB7XG4gICAgICAgICAgICByb3dbdGFyZ2V0QXR0cmlidXRlXSA9IG5vZGVBdHRyaWJ1dGUgPyB0YXJnZXQuZXhwb3J0SWQgOiBub2RlTG9va3VwW3RhcmdldC5leHBvcnRJZF07XG4gICAgICAgICAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgcm93W3RhcmdldEF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXSA9IHRhcmdldC5jbGFzc09iai5jbGFzc05hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQubGlua3MucHVzaChPYmplY3QuYXNzaWduKHt9LCByb3cpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHByZXR0eSkge1xuICAgICAgcmVzdWx0Lm5vZGVzID0gJyAgXCJub2Rlc1wiOiBbXFxuICAgICcgKyByZXN1bHQubm9kZXMubWFwKHJvdyA9PiBKU09OLnN0cmluZ2lmeShyb3cpKVxuICAgICAgICAuam9pbignLFxcbiAgICAnKSArICdcXG4gIF0nO1xuICAgICAgcmVzdWx0LmxpbmtzID0gJyAgXCJsaW5rc1wiOiBbXFxuICAgICcgKyByZXN1bHQubGlua3MubWFwKHJvdyA9PiBKU09OLnN0cmluZ2lmeShyb3cpKVxuICAgICAgICAuam9pbignLFxcbiAgICAnKSArICdcXG4gIF0nO1xuICAgICAgaWYgKHJlc3VsdC5vdGhlcikge1xuICAgICAgICByZXN1bHQub3RoZXIgPSAnLFxcbiAgXCJvdGhlclwiOiBbXFxuICAgICcgKyByZXN1bHQub3RoZXIubWFwKHJvdyA9PiBKU09OLnN0cmluZ2lmeShyb3cpKVxuICAgICAgICAgIC5qb2luKCcsXFxuICAgICcpICsgJ1xcbiAgXSc7XG4gICAgICB9XG4gICAgICByZXN1bHQgPSBge1xcbiR7cmVzdWx0Lm5vZGVzfSxcXG4ke3Jlc3VsdC5saW5rc30ke3Jlc3VsdC5vdGhlciB8fCAnJ31cXG59XFxuYDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gSlNPTi5zdHJpbmdpZnkocmVzdWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6ICdkYXRhOnRleHQvanNvbjtiYXNlNjQsJyArIEJ1ZmZlci5mcm9tKHJlc3VsdCkudG9TdHJpbmcoJ2Jhc2U2NCcpLFxuICAgICAgdHlwZTogJ3RleHQvanNvbicsXG4gICAgICBleHRlbnNpb246ICdqc29uJ1xuICAgIH07XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IG5ldyBEM0pzb24oKTtcbiIsImltcG9ydCBGaWxlRm9ybWF0IGZyb20gJy4vRmlsZUZvcm1hdC5qcyc7XG5pbXBvcnQgSlNaaXAgZnJvbSAnanN6aXAnO1xuXG5jbGFzcyBDc3ZaaXAgZXh0ZW5kcyBGaWxlRm9ybWF0IHtcbiAgYXN5bmMgaW1wb3J0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIHRleHRcbiAgfSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGZvcm1hdERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICBpbmNsdWRlQ2xhc3NlcyA9IE9iamVjdC52YWx1ZXMobW9kZWwuY2xhc3NlcyksXG4gICAgaW5kZXhOYW1lID0gJ2luZGV4J1xuICB9KSB7XG4gICAgY29uc3QgemlwID0gbmV3IEpTWmlwKCk7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGluY2x1ZGVDbGFzc2VzKSB7XG4gICAgICBjb25zdCBhdHRyaWJ1dGVzID0gY2xhc3NPYmoudGFibGUudW5TdXBwcmVzc2VkQXR0cmlidXRlcztcbiAgICAgIGxldCBjb250ZW50cyA9IGAke2luZGV4TmFtZX0sJHthdHRyaWJ1dGVzLmpvaW4oJywnKX1cXG5gO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICBjb250ZW50cyArPSBgJHtpdGVtLmluZGV4fWA7XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgY29udGVudHMgKz0gYCwke2F3YWl0IGl0ZW0ucm93W2F0dHJdfWA7XG4gICAgICAgIH1cbiAgICAgICAgY29udGVudHMgKz0gYFxcbmA7XG4gICAgICB9XG4gICAgICB6aXAuZmlsZShjbGFzc09iai5jbGFzc05hbWUgKyAnLmNzdicsIGNvbnRlbnRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogJ2RhdGE6YXBwbGljYXRpb24vemlwO2Jhc2U2NCwnICsgYXdhaXQgemlwLmdlbmVyYXRlQXN5bmMoeyB0eXBlOiAnYmFzZTY0JyB9KSxcbiAgICAgIHR5cGU6ICdhcHBsaWNhdGlvbi96aXAnLFxuICAgICAgZXh0ZW5zaW9uOiAnemlwJ1xuICAgIH07XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IG5ldyBDc3ZaaXAoKTtcbiIsImltcG9ydCBGaWxlRm9ybWF0IGZyb20gJy4vRmlsZUZvcm1hdC5qcyc7XG5cbmNvbnN0IGVzY2FwZUNoYXJzID0ge1xuICAnJnF1b3Q7JzogL1wiL2csXG4gICcmYXBvczsnOiAvJy9nLFxuICAnJmx0Oyc6IC88L2csXG4gICcmZ3Q7JzogLz4vZ1xufTtcblxuY2xhc3MgR0VYRiBleHRlbmRzIEZpbGVGb3JtYXQge1xuICBhc3luYyBpbXBvcnREYXRhICh7XG4gICAgbW9kZWwsXG4gICAgdGV4dFxuICB9KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgZXNjYXBlIChzdHIpIHtcbiAgICBzdHIgPSBzdHIucmVwbGFjZSgvJi9nLCAnJmFtcDsnKTtcbiAgICBmb3IgKGNvbnN0IFsgcmVwbCwgZXhwIF0gb2YgT2JqZWN0LmVudHJpZXMoZXNjYXBlQ2hhcnMpKSB7XG4gICAgICBzdHIgPSBzdHIucmVwbGFjZShleHAsIHJlcGwpO1xuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9XG4gIGFzeW5jIGZvcm1hdERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICBpbmNsdWRlQ2xhc3NlcyA9IE9iamVjdC52YWx1ZXMobW9kZWwuY2xhc3NlcyksXG4gICAgY2xhc3NBdHRyaWJ1dGUgPSAnY2xhc3MnXG4gIH0pIHtcbiAgICBsZXQgbm9kZUNodW5rID0gJyc7XG4gICAgbGV0IGVkZ2VDaHVuayA9ICcnO1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBpbmNsdWRlQ2xhc3Nlcykge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgbm9kZUNodW5rICs9IGBcbiAgICA8bm9kZSBpZD1cIiR7dGhpcy5lc2NhcGUobm9kZS5leHBvcnRJZCl9XCIgbGFiZWw9XCIke3RoaXMuZXNjYXBlKG5vZGUubGFiZWwpfVwiPlxuICAgICAgPGF0dHZhbHVlcz5cbiAgICAgICAgPGF0dHZhbHVlIGZvcj1cIjBcIiB2YWx1ZT1cIiR7dGhpcy5lc2NhcGUoY2xhc3NPYmouY2xhc3NOYW1lKX1cIi8+XG4gICAgICA8L2F0dHZhbHVlcz5cbiAgICA8L25vZGU+YDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIGVkZ2Uuc291cmNlTm9kZXMoeyBjbGFzc2VzOiBpbmNsdWRlQ2xhc3NlcyB9KSkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgZWRnZS50YXJnZXROb2Rlcyh7IGNsYXNzZXM6IGluY2x1ZGVDbGFzc2VzIH0pKSB7XG4gICAgICAgICAgICAgIGVkZ2VDaHVuayArPSBgXG4gICAgPGVkZ2UgaWQ9XCIke3RoaXMuZXNjYXBlKGVkZ2UuZXhwb3J0SWQpfVwiIHNvdXJjZT1cIiR7dGhpcy5lc2NhcGUoc291cmNlLmV4cG9ydElkKX1cIiB0YXJnZXQ9XCIke3RoaXMuZXNjYXBlKHRhcmdldC5leHBvcnRJZCl9XCI+XG4gICAgICA8YXR0dmFsdWVzPlxuICAgICAgICA8YXR0dmFsdWUgZm9yPVwiMFwiIHZhbHVlPVwiJHt0aGlzLmVzY2FwZShjbGFzc09iai5jbGFzc05hbWUpfVwiLz5cbiAgICAgIDwvYXR0dmFsdWVzPlxuICAgIDwvZWRnZT5gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGBcXFxuPD94bWwgdmVyc2lvbj1cIjEuMFwiIGVuY29kaW5nPVwiVVRGLThcIj8+XG48Z2V4ZiAgeG1sbnM9XCJodHRwOi8vd3d3LmdleGYubmV0LzEuMmRyYWZ0XCIgeG1sbnM6eHNpPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMS9YTUxTY2hlbWEtaW5zdGFuY2VcIiB4c2k6c2NoZW1hTG9jYXRpb249XCJodHRwOi8vd3d3LmdleGYubmV0LzEuMmRyYWZ0IGh0dHA6Ly93d3cuZ2V4Zi5uZXQvMS4yZHJhZnQvZ2V4Zi54c2RcIiB2ZXJzaW9uPVwiMS4yXCI+XG48bWV0YSBsYXN0bW9kaWZpZWRkYXRlPVwiMjAwOS0wMy0yMFwiPlxuICA8Y3JlYXRvcj5vcmlncmFwaC5naXRodWIuaW88L2NyZWF0b3I+XG4gIDxkZXNjcmlwdGlvbj4ke21vZGVsLm5hbWV9PC9kZXNjcmlwdGlvbj5cbjwvbWV0YT5cbjxncmFwaCBtb2RlPVwic3RhdGljXCIgZGVmYXVsdGVkZ2V0eXBlPVwiZGlyZWN0ZWRcIj5cbiAgPGF0dHJpYnV0ZXMgY2xhc3M9XCJub2RlXCI+XG4gICAgPGF0dHJpYnV0ZSBpZD1cIjBcIiB0aXRsZT1cIiR7Y2xhc3NBdHRyaWJ1dGV9XCIgdHlwZT1cInN0cmluZ1wiLz5cbiAgPC9hdHRyaWJ1dGVzPlxuICA8YXR0cmlidXRlcyBjbGFzcz1cImVkZ2VcIj5cbiAgICA8YXR0cmlidXRlIGlkPVwiMFwiIHRpdGxlPVwiJHtjbGFzc0F0dHJpYnV0ZX1cIiB0eXBlPVwic3RyaW5nXCIvPlxuICA8L2F0dHJpYnV0ZXM+XG4gIDxub2Rlcz4ke25vZGVDaHVua31cbiAgPC9ub2Rlcz5cbiAgPGVkZ2VzPiR7ZWRnZUNodW5rfVxuICA8L2VkZ2VzPlxuPC9ncmFwaD5cbjwvZ2V4Zj5cbiAgYDtcblxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiAnZGF0YTp0ZXh0L3htbDtiYXNlNjQsJyArIEJ1ZmZlci5mcm9tKHJlc3VsdCkudG9TdHJpbmcoJ2Jhc2U2NCcpLFxuICAgICAgdHlwZTogJ3RleHQveG1sJyxcbiAgICAgIGV4dGVuc2lvbjogJ2dleGYnXG4gICAgfTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgbmV3IEdFWEYoKTtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuXG5pbXBvcnQgKiBhcyBUQUJMRVMgZnJvbSAnLi4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4uL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBGSUxFX0ZPUk1BVFMgZnJvbSAnLi4vRmlsZUZvcm1hdHMvRmlsZUZvcm1hdHMuanMnO1xuXG5jb25zdCBEQVRBTElCX0ZPUk1BVFMgPSB7XG4gICdqc29uJzogJ2pzb24nLFxuICAnY3N2JzogJ2NzdicsXG4gICd0c3YnOiAndHN2J1xufTtcblxuY2xhc3MgTmV0d29ya01vZGVsIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoe1xuICAgIG9yaWdyYXBoLFxuICAgIG1vZGVsSWQsXG4gICAgbmFtZSA9IG1vZGVsSWQsXG4gICAgYW5ub3RhdGlvbnMgPSB7fSxcbiAgICBjbGFzc2VzID0ge30sXG4gICAgdGFibGVzID0ge31cbiAgfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fb3JpZ3JhcGggPSBvcmlncmFwaDtcbiAgICB0aGlzLm1vZGVsSWQgPSBtb2RlbElkO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IGFubm90YXRpb25zO1xuICAgIHRoaXMuY2xhc3NlcyA9IHt9O1xuICAgIHRoaXMudGFibGVzID0ge307XG5cbiAgICB0aGlzLl9uZXh0Q2xhc3NJZCA9IDE7XG4gICAgdGhpcy5fbmV4dFRhYmxlSWQgPSAxO1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKGNsYXNzZXMpKSB7XG4gICAgICB0aGlzLmNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSB0aGlzLmh5ZHJhdGUoY2xhc3NPYmosIENMQVNTRVMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIE9iamVjdC52YWx1ZXModGFibGVzKSkge1xuICAgICAgdGhpcy50YWJsZXNbdGFibGUudGFibGVJZF0gPSB0aGlzLmh5ZHJhdGUodGFibGUsIFRBQkxFUyk7XG4gICAgfVxuXG4gICAgdGhpcy5vbigndXBkYXRlJywgKCkgPT4ge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3NhdmVUaW1lb3V0KTtcbiAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuX29yaWdyYXBoLnNhdmUoKTtcbiAgICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSB1bmRlZmluZWQ7XG4gICAgICB9LCAwKTtcbiAgICB9KTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IGNsYXNzZXMgPSB7fTtcbiAgICBjb25zdCB0YWJsZXMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXS50eXBlID0gY2xhc3NPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZU9iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKSkge1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdID0gdGFibGVPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0udHlwZSA9IHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBtb2RlbElkOiB0aGlzLm1vZGVsSWQsXG4gICAgICBuYW1lOiB0aGlzLm5hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9ucyxcbiAgICAgIGNsYXNzZXMsXG4gICAgICB0YWJsZXNcbiAgICB9O1xuICB9XG4gIGdldCB1bnNhdmVkICgpIHtcbiAgICByZXR1cm4gdGhpcy5fc2F2ZVRpbWVvdXQgIT09IHVuZGVmaW5lZDtcbiAgfVxuICBoeWRyYXRlIChyYXdPYmplY3QsIFRZUEVTKSB7XG4gICAgcmF3T2JqZWN0Lm1vZGVsID0gdGhpcztcbiAgICByZXR1cm4gbmV3IFRZUEVTW3Jhd09iamVjdC50eXBlXShyYXdPYmplY3QpO1xuICB9XG4gIGNyZWF0ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgd2hpbGUgKCFvcHRpb25zLnRhYmxlSWQgfHwgKCFvcHRpb25zLm92ZXJ3cml0ZSAmJiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdKSkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHt0aGlzLl9uZXh0VGFibGVJZH1gO1xuICAgICAgdGhpcy5fbmV4dFRhYmxlSWQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSA9IG5ldyBUQUJMRVNbb3B0aW9ucy50eXBlXShvcHRpb25zKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdO1xuICB9XG4gIGNyZWF0ZUNsYXNzIChvcHRpb25zID0ge30pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMuY2xhc3NJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdKSkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHt0aGlzLl9uZXh0Q2xhc3NJZH1gO1xuICAgICAgdGhpcy5fbmV4dENsYXNzSWQgKz0gMTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0uY2xhc3NPYmogJiYgIW9wdGlvbnMub3ZlcndyaXRlKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdLmR1cGxpY2F0ZSgpLnRhYmxlSWQ7XG4gICAgfVxuICAgIGlmIChvcHRpb25zLm92ZXJ3cml0ZSkge1xuICAgICAgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXS5yZXNldCgpO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDTEFTU0VTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cbiAgZmluZENsYXNzIChjbGFzc05hbWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NOYW1lID09PSBjbGFzc05hbWUpO1xuICB9XG4gIHJlbmFtZSAobmV3TmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5ld05hbWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhbm5vdGF0ZSAoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYW5ub3RhdGlvbnNba2V5XSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlQW5ub3RhdGlvbiAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMuYW5ub3RhdGlvbnNba2V5XTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5fb3JpZ3JhcGguZGVsZXRlTW9kZWwodGhpcy5tb2RlbElkKTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX29yaWdyYXBoLm1vZGVsc1t0aGlzLm1vZGVsSWRdO1xuICB9XG4gIGFzeW5jIGFkZFRleHRGaWxlIChvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zLmZvcm1hdCkge1xuICAgICAgb3B0aW9ucy5mb3JtYXQgPSBtaW1lLmV4dGVuc2lvbihtaW1lLmxvb2t1cChvcHRpb25zLm5hbWUpKTtcbiAgICB9XG4gICAgaWYgKEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgICAgcmV0dXJuIEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0uaW1wb3J0RGF0YShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKERBVEFMSUJfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIG9wdGlvbnMuZGF0YSA9IGRhdGFsaWIucmVhZChvcHRpb25zLnRleHQsIHsgdHlwZTogb3B0aW9ucy5mb3JtYXQgfSk7XG4gICAgICBpZiAob3B0aW9ucy5mb3JtYXQgPT09ICdjc3YnIHx8IG9wdGlvbnMuZm9ybWF0ID09PSAndHN2Jykge1xuICAgICAgICBvcHRpb25zLmF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIG9wdGlvbnMuZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgb3B0aW9ucy5hdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgb3B0aW9ucy5kYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZShvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGZvcm1hdDogJHtvcHRpb25zLmZvcm1hdH1gKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIGlmIChGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICByZXR1cm4gRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XS5mb3JtYXREYXRhKG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAoREFUQUxJQl9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBSYXcgJHtvcHRpb25zLmZvcm1hdH0gZXhwb3J0IG5vdCB5ZXQgc3VwcG9ydGVkYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZXhwb3J0IHVua25vd24gZm9ybWF0OiAke29wdGlvbnMuZm9ybWF0fWApO1xuICAgIH1cbiAgfVxuICBhZGRTdGF0aWNUYWJsZSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudHlwZSA9IG9wdGlvbnMuZGF0YSBpbnN0YW5jZW9mIEFycmF5ID8gJ1N0YXRpY1RhYmxlJyA6ICdTdGF0aWNEaWN0VGFibGUnO1xuICAgIGxldCBuZXdUYWJsZSA9IHRoaXMuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gIH1cbiAgb3B0aW1pemVUYWJsZXMgKCkge1xuICAgIGNvbnN0IHRhYmxlc0luVXNlID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIHRhYmxlc0luVXNlW2NsYXNzT2JqLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc09iai5zb3VyY2VUYWJsZUlkcyB8fCBbXSkge1xuICAgICAgICB0YWJsZXNJblVzZVt0YWJsZUlkXSA9IHRydWU7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMgfHwgW10pIHtcbiAgICAgICAgdGFibGVzSW5Vc2VbdGFibGVJZF0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBwYXJlbnRzVmlzaXRlZCA9IHt9O1xuICAgIGNvbnN0IHF1ZXVlID0gT2JqZWN0LmtleXModGFibGVzSW5Vc2UpO1xuICAgIHdoaWxlIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCB0YWJsZUlkID0gcXVldWUuc2hpZnQoKTtcbiAgICAgIGlmICghcGFyZW50c1Zpc2l0ZWRbdGFibGVJZF0pIHtcbiAgICAgICAgdGFibGVzSW5Vc2VbdGFibGVJZF0gPSB0cnVlO1xuICAgICAgICBwYXJlbnRzVmlzaXRlZFt0YWJsZUlkXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IHRhYmxlID0gdGhpcy50YWJsZXNbdGFibGVJZF07XG4gICAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgICAgcXVldWUucHVzaChwYXJlbnRUYWJsZS50YWJsZUlkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgT2JqZWN0LmtleXModGhpcy50YWJsZXMpKSB7XG4gICAgICBjb25zdCB0YWJsZSA9IHRoaXMudGFibGVzW3RhYmxlSWRdO1xuICAgICAgaWYgKCF0YWJsZXNJblVzZVt0YWJsZUlkXSAmJiB0YWJsZS50eXBlICE9PSAnU3RhdGljJyAmJiB0YWJsZS50eXBlICE9PSAnU3RhdGljRGljdCcpIHtcbiAgICAgICAgdGFibGUuZGVsZXRlKHRydWUpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBUT0RPOiBJZiBhbnkgRHVwbGljYXRlZFRhYmxlIGlzIGluIHVzZSwgYnV0IHRoZSBvcmlnaW5hbCBpc24ndCwgc3dhcCBmb3IgdGhlIHJlYWwgb25lXG4gIH1cbiAgYXN5bmMgZ2V0SW5zdGFuY2VTYW1wbGUgKCkge1xuICAgIGNvbnN0IHNlZWRMaW1pdCA9IDEwMDtcbiAgICBjb25zdCBjbHVzdGVyTGltaXQgPSA1O1xuICAgIGNvbnN0IGNsYXNzQ291bnQgPSA1O1xuICAgIC8vIFRyeSB0byBnZXQgYXQgbW9zdCByb3VnaGx5IHNlZWRDb3VudCBub2RlcyAvIGVkZ2VzLCBpbiBjbHVzdGVycyBvZiBhYm91dFxuICAgIC8vIGNsdXN0ZXJMaW1pdCwgYW5kIHRyeSB0byBpbmNsdWRlIGF0IGxlYXN0IGNsYXNzQ291bnQgaW5zdGFuY2VzIHBlciBjbGFzc1xuICAgIC8vIChtYXkgcmV0dXJuIG51bGwgaWYgY2FjaGVzIGFyZSBpbnZhbGlkYXRlZCBkdXJpbmcgaXRlcmF0aW9uKVxuICAgIGxldCBpdGVyYXRpb25SZXNldCA9IGZhbHNlO1xuICAgIGNvbnN0IGluc3RhbmNlcyA9IHt9O1xuICAgIGxldCB0b3RhbENvdW50ID0gMDtcbiAgICBjb25zdCBjbGFzc0NvdW50cyA9IHt9O1xuXG4gICAgY29uc3QgcG9wdWxhdGVDbGFzc0NvdW50cyA9IGFzeW5jIChpbnN0YW5jZSkgPT4ge1xuICAgICAgaWYgKGluc3RhbmNlLnJlc2V0KSB7XG4gICAgICAgIC8vIENhY2hlIGludmFsaWRhdGVkISBTdG9wIGl0ZXJhdGluZyBhbmQgcmV0dXJuIG51bGxcbiAgICAgICAgaXRlcmF0aW9uUmVzZXQgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAoaW5zdGFuY2VzW2luc3RhbmNlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgIC8vIERvbid0IGFkZCB0aGlzIGluc3RhbmNlIGlmIHdlIGFscmVhZHkgc2FtcGxlZCBpdCwgYnV0IGtlZXAgaXRlcmF0aW5nXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgLy8gQWRkIGFuZCBjb3VudCB0aGlzIGluc3RhbmNlIHRvIHRoZSBzYW1wbGVcbiAgICAgIGluc3RhbmNlc1tpbnN0YW5jZS5pbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgdG90YWxDb3VudCsrO1xuICAgICAgY2xhc3NDb3VudHNbaW5zdGFuY2UuY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc0NvdW50c1tpbnN0YW5jZS5jbGFzc09iai5jbGFzc0lkXSB8fCAwO1xuICAgICAgY2xhc3NDb3VudHNbaW5zdGFuY2UuY2xhc3NPYmouY2xhc3NJZF0rKztcblxuICAgICAgaWYgKHRvdGFsQ291bnQgPj0gc2VlZExpbWl0KSB7XG4gICAgICAgIC8vIFdlIGhhdmUgZW5vdWdoOyBzdG9wIGl0ZXJhdGluZ1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIFRyeSB0byBhZGQgdGhlIG5laWdoYm9ycyBvZiB0aGlzIHNhbXBsZSBmcm9tIGNsYXNzZXMgd2hlcmUgd2UgZG9uJ3QgaGF2ZVxuICAgICAgLy8gZW5vdWdoIHNhbXBsZXMgeWV0XG4gICAgICBjb25zdCBjbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NlcykuZmlsdGVyKGNsYXNzSWQgPT4ge1xuICAgICAgICByZXR1cm4gKGNsYXNzQ291bnRzW2NsYXNzSWRdIHx8IDApIDwgY2xhc3NDb3VudDtcbiAgICAgIH0pO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBuZWlnaGJvciBvZiBpbnN0YW5jZS5uZWlnaGJvcnMoeyBsaW1pdDogY2x1c3RlckxpbWl0LCBjbGFzc0lkcyB9KSkge1xuICAgICAgICBpZiAoIWF3YWl0IHBvcHVsYXRlQ2xhc3NDb3VudHMobmVpZ2hib3IpKSB7XG4gICAgICAgICAgLy8gUGFzcyBhbG9uZyB0aGUgc2lnbmFsIHRvIHN0b3AgaXRlcmF0aW5nXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBTaWduYWwgdGhhdCB3ZSBzaG91bGQga2VlcCBpdGVyYXRpbmdcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG4gICAgZm9yIChjb25zdCBbY2xhc3NJZCwgY2xhc3NPYmpdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNvbnN0IHJvd0NvdW50ID0gYXdhaXQgY2xhc3NPYmoudGFibGUuY291bnRSb3dzKCk7XG4gICAgICAvLyBEb24ndCBzYW1wbGUgZnJvbSBHZW5lcmljQ2xhc3Nlc1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdHZW5lcmljJykge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gR2V0IGF0IGxlYXN0IGNsYXNzQ291bnQgaW5zdGFuY2VzIGZyb20gdGhpcyBjbGFzcyAoYXMgbG9uZyBhcyB3ZVxuICAgICAgLy8gaGF2ZW4ndCBleGhhdXN0ZWQgYWxsIHRoZSBpbnN0YW5jZXMgdGhlIGNsYXNzIGhhcyB0byBnaXZlKVxuICAgICAgd2hpbGUgKChjbGFzc0NvdW50c1tjbGFzc0lkXSB8fCAwKSA8IGNsYXNzQ291bnQgJiYgKGNsYXNzQ291bnRzW2NsYXNzSWRdIHx8IDApIDwgcm93Q291bnQpIHtcbiAgICAgICAgaWYgKGl0ZXJhdGlvblJlc2V0KSB7XG4gICAgICAgICAgLy8gQ2FjaGUgaW52YWxpZGF0ZWQ7IGJhaWwgaW1tZWRpYXRlbHlcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICAvLyBBZGQgYSByYW5kb20gaW5zdGFuY2UsIGFuZCB0cnkgdG8gcHJpb3JpdGl6ZSBpdHMgbmVpZ2hib3JzIGluIG90aGVyIGNsYXNzZXNcbiAgICAgICAgaWYgKCFhd2FpdCBwb3B1bGF0ZUNsYXNzQ291bnRzKGF3YWl0IGNsYXNzT2JqLnRhYmxlLmdldFJhbmRvbUl0ZW0oKSkpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaW5zdGFuY2VzO1xuICB9XG4gIHZhbGlkYXRlSW5zdGFuY2VTYW1wbGUgKGluc3RhbmNlcykge1xuICAgIC8vIENoZWNrIGlmIGFsbCB0aGUgaW5zdGFuY2VzIGFyZSBzdGlsbCBjdXJyZW50OyByZXR1cm4gbnVsbCBhcyBhIHNpZ25hbFxuICAgIC8vIHRoYXQgYSBjYWNoZSB3YXMgaW52YWxpZGF0ZWQsIGFuZCB0aGF0IGEgZnVuY3Rpb24gbmVlZHMgdG8gYmUgY2FsbGVkIGFnYWluXG4gICAgZm9yIChjb25zdCBpbnN0YW5jZSBvZiBPYmplY3QudmFsdWVzKGluc3RhbmNlcykpIHtcbiAgICAgIGlmIChpbnN0YW5jZS5yZXNldCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGluc3RhbmNlcztcbiAgfVxuICBhc3luYyB1cGRhdGVJbnN0YW5jZVNhbXBsZSAoaW5zdGFuY2VzKSB7XG4gICAgLy8gUmVwbGFjZSBhbnkgb3V0LW9mLWRhdGUgaW5zdGFuY2VzLCBhbmQgZXhjbHVkZSBpbnN0YW5jZXMgdGhhdCBubyBsb25nZXIgZXhpc3RcbiAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFtpbnN0YW5jZUlkLCBpbnN0YW5jZV0gb2YgT2JqZWN0LmVudHJpZXMoaW5zdGFuY2VzKSkge1xuICAgICAgY29uc3QgeyBjbGFzc0lkLCBpbmRleCB9ID0gSlNPTi5wYXJzZShpbnN0YW5jZUlkKTtcbiAgICAgIGlmICh0aGlzLmNsYXNzZXNbY2xhc3NJZF0pIHtcbiAgICAgICAgaWYgKGluc3RhbmNlLnJlc2V0KSB7XG4gICAgICAgICAgY29uc3QgbmV3SW5zdGFuY2UgPSBhd2FpdCB0aGlzLmNsYXNzZXNbY2xhc3NJZF0udGFibGUuZ2V0SXRlbShpbmRleCk7XG4gICAgICAgICAgaWYgKG5ld0luc3RhbmNlKSB7XG4gICAgICAgICAgICByZXN1bHRbbmV3SW5zdGFuY2UuaW5zdGFuY2VJZF0gPSBuZXdJbnN0YW5jZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0W2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmFsaWRhdGVJbnN0YW5jZVNhbXBsZShyZXN1bHQpO1xuICB9XG4gIHBhcnRpdGlvbkluc3RhbmNlU2FtcGxlIChpbnN0YW5jZXMpIHtcbiAgICAvLyBTZXBhcmF0ZSBzYW1wbGVzIGJ5IHRoZWlyIHR5cGVcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBub2Rlczoge30sXG4gICAgICBlZGdlczoge30sXG4gICAgICBnZW5lcmljczoge31cbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2luc3RhbmNlSWQsIGluc3RhbmNlXSBvZiBPYmplY3QuZW50cmllcyhpbnN0YW5jZXMpKSB7XG4gICAgICBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIHJlc3VsdC5ub2Rlc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgfSBlbHNlIGlmIChpbnN0YW5jZS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgcmVzdWx0LmVkZ2VzW2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQuZ2VuZXJpY3NbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBmaWxsSW5zdGFuY2VTYW1wbGUgKGluc3RhbmNlcykge1xuICAgIC8vIEdpdmVuIGEgc3BlY2lmaWMgc2FtcGxlIG9mIHRoZSBncmFwaCwgYWRkIGluc3RhbmNlcyB0byBlbnN1cmUgdGhhdDpcbiAgICAvLyAxLiBGb3IgZXZlcnkgcGFpciBvZiBub2RlcywgYW55IGVkZ2VzIHRoYXQgZXhpc3QgYmV0d2VlbiB0aGVtIHNob3VsZCBiZSBhZGRlZFxuICAgIC8vIDIuIEZvciBldmVyeSBlZGdlLCBlbnN1cmUgdGhhdCBhdCBsZWFzdCBvbmUgc291cmNlIGFuZCB0YXJnZXQgbm9kZSBpcyBhZGRlZFxuICAgIGNvbnN0IHsgbm9kZXMsIGVkZ2VzIH0gPSB0aGlzLnBhcnRpdGlvbkluc3RhbmNlU2FtcGxlKGluc3RhbmNlcyk7XG4gICAgY29uc3QgZXh0cmFOb2RlcyA9IHt9O1xuICAgIGNvbnN0IGV4dHJhRWRnZXMgPSB7fTtcblxuICAgIC8vIE1ha2Ugc3VyZSB0aGF0IGVhY2ggZWRnZSBoYXMgYXQgbGVhc3Qgb25lIHNvdXJjZSBhbmQgb25lIHRhcmdldCAoYXNzdW1pbmdcbiAgICAvLyB0aGF0IHNvdXJjZSBhbmQgdGFyZ2V0IGNsYXNzZXMgYXJlIGNvbm5lY3RlZClcbiAgICBjb25zdCBzZWVkU2lkZSA9IGFzeW5jIChlZGdlLCBpdGVyRnVuYykgPT4ge1xuICAgICAgbGV0IGFOb2RlO1xuICAgICAgbGV0IGlzU2VlZGVkID0gZmFsc2U7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZVtpdGVyRnVuY10oKSkge1xuICAgICAgICBhTm9kZSA9IGFOb2RlIHx8IG5vZGU7XG4gICAgICAgIGlmIChub2Rlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgaXNTZWVkZWQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIWlzU2VlZGVkICYmIGFOb2RlKSB7XG4gICAgICAgIGV4dHJhTm9kZXNbYU5vZGUuaW5zdGFuY2VJZF0gPSBhTm9kZTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGZvciAoY29uc3QgZWRnZSBvZiBPYmplY3QudmFsdWVzKGVkZ2VzKSkge1xuICAgICAgYXdhaXQgc2VlZFNpZGUoZWRnZSwgJ3NvdXJjZU5vZGVzJyk7XG4gICAgICBhd2FpdCBzZWVkU2lkZShlZGdlLCAndGFyZ2V0Tm9kZXMnKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgYW55IGVkZ2VzIHRoYXQgZXhpc3QgdGhhdCBjb25uZWN0IGFueSBvZiB0aGUgY29yZSBub2Rlc1xuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBPYmplY3QudmFsdWVzKG5vZGVzKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIG5vZGUuZWRnZXMoKSkge1xuICAgICAgICBpZiAoIWVkZ2VzW2VkZ2UuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAvLyBDaGVjayB0aGF0IGJvdGggZW5kcyBvZiB0aGUgZWRnZSBjb25uZWN0IGF0IGxlYXN0IG9uZVxuICAgICAgICAgIC8vIG9mIG91ciBub2Rlc1xuICAgICAgICAgIGxldCBjb25uZWN0c1NvdXJjZSA9IGZhbHNlO1xuICAgICAgICAgIGxldCBjb25uZWN0c1RhcmdldCA9IGZhbHNlO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2Rlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzU291cmNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2Rlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzVGFyZ2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjb25uZWN0c1NvdXJjZSAmJiBjb25uZWN0c1RhcmdldCkge1xuICAgICAgICAgICAgZXh0cmFFZGdlc1tlZGdlLmluc3RhbmNlSWRdID0gZWRnZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBdCB0aGlzIHBvaW50IHdlIGhhdmUgYSBjb21wbGV0ZSBzZXQgb2Ygbm9kZXMgYW5kIGVkZ2VzIHRoYXQgd2Ugd2FudCB0b1xuICAgIC8vIGluY2x1ZGUuIFdlIGp1c3QgbmVlZCB0byBtZXJnZSBhbmQgdmFsaWRhdGUgdGhlIHNhbXBsZXM6XG4gICAgaW5zdGFuY2VzID0gT2JqZWN0LmFzc2lnbih7fSwgbm9kZXMsIGVkZ2VzLCBleHRyYU5vZGVzLCBleHRyYUVkZ2VzKTtcbiAgICByZXR1cm4gdGhpcy52YWxpZGF0ZUluc3RhbmNlU2FtcGxlKGluc3RhbmNlcyk7XG4gIH1cbiAgYXN5bmMgaW5zdGFuY2VTYW1wbGVUb0dyYXBoIChpbnN0YW5jZXMpIHtcbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdXG4gICAgfTtcblxuICAgIGNvbnN0IHsgbm9kZXMsIGVkZ2VzIH0gPSB0aGlzLnBhcnRpdGlvbkluc3RhbmNlU2FtcGxlKGluc3RhbmNlcyk7XG5cbiAgICAvLyBNYWtlIGEgbGlzdCBvZiBub2RlcywgcGx1cyBhIGxvb2t1cCB0byBlYWNoIG5vZGUncyBpbmRleFxuICAgIGZvciAoY29uc3QgW2luc3RhbmNlSWQsIG5vZGVdIG9mIE9iamVjdC5lbnRyaWVzKG5vZGVzKSkge1xuICAgICAgZ3JhcGgubm9kZUxvb2t1cFtpbnN0YW5jZUlkXSA9IGdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICBub2RlSW5zdGFuY2U6IG5vZGUsXG4gICAgICAgIGR1bW15OiBmYWxzZVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGFsbCB0aGUgZWRnZXMsIGluY2x1ZGluZyBkdW1teSBub2RlcyBmb3IgZGFuZ2xpbmcgZWRnZXNcbiAgICBmb3IgKGNvbnN0IGVkZ2Ugb2YgT2JqZWN0LnZhbHVlcyhlZGdlcykpIHtcbiAgICAgIGlmICghZWRnZS5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmICghZWRnZS5jbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgLy8gTWlzc2luZyBib3RoIHNvdXJjZSBhbmQgdGFyZ2V0IGNsYXNzZXM7IGFkZCBkdW1teSBub2RlcyBmb3IgYm90aCBlbmRzXG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoICsgMVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQWRkIGR1bW15IHNvdXJjZSBub2Rlc1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIWVkZ2UuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAvLyBBZGQgZHVtbXkgdGFyZ2V0IG5vZGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdLFxuICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGVyZSBzaG91bGQgYmUgYm90aCBzb3VyY2UgYW5kIHRhcmdldCBub2RlcyBmb3IgZWFjaCBlZGdlXG4gICAgICAgIC8vIChvbmx5IGNyZWF0ZSBkdW1teSBub2RlcyBmb3IgZWRnZXMgdGhhdCBhcmUgYWN0dWFsbHkgZGlzY29ubmVjdGVkKVxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZU5vZGUgb2YgZWRnZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbc291cmNlTm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldE5vZGUgb2YgZWRnZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3RhcmdldE5vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2RlTG9va3VwW3NvdXJjZU5vZGUuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Tm9kZS5pbnN0YW5jZUlkXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXROZXR3b3JrTW9kZWxHcmFwaCAoe1xuICAgIHJhdyA9IHRydWUsXG4gICAgaW5jbHVkZUR1bW1pZXMgPSBmYWxzZSxcbiAgICBjbGFzc0xpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcylcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICBsZXQgZ3JhcGggPSB7XG4gICAgICBjbGFzc2VzOiBbXSxcbiAgICAgIGNsYXNzTG9va3VwOiB7fSxcbiAgICAgIGNsYXNzQ29ubmVjdGlvbnM6IFtdXG4gICAgfTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgY2xhc3NMaXN0KSB7XG4gICAgICAvLyBBZGQgYW5kIGluZGV4IHRoZSBjbGFzcyBhcyBhIG5vZGVcbiAgICAgIGNvbnN0IGNsYXNzU3BlYyA9IHJhdyA/IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpIDogeyBjbGFzc09iaiB9O1xuICAgICAgY2xhc3NTcGVjLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGguY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBncmFwaC5jbGFzc2VzLmxlbmd0aDtcbiAgICAgIGdyYXBoLmNsYXNzZXMucHVzaChjbGFzc1NwZWMpO1xuXG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIC8vIFN0b3JlIHRoZSBlZGdlIGNsYXNzIHNvIHdlIGNhbiBjcmVhdGUgY2xhc3NDb25uZWN0aW9ucyBsYXRlclxuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnICYmIGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IG5vZGVcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7Y2xhc3NPYmouY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGggLSAxLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGZhbHNlLFxuICAgICAgICAgIGxvY2F0aW9uOiAnbm9kZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENyZWF0ZSBleGlzdGluZyBjbGFzc0Nvbm5lY3Rpb25zXG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZUNsYXNzZXMpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDb25uZWN0IHRoZSBzb3VyY2Ugbm9kZSBjbGFzcyB0byB0aGUgZWRnZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZH0+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBzb3VyY2UgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYGR1bW15PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDb25uZWN0IHRoZSBlZGdlIGNsYXNzIHRvIHRoZSB0YXJnZXQgbm9kZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+JHtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnRhcmdldENsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSB0YXJnZXQgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGggKCkge1xuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgdGFibGVzOiBbXSxcbiAgICAgIHRhYmxlTG9va3VwOiB7fSxcbiAgICAgIHRhYmxlTGlua3M6IFtdXG4gICAgfTtcbiAgICBjb25zdCB0YWJsZUxpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKTtcbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgY29uc3QgdGFibGVTcGVjID0gdGFibGUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZVNwZWMudHlwZSA9IHRhYmxlLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGdyYXBoLnRhYmxlcy5sZW5ndGg7XG4gICAgICBncmFwaC50YWJsZXMucHVzaCh0YWJsZVNwZWMpO1xuICAgIH1cbiAgICAvLyBGaWxsIHRoZSBncmFwaCB3aXRoIGxpbmtzIGJhc2VkIG9uIHBhcmVudFRhYmxlcy4uLlxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRhYmxlLnBhcmVudFRhYmxlcykge1xuICAgICAgICBncmFwaC50YWJsZUxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogZ3JhcGgudGFibGVMb29rdXBbcGFyZW50VGFibGUudGFibGVJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE1vZGVsRHVtcCAoKSB7XG4gICAgLy8gQmVjYXVzZSBvYmplY3Qga2V5IG9yZGVycyBhcmVuJ3QgZGV0ZXJtaW5pc3RpYywgaXQgY2FuIGJlIHByb2JsZW1hdGljXG4gICAgLy8gZm9yIHRlc3RpbmcgKGJlY2F1c2UgaWRzIGNhbiByYW5kb21seSBjaGFuZ2UgZnJvbSB0ZXN0IHJ1biB0byB0ZXN0IHJ1bikuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzb3J0cyBlYWNoIGtleSwgYW5kIGp1c3QgcmVwbGFjZXMgSURzIHdpdGggaW5kZXggbnVtYmVyc1xuICAgIGNvbnN0IHJhd09iaiA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodGhpcy5fdG9SYXdPYmplY3QoKSkpO1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGNsYXNzZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLmNsYXNzZXMpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgYUhhc2ggPSB0aGlzLmNsYXNzZXNbYS5jbGFzc0lkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBjb25zdCBiSGFzaCA9IHRoaXMuY2xhc3Nlc1tiLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgdGFibGVzOiBPYmplY3QudmFsdWVzKHJhd09iai50YWJsZXMpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgYUhhc2ggPSB0aGlzLnRhYmxlc1thLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy50YWJsZXNbYi50YWJsZUlkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBpZiAoYUhhc2ggPCBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIGlmIChhSGFzaCA+IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YWJsZSBoYXNoIGNvbGxpc2lvbmApO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH07XG4gICAgY29uc3QgY2xhc3NMb29rdXAgPSB7fTtcbiAgICBjb25zdCB0YWJsZUxvb2t1cCA9IHt9O1xuICAgIHJlc3VsdC5jbGFzc2VzLmZvckVhY2goKGNsYXNzT2JqLCBpbmRleCkgPT4ge1xuICAgICAgY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBpbmRleDtcbiAgICB9KTtcbiAgICByZXN1bHQudGFibGVzLmZvckVhY2goKHRhYmxlLCBpbmRleCkgPT4ge1xuICAgICAgdGFibGVMb29rdXBbdGFibGUudGFibGVJZF0gPSBpbmRleDtcbiAgICB9KTtcblxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgcmVzdWx0LnRhYmxlcykge1xuICAgICAgdGFibGUudGFibGVJZCA9IHRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpKSB7XG4gICAgICAgIHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVMb29rdXBbdGFibGVJZF1dID0gdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgICAgZGVsZXRlIHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVJZF07XG4gICAgICB9XG4gICAgICBkZWxldGUgdGFibGUuZGF0YTsgLy8gZG9uJ3QgaW5jbHVkZSBhbnkgb2YgdGhlIGRhdGE7IHdlIGp1c3Qgd2FudCB0aGUgbW9kZWwgc3RydWN0dXJlXG4gICAgfVxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgcmVzdWx0LmNsYXNzZXMpIHtcbiAgICAgIGNsYXNzT2JqLmNsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXTtcbiAgICAgIGNsYXNzT2JqLnRhYmxlSWQgPSB0YWJsZUxvb2t1cFtjbGFzc09iai50YWJsZUlkXTtcbiAgICAgIGlmIChjbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai5zb3VyY2VUYWJsZUlkcykge1xuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcyA9IGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHRhYmxlTG9va3VwW3RhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldENsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai50YXJnZXRDbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcyA9IGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHRhYmxlTG9va3VwW3RhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgY2xhc3NJZCBvZiBPYmplY3Qua2V5cyhjbGFzc09iai5lZGdlQ2xhc3NJZHMgfHwge30pKSB7XG4gICAgICAgIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0xvb2t1cFtjbGFzc0lkXV0gPSBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICAgIGRlbGV0ZSBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgY3JlYXRlU2NoZW1hTW9kZWwgKCkge1xuICAgIGNvbnN0IGdyYXBoID0gdGhpcy5nZXRNb2RlbER1bXAoKTtcblxuICAgIGdyYXBoLnRhYmxlcy5mb3JFYWNoKHRhYmxlID0+IHtcbiAgICAgIHRhYmxlLmRlcml2ZWRUYWJsZXMgPSBPYmplY3Qua2V5cyh0YWJsZS5kZXJpdmVkVGFibGVzKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ld01vZGVsID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlTW9kZWwoeyBuYW1lOiB0aGlzLm5hbWUgKyAnX3NjaGVtYScgfSk7XG4gICAgY29uc3QgcmF3ID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGgsXG4gICAgICBuYW1lOiAnUmF3IER1bXAnXG4gICAgfSk7XG4gICAgbGV0IFsgY2xhc3NlcywgdGFibGVzIF0gPSByYXcuY2xvc2VkVHJhbnNwb3NlKFsnY2xhc3NlcycsICd0YWJsZXMnXSk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgIGNsYXNzZXMuc2V0Q2xhc3NOYW1lKCdDbGFzc2VzJyk7XG4gICAgcmF3LmRlbGV0ZSgpO1xuXG4gICAgY29uc3Qgc291cmNlQ2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAnc291cmNlQ2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHNvdXJjZUNsYXNzZXMuc2V0Q2xhc3NOYW1lKCdTb3VyY2UgQ2xhc3MnKTtcbiAgICBzb3VyY2VDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuICAgIGNvbnN0IHRhcmdldENsYXNzZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogY2xhc3NlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhcmdldENsYXNzSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICB0YXJnZXRDbGFzc2VzLnNldENsYXNzTmFtZSgnVGFyZ2V0IENsYXNzJyk7XG4gICAgdGFyZ2V0Q2xhc3Nlcy50b2dnbGVEaXJlY3Rpb24oKTtcblxuICAgIHRhYmxlcyA9IHRhYmxlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgdGFibGVzLnNldENsYXNzTmFtZSgnVGFibGVzJyk7XG5cbiAgICBjb25zdCB0YWJsZURlcGVuZGVuY2llcyA9IHRhYmxlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ2Rlcml2ZWRUYWJsZXMnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICB0YWJsZURlcGVuZGVuY2llcy5zZXRDbGFzc05hbWUoJ0lzIFBhcmVudCBPZicpO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgY29uc3QgY29yZVRhYmxlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YWJsZUlkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgY29yZVRhYmxlcy5zZXRDbGFzc05hbWUoJ0NvcmUgVGFibGUnKTtcbiAgICByZXR1cm4gbmV3TW9kZWw7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE5ldHdvcmtNb2RlbDtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IE5ldHdvcmtNb2RlbCBmcm9tICcuL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMnO1xuXG5sZXQgTkVYVF9NT0RFTF9JRCA9IDE7XG5cbmNsYXNzIE9yaWdyYXBoIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAobG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gb25seSBkZWZpbmVkIGluIHRoZSBicm93c2VyIGNvbnRleHRcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICBsZXQgZXhpc3RpbmdNb2RlbHMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnKTtcbiAgICBpZiAoZXhpc3RpbmdNb2RlbHMpIHtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyhKU09OLnBhcnNlKGV4aXN0aW5nTW9kZWxzKSkpIHtcbiAgICAgICAgbW9kZWwub3JpZ3JhcGggPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsc1ttb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwobW9kZWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgfVxuICByZWdpc3RlclBsdWdpbiAobmFtZSwgcGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW5zW25hbWVdID0gcGx1Z2luO1xuICB9XG4gIHNhdmUgKCkge1xuICAgIC8qXG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH1cbiAgICAqL1xuICB9XG4gIGNsb3NlQ3VycmVudE1vZGVsICgpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBnZXQgY3VycmVudE1vZGVsICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbdGhpcy5fY3VycmVudE1vZGVsSWRdIHx8IG51bGw7XG4gIH1cbiAgc2V0IGN1cnJlbnRNb2RlbCAobW9kZWwpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG1vZGVsID8gbW9kZWwubW9kZWxJZCA6IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBhc3luYyBsb2FkTW9kZWwgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuY3JlYXRlTW9kZWwoeyBtb2RlbElkOiBvcHRpb25zLm5hbWUgfSk7XG4gICAgYXdhaXQgbmV3TW9kZWwuYWRkVGV4dEZpbGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG4gIGNyZWF0ZU1vZGVsIChvcHRpb25zID0ge30pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMubW9kZWxJZCB8fCB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdKSB7XG4gICAgICBvcHRpb25zLm1vZGVsSWQgPSBgbW9kZWwke05FWFRfTU9ERUxfSUR9YDtcbiAgICAgIE5FWFRfTU9ERUxfSUQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5vcmlncmFwaCA9IHRoaXM7XG4gICAgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwob3B0aW9ucyk7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBvcHRpb25zLm1vZGVsSWQ7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXTtcbiAgfVxuICBkZWxldGVNb2RlbCAobW9kZWxJZCA9IHRoaXMuY3VycmVudE1vZGVsSWQpIHtcbiAgICBpZiAoIXRoaXMubW9kZWxzW21vZGVsSWRdKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBub24tZXhpc3RlbnQgbW9kZWw6ICR7bW9kZWxJZH1gKTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWxzW21vZGVsSWRdO1xuICAgIGlmICh0aGlzLl9jdXJyZW50TW9kZWxJZCA9PT0gbW9kZWxJZCkge1xuICAgICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICB9XG4gICAgdGhpcy5zYXZlKCk7XG4gIH1cbiAgZGVsZXRlQWxsTW9kZWxzICgpIHtcbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE9yaWdyYXBoO1xuIiwiaW1wb3J0IE9yaWdyYXBoIGZyb20gJy4vT3JpZ3JhcGguanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgb3JpZ3JhcGggPSBuZXcgT3JpZ3JhcGgod2luZG93LmxvY2FsU3RvcmFnZSk7XG5vcmlncmFwaC52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG9yaWdyYXBoO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJfZXZlbnRIYW5kbGVycyIsIl9zdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJldmVudCIsIm5hbWVzcGFjZSIsInNwbGl0IiwicHVzaCIsIm9mZiIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiaGFuZGxlQ2FsbGJhY2siLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiR2VuZXJpY1dyYXBwZXIiLCJvcHRpb25zIiwidGFibGUiLCJ1bmRlZmluZWQiLCJFcnJvciIsImNsYXNzT2JqIiwicm93IiwiY29ubmVjdGVkSXRlbXMiLCJkdXBsaWNhdGVJdGVtcyIsInJlZ2lzdGVyRHVwbGljYXRlIiwiaXRlbSIsImNvbm5lY3RJdGVtIiwidGFibGVJZCIsImR1cCIsImRpc2Nvbm5lY3QiLCJpdGVtTGlzdCIsInZhbHVlcyIsImluc3RhbmNlSWQiLCJjbGFzc0lkIiwiZXhwb3J0SWQiLCJsYWJlbCIsImFubm90YXRpb25zIiwibGFiZWxBdHRyIiwiZXF1YWxzIiwiaGFuZGxlTGltaXQiLCJpdGVyYXRvcnMiLCJsaW1pdCIsIkluZmluaXR5IiwiaXRlcmF0b3IiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJtb2RlbCIsInRhYmxlcyIsImJ1aWxkQ2FjaGUiLCJfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwicmVzZXQiLCJuZXh0VGFibGVJZCIsImxlbmd0aCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX2xpbWl0UHJvbWlzZXMiLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwiZnVuYyIsImdldFNvcnRIYXNoIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIml0ZXJhdGUiLCJfY2FjaGUiLCJfcGFydGlhbENhY2hlIiwicmVzb2x2ZSIsInJlamVjdCIsIl9pdGVyYXRlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlTG9va3VwIiwiZG9uZSIsIm5leHQiLCJoYW5kbGVSZXNldCIsIl9maW5pc2hJdGVtIiwiTnVtYmVyIiwiX2NhY2hlTG9va3VwIiwiX2NhY2hlUHJvbWlzZSIsIml0ZW1zVG9SZXNldCIsImNvbmNhdCIsImRlcml2ZWRUYWJsZSIsImNvdW50Um93cyIsIndyYXBwZWRJdGVtIiwiZGVsYXllZFJvdyIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZ2V0SW5kZXhEZXRhaWxzIiwiZGV0YWlscyIsInN1cHByZXNzZWQiLCJmaWx0ZXJlZCIsImdldEF0dHJpYnV0ZURldGFpbHMiLCJhbGxBdHRycyIsImV4cGVjdGVkIiwib2JzZXJ2ZWQiLCJkZXJpdmVkIiwiY3VycmVudERhdGEiLCJkYXRhIiwibG9va3VwIiwiY29tcGxldGUiLCJfZ2V0SXRlbSIsImdldEl0ZW0iLCJnZXRSYW5kb21JdGVtIiwicmFuZEluZGV4IiwiTWF0aCIsImZsb29yIiwicmFuZG9tIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwidW5TdXBwcmVzc2VkQXR0cmlidXRlcyIsImZpbHRlciIsInN1cHByZXNzQXR0cmlidXRlIiwidW5TdXBwcmVzc0F0dHJpYnV0ZSIsImFkZEZpbHRlciIsIl9kZXJpdmVUYWJsZSIsIm5ld1RhYmxlIiwiY3JlYXRlVGFibGUiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGUiLCJmaW5kIiwidGFibGVPYmoiLCJldmVyeSIsIm9wdGlvbk5hbWUiLCJvcHRpb25WYWx1ZSIsInByb21vdGUiLCJleHBhbmQiLCJ1bnJvbGwiLCJjbG9zZWRGYWNldCIsIm9wZW5GYWNldCIsImNsb3NlZFRyYW5zcG9zZSIsImluZGV4ZXMiLCJvcGVuVHJhbnNwb3NlIiwiZHVwbGljYXRlIiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0Iiwib3RoZXJUYWJsZSIsInByb2plY3QiLCJ0YWJsZU9yZGVyIiwib3RoZXJUYWJsZUlkIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJmb3JjZSIsImVyciIsInBhcmVudFRhYmxlIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQXR0clRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkF0dHJUYWJsZU1peGluIiwiX2F0dHJpYnV0ZSIsIlByb21vdGVkVGFibGUiLCJfdW5maW5pc2hlZENhY2hlIiwiX3VuZmluaXNoZWRDYWNoZUxvb2t1cCIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicFRhYmxlIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJEdXBsaWNhdGVkVGFibGUiLCJDaGlsZFRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpbiIsInBhcmVudEluZGV4IiwiRXhwYW5kZWRUYWJsZSIsIlVucm9sbGVkVGFibGUiLCJyb3dzIiwiUGFyZW50Q2hpbGRUYWJsZSIsImNoaWxkVGFibGUiLCJjaGlsZCIsInBhcmVudCIsIlByb2plY3RlZFRhYmxlIiwic2VsZiIsImZpcnN0VGFibGUiLCJyZW1haW5pbmdJZHMiLCJzb3VyY2VJdGVtIiwibGFzdEl0ZW0iLCJHZW5lcmljQ2xhc3MiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwic2V0Q2xhc3NOYW1lIiwic2V0QW5ub3RhdGlvbiIsImtleSIsImRlbGV0ZUFubm90YXRpb24iLCJoYXNDdXN0b21OYW1lIiwidmFyaWFibGVOYW1lIiwiZCIsInRvTG9jYWxlVXBwZXJDYXNlIiwiZGVsZXRlZCIsImludGVycHJldEFzTm9kZXMiLCJvdmVyd3JpdGUiLCJjcmVhdGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJpbnRlcHJldEFzR2VuZXJpYyIsImFnZ3JlZ2F0ZSIsImRpc3NvbHZlIiwiY2FuRGlzc29sdmUiLCJvcHRpbWl6ZVRhYmxlcyIsImNvdW50QWxsVW5pcXVlVmFsdWVzIiwiaGFzaGFibGVCaW5zIiwidW5IYXNoYWJsZUNvdW50cyIsImluZGV4QmluIiwiTm9kZVdyYXBwZXIiLCJlZGdlcyIsImVkZ2VJZHMiLCJjbGFzc0lkcyIsImVkZ2VDbGFzc0lkcyIsImVkZ2VJZCIsImVkZ2VDbGFzcyIsInJvbGUiLCJnZXRFZGdlUm9sZSIsInJldmVyc2UiLCJuZWlnaGJvck5vZGVzIiwiZWRnZSIsInRhcmdldE5vZGVzIiwidGFyZ2V0Iiwic291cmNlTm9kZXMiLCJzb3VyY2UiLCJuZWlnaGJvcnMiLCJwYWlyd2lzZU5laWdoYm9yaG9vZCIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc2VzIiwiZWRnZUNsYXNzSWQiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsImF1dG9jb25uZWN0IiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiaXNTb3VyY2UiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIm5vZGVDbGFzcyIsInRhYmxlSWRMaXN0IiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJpbnRlcnByZXRBc0dlbmVyaWMiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5ld05vZGVDbGFzcyIsIm5ld0NsYXNzIiwicG9wIiwiY29ubmVjdFRvQ2hpbGROb2RlQ2xhc3MiLCJjaGlsZENsYXNzIiwicHJvamVjdE5ld0VkZ2UiLCJjbGFzc0lkTGlzdCIsImNsYXNzTGlzdCIsImVkZ2VSb2xlIiwiQXJyYXkiLCJmcm9tIiwiY29ubmVjdGVkQ2xhc3NlcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlVGFibGVJZCIsInRhcmdldFRhYmxlSWQiLCJub2RlcyIsIkVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJfc3BsaXRUYWJsZUlkTGlzdCIsIm90aGVyQ2xhc3MiLCJub2RlVGFibGVJZExpc3QiLCJlZGdlVGFibGVJZCIsImVkZ2VUYWJsZUlkTGlzdCIsInN0YXRpY0V4aXN0cyIsInRhYmxlRGlzdGFuY2VzIiwic3RhcnRzV2l0aCIsImRpc3QiLCJhYnMiLCJzb3J0IiwiYSIsImIiLCJzaWRlIiwiY29ubmVjdFNvdXJjZSIsImNvbm5lY3RUYXJnZXQiLCJ0b2dnbGVEaXJlY3Rpb24iLCJzd2FwcGVkRGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwidW5zaGlmdCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwic2hpZnQiLCJjb25uZWN0RmFjZXRlZENsYXNzIiwibmV3Q2xhc3NlcyIsIkZpbGVGb3JtYXQiLCJidWlsZFJvdyIsIlBhcnNlRmFpbHVyZSIsImZpbGVGb3JtYXQiLCJOT0RFX05BTUVTIiwiRURHRV9OQU1FUyIsIkQzSnNvbiIsImltcG9ydERhdGEiLCJ0ZXh0Iiwic291cmNlQXR0cmlidXRlIiwidGFyZ2V0QXR0cmlidXRlIiwiY2xhc3NBdHRyaWJ1dGUiLCJKU09OIiwicGFyc2UiLCJub2RlTmFtZSIsImVkZ2VOYW1lIiwiY29yZVRhYmxlIiwiY29yZUNsYXNzIiwibm9kZUNsYXNzZXMiLCJub2RlQ2xhc3NMb29rdXAiLCJzYW1wbGUiLCJzb3VyY2VDbGFzc05hbWUiLCJ0YXJnZXRDbGFzc05hbWUiLCJmb3JtYXREYXRhIiwiaW5jbHVkZUNsYXNzZXMiLCJwcmV0dHkiLCJsaW5rcyIsIm5vZGVMb29rdXAiLCJvdGhlciIsIm5vZGUiLCJzdHJpbmdpZnkiLCJCdWZmZXIiLCJleHRlbnNpb24iLCJDc3ZaaXAiLCJpbmRleE5hbWUiLCJ6aXAiLCJKU1ppcCIsImNvbnRlbnRzIiwiZmlsZSIsImdlbmVyYXRlQXN5bmMiLCJlc2NhcGVDaGFycyIsIkdFWEYiLCJlc2NhcGUiLCJzdHIiLCJyZXBsIiwiZXhwIiwibm9kZUNodW5rIiwiZWRnZUNodW5rIiwiREFUQUxJQl9GT1JNQVRTIiwiTmV0d29ya01vZGVsIiwib3JpZ3JhcGgiLCJtb2RlbElkIiwiX29yaWdyYXBoIiwiX25leHRDbGFzc0lkIiwiX25leHRUYWJsZUlkIiwiaHlkcmF0ZSIsIkNMQVNTRVMiLCJUQUJMRVMiLCJfc2F2ZVRpbWVvdXQiLCJzYXZlIiwidW5zYXZlZCIsInJhd09iamVjdCIsIlRZUEVTIiwiZmluZENsYXNzIiwicmVuYW1lIiwibmV3TmFtZSIsImFubm90YXRlIiwiZGVsZXRlTW9kZWwiLCJtb2RlbHMiLCJhZGRUZXh0RmlsZSIsImZvcm1hdCIsIm1pbWUiLCJGSUxFX0ZPUk1BVFMiLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNUYWJsZSIsInRhYmxlc0luVXNlIiwicGFyZW50c1Zpc2l0ZWQiLCJxdWV1ZSIsImdldEluc3RhbmNlU2FtcGxlIiwic2VlZExpbWl0IiwiY2x1c3RlckxpbWl0IiwiY2xhc3NDb3VudCIsIml0ZXJhdGlvblJlc2V0IiwiaW5zdGFuY2VzIiwidG90YWxDb3VudCIsImNsYXNzQ291bnRzIiwicG9wdWxhdGVDbGFzc0NvdW50cyIsImluc3RhbmNlIiwibmVpZ2hib3IiLCJyb3dDb3VudCIsInZhbGlkYXRlSW5zdGFuY2VTYW1wbGUiLCJ1cGRhdGVJbnN0YW5jZVNhbXBsZSIsIm5ld0luc3RhbmNlIiwicGFydGl0aW9uSW5zdGFuY2VTYW1wbGUiLCJnZW5lcmljcyIsImZpbGxJbnN0YW5jZVNhbXBsZSIsImV4dHJhTm9kZXMiLCJleHRyYUVkZ2VzIiwic2VlZFNpZGUiLCJpdGVyRnVuYyIsImFOb2RlIiwiaXNTZWVkZWQiLCJjb25uZWN0c1NvdXJjZSIsImNvbm5lY3RzVGFyZ2V0IiwiaW5zdGFuY2VTYW1wbGVUb0dyYXBoIiwiZ3JhcGgiLCJub2RlSW5zdGFuY2UiLCJkdW1teSIsImVkZ2VJbnN0YW5jZSIsInNvdXJjZU5vZGUiLCJ0YXJnZXROb2RlIiwiZ2V0TmV0d29ya01vZGVsR3JhcGgiLCJyYXciLCJpbmNsdWRlRHVtbWllcyIsImNsYXNzTG9va3VwIiwiY2xhc3NDb25uZWN0aW9ucyIsImNsYXNzU3BlYyIsImlkIiwibG9jYXRpb24iLCJnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCIsInRhYmxlTG9va3VwIiwidGFibGVMaW5rcyIsInRhYmxlTGlzdCIsInRhYmxlU3BlYyIsImdldE1vZGVsRHVtcCIsInJhd09iaiIsImFIYXNoIiwiYkhhc2giLCJjcmVhdGVTY2hlbWFNb2RlbCIsIm5ld01vZGVsIiwiY3JlYXRlTW9kZWwiLCJzb3VyY2VDbGFzc2VzIiwidGFyZ2V0Q2xhc3NlcyIsInRhYmxlRGVwZW5kZW5jaWVzIiwiY29yZVRhYmxlcyIsIk5FWFRfTU9ERUxfSUQiLCJPcmlncmFwaCIsImxvY2FsU3RvcmFnZSIsInBsdWdpbnMiLCJleGlzdGluZ01vZGVscyIsIl9jdXJyZW50TW9kZWxJZCIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luIiwiY2xvc2VDdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWwiLCJsb2FkTW9kZWwiLCJjdXJyZW50TW9kZWxJZCIsImRlbGV0ZUFsbE1vZGVscyIsIndpbmRvdyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FBSTtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsY0FBTCxHQUFzQixFQUF0QjtXQUNLQyxlQUFMLEdBQXVCLEVBQXZCOzs7SUFFRkMsRUFBRSxDQUFFQyxTQUFGLEVBQWFDLFFBQWIsRUFBdUI7VUFDbkIsQ0FBQ0MsS0FBRCxFQUFRQyxTQUFSLElBQXFCSCxTQUFTLENBQUNJLEtBQVYsQ0FBZ0IsR0FBaEIsQ0FBekI7V0FDS1AsY0FBTCxDQUFvQkssS0FBcEIsSUFBNkIsS0FBS0wsY0FBTCxDQUFvQkssS0FBcEIsS0FDM0I7WUFBTTtPQURSOztVQUVJLENBQUNDLFNBQUwsRUFBZ0I7YUFDVE4sY0FBTCxDQUFvQkssS0FBcEIsRUFBMkIsRUFBM0IsRUFBK0JHLElBQS9CLENBQW9DSixRQUFwQztPQURGLE1BRU87YUFDQUosY0FBTCxDQUFvQkssS0FBcEIsRUFBMkJDLFNBQTNCLElBQXdDRixRQUF4Qzs7OztJQUdKSyxHQUFHLENBQUVOLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNwQixDQUFDQyxLQUFELEVBQVFDLFNBQVIsSUFBcUJILFNBQVMsQ0FB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
