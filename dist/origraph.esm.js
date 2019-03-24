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
    const newNodeClass = this.model.createClass({
      tableId: this.table.promote(attribute).tableId,
      type: 'NodeClass'
    });
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
      const rowCount = await classObj.table.countRows(); // Get at least classCount instances from this class (as long as we
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0F0dHJUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9tb3RlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0R1cGxpY2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ2hpbGRUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9QYXJlbnRDaGlsZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9qZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0LmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL1BhcnNlRmFpbHVyZS5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9EM0pzb24uanMiLCIuLi9zcmMvRmlsZUZvcm1hdHMvQ3N2WmlwLmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL0dFWEYuanMiLCIuLi9zcmMvQ29tbW9uL05ldHdvcmtNb2RlbC5qcyIsIi4uL3NyYy9PcmlncmFwaC5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSB8fFxuICAgICAgICB7ICcnOiBbXSB9O1xuICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnB1c2goY2FsbGJhY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSA9IGNhbGxiYWNrO1xuICAgICAgfVxuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXSA9IFtdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnQsIC4uLmFyZ3MpIHtcbiAgICAgIGNvbnN0IGhhbmRsZUNhbGxiYWNrID0gY2FsbGJhY2sgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH07XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgZm9yIChjb25zdCBuYW1lc3BhY2Ugb2YgT2JqZWN0LmtleXModGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pKSB7XG4gICAgICAgICAgaWYgKG5hbWVzcGFjZSA9PT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5mb3JFYWNoKGhhbmRsZUNhbGxiYWNrKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGFuZGxlQ2FsbGJhY2sodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zID0gb3B0aW9ucy5kdXBsaWNhdGVJdGVtcyB8fCBbXTtcbiAgfVxuICByZWdpc3RlckR1cGxpY2F0ZSAoaXRlbSkge1xuICAgIHRoaXMuZHVwbGljYXRlSXRlbXMucHVzaChpdGVtKTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBkdXAgb2YgdGhpcy5kdXBsaWNhdGVJdGVtcykge1xuICAgICAgaXRlbS5jb25uZWN0SXRlbShkdXApO1xuICAgICAgZHVwLmNvbm5lY3RJdGVtKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBge1wiY2xhc3NJZFwiOlwiJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XCIsXCJpbmRleFwiOlwiJHt0aGlzLmluZGV4fVwifWA7XG4gIH1cbiAgZ2V0IGV4cG9ydElkICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jbGFzc09iai5jbGFzc0lkfV8ke3RoaXMuaW5kZXh9YDtcbiAgfVxuICBnZXQgbGFiZWwgKCkge1xuICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLmFubm90YXRpb25zLmxhYmVsQXR0ciA/IHRoaXMucm93W3RoaXMuY2xhc3NPYmouYW5ub3RhdGlvbnMubGFiZWxBdHRyXSA6IHRoaXMuaW5kZXg7XG4gIH1cbiAgZXF1YWxzIChpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zdGFuY2VJZCA9PT0gaXRlbS5pbnN0YW5jZUlkO1xuICB9XG4gIGFzeW5jICogaGFuZGxlTGltaXQgKG9wdGlvbnMsIGl0ZXJhdG9ycykge1xuICAgIGxldCBsaW1pdCA9IEluZmluaXR5O1xuICAgIGlmIChvcHRpb25zLmxpbWl0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxpbWl0ID0gb3B0aW9ucy5saW1pdDtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIH1cbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBpdGVyYXRvciBvZiBpdGVyYXRvcnMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBpdGVyYXRvcikge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICBpKys7XG4gICAgICAgIGlmIChpdGVtID09PSBudWxsIHx8IGkgPj0gbGltaXQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIHlpZWxkICogdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKTtcbiAgfVxuICAqIF9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgaWYgKHRoaXMucmVzZXQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbmV4dFRhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW25leHRUYWJsZUlkXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1tuZXh0VGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9saW1pdFByb21pc2VzID0ge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaGFzIGFscmVhZHkgYmVlbiBidWlsdDsganVzdCBncmFiIGRhdGEgZnJvbSBpdCBkaXJlY3RseVxuICAgICAgeWllbGQgKiB0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGUgJiYgdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkLCBidXQgaXQncyBhbHJlYWR5IGxvbmcgZW5vdWdoIHRvIHNhdGlzZnkgdGhpc1xuICAgICAgLy8gcmVxdWVzdFxuICAgICAgeWllbGQgKiB0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQgYnVpbGRpbmcgKGFuZCBtYXliZSBkaWRuJ3QgZXZlbiBzdGFydCB5ZXQpO1xuICAgICAgLy8ga2ljayBpdCBvZmYsIGFuZCB0aGVuIHdhaXQgZm9yIGVub3VnaCBpdGVtcyB0byBiZSBwcm9jZXNzZWQgdG8gc2F0aXNmeVxuICAgICAgLy8gdGhlIGxpbWl0XG4gICAgICB0aGlzLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIHlpZWxkICogYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSA9IHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdIHx8IFtdO1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgdGVtcCA9PT0gbnVsbCkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSkpIHtcbiAgICAgICAgICAvLyBPa2F5LCB0aGlzIGl0ZW0gcGFzc2VkIGFsbCBmaWx0ZXJzLCBhbmQgaXMgcmVhZHkgdG8gYmUgc2VudCBvdXRcbiAgICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt0ZW1wLnZhbHVlLmluZGV4XSA9IHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGg7XG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBkYXRhIG5vdyB0byBzYXRpc2Z5IGFueSB3YWl0aW5nIHJlcXVlc3RzXG4gICAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB0aGlzLl9jYWNoZUxvb2t1cCA9IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NhY2hlQnVpbHQnKTtcbiAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgfVxuICBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy8gVGhlIHNldFRpbWVvdXQgaGVyZSBpcyBhYnNvbHV0ZWx5IG5lY2Vzc2FyeSwgb3IgdGhpcy5fY2FjaGVQcm9taXNlXG4gICAgICAgIC8vIHdvbid0IGJlIHN0b3JlZCBpbiB0aW1lIGZvciB0aGUgbmV4dCBidWlsZENhY2hlKCkgY2FsbCB0aGF0IGNvbWVzXG4gICAgICAgIC8vIHRocm91Z2hcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5fYnVpbGRDYWNoZShyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBjb25zdCBpdGVtc1RvUmVzZXQgPSAodGhpcy5fY2FjaGUgfHwgW10pXG4gICAgICAuY29uY2F0KHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSk7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zVG9SZXNldCkge1xuICAgICAgaXRlbS5yZXNldCA9IHRydWU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGhhbmRsZVJlc2V0IChyZWplY3QpIHtcbiAgICBmb3IgKGNvbnN0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5yZWplY3QoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzO1xuICAgIH1cbiAgICByZWplY3QoKTtcbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5idWlsZENhY2hlKCkpLmxlbmd0aDtcbiAgfVxuICBhc3luYyBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgICBpZiAod3JhcHBlZEl0ZW0ucm93W2F0dHJdIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3cgPSB3cmFwcGVkSXRlbS5kZWxheWVkUm93IHx8IHt9O1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3dbYXR0cl0gPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZnVuYyBvZiBPYmplY3QudmFsdWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBhd2FpdCBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICAgIGlmICgha2VlcCkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoa2VlcCkge1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyYXBwZWRJdGVtLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbHRlcicpO1xuICAgIH1cbiAgICByZXR1cm4ga2VlcDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gICAgZm9yIChjb25zdCBvdGhlckl0ZW0gb2Ygb3B0aW9ucy5pdGVtc1RvQ29ubmVjdCB8fCBbXSkge1xuICAgICAgd3JhcHBlZEl0ZW0uY29ubmVjdEl0ZW0ob3RoZXJJdGVtKTtcbiAgICAgIG90aGVySXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICAvLyBBbGxvdyBwcm9iaW5nIHRvIHNlZSB3aGF0ZXZlciBkYXRhIGhhcHBlbnMgdG8gYmUgYXZhaWxhYmxlXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6IHRoaXMuX2NhY2hlIHx8IHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSxcbiAgICAgIGxvb2t1cDogdGhpcy5fY2FjaGVMb29rdXAgfHwgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGFzeW5jIF9nZXRJdGVtIChpbmRleCA9IG51bGwpIHtcbiAgICAvLyBTdHVwaWQgYXBwcm9hY2ggd2hlbiB0aGUgY2FjaGUgaXNuJ3QgYnVpbHQ6IGludGVyYXRlIHVudGlsIHdlIHNlZSB0aGVcbiAgICAvLyBpbmRleC4gU3ViY2xhc3NlcyBjb3VsZCBvdmVycmlkZSB0aGlzXG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZSgpKSB7XG4gICAgICBpZiAoaXRlbSA9PT0gbnVsbCB8fCBpdGVtLmluZGV4ID09PSBpbmRleCkge1xuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYXN5bmMgZ2V0SXRlbSAoaW5kZXggPSBudWxsKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlTG9va3VwKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9jYWNoZVswXSA6IHRoaXMuX2NhY2hlW3RoaXMuX2NhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgJiZcbiAgICAgICAgKChpbmRleCA9PT0gbnVsbCAmJiB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9wYXJ0aWFsQ2FjaGVbMF1cbiAgICAgICAgOiB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9nZXRJdGVtKGluZGV4KTtcbiAgfVxuICBhc3luYyBnZXRSYW5kb21JdGVtICgpIHtcbiAgICBjb25zdCByYW5kSW5kZXggPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhd2FpdCB0aGlzLmNvdW50Um93cygpKTtcbiAgICByZXR1cm4gdGhpcy5fY2FjaGVbcmFuZEluZGV4XTtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0IHN1cHByZXNzZWRBdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpO1xuICB9XG4gIGdldCB1blN1cHByZXNzZWRBdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gdGhpcy5hdHRyaWJ1dGVzLmZpbHRlcihhdHRyID0+ICF0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyXSk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgdW5TdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYWRkRmlsdGVyIChmdW5jLCBhdHRyaWJ1dGUgPSBudWxsKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdQcm9tb3RlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnVW5yb2xsZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGR1cGxpY2F0ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdEdXBsaWNhdGVkVGFibGUnXG4gICAgfSk7XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QsIHR5cGUgPSAnQ29ubmVjdGVkVGFibGUnKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHsgdHlwZSB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBwcm9qZWN0ICh0YWJsZUlkcykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnUHJvamVjdGVkVGFibGUnLFxuICAgICAgdGFibGVPcmRlcjogW3RoaXMudGFibGVJZF0uY29uY2F0KHRhYmxlSWRzKVxuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZUlkIG9mIHRhYmxlSWRzKSB7XG4gICAgICBjb25zdCBvdGhlclRhYmxlID0gdGhpcy5tb2RlbC50YWJsZXNbb3RoZXJUYWJsZUlkXTtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3Nlcykuc29tZShjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGVJZCA9PT0gdGhpcy50YWJsZUlkIHx8XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTEgfHxcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKGZvcmNlID0gZmFsc2UpIHtcbiAgICBpZiAoIWZvcmNlICYmIHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX25hbWU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY0RpY3RUYWJsZTtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWlyZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY29uc3QgQXR0clRhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihzdXBlcmNsYXNzKSB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkF0dHJUYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuICAgIGdldFNvcnRIYXNoICgpIHtcbiAgICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgICBnZXQgbmFtZSAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQXR0clRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBBdHRyVGFibGVNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBBdHRyVGFibGVNaXhpbiBmcm9tICcuL0F0dHJUYWJsZU1peGluLmpzJztcblxuY2xhc3MgUHJvbW90ZWRUYWJsZSBleHRlbmRzIEF0dHJUYWJsZU1peGluKFRhYmxlKSB7XG4gIGFzeW5jIF9idWlsZENhY2hlIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHdlIGRvbid0IGFjdHVhbGx5IHdhbnQgdG8gY2FsbCBfZmluaXNoSXRlbVxuICAgIC8vIHVudGlsIGFsbCB1bmlxdWUgdmFsdWVzIGhhdmUgYmVlbiBzZWVuXG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlID0gW107XG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwID0ge307XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IHRlbXAgPSB7IGRvbmU6IGZhbHNlIH07XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUpIHtcbiAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSB8fCB0ZW1wID09PSBudWxsKSB7XG4gICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAvLyB0aGF0IHdhcyB3YWl0aW5nIG9uIHVzIGtub3cgdGhhdCB3ZSBjYW4ndCBjb21wbHlcbiAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbdGVtcC52YWx1ZS5pbmRleF0gPSB0aGlzLl91bmZpbmlzaGVkQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gT2theSwgbm93IHdlJ3ZlIHNlZW4gZXZlcnl0aGluZzsgd2UgY2FuIGNhbGwgX2ZpbmlzaEl0ZW0gb24gZWFjaCBvZiB0aGVcbiAgICAvLyB1bmlxdWUgdmFsdWVzXG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdGhpcy5fdW5maW5pc2hlZENhY2hlKSB7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh2YWx1ZSkpIHtcbiAgICAgICAgLy8gT2theSwgdGhpcyBpdGVtIHBhc3NlZCBhbGwgZmlsdGVycywgYW5kIGlzIHJlYWR5IHRvIGJlIHNlbnQgb3V0XG4gICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt2YWx1ZS5pbmRleF0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUucHVzaCh2YWx1ZSk7XG4gICAgICAgIGkrKztcbiAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggZGF0YSBub3cgdG8gc2F0aXNmeSBhbnkgd2FpdGluZyByZXF1ZXN0c1xuICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUodGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwO1xuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgdGhpcy5fY2FjaGVMb29rdXAgPSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICB9XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgdGhpcy50cmlnZ2VyKCdjYWNoZUJ1aWx0Jyk7XG4gICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGxldCBpbmRleCA9IGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAodHlwZW9mIGluZGV4ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBEb24ndCBwcm9tb3RlIFtvYmplY3QgT2JqZWN0XSBhcyBhIHZhbHVlIChpZ25vcmUgdW5oYXNoYWJsZSB2YWx1ZXMpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaW5kZXggPSBTdHJpbmcoaW5kZXgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldCFcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fdW5maW5pc2hlZENhY2hlW3RoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgICAgICBleGlzdGluZ0l0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0oZXhpc3RpbmdJdGVtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBGYWNldGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSB8fCAhdGhpcy5fdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgYW5kIHZhbHVlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGUgKyB0aGlzLl92YWx1ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIFN0cmluZyh0aGlzLl92YWx1ZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgaWYgKGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgVHJhbnNwb3NlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuX2luZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouaW5kZXggPSB0aGlzLl9pbmRleDtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2luZGV4O1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5faW5kZXh9YDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgYXdhaXQgdGhpcy5wYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG5cbiAgICAvLyBJdGVyYXRlIHRoZSByb3cncyBhdHRyaWJ1dGVzIGFzIGluZGV4ZXNcbiAgICBjb25zdCB3cmFwcGVkUGFyZW50ID0gdGhpcy5wYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5wYXJlbnRUYWJsZS5fY2FjaGVMb29rdXBbdGhpcy5faW5kZXhdXSB8fCB7IHJvdzoge30gfTtcbiAgICBmb3IgKGxldCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgdmFsdWUgPSBhd2FpdCB2YWx1ZTtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJz0nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuZ2V0U29ydEhhc2goKSkuam9pbignPScpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIERvbid0IHRyeSB0byBjb25uZWN0IHZhbHVlcyB1bnRpbCBhbGwgb2YgdGhlIHBhcmVudCB0YWJsZXMnIGNhY2hlcyBhcmVcbiAgICAvLyBidWlsdDsgVE9ETzogbWlnaHQgYmUgYWJsZSB0byBkbyBzb21ldGhpbmcgbW9yZSByZXNwb25zaXZlIGhlcmU/XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwocGFyZW50VGFibGVzLm1hcChwVGFibGUgPT4gcFRhYmxlLmJ1aWxkQ2FjaGUoKSkpO1xuXG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGVMb29rdXApIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cCkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldFxuICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XSAhPT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAvLyBObyBtYXRjaCBpbiBvbmUgb2YgdGhlIG90aGVyIHRhYmxlczsgb21pdCB0aGlzIGl0ZW1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPOiBhZGQgZWFjaCBwYXJlbnQgdGFibGVzJyBrZXlzIGFzIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBwYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLl9jYWNoZVt0YWJsZS5fY2FjaGVMb29rdXBbaW5kZXhdXSlcbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBEdXBsaWNhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gWWllbGQgdGhlIHNhbWUgaXRlbXMgd2l0aCB0aGUgc2FtZSBjb25uZWN0aW9ucywgYnV0IHdyYXBwZWQgYW5kIGZpbmlzaGVkXG4gICAgLy8gYnkgdGhpcyB0YWJsZVxuICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLnBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleDogaXRlbS5pbmRleCxcbiAgICAgICAgcm93OiBpdGVtLnJvdyxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IE9iamVjdC52YWx1ZXMoaXRlbS5jb25uZWN0ZWRJdGVtcykucmVkdWNlKChhZ2csIGl0ZW1MaXN0KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoaXRlbUxpc3QpO1xuICAgICAgICB9LCBbXSlcbiAgICAgIH0pO1xuICAgICAgaXRlbS5yZWdpc3RlckR1cGxpY2F0ZShuZXdJdGVtKTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBEdXBsaWNhdGVkVGFibGU7XG4iLCJpbXBvcnQgQXR0clRhYmxlTWl4aW4gZnJvbSAnLi9BdHRyVGFibGVNaXhpbi5qcyc7XG5cbmNvbnN0IENoaWxkVGFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIEF0dHJUYWJsZU1peGluKHN1cGVyY2xhc3MpIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mQ2hpbGRUYWJsZU1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSBzdXBlci5fd3JhcChvcHRpb25zKTtcbiAgICAgIG5ld0l0ZW0ucGFyZW50SW5kZXggPSBvcHRpb25zLnBhcmVudEluZGV4O1xuICAgICAgcmV0dXJuIG5ld0l0ZW07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDaGlsZFRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZDaGlsZFRhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQ2hpbGRUYWJsZU1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IENoaWxkVGFibGVNaXhpbiBmcm9tICcuL0NoaWxkVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBDaGlsZFRhYmxlTWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93ICE9PSB1bmRlZmluZWQgJiYgcm93ICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHJvdykubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXSxcbiAgICAgICAgICBwYXJlbnRJbmRleDogd3JhcHBlZFBhcmVudC5pbmRleFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgQ2hpbGRUYWJsZU1peGluIGZyb20gJy4vQ2hpbGRUYWJsZU1peGluLmpzJztcblxuY2xhc3MgVW5yb2xsZWRUYWJsZSBleHRlbmRzIENoaWxkVGFibGVNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3Qgcm93cyA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93cyAhPT0gdW5kZWZpbmVkICYmIHJvd3MgIT09IG51bGwgJiZcbiAgICAgICAgICB0eXBlb2Ygcm93c1tTeW1ib2wuaXRlcmF0b3JdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgcm93IG9mIHJvd3MpIHtcbiAgICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIHJvdyxcbiAgICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXSxcbiAgICAgICAgICAgIHBhcmVudEluZGV4OiB3cmFwcGVkUGFyZW50LmluZGV4XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVW5yb2xsZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgUGFyZW50Q2hpbGRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbignLycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5nZXRTb3J0SGFzaCgpKS5qb2luKCcsJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgbGV0IHBhcmVudFRhYmxlLCBjaGlsZFRhYmxlO1xuICAgIGlmICh0aGlzLnBhcmVudFRhYmxlc1swXS5wYXJlbnRUYWJsZSA9PT0gdGhpcy5wYXJlbnRUYWJsZXNbMV0pIHtcbiAgICAgIHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMV07XG4gICAgICBjaGlsZFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMF07XG4gICAgfSBlbHNlIGlmICh0aGlzLnBhcmVudFRhYmxlc1sxXS5wYXJlbnRUYWJsZSA9PT0gdGhpcy5wYXJlbnRUYWJsZXNbMF0pIHtcbiAgICAgIHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMF07XG4gICAgICBjaGlsZFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50Q2hpbGRUYWJsZSBub3Qgc2V0IHVwIHByb3Blcmx5YCk7XG4gICAgfVxuXG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNoaWxkIG9mIGNoaWxkVGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBwYXJlbnQgPSBhd2FpdCBwYXJlbnRUYWJsZS5nZXRJdGVtKGNoaWxkLnBhcmVudEluZGV4KTtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbcGFyZW50LCBjaGlsZF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFBhcmVudENoaWxkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFByb2plY3RlZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMudGFibGVPcmRlciA9IG9wdGlvbnMudGFibGVPcmRlcjtcbiAgICBpZiAoIXRoaXMudGFibGVPcmRlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YWJsZU9yZGVyIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZU9yZGVyLm1hcCh0YWJsZUlkID0+IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMudGFibGVPcmRlclxuICAgICAgLm1hcCh0YWJsZUlkID0+IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLmdldFNvcnRIYXNoKCkpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgY29uc3QgZmlyc3RUYWJsZSA9IHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVPcmRlclswXV07XG4gICAgY29uc3QgcmVtYWluaW5nSWRzID0gdGhpcy50YWJsZU9yZGVyLnNsaWNlKDEpO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlSXRlbSBvZiBmaXJzdFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBsYXN0SXRlbSBvZiBzb3VyY2VJdGVtLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhyZW1haW5pbmdJZHMpKSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleDogc291cmNlSXRlbS5pbmRleCArICfiqK8nICsgbGFzdEl0ZW0uaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFtzb3VyY2VJdGVtLCBsYXN0SXRlbV1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCBzZWxmLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUHJvamVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb25zID0gb3B0aW9ucy5hbm5vdGF0aW9ucyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zXG4gICAgfTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSArIHRoaXMuY2xhc3NOYW1lO1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHNldEFubm90YXRpb24gKGtleSwgdmFsdWUpIHtcbiAgICB0aGlzLmFubm90YXRpb25zW2tleV0gPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZUFubm90YXRpb24gKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLmFubm90YXRpb25zW2tleV07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgIH0pO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZS51bnJvbGwoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgfSk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUsIG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHRoaXMuX3RvUmF3T2JqZWN0KCksIG9wdGlvbnMsIHtcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIG92ZXJ3cml0ZTogdHJ1ZSxcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpLnRhYmxlSWQsXG4gICAgICB0eXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWVcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBkaXNzb2x2ZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKCF0aGlzLmNhbkRpc3NvbHZlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRpc3NvbHZlIGNsYXNzIHRoYXQgaGFzIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnRhYmxlLnR5cGV9YCk7XG4gICAgfVxuICAgIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHRoaXMuX3RvUmF3T2JqZWN0KCksIG9wdGlvbnMsIHtcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIG92ZXJ3cml0ZTogdHJ1ZSxcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGUucGFyZW50VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGdldCBjYW5EaXNzb2x2ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUudHlwZSA9PT0gJ1Byb21vdGVkJztcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkVHJhbnNwb3NlKGluZGV4ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlICgpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlblRyYW5zcG9zZSgpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tb2RlbC5vcHRpbWl6ZVRhYmxlcygpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgY291bnRBbGxVbmlxdWVWYWx1ZXMgKCkge1xuICAgIC8vIFRPRE86IHRoaXMgaXMgd2lsZGx5IGluZWZmaWNpZW50LCBlc3BlY2lhbGx5IGZvciBxdWFudGl0YXRpdmVcbiAgICAvLyBhdHRyaWJ1dGVzLi4uIGN1cnJlbnRseSBkb2luZyB0aGlzICh1bmRlciBwcm90ZXN0KSBmb3Igc3RhdHMgaW4gdGhlXG4gICAgLy8gY29ubmVjdCBpbnRlcmZhY2UuIE1heWJlIHVzZWZ1bCBmb3Igd3JpdGluZyBoaXN0b2dyYW0gZnVuY3Rpb25zIGluXG4gICAgLy8gdGhlIGZ1dHVyZT9cbiAgICBjb25zdCBoYXNoYWJsZUJpbnMgPSB7fTtcbiAgICBjb25zdCB1bkhhc2hhYmxlQ291bnRzID0ge307XG4gICAgY29uc3QgaW5kZXhCaW4gPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGluZGV4QmluW2l0ZW0uaW5kZXhdID0gMTsgLy8gYWx3YXlzIDFcbiAgICAgIGZvciAoY29uc3QgW2F0dHIsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhpdGVtLnJvdykpIHtcbiAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHVuSGFzaGFibGVDb3VudHNbYXR0cl0gPSB1bkhhc2hhYmxlQ291bnRzW2F0dHJdIHx8IDA7XG4gICAgICAgICAgdW5IYXNoYWJsZUNvdW50c1thdHRyXSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhhc2hhYmxlQmluc1thdHRyXSA9IGhhc2hhYmxlQmluc1thdHRyXSB8fCB7fTtcbiAgICAgICAgICBoYXNoYWJsZUJpbnNbYXR0cl1bdmFsdWVdID0gaGFzaGFibGVCaW5zW2F0dHJdW3ZhbHVlXSB8fCAwO1xuICAgICAgICAgIGhhc2hhYmxlQmluc1thdHRyXVt2YWx1ZV0rKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyBoYXNoYWJsZUJpbnMsIHVuSGFzaGFibGVDb3VudHMsIGluZGV4QmluIH07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBlZGdlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IGVkZ2VJZHMgPSBvcHRpb25zLmNsYXNzZXNcbiAgICAgID8gb3B0aW9ucy5jbGFzc2VzLm1hcChjbGFzc09iaiA9PiBjbGFzc09iai5jbGFzc0lkKVxuICAgICAgOiBvcHRpb25zLmNsYXNzSWRzIHx8IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBpdGVyYXRvcnMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VJZCBvZiBlZGdlSWRzKSB7XG4gICAgICBpZiAoIXRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzW2VkZ2VJZF0pIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLm1vZGVsLmNsYXNzZXNbZWRnZUlkXTtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmNsYXNzT2JqLmdldEVkZ2VSb2xlKGVkZ2VDbGFzcyk7XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnIHx8IHJvbGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICAgIGNvbnN0IHRhYmxlSWRzID0gZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgICAgaXRlcmF0b3JzLnB1c2godGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpKTtcbiAgICAgIH1cbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgaXRlcmF0b3JzKTtcbiAgfVxuICBhc3luYyAqIG5laWdoYm9yTm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiB0aGlzLmVkZ2VzKCkpIHtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmNsYXNzT2JqLmdldEVkZ2VSb2xlKGVkZ2UuY2xhc3NPYmopO1xuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAnc291cmNlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlLnRhcmdldE5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICAgICAgaWYgKHRoaXMgIT09IHRhcmdldCkge1xuICAgICAgICAgICAgeWllbGQgdGFyZ2V0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAndGFyZ2V0Jykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiBlZGdlLnNvdXJjZU5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICAgICAgaWYgKHRoaXMgIT09IHNvdXJjZSkge1xuICAgICAgICAgICAgeWllbGQgc291cmNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqIG5laWdoYm9ycyAob3B0aW9ucyA9IHt9KSB7XG4gICAgeWllbGQgKiB0aGlzLmVkZ2VzKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogcGFpcndpc2VOZWlnaGJvcmhvb2QgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgdGhpcy5lZGdlcygpKSB7XG4gICAgICB5aWVsZCAqIGVkZ2UucGFpcndpc2VOZWlnaGJvcmhvb2Qob3B0aW9ucyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gIH1cbiAgKiBlZGdlQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGdldEVkZ2VSb2xlIChlZGdlQ2xhc3MpIHtcbiAgICBpZiAoIXRoaXMuZWRnZUNsYXNzSWRzW2VkZ2VDbGFzcy5jbGFzc0lkXSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICByZXR1cm4gJ2JvdGgnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICdzb3VyY2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgcmV0dXJuICd0YXJnZXQnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIG1pc21hdGNoIGJldHdlZW4gbm9kZSBhbmQgZWRnZSBjbGFzc0lkc2ApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBOb2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICh7IGF1dG9jb25uZWN0ID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmICghYXV0b2Nvbm5lY3QgfHwgZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgLy8gQXJlIHdlIHRoZSBzb3VyY2Ugb3IgdGFyZ2V0IG9mIHRoZSBleGlzdGluZyBlZGdlIChpbnRlcm5hbGx5LCBpbiB0ZXJtc1xuICAgICAgLy8gb2Ygc291cmNlSWQgLyB0YXJnZXRJZCwgbm90IGVkZ2VDbGFzcy5kaXJlY3Rpb24pP1xuICAgICAgY29uc3QgaXNTb3VyY2UgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkO1xuXG4gICAgICAvLyBBcyB3ZSdyZSBjb252ZXJ0ZWQgdG8gYW4gZWRnZSwgb3VyIG5ldyByZXN1bHRpbmcgc291cmNlIEFORCB0YXJnZXRcbiAgICAgIC8vIHNob3VsZCBiZSB3aGF0ZXZlciBpcyBhdCB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcyAoaWYgYW55dGhpbmcpXG4gICAgICBpZiAoaXNTb3VyY2UpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgbm9kZSBjbGFzcyBvbiB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcywgYWRkIG91clxuICAgICAgLy8gaWQgdG8gaXRzIGxpc3Qgb2YgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG5vZGVDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgaWYgKG5vZGVDbGFzcykge1xuICAgICAgICBub2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoIWlzU291cmNlKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAvLyBPa2F5LCB3ZSd2ZSBnb3QgdHdvIGVkZ2VzLCBzbyB0aGlzIGlzIGEgbGl0dGxlIG1vcmUgc3RyYWlnaHRmb3J3YXJkXG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgICBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgLy8gQWRkIHRoaXMgY2xhc3MgdG8gdGhlIHNvdXJjZSdzIC8gdGFyZ2V0J3MgZWRnZUNsYXNzSWRzXG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEaXNjb25uZWN0IHRoZSBleGlzdGluZyBlZGdlIGNsYXNzZXMgZnJvbSB0aGUgbmV3IChub3cgZWRnZSkgY2xhc3NcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfVxuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgbGV0IHRoaXNIYXNoLCBvdGhlckhhc2gsIHNvdXJjZVRhYmxlSWRzLCB0YXJnZXRUYWJsZUlkcztcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGU7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbIHRoaXNIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgaWYgKG90aGVyQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlLnByb21vdGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbIG90aGVySGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkcyxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgdHlwZTogJ05vZGVDbGFzcydcbiAgICB9KTtcbiAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBuZXdDbGFzcyA9IHN1cGVyLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUsIG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIG5ld0NsYXNzLmVkZ2VDbGFzc2VzKCkpIHtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmdldEVkZ2VSb2xlKGVkZ2VDbGFzcyk7XG4gICAgICBpZiAocm9sZSA9PT0gJ3NvdXJjZScgfHwgcm9sZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5wdXNoKHRoaXMudGFibGVJZCk7XG4gICAgICB9XG4gICAgICBpZiAocm9sZSA9PT0gJ3RhcmdldCcgfHwgcm9sZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5wdXNoKHRoaXMudGFibGVJZCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXdDbGFzcztcbiAgfVxuICBkaXNzb2x2ZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgbmV3Q2xhc3MgPSBzdXBlci5kaXNzb2x2ZShvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBuZXdDbGFzcy5lZGdlQ2xhc3NlcygpKSB7XG4gICAgICBjb25zdCByb2xlID0gdGhpcy5nZXRFZGdlUm9sZShlZGdlQ2xhc3MpO1xuICAgICAgaWYgKHJvbGUgPT09ICdzb3VyY2UnIHx8IHJvbGUgPT09ICdib3RoJykge1xuICAgICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnBvcCgpICE9PSBuZXdDbGFzcy50YWJsZUlkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbmNvbnNpc3RlbnQgdGFibGVJZHMgd2hlbiBkaXNzb2x2aW5nIGEgbm9kZSBjbGFzc2ApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocm9sZSA9PT0gJ3RhcmdldCcgfHwgcm9sZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMucG9wKCkgIT09IG5ld0NsYXNzLnRhYmxlSWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEluY29uc2lzdGVudCB0YWJsZUlkcyB3aGVuIGRpc3NvbHZpbmcgYSBub2RlIGNsYXNzYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ld0NsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIChjaGlsZENsYXNzKSB7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzLnRhYmxlLmNvbm5lY3QoW2NoaWxkQ2xhc3MudGFibGVdLCAnUGFyZW50Q2hpbGRUYWJsZScpO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFtdLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogY2hpbGRDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHM6IFtdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBjaGlsZENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSBzdXBlci5leHBhbmQoYXR0cmlidXRlKTtcbiAgICB0aGlzLmNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzKG5ld05vZGVDbGFzcyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHN1cGVyLnVucm9sbChhdHRyaWJ1dGUpO1xuICAgIHRoaXMuY29ubmVjdFRvQ2hpbGROb2RlQ2xhc3MobmV3Tm9kZUNsYXNzKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIHByb2plY3ROZXdFZGdlIChjbGFzc0lkTGlzdCkge1xuICAgIGNvbnN0IGNsYXNzTGlzdCA9IFt0aGlzXS5jb25jYXQoY2xhc3NJZExpc3QubWFwKGNsYXNzSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY2xhc3Nlc1tjbGFzc0lkXTtcbiAgICB9KSk7XG4gICAgaWYgKGNsYXNzTGlzdC5sZW5ndGggPCAzIHx8IGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0udHlwZSAhPT0gJ05vZGUnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY2xhc3NJZExpc3RgKTtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlQ2xhc3NJZCA9IHRoaXMuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzc0lkID0gY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS5jbGFzc0lkO1xuICAgIGxldCB0YWJsZU9yZGVyID0gW107XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBjbGFzc0xpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGNsYXNzT2JqID0gY2xhc3NMaXN0W2ldO1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICB0YWJsZU9yZGVyLnB1c2goY2xhc3NPYmoudGFibGVJZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlZGdlUm9sZSA9IGNsYXNzTGlzdFtpIC0gMV0uZ2V0RWRnZVJvbGUoY2xhc3NPYmopO1xuICAgICAgICBpZiAoZWRnZVJvbGUgPT09ICdzb3VyY2UnIHx8IGVkZ2VSb2xlID09PSAnYm90aCcpIHtcbiAgICAgICAgICB0YWJsZU9yZGVyID0gdGFibGVPcmRlci5jb25jYXQoXG4gICAgICAgICAgICBBcnJheS5mcm9tKGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKS5yZXZlcnNlKCkpO1xuICAgICAgICAgIHRhYmxlT3JkZXIucHVzaChjbGFzc09iai50YWJsZUlkKTtcbiAgICAgICAgICB0YWJsZU9yZGVyID0gdGFibGVPcmRlci5jb25jYXQoY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChcbiAgICAgICAgICAgIEFycmF5LmZyb20oY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpLnJldmVyc2UoKSk7XG4gICAgICAgICAgdGFibGVPcmRlci5wdXNoKGNsYXNzT2JqLnRhYmxlSWQpO1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChjbGFzc09iai5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLnRhYmxlLnByb2plY3QodGFibGVPcmRlcik7XG4gICAgY29uc3QgbmV3Q2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFtdLFxuICAgICAgdGFyZ2V0VGFibGVJZHM6IFtdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3Q2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0uZWRnZUNsYXNzSWRzW25ld0NsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICByZXR1cm4gbmV3Q2xhc3M7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgdGhpcy5jb25uZWN0ZWRDbGFzc2VzKCkpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBudWxsIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzZXMgJiYgIW9wdGlvbnMuY2xhc3Nlcy5maW5kKGQgPT4gdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBkLmNsYXNzSWQpKSB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc0lkcyAmJiBvcHRpb25zLmNsYXNzSWRzLmluZGV4T2YodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSA9PT0gLTEpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgY29uc3QgdGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmNvbmNhdChbIHNvdXJjZVRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogdGFyZ2V0Tm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdGFyZ2V0VGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF0udGFibGVJZDtcbiAgICBjb25zdCB0YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuY29uY2F0KFsgdGFyZ2V0VGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiBub2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucyksXG4gICAgICB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiBuZWlnaGJvcnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIHlpZWxkICogdGhpcy5ub2RlcyhvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlTmVpZ2hib3Job29kIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgc291cmNlLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICBlZGdlOiB0aGlzXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gc291cmNlVGFibGVJZHMgYW5kIHRhcmdldFRhYmxlSWRzIGFyZSBsaXN0cyBvZiBhbnkgaW50ZXJtZWRpYXRlIHRhYmxlcyxcbiAgICAvLyBiZWdpbm5pbmcgd2l0aCB0aGUgZWRnZSB0YWJsZSAoYnV0IG5vdCBpbmNsdWRpbmcgaXQpLCB0aGF0IGxlYWQgdG8gdGhlXG4gICAgLy8gc291cmNlIC8gdGFyZ2V0IG5vZGUgdGFibGVzIChidXQgbm90IGluY2x1ZGluZykgdGhvc2VcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnNvdXJjZVRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBzb3VyY2VDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgZ2V0IHRhcmdldENsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMudGFyZ2V0Q2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5wcm9tb3RlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MudGFibGUucHJvbW90ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUucHJvbW90ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLnByb21vdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0U291cmNlICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHJldHVybiBzdXBlci5wcm9tb3RlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgICB0eXBlOiAnTm9kZUNsYXNzJ1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgIG5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgICBzaWRlOiAhdGhpcy5zb3VyY2VDbGFzc0lkID8gJ3NvdXJjZScgOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogYXR0cmlidXRlXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gICAgfVxuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBuZXdDbGFzcyA9IHN1cGVyLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUsIG9wdGlvbnMpO1xuICAgIG5ld0NsYXNzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGhpcy50YWJsZUlkKTtcbiAgICBuZXdDbGFzcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgcmV0dXJuIG5ld0NsYXNzO1xuICB9XG4gIGRpc3NvbHZlIChvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBuZXdDbGFzcyA9IHN1cGVyLmRpc3NvbHZlKG9wdGlvbnMpO1xuICAgIGlmIChuZXdDbGFzcy5zb3VyY2VUYWJsZUlkcy5zaGlmdCgpICE9PSBuZXdDbGFzcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEluY29uc2lzdGVudCB0YWJsZUlkcyB3aGVuIGRpc3NvbHZpbmcgYW4gZWRnZSBjbGFzc2ApO1xuICAgIH1cbiAgICBpZiAobmV3Q2xhc3MudGFyZ2V0VGFibGVJZHMuc2hpZnQoKSAhPT0gbmV3Q2xhc3MudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbmNvbnNpc3RlbnQgdGFibGVJZHMgd2hlbiBkaXNzb2x2aW5nIGFuIGVkZ2UgY2xhc3NgKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld0NsYXNzO1xuICB9XG4gIGNvbm5lY3RGYWNldGVkQ2xhc3MgKG5ld0VkZ2VDbGFzcykge1xuICAgIC8vIFdoZW4gYW4gZWRnZSBjbGFzcyBpcyBmYWNldGVkLCB3ZSB3YW50IHRvIGtlZXAgdGhlIHNhbWUgY29ubmVjdGlvbnMuIFRoaXNcbiAgICAvLyBtZWFucyB3ZSBuZWVkIHRvIGNsb25lIGVhY2ggdGFibGUgY2hhaW4sIGFuZCBhZGQgb3VyIG93biB0YWJsZSB0byBpdFxuICAgIC8vIChiZWNhdXNlIG91ciB0YWJsZSBpcyB0aGUgcGFyZW50VGFibGUgb2YgdGhlIG5ldyBvbmUpXG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBuZXdFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMgPSBBcnJheS5mcm9tKHRoaXMuc291cmNlVGFibGVJZHMpO1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGhpcy50YWJsZUlkKTtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgbmV3RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzID0gQXJyYXkuZnJvbSh0aGlzLnRhcmdldFRhYmxlSWRzKTtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgICB0aGlzLnRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIGNvbnN0IG5ld0NsYXNzZXMgPSBzdXBlci5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcyk7XG4gICAgZm9yIChjb25zdCBuZXdDbGFzcyBvZiBuZXdDbGFzc2VzKSB7XG4gICAgICB0aGlzLmNvbm5lY3RGYWNldGVkQ2xhc3MobmV3Q2xhc3MpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3Q2xhc3NlcztcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdDbGFzcyBvZiBzdXBlci5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgdGhpcy5jb25uZWN0RmFjZXRlZENsYXNzKG5ld0NsYXNzKTtcbiAgICAgIHlpZWxkIG5ld0NsYXNzO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImNsYXNzIEZpbGVGb3JtYXQge1xuICBhc3luYyBidWlsZFJvdyAoaXRlbSkge1xuICAgIGNvbnN0IHJvdyA9IHt9O1xuICAgIGZvciAobGV0IGF0dHIgaW4gaXRlbS5yb3cpIHtcbiAgICAgIHJvd1thdHRyXSA9IGF3YWl0IGl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICByZXR1cm4gcm93O1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGaWxlRm9ybWF0O1xuIiwiY2xhc3MgUGFyc2VGYWlsdXJlIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvciAoZmlsZUZvcm1hdCkge1xuICAgIHN1cGVyKGBGYWlsZWQgdG8gcGFyc2UgZm9ybWF0OiAke2ZpbGVGb3JtYXQuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUGFyc2VGYWlsdXJlO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcbmltcG9ydCBQYXJzZUZhaWx1cmUgZnJvbSAnLi9QYXJzZUZhaWx1cmUuanMnO1xuXG5jb25zdCBOT0RFX05BTUVTID0gWydub2RlcycsICdOb2RlcyddO1xuY29uc3QgRURHRV9OQU1FUyA9IFsnZWRnZXMnLCAnbGlua3MnLCAnRWRnZXMnLCAnTGlua3MnXTtcblxuY2xhc3MgRDNKc29uIGV4dGVuZHMgRmlsZUZvcm1hdCB7XG4gIGFzeW5jIGltcG9ydERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICB0ZXh0LFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNvdXJjZUF0dHJpYnV0ZSA9ICdzb3VyY2UnLFxuICAgIHRhcmdldEF0dHJpYnV0ZSA9ICd0YXJnZXQnLFxuICAgIGNsYXNzQXR0cmlidXRlID0gbnVsbFxuICB9KSB7XG4gICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgY29uc3Qgbm9kZU5hbWUgPSBOT0RFX05BTUVTLmZpbmQobmFtZSA9PiBkYXRhW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpO1xuICAgIGNvbnN0IGVkZ2VOYW1lID0gRURHRV9OQU1FUy5maW5kKG5hbWUgPT4gZGF0YVtuYW1lXSBpbnN0YW5jZW9mIEFycmF5KTtcbiAgICBpZiAoIW5vZGVOYW1lIHx8ICFlZGdlTmFtZSkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlRmFpbHVyZSh0aGlzKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb3JlVGFibGUgPSBtb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnU3RhdGljRGljdFRhYmxlJyxcbiAgICAgIG5hbWU6ICdjb3JlVGFibGUnLFxuICAgICAgZGF0YTogZGF0YVxuICAgIH0pO1xuICAgIGNvbnN0IGNvcmVDbGFzcyA9IG1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29yZVRhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgICBsZXQgW25vZGVzLCBlZGdlc10gPSBjb3JlQ2xhc3MuY2xvc2VkVHJhbnNwb3NlKFtub2RlTmFtZSwgZWRnZU5hbWVdKTtcblxuICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgaWYgKG5vZGVBdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBpbXBvcnQgY2xhc3NlcyBmcm9tIEQzLXN0eWxlIEpTT04gd2l0aG91dCBub2RlQXR0cmlidXRlYCk7XG4gICAgICB9XG4gICAgICBjb25zdCBub2RlQ2xhc3NlcyA9IFtdO1xuICAgICAgY29uc3Qgbm9kZUNsYXNzTG9va3VwID0ge307XG4gICAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlQ2xhc3Mgb2Ygbm9kZXMub3BlbkZhY2V0KGNsYXNzQXR0cmlidXRlKSkge1xuICAgICAgICBub2RlQ2xhc3NMb29rdXBbbm9kZUNsYXNzLmNsYXNzTmFtZV0gPSBub2RlQ2xhc3Nlcy5sZW5ndGg7XG4gICAgICAgIG5vZGVDbGFzc2VzLnB1c2gobm9kZUNsYXNzLmludGVycHJldEFzTm9kZXMoKSk7XG4gICAgICB9XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlcy5vcGVuRmFjZXQoY2xhc3NBdHRyaWJ1dGUpKSB7XG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goZWRnZUNsYXNzLmludGVycHJldEFzRWRnZXMoKSk7XG4gICAgICAgIGNvbnN0IHNhbXBsZSA9IGF3YWl0IGVkZ2VDbGFzcy50YWJsZS5nZXRJdGVtKCk7XG4gICAgICAgIGNvbnN0IHNvdXJjZUNsYXNzTmFtZSA9IGF3YWl0IHNhbXBsZS5yb3dbc291cmNlQXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdO1xuICAgICAgICBpZiAobm9kZUNsYXNzTG9va3VwW3NvdXJjZUNsYXNzTmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgICAgICAgbm9kZUNsYXNzOiBub2RlQ2xhc3Nlc1tub2RlQ2xhc3NMb29rdXBbc291cmNlQ2xhc3NOYW1lXV0sXG4gICAgICAgICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgICAgICBlZGdlQXR0cmlidXRlOiBzb3VyY2VBdHRyaWJ1dGVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0YXJnZXRDbGFzc05hbWUgPSBhd2FpdCBzYW1wbGUucm93W3RhcmdldEF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXTtcbiAgICAgICAgaWYgKG5vZGVDbGFzc0xvb2t1cFt0YXJnZXRDbGFzc05hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgICAgICAgIG5vZGVDbGFzczogbm9kZUNsYXNzZXNbbm9kZUNsYXNzTG9va3VwW3RhcmdldENsYXNzTmFtZV1dLFxuICAgICAgICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICAgICAgZWRnZUF0dHJpYnV0ZTogdGFyZ2V0QXR0cmlidXRlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbm9kZXMgPSBub2Rlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgICBub2Rlcy5zZXRDbGFzc05hbWUobm9kZU5hbWUpO1xuICAgICAgZWRnZXMgPSBlZGdlcy5pbnRlcnByZXRBc0VkZ2VzKCk7XG4gICAgICBlZGdlcy5zZXRDbGFzc05hbWUoZWRnZU5hbWUpO1xuICAgICAgbm9kZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgICAgZWRnZUNsYXNzOiBlZGdlcyxcbiAgICAgICAgc2lkZTogJ3NvdXJjZScsXG4gICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHNvdXJjZUF0dHJpYnV0ZVxuICAgICAgfSk7XG4gICAgICBub2Rlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgICBlZGdlQ2xhc3M6IGVkZ2VzLFxuICAgICAgICBzaWRlOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZSxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogdGFyZ2V0QXR0cmlidXRlXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBwcmV0dHkgPSB0cnVlLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNvdXJjZUF0dHJpYnV0ZSA9ICdzb3VyY2UnLFxuICAgIHRhcmdldEF0dHJpYnV0ZSA9ICd0YXJnZXQnLFxuICAgIGNsYXNzQXR0cmlidXRlID0gbnVsbFxuICB9KSB7XG4gICAgaWYgKGNsYXNzQXR0cmlidXRlICYmICFub2RlQXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGV4cG9ydCBEMy1zdHlsZSBKU09OIHdpdGggY2xhc3Nlcywgd2l0aG91dCBhIG5vZGVBdHRyaWJ1dGVgKTtcbiAgICB9XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIGxpbmtzOiBbXVxuICAgIH07XG4gICAgY29uc3Qgbm9kZUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IG5vZGVDbGFzc2VzID0gW107XG4gICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGluY2x1ZGVDbGFzc2VzKSB7XG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIG5vZGVDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZWRnZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQub3RoZXIgPSByZXN1bHQub3RoZXIgfHwgW107XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICByZXN1bHQub3RoZXIucHVzaChhd2FpdCB0aGlzLmJ1aWxkUm93KGl0ZW0pKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IG5vZGVDbGFzcyBvZiBub2RlQ2xhc3Nlcykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIG5vZGVDbGFzcy50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgbm9kZUxvb2t1cFtub2RlLmV4cG9ydElkXSA9IHJlc3VsdC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHRoaXMuYnVpbGRSb3cobm9kZSk7XG4gICAgICAgIGlmIChub2RlQXR0cmlidXRlKSB7XG4gICAgICAgICAgcm93W25vZGVBdHRyaWJ1dGVdID0gbm9kZS5leHBvcnRJZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgICAgICByb3dbY2xhc3NBdHRyaWJ1dGVdID0gbm9kZS5jbGFzc09iai5jbGFzc05hbWU7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0Lm5vZGVzLnB1c2gocm93KTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZUNsYXNzZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiBlZGdlQ2xhc3MudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHRoaXMuYnVpbGRSb3coZWRnZSk7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIGVkZ2Uuc291cmNlTm9kZXMoeyBjbGFzc2VzOiBub2RlQ2xhc3NlcyB9KSkge1xuICAgICAgICAgIHJvd1tzb3VyY2VBdHRyaWJ1dGVdID0gbm9kZUF0dHJpYnV0ZSA/IHNvdXJjZS5leHBvcnRJZCA6IG5vZGVMb29rdXBbc291cmNlLmV4cG9ydElkXTtcbiAgICAgICAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIHJvd1tzb3VyY2VBdHRyaWJ1dGUgKyAnXycgKyBjbGFzc0F0dHJpYnV0ZV0gPSBzb3VyY2UuY2xhc3NPYmouY2xhc3NOYW1lO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlLnRhcmdldE5vZGVzKHsgY2xhc3Nlczogbm9kZUNsYXNzZXMgfSkpIHtcbiAgICAgICAgICAgIHJvd1t0YXJnZXRBdHRyaWJ1dGVdID0gbm9kZUF0dHJpYnV0ZSA/IHRhcmdldC5leHBvcnRJZCA6IG5vZGVMb29rdXBbdGFyZ2V0LmV4cG9ydElkXTtcbiAgICAgICAgICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICByb3dbdGFyZ2V0QXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdID0gdGFyZ2V0LmNsYXNzT2JqLmNsYXNzTmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5saW5rcy5wdXNoKE9iamVjdC5hc3NpZ24oe30sIHJvdykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAocHJldHR5KSB7XG4gICAgICByZXN1bHQubm9kZXMgPSAnICBcIm5vZGVzXCI6IFtcXG4gICAgJyArIHJlc3VsdC5ub2Rlcy5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgIC5qb2luKCcsXFxuICAgICcpICsgJ1xcbiAgXSc7XG4gICAgICByZXN1bHQubGlua3MgPSAnICBcImxpbmtzXCI6IFtcXG4gICAgJyArIHJlc3VsdC5saW5rcy5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgIC5qb2luKCcsXFxuICAgICcpICsgJ1xcbiAgXSc7XG4gICAgICBpZiAocmVzdWx0Lm90aGVyKSB7XG4gICAgICAgIHJlc3VsdC5vdGhlciA9ICcsXFxuICBcIm90aGVyXCI6IFtcXG4gICAgJyArIHJlc3VsdC5vdGhlci5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgICAgLmpvaW4oJyxcXG4gICAgJykgKyAnXFxuICBdJztcbiAgICAgIH1cbiAgICAgIHJlc3VsdCA9IGB7XFxuJHtyZXN1bHQubm9kZXN9LFxcbiR7cmVzdWx0LmxpbmtzfSR7cmVzdWx0Lm90aGVyIHx8ICcnfVxcbn1cXG5gO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBKU09OLnN0cmluZ2lmeShyZXN1bHQpO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogJ2RhdGE6dGV4dC9qc29uO2Jhc2U2NCwnICsgQnVmZmVyLmZyb20ocmVzdWx0KS50b1N0cmluZygnYmFzZTY0JyksXG4gICAgICB0eXBlOiAndGV4dC9qc29uJyxcbiAgICAgIGV4dGVuc2lvbjogJ2pzb24nXG4gICAgfTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgbmV3IEQzSnNvbigpO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcbmltcG9ydCBKU1ppcCBmcm9tICdqc3ppcCc7XG5cbmNsYXNzIENzdlppcCBleHRlbmRzIEZpbGVGb3JtYXQge1xuICBhc3luYyBpbXBvcnREYXRhICh7XG4gICAgbW9kZWwsXG4gICAgdGV4dFxuICB9KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBpbmRleE5hbWUgPSAnaW5kZXgnXG4gIH0pIHtcbiAgICBjb25zdCB6aXAgPSBuZXcgSlNaaXAoKTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgaW5jbHVkZUNsYXNzZXMpIHtcbiAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBjbGFzc09iai50YWJsZS51blN1cHByZXNzZWRBdHRyaWJ1dGVzO1xuICAgICAgbGV0IGNvbnRlbnRzID0gYCR7aW5kZXhOYW1lfSwke2F0dHJpYnV0ZXMuam9pbignLCcpfVxcbmA7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgIGNvbnRlbnRzICs9IGAke2l0ZW0uaW5kZXh9YDtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICBjb250ZW50cyArPSBgLCR7YXdhaXQgaXRlbS5yb3dbYXR0cl19YDtcbiAgICAgICAgfVxuICAgICAgICBjb250ZW50cyArPSBgXFxuYDtcbiAgICAgIH1cbiAgICAgIHppcC5maWxlKGNsYXNzT2JqLmNsYXNzTmFtZSArICcuY3N2JywgY29udGVudHMpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiAnZGF0YTphcHBsaWNhdGlvbi96aXA7YmFzZTY0LCcgKyBhd2FpdCB6aXAuZ2VuZXJhdGVBc3luYyh7IHR5cGU6ICdiYXNlNjQnIH0pLFxuICAgICAgdHlwZTogJ2FwcGxpY2F0aW9uL3ppcCcsXG4gICAgICBleHRlbnNpb246ICd6aXAnXG4gICAgfTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgbmV3IENzdlppcCgpO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcblxuY29uc3QgZXNjYXBlQ2hhcnMgPSB7XG4gICcmcXVvdDsnOiAvXCIvZyxcbiAgJyZhcG9zOyc6IC8nL2csXG4gICcmbHQ7JzogLzwvZyxcbiAgJyZndDsnOiAvPi9nXG59O1xuXG5jbGFzcyBHRVhGIGV4dGVuZHMgRmlsZUZvcm1hdCB7XG4gIGFzeW5jIGltcG9ydERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBlc2NhcGUgKHN0cikge1xuICAgIHN0ciA9IHN0ci5yZXBsYWNlKC8mL2csICcmYW1wOycpO1xuICAgIGZvciAoY29uc3QgWyByZXBsLCBleHAgXSBvZiBPYmplY3QuZW50cmllcyhlc2NhcGVDaGFycykpIHtcbiAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKGV4cCwgcmVwbCk7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBjbGFzc0F0dHJpYnV0ZSA9ICdjbGFzcydcbiAgfSkge1xuICAgIGxldCBub2RlQ2h1bmsgPSAnJztcbiAgICBsZXQgZWRnZUNodW5rID0gJyc7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGluY2x1ZGVDbGFzc2VzKSB7XG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICBub2RlQ2h1bmsgKz0gYFxuICAgIDxub2RlIGlkPVwiJHt0aGlzLmVzY2FwZShub2RlLmV4cG9ydElkKX1cIiBsYWJlbD1cIiR7dGhpcy5lc2NhcGUobm9kZS5sYWJlbCl9XCI+XG4gICAgICA8YXR0dmFsdWVzPlxuICAgICAgICA8YXR0dmFsdWUgZm9yPVwiMFwiIHZhbHVlPVwiJHt0aGlzLmVzY2FwZShjbGFzc09iai5jbGFzc05hbWUpfVwiLz5cbiAgICAgIDwvYXR0dmFsdWVzPlxuICAgIDwvbm9kZT5gO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgZWRnZS5zb3VyY2VOb2Rlcyh7IGNsYXNzZXM6IGluY2x1ZGVDbGFzc2VzIH0pKSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlLnRhcmdldE5vZGVzKHsgY2xhc3NlczogaW5jbHVkZUNsYXNzZXMgfSkpIHtcbiAgICAgICAgICAgICAgZWRnZUNodW5rICs9IGBcbiAgICA8ZWRnZSBpZD1cIiR7dGhpcy5lc2NhcGUoZWRnZS5leHBvcnRJZCl9XCIgc291cmNlPVwiJHt0aGlzLmVzY2FwZShzb3VyY2UuZXhwb3J0SWQpfVwiIHRhcmdldD1cIiR7dGhpcy5lc2NhcGUodGFyZ2V0LmV4cG9ydElkKX1cIj5cbiAgICAgIDxhdHR2YWx1ZXM+XG4gICAgICAgIDxhdHR2YWx1ZSBmb3I9XCIwXCIgdmFsdWU9XCIke3RoaXMuZXNjYXBlKGNsYXNzT2JqLmNsYXNzTmFtZSl9XCIvPlxuICAgICAgPC9hdHR2YWx1ZXM+XG4gICAgPC9lZGdlPmA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gYFxcXG48P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz5cbjxnZXhmICB4bWxucz1cImh0dHA6Ly93d3cuZ2V4Zi5uZXQvMS4yZHJhZnRcIiB4bWxuczp4c2k9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAxL1hNTFNjaGVtYS1pbnN0YW5jZVwiIHhzaTpzY2hlbWFMb2NhdGlvbj1cImh0dHA6Ly93d3cuZ2V4Zi5uZXQvMS4yZHJhZnQgaHR0cDovL3d3dy5nZXhmLm5ldC8xLjJkcmFmdC9nZXhmLnhzZFwiIHZlcnNpb249XCIxLjJcIj5cbjxtZXRhIGxhc3Rtb2RpZmllZGRhdGU9XCIyMDA5LTAzLTIwXCI+XG4gIDxjcmVhdG9yPm9yaWdyYXBoLmdpdGh1Yi5pbzwvY3JlYXRvcj5cbiAgPGRlc2NyaXB0aW9uPiR7bW9kZWwubmFtZX08L2Rlc2NyaXB0aW9uPlxuPC9tZXRhPlxuPGdyYXBoIG1vZGU9XCJzdGF0aWNcIiBkZWZhdWx0ZWRnZXR5cGU9XCJkaXJlY3RlZFwiPlxuICA8YXR0cmlidXRlcyBjbGFzcz1cIm5vZGVcIj5cbiAgICA8YXR0cmlidXRlIGlkPVwiMFwiIHRpdGxlPVwiJHtjbGFzc0F0dHJpYnV0ZX1cIiB0eXBlPVwic3RyaW5nXCIvPlxuICA8L2F0dHJpYnV0ZXM+XG4gIDxhdHRyaWJ1dGVzIGNsYXNzPVwiZWRnZVwiPlxuICAgIDxhdHRyaWJ1dGUgaWQ9XCIwXCIgdGl0bGU9XCIke2NsYXNzQXR0cmlidXRlfVwiIHR5cGU9XCJzdHJpbmdcIi8+XG4gIDwvYXR0cmlidXRlcz5cbiAgPG5vZGVzPiR7bm9kZUNodW5rfVxuICA8L25vZGVzPlxuICA8ZWRnZXM+JHtlZGdlQ2h1bmt9XG4gIDwvZWRnZXM+XG48L2dyYXBoPlxuPC9nZXhmPlxuICBgO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6ICdkYXRhOnRleHQveG1sO2Jhc2U2NCwnICsgQnVmZmVyLmZyb20ocmVzdWx0KS50b1N0cmluZygnYmFzZTY0JyksXG4gICAgICB0eXBlOiAndGV4dC94bWwnLFxuICAgICAgZXh0ZW5zaW9uOiAnZ2V4ZidcbiAgICB9O1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBuZXcgR0VYRigpO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIEZJTEVfRk9STUFUUyBmcm9tICcuLi9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0cy5qcyc7XG5cbmNvbnN0IERBVEFMSUJfRk9STUFUUyA9IHtcbiAgJ2pzb24nOiAnanNvbicsXG4gICdjc3YnOiAnY3N2JyxcbiAgJ3Rzdic6ICd0c3YnXG59O1xuXG5jbGFzcyBOZXR3b3JrTW9kZWwgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgb3JpZ3JhcGgsXG4gICAgbW9kZWxJZCxcbiAgICBuYW1lID0gbW9kZWxJZCxcbiAgICBhbm5vdGF0aW9ucyA9IHt9LFxuICAgIGNsYXNzZXMgPSB7fSxcbiAgICB0YWJsZXMgPSB7fVxuICB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9yaWdyYXBoO1xuICAgIHRoaXMubW9kZWxJZCA9IG1vZGVsSWQ7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmFubm90YXRpb25zID0gYW5ub3RhdGlvbnM7XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG4gICAgdGhpcy50YWJsZXMgPSB7fTtcblxuICAgIHRoaXMuX25leHRDbGFzc0lkID0gMTtcbiAgICB0aGlzLl9uZXh0VGFibGVJZCA9IDE7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXMoY2xhc3NlcykpIHtcbiAgICAgIHRoaXMuY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IHRoaXMuaHlkcmF0ZShjbGFzc09iaiwgQ0xBU1NFUyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgT2JqZWN0LnZhbHVlcyh0YWJsZXMpKSB7XG4gICAgICB0aGlzLnRhYmxlc1t0YWJsZS50YWJsZUlkXSA9IHRoaXMuaHlkcmF0ZSh0YWJsZSwgVEFCTEVTKTtcbiAgICB9XG5cbiAgICB0aGlzLm9uKCd1cGRhdGUnLCAoKSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc2F2ZVRpbWVvdXQpO1xuICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5fb3JpZ3JhcGguc2F2ZSgpO1xuICAgICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHVuZGVmaW5lZDtcbiAgICAgIH0sIDApO1xuICAgIH0pO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgY2xhc3NlcyA9IHt9O1xuICAgIGNvbnN0IHRhYmxlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpKSB7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0gPSB0YWJsZU9iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXS50eXBlID0gdGFibGVPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIG1vZGVsSWQ6IHRoaXMubW9kZWxJZCxcbiAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zLFxuICAgICAgY2xhc3NlcyxcbiAgICAgIHRhYmxlc1xuICAgIH07XG4gIH1cbiAgZ2V0IHVuc2F2ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9zYXZlVGltZW91dCAhPT0gdW5kZWZpbmVkO1xuICB9XG4gIGh5ZHJhdGUgKHJhd09iamVjdCwgVFlQRVMpIHtcbiAgICByYXdPYmplY3QubW9kZWwgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgVFlQRVNbcmF3T2JqZWN0LnR5cGVdKHJhd09iamVjdCk7XG4gIH1cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMudGFibGVJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0pKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke3RoaXMuX25leHRUYWJsZUlkfWA7XG4gICAgICB0aGlzLl9uZXh0VGFibGVJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFRBQkxFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBpZiAodGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXS5jbGFzc09iaiAmJiAhb3B0aW9ucy5vdmVyd3JpdGUpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0uZHVwbGljYXRlKCkudGFibGVJZDtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ0xBU1NFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG4gIGZpbmRDbGFzcyAoY2xhc3NOYW1lKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IGNsYXNzT2JqLmNsYXNzTmFtZSA9PT0gY2xhc3NOYW1lKTtcbiAgfVxuICByZW5hbWUgKG5ld05hbWUpIHtcbiAgICB0aGlzLm5hbWUgPSBuZXdOYW1lO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYW5ub3RhdGUgKGtleSwgdmFsdWUpIHtcbiAgICB0aGlzLmFubm90YXRpb25zW2tleV0gPSB2YWx1ZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZUFubm90YXRpb24gKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLmFubm90YXRpb25zW2tleV07XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuX29yaWdyYXBoLmRlbGV0ZU1vZGVsKHRoaXMubW9kZWxJZCk7XG4gIH1cbiAgZ2V0IGRlbGV0ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5tb2RlbHNbdGhpcy5tb2RlbElkXTtcbiAgfVxuICBhc3luYyBhZGRUZXh0RmlsZSAob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy5mb3JtYXQpIHtcbiAgICAgIG9wdGlvbnMuZm9ybWF0ID0gbWltZS5leHRlbnNpb24obWltZS5sb29rdXAob3B0aW9ucy5uYW1lKSk7XG4gICAgfVxuICAgIGlmIChGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICAgIHJldHVybiBGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdLmltcG9ydERhdGEob3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChEQVRBTElCX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICBvcHRpb25zLmRhdGEgPSBkYXRhbGliLnJlYWQob3B0aW9ucy50ZXh0LCB7IHR5cGU6IG9wdGlvbnMuZm9ybWF0IH0pO1xuICAgICAgaWYgKG9wdGlvbnMuZm9ybWF0ID09PSAnY3N2JyB8fCBvcHRpb25zLmZvcm1hdCA9PT0gJ3RzdicpIHtcbiAgICAgICAgb3B0aW9ucy5hdHRyaWJ1dGVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBvcHRpb25zLmRhdGEuY29sdW1ucykge1xuICAgICAgICAgIG9wdGlvbnMuYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIG9wdGlvbnMuZGF0YS5jb2x1bW5zO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUob3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBmb3JtYXQ6ICR7b3B0aW9ucy5mb3JtYXR9YCk7XG4gICAgfVxuICB9XG4gIGFzeW5jIGZvcm1hdERhdGEgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICBpZiAoRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgcmV0dXJuIEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0uZm9ybWF0RGF0YShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKERBVEFMSUJfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUmF3ICR7b3B0aW9ucy5mb3JtYXR9IGV4cG9ydCBub3QgeWV0IHN1cHBvcnRlZGApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGV4cG9ydCB1bmtub3duIGZvcm1hdDogJHtvcHRpb25zLmZvcm1hdH1gKTtcbiAgICB9XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIG9wdGltaXplVGFibGVzICgpIHtcbiAgICBjb25zdCB0YWJsZXNJblVzZSA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICB0YWJsZXNJblVzZVtjbGFzc09iai50YWJsZUlkXSA9IHRydWU7XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgY2xhc3NPYmouc291cmNlVGFibGVJZHMgfHwgW10pIHtcbiAgICAgICAgdGFibGVzSW5Vc2VbdGFibGVJZF0gPSB0cnVlO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzIHx8IFtdKSB7XG4gICAgICAgIHRhYmxlc0luVXNlW3RhYmxlSWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgcGFyZW50c1Zpc2l0ZWQgPSB7fTtcbiAgICBjb25zdCBxdWV1ZSA9IE9iamVjdC5rZXlzKHRhYmxlc0luVXNlKTtcbiAgICB3aGlsZSAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgdGFibGVJZCA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICBpZiAoIXBhcmVudHNWaXNpdGVkW3RhYmxlSWRdKSB7XG4gICAgICAgIHRhYmxlc0luVXNlW3RhYmxlSWRdID0gdHJ1ZTtcbiAgICAgICAgcGFyZW50c1Zpc2l0ZWRbdGFibGVJZF0gPSB0cnVlO1xuICAgICAgICBjb25zdCB0YWJsZSA9IHRoaXMudGFibGVzW3RhYmxlSWRdO1xuICAgICAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRhYmxlLnBhcmVudFRhYmxlcykge1xuICAgICAgICAgIHF1ZXVlLnB1c2gocGFyZW50VGFibGUudGFibGVJZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIE9iamVjdC5rZXlzKHRoaXMudGFibGVzKSkge1xuICAgICAgY29uc3QgdGFibGUgPSB0aGlzLnRhYmxlc1t0YWJsZUlkXTtcbiAgICAgIGlmICghdGFibGVzSW5Vc2VbdGFibGVJZF0gJiYgdGFibGUudHlwZSAhPT0gJ1N0YXRpYycgJiYgdGFibGUudHlwZSAhPT0gJ1N0YXRpY0RpY3QnKSB7XG4gICAgICAgIHRhYmxlLmRlbGV0ZSh0cnVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gVE9ETzogSWYgYW55IER1cGxpY2F0ZWRUYWJsZSBpcyBpbiB1c2UsIGJ1dCB0aGUgb3JpZ2luYWwgaXNuJ3QsIHN3YXAgZm9yIHRoZSByZWFsIG9uZVxuICB9XG4gIGFzeW5jIGdldEluc3RhbmNlU2FtcGxlICgpIHtcbiAgICBjb25zdCBzZWVkTGltaXQgPSAxMDA7XG4gICAgY29uc3QgY2x1c3RlckxpbWl0ID0gNTtcbiAgICBjb25zdCBjbGFzc0NvdW50ID0gNTtcbiAgICAvLyBUcnkgdG8gZ2V0IGF0IG1vc3Qgcm91Z2hseSBzZWVkQ291bnQgbm9kZXMgLyBlZGdlcywgaW4gY2x1c3RlcnMgb2YgYWJvdXRcbiAgICAvLyBjbHVzdGVyTGltaXQsIGFuZCB0cnkgdG8gaW5jbHVkZSBhdCBsZWFzdCBjbGFzc0NvdW50IGluc3RhbmNlcyBwZXIgY2xhc3NcbiAgICAvLyAobWF5IHJldHVybiBudWxsIGlmIGNhY2hlcyBhcmUgaW52YWxpZGF0ZWQgZHVyaW5nIGl0ZXJhdGlvbilcbiAgICBsZXQgaXRlcmF0aW9uUmVzZXQgPSBmYWxzZTtcbiAgICBjb25zdCBpbnN0YW5jZXMgPSB7fTtcbiAgICBsZXQgdG90YWxDb3VudCA9IDA7XG4gICAgY29uc3QgY2xhc3NDb3VudHMgPSB7fTtcblxuICAgIGNvbnN0IHBvcHVsYXRlQ2xhc3NDb3VudHMgPSBhc3luYyAoaW5zdGFuY2UpID0+IHtcbiAgICAgIGlmIChpbnN0YW5jZS5yZXNldCkge1xuICAgICAgICAvLyBDYWNoZSBpbnZhbGlkYXRlZCEgU3RvcCBpdGVyYXRpbmcgYW5kIHJldHVybiBudWxsXG4gICAgICAgIGl0ZXJhdGlvblJlc2V0ID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGluc3RhbmNlc1tpbnN0YW5jZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAvLyBEb24ndCBhZGQgdGhpcyBpbnN0YW5jZSBpZiB3ZSBhbHJlYWR5IHNhbXBsZWQgaXQsIGJ1dCBrZWVwIGl0ZXJhdGluZ1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIC8vIEFkZCBhbmQgY291bnQgdGhpcyBpbnN0YW5jZSB0byB0aGUgc2FtcGxlXG4gICAgICBpbnN0YW5jZXNbaW5zdGFuY2UuaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIHRvdGFsQ291bnQrKztcbiAgICAgIGNsYXNzQ291bnRzW2luc3RhbmNlLmNsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NDb3VudHNbaW5zdGFuY2UuY2xhc3NPYmouY2xhc3NJZF0gfHwgMDtcbiAgICAgIGNsYXNzQ291bnRzW2luc3RhbmNlLmNsYXNzT2JqLmNsYXNzSWRdKys7XG5cbiAgICAgIGlmICh0b3RhbENvdW50ID49IHNlZWRMaW1pdCkge1xuICAgICAgICAvLyBXZSBoYXZlIGVub3VnaDsgc3RvcCBpdGVyYXRpbmdcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBUcnkgdG8gYWRkIHRoZSBuZWlnaGJvcnMgb2YgdGhpcyBzYW1wbGUgZnJvbSBjbGFzc2VzIHdoZXJlIHdlIGRvbid0IGhhdmVcbiAgICAgIC8vIGVub3VnaCBzYW1wbGVzIHlldFxuICAgICAgY29uc3QgY2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmNsYXNzZXMpLmZpbHRlcihjbGFzc0lkID0+IHtcbiAgICAgICAgcmV0dXJuIChjbGFzc0NvdW50c1tjbGFzc0lkXSB8fCAwKSA8IGNsYXNzQ291bnQ7XG4gICAgICB9KTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbmVpZ2hib3Igb2YgaW5zdGFuY2UubmVpZ2hib3JzKHsgbGltaXQ6IGNsdXN0ZXJMaW1pdCwgY2xhc3NJZHMgfSkpIHtcbiAgICAgICAgaWYgKCFhd2FpdCBwb3B1bGF0ZUNsYXNzQ291bnRzKG5laWdoYm9yKSkge1xuICAgICAgICAgIC8vIFBhc3MgYWxvbmcgdGhlIHNpZ25hbCB0byBzdG9wIGl0ZXJhdGluZ1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gU2lnbmFsIHRoYXQgd2Ugc2hvdWxkIGtlZXAgaXRlcmF0aW5nXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2NsYXNzSWQsIGNsYXNzT2JqXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjb25zdCByb3dDb3VudCA9IGF3YWl0IGNsYXNzT2JqLnRhYmxlLmNvdW50Um93cygpO1xuICAgICAgLy8gR2V0IGF0IGxlYXN0IGNsYXNzQ291bnQgaW5zdGFuY2VzIGZyb20gdGhpcyBjbGFzcyAoYXMgbG9uZyBhcyB3ZVxuICAgICAgLy8gaGF2ZW4ndCBleGhhdXN0ZWQgYWxsIHRoZSBpbnN0YW5jZXMgdGhlIGNsYXNzIGhhcyB0byBnaXZlKVxuICAgICAgd2hpbGUgKChjbGFzc0NvdW50c1tjbGFzc0lkXSB8fCAwKSA8IGNsYXNzQ291bnQgJiYgKGNsYXNzQ291bnRzW2NsYXNzSWRdIHx8IDApIDwgcm93Q291bnQpIHtcbiAgICAgICAgaWYgKGl0ZXJhdGlvblJlc2V0KSB7XG4gICAgICAgICAgLy8gQ2FjaGUgaW52YWxpZGF0ZWQ7IGJhaWwgaW1tZWRpYXRlbHlcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICAvLyBBZGQgYSByYW5kb20gaW5zdGFuY2UsIGFuZCB0cnkgdG8gcHJpb3JpdGl6ZSBpdHMgbmVpZ2hib3JzIGluIG90aGVyIGNsYXNzZXNcbiAgICAgICAgaWYgKCFhd2FpdCBwb3B1bGF0ZUNsYXNzQ291bnRzKGF3YWl0IGNsYXNzT2JqLnRhYmxlLmdldFJhbmRvbUl0ZW0oKSkpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaW5zdGFuY2VzO1xuICB9XG4gIHZhbGlkYXRlSW5zdGFuY2VTYW1wbGUgKGluc3RhbmNlcykge1xuICAgIC8vIENoZWNrIGlmIGFsbCB0aGUgaW5zdGFuY2VzIGFyZSBzdGlsbCBjdXJyZW50OyByZXR1cm4gbnVsbCBhcyBhIHNpZ25hbFxuICAgIC8vIHRoYXQgYSBjYWNoZSB3YXMgaW52YWxpZGF0ZWQsIGFuZCB0aGF0IGEgZnVuY3Rpb24gbmVlZHMgdG8gYmUgY2FsbGVkIGFnYWluXG4gICAgZm9yIChjb25zdCBpbnN0YW5jZSBvZiBPYmplY3QudmFsdWVzKGluc3RhbmNlcykpIHtcbiAgICAgIGlmIChpbnN0YW5jZS5yZXNldCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGluc3RhbmNlcztcbiAgfVxuICBhc3luYyB1cGRhdGVJbnN0YW5jZVNhbXBsZSAoaW5zdGFuY2VzKSB7XG4gICAgLy8gUmVwbGFjZSBhbnkgb3V0LW9mLWRhdGUgaW5zdGFuY2VzLCBhbmQgZXhjbHVkZSBpbnN0YW5jZXMgdGhhdCBubyBsb25nZXIgZXhpc3RcbiAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFtpbnN0YW5jZUlkLCBpbnN0YW5jZV0gb2YgT2JqZWN0LmVudHJpZXMoaW5zdGFuY2VzKSkge1xuICAgICAgY29uc3QgeyBjbGFzc0lkLCBpbmRleCB9ID0gSlNPTi5wYXJzZShpbnN0YW5jZUlkKTtcbiAgICAgIGlmICh0aGlzLmNsYXNzZXNbY2xhc3NJZF0pIHtcbiAgICAgICAgaWYgKGluc3RhbmNlLnJlc2V0KSB7XG4gICAgICAgICAgY29uc3QgbmV3SW5zdGFuY2UgPSBhd2FpdCB0aGlzLmNsYXNzZXNbY2xhc3NJZF0udGFibGUuZ2V0SXRlbShpbmRleCk7XG4gICAgICAgICAgaWYgKG5ld0luc3RhbmNlKSB7XG4gICAgICAgICAgICByZXN1bHRbbmV3SW5zdGFuY2UuaW5zdGFuY2VJZF0gPSBuZXdJbnN0YW5jZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0W2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmFsaWRhdGVJbnN0YW5jZVNhbXBsZShyZXN1bHQpO1xuICB9XG4gIHBhcnRpdGlvbkluc3RhbmNlU2FtcGxlIChpbnN0YW5jZXMpIHtcbiAgICAvLyBTZXBhcmF0ZSBzYW1wbGVzIGJ5IHRoZWlyIHR5cGVcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBub2Rlczoge30sXG4gICAgICBlZGdlczoge30sXG4gICAgICBnZW5lcmljczoge31cbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2luc3RhbmNlSWQsIGluc3RhbmNlXSBvZiBPYmplY3QuZW50cmllcyhpbnN0YW5jZXMpKSB7XG4gICAgICBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIHJlc3VsdC5ub2Rlc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgfSBlbHNlIGlmIChpbnN0YW5jZS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgcmVzdWx0LmVkZ2VzW2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQuZ2VuZXJpY3NbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBmaWxsSW5zdGFuY2VTYW1wbGUgKGluc3RhbmNlcykge1xuICAgIC8vIEdpdmVuIGEgc3BlY2lmaWMgc2FtcGxlIG9mIHRoZSBncmFwaCwgYWRkIGluc3RhbmNlcyB0byBlbnN1cmUgdGhhdDpcbiAgICAvLyAxLiBGb3IgZXZlcnkgcGFpciBvZiBub2RlcywgYW55IGVkZ2VzIHRoYXQgZXhpc3QgYmV0d2VlbiB0aGVtIHNob3VsZCBiZSBhZGRlZFxuICAgIC8vIDIuIEZvciBldmVyeSBlZGdlLCBlbnN1cmUgdGhhdCBhdCBsZWFzdCBvbmUgc291cmNlIGFuZCB0YXJnZXQgbm9kZSBpcyBhZGRlZFxuICAgIGNvbnN0IHsgbm9kZXMsIGVkZ2VzIH0gPSB0aGlzLnBhcnRpdGlvbkluc3RhbmNlU2FtcGxlKGluc3RhbmNlcyk7XG4gICAgY29uc3QgZXh0cmFOb2RlcyA9IHt9O1xuICAgIGNvbnN0IGV4dHJhRWRnZXMgPSB7fTtcblxuICAgIC8vIE1ha2Ugc3VyZSB0aGF0IGVhY2ggZWRnZSBoYXMgYXQgbGVhc3Qgb25lIHNvdXJjZSBhbmQgb25lIHRhcmdldCAoYXNzdW1pbmdcbiAgICAvLyB0aGF0IHNvdXJjZSBhbmQgdGFyZ2V0IGNsYXNzZXMgYXJlIGNvbm5lY3RlZClcbiAgICBjb25zdCBzZWVkU2lkZSA9IGFzeW5jIChlZGdlLCBpdGVyRnVuYykgPT4ge1xuICAgICAgbGV0IGFOb2RlO1xuICAgICAgbGV0IGlzU2VlZGVkID0gZmFsc2U7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZVtpdGVyRnVuY10oKSkge1xuICAgICAgICBhTm9kZSA9IGFOb2RlIHx8IG5vZGU7XG4gICAgICAgIGlmIChub2Rlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgaXNTZWVkZWQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIWlzU2VlZGVkICYmIGFOb2RlKSB7XG4gICAgICAgIGV4dHJhTm9kZXNbYU5vZGUuaW5zdGFuY2VJZF0gPSBhTm9kZTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGZvciAoY29uc3QgZWRnZSBvZiBPYmplY3QudmFsdWVzKGVkZ2VzKSkge1xuICAgICAgYXdhaXQgc2VlZFNpZGUoZWRnZSwgJ3NvdXJjZU5vZGVzJyk7XG4gICAgICBhd2FpdCBzZWVkU2lkZShlZGdlLCAndGFyZ2V0Tm9kZXMnKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgYW55IGVkZ2VzIHRoYXQgZXhpc3QgdGhhdCBjb25uZWN0IGFueSBvZiB0aGUgY29yZSBub2Rlc1xuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBPYmplY3QudmFsdWVzKG5vZGVzKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIG5vZGUuZWRnZXMoKSkge1xuICAgICAgICBpZiAoIWVkZ2VzW2VkZ2UuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAvLyBDaGVjayB0aGF0IGJvdGggZW5kcyBvZiB0aGUgZWRnZSBjb25uZWN0IGF0IGxlYXN0IG9uZVxuICAgICAgICAgIC8vIG9mIG91ciBub2Rlc1xuICAgICAgICAgIGxldCBjb25uZWN0c1NvdXJjZSA9IGZhbHNlO1xuICAgICAgICAgIGxldCBjb25uZWN0c1RhcmdldCA9IGZhbHNlO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2Rlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzU291cmNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2Rlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzVGFyZ2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjb25uZWN0c1NvdXJjZSAmJiBjb25uZWN0c1RhcmdldCkge1xuICAgICAgICAgICAgZXh0cmFFZGdlc1tlZGdlLmluc3RhbmNlSWRdID0gZWRnZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBdCB0aGlzIHBvaW50IHdlIGhhdmUgYSBjb21wbGV0ZSBzZXQgb2Ygbm9kZXMgYW5kIGVkZ2VzIHRoYXQgd2Ugd2FudCB0b1xuICAgIC8vIGluY2x1ZGUuIFdlIGp1c3QgbmVlZCB0byBtZXJnZSBhbmQgdmFsaWRhdGUgdGhlIHNhbXBsZXM6XG4gICAgaW5zdGFuY2VzID0gT2JqZWN0LmFzc2lnbih7fSwgbm9kZXMsIGVkZ2VzLCBleHRyYU5vZGVzLCBleHRyYUVkZ2VzKTtcbiAgICByZXR1cm4gdGhpcy52YWxpZGF0ZUluc3RhbmNlU2FtcGxlKGluc3RhbmNlcyk7XG4gIH1cbiAgYXN5bmMgaW5zdGFuY2VTYW1wbGVUb0dyYXBoIChpbnN0YW5jZXMpIHtcbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdXG4gICAgfTtcblxuICAgIGNvbnN0IHsgbm9kZXMsIGVkZ2VzIH0gPSB0aGlzLnBhcnRpdGlvbkluc3RhbmNlU2FtcGxlKGluc3RhbmNlcyk7XG5cbiAgICAvLyBNYWtlIGEgbGlzdCBvZiBub2RlcywgcGx1cyBhIGxvb2t1cCB0byBlYWNoIG5vZGUncyBpbmRleFxuICAgIGZvciAoY29uc3QgW2luc3RhbmNlSWQsIG5vZGVdIG9mIE9iamVjdC5lbnRyaWVzKG5vZGVzKSkge1xuICAgICAgZ3JhcGgubm9kZUxvb2t1cFtpbnN0YW5jZUlkXSA9IGdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICBub2RlSW5zdGFuY2U6IG5vZGUsXG4gICAgICAgIGR1bW15OiBmYWxzZVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGFsbCB0aGUgZWRnZXMsIGluY2x1ZGluZyBkdW1teSBub2RlcyBmb3IgZGFuZ2xpbmcgZWRnZXNcbiAgICBmb3IgKGNvbnN0IGVkZ2Ugb2YgT2JqZWN0LnZhbHVlcyhlZGdlcykpIHtcbiAgICAgIGlmICghZWRnZS5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmICghZWRnZS5jbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgLy8gTWlzc2luZyBib3RoIHNvdXJjZSBhbmQgdGFyZ2V0IGNsYXNzZXM7IGFkZCBkdW1teSBub2RlcyBmb3IgYm90aCBlbmRzXG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoICsgMVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQWRkIGR1bW15IHNvdXJjZSBub2Rlc1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIWVkZ2UuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAvLyBBZGQgZHVtbXkgdGFyZ2V0IG5vZGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdLFxuICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGVyZSBzaG91bGQgYmUgYm90aCBzb3VyY2UgYW5kIHRhcmdldCBub2RlcyBmb3IgZWFjaCBlZGdlXG4gICAgICAgIC8vIChvbmx5IGNyZWF0ZSBkdW1teSBub2RlcyBmb3IgZWRnZXMgdGhhdCBhcmUgYWN0dWFsbHkgZGlzY29ubmVjdGVkKVxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZU5vZGUgb2YgZWRnZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbc291cmNlTm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldE5vZGUgb2YgZWRnZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3RhcmdldE5vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2RlTG9va3VwW3NvdXJjZU5vZGUuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Tm9kZS5pbnN0YW5jZUlkXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXROZXR3b3JrTW9kZWxHcmFwaCAoe1xuICAgIHJhdyA9IHRydWUsXG4gICAgaW5jbHVkZUR1bW1pZXMgPSBmYWxzZSxcbiAgICBjbGFzc0xpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcylcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICBsZXQgZ3JhcGggPSB7XG4gICAgICBjbGFzc2VzOiBbXSxcbiAgICAgIGNsYXNzTG9va3VwOiB7fSxcbiAgICAgIGNsYXNzQ29ubmVjdGlvbnM6IFtdXG4gICAgfTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgY2xhc3NMaXN0KSB7XG4gICAgICAvLyBBZGQgYW5kIGluZGV4IHRoZSBjbGFzcyBhcyBhIG5vZGVcbiAgICAgIGNvbnN0IGNsYXNzU3BlYyA9IHJhdyA/IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpIDogeyBjbGFzc09iaiB9O1xuICAgICAgY2xhc3NTcGVjLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGguY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBncmFwaC5jbGFzc2VzLmxlbmd0aDtcbiAgICAgIGdyYXBoLmNsYXNzZXMucHVzaChjbGFzc1NwZWMpO1xuXG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIC8vIFN0b3JlIHRoZSBlZGdlIGNsYXNzIHNvIHdlIGNhbiBjcmVhdGUgY2xhc3NDb25uZWN0aW9ucyBsYXRlclxuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnICYmIGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IG5vZGVcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7Y2xhc3NPYmouY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGggLSAxLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGZhbHNlLFxuICAgICAgICAgIGxvY2F0aW9uOiAnbm9kZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENyZWF0ZSBleGlzdGluZyBjbGFzc0Nvbm5lY3Rpb25zXG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZUNsYXNzZXMpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDb25uZWN0IHRoZSBzb3VyY2Ugbm9kZSBjbGFzcyB0byB0aGUgZWRnZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZH0+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBzb3VyY2UgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYGR1bW15PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDb25uZWN0IHRoZSBlZGdlIGNsYXNzIHRvIHRoZSB0YXJnZXQgbm9kZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+JHtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnRhcmdldENsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSB0YXJnZXQgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGggKCkge1xuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgdGFibGVzOiBbXSxcbiAgICAgIHRhYmxlTG9va3VwOiB7fSxcbiAgICAgIHRhYmxlTGlua3M6IFtdXG4gICAgfTtcbiAgICBjb25zdCB0YWJsZUxpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKTtcbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgY29uc3QgdGFibGVTcGVjID0gdGFibGUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZVNwZWMudHlwZSA9IHRhYmxlLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGdyYXBoLnRhYmxlcy5sZW5ndGg7XG4gICAgICBncmFwaC50YWJsZXMucHVzaCh0YWJsZVNwZWMpO1xuICAgIH1cbiAgICAvLyBGaWxsIHRoZSBncmFwaCB3aXRoIGxpbmtzIGJhc2VkIG9uIHBhcmVudFRhYmxlcy4uLlxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRhYmxlLnBhcmVudFRhYmxlcykge1xuICAgICAgICBncmFwaC50YWJsZUxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogZ3JhcGgudGFibGVMb29rdXBbcGFyZW50VGFibGUudGFibGVJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE1vZGVsRHVtcCAoKSB7XG4gICAgLy8gQmVjYXVzZSBvYmplY3Qga2V5IG9yZGVycyBhcmVuJ3QgZGV0ZXJtaW5pc3RpYywgaXQgY2FuIGJlIHByb2JsZW1hdGljXG4gICAgLy8gZm9yIHRlc3RpbmcgKGJlY2F1c2UgaWRzIGNhbiByYW5kb21seSBjaGFuZ2UgZnJvbSB0ZXN0IHJ1biB0byB0ZXN0IHJ1bikuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzb3J0cyBlYWNoIGtleSwgYW5kIGp1c3QgcmVwbGFjZXMgSURzIHdpdGggaW5kZXggbnVtYmVyc1xuICAgIGNvbnN0IHJhd09iaiA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodGhpcy5fdG9SYXdPYmplY3QoKSkpO1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGNsYXNzZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLmNsYXNzZXMpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgYUhhc2ggPSB0aGlzLmNsYXNzZXNbYS5jbGFzc0lkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBjb25zdCBiSGFzaCA9IHRoaXMuY2xhc3Nlc1tiLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgdGFibGVzOiBPYmplY3QudmFsdWVzKHJhd09iai50YWJsZXMpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgYUhhc2ggPSB0aGlzLnRhYmxlc1thLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy50YWJsZXNbYi50YWJsZUlkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBpZiAoYUhhc2ggPCBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIGlmIChhSGFzaCA+IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YWJsZSBoYXNoIGNvbGxpc2lvbmApO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH07XG4gICAgY29uc3QgY2xhc3NMb29rdXAgPSB7fTtcbiAgICBjb25zdCB0YWJsZUxvb2t1cCA9IHt9O1xuICAgIHJlc3VsdC5jbGFzc2VzLmZvckVhY2goKGNsYXNzT2JqLCBpbmRleCkgPT4ge1xuICAgICAgY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBpbmRleDtcbiAgICB9KTtcbiAgICByZXN1bHQudGFibGVzLmZvckVhY2goKHRhYmxlLCBpbmRleCkgPT4ge1xuICAgICAgdGFibGVMb29rdXBbdGFibGUudGFibGVJZF0gPSBpbmRleDtcbiAgICB9KTtcblxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgcmVzdWx0LnRhYmxlcykge1xuICAgICAgdGFibGUudGFibGVJZCA9IHRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpKSB7XG4gICAgICAgIHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVMb29rdXBbdGFibGVJZF1dID0gdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgICAgZGVsZXRlIHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVJZF07XG4gICAgICB9XG4gICAgICBkZWxldGUgdGFibGUuZGF0YTsgLy8gZG9uJ3QgaW5jbHVkZSBhbnkgb2YgdGhlIGRhdGE7IHdlIGp1c3Qgd2FudCB0aGUgbW9kZWwgc3RydWN0dXJlXG4gICAgfVxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgcmVzdWx0LmNsYXNzZXMpIHtcbiAgICAgIGNsYXNzT2JqLmNsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXTtcbiAgICAgIGNsYXNzT2JqLnRhYmxlSWQgPSB0YWJsZUxvb2t1cFtjbGFzc09iai50YWJsZUlkXTtcbiAgICAgIGlmIChjbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai5zb3VyY2VUYWJsZUlkcykge1xuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcyA9IGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHRhYmxlTG9va3VwW3RhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldENsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai50YXJnZXRDbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcyA9IGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHRhYmxlTG9va3VwW3RhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgY2xhc3NJZCBvZiBPYmplY3Qua2V5cyhjbGFzc09iai5lZGdlQ2xhc3NJZHMgfHwge30pKSB7XG4gICAgICAgIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0xvb2t1cFtjbGFzc0lkXV0gPSBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICAgIGRlbGV0ZSBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgY3JlYXRlU2NoZW1hTW9kZWwgKCkge1xuICAgIGNvbnN0IGdyYXBoID0gdGhpcy5nZXRNb2RlbER1bXAoKTtcblxuICAgIGdyYXBoLnRhYmxlcy5mb3JFYWNoKHRhYmxlID0+IHtcbiAgICAgIHRhYmxlLmRlcml2ZWRUYWJsZXMgPSBPYmplY3Qua2V5cyh0YWJsZS5kZXJpdmVkVGFibGVzKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ld01vZGVsID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlTW9kZWwoeyBuYW1lOiB0aGlzLm5hbWUgKyAnX3NjaGVtYScgfSk7XG4gICAgY29uc3QgcmF3ID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGgsXG4gICAgICBuYW1lOiAnUmF3IER1bXAnXG4gICAgfSk7XG4gICAgbGV0IFsgY2xhc3NlcywgdGFibGVzIF0gPSByYXcuY2xvc2VkVHJhbnNwb3NlKFsnY2xhc3NlcycsICd0YWJsZXMnXSk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgIGNsYXNzZXMuc2V0Q2xhc3NOYW1lKCdDbGFzc2VzJyk7XG4gICAgcmF3LmRlbGV0ZSgpO1xuXG4gICAgY29uc3Qgc291cmNlQ2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAnc291cmNlQ2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHNvdXJjZUNsYXNzZXMuc2V0Q2xhc3NOYW1lKCdTb3VyY2UgQ2xhc3MnKTtcbiAgICBzb3VyY2VDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuICAgIGNvbnN0IHRhcmdldENsYXNzZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogY2xhc3NlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhcmdldENsYXNzSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICB0YXJnZXRDbGFzc2VzLnNldENsYXNzTmFtZSgnVGFyZ2V0IENsYXNzJyk7XG4gICAgdGFyZ2V0Q2xhc3Nlcy50b2dnbGVEaXJlY3Rpb24oKTtcblxuICAgIHRhYmxlcyA9IHRhYmxlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgdGFibGVzLnNldENsYXNzTmFtZSgnVGFibGVzJyk7XG5cbiAgICBjb25zdCB0YWJsZURlcGVuZGVuY2llcyA9IHRhYmxlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ2Rlcml2ZWRUYWJsZXMnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICB0YWJsZURlcGVuZGVuY2llcy5zZXRDbGFzc05hbWUoJ0lzIFBhcmVudCBPZicpO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgY29uc3QgY29yZVRhYmxlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YWJsZUlkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgY29yZVRhYmxlcy5zZXRDbGFzc05hbWUoJ0NvcmUgVGFibGUnKTtcbiAgICByZXR1cm4gbmV3TW9kZWw7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE5ldHdvcmtNb2RlbDtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IE5ldHdvcmtNb2RlbCBmcm9tICcuL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMnO1xuXG5sZXQgTkVYVF9NT0RFTF9JRCA9IDE7XG5cbmNsYXNzIE9yaWdyYXBoIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAobG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gb25seSBkZWZpbmVkIGluIHRoZSBicm93c2VyIGNvbnRleHRcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICBsZXQgZXhpc3RpbmdNb2RlbHMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnKTtcbiAgICBpZiAoZXhpc3RpbmdNb2RlbHMpIHtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyhKU09OLnBhcnNlKGV4aXN0aW5nTW9kZWxzKSkpIHtcbiAgICAgICAgbW9kZWwub3JpZ3JhcGggPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsc1ttb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwobW9kZWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgfVxuICByZWdpc3RlclBsdWdpbiAobmFtZSwgcGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW5zW25hbWVdID0gcGx1Z2luO1xuICB9XG4gIHNhdmUgKCkge1xuICAgIC8qXG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH1cbiAgICAqL1xuICB9XG4gIGNsb3NlQ3VycmVudE1vZGVsICgpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBnZXQgY3VycmVudE1vZGVsICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbdGhpcy5fY3VycmVudE1vZGVsSWRdIHx8IG51bGw7XG4gIH1cbiAgc2V0IGN1cnJlbnRNb2RlbCAobW9kZWwpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG1vZGVsID8gbW9kZWwubW9kZWxJZCA6IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBhc3luYyBsb2FkTW9kZWwgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuY3JlYXRlTW9kZWwoeyBtb2RlbElkOiBvcHRpb25zLm5hbWUgfSk7XG4gICAgYXdhaXQgbmV3TW9kZWwuYWRkVGV4dEZpbGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG4gIGNyZWF0ZU1vZGVsIChvcHRpb25zID0ge30pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMubW9kZWxJZCB8fCB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdKSB7XG4gICAgICBvcHRpb25zLm1vZGVsSWQgPSBgbW9kZWwke05FWFRfTU9ERUxfSUR9YDtcbiAgICAgIE5FWFRfTU9ERUxfSUQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5vcmlncmFwaCA9IHRoaXM7XG4gICAgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwob3B0aW9ucyk7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBvcHRpb25zLm1vZGVsSWQ7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXTtcbiAgfVxuICBkZWxldGVNb2RlbCAobW9kZWxJZCA9IHRoaXMuY3VycmVudE1vZGVsSWQpIHtcbiAgICBpZiAoIXRoaXMubW9kZWxzW21vZGVsSWRdKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBub24tZXhpc3RlbnQgbW9kZWw6ICR7bW9kZWxJZH1gKTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWxzW21vZGVsSWRdO1xuICAgIGlmICh0aGlzLl9jdXJyZW50TW9kZWxJZCA9PT0gbW9kZWxJZCkge1xuICAgICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICB9XG4gICAgdGhpcy5zYXZlKCk7XG4gIH1cbiAgZGVsZXRlQWxsTW9kZWxzICgpIHtcbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE9yaWdyYXBoO1xuIiwiaW1wb3J0IE9yaWdyYXBoIGZyb20gJy4vT3JpZ3JhcGguanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgb3JpZ3JhcGggPSBuZXcgT3JpZ3JhcGgod2luZG93LmxvY2FsU3RvcmFnZSk7XG5vcmlncmFwaC52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG9yaWdyYXBoO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJfZXZlbnRIYW5kbGVycyIsIl9zdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJldmVudCIsIm5hbWVzcGFjZSIsInNwbGl0IiwicHVzaCIsIm9mZiIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiaGFuZGxlQ2FsbGJhY2siLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiR2VuZXJpY1dyYXBwZXIiLCJvcHRpb25zIiwidGFibGUiLCJ1bmRlZmluZWQiLCJFcnJvciIsImNsYXNzT2JqIiwicm93IiwiY29ubmVjdGVkSXRlbXMiLCJkdXBsaWNhdGVJdGVtcyIsInJlZ2lzdGVyRHVwbGljYXRlIiwiaXRlbSIsImNvbm5lY3RJdGVtIiwidGFibGVJZCIsImR1cCIsImRpc2Nvbm5lY3QiLCJpdGVtTGlzdCIsInZhbHVlcyIsImluc3RhbmNlSWQiLCJjbGFzc0lkIiwiZXhwb3J0SWQiLCJsYWJlbCIsImFubm90YXRpb25zIiwibGFiZWxBdHRyIiwiZXF1YWxzIiwiaGFuZGxlTGltaXQiLCJpdGVyYXRvcnMiLCJsaW1pdCIsIkluZmluaXR5IiwiaXRlcmF0b3IiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJtb2RlbCIsInRhYmxlcyIsImJ1aWxkQ2FjaGUiLCJfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwicmVzZXQiLCJuZXh0VGFibGVJZCIsImxlbmd0aCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX2xpbWl0UHJvbWlzZXMiLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwiZnVuYyIsImdldFNvcnRIYXNoIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIml0ZXJhdGUiLCJfY2FjaGUiLCJfcGFydGlhbENhY2hlIiwicmVzb2x2ZSIsInJlamVjdCIsIl9pdGVyYXRlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlTG9va3VwIiwiZG9uZSIsIm5leHQiLCJoYW5kbGVSZXNldCIsIl9maW5pc2hJdGVtIiwiTnVtYmVyIiwiX2NhY2hlTG9va3VwIiwiX2NhY2hlUHJvbWlzZSIsIml0ZW1zVG9SZXNldCIsImNvbmNhdCIsImRlcml2ZWRUYWJsZSIsImNvdW50Um93cyIsIndyYXBwZWRJdGVtIiwiZGVsYXllZFJvdyIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZ2V0SW5kZXhEZXRhaWxzIiwiZGV0YWlscyIsInN1cHByZXNzZWQiLCJmaWx0ZXJlZCIsImdldEF0dHJpYnV0ZURldGFpbHMiLCJhbGxBdHRycyIsImV4cGVjdGVkIiwib2JzZXJ2ZWQiLCJkZXJpdmVkIiwiY3VycmVudERhdGEiLCJkYXRhIiwibG9va3VwIiwiY29tcGxldGUiLCJfZ2V0SXRlbSIsImdldEl0ZW0iLCJnZXRSYW5kb21JdGVtIiwicmFuZEluZGV4IiwiTWF0aCIsImZsb29yIiwicmFuZG9tIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwidW5TdXBwcmVzc2VkQXR0cmlidXRlcyIsImZpbHRlciIsInN1cHByZXNzQXR0cmlidXRlIiwidW5TdXBwcmVzc0F0dHJpYnV0ZSIsImFkZEZpbHRlciIsIl9kZXJpdmVUYWJsZSIsIm5ld1RhYmxlIiwiY3JlYXRlVGFibGUiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGUiLCJmaW5kIiwidGFibGVPYmoiLCJldmVyeSIsIm9wdGlvbk5hbWUiLCJvcHRpb25WYWx1ZSIsInByb21vdGUiLCJleHBhbmQiLCJ1bnJvbGwiLCJjbG9zZWRGYWNldCIsIm9wZW5GYWNldCIsImNsb3NlZFRyYW5zcG9zZSIsImluZGV4ZXMiLCJvcGVuVHJhbnNwb3NlIiwiZHVwbGljYXRlIiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0Iiwib3RoZXJUYWJsZSIsInByb2plY3QiLCJ0YWJsZU9yZGVyIiwib3RoZXJUYWJsZUlkIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJmb3JjZSIsImVyciIsInBhcmVudFRhYmxlIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQXR0clRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkF0dHJUYWJsZU1peGluIiwiX2F0dHJpYnV0ZSIsIlByb21vdGVkVGFibGUiLCJfdW5maW5pc2hlZENhY2hlIiwiX3VuZmluaXNoZWRDYWNoZUxvb2t1cCIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicFRhYmxlIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJEdXBsaWNhdGVkVGFibGUiLCJDaGlsZFRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpbiIsInBhcmVudEluZGV4IiwiRXhwYW5kZWRUYWJsZSIsIlVucm9sbGVkVGFibGUiLCJyb3dzIiwiUGFyZW50Q2hpbGRUYWJsZSIsImNoaWxkVGFibGUiLCJjaGlsZCIsInBhcmVudCIsIlByb2plY3RlZFRhYmxlIiwic2VsZiIsImZpcnN0VGFibGUiLCJyZW1haW5pbmdJZHMiLCJzb3VyY2VJdGVtIiwibGFzdEl0ZW0iLCJHZW5lcmljQ2xhc3MiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwic2V0Q2xhc3NOYW1lIiwic2V0QW5ub3RhdGlvbiIsImtleSIsImRlbGV0ZUFubm90YXRpb24iLCJoYXNDdXN0b21OYW1lIiwidmFyaWFibGVOYW1lIiwiZCIsInRvTG9jYWxlVXBwZXJDYXNlIiwiZGVsZXRlZCIsImludGVycHJldEFzTm9kZXMiLCJvdmVyd3JpdGUiLCJjcmVhdGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJhZ2dyZWdhdGUiLCJkaXNzb2x2ZSIsImNhbkRpc3NvbHZlIiwib3B0aW1pemVUYWJsZXMiLCJjb3VudEFsbFVuaXF1ZVZhbHVlcyIsImhhc2hhYmxlQmlucyIsInVuSGFzaGFibGVDb3VudHMiLCJpbmRleEJpbiIsIk5vZGVXcmFwcGVyIiwiZWRnZXMiLCJlZGdlSWRzIiwiY2xhc3NJZHMiLCJlZGdlQ2xhc3NJZHMiLCJlZGdlSWQiLCJlZGdlQ2xhc3MiLCJyb2xlIiwiZ2V0RWRnZVJvbGUiLCJyZXZlcnNlIiwibmVpZ2hib3JOb2RlcyIsImVkZ2UiLCJ0YXJnZXROb2RlcyIsInRhcmdldCIsInNvdXJjZU5vZGVzIiwic291cmNlIiwibmVpZ2hib3JzIiwicGFpcndpc2VOZWlnaGJvcmhvb2QiLCJOb2RlQ2xhc3MiLCJlZGdlQ2xhc3NlcyIsImVkZ2VDbGFzc0lkIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJhdXRvY29ubmVjdCIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImlzU291cmNlIiwiZGlzY29ubmVjdFNvdXJjZSIsImRpc2Nvbm5lY3RUYXJnZXQiLCJub2RlQ2xhc3MiLCJ0YWJsZUlkTGlzdCIsImRpcmVjdGVkIiwic291cmNlRWRnZUNsYXNzIiwidGFyZ2V0RWRnZUNsYXNzIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJuZXdFZGdlQ2xhc3MiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJuZXdOb2RlQ2xhc3MiLCJuZXdDbGFzcyIsInBvcCIsImNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIiwiY2hpbGRDbGFzcyIsInByb2plY3ROZXdFZGdlIiwiY2xhc3NJZExpc3QiLCJjbGFzc0xpc3QiLCJlZGdlUm9sZSIsIkFycmF5IiwiZnJvbSIsImNvbm5lY3RlZENsYXNzZXMiLCJFZGdlV3JhcHBlciIsInNvdXJjZVRhYmxlSWQiLCJ0YXJnZXRUYWJsZUlkIiwibm9kZXMiLCJFZGdlQ2xhc3MiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwiX3NwbGl0VGFibGVJZExpc3QiLCJvdGhlckNsYXNzIiwibm9kZVRhYmxlSWRMaXN0IiwiZWRnZVRhYmxlSWQiLCJlZGdlVGFibGVJZExpc3QiLCJzdGF0aWNFeGlzdHMiLCJ0YWJsZURpc3RhbmNlcyIsInN0YXJ0c1dpdGgiLCJkaXN0IiwiYWJzIiwic29ydCIsImEiLCJiIiwic2lkZSIsImNvbm5lY3RTb3VyY2UiLCJjb25uZWN0VGFyZ2V0IiwidG9nZ2xlRGlyZWN0aW9uIiwic3dhcHBlZERpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsInVuc2hpZnQiLCJleGlzdGluZ1NvdXJjZUNsYXNzIiwiZXhpc3RpbmdUYXJnZXRDbGFzcyIsInNoaWZ0IiwiY29ubmVjdEZhY2V0ZWRDbGFzcyIsIm5ld0NsYXNzZXMiLCJGaWxlRm9ybWF0IiwiYnVpbGRSb3ciLCJQYXJzZUZhaWx1cmUiLCJmaWxlRm9ybWF0IiwiTk9ERV9OQU1FUyIsIkVER0VfTkFNRVMiLCJEM0pzb24iLCJpbXBvcnREYXRhIiwidGV4dCIsInNvdXJjZUF0dHJpYnV0ZSIsInRhcmdldEF0dHJpYnV0ZSIsImNsYXNzQXR0cmlidXRlIiwiSlNPTiIsInBhcnNlIiwibm9kZU5hbWUiLCJlZGdlTmFtZSIsImNvcmVUYWJsZSIsImNvcmVDbGFzcyIsIm5vZGVDbGFzc2VzIiwibm9kZUNsYXNzTG9va3VwIiwic2FtcGxlIiwic291cmNlQ2xhc3NOYW1lIiwidGFyZ2V0Q2xhc3NOYW1lIiwiZm9ybWF0RGF0YSIsImluY2x1ZGVDbGFzc2VzIiwicHJldHR5IiwibGlua3MiLCJub2RlTG9va3VwIiwib3RoZXIiLCJub2RlIiwic3RyaW5naWZ5IiwiQnVmZmVyIiwiZXh0ZW5zaW9uIiwiQ3N2WmlwIiwiaW5kZXhOYW1lIiwiemlwIiwiSlNaaXAiLCJjb250ZW50cyIsImZpbGUiLCJnZW5lcmF0ZUFzeW5jIiwiZXNjYXBlQ2hhcnMiLCJHRVhGIiwiZXNjYXBlIiwic3RyIiwicmVwbCIsImV4cCIsIm5vZGVDaHVuayIsImVkZ2VDaHVuayIsIkRBVEFMSUJfRk9STUFUUyIsIk5ldHdvcmtNb2RlbCIsIm9yaWdyYXBoIiwibW9kZWxJZCIsIl9vcmlncmFwaCIsIl9uZXh0Q2xhc3NJZCIsIl9uZXh0VGFibGVJZCIsImh5ZHJhdGUiLCJDTEFTU0VTIiwiVEFCTEVTIiwiX3NhdmVUaW1lb3V0Iiwic2F2ZSIsInVuc2F2ZWQiLCJyYXdPYmplY3QiLCJUWVBFUyIsImZpbmRDbGFzcyIsInJlbmFtZSIsIm5ld05hbWUiLCJhbm5vdGF0ZSIsImRlbGV0ZU1vZGVsIiwibW9kZWxzIiwiYWRkVGV4dEZpbGUiLCJmb3JtYXQiLCJtaW1lIiwiRklMRV9GT1JNQVRTIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJ0YWJsZXNJblVzZSIsInBhcmVudHNWaXNpdGVkIiwicXVldWUiLCJnZXRJbnN0YW5jZVNhbXBsZSIsInNlZWRMaW1pdCIsImNsdXN0ZXJMaW1pdCIsImNsYXNzQ291bnQiLCJpdGVyYXRpb25SZXNldCIsImluc3RhbmNlcyIsInRvdGFsQ291bnQiLCJjbGFzc0NvdW50cyIsInBvcHVsYXRlQ2xhc3NDb3VudHMiLCJpbnN0YW5jZSIsIm5laWdoYm9yIiwicm93Q291bnQiLCJ2YWxpZGF0ZUluc3RhbmNlU2FtcGxlIiwidXBkYXRlSW5zdGFuY2VTYW1wbGUiLCJuZXdJbnN0YW5jZSIsInBhcnRpdGlvbkluc3RhbmNlU2FtcGxlIiwiZ2VuZXJpY3MiLCJmaWxsSW5zdGFuY2VTYW1wbGUiLCJleHRyYU5vZGVzIiwiZXh0cmFFZGdlcyIsInNlZWRTaWRlIiwiaXRlckZ1bmMiLCJhTm9kZSIsImlzU2VlZGVkIiwiY29ubmVjdHNTb3VyY2UiLCJjb25uZWN0c1RhcmdldCIsImluc3RhbmNlU2FtcGxlVG9HcmFwaCIsImdyYXBoIiwibm9kZUluc3RhbmNlIiwiZHVtbXkiLCJlZGdlSW5zdGFuY2UiLCJzb3VyY2VOb2RlIiwidGFyZ2V0Tm9kZSIsImdldE5ldHdvcmtNb2RlbEdyYXBoIiwicmF3IiwiaW5jbHVkZUR1bW1pZXMiLCJjbGFzc0xvb2t1cCIsImNsYXNzQ29ubmVjdGlvbnMiLCJjbGFzc1NwZWMiLCJpZCIsImxvY2F0aW9uIiwiZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgiLCJ0YWJsZUxvb2t1cCIsInRhYmxlTGlua3MiLCJ0YWJsZUxpc3QiLCJ0YWJsZVNwZWMiLCJnZXRNb2RlbER1bXAiLCJyYXdPYmoiLCJhSGFzaCIsImJIYXNoIiwiY3JlYXRlU2NoZW1hTW9kZWwiLCJuZXdNb2RlbCIsImNyZWF0ZU1vZGVsIiwic291cmNlQ2xhc3NlcyIsInRhcmdldENsYXNzZXMiLCJ0YWJsZURlcGVuZGVuY2llcyIsImNvcmVUYWJsZXMiLCJORVhUX01PREVMX0lEIiwiT3JpZ3JhcGgiLCJsb2NhbFN0b3JhZ2UiLCJwbHVnaW5zIiwiZXhpc3RpbmdNb2RlbHMiLCJfY3VycmVudE1vZGVsSWQiLCJyZWdpc3RlclBsdWdpbiIsInBsdWdpbiIsImNsb3NlQ3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsIiwibG9hZE1vZGVsIiwiY3VycmVudE1vZGVsSWQiLCJkZWxldGVBbGxNb2RlbHMiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLEdBQUk7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7V0FDS0MsZUFBTCxHQUF1QixFQUF2Qjs7O0lBRUZDLEVBQUUsQ0FBRUMsU0FBRixFQUFhQyxRQUFiLEVBQXVCO1VBQ25CLENBQUNDLEtBQUQsRUFBUUMsU0FBUixJQUFxQkgsU0FBUyxDQUFDSSxLQUFWLENBQWdCLEdBQWhCLENBQXpCO1dBQ0tQLGNBQUwsQ0FBb0JLLEtBQXBCLElBQTZCLEtBQUtMLGNBQUwsQ0FB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
