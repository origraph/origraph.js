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

  createSupernodes(attribute) {
    const existingEdgeClassIds = Object.keys(this.edgeClassIds);
    const newNodeClass = super.promote(attribute);
    const newEdgeClass = this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });

    for (const edgeClassId of existingEdgeClassIds) {
      const edgeClass = this.model.classes[edgeClassId];
      const role = this.getEdgeRole(edgeClass);

      if (role === 'both') {
        newNodeClass.projectNewEdge([newEdgeClass.classId, this.classId, newEdgeClass.classId, newNodeClass.classId]).setClassName(edgeClass.className);
      } else {
        newNodeClass.projectNewEdge([newEdgeClass.classId, this.classId, edgeClass.classId, role === 'source' ? edgeClass.targetClassId : edgeClass.sourceClassId]).setClassName(edgeClass.className);
      }
    }

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

  rollup(attribute) {
    const newTable = this.table.promote(attribute);
    const sourceTableIds = this.sourceClassId ? [this.tableId].concat(this.sourceTableIds) : [];
    const targetTableIds = this.targetClassId ? [this.tableId].concat(this.targetTableIds) : [];
    const newClass = this.model.createClass({
      tableId: newTable.tableId,
      type: 'EdgeClass',
      directed: this.directed,
      sourceClassId: this.sourceClassId,
      sourceTableIds,
      targetClassId: this.targetClassId,
      targetTableIds
    });

    if (this.sourceClassId) {
      this.sourceClass.edgeClassIds[newClass.classId] = true;
    }

    if (this.targetClassId) {
      this.targetClass.edgeClassIds[newClass.classId] = true;
    }

    this.model.trigger('update');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0F0dHJUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9tb3RlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0R1cGxpY2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ2hpbGRUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9QYXJlbnRDaGlsZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9qZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0LmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL1BhcnNlRmFpbHVyZS5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9EM0pzb24uanMiLCIuLi9zcmMvRmlsZUZvcm1hdHMvQ3N2WmlwLmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL0dFWEYuanMiLCIuLi9zcmMvQ29tbW9uL05ldHdvcmtNb2RlbC5qcyIsIi4uL3NyYy9PcmlncmFwaC5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSB8fFxuICAgICAgICB7ICcnOiBbXSB9O1xuICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnB1c2goY2FsbGJhY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSA9IGNhbGxiYWNrO1xuICAgICAgfVxuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXSA9IFtdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnQsIC4uLmFyZ3MpIHtcbiAgICAgIGNvbnN0IGhhbmRsZUNhbGxiYWNrID0gY2FsbGJhY2sgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH07XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgZm9yIChjb25zdCBuYW1lc3BhY2Ugb2YgT2JqZWN0LmtleXModGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pKSB7XG4gICAgICAgICAgaWYgKG5hbWVzcGFjZSA9PT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5mb3JFYWNoKGhhbmRsZUNhbGxiYWNrKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGFuZGxlQ2FsbGJhY2sodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zID0gb3B0aW9ucy5kdXBsaWNhdGVJdGVtcyB8fCBbXTtcbiAgfVxuICByZWdpc3RlckR1cGxpY2F0ZSAoaXRlbSkge1xuICAgIHRoaXMuZHVwbGljYXRlSXRlbXMucHVzaChpdGVtKTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBkdXAgb2YgdGhpcy5kdXBsaWNhdGVJdGVtcykge1xuICAgICAgaXRlbS5jb25uZWN0SXRlbShkdXApO1xuICAgICAgZHVwLmNvbm5lY3RJdGVtKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBge1wiY2xhc3NJZFwiOlwiJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XCIsXCJpbmRleFwiOlwiJHt0aGlzLmluZGV4fVwifWA7XG4gIH1cbiAgZ2V0IGV4cG9ydElkICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jbGFzc09iai5jbGFzc0lkfV8ke3RoaXMuaW5kZXh9YDtcbiAgfVxuICBnZXQgbGFiZWwgKCkge1xuICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLmFubm90YXRpb25zLmxhYmVsQXR0ciA/IHRoaXMucm93W3RoaXMuY2xhc3NPYmouYW5ub3RhdGlvbnMubGFiZWxBdHRyXSA6IHRoaXMuaW5kZXg7XG4gIH1cbiAgZXF1YWxzIChpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zdGFuY2VJZCA9PT0gaXRlbS5pbnN0YW5jZUlkO1xuICB9XG4gIGFzeW5jICogaGFuZGxlTGltaXQgKG9wdGlvbnMsIGl0ZXJhdG9ycykge1xuICAgIGxldCBsaW1pdCA9IEluZmluaXR5O1xuICAgIGlmIChvcHRpb25zLmxpbWl0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxpbWl0ID0gb3B0aW9ucy5saW1pdDtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIH1cbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBpdGVyYXRvciBvZiBpdGVyYXRvcnMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBpdGVyYXRvcikge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICBpKys7XG4gICAgICAgIGlmIChpdGVtID09PSBudWxsIHx8IGkgPj0gbGltaXQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIHlpZWxkICogdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKTtcbiAgfVxuICAqIF9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgaWYgKHRoaXMucmVzZXQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbmV4dFRhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW25leHRUYWJsZUlkXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1tuZXh0VGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9saW1pdFByb21pc2VzID0ge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaGFzIGFscmVhZHkgYmVlbiBidWlsdDsganVzdCBncmFiIGRhdGEgZnJvbSBpdCBkaXJlY3RseVxuICAgICAgeWllbGQgKiB0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGUgJiYgdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkLCBidXQgaXQncyBhbHJlYWR5IGxvbmcgZW5vdWdoIHRvIHNhdGlzZnkgdGhpc1xuICAgICAgLy8gcmVxdWVzdFxuICAgICAgeWllbGQgKiB0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQgYnVpbGRpbmcgKGFuZCBtYXliZSBkaWRuJ3QgZXZlbiBzdGFydCB5ZXQpO1xuICAgICAgLy8ga2ljayBpdCBvZmYsIGFuZCB0aGVuIHdhaXQgZm9yIGVub3VnaCBpdGVtcyB0byBiZSBwcm9jZXNzZWQgdG8gc2F0aXNmeVxuICAgICAgLy8gdGhlIGxpbWl0XG4gICAgICB0aGlzLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIHlpZWxkICogYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSA9IHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdIHx8IFtdO1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgdGVtcCA9PT0gbnVsbCkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSkpIHtcbiAgICAgICAgICAvLyBPa2F5LCB0aGlzIGl0ZW0gcGFzc2VkIGFsbCBmaWx0ZXJzLCBhbmQgaXMgcmVhZHkgdG8gYmUgc2VudCBvdXRcbiAgICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt0ZW1wLnZhbHVlLmluZGV4XSA9IHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGg7XG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBkYXRhIG5vdyB0byBzYXRpc2Z5IGFueSB3YWl0aW5nIHJlcXVlc3RzXG4gICAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB0aGlzLl9jYWNoZUxvb2t1cCA9IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NhY2hlQnVpbHQnKTtcbiAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgfVxuICBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy8gVGhlIHNldFRpbWVvdXQgaGVyZSBpcyBhYnNvbHV0ZWx5IG5lY2Vzc2FyeSwgb3IgdGhpcy5fY2FjaGVQcm9taXNlXG4gICAgICAgIC8vIHdvbid0IGJlIHN0b3JlZCBpbiB0aW1lIGZvciB0aGUgbmV4dCBidWlsZENhY2hlKCkgY2FsbCB0aGF0IGNvbWVzXG4gICAgICAgIC8vIHRocm91Z2hcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5fYnVpbGRDYWNoZShyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBjb25zdCBpdGVtc1RvUmVzZXQgPSAodGhpcy5fY2FjaGUgfHwgW10pXG4gICAgICAuY29uY2F0KHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSk7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zVG9SZXNldCkge1xuICAgICAgaXRlbS5yZXNldCA9IHRydWU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGhhbmRsZVJlc2V0IChyZWplY3QpIHtcbiAgICBmb3IgKGNvbnN0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5yZWplY3QoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzO1xuICAgIH1cbiAgICByZWplY3QoKTtcbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5idWlsZENhY2hlKCkpLmxlbmd0aDtcbiAgfVxuICBhc3luYyBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgICBpZiAod3JhcHBlZEl0ZW0ucm93W2F0dHJdIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3cgPSB3cmFwcGVkSXRlbS5kZWxheWVkUm93IHx8IHt9O1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3dbYXR0cl0gPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZnVuYyBvZiBPYmplY3QudmFsdWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBhd2FpdCBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICAgIGlmICgha2VlcCkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoa2VlcCkge1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyYXBwZWRJdGVtLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbHRlcicpO1xuICAgIH1cbiAgICByZXR1cm4ga2VlcDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gICAgZm9yIChjb25zdCBvdGhlckl0ZW0gb2Ygb3B0aW9ucy5pdGVtc1RvQ29ubmVjdCB8fCBbXSkge1xuICAgICAgd3JhcHBlZEl0ZW0uY29ubmVjdEl0ZW0ob3RoZXJJdGVtKTtcbiAgICAgIG90aGVySXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICAvLyBBbGxvdyBwcm9iaW5nIHRvIHNlZSB3aGF0ZXZlciBkYXRhIGhhcHBlbnMgdG8gYmUgYXZhaWxhYmxlXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6IHRoaXMuX2NhY2hlIHx8IHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSxcbiAgICAgIGxvb2t1cDogdGhpcy5fY2FjaGVMb29rdXAgfHwgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGFzeW5jIF9nZXRJdGVtIChpbmRleCA9IG51bGwpIHtcbiAgICAvLyBTdHVwaWQgYXBwcm9hY2ggd2hlbiB0aGUgY2FjaGUgaXNuJ3QgYnVpbHQ6IGludGVyYXRlIHVudGlsIHdlIHNlZSB0aGVcbiAgICAvLyBpbmRleC4gU3ViY2xhc3NlcyBjb3VsZCBvdmVycmlkZSB0aGlzXG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZSgpKSB7XG4gICAgICBpZiAoaXRlbSA9PT0gbnVsbCB8fCBpdGVtLmluZGV4ID09PSBpbmRleCkge1xuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYXN5bmMgZ2V0SXRlbSAoaW5kZXggPSBudWxsKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlTG9va3VwKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9jYWNoZVswXSA6IHRoaXMuX2NhY2hlW3RoaXMuX2NhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgJiZcbiAgICAgICAgKChpbmRleCA9PT0gbnVsbCAmJiB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9wYXJ0aWFsQ2FjaGVbMF1cbiAgICAgICAgOiB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9nZXRJdGVtKGluZGV4KTtcbiAgfVxuICBhc3luYyBnZXRSYW5kb21JdGVtICgpIHtcbiAgICBjb25zdCByYW5kSW5kZXggPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhd2FpdCB0aGlzLmNvdW50Um93cygpKTtcbiAgICByZXR1cm4gdGhpcy5fY2FjaGVbcmFuZEluZGV4XTtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0IHN1cHByZXNzZWRBdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpO1xuICB9XG4gIGdldCB1blN1cHByZXNzZWRBdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gdGhpcy5hdHRyaWJ1dGVzLmZpbHRlcihhdHRyID0+ICF0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyXSk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgdW5TdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYWRkRmlsdGVyIChmdW5jLCBhdHRyaWJ1dGUgPSBudWxsKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdQcm9tb3RlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnVW5yb2xsZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGR1cGxpY2F0ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdEdXBsaWNhdGVkVGFibGUnXG4gICAgfSk7XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QsIHR5cGUgPSAnQ29ubmVjdGVkVGFibGUnKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHsgdHlwZSB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBwcm9qZWN0ICh0YWJsZUlkcykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnUHJvamVjdGVkVGFibGUnLFxuICAgICAgdGFibGVPcmRlcjogW3RoaXMudGFibGVJZF0uY29uY2F0KHRhYmxlSWRzKVxuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZUlkIG9mIHRhYmxlSWRzKSB7XG4gICAgICBjb25zdCBvdGhlclRhYmxlID0gdGhpcy5tb2RlbC50YWJsZXNbb3RoZXJUYWJsZUlkXTtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3Nlcykuc29tZShjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGVJZCA9PT0gdGhpcy50YWJsZUlkIHx8XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTEgfHxcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKGZvcmNlID0gZmFsc2UpIHtcbiAgICBpZiAoIWZvcmNlICYmIHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX25hbWU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY0RpY3RUYWJsZTtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWlyZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY29uc3QgQXR0clRhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihzdXBlcmNsYXNzKSB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkF0dHJUYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuICAgIGdldFNvcnRIYXNoICgpIHtcbiAgICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgICBnZXQgbmFtZSAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQXR0clRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBBdHRyVGFibGVNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBBdHRyVGFibGVNaXhpbiBmcm9tICcuL0F0dHJUYWJsZU1peGluLmpzJztcblxuY2xhc3MgUHJvbW90ZWRUYWJsZSBleHRlbmRzIEF0dHJUYWJsZU1peGluKFRhYmxlKSB7XG4gIGFzeW5jIF9idWlsZENhY2hlIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHdlIGRvbid0IGFjdHVhbGx5IHdhbnQgdG8gY2FsbCBfZmluaXNoSXRlbVxuICAgIC8vIHVudGlsIGFsbCB1bmlxdWUgdmFsdWVzIGhhdmUgYmVlbiBzZWVuXG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlID0gW107XG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwID0ge307XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IHRlbXAgPSB7IGRvbmU6IGZhbHNlIH07XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUpIHtcbiAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSB8fCB0ZW1wID09PSBudWxsKSB7XG4gICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAvLyB0aGF0IHdhcyB3YWl0aW5nIG9uIHVzIGtub3cgdGhhdCB3ZSBjYW4ndCBjb21wbHlcbiAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbdGVtcC52YWx1ZS5pbmRleF0gPSB0aGlzLl91bmZpbmlzaGVkQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gT2theSwgbm93IHdlJ3ZlIHNlZW4gZXZlcnl0aGluZzsgd2UgY2FuIGNhbGwgX2ZpbmlzaEl0ZW0gb24gZWFjaCBvZiB0aGVcbiAgICAvLyB1bmlxdWUgdmFsdWVzXG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdGhpcy5fdW5maW5pc2hlZENhY2hlKSB7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh2YWx1ZSkpIHtcbiAgICAgICAgLy8gT2theSwgdGhpcyBpdGVtIHBhc3NlZCBhbGwgZmlsdGVycywgYW5kIGlzIHJlYWR5IHRvIGJlIHNlbnQgb3V0XG4gICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt2YWx1ZS5pbmRleF0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUucHVzaCh2YWx1ZSk7XG4gICAgICAgIGkrKztcbiAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggZGF0YSBub3cgdG8gc2F0aXNmeSBhbnkgd2FpdGluZyByZXF1ZXN0c1xuICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUodGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwO1xuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgdGhpcy5fY2FjaGVMb29rdXAgPSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICB9XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgdGhpcy50cmlnZ2VyKCdjYWNoZUJ1aWx0Jyk7XG4gICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGxldCBpbmRleCA9IGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAodHlwZW9mIGluZGV4ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBEb24ndCBwcm9tb3RlIFtvYmplY3QgT2JqZWN0XSBhcyBhIHZhbHVlIChpZ25vcmUgdW5oYXNoYWJsZSB2YWx1ZXMpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaW5kZXggPSBTdHJpbmcoaW5kZXgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldCFcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fdW5maW5pc2hlZENhY2hlW3RoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgICAgICBleGlzdGluZ0l0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0oZXhpc3RpbmdJdGVtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBGYWNldGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSB8fCAhdGhpcy5fdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgYW5kIHZhbHVlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGUgKyB0aGlzLl92YWx1ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIFN0cmluZyh0aGlzLl92YWx1ZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgaWYgKGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgVHJhbnNwb3NlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuX2luZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouaW5kZXggPSB0aGlzLl9pbmRleDtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2luZGV4O1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5faW5kZXh9YDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgYXdhaXQgdGhpcy5wYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG5cbiAgICAvLyBJdGVyYXRlIHRoZSByb3cncyBhdHRyaWJ1dGVzIGFzIGluZGV4ZXNcbiAgICBjb25zdCB3cmFwcGVkUGFyZW50ID0gdGhpcy5wYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5wYXJlbnRUYWJsZS5fY2FjaGVMb29rdXBbdGhpcy5faW5kZXhdXSB8fCB7IHJvdzoge30gfTtcbiAgICBmb3IgKGxldCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgdmFsdWUgPSBhd2FpdCB2YWx1ZTtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJz0nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuZ2V0U29ydEhhc2goKSkuam9pbignPScpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIERvbid0IHRyeSB0byBjb25uZWN0IHZhbHVlcyB1bnRpbCBhbGwgb2YgdGhlIHBhcmVudCB0YWJsZXMnIGNhY2hlcyBhcmVcbiAgICAvLyBidWlsdDsgVE9ETzogbWlnaHQgYmUgYWJsZSB0byBkbyBzb21ldGhpbmcgbW9yZSByZXNwb25zaXZlIGhlcmU/XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwocGFyZW50VGFibGVzLm1hcChwVGFibGUgPT4gcFRhYmxlLmJ1aWxkQ2FjaGUoKSkpO1xuXG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGVMb29rdXApIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cCkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldFxuICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XSAhPT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAvLyBObyBtYXRjaCBpbiBvbmUgb2YgdGhlIG90aGVyIHRhYmxlczsgb21pdCB0aGlzIGl0ZW1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPOiBhZGQgZWFjaCBwYXJlbnQgdGFibGVzJyBrZXlzIGFzIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBwYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLl9jYWNoZVt0YWJsZS5fY2FjaGVMb29rdXBbaW5kZXhdXSlcbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBEdXBsaWNhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gWWllbGQgdGhlIHNhbWUgaXRlbXMgd2l0aCB0aGUgc2FtZSBjb25uZWN0aW9ucywgYnV0IHdyYXBwZWQgYW5kIGZpbmlzaGVkXG4gICAgLy8gYnkgdGhpcyB0YWJsZVxuICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLnBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleDogaXRlbS5pbmRleCxcbiAgICAgICAgcm93OiBpdGVtLnJvdyxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IE9iamVjdC52YWx1ZXMoaXRlbS5jb25uZWN0ZWRJdGVtcykucmVkdWNlKChhZ2csIGl0ZW1MaXN0KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoaXRlbUxpc3QpO1xuICAgICAgICB9LCBbXSlcbiAgICAgIH0pO1xuICAgICAgaXRlbS5yZWdpc3RlckR1cGxpY2F0ZShuZXdJdGVtKTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBEdXBsaWNhdGVkVGFibGU7XG4iLCJpbXBvcnQgQXR0clRhYmxlTWl4aW4gZnJvbSAnLi9BdHRyVGFibGVNaXhpbi5qcyc7XG5cbmNvbnN0IENoaWxkVGFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIEF0dHJUYWJsZU1peGluKHN1cGVyY2xhc3MpIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mQ2hpbGRUYWJsZU1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSBzdXBlci5fd3JhcChvcHRpb25zKTtcbiAgICAgIG5ld0l0ZW0ucGFyZW50SW5kZXggPSBvcHRpb25zLnBhcmVudEluZGV4O1xuICAgICAgcmV0dXJuIG5ld0l0ZW07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDaGlsZFRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZDaGlsZFRhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQ2hpbGRUYWJsZU1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IENoaWxkVGFibGVNaXhpbiBmcm9tICcuL0NoaWxkVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBDaGlsZFRhYmxlTWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93ICE9PSB1bmRlZmluZWQgJiYgcm93ICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHJvdykubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXSxcbiAgICAgICAgICBwYXJlbnRJbmRleDogd3JhcHBlZFBhcmVudC5pbmRleFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgQ2hpbGRUYWJsZU1peGluIGZyb20gJy4vQ2hpbGRUYWJsZU1peGluLmpzJztcblxuY2xhc3MgVW5yb2xsZWRUYWJsZSBleHRlbmRzIENoaWxkVGFibGVNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3Qgcm93cyA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93cyAhPT0gdW5kZWZpbmVkICYmIHJvd3MgIT09IG51bGwgJiZcbiAgICAgICAgICB0eXBlb2Ygcm93c1tTeW1ib2wuaXRlcmF0b3JdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgcm93IG9mIHJvd3MpIHtcbiAgICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIHJvdyxcbiAgICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXSxcbiAgICAgICAgICAgIHBhcmVudEluZGV4OiB3cmFwcGVkUGFyZW50LmluZGV4XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVW5yb2xsZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgUGFyZW50Q2hpbGRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbignLycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5nZXRTb3J0SGFzaCgpKS5qb2luKCcsJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgbGV0IHBhcmVudFRhYmxlLCBjaGlsZFRhYmxlO1xuICAgIGlmICh0aGlzLnBhcmVudFRhYmxlc1swXS5wYXJlbnRUYWJsZSA9PT0gdGhpcy5wYXJlbnRUYWJsZXNbMV0pIHtcbiAgICAgIHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMV07XG4gICAgICBjaGlsZFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMF07XG4gICAgfSBlbHNlIGlmICh0aGlzLnBhcmVudFRhYmxlc1sxXS5wYXJlbnRUYWJsZSA9PT0gdGhpcy5wYXJlbnRUYWJsZXNbMF0pIHtcbiAgICAgIHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMF07XG4gICAgICBjaGlsZFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50Q2hpbGRUYWJsZSBub3Qgc2V0IHVwIHByb3Blcmx5YCk7XG4gICAgfVxuXG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNoaWxkIG9mIGNoaWxkVGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBwYXJlbnQgPSBhd2FpdCBwYXJlbnRUYWJsZS5nZXRJdGVtKGNoaWxkLnBhcmVudEluZGV4KTtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbcGFyZW50LCBjaGlsZF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFBhcmVudENoaWxkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFByb2plY3RlZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMudGFibGVPcmRlciA9IG9wdGlvbnMudGFibGVPcmRlcjtcbiAgICBpZiAoIXRoaXMudGFibGVPcmRlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YWJsZU9yZGVyIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZU9yZGVyLm1hcCh0YWJsZUlkID0+IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMudGFibGVPcmRlclxuICAgICAgLm1hcCh0YWJsZUlkID0+IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLmdldFNvcnRIYXNoKCkpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgY29uc3QgZmlyc3RUYWJsZSA9IHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVPcmRlclswXV07XG4gICAgY29uc3QgcmVtYWluaW5nSWRzID0gdGhpcy50YWJsZU9yZGVyLnNsaWNlKDEpO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlSXRlbSBvZiBmaXJzdFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBsYXN0SXRlbSBvZiBzb3VyY2VJdGVtLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhyZW1haW5pbmdJZHMpKSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleDogc291cmNlSXRlbS5pbmRleCArICfiqK8nICsgbGFzdEl0ZW0uaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFtzb3VyY2VJdGVtLCBsYXN0SXRlbV1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCBzZWxmLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUHJvamVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb25zID0gb3B0aW9ucy5hbm5vdGF0aW9ucyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zXG4gICAgfTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSArIHRoaXMuY2xhc3NOYW1lO1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHNldEFubm90YXRpb24gKGtleSwgdmFsdWUpIHtcbiAgICB0aGlzLmFubm90YXRpb25zW2tleV0gPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZUFubm90YXRpb24gKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLmFubm90YXRpb25zW2tleV07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXByZXRBc0dlbmVyaWMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdHZW5lcmljQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgIH0pO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZS51bnJvbGwoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgfSk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgIH0pO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgICB0eXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWVcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgICB0eXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWVcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRUcmFuc3Bvc2UoaW5kZXhlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuVHJhbnNwb3NlKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgICB0eXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWVcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLm1vZGVsLm9wdGltaXplVGFibGVzKCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyBjb3VudEFsbFVuaXF1ZVZhbHVlcyAoKSB7XG4gICAgLy8gVE9ETzogdGhpcyBpcyB3aWxkbHkgaW5lZmZpY2llbnQsIGVzcGVjaWFsbHkgZm9yIHF1YW50aXRhdGl2ZVxuICAgIC8vIGF0dHJpYnV0ZXMuLi4gY3VycmVudGx5IGRvaW5nIHRoaXMgKHVuZGVyIHByb3Rlc3QpIGZvciBzdGF0cyBpbiB0aGVcbiAgICAvLyBjb25uZWN0IGludGVyZmFjZS4gTWF5YmUgdXNlZnVsIGZvciB3cml0aW5nIGhpc3RvZ3JhbSBmdW5jdGlvbnMgaW5cbiAgICAvLyB0aGUgZnV0dXJlP1xuICAgIGNvbnN0IGhhc2hhYmxlQmlucyA9IHt9O1xuICAgIGNvbnN0IHVuSGFzaGFibGVDb3VudHMgPSB7fTtcbiAgICBjb25zdCBpbmRleEJpbiA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgaW5kZXhCaW5baXRlbS5pbmRleF0gPSAxOyAvLyBhbHdheXMgMVxuICAgICAgZm9yIChjb25zdCBbYXR0ciwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGl0ZW0ucm93KSkge1xuICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdW5IYXNoYWJsZUNvdW50c1thdHRyXSA9IHVuSGFzaGFibGVDb3VudHNbYXR0cl0gfHwgMDtcbiAgICAgICAgICB1bkhhc2hhYmxlQ291bnRzW2F0dHJdKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGFzaGFibGVCaW5zW2F0dHJdID0gaGFzaGFibGVCaW5zW2F0dHJdIHx8IHt9O1xuICAgICAgICAgIGhhc2hhYmxlQmluc1thdHRyXVt2YWx1ZV0gPSBoYXNoYWJsZUJpbnNbYXR0cl1bdmFsdWVdIHx8IDA7XG4gICAgICAgICAgaGFzaGFibGVCaW5zW2F0dHJdW3ZhbHVlXSsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IGhhc2hhYmxlQmlucywgdW5IYXNoYWJsZUNvdW50cywgaW5kZXhCaW4gfTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0ge30pIHtcbiAgICBsZXQgZWRnZUlkcyA9IG9wdGlvbnMuY2xhc3Nlc1xuICAgICAgPyBvcHRpb25zLmNsYXNzZXMubWFwKGNsYXNzT2JqID0+IGNsYXNzT2JqLmNsYXNzSWQpXG4gICAgICA6IG9wdGlvbnMuY2xhc3NJZHMgfHwgT2JqZWN0LmtleXModGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IGl0ZXJhdG9ycyA9IFtdO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIGVkZ2VJZHMpIHtcbiAgICAgIGlmICghdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHNbZWRnZUlkXSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuY2xhc3NPYmoubW9kZWwuY2xhc3Nlc1tlZGdlSWRdO1xuICAgICAgY29uc3Qgcm9sZSA9IHRoaXMuY2xhc3NPYmouZ2V0RWRnZVJvbGUoZWRnZUNsYXNzKTtcbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAndGFyZ2V0Jykge1xuICAgICAgICBjb25zdCB0YWJsZUlkcyA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGl0ZXJhdG9ycy5wdXNoKHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBpdGVyYXRvcnMpO1xuICB9XG4gIGFzeW5jICogbmVpZ2hib3JOb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIHRoaXMuZWRnZXMoKSkge1xuICAgICAgY29uc3Qgcm9sZSA9IHRoaXMuY2xhc3NPYmouZ2V0RWRnZVJvbGUoZWRnZS5jbGFzc09iaik7XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnIHx8IHJvbGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIGVkZ2UudGFyZ2V0Tm9kZXMob3B0aW9ucykpIHtcbiAgICAgICAgICBpZiAodGhpcyAhPT0gdGFyZ2V0KSB7XG4gICAgICAgICAgICB5aWVsZCB0YXJnZXQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnIHx8IHJvbGUgPT09ICd0YXJnZXQnKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIGVkZ2Uuc291cmNlTm9kZXMob3B0aW9ucykpIHtcbiAgICAgICAgICBpZiAodGhpcyAhPT0gc291cmNlKSB7XG4gICAgICAgICAgICB5aWVsZCBzb3VyY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jICogbmVpZ2hib3JzIChvcHRpb25zID0ge30pIHtcbiAgICB5aWVsZCAqIHRoaXMuZWRnZXMob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiBwYWlyd2lzZU5laWdoYm9yaG9vZCAob3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiB0aGlzLmVkZ2VzKCkpIHtcbiAgICAgIHlpZWxkICogZWRnZS5wYWlyd2lzZU5laWdoYm9yaG9vZChvcHRpb25zKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBOb2RlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgfVxuICAqIGVkZ2VDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgZ2V0RWRnZVJvbGUgKGVkZ2VDbGFzcykge1xuICAgIGlmICghdGhpcy5lZGdlQ2xhc3NJZHNbZWRnZUNsYXNzLmNsYXNzSWRdKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIHJldHVybiAnYm90aCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3NvdXJjZSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICByZXR1cm4gJ3RhcmdldCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW50ZXJuYWwgbWlzbWF0Y2ggYmV0d2VlbiBub2RlIGFuZCBlZGdlIGNsYXNzSWRzYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IE5vZGVXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKHsgYXV0b2Nvbm5lY3QgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgaWYgKCFhdXRvY29ubmVjdCB8fCBlZGdlQ2xhc3NJZHMubGVuZ3RoID4gMikge1xuICAgICAgLy8gSWYgdGhlcmUgYXJlIG1vcmUgdGhhbiB0d28gZWRnZXMsIGJyZWFrIGFsbCBjb25uZWN0aW9ucyBhbmQgbWFrZVxuICAgICAgLy8gdGhpcyBhIGZsb2F0aW5nIGVkZ2UgKGZvciBub3csIHdlJ3JlIG5vdCBkZWFsaW5nIGluIGh5cGVyZWRnZXMpXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gV2l0aCBvbmx5IG9uZSBjb25uZWN0aW9uLCB0aGlzIG5vZGUgc2hvdWxkIGJlY29tZSBhIHNlbGYtZWRnZVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAvLyBBcmUgd2UgdGhlIHNvdXJjZSBvciB0YXJnZXQgb2YgdGhlIGV4aXN0aW5nIGVkZ2UgKGludGVybmFsbHksIGluIHRlcm1zXG4gICAgICAvLyBvZiBzb3VyY2VJZCAvIHRhcmdldElkLCBub3QgZWRnZUNsYXNzLmRpcmVjdGlvbik/XG4gICAgICBjb25zdCBpc1NvdXJjZSA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQ7XG5cbiAgICAgIC8vIEFzIHdlJ3JlIGNvbnZlcnRlZCB0byBhbiBlZGdlLCBvdXIgbmV3IHJlc3VsdGluZyBzb3VyY2UgQU5EIHRhcmdldFxuICAgICAgLy8gc2hvdWxkIGJlIHdoYXRldmVyIGlzIGF0IHRoZSBvdGhlciBlbmQgb2YgZWRnZUNsYXNzIChpZiBhbnl0aGluZylcbiAgICAgIGlmIChpc1NvdXJjZSkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgICAgfVxuICAgICAgLy8gSWYgdGhlcmUgaXMgYSBub2RlIGNsYXNzIG9uIHRoZSBvdGhlciBlbmQgb2YgZWRnZUNsYXNzLCBhZGQgb3VyXG4gICAgICAvLyBpZCB0byBpdHMgbGlzdCBvZiBjb25uZWN0aW9uc1xuICAgICAgY29uc3Qgbm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF07XG4gICAgICBpZiAobm9kZUNsYXNzKSB7XG4gICAgICAgIG5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIHRhYmxlSWQgbGlzdHMgc2hvdWxkIGVtYW5hdGUgb3V0IGZyb20gdGhlIChuZXcpIGVkZ2UgdGFibGU7IGFzc3VtaW5nXG4gICAgICAvLyAoZm9yIGEgbW9tZW50KSB0aGF0IGlzU291cmNlID09PSB0cnVlLCB3ZSdkIGNvbnN0cnVjdCB0aGUgdGFibGVJZCBsaXN0XG4gICAgICAvLyBsaWtlIHRoaXM6XG4gICAgICBsZXQgdGFibGVJZExpc3QgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIGVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmICghaXNTb3VyY2UpIHtcbiAgICAgICAgLy8gV2hvb3BzLCBnb3QgaXQgYmFja3dhcmRzIVxuICAgICAgICB0YWJsZUlkTGlzdC5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZWRnZUNsYXNzLmRpcmVjdGVkO1xuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YWJsZUlkTGlzdDtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgIC8vIE9rYXksIHdlJ3ZlIGdvdCB0d28gZWRnZXMsIHNvIHRoaXMgaXMgYSBsaXR0bGUgbW9yZSBzdHJhaWdodGZvcndhcmRcbiAgICAgIGxldCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIGxldCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgIC8vIEZpZ3VyZSBvdXQgdGhlIGRpcmVjdGlvbiwgaWYgdGhlcmUgaXMgb25lXG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLmRpcmVjdGVkICYmIHRhcmdldEVkZ2VDbGFzcy5kaXJlY3RlZCkge1xuICAgICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGhhcHBlbmVkIHRvIGdldCB0aGUgZWRnZXMgaW4gb3JkZXI7IHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBnb3QgdGhlIGVkZ2VzIGJhY2t3YXJkczsgc3dhcCB0aGVtIGFuZCBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgICAgIHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBub3cgd2Uga25vdyBob3cgdG8gc2V0IHNvdXJjZSAvIHRhcmdldCBpZHNcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAvLyBBZGQgdGhpcyBjbGFzcyB0byB0aGUgc291cmNlJ3MgLyB0YXJnZXQncyBlZGdlQ2xhc3NJZHNcbiAgICAgIHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnRhcmdldENsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIC8vIENvbmNhdGVuYXRlIHRoZSBpbnRlcm1lZGlhdGUgdGFibGVJZCBsaXN0cywgZW1hbmF0aW5nIG91dCBmcm9tIHRoZVxuICAgICAgLy8gKG5ldykgZWRnZSB0YWJsZVxuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgc291cmNlRWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChzb3VyY2VFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFyZ2V0RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyB0YXJnZXRFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHRhcmdldEVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcyk7XG4gICAgICBpZiAodGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnRhcmdldFRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIC8vIERpc2Nvbm5lY3QgdGhlIGV4aXN0aW5nIGVkZ2UgY2xhc3NlcyBmcm9tIHRoZSBuZXcgKG5vdyBlZGdlKSBjbGFzc1xuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzSWRzO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcHJldEFzR2VuZXJpYyAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICByZXR1cm4gc3VwZXIuaW50ZXJwcmV0QXNHZW5lcmljKCk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBhdHRyaWJ1dGUsIG90aGVyQXR0cmlidXRlIH0pIHtcbiAgICBsZXQgdGhpc0hhc2gsIG90aGVySGFzaCwgc291cmNlVGFibGVJZHMsIHRhcmdldFRhYmxlSWRzO1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXNIYXNoID0gdGhpcy50YWJsZTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXNIYXNoID0gdGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSk7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFsgdGhpc0hhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBpZiAob3RoZXJBdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGUucHJvbW90ZShvdGhlckF0dHJpYnV0ZSk7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFsgb3RoZXJIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzSGFzaC5jb25uZWN0KFtvdGhlckhhc2hdKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldFRhYmxlSWRzXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdFZGdlQ2xhc3M7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSBzdXBlci5wcm9tb3RlKGF0dHJpYnV0ZSk7XG4gICAgdGhpcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IG5ld05vZGVDbGFzcyxcbiAgICAgIGF0dHJpYnV0ZSxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBjcmVhdGVTdXBlcm5vZGVzIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBleGlzdGluZ0VkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSBzdXBlci5wcm9tb3RlKGF0dHJpYnV0ZSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IG5ld05vZGVDbGFzcyxcbiAgICAgIGF0dHJpYnV0ZSxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBleGlzdGluZ0VkZ2VDbGFzc0lkcykge1xuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmdldEVkZ2VSb2xlKGVkZ2VDbGFzcyk7XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIG5ld05vZGVDbGFzcy5wcm9qZWN0TmV3RWRnZShbXG4gICAgICAgICAgbmV3RWRnZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgICAgdGhpcy5jbGFzc0lkLFxuICAgICAgICAgIG5ld0VkZ2VDbGFzcy5jbGFzc0lkLFxuICAgICAgICAgIG5ld05vZGVDbGFzcy5jbGFzc0lkXG4gICAgICAgIF0pLnNldENsYXNzTmFtZShlZGdlQ2xhc3MuY2xhc3NOYW1lKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld05vZGVDbGFzcy5wcm9qZWN0TmV3RWRnZShbXG4gICAgICAgICAgbmV3RWRnZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgICAgdGhpcy5jbGFzc0lkLFxuICAgICAgICAgIGVkZ2VDbGFzcy5jbGFzc0lkLFxuICAgICAgICAgIHJvbGUgPT09ICdzb3VyY2UnID8gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgOiBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZFxuICAgICAgICBdKS5zZXRDbGFzc05hbWUoZWRnZUNsYXNzLmNsYXNzTmFtZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgY29ubmVjdFRvQ2hpbGROb2RlQ2xhc3MgKGNoaWxkQ2xhc3MpIHtcbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXMudGFibGUuY29ubmVjdChbY2hpbGRDbGFzcy50YWJsZV0sICdQYXJlbnRDaGlsZFRhYmxlJyk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkczogW10sXG4gICAgICB0YXJnZXRDbGFzc0lkOiBjaGlsZENsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkczogW11cbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIGNoaWxkQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHN1cGVyLmV4cGFuZChhdHRyaWJ1dGUpO1xuICAgIHRoaXMuY29ubmVjdFRvQ2hpbGROb2RlQ2xhc3MobmV3Tm9kZUNsYXNzKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gc3VwZXIudW5yb2xsKGF0dHJpYnV0ZSk7XG4gICAgdGhpcy5jb25uZWN0VG9DaGlsZE5vZGVDbGFzcyhuZXdOb2RlQ2xhc3MpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgcHJvamVjdE5ld0VkZ2UgKGNsYXNzSWRMaXN0KSB7XG4gICAgY29uc3QgY2xhc3NMaXN0ID0gW3RoaXNdLmNvbmNhdChjbGFzc0lkTGlzdC5tYXAoY2xhc3NJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC5jbGFzc2VzW2NsYXNzSWRdO1xuICAgIH0pKTtcbiAgICBpZiAoY2xhc3NMaXN0Lmxlbmd0aCA8IDMgfHwgY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS50eXBlICE9PSAnTm9kZScpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjbGFzc0lkTGlzdGApO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VDbGFzc0lkID0gdGhpcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzSWQgPSBjbGFzc0xpc3RbY2xhc3NMaXN0Lmxlbmd0aCAtIDFdLmNsYXNzSWQ7XG4gICAgbGV0IHRhYmxlT3JkZXIgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGNsYXNzTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgY2xhc3NPYmogPSBjbGFzc0xpc3RbaV07XG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIHRhYmxlT3JkZXIucHVzaChjbGFzc09iai50YWJsZUlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGVkZ2VSb2xlID0gY2xhc3NMaXN0W2kgLSAxXS5nZXRFZGdlUm9sZShjbGFzc09iaik7XG4gICAgICAgIGlmIChlZGdlUm9sZSA9PT0gJ3NvdXJjZScgfHwgZWRnZVJvbGUgPT09ICdib3RoJykge1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChcbiAgICAgICAgICAgIEFycmF5LmZyb20oY2xhc3NPYmouc291cmNlVGFibGVJZHMpLnJldmVyc2UoKSk7XG4gICAgICAgICAgdGFibGVPcmRlci5wdXNoKGNsYXNzT2JqLnRhYmxlSWQpO1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChjbGFzc09iai50YXJnZXRUYWJsZUlkcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGFibGVPcmRlciA9IHRhYmxlT3JkZXIuY29uY2F0KFxuICAgICAgICAgICAgQXJyYXkuZnJvbShjbGFzc09iai50YXJnZXRUYWJsZUlkcykucmV2ZXJzZSgpKTtcbiAgICAgICAgICB0YWJsZU9yZGVyLnB1c2goY2xhc3NPYmoudGFibGVJZCk7XG4gICAgICAgICAgdGFibGVPcmRlciA9IHRhYmxlT3JkZXIuY29uY2F0KGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMudGFibGUucHJvamVjdCh0YWJsZU9yZGVyKTtcbiAgICBjb25zdCBuZXdDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZCxcbiAgICAgIHRhcmdldENsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkczogW10sXG4gICAgICB0YXJnZXRUYWJsZUlkczogW11cbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS5lZGdlQ2xhc3NJZHNbbmV3Q2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHJldHVybiBuZXdDbGFzcztcbiAgfVxuICBkaXNjb25uZWN0QWxsRWRnZXMgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiB0aGlzLmNvbm5lY3RlZENsYXNzZXMoKSkge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2Uob3B0aW9ucyk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogc291cmNlTm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlVGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZF0udGFibGVJZDtcbiAgICBjb25zdCB0YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmouc291cmNlVGFibGVJZHMuY29uY2F0KFsgc291cmNlVGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkXS50YWJsZUlkO1xuICAgIGNvbnN0IHRhYmxlSWRzID0gdGhpcy5jbGFzc09iai50YXJnZXRUYWJsZUlkcy5jb25jYXQoWyB0YXJnZXRUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIG5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSxcbiAgICAgIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIG5laWdoYm9ycyAob3B0aW9ucyA9IHt9KSB7XG4gICAgeWllbGQgKiB0aGlzLm5vZGVzKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogcGFpcndpc2VOZWlnaGJvcmhvb2QgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICAgIHlpZWxkIHtcbiAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGVkZ2U6IHRoaXNcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBFZGdlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAvLyBzb3VyY2VUYWJsZUlkcyBhbmQgdGFyZ2V0VGFibGVJZHMgYXJlIGxpc3RzIG9mIGFueSBpbnRlcm1lZGlhdGUgdGFibGVzLFxuICAgIC8vIGJlZ2lubmluZyB3aXRoIHRoZSBlZGdlIHRhYmxlIChidXQgbm90IGluY2x1ZGluZyBpdCksIHRoYXQgbGVhZCB0byB0aGVcbiAgICAvLyBzb3VyY2UgLyB0YXJnZXQgbm9kZSB0YWJsZXMgKGJ1dCBub3QgaW5jbHVkaW5nKSB0aG9zZVxuXG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMuc291cmNlVGFibGVJZHMgfHwgW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgfHwgW107XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgZ2V0IHNvdXJjZUNsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBnZXQgdGFyZ2V0Q2xhc3MgKCkge1xuICAgIHJldHVybiAodGhpcy50YXJnZXRDbGFzc0lkICYmIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdKSB8fCBudWxsO1xuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVwcmV0QXNHZW5lcmljICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICByZXR1cm4gc3VwZXIuaW50ZXJwcmV0QXNHZW5lcmljKCk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5wcm9tb3RlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MudGFibGUucHJvbW90ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUucHJvbW90ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLnByb21vdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0U291cmNlICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHJldHVybiBzdXBlci5wcm9tb3RlKGF0dHJpYnV0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgICB0eXBlOiAnTm9kZUNsYXNzJ1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgIG5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgICBzaWRlOiAhdGhpcy5zb3VyY2VDbGFzc0lkID8gJ3NvdXJjZScgOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogYXR0cmlidXRlXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gICAgfVxuICB9XG4gIHJvbGx1cCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKTtcbiAgICBjb25zdCBzb3VyY2VUYWJsZUlkcyA9IHRoaXMuc291cmNlQ2xhc3NJZCA/IFt0aGlzLnRhYmxlSWRdLmNvbmNhdCh0aGlzLnNvdXJjZVRhYmxlSWRzKSA6IFtdO1xuICAgIGNvbnN0IHRhcmdldFRhYmxlSWRzID0gdGhpcy50YXJnZXRDbGFzc0lkID8gW3RoaXMudGFibGVJZF0uY29uY2F0KHRoaXMudGFyZ2V0VGFibGVJZHMpIDogW107XG4gICAgY29uc3QgbmV3Q2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIGRpcmVjdGVkOiB0aGlzLmRpcmVjdGVkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5zb3VyY2VDbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRDbGFzc0lkOiB0aGlzLnRhcmdldENsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0NsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy50YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3Q2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdDbGFzcztcbiAgfVxuICBjb25uZWN0RmFjZXRlZENsYXNzIChuZXdFZGdlQ2xhc3MpIHtcbiAgICAvLyBXaGVuIGFuIGVkZ2UgY2xhc3MgaXMgZmFjZXRlZCwgd2Ugd2FudCB0byBrZWVwIHRoZSBzYW1lIGNvbm5lY3Rpb25zLiBUaGlzXG4gICAgLy8gbWVhbnMgd2UgbmVlZCB0byBjbG9uZSBlYWNoIHRhYmxlIGNoYWluLCBhbmQgYWRkIG91ciBvd24gdGFibGUgdG8gaXRcbiAgICAvLyAoYmVjYXVzZSBvdXIgdGFibGUgaXMgdGhlIHBhcmVudFRhYmxlIG9mIHRoZSBuZXcgb25lKVxuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIG5ld0VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzID0gQXJyYXkuZnJvbSh0aGlzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIG5ld0VkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBuZXdFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcyA9IEFycmF5LmZyb20odGhpcy50YXJnZXRUYWJsZUlkcyk7XG4gICAgICBuZXdFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMudW5zaGlmdCh0aGlzLnRhYmxlSWQpO1xuICAgICAgdGhpcy50YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICBjb25zdCBuZXdDbGFzc2VzID0gc3VwZXIuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpO1xuICAgIGZvciAoY29uc3QgbmV3Q2xhc3Mgb2YgbmV3Q2xhc3Nlcykge1xuICAgICAgdGhpcy5jb25uZWN0RmFjZXRlZENsYXNzKG5ld0NsYXNzKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld0NsYXNzZXM7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3Q2xhc3Mgb2Ygc3VwZXIub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHRoaXMuY29ubmVjdEZhY2V0ZWRDbGFzcyhuZXdDbGFzcyk7XG4gICAgICB5aWVsZCBuZXdDbGFzcztcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJjbGFzcyBGaWxlRm9ybWF0IHtcbiAgYXN5bmMgYnVpbGRSb3cgKGl0ZW0pIHtcbiAgICBjb25zdCByb3cgPSB7fTtcbiAgICBmb3IgKGxldCBhdHRyIGluIGl0ZW0ucm93KSB7XG4gICAgICByb3dbYXR0cl0gPSBhd2FpdCBpdGVtLnJvd1thdHRyXTtcbiAgICB9XG4gICAgcmV0dXJuIHJvdztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmlsZUZvcm1hdDtcbiIsImNsYXNzIFBhcnNlRmFpbHVyZSBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IgKGZpbGVGb3JtYXQpIHtcbiAgICBzdXBlcihgRmFpbGVkIHRvIHBhcnNlIGZvcm1hdDogJHtmaWxlRm9ybWF0LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFBhcnNlRmFpbHVyZTtcbiIsImltcG9ydCBGaWxlRm9ybWF0IGZyb20gJy4vRmlsZUZvcm1hdC5qcyc7XG5pbXBvcnQgUGFyc2VGYWlsdXJlIGZyb20gJy4vUGFyc2VGYWlsdXJlLmpzJztcblxuY29uc3QgTk9ERV9OQU1FUyA9IFsnbm9kZXMnLCAnTm9kZXMnXTtcbmNvbnN0IEVER0VfTkFNRVMgPSBbJ2VkZ2VzJywgJ2xpbmtzJywgJ0VkZ2VzJywgJ0xpbmtzJ107XG5cbmNsYXNzIEQzSnNvbiBleHRlbmRzIEZpbGVGb3JtYXQge1xuICBhc3luYyBpbXBvcnREYXRhICh7XG4gICAgbW9kZWwsXG4gICAgdGV4dCxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBzb3VyY2VBdHRyaWJ1dGUgPSAnc291cmNlJyxcbiAgICB0YXJnZXRBdHRyaWJ1dGUgPSAndGFyZ2V0JyxcbiAgICBjbGFzc0F0dHJpYnV0ZSA9IG51bGxcbiAgfSkge1xuICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKHRleHQpO1xuICAgIGNvbnN0IG5vZGVOYW1lID0gTk9ERV9OQU1FUy5maW5kKG5hbWUgPT4gZGF0YVtuYW1lXSBpbnN0YW5jZW9mIEFycmF5KTtcbiAgICBjb25zdCBlZGdlTmFtZSA9IEVER0VfTkFNRVMuZmluZChuYW1lID0+IGRhdGFbbmFtZV0gaW5zdGFuY2VvZiBBcnJheSk7XG4gICAgaWYgKCFub2RlTmFtZSB8fCAhZWRnZU5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZUZhaWx1cmUodGhpcyk7XG4gICAgfVxuXG4gICAgY29uc3QgY29yZVRhYmxlID0gbW9kZWwuY3JlYXRlVGFibGUoe1xuICAgICAgdHlwZTogJ1N0YXRpY0RpY3RUYWJsZScsXG4gICAgICBuYW1lOiAnY29yZVRhYmxlJyxcbiAgICAgIGRhdGE6IGRhdGFcbiAgICB9KTtcbiAgICBjb25zdCBjb3JlQ2xhc3MgPSBtb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvcmVUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gICAgbGV0IFtub2RlcywgZWRnZXNdID0gY29yZUNsYXNzLmNsb3NlZFRyYW5zcG9zZShbbm9kZU5hbWUsIGVkZ2VOYW1lXSk7XG5cbiAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgIGlmIChub2RlQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgaW1wb3J0IGNsYXNzZXMgZnJvbSBEMy1zdHlsZSBKU09OIHdpdGhvdXQgbm9kZUF0dHJpYnV0ZWApO1xuICAgICAgfVxuICAgICAgY29uc3Qgbm9kZUNsYXNzZXMgPSBbXTtcbiAgICAgIGNvbnN0IG5vZGVDbGFzc0xvb2t1cCA9IHt9O1xuICAgICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZUNsYXNzIG9mIG5vZGVzLm9wZW5GYWNldChjbGFzc0F0dHJpYnV0ZSkpIHtcbiAgICAgICAgbm9kZUNsYXNzTG9va3VwW25vZGVDbGFzcy5jbGFzc05hbWVdID0gbm9kZUNsYXNzZXMubGVuZ3RoO1xuICAgICAgICBub2RlQ2xhc3Nlcy5wdXNoKG5vZGVDbGFzcy5pbnRlcnByZXRBc05vZGVzKCkpO1xuICAgICAgfVxuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZXMub3BlbkZhY2V0KGNsYXNzQXR0cmlidXRlKSkge1xuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGVkZ2VDbGFzcy5pbnRlcnByZXRBc0VkZ2VzKCkpO1xuICAgICAgICBjb25zdCBzYW1wbGUgPSBhd2FpdCBlZGdlQ2xhc3MudGFibGUuZ2V0SXRlbSgpO1xuICAgICAgICBjb25zdCBzb3VyY2VDbGFzc05hbWUgPSBhd2FpdCBzYW1wbGUucm93W3NvdXJjZUF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXTtcbiAgICAgICAgaWYgKG5vZGVDbGFzc0xvb2t1cFtzb3VyY2VDbGFzc05hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgICAgICAgIG5vZGVDbGFzczogbm9kZUNsYXNzZXNbbm9kZUNsYXNzTG9va3VwW3NvdXJjZUNsYXNzTmFtZV1dLFxuICAgICAgICAgICAgc2lkZTogJ3NvdXJjZScsXG4gICAgICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICAgICAgZWRnZUF0dHJpYnV0ZTogc291cmNlQXR0cmlidXRlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdGFyZ2V0Q2xhc3NOYW1lID0gYXdhaXQgc2FtcGxlLnJvd1t0YXJnZXRBdHRyaWJ1dGUgKyAnXycgKyBjbGFzc0F0dHJpYnV0ZV07XG4gICAgICAgIGlmIChub2RlQ2xhc3NMb29rdXBbdGFyZ2V0Q2xhc3NOYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgICAgICBub2RlQ2xhc3M6IG5vZGVDbGFzc2VzW25vZGVDbGFzc0xvb2t1cFt0YXJnZXRDbGFzc05hbWVdXSxcbiAgICAgICAgICAgIHNpZGU6ICd0YXJnZXQnLFxuICAgICAgICAgICAgbm9kZUF0dHJpYnV0ZSxcbiAgICAgICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHRhcmdldEF0dHJpYnV0ZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGVzID0gbm9kZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgICAgbm9kZXMuc2V0Q2xhc3NOYW1lKG5vZGVOYW1lKTtcbiAgICAgIGVkZ2VzID0gZWRnZXMuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgICAgZWRnZXMuc2V0Q2xhc3NOYW1lKGVkZ2VOYW1lKTtcbiAgICAgIG5vZGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICAgIGVkZ2VDbGFzczogZWRnZXMsXG4gICAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICBlZGdlQXR0cmlidXRlOiBzb3VyY2VBdHRyaWJ1dGVcbiAgICAgIH0pO1xuICAgICAgbm9kZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgICAgZWRnZUNsYXNzOiBlZGdlcyxcbiAgICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHRhcmdldEF0dHJpYnV0ZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jIGZvcm1hdERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICBpbmNsdWRlQ2xhc3NlcyA9IE9iamVjdC52YWx1ZXMobW9kZWwuY2xhc3NlcyksXG4gICAgcHJldHR5ID0gdHJ1ZSxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBzb3VyY2VBdHRyaWJ1dGUgPSAnc291cmNlJyxcbiAgICB0YXJnZXRBdHRyaWJ1dGUgPSAndGFyZ2V0JyxcbiAgICBjbGFzc0F0dHJpYnV0ZSA9IG51bGxcbiAgfSkge1xuICAgIGlmIChjbGFzc0F0dHJpYnV0ZSAmJiAhbm9kZUF0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBleHBvcnQgRDMtc3R5bGUgSlNPTiB3aXRoIGNsYXNzZXMsIHdpdGhvdXQgYSBub2RlQXR0cmlidXRlYCk7XG4gICAgfVxuICAgIGxldCByZXN1bHQgPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBsaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IG5vZGVMb29rdXAgPSB7fTtcbiAgICBjb25zdCBub2RlQ2xhc3NlcyA9IFtdO1xuICAgIGNvbnN0IGVkZ2VDbGFzc2VzID0gW107XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBpbmNsdWRlQ2xhc3Nlcykge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBub2RlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0Lm90aGVyID0gcmVzdWx0Lm90aGVyIHx8IFtdO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgcmVzdWx0Lm90aGVyLnB1c2goYXdhaXQgdGhpcy5idWlsZFJvdyhpdGVtKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBub2RlQ2xhc3Mgb2Ygbm9kZUNsYXNzZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBub2RlQ2xhc3MudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgIG5vZGVMb29rdXBbbm9kZS5leHBvcnRJZF0gPSByZXN1bHQubm9kZXMubGVuZ3RoO1xuICAgICAgICBjb25zdCByb3cgPSBhd2FpdCB0aGlzLmJ1aWxkUm93KG5vZGUpO1xuICAgICAgICBpZiAobm9kZUF0dHJpYnV0ZSkge1xuICAgICAgICAgIHJvd1tub2RlQXR0cmlidXRlXSA9IG5vZGUuZXhwb3J0SWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNsYXNzQXR0cmlidXRlKSB7XG4gICAgICAgICAgcm93W2NsYXNzQXR0cmlidXRlXSA9IG5vZGUuY2xhc3NPYmouY2xhc3NOYW1lO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5ub2Rlcy5wdXNoKHJvdyk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIGVkZ2VDbGFzc2VzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgZWRnZUNsYXNzLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICBjb25zdCByb3cgPSBhd2FpdCB0aGlzLmJ1aWxkUm93KGVkZ2UpO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiBlZGdlLnNvdXJjZU5vZGVzKHsgY2xhc3Nlczogbm9kZUNsYXNzZXMgfSkpIHtcbiAgICAgICAgICByb3dbc291cmNlQXR0cmlidXRlXSA9IG5vZGVBdHRyaWJ1dGUgPyBzb3VyY2UuZXhwb3J0SWQgOiBub2RlTG9va3VwW3NvdXJjZS5leHBvcnRJZF07XG4gICAgICAgICAgaWYgKGNsYXNzQXR0cmlidXRlKSB7XG4gICAgICAgICAgICByb3dbc291cmNlQXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdID0gc291cmNlLmNsYXNzT2JqLmNsYXNzTmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgZWRnZS50YXJnZXROb2Rlcyh7IGNsYXNzZXM6IG5vZGVDbGFzc2VzIH0pKSB7XG4gICAgICAgICAgICByb3dbdGFyZ2V0QXR0cmlidXRlXSA9IG5vZGVBdHRyaWJ1dGUgPyB0YXJnZXQuZXhwb3J0SWQgOiBub2RlTG9va3VwW3RhcmdldC5leHBvcnRJZF07XG4gICAgICAgICAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgcm93W3RhcmdldEF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXSA9IHRhcmdldC5jbGFzc09iai5jbGFzc05hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQubGlua3MucHVzaChPYmplY3QuYXNzaWduKHt9LCByb3cpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHByZXR0eSkge1xuICAgICAgcmVzdWx0Lm5vZGVzID0gJyAgXCJub2Rlc1wiOiBbXFxuICAgICcgKyByZXN1bHQubm9kZXMubWFwKHJvdyA9PiBKU09OLnN0cmluZ2lmeShyb3cpKVxuICAgICAgICAuam9pbignLFxcbiAgICAnKSArICdcXG4gIF0nO1xuICAgICAgcmVzdWx0LmxpbmtzID0gJyAgXCJsaW5rc1wiOiBbXFxuICAgICcgKyByZXN1bHQubGlua3MubWFwKHJvdyA9PiBKU09OLnN0cmluZ2lmeShyb3cpKVxuICAgICAgICAuam9pbignLFxcbiAgICAnKSArICdcXG4gIF0nO1xuICAgICAgaWYgKHJlc3VsdC5vdGhlcikge1xuICAgICAgICByZXN1bHQub3RoZXIgPSAnLFxcbiAgXCJvdGhlclwiOiBbXFxuICAgICcgKyByZXN1bHQub3RoZXIubWFwKHJvdyA9PiBKU09OLnN0cmluZ2lmeShyb3cpKVxuICAgICAgICAgIC5qb2luKCcsXFxuICAgICcpICsgJ1xcbiAgXSc7XG4gICAgICB9XG4gICAgICByZXN1bHQgPSBge1xcbiR7cmVzdWx0Lm5vZGVzfSxcXG4ke3Jlc3VsdC5saW5rc30ke3Jlc3VsdC5vdGhlciB8fCAnJ31cXG59XFxuYDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gSlNPTi5zdHJpbmdpZnkocmVzdWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6ICdkYXRhOnRleHQvanNvbjtiYXNlNjQsJyArIEJ1ZmZlci5mcm9tKHJlc3VsdCkudG9TdHJpbmcoJ2Jhc2U2NCcpLFxuICAgICAgdHlwZTogJ3RleHQvanNvbicsXG4gICAgICBleHRlbnNpb246ICdqc29uJ1xuICAgIH07XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IG5ldyBEM0pzb24oKTtcbiIsImltcG9ydCBGaWxlRm9ybWF0IGZyb20gJy4vRmlsZUZvcm1hdC5qcyc7XG5pbXBvcnQgSlNaaXAgZnJvbSAnanN6aXAnO1xuXG5jbGFzcyBDc3ZaaXAgZXh0ZW5kcyBGaWxlRm9ybWF0IHtcbiAgYXN5bmMgaW1wb3J0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIHRleHRcbiAgfSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGZvcm1hdERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICBpbmNsdWRlQ2xhc3NlcyA9IE9iamVjdC52YWx1ZXMobW9kZWwuY2xhc3NlcyksXG4gICAgaW5kZXhOYW1lID0gJ2luZGV4J1xuICB9KSB7XG4gICAgY29uc3QgemlwID0gbmV3IEpTWmlwKCk7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGluY2x1ZGVDbGFzc2VzKSB7XG4gICAgICBjb25zdCBhdHRyaWJ1dGVzID0gY2xhc3NPYmoudGFibGUudW5TdXBwcmVzc2VkQXR0cmlidXRlcztcbiAgICAgIGxldCBjb250ZW50cyA9IGAke2luZGV4TmFtZX0sJHthdHRyaWJ1dGVzLmpvaW4oJywnKX1cXG5gO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICBjb250ZW50cyArPSBgJHtpdGVtLmluZGV4fWA7XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgY29udGVudHMgKz0gYCwke2F3YWl0IGl0ZW0ucm93W2F0dHJdfWA7XG4gICAgICAgIH1cbiAgICAgICAgY29udGVudHMgKz0gYFxcbmA7XG4gICAgICB9XG4gICAgICB6aXAuZmlsZShjbGFzc09iai5jbGFzc05hbWUgKyAnLmNzdicsIGNvbnRlbnRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogJ2RhdGE6YXBwbGljYXRpb24vemlwO2Jhc2U2NCwnICsgYXdhaXQgemlwLmdlbmVyYXRlQXN5bmMoeyB0eXBlOiAnYmFzZTY0JyB9KSxcbiAgICAgIHR5cGU6ICdhcHBsaWNhdGlvbi96aXAnLFxuICAgICAgZXh0ZW5zaW9uOiAnemlwJ1xuICAgIH07XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IG5ldyBDc3ZaaXAoKTtcbiIsImltcG9ydCBGaWxlRm9ybWF0IGZyb20gJy4vRmlsZUZvcm1hdC5qcyc7XG5cbmNvbnN0IGVzY2FwZUNoYXJzID0ge1xuICAnJnF1b3Q7JzogL1wiL2csXG4gICcmYXBvczsnOiAvJy9nLFxuICAnJmx0Oyc6IC88L2csXG4gICcmZ3Q7JzogLz4vZ1xufTtcblxuY2xhc3MgR0VYRiBleHRlbmRzIEZpbGVGb3JtYXQge1xuICBhc3luYyBpbXBvcnREYXRhICh7XG4gICAgbW9kZWwsXG4gICAgdGV4dFxuICB9KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgZXNjYXBlIChzdHIpIHtcbiAgICBzdHIgPSBzdHIucmVwbGFjZSgvJi9nLCAnJmFtcDsnKTtcbiAgICBmb3IgKGNvbnN0IFsgcmVwbCwgZXhwIF0gb2YgT2JqZWN0LmVudHJpZXMoZXNjYXBlQ2hhcnMpKSB7XG4gICAgICBzdHIgPSBzdHIucmVwbGFjZShleHAsIHJlcGwpO1xuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9XG4gIGFzeW5jIGZvcm1hdERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICBpbmNsdWRlQ2xhc3NlcyA9IE9iamVjdC52YWx1ZXMobW9kZWwuY2xhc3NlcyksXG4gICAgY2xhc3NBdHRyaWJ1dGUgPSAnY2xhc3MnXG4gIH0pIHtcbiAgICBsZXQgbm9kZUNodW5rID0gJyc7XG4gICAgbGV0IGVkZ2VDaHVuayA9ICcnO1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBpbmNsdWRlQ2xhc3Nlcykge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgbm9kZUNodW5rICs9IGBcbiAgICA8bm9kZSBpZD1cIiR7dGhpcy5lc2NhcGUobm9kZS5leHBvcnRJZCl9XCIgbGFiZWw9XCIke3RoaXMuZXNjYXBlKG5vZGUubGFiZWwpfVwiPlxuICAgICAgPGF0dHZhbHVlcz5cbiAgICAgICAgPGF0dHZhbHVlIGZvcj1cIjBcIiB2YWx1ZT1cIiR7dGhpcy5lc2NhcGUoY2xhc3NPYmouY2xhc3NOYW1lKX1cIi8+XG4gICAgICA8L2F0dHZhbHVlcz5cbiAgICA8L25vZGU+YDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIGVkZ2Uuc291cmNlTm9kZXMoeyBjbGFzc2VzOiBpbmNsdWRlQ2xhc3NlcyB9KSkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgZWRnZS50YXJnZXROb2Rlcyh7IGNsYXNzZXM6IGluY2x1ZGVDbGFzc2VzIH0pKSB7XG4gICAgICAgICAgICAgIGVkZ2VDaHVuayArPSBgXG4gICAgPGVkZ2UgaWQ9XCIke3RoaXMuZXNjYXBlKGVkZ2UuZXhwb3J0SWQpfVwiIHNvdXJjZT1cIiR7dGhpcy5lc2NhcGUoc291cmNlLmV4cG9ydElkKX1cIiB0YXJnZXQ9XCIke3RoaXMuZXNjYXBlKHRhcmdldC5leHBvcnRJZCl9XCI+XG4gICAgICA8YXR0dmFsdWVzPlxuICAgICAgICA8YXR0dmFsdWUgZm9yPVwiMFwiIHZhbHVlPVwiJHt0aGlzLmVzY2FwZShjbGFzc09iai5jbGFzc05hbWUpfVwiLz5cbiAgICAgIDwvYXR0dmFsdWVzPlxuICAgIDwvZWRnZT5gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGBcXFxuPD94bWwgdmVyc2lvbj1cIjEuMFwiIGVuY29kaW5nPVwiVVRGLThcIj8+XG48Z2V4ZiAgeG1sbnM9XCJodHRwOi8vd3d3LmdleGYubmV0LzEuMmRyYWZ0XCIgeG1sbnM6eHNpPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMS9YTUxTY2hlbWEtaW5zdGFuY2VcIiB4c2k6c2NoZW1hTG9jYXRpb249XCJodHRwOi8vd3d3LmdleGYubmV0LzEuMmRyYWZ0IGh0dHA6Ly93d3cuZ2V4Zi5uZXQvMS4yZHJhZnQvZ2V4Zi54c2RcIiB2ZXJzaW9uPVwiMS4yXCI+XG48bWV0YSBsYXN0bW9kaWZpZWRkYXRlPVwiMjAwOS0wMy0yMFwiPlxuICA8Y3JlYXRvcj5vcmlncmFwaC5naXRodWIuaW88L2NyZWF0b3I+XG4gIDxkZXNjcmlwdGlvbj4ke21vZGVsLm5hbWV9PC9kZXNjcmlwdGlvbj5cbjwvbWV0YT5cbjxncmFwaCBtb2RlPVwic3RhdGljXCIgZGVmYXVsdGVkZ2V0eXBlPVwiZGlyZWN0ZWRcIj5cbiAgPGF0dHJpYnV0ZXMgY2xhc3M9XCJub2RlXCI+XG4gICAgPGF0dHJpYnV0ZSBpZD1cIjBcIiB0aXRsZT1cIiR7Y2xhc3NBdHRyaWJ1dGV9XCIgdHlwZT1cInN0cmluZ1wiLz5cbiAgPC9hdHRyaWJ1dGVzPlxuICA8YXR0cmlidXRlcyBjbGFzcz1cImVkZ2VcIj5cbiAgICA8YXR0cmlidXRlIGlkPVwiMFwiIHRpdGxlPVwiJHtjbGFzc0F0dHJpYnV0ZX1cIiB0eXBlPVwic3RyaW5nXCIvPlxuICA8L2F0dHJpYnV0ZXM+XG4gIDxub2Rlcz4ke25vZGVDaHVua31cbiAgPC9ub2Rlcz5cbiAgPGVkZ2VzPiR7ZWRnZUNodW5rfVxuICA8L2VkZ2VzPlxuPC9ncmFwaD5cbjwvZ2V4Zj5cbiAgYDtcblxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiAnZGF0YTp0ZXh0L3htbDtiYXNlNjQsJyArIEJ1ZmZlci5mcm9tKHJlc3VsdCkudG9TdHJpbmcoJ2Jhc2U2NCcpLFxuICAgICAgdHlwZTogJ3RleHQveG1sJyxcbiAgICAgIGV4dGVuc2lvbjogJ2dleGYnXG4gICAgfTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgbmV3IEdFWEYoKTtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuXG5pbXBvcnQgKiBhcyBUQUJMRVMgZnJvbSAnLi4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4uL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBGSUxFX0ZPUk1BVFMgZnJvbSAnLi4vRmlsZUZvcm1hdHMvRmlsZUZvcm1hdHMuanMnO1xuXG5jb25zdCBEQVRBTElCX0ZPUk1BVFMgPSB7XG4gICdqc29uJzogJ2pzb24nLFxuICAnY3N2JzogJ2NzdicsXG4gICd0c3YnOiAndHN2J1xufTtcblxuY2xhc3MgTmV0d29ya01vZGVsIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoe1xuICAgIG9yaWdyYXBoLFxuICAgIG1vZGVsSWQsXG4gICAgbmFtZSA9IG1vZGVsSWQsXG4gICAgYW5ub3RhdGlvbnMgPSB7fSxcbiAgICBjbGFzc2VzID0ge30sXG4gICAgdGFibGVzID0ge31cbiAgfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fb3JpZ3JhcGggPSBvcmlncmFwaDtcbiAgICB0aGlzLm1vZGVsSWQgPSBtb2RlbElkO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IGFubm90YXRpb25zO1xuICAgIHRoaXMuY2xhc3NlcyA9IHt9O1xuICAgIHRoaXMudGFibGVzID0ge307XG5cbiAgICB0aGlzLl9uZXh0Q2xhc3NJZCA9IDE7XG4gICAgdGhpcy5fbmV4dFRhYmxlSWQgPSAxO1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKGNsYXNzZXMpKSB7XG4gICAgICB0aGlzLmNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSB0aGlzLmh5ZHJhdGUoY2xhc3NPYmosIENMQVNTRVMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIE9iamVjdC52YWx1ZXModGFibGVzKSkge1xuICAgICAgdGhpcy50YWJsZXNbdGFibGUudGFibGVJZF0gPSB0aGlzLmh5ZHJhdGUodGFibGUsIFRBQkxFUyk7XG4gICAgfVxuXG4gICAgdGhpcy5vbigndXBkYXRlJywgKCkgPT4ge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3NhdmVUaW1lb3V0KTtcbiAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuX29yaWdyYXBoLnNhdmUoKTtcbiAgICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSB1bmRlZmluZWQ7XG4gICAgICB9LCAwKTtcbiAgICB9KTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IGNsYXNzZXMgPSB7fTtcbiAgICBjb25zdCB0YWJsZXMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXS50eXBlID0gY2xhc3NPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZU9iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKSkge1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdID0gdGFibGVPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0udHlwZSA9IHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBtb2RlbElkOiB0aGlzLm1vZGVsSWQsXG4gICAgICBuYW1lOiB0aGlzLm5hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9ucyxcbiAgICAgIGNsYXNzZXMsXG4gICAgICB0YWJsZXNcbiAgICB9O1xuICB9XG4gIGdldCB1bnNhdmVkICgpIHtcbiAgICByZXR1cm4gdGhpcy5fc2F2ZVRpbWVvdXQgIT09IHVuZGVmaW5lZDtcbiAgfVxuICBoeWRyYXRlIChyYXdPYmplY3QsIFRZUEVTKSB7XG4gICAgcmF3T2JqZWN0Lm1vZGVsID0gdGhpcztcbiAgICByZXR1cm4gbmV3IFRZUEVTW3Jhd09iamVjdC50eXBlXShyYXdPYmplY3QpO1xuICB9XG4gIGNyZWF0ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgd2hpbGUgKCFvcHRpb25zLnRhYmxlSWQgfHwgKCFvcHRpb25zLm92ZXJ3cml0ZSAmJiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdKSkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHt0aGlzLl9uZXh0VGFibGVJZH1gO1xuICAgICAgdGhpcy5fbmV4dFRhYmxlSWQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSA9IG5ldyBUQUJMRVNbb3B0aW9ucy50eXBlXShvcHRpb25zKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdO1xuICB9XG4gIGNyZWF0ZUNsYXNzIChvcHRpb25zID0ge30pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMuY2xhc3NJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdKSkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHt0aGlzLl9uZXh0Q2xhc3NJZH1gO1xuICAgICAgdGhpcy5fbmV4dENsYXNzSWQgKz0gMTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0uY2xhc3NPYmogJiYgIW9wdGlvbnMub3ZlcndyaXRlKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdLmR1cGxpY2F0ZSgpLnRhYmxlSWQ7XG4gICAgfVxuICAgIGlmIChvcHRpb25zLm92ZXJ3cml0ZSkge1xuICAgICAgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXS5yZXNldCgpO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDTEFTU0VTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cbiAgZmluZENsYXNzIChjbGFzc05hbWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NOYW1lID09PSBjbGFzc05hbWUpO1xuICB9XG4gIHJlbmFtZSAobmV3TmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5ld05hbWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhbm5vdGF0ZSAoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYW5ub3RhdGlvbnNba2V5XSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlQW5ub3RhdGlvbiAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMuYW5ub3RhdGlvbnNba2V5XTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5fb3JpZ3JhcGguZGVsZXRlTW9kZWwodGhpcy5tb2RlbElkKTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX29yaWdyYXBoLm1vZGVsc1t0aGlzLm1vZGVsSWRdO1xuICB9XG4gIGFzeW5jIGFkZFRleHRGaWxlIChvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zLmZvcm1hdCkge1xuICAgICAgb3B0aW9ucy5mb3JtYXQgPSBtaW1lLmV4dGVuc2lvbihtaW1lLmxvb2t1cChvcHRpb25zLm5hbWUpKTtcbiAgICB9XG4gICAgaWYgKEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgICAgcmV0dXJuIEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0uaW1wb3J0RGF0YShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKERBVEFMSUJfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIG9wdGlvbnMuZGF0YSA9IGRhdGFsaWIucmVhZChvcHRpb25zLnRleHQsIHsgdHlwZTogb3B0aW9ucy5mb3JtYXQgfSk7XG4gICAgICBpZiAob3B0aW9ucy5mb3JtYXQgPT09ICdjc3YnIHx8IG9wdGlvbnMuZm9ybWF0ID09PSAndHN2Jykge1xuICAgICAgICBvcHRpb25zLmF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIG9wdGlvbnMuZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgb3B0aW9ucy5hdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgb3B0aW9ucy5kYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZShvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGZvcm1hdDogJHtvcHRpb25zLmZvcm1hdH1gKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIGlmIChGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICByZXR1cm4gRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XS5mb3JtYXREYXRhKG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAoREFUQUxJQl9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBSYXcgJHtvcHRpb25zLmZvcm1hdH0gZXhwb3J0IG5vdCB5ZXQgc3VwcG9ydGVkYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZXhwb3J0IHVua25vd24gZm9ybWF0OiAke29wdGlvbnMuZm9ybWF0fWApO1xuICAgIH1cbiAgfVxuICBhZGRTdGF0aWNUYWJsZSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudHlwZSA9IG9wdGlvbnMuZGF0YSBpbnN0YW5jZW9mIEFycmF5ID8gJ1N0YXRpY1RhYmxlJyA6ICdTdGF0aWNEaWN0VGFibGUnO1xuICAgIGxldCBuZXdUYWJsZSA9IHRoaXMuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gIH1cbiAgb3B0aW1pemVUYWJsZXMgKCkge1xuICAgIGNvbnN0IHRhYmxlc0luVXNlID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIHRhYmxlc0luVXNlW2NsYXNzT2JqLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc09iai5zb3VyY2VUYWJsZUlkcyB8fCBbXSkge1xuICAgICAgICB0YWJsZXNJblVzZVt0YWJsZUlkXSA9IHRydWU7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMgfHwgW10pIHtcbiAgICAgICAgdGFibGVzSW5Vc2VbdGFibGVJZF0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBwYXJlbnRzVmlzaXRlZCA9IHt9O1xuICAgIGNvbnN0IHF1ZXVlID0gT2JqZWN0LmtleXModGFibGVzSW5Vc2UpO1xuICAgIHdoaWxlIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCB0YWJsZUlkID0gcXVldWUuc2hpZnQoKTtcbiAgICAgIGlmICghcGFyZW50c1Zpc2l0ZWRbdGFibGVJZF0pIHtcbiAgICAgICAgdGFibGVzSW5Vc2VbdGFibGVJZF0gPSB0cnVlO1xuICAgICAgICBwYXJlbnRzVmlzaXRlZFt0YWJsZUlkXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IHRhYmxlID0gdGhpcy50YWJsZXNbdGFibGVJZF07XG4gICAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgICAgcXVldWUucHVzaChwYXJlbnRUYWJsZS50YWJsZUlkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgT2JqZWN0LmtleXModGhpcy50YWJsZXMpKSB7XG4gICAgICBjb25zdCB0YWJsZSA9IHRoaXMudGFibGVzW3RhYmxlSWRdO1xuICAgICAgaWYgKCF0YWJsZXNJblVzZVt0YWJsZUlkXSAmJiB0YWJsZS50eXBlICE9PSAnU3RhdGljJyAmJiB0YWJsZS50eXBlICE9PSAnU3RhdGljRGljdCcpIHtcbiAgICAgICAgdGFibGUuZGVsZXRlKHRydWUpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBUT0RPOiBJZiBhbnkgRHVwbGljYXRlZFRhYmxlIGlzIGluIHVzZSwgYnV0IHRoZSBvcmlnaW5hbCBpc24ndCwgc3dhcCBmb3IgdGhlIHJlYWwgb25lXG4gIH1cbiAgYXN5bmMgZ2V0SW5zdGFuY2VTYW1wbGUgKCkge1xuICAgIGNvbnN0IHNlZWRMaW1pdCA9IDEwMDtcbiAgICBjb25zdCBjbHVzdGVyTGltaXQgPSA1O1xuICAgIGNvbnN0IGNsYXNzQ291bnQgPSA1O1xuICAgIC8vIFRyeSB0byBnZXQgYXQgbW9zdCByb3VnaGx5IHNlZWRDb3VudCBub2RlcyAvIGVkZ2VzLCBpbiBjbHVzdGVycyBvZiBhYm91dFxuICAgIC8vIGNsdXN0ZXJMaW1pdCwgYW5kIHRyeSB0byBpbmNsdWRlIGF0IGxlYXN0IGNsYXNzQ291bnQgaW5zdGFuY2VzIHBlciBjbGFzc1xuICAgIC8vIChtYXkgcmV0dXJuIG51bGwgaWYgY2FjaGVzIGFyZSBpbnZhbGlkYXRlZCBkdXJpbmcgaXRlcmF0aW9uKVxuICAgIGxldCBpdGVyYXRpb25SZXNldCA9IGZhbHNlO1xuICAgIGNvbnN0IGluc3RhbmNlcyA9IHt9O1xuICAgIGxldCB0b3RhbENvdW50ID0gMDtcbiAgICBjb25zdCBjbGFzc0NvdW50cyA9IHt9O1xuXG4gICAgY29uc3QgcG9wdWxhdGVDbGFzc0NvdW50cyA9IGFzeW5jIChpbnN0YW5jZSkgPT4ge1xuICAgICAgaWYgKGluc3RhbmNlLnJlc2V0KSB7XG4gICAgICAgIC8vIENhY2hlIGludmFsaWRhdGVkISBTdG9wIGl0ZXJhdGluZyBhbmQgcmV0dXJuIG51bGxcbiAgICAgICAgaXRlcmF0aW9uUmVzZXQgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAoaW5zdGFuY2VzW2luc3RhbmNlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgIC8vIERvbid0IGFkZCB0aGlzIGluc3RhbmNlIGlmIHdlIGFscmVhZHkgc2FtcGxlZCBpdCwgYnV0IGtlZXAgaXRlcmF0aW5nXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgLy8gQWRkIGFuZCBjb3VudCB0aGlzIGluc3RhbmNlIHRvIHRoZSBzYW1wbGVcbiAgICAgIGluc3RhbmNlc1tpbnN0YW5jZS5pbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgdG90YWxDb3VudCsrO1xuICAgICAgY2xhc3NDb3VudHNbaW5zdGFuY2UuY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc0NvdW50c1tpbnN0YW5jZS5jbGFzc09iai5jbGFzc0lkXSB8fCAwO1xuICAgICAgY2xhc3NDb3VudHNbaW5zdGFuY2UuY2xhc3NPYmouY2xhc3NJZF0rKztcblxuICAgICAgaWYgKHRvdGFsQ291bnQgPj0gc2VlZExpbWl0KSB7XG4gICAgICAgIC8vIFdlIGhhdmUgZW5vdWdoOyBzdG9wIGl0ZXJhdGluZ1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIFRyeSB0byBhZGQgdGhlIG5laWdoYm9ycyBvZiB0aGlzIHNhbXBsZSBmcm9tIGNsYXNzZXMgd2hlcmUgd2UgZG9uJ3QgaGF2ZVxuICAgICAgLy8gZW5vdWdoIHNhbXBsZXMgeWV0XG4gICAgICBjb25zdCBjbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NlcykuZmlsdGVyKGNsYXNzSWQgPT4ge1xuICAgICAgICByZXR1cm4gKGNsYXNzQ291bnRzW2NsYXNzSWRdIHx8IDApIDwgY2xhc3NDb3VudDtcbiAgICAgIH0pO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBuZWlnaGJvciBvZiBpbnN0YW5jZS5uZWlnaGJvcnMoeyBsaW1pdDogY2x1c3RlckxpbWl0LCBjbGFzc0lkcyB9KSkge1xuICAgICAgICBpZiAoIWF3YWl0IHBvcHVsYXRlQ2xhc3NDb3VudHMobmVpZ2hib3IpKSB7XG4gICAgICAgICAgLy8gUGFzcyBhbG9uZyB0aGUgc2lnbmFsIHRvIHN0b3AgaXRlcmF0aW5nXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBTaWduYWwgdGhhdCB3ZSBzaG91bGQga2VlcCBpdGVyYXRpbmdcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG4gICAgZm9yIChjb25zdCBbY2xhc3NJZCwgY2xhc3NPYmpdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNvbnN0IHJvd0NvdW50ID0gYXdhaXQgY2xhc3NPYmoudGFibGUuY291bnRSb3dzKCk7XG4gICAgICAvLyBEb24ndCBzYW1wbGUgZnJvbSBHZW5lcmljQ2xhc3Nlc1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdHZW5lcmljJykge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gR2V0IGF0IGxlYXN0IGNsYXNzQ291bnQgaW5zdGFuY2VzIGZyb20gdGhpcyBjbGFzcyAoYXMgbG9uZyBhcyB3ZVxuICAgICAgLy8gaGF2ZW4ndCBleGhhdXN0ZWQgYWxsIHRoZSBpbnN0YW5jZXMgdGhlIGNsYXNzIGhhcyB0byBnaXZlKVxuICAgICAgd2hpbGUgKChjbGFzc0NvdW50c1tjbGFzc0lkXSB8fCAwKSA8IGNsYXNzQ291bnQgJiYgKGNsYXNzQ291bnRzW2NsYXNzSWRdIHx8IDApIDwgcm93Q291bnQpIHtcbiAgICAgICAgaWYgKGl0ZXJhdGlvblJlc2V0KSB7XG4gICAgICAgICAgLy8gQ2FjaGUgaW52YWxpZGF0ZWQ7IGJhaWwgaW1tZWRpYXRlbHlcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICAvLyBBZGQgYSByYW5kb20gaW5zdGFuY2UsIGFuZCB0cnkgdG8gcHJpb3JpdGl6ZSBpdHMgbmVpZ2hib3JzIGluIG90aGVyIGNsYXNzZXNcbiAgICAgICAgaWYgKCFhd2FpdCBwb3B1bGF0ZUNsYXNzQ291bnRzKGF3YWl0IGNsYXNzT2JqLnRhYmxlLmdldFJhbmRvbUl0ZW0oKSkpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaW5zdGFuY2VzO1xuICB9XG4gIHZhbGlkYXRlSW5zdGFuY2VTYW1wbGUgKGluc3RhbmNlcykge1xuICAgIC8vIENoZWNrIGlmIGFsbCB0aGUgaW5zdGFuY2VzIGFyZSBzdGlsbCBjdXJyZW50OyByZXR1cm4gbnVsbCBhcyBhIHNpZ25hbFxuICAgIC8vIHRoYXQgYSBjYWNoZSB3YXMgaW52YWxpZGF0ZWQsIGFuZCB0aGF0IGEgZnVuY3Rpb24gbmVlZHMgdG8gYmUgY2FsbGVkIGFnYWluXG4gICAgZm9yIChjb25zdCBpbnN0YW5jZSBvZiBPYmplY3QudmFsdWVzKGluc3RhbmNlcykpIHtcbiAgICAgIGlmIChpbnN0YW5jZS5yZXNldCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGluc3RhbmNlcztcbiAgfVxuICBhc3luYyB1cGRhdGVJbnN0YW5jZVNhbXBsZSAoaW5zdGFuY2VzKSB7XG4gICAgLy8gUmVwbGFjZSBhbnkgb3V0LW9mLWRhdGUgaW5zdGFuY2VzLCBhbmQgZXhjbHVkZSBpbnN0YW5jZXMgdGhhdCBubyBsb25nZXIgZXhpc3RcbiAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFtpbnN0YW5jZUlkLCBpbnN0YW5jZV0gb2YgT2JqZWN0LmVudHJpZXMoaW5zdGFuY2VzKSkge1xuICAgICAgY29uc3QgeyBjbGFzc0lkLCBpbmRleCB9ID0gSlNPTi5wYXJzZShpbnN0YW5jZUlkKTtcbiAgICAgIGlmICh0aGlzLmNsYXNzZXNbY2xhc3NJZF0pIHtcbiAgICAgICAgaWYgKGluc3RhbmNlLnJlc2V0KSB7XG4gICAgICAgICAgY29uc3QgbmV3SW5zdGFuY2UgPSBhd2FpdCB0aGlzLmNsYXNzZXNbY2xhc3NJZF0udGFibGUuZ2V0SXRlbShpbmRleCk7XG4gICAgICAgICAgaWYgKG5ld0luc3RhbmNlKSB7XG4gICAgICAgICAgICByZXN1bHRbbmV3SW5zdGFuY2UuaW5zdGFuY2VJZF0gPSBuZXdJbnN0YW5jZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0W2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmFsaWRhdGVJbnN0YW5jZVNhbXBsZShyZXN1bHQpO1xuICB9XG4gIHBhcnRpdGlvbkluc3RhbmNlU2FtcGxlIChpbnN0YW5jZXMpIHtcbiAgICAvLyBTZXBhcmF0ZSBzYW1wbGVzIGJ5IHRoZWlyIHR5cGVcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBub2Rlczoge30sXG4gICAgICBlZGdlczoge30sXG4gICAgICBnZW5lcmljczoge31cbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2luc3RhbmNlSWQsIGluc3RhbmNlXSBvZiBPYmplY3QuZW50cmllcyhpbnN0YW5jZXMpKSB7XG4gICAgICBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIHJlc3VsdC5ub2Rlc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgfSBlbHNlIGlmIChpbnN0YW5jZS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgcmVzdWx0LmVkZ2VzW2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQuZ2VuZXJpY3NbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBmaWxsSW5zdGFuY2VTYW1wbGUgKGluc3RhbmNlcykge1xuICAgIC8vIEdpdmVuIGEgc3BlY2lmaWMgc2FtcGxlIG9mIHRoZSBncmFwaCwgYWRkIGluc3RhbmNlcyB0byBlbnN1cmUgdGhhdDpcbiAgICAvLyAxLiBGb3IgZXZlcnkgcGFpciBvZiBub2RlcywgYW55IGVkZ2VzIHRoYXQgZXhpc3QgYmV0d2VlbiB0aGVtIHNob3VsZCBiZSBhZGRlZFxuICAgIC8vIDIuIEZvciBldmVyeSBlZGdlLCBlbnN1cmUgdGhhdCBhdCBsZWFzdCBvbmUgc291cmNlIGFuZCB0YXJnZXQgbm9kZSBpcyBhZGRlZFxuICAgIGNvbnN0IHsgbm9kZXMsIGVkZ2VzIH0gPSB0aGlzLnBhcnRpdGlvbkluc3RhbmNlU2FtcGxlKGluc3RhbmNlcyk7XG4gICAgY29uc3QgZXh0cmFOb2RlcyA9IHt9O1xuICAgIGNvbnN0IGV4dHJhRWRnZXMgPSB7fTtcblxuICAgIC8vIE1ha2Ugc3VyZSB0aGF0IGVhY2ggZWRnZSBoYXMgYXQgbGVhc3Qgb25lIHNvdXJjZSBhbmQgb25lIHRhcmdldCAoYXNzdW1pbmdcbiAgICAvLyB0aGF0IHNvdXJjZSBhbmQgdGFyZ2V0IGNsYXNzZXMgYXJlIGNvbm5lY3RlZClcbiAgICBjb25zdCBzZWVkU2lkZSA9IGFzeW5jIChlZGdlLCBpdGVyRnVuYykgPT4ge1xuICAgICAgbGV0IGFOb2RlO1xuICAgICAgbGV0IGlzU2VlZGVkID0gZmFsc2U7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZVtpdGVyRnVuY10oKSkge1xuICAgICAgICBhTm9kZSA9IGFOb2RlIHx8IG5vZGU7XG4gICAgICAgIGlmIChub2Rlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgaXNTZWVkZWQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIWlzU2VlZGVkICYmIGFOb2RlKSB7XG4gICAgICAgIGV4dHJhTm9kZXNbYU5vZGUuaW5zdGFuY2VJZF0gPSBhTm9kZTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGZvciAoY29uc3QgZWRnZSBvZiBPYmplY3QudmFsdWVzKGVkZ2VzKSkge1xuICAgICAgYXdhaXQgc2VlZFNpZGUoZWRnZSwgJ3NvdXJjZU5vZGVzJyk7XG4gICAgICBhd2FpdCBzZWVkU2lkZShlZGdlLCAndGFyZ2V0Tm9kZXMnKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgYW55IGVkZ2VzIHRoYXQgZXhpc3QgdGhhdCBjb25uZWN0IGFueSBvZiB0aGUgY29yZSBub2Rlc1xuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBPYmplY3QudmFsdWVzKG5vZGVzKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIG5vZGUuZWRnZXMoKSkge1xuICAgICAgICBpZiAoIWVkZ2VzW2VkZ2UuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAvLyBDaGVjayB0aGF0IGJvdGggZW5kcyBvZiB0aGUgZWRnZSBjb25uZWN0IGF0IGxlYXN0IG9uZVxuICAgICAgICAgIC8vIG9mIG91ciBub2Rlc1xuICAgICAgICAgIGxldCBjb25uZWN0c1NvdXJjZSA9IGZhbHNlO1xuICAgICAgICAgIGxldCBjb25uZWN0c1RhcmdldCA9IGZhbHNlO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2Rlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzU291cmNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2Rlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzVGFyZ2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjb25uZWN0c1NvdXJjZSAmJiBjb25uZWN0c1RhcmdldCkge1xuICAgICAgICAgICAgZXh0cmFFZGdlc1tlZGdlLmluc3RhbmNlSWRdID0gZWRnZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBdCB0aGlzIHBvaW50IHdlIGhhdmUgYSBjb21wbGV0ZSBzZXQgb2Ygbm9kZXMgYW5kIGVkZ2VzIHRoYXQgd2Ugd2FudCB0b1xuICAgIC8vIGluY2x1ZGUuIFdlIGp1c3QgbmVlZCB0byBtZXJnZSBhbmQgdmFsaWRhdGUgdGhlIHNhbXBsZXM6XG4gICAgaW5zdGFuY2VzID0gT2JqZWN0LmFzc2lnbih7fSwgbm9kZXMsIGVkZ2VzLCBleHRyYU5vZGVzLCBleHRyYUVkZ2VzKTtcbiAgICByZXR1cm4gdGhpcy52YWxpZGF0ZUluc3RhbmNlU2FtcGxlKGluc3RhbmNlcyk7XG4gIH1cbiAgYXN5bmMgaW5zdGFuY2VTYW1wbGVUb0dyYXBoIChpbnN0YW5jZXMpIHtcbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdXG4gICAgfTtcblxuICAgIGNvbnN0IHsgbm9kZXMsIGVkZ2VzIH0gPSB0aGlzLnBhcnRpdGlvbkluc3RhbmNlU2FtcGxlKGluc3RhbmNlcyk7XG5cbiAgICAvLyBNYWtlIGEgbGlzdCBvZiBub2RlcywgcGx1cyBhIGxvb2t1cCB0byBlYWNoIG5vZGUncyBpbmRleFxuICAgIGZvciAoY29uc3QgW2luc3RhbmNlSWQsIG5vZGVdIG9mIE9iamVjdC5lbnRyaWVzKG5vZGVzKSkge1xuICAgICAgZ3JhcGgubm9kZUxvb2t1cFtpbnN0YW5jZUlkXSA9IGdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICBub2RlSW5zdGFuY2U6IG5vZGUsXG4gICAgICAgIGR1bW15OiBmYWxzZVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGFsbCB0aGUgZWRnZXMsIGluY2x1ZGluZyBkdW1teSBub2RlcyBmb3IgZGFuZ2xpbmcgZWRnZXNcbiAgICBmb3IgKGNvbnN0IGVkZ2Ugb2YgT2JqZWN0LnZhbHVlcyhlZGdlcykpIHtcbiAgICAgIGlmICghZWRnZS5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmICghZWRnZS5jbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgLy8gTWlzc2luZyBib3RoIHNvdXJjZSBhbmQgdGFyZ2V0IGNsYXNzZXM7IGFkZCBkdW1teSBub2RlcyBmb3IgYm90aCBlbmRzXG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoICsgMVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQWRkIGR1bW15IHNvdXJjZSBub2Rlc1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIWVkZ2UuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAvLyBBZGQgZHVtbXkgdGFyZ2V0IG5vZGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdLFxuICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGVyZSBzaG91bGQgYmUgYm90aCBzb3VyY2UgYW5kIHRhcmdldCBub2RlcyBmb3IgZWFjaCBlZGdlXG4gICAgICAgIC8vIChvbmx5IGNyZWF0ZSBkdW1teSBub2RlcyBmb3IgZWRnZXMgdGhhdCBhcmUgYWN0dWFsbHkgZGlzY29ubmVjdGVkKVxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZU5vZGUgb2YgZWRnZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbc291cmNlTm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldE5vZGUgb2YgZWRnZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3RhcmdldE5vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2RlTG9va3VwW3NvdXJjZU5vZGUuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Tm9kZS5pbnN0YW5jZUlkXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXROZXR3b3JrTW9kZWxHcmFwaCAoe1xuICAgIHJhdyA9IHRydWUsXG4gICAgaW5jbHVkZUR1bW1pZXMgPSBmYWxzZSxcbiAgICBjbGFzc0xpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcylcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICBsZXQgZ3JhcGggPSB7XG4gICAgICBjbGFzc2VzOiBbXSxcbiAgICAgIGNsYXNzTG9va3VwOiB7fSxcbiAgICAgIGNsYXNzQ29ubmVjdGlvbnM6IFtdXG4gICAgfTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgY2xhc3NMaXN0KSB7XG4gICAgICAvLyBBZGQgYW5kIGluZGV4IHRoZSBjbGFzcyBhcyBhIG5vZGVcbiAgICAgIGNvbnN0IGNsYXNzU3BlYyA9IHJhdyA/IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpIDogeyBjbGFzc09iaiB9O1xuICAgICAgY2xhc3NTcGVjLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGguY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBncmFwaC5jbGFzc2VzLmxlbmd0aDtcbiAgICAgIGdyYXBoLmNsYXNzZXMucHVzaChjbGFzc1NwZWMpO1xuXG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIC8vIFN0b3JlIHRoZSBlZGdlIGNsYXNzIHNvIHdlIGNhbiBjcmVhdGUgY2xhc3NDb25uZWN0aW9ucyBsYXRlclxuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnICYmIGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IG5vZGVcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7Y2xhc3NPYmouY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGggLSAxLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGZhbHNlLFxuICAgICAgICAgIGxvY2F0aW9uOiAnbm9kZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENyZWF0ZSBleGlzdGluZyBjbGFzc0Nvbm5lY3Rpb25zXG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZUNsYXNzZXMpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDb25uZWN0IHRoZSBzb3VyY2Ugbm9kZSBjbGFzcyB0byB0aGUgZWRnZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZH0+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBzb3VyY2UgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYGR1bW15PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDb25uZWN0IHRoZSBlZGdlIGNsYXNzIHRvIHRoZSB0YXJnZXQgbm9kZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+JHtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnRhcmdldENsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSB0YXJnZXQgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGggKCkge1xuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgdGFibGVzOiBbXSxcbiAgICAgIHRhYmxlTG9va3VwOiB7fSxcbiAgICAgIHRhYmxlTGlua3M6IFtdXG4gICAgfTtcbiAgICBjb25zdCB0YWJsZUxpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKTtcbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgY29uc3QgdGFibGVTcGVjID0gdGFibGUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZVNwZWMudHlwZSA9IHRhYmxlLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGdyYXBoLnRhYmxlcy5sZW5ndGg7XG4gICAgICBncmFwaC50YWJsZXMucHVzaCh0YWJsZVNwZWMpO1xuICAgIH1cbiAgICAvLyBGaWxsIHRoZSBncmFwaCB3aXRoIGxpbmtzIGJhc2VkIG9uIHBhcmVudFRhYmxlcy4uLlxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRhYmxlLnBhcmVudFRhYmxlcykge1xuICAgICAgICBncmFwaC50YWJsZUxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogZ3JhcGgudGFibGVMb29rdXBbcGFyZW50VGFibGUudGFibGVJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE1vZGVsRHVtcCAoKSB7XG4gICAgLy8gQmVjYXVzZSBvYmplY3Qga2V5IG9yZGVycyBhcmVuJ3QgZGV0ZXJtaW5pc3RpYywgaXQgY2FuIGJlIHByb2JsZW1hdGljXG4gICAgLy8gZm9yIHRlc3RpbmcgKGJlY2F1c2UgaWRzIGNhbiByYW5kb21seSBjaGFuZ2UgZnJvbSB0ZXN0IHJ1biB0byB0ZXN0IHJ1bikuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzb3J0cyBlYWNoIGtleSwgYW5kIGp1c3QgcmVwbGFjZXMgSURzIHdpdGggaW5kZXggbnVtYmVyc1xuICAgIGNvbnN0IHJhd09iaiA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodGhpcy5fdG9SYXdPYmplY3QoKSkpO1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGNsYXNzZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLmNsYXNzZXMpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgYUhhc2ggPSB0aGlzLmNsYXNzZXNbYS5jbGFzc0lkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBjb25zdCBiSGFzaCA9IHRoaXMuY2xhc3Nlc1tiLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgdGFibGVzOiBPYmplY3QudmFsdWVzKHJhd09iai50YWJsZXMpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgYUhhc2ggPSB0aGlzLnRhYmxlc1thLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy50YWJsZXNbYi50YWJsZUlkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBpZiAoYUhhc2ggPCBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIGlmIChhSGFzaCA+IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YWJsZSBoYXNoIGNvbGxpc2lvbmApO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH07XG4gICAgY29uc3QgY2xhc3NMb29rdXAgPSB7fTtcbiAgICBjb25zdCB0YWJsZUxvb2t1cCA9IHt9O1xuICAgIHJlc3VsdC5jbGFzc2VzLmZvckVhY2goKGNsYXNzT2JqLCBpbmRleCkgPT4ge1xuICAgICAgY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBpbmRleDtcbiAgICB9KTtcbiAgICByZXN1bHQudGFibGVzLmZvckVhY2goKHRhYmxlLCBpbmRleCkgPT4ge1xuICAgICAgdGFibGVMb29rdXBbdGFibGUudGFibGVJZF0gPSBpbmRleDtcbiAgICB9KTtcblxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgcmVzdWx0LnRhYmxlcykge1xuICAgICAgdGFibGUudGFibGVJZCA9IHRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpKSB7XG4gICAgICAgIHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVMb29rdXBbdGFibGVJZF1dID0gdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgICAgZGVsZXRlIHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVJZF07XG4gICAgICB9XG4gICAgICBkZWxldGUgdGFibGUuZGF0YTsgLy8gZG9uJ3QgaW5jbHVkZSBhbnkgb2YgdGhlIGRhdGE7IHdlIGp1c3Qgd2FudCB0aGUgbW9kZWwgc3RydWN0dXJlXG4gICAgfVxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgcmVzdWx0LmNsYXNzZXMpIHtcbiAgICAgIGNsYXNzT2JqLmNsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXTtcbiAgICAgIGNsYXNzT2JqLnRhYmxlSWQgPSB0YWJsZUxvb2t1cFtjbGFzc09iai50YWJsZUlkXTtcbiAgICAgIGlmIChjbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai5zb3VyY2VUYWJsZUlkcykge1xuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcyA9IGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHRhYmxlTG9va3VwW3RhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldENsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai50YXJnZXRDbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcyA9IGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHRhYmxlTG9va3VwW3RhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgY2xhc3NJZCBvZiBPYmplY3Qua2V5cyhjbGFzc09iai5lZGdlQ2xhc3NJZHMgfHwge30pKSB7XG4gICAgICAgIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0xvb2t1cFtjbGFzc0lkXV0gPSBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICAgIGRlbGV0ZSBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgY3JlYXRlU2NoZW1hTW9kZWwgKCkge1xuICAgIGNvbnN0IGdyYXBoID0gdGhpcy5nZXRNb2RlbER1bXAoKTtcblxuICAgIGdyYXBoLnRhYmxlcy5mb3JFYWNoKHRhYmxlID0+IHtcbiAgICAgIHRhYmxlLmRlcml2ZWRUYWJsZXMgPSBPYmplY3Qua2V5cyh0YWJsZS5kZXJpdmVkVGFibGVzKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ld01vZGVsID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlTW9kZWwoeyBuYW1lOiB0aGlzLm5hbWUgKyAnX3NjaGVtYScgfSk7XG4gICAgY29uc3QgcmF3ID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGgsXG4gICAgICBuYW1lOiAnUmF3IER1bXAnXG4gICAgfSk7XG4gICAgbGV0IFsgY2xhc3NlcywgdGFibGVzIF0gPSByYXcuY2xvc2VkVHJhbnNwb3NlKFsnY2xhc3NlcycsICd0YWJsZXMnXSk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgIGNsYXNzZXMuc2V0Q2xhc3NOYW1lKCdDbGFzc2VzJyk7XG4gICAgcmF3LmRlbGV0ZSgpO1xuXG4gICAgY29uc3Qgc291cmNlQ2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAnc291cmNlQ2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHNvdXJjZUNsYXNzZXMuc2V0Q2xhc3NOYW1lKCdTb3VyY2UgQ2xhc3MnKTtcbiAgICBzb3VyY2VDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuICAgIGNvbnN0IHRhcmdldENsYXNzZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogY2xhc3NlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhcmdldENsYXNzSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICB0YXJnZXRDbGFzc2VzLnNldENsYXNzTmFtZSgnVGFyZ2V0IENsYXNzJyk7XG4gICAgdGFyZ2V0Q2xhc3Nlcy50b2dnbGVEaXJlY3Rpb24oKTtcblxuICAgIHRhYmxlcyA9IHRhYmxlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgdGFibGVzLnNldENsYXNzTmFtZSgnVGFibGVzJyk7XG5cbiAgICBjb25zdCB0YWJsZURlcGVuZGVuY2llcyA9IHRhYmxlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ2Rlcml2ZWRUYWJsZXMnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICB0YWJsZURlcGVuZGVuY2llcy5zZXRDbGFzc05hbWUoJ0lzIFBhcmVudCBPZicpO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgY29uc3QgY29yZVRhYmxlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YWJsZUlkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgY29yZVRhYmxlcy5zZXRDbGFzc05hbWUoJ0NvcmUgVGFibGUnKTtcbiAgICByZXR1cm4gbmV3TW9kZWw7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE5ldHdvcmtNb2RlbDtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IE5ldHdvcmtNb2RlbCBmcm9tICcuL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMnO1xuXG5sZXQgTkVYVF9NT0RFTF9JRCA9IDE7XG5cbmNsYXNzIE9yaWdyYXBoIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAobG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gb25seSBkZWZpbmVkIGluIHRoZSBicm93c2VyIGNvbnRleHRcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICBsZXQgZXhpc3RpbmdNb2RlbHMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnKTtcbiAgICBpZiAoZXhpc3RpbmdNb2RlbHMpIHtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyhKU09OLnBhcnNlKGV4aXN0aW5nTW9kZWxzKSkpIHtcbiAgICAgICAgbW9kZWwub3JpZ3JhcGggPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsc1ttb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwobW9kZWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgfVxuICByZWdpc3RlclBsdWdpbiAobmFtZSwgcGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW5zW25hbWVdID0gcGx1Z2luO1xuICB9XG4gIHNhdmUgKCkge1xuICAgIC8qXG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH1cbiAgICAqL1xuICB9XG4gIGNsb3NlQ3VycmVudE1vZGVsICgpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBnZXQgY3VycmVudE1vZGVsICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbdGhpcy5fY3VycmVudE1vZGVsSWRdIHx8IG51bGw7XG4gIH1cbiAgc2V0IGN1cnJlbnRNb2RlbCAobW9kZWwpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG1vZGVsID8gbW9kZWwubW9kZWxJZCA6IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBhc3luYyBsb2FkTW9kZWwgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuY3JlYXRlTW9kZWwoeyBtb2RlbElkOiBvcHRpb25zLm5hbWUgfSk7XG4gICAgYXdhaXQgbmV3TW9kZWwuYWRkVGV4dEZpbGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG4gIGNyZWF0ZU1vZGVsIChvcHRpb25zID0ge30pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMubW9kZWxJZCB8fCB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdKSB7XG4gICAgICBvcHRpb25zLm1vZGVsSWQgPSBgbW9kZWwke05FWFRfTU9ERUxfSUR9YDtcbiAgICAgIE5FWFRfTU9ERUxfSUQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5vcmlncmFwaCA9IHRoaXM7XG4gICAgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwob3B0aW9ucyk7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBvcHRpb25zLm1vZGVsSWQ7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXTtcbiAgfVxuICBkZWxldGVNb2RlbCAobW9kZWxJZCA9IHRoaXMuY3VycmVudE1vZGVsSWQpIHtcbiAgICBpZiAoIXRoaXMubW9kZWxzW21vZGVsSWRdKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBub24tZXhpc3RlbnQgbW9kZWw6ICR7bW9kZWxJZH1gKTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWxzW21vZGVsSWRdO1xuICAgIGlmICh0aGlzLl9jdXJyZW50TW9kZWxJZCA9PT0gbW9kZWxJZCkge1xuICAgICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICB9XG4gICAgdGhpcy5zYXZlKCk7XG4gIH1cbiAgZGVsZXRlQWxsTW9kZWxzICgpIHtcbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE9yaWdyYXBoO1xuIiwiaW1wb3J0IE9yaWdyYXBoIGZyb20gJy4vT3JpZ3JhcGguanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgb3JpZ3JhcGggPSBuZXcgT3JpZ3JhcGgod2luZG93LmxvY2FsU3RvcmFnZSk7XG5vcmlncmFwaC52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG9yaWdyYXBoO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJfZXZlbnRIYW5kbGVycyIsIl9zdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJldmVudCIsIm5hbWVzcGFjZSIsInNwbGl0IiwicHVzaCIsIm9mZiIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiaGFuZGxlQ2FsbGJhY2siLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiR2VuZXJpY1dyYXBwZXIiLCJvcHRpb25zIiwidGFibGUiLCJ1bmRlZmluZWQiLCJFcnJvciIsImNsYXNzT2JqIiwicm93IiwiY29ubmVjdGVkSXRlbXMiLCJkdXBsaWNhdGVJdGVtcyIsInJlZ2lzdGVyRHVwbGljYXRlIiwiaXRlbSIsImNvbm5lY3RJdGVtIiwidGFibGVJZCIsImR1cCIsImRpc2Nvbm5lY3QiLCJpdGVtTGlzdCIsInZhbHVlcyIsImluc3RhbmNlSWQiLCJjbGFzc0lkIiwiZXhwb3J0SWQiLCJsYWJlbCIsImFubm90YXRpb25zIiwibGFiZWxBdHRyIiwiZXF1YWxzIiwiaGFuZGxlTGltaXQiLCJpdGVyYXRvcnMiLCJsaW1pdCIsIkluZmluaXR5IiwiaXRlcmF0b3IiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJtb2RlbCIsInRhYmxlcyIsImJ1aWxkQ2FjaGUiLCJfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwicmVzZXQiLCJuZXh0VGFibGVJZCIsImxlbmd0aCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX2xpbWl0UHJvbWlzZXMiLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwiZnVuYyIsImdldFNvcnRIYXNoIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIml0ZXJhdGUiLCJfY2FjaGUiLCJfcGFydGlhbENhY2hlIiwicmVzb2x2ZSIsInJlamVjdCIsIl9pdGVyYXRlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlTG9va3VwIiwiZG9uZSIsIm5leHQiLCJoYW5kbGVSZXNldCIsIl9maW5pc2hJdGVtIiwiTnVtYmVyIiwiX2NhY2hlTG9va3VwIiwiX2NhY2hlUHJvbWlzZSIsIml0ZW1zVG9SZXNldCIsImNvbmNhdCIsImRlcml2ZWRUYWJsZSIsImNvdW50Um93cyIsIndyYXBwZWRJdGVtIiwiZGVsYXllZFJvdyIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZ2V0SW5kZXhEZXRhaWxzIiwiZGV0YWlscyIsInN1cHByZXNzZWQiLCJmaWx0ZXJlZCIsImdldEF0dHJpYnV0ZURldGFpbHMiLCJhbGxBdHRycyIsImV4cGVjdGVkIiwib2JzZXJ2ZWQiLCJkZXJpdmVkIiwiY3VycmVudERhdGEiLCJkYXRhIiwibG9va3VwIiwiY29tcGxldGUiLCJfZ2V0SXRlbSIsImdldEl0ZW0iLCJnZXRSYW5kb21JdGVtIiwicmFuZEluZGV4IiwiTWF0aCIsImZsb29yIiwicmFuZG9tIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwidW5TdXBwcmVzc2VkQXR0cmlidXRlcyIsImZpbHRlciIsInN1cHByZXNzQXR0cmlidXRlIiwidW5TdXBwcmVzc0F0dHJpYnV0ZSIsImFkZEZpbHRlciIsIl9kZXJpdmVUYWJsZSIsIm5ld1RhYmxlIiwiY3JlYXRlVGFibGUiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGUiLCJmaW5kIiwidGFibGVPYmoiLCJldmVyeSIsIm9wdGlvbk5hbWUiLCJvcHRpb25WYWx1ZSIsInByb21vdGUiLCJleHBhbmQiLCJ1bnJvbGwiLCJjbG9zZWRGYWNldCIsIm9wZW5GYWNldCIsImNsb3NlZFRyYW5zcG9zZSIsImluZGV4ZXMiLCJvcGVuVHJhbnNwb3NlIiwiZHVwbGljYXRlIiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0Iiwib3RoZXJUYWJsZSIsInByb2plY3QiLCJ0YWJsZU9yZGVyIiwib3RoZXJUYWJsZUlkIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJmb3JjZSIsImVyciIsInBhcmVudFRhYmxlIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQXR0clRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkF0dHJUYWJsZU1peGluIiwiX2F0dHJpYnV0ZSIsIlByb21vdGVkVGFibGUiLCJfdW5maW5pc2hlZENhY2hlIiwiX3VuZmluaXNoZWRDYWNoZUxvb2t1cCIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicFRhYmxlIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJEdXBsaWNhdGVkVGFibGUiLCJDaGlsZFRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpbiIsInBhcmVudEluZGV4IiwiRXhwYW5kZWRUYWJsZSIsIlVucm9sbGVkVGFibGUiLCJyb3dzIiwiUGFyZW50Q2hpbGRUYWJsZSIsImNoaWxkVGFibGUiLCJjaGlsZCIsInBhcmVudCIsIlByb2plY3RlZFRhYmxlIiwic2VsZiIsImZpcnN0VGFibGUiLCJyZW1haW5pbmdJZHMiLCJzb3VyY2VJdGVtIiwibGFzdEl0ZW0iLCJHZW5lcmljQ2xhc3MiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwic2V0Q2xhc3NOYW1lIiwic2V0QW5ub3RhdGlvbiIsImtleSIsImRlbGV0ZUFubm90YXRpb24iLCJoYXNDdXN0b21OYW1lIiwidmFyaWFibGVOYW1lIiwiZCIsInRvTG9jYWxlVXBwZXJDYXNlIiwiZGVsZXRlZCIsImludGVycHJldEFzTm9kZXMiLCJvdmVyd3JpdGUiLCJjcmVhdGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJpbnRlcHJldEFzR2VuZXJpYyIsIm9wdGltaXplVGFibGVzIiwiY291bnRBbGxVbmlxdWVWYWx1ZXMiLCJoYXNoYWJsZUJpbnMiLCJ1bkhhc2hhYmxlQ291bnRzIiwiaW5kZXhCaW4iLCJOb2RlV3JhcHBlciIsImVkZ2VzIiwiZWRnZUlkcyIsImNsYXNzSWRzIiwiZWRnZUNsYXNzSWRzIiwiZWRnZUlkIiwiZWRnZUNsYXNzIiwicm9sZSIsImdldEVkZ2VSb2xlIiwicmV2ZXJzZSIsIm5laWdoYm9yTm9kZXMiLCJlZGdlIiwidGFyZ2V0Tm9kZXMiLCJ0YXJnZXQiLCJzb3VyY2VOb2RlcyIsInNvdXJjZSIsIm5laWdoYm9ycyIsInBhaXJ3aXNlTmVpZ2hib3Job29kIiwiTm9kZUNsYXNzIiwiZWRnZUNsYXNzZXMiLCJlZGdlQ2xhc3NJZCIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiYXV0b2Nvbm5lY3QiLCJkaXNjb25uZWN0QWxsRWRnZXMiLCJpc1NvdXJjZSIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0Iiwibm9kZUNsYXNzIiwidGFibGVJZExpc3QiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsInRhcmdldEVkZ2VDbGFzcyIsImludGVycHJldEFzR2VuZXJpYyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibmV3Tm9kZUNsYXNzIiwiY3JlYXRlU3VwZXJub2RlcyIsImV4aXN0aW5nRWRnZUNsYXNzSWRzIiwicHJvamVjdE5ld0VkZ2UiLCJjb25uZWN0VG9DaGlsZE5vZGVDbGFzcyIsImNoaWxkQ2xhc3MiLCJjbGFzc0lkTGlzdCIsImNsYXNzTGlzdCIsImVkZ2VSb2xlIiwiQXJyYXkiLCJmcm9tIiwibmV3Q2xhc3MiLCJjb25uZWN0ZWRDbGFzc2VzIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VUYWJsZUlkIiwidGFyZ2V0VGFibGVJZCIsIm5vZGVzIiwiRWRnZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsIl9zcGxpdFRhYmxlSWRMaXN0Iiwib3RoZXJDbGFzcyIsIm5vZGVUYWJsZUlkTGlzdCIsImVkZ2VUYWJsZUlkIiwiZWRnZVRhYmxlSWRMaXN0Iiwic3RhdGljRXhpc3RzIiwidGFibGVEaXN0YW5jZXMiLCJzdGFydHNXaXRoIiwiZGlzdCIsImFicyIsInNvcnQiLCJhIiwiYiIsInNpZGUiLCJjb25uZWN0U291cmNlIiwiY29ubmVjdFRhcmdldCIsInRvZ2dsZURpcmVjdGlvbiIsInN3YXBwZWREaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImVkZ2VIYXNoIiwibm9kZUhhc2giLCJ1bnNoaWZ0IiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJyb2xsdXAiLCJjb25uZWN0RmFjZXRlZENsYXNzIiwibmV3Q2xhc3NlcyIsIkZpbGVGb3JtYXQiLCJidWlsZFJvdyIsIlBhcnNlRmFpbHVyZSIsImZpbGVGb3JtYXQiLCJOT0RFX05BTUVTIiwiRURHRV9OQU1FUyIsIkQzSnNvbiIsImltcG9ydERhdGEiLCJ0ZXh0Iiwic291cmNlQXR0cmlidXRlIiwidGFyZ2V0QXR0cmlidXRlIiwiY2xhc3NBdHRyaWJ1dGUiLCJKU09OIiwicGFyc2UiLCJub2RlTmFtZSIsImVkZ2VOYW1lIiwiY29yZVRhYmxlIiwiY29yZUNsYXNzIiwibm9kZUNsYXNzZXMiLCJub2RlQ2xhc3NMb29rdXAiLCJzYW1wbGUiLCJzb3VyY2VDbGFzc05hbWUiLCJ0YXJnZXRDbGFzc05hbWUiLCJmb3JtYXREYXRhIiwiaW5jbHVkZUNsYXNzZXMiLCJwcmV0dHkiLCJsaW5rcyIsIm5vZGVMb29rdXAiLCJvdGhlciIsIm5vZGUiLCJzdHJpbmdpZnkiLCJCdWZmZXIiLCJleHRlbnNpb24iLCJDc3ZaaXAiLCJpbmRleE5hbWUiLCJ6aXAiLCJKU1ppcCIsImNvbnRlbnRzIiwiZmlsZSIsImdlbmVyYXRlQXN5bmMiLCJlc2NhcGVDaGFycyIsIkdFWEYiLCJlc2NhcGUiLCJzdHIiLCJyZXBsIiwiZXhwIiwibm9kZUNodW5rIiwiZWRnZUNodW5rIiwiREFUQUxJQl9GT1JNQVRTIiwiTmV0d29ya01vZGVsIiwib3JpZ3JhcGgiLCJtb2RlbElkIiwiX29yaWdyYXBoIiwiX25leHRDbGFzc0lkIiwiX25leHRUYWJsZUlkIiwiaHlkcmF0ZSIsIkNMQVNTRVMiLCJUQUJMRVMiLCJfc2F2ZVRpbWVvdXQiLCJzYXZlIiwidW5zYXZlZCIsInJhd09iamVjdCIsIlRZUEVTIiwiZmluZENsYXNzIiwicmVuYW1lIiwibmV3TmFtZSIsImFubm90YXRlIiwiZGVsZXRlTW9kZWwiLCJtb2RlbHMiLCJhZGRUZXh0RmlsZSIsImZvcm1hdCIsIm1pbWUiLCJGSUxFX0ZPUk1BVFMiLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNUYWJsZSIsInRhYmxlc0luVXNlIiwicGFyZW50c1Zpc2l0ZWQiLCJxdWV1ZSIsInNoaWZ0IiwiZ2V0SW5zdGFuY2VTYW1wbGUiLCJzZWVkTGltaXQiLCJjbHVzdGVyTGltaXQiLCJjbGFzc0NvdW50IiwiaXRlcmF0aW9uUmVzZXQiLCJpbnN0YW5jZXMiLCJ0b3RhbENvdW50IiwiY2xhc3NDb3VudHMiLCJwb3B1bGF0ZUNsYXNzQ291bnRzIiwiaW5zdGFuY2UiLCJuZWlnaGJvciIsInJvd0NvdW50IiwidmFsaWRhdGVJbnN0YW5jZVNhbXBsZSIsInVwZGF0ZUluc3RhbmNlU2FtcGxlIiwibmV3SW5zdGFuY2UiLCJwYXJ0aXRpb25JbnN0YW5jZVNhbXBsZSIsImdlbmVyaWNzIiwiZmlsbEluc3RhbmNlU2FtcGxlIiwiZXh0cmFOb2RlcyIsImV4dHJhRWRnZXMiLCJzZWVkU2lkZSIsIml0ZXJGdW5jIiwiYU5vZGUiLCJpc1NlZWRlZCIsImNvbm5lY3RzU291cmNlIiwiY29ubmVjdHNUYXJnZXQiLCJpbnN0YW5jZVNhbXBsZVRvR3JhcGgiLCJncmFwaCIsIm5vZGVJbnN0YW5jZSIsImR1bW15IiwiZWRnZUluc3RhbmNlIiwic291cmNlTm9kZSIsInRhcmdldE5vZGUiLCJnZXROZXR3b3JrTW9kZWxHcmFwaCIsInJhdyIsImluY2x1ZGVEdW1taWVzIiwiY2xhc3NMb29rdXAiLCJjbGFzc0Nvbm5lY3Rpb25zIiwiY2xhc3NTcGVjIiwiaWQiLCJsb2NhdGlvbiIsImdldFRhYmxlRGVwZW5kZW5jeUdyYXBoIiwidGFibGVMb29rdXAiLCJ0YWJsZUxpbmtzIiwidGFibGVMaXN0IiwidGFibGVTcGVjIiwiZ2V0TW9kZWxEdW1wIiwicmF3T2JqIiwiYUhhc2giLCJiSGFzaCIsImNyZWF0ZVNjaGVtYU1vZGVsIiwibmV3TW9kZWwiLCJjcmVhdGVNb2RlbCIsInNvdXJjZUNsYXNzZXMiLCJ0YXJnZXRDbGFzc2VzIiwidGFibGVEZXBlbmRlbmNpZXMiLCJjb3JlVGFibGVzIiwiTkVYVF9NT0RFTF9JRCIsIk9yaWdyYXBoIiwibG9jYWxTdG9yYWdlIiwicGx1Z2lucyIsImV4aXN0aW5nTW9kZWxzIiwiX2N1cnJlbnRNb2RlbElkIiwicmVnaXN0ZXJQbHVnaW4iLCJwbHVnaW4iLCJjbG9zZUN1cnJlbnRNb2RlbCIsImN1cnJlbnRNb2RlbCIsImxvYWRNb2RlbCIsImN1cnJlbnRNb2RlbElkIiwiZGVsZXRlQWxsTW9kZWxzIiwid2luZG93IiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxjQUFMLEdBQXNCLEVBQXRCO1dBQ0tDLGVBQUwsR0FBdUIsRUFBdkI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNuQixDQUFDQyxLQUFELEVBQVFDLFNBQVIsSUFBcUJILFNBQVMsQ0FBQ0ksS0FBVixDQUFnQixHQUFoQixDQUF6QjtXQUNLUCxjQUFMLENBQW9CSyxLQUFwQixJQUE2QixLQUFLTCxjQUFMLENBQW9CSyxLQUFwQixLQUMzQjtZQUFNO09BRFI7O1VBRUksQ0FBQ0MsU0FBTCxFQUFnQjthQUNUTixjQUFMLENBQW9CSyxL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
