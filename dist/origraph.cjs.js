'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var FileReader = _interopDefault(require('filereader'));

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
  }

  connectItem(item) {
    this.connectedItems[item.table.tableId] = this.connectedItems[item.table.tableId] || [];

    if (this.connectedItems[item.table.tableId].indexOf(item) === -1) {
      this.connectedItems[item.table.tableId].push(item);
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
    return `${this.classObj.classId}_${this.index}`;
  }

  equals(item) {
    return this.instanceId === item.instanceId;
  }

  iterateAcrossConnections({
    tableIds,
    limit = Infinity
  }) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // First make sure that all the table caches have been fully built and
      // connected
      yield _awaitAsyncGenerator(Promise.all(tableIds.map(tableId => {
        return _this.classObj.model.tables[tableId].buildCache();
      })));
      let i = 0;

      for (const item of _this._iterateAcrossConnections(tableIds)) {
        yield item;
        i++;

        if (i >= limit) {
          return;
        }
      }
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
  }

  _toRawObject() {
    const result = {
      tableId: this.tableId,
      attributes: this._attributes,
      derivedTables: this._derivedTables,
      usedByClasses: this._usedByClasses,
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

  hydrateFunction(stringifiedFunc) {
    new Function(`return ${stringifiedFunc}`)(); // eslint-disable-line no-new-func
  }

  dehydrateFunction(func) {
    let stringifiedFunc = func.toString(); // Istanbul adds some code to functions for computing coverage, that gets
    // included in the stringification process during testing. See:
    // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022

    stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
    return stringifiedFunc;
  }

  iterate(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Generic caching stuff; this isn't just for performance. ConnectedTable's
      // algorithm requires that its parent tables have pre-built indexes (we
      // technically could implement it differently, but it would be expensive,
      // requires tricky logic, and we're already building indexes for some tables
      // like AggregatedTable anyway)
      if (options.reset) {
        _this.reset();
      }

      if (_this._cache) {
        const limit = options.limit === undefined ? Infinity : options.limit;
        yield* _asyncGeneratorDelegate(_asyncIterator(Object.values(_this._cache).slice(0, limit)), _awaitAsyncGenerator);
        return;
      }

      yield* _asyncGeneratorDelegate(_asyncIterator((yield _awaitAsyncGenerator(_this._buildCache(options)))), _awaitAsyncGenerator);
    })();
  }

  _buildCache(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      // TODO: in large data scenarios, we should build the cache / index
      // externally on disk
      _this2._partialCache = {};
      const limit = options.limit === undefined ? Infinity : options.limit;
      delete options.limit;

      const iterator = _this2._iterate(options);

      let completed = false;

      for (let i = 0; i < limit; i++) {
        const temp = yield _awaitAsyncGenerator(iterator.next());

        if (!_this2._partialCache) {
          // iteration was cancelled; return immediately
          return;
        }

        if (temp.done) {
          completed = true;
          break;
        } else {
          _this2._finishItem(temp.value);

          _this2._partialCache[temp.value.index] = temp.value;
          yield temp.value;
        }
      }

      if (completed) {
        _this2._cache = _this2._partialCache;
      }

      delete _this2._partialCache;
    })();
  }

  _iterate(options) {
    return _wrapAsyncGenerator(function* () {
      throw new Error(`this function should be overridden`);
    })();
  }

  _finishItem(wrappedItem) {
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
      keep = keep && func(wrappedItem.row[attr]);

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

  reset() {
    delete this._partialCache;
    delete this._cache;

    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }

    this.trigger('reset');
  }

  get name() {
    throw new Error(`this function should be overridden`);
  }

  async buildCache() {
    if (this._cache) {
      return this._cache;
    } else if (this._cachePromise) {
      return this._cachePromise;
    } else {
      this._cachePromise = new Promise(async (resolve, reject) => {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(this._buildCache()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          } // eslint-disable-line no-unused-vars

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

        delete this._cachePromise;
        resolve(this._cache);
      });
      return this._cachePromise;
    }
  }

  async countRows() {
    const cache = await this.buildCache();
    return cache ? Object.keys(cache).length : -1;
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
    return {
      data: this._cache || this._partialCache || {},
      complete: !!this._cache
    };
  }

  deriveAttribute(attribute, func) {
    this._derivedAttributeFunctions[attribute] = func;
    this.reset();
  }

  suppressAttribute(attribute) {
    if (attribute === null) {
      this._suppressIndex = true;
    } else {
      this._suppressedAttributes[attribute] = true;
    }

    this.reset();
  }

  addFilter(attribute, func) {
    if (attribute === null) {
      this._indexFilter = func;
    } else {
      this._attributeFilters[attribute] = func;
    }

    this.reset();
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

  aggregate(attribute) {
    const options = {
      type: 'AggregatedTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  expand(attribute, delimiter) {
    const options = {
      type: 'ExpandedTable',
      attribute,
      delimiter
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
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      const values = {};
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this3.iterate({
          limit
        })), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedItem = _value2;
          const value = wrappedItem.row[attribute];

          if (!values[value]) {
            values[value] = true;
            const options = {
              type: 'FacetedTable',
              attribute,
              value
            };
            yield _this3._getExistingTable(options) || _this3._deriveTable(options);
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
    var _this4 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator(_this4.iterate({
          limit
        })), _step3, _value3; _step3 = yield _awaitAsyncGenerator(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield _awaitAsyncGenerator(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
          const wrappedItem = _value3;
          const options = {
            type: 'TransposedTable',
            index: wrappedItem.index
          };
          yield _this4._getExistingTable(options) || _this4._deriveTable(options);
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

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (let index = 0; index < _this._data.length; index++) {
        const item = _this._wrap({
          index,
          row: _this._data[index]
        });

        if (_this._finishItem(item)) {
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

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (const [index, row] of Object.entries(_this._data)) {
        const item = _this._wrap({
          index,
          row
        });

        if (_this._finishItem(item)) {
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

class AggregatedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }

    this._reduceAttributeFunctions = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.reduceAttributeFunctions || {})) {
      this._reduceAttributeFunctions[attr] = this.model.hydrateFunction(stringifiedFunc);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.reduceAttributeFunctions = {};

    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      obj.reduceAttributeFunctions[attr] = this.model._dehydrateFunction(func);
    }

    return obj;
  }

  get name() {
    return '↦' + this._attribute;
  }

  deriveReducedAttribute(attr, func) {
    this._reduceAttributeFunctions[attr] = func;
    this.reset();
  }

  _updateItem(originalWrappedItem, newWrappedItem) {
    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      originalWrappedItem.row[attr] = func(originalWrappedItem, newWrappedItem);
    }

    originalWrappedItem.trigger('update');
  }

  _buildCache(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // We override _buildCache because so that AggregatedTable can take advantage
      // of the partially-built cache as it goes, and postpone finishing items
      // until after the parent table has been fully iterated
      // TODO: in large data scenarios, we should build the cache / index
      // externally on disk
      _this._partialCache = {};
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this._iterate(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedItem = _value;
          _this._partialCache[wrappedItem.index] = wrappedItem; // Go ahead and yield the unfinished item; this makes it possible for
          // client apps to be more responsive and render partial results, but also
          // means that they need to watch for wrappedItem.on('update') events

          yield wrappedItem;
        } // Second pass: now that we've completed the full iteration of the parent
        // table, we can finish each item

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

      for (const index in _this._partialCache) {
        const wrappedItem = _this._partialCache[index];

        if (!_this._finishItem(wrappedItem)) {
          delete _this._partialCache[index];
        }
      }

      _this._cache = _this._partialCache;
      delete _this._partialCache;
    })();
  }

  _iterate(options) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      const parentTable = _this2.parentTable;
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(parentTable.iterate(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedParent = _value2;
          const index = String(wrappedParent.row[_this2._attribute]);

          if (!_this2._partialCache) {
            // We were reset; return immediately
            return;
          } else if (_this2._partialCache[index]) {
            const existingItem = _this2._partialCache[index];
            existingItem.connectItem(wrappedParent);
            wrappedParent.connectItem(existingItem);

            _this2._updateItem(existingItem, wrappedParent);
          } else {
            const newItem = _this2._wrap({
              index,
              itemsToConnect: [wrappedParent]
            });

            _this2._updateItem(newItem, wrappedParent);

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
    })();
  }

  getAttributeDetails() {
    const allAttrs = super.getAttributeDetails();

    for (const attr in this._reduceAttributeFunctions) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].reduced = true;
    }

    return allAttrs;
  }

}

class ExpandedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }

    this.delimiter = options.delimiter || ',';
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    return obj;
  }

  get name() {
    return this.parentTable.name + '↤';
  }

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let index = 0;
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const values = (wrappedParent.row[_this._attribute] || '').split(_this.delimiter);

          for (const value of values) {
            const row = {};
            row[_this._attribute] = value;

            const newItem = _this._wrap({
              index,
              row,
              itemsToConnect: [wrappedParent]
            });

            if (_this._finishItem(newItem)) {
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

  get name() {
    return `[${this._value}]`;
  }

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let index = 0;
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if (wrappedParent.row[_this._attribute] === _this._value) {
            // Normal faceting just gives a subset of the original table
            const newItem = _this._wrap({
              index,
              row: Object.assign({}, wrappedParent.row),
              itemsToConnect: [wrappedParent]
            });

            if (_this._finishItem(newItem)) {
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

  get name() {
    return `ᵀ${this._index}`;
  }

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Pre-build the parent table's cache
      const parentTable = _this.parentTable;
      yield _awaitAsyncGenerator(parentTable.buildCache()); // Iterate the row's attributes as indexes

      const wrappedParent = parentTable._cache[_this._index] || {
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

        if (_this._finishItem(newItem)) {
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

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTables = _this.parentTables; // Spin through all of the parentTables so that their _cache is pre-built

      for (const parentTable of parentTables) {
        yield _awaitAsyncGenerator(parentTable.buildCache());
      } // Now that the caches are built, just iterate their keys directly. We only
      // care about including rows that have exact matches across all tables, so
      // we can just pick one parent table to iterate


      const baseParentTable = parentTables[0];
      const otherParentTables = parentTables.slice(1);

      for (const index in baseParentTable._cache) {
        if (!parentTables.every(table => table._cache)) {
          // One of the parent tables was reset; return immediately
          return;
        }

        if (!otherParentTables.every(table => table._cache[index])) {
          // No match in one of the other tables; omit this item
          continue;
        } // TODO: add each parent tables' keys as attribute values


        const newItem = _this._wrap({
          index,
          itemsToConnect: parentTables.map(table => table._cache[index])
        });

        if (_this._finishItem(newItem)) {
          yield newItem;
        }
      }
    })();
  }

}



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDictTable: StaticDictTable,
  AggregatedTable: AggregatedTable,
  ExpandedTable: ExpandedTable,
  FacetedTable: FacetedTable,
  ConnectedTable: ConnectedTable,
  TransposedTable: TransposedTable
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

  get table() {
    return this.model.tables[this.tableId];
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

  aggregate(attribute) {
    return this._deriveNewClass(this.table.aggregate(attribute));
  }

  expand(attribute, delimiter) {
    return this._deriveNewClass(this.table.expand(attribute, delimiter));
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

  edges(options = {
    limit: Infinity
  }) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const edgeIds = options.edgeIds || _this.classObj.edgeClassIds;
      let i = 0;

      for (const edgeId of Object.keys(edgeIds)) {
        const edgeClass = _this.classObj.model.classes[edgeId];

        if (edgeClass.sourceClassId === _this.classObj.classId) {
          options.tableIds = edgeClass.sourceTableIds.slice().reverse().concat([edgeClass.tableId]);
        } else {
          options.tableIds = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]);
        }

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(_this.iterateAcrossConnections(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const item = _value;
            yield item;
            i++;

            if (i >= options.limit) {
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

  pairwiseNeighborhood(options) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this2.edges(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const edge = _value2;
          yield* _asyncGeneratorDelegate(_asyncIterator(edge.pairwiseEdges(options)), _awaitAsyncGenerator);
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

}

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.edgeClassIds = options.edgeClassIds || {};
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
  }) {
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


      options.sourceClassId = sourceEdgeClass.classId;
      options.targetClassId = targetEdgeClass.classId; // Add this class to the source's / target's edgeClassIds

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
      thisHash = this.table.aggregate(attribute);
      sourceTableIds = [thisHash.tableId];
    }

    if (otherAttribute === null) {
      otherHash = otherNodeClass.table;
      targetTableIds = [];
    } else {
      otherHash = otherNodeClass.table.aggregate(otherAttribute);
      targetTableIds = [otherHash.tableId];
    } // If we have a self edge connecting the same attribute, we can just use
    // the AggregatedTable as the edge table; otherwise we need to create a
    // ConnectedTable


    const connectedTable = this === otherNodeClass && attribute === otherAttribute ? thisHash : thisHash.connect([otherHash]);
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

  aggregate(attribute) {
    const newNodeClass = super.aggregate(attribute);
    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });
    return newNodeClass;
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
      if (_this.classObj.sourceClassId === null) {
        return;
      }

      const sourceTableId = _this.classObj.model.classes[_this.classObj.sourceClassId].tableId;
      options.tableIds = _this.classObj.sourceTableIds.concat([sourceTableId]);
      yield* _asyncGeneratorDelegate(_asyncIterator(_this.iterateAcrossConnections(options)), _awaitAsyncGenerator);
    })();
  }

  targetNodes(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      if (_this2.classObj.targetClassId === null) {
        return;
      }

      const targetTableId = _this2.classObj.model.classes[_this2.classObj.targetClassId].tableId;
      options.tableIds = _this2.classObj.targetTableIds.concat([targetTableId]);
      yield* _asyncGeneratorDelegate(_asyncIterator(_this2.iterateAcrossConnections(options)), _awaitAsyncGenerator);
    })();
  }

  pairwiseEdges(options) {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this3.sourceNodes(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const source = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator(_this3.targetNodes(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const target = _value2;
              yield {
                source,
                edge: _this3,
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

  async hyperedge(options) {
    const result = {
      sources: [],
      targets: [],
      edge: this
    };
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;

    var _iteratorError3;

    try {
      for (var _iterator3 = _asyncIterator(this.sourceNodes(options)), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
        const source = _value3;
        result.push(source);
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
      for (var _iterator4 = _asyncIterator(this.targetNodes(options)), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
        const target = _value4;
        result.push(target);
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
    const edgeHash = edgeAttribute === null ? this.table : this.table.aggregate(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.table.aggregate(nodeAttribute);
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
    const edgeHash = edgeAttribute === null ? this.table : this.table.aggregate(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.table.aggregate(nodeAttribute);
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

  async getInstanceGraph(instances) {
    if (!instances) {
      // Without specified instances, just pick the first 5 from each node
      // and edge class
      instances = [];

      for (const classObj of Object.values(this.classes)) {
        if (classObj.type === 'Node' || classObj.type === 'Edge') {
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;

          var _iteratorError5;

          try {
            for (var _iterator5 = _asyncIterator(classObj.table.iterate({
              limit: 5
            })), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
              const item = _value5;
              instances.push(item);
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
    }

    const graph = {
      nodes: [],
      nodeLookup: {},
      edges: []
    };
    const edgeTableEntries = [];

    for (const instance of instances) {
      if (instance.type === 'Node') {
        graph.nodeLookup[instance.instanceId] = graph.nodes.length;
        graph.nodes.push({
          nodeInstance: instance,
          dummy: false
        });
      } else if (instance.type === 'Edge') {
        edgeTableEntries.push(instance);
      }
    }

    for (const edgeInstance of edgeTableEntries) {
      const sources = [];
      var _iteratorNormalCompletion6 = true;
      var _didIteratorError6 = false;

      var _iteratorError6;

      try {
        for (var _iterator6 = _asyncIterator(edgeInstance.sourceNodes()), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
          const source = _value6;

          if (graph.nodeLookup[source.instanceId] !== undefined) {
            sources.push(graph.nodeLookup[source.instanceId]);
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

      const targets = [];
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;

      var _iteratorError7;

      try {
        for (var _iterator7 = _asyncIterator(edgeInstance.targetNodes()), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
          const target = _value7;

          if (graph.nodeLookup[target.instanceId] !== undefined) {
            targets.push(graph.nodeLookup[target.instanceId]);
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

      if (sources.length === 0) {
        if (targets.length === 0) {
          // We have completely hanging edges, make dummy nodes for the
          // source and target
          graph.edges.push({
            edgeInstance,
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
          // The sources are hanging, but we have targets
          for (const target of targets) {
            graph.edges.push({
              edgeInstance,
              source: graph.nodes.length,
              target
            });
            graph.nodes.push({
              dummy: true
            });
          }
        }
      } else if (targets.length === 0) {
        // The targets are hanging, but we have sources
        for (const source of sources) {
          graph.edges.push({
            edgeInstance,
            source,
            target: graph.nodes.length
          });
          graph.nodes.push({
            dummy: true
          });
        }
      } else {
        // Neither the source, nor the target are hanging
        for (const source of sources) {
          for (const target of targets) {
            graph.edges.push({
              edgeInstance,
              source,
              target
            });
          }
        }
      }
    }

    return graph;
  }

  getNetworkModelGraph({
    raw = true,
    includeDummies = false
  } = {}) {
    const edgeClasses = [];
    let graph = {
      classes: [],
      classLookup: {},
      classConnections: []
    };
    const classList = Object.values(this.classes);

    for (const classObj of classList) {
      // Add and index the class as a node
      graph.classLookup[classObj.classId] = graph.classes.length;
      const classSpec = raw ? classObj._toRawObject() : {
        classObj
      };
      classSpec.type = classObj.constructor.name;
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

  getFullSchemaGraph() {
    return Object.assign(this.getNetworkModelGraph(), this.getTableDependencyGraph());
  }

  createSchemaModel() {
    const graph = this.getFullSchemaGraph();

    const newModel = this._origraph.createModel({
      name: this.name + '_schema'
    });

    let classes = newModel.addStaticTable({
      data: graph.classes,
      name: 'Classes'
    }).interpretAsNodes();
    let classConnections = newModel.addStaticTable({
      data: graph.classConnections,
      name: 'Class Connections'
    }).interpretAsEdges();
    let tables = newModel.addStaticTable({
      data: graph.tables,
      name: 'Tables'
    }).interpretAsNodes();
    let tableLinks = newModel.addStaticTable({
      data: graph.tableLinks,
      name: 'Table Links'
    }).interpretAsEdges();
    classes.connectToEdgeClass({
      edgeClass: classConnections,
      side: 'source',
      nodeAttribute: null,
      edgeAttribute: 'source'
    });
    classes.connectToEdgeClass({
      edgeClass: classConnections,
      side: 'target',
      nodeAttribute: null,
      edgeAttribute: 'target'
    });
    tables.connectToEdgeClass({
      edgeClass: tableLinks,
      side: 'source',
      nodeAttribute: null,
      edgeAttribute: 'source'
    });
    tables.connectToEdgeClass({
      edgeClass: tableLinks,
      side: 'target',
      nodeAttribute: null,
      edgeAttribute: 'target'
    });
    classes.connectToNodeClass({
      otherNodeClass: tables,
      attribute: 'tableId',
      otherAttribute: 'tableId'
    }).setClassName('Core Tables');
    return newModel;
  }

}

let NEXT_MODEL_ID = 1;

class Origraph extends TriggerableMixin(class {}) {
  constructor(FileReader$$1, localStorage) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node

    this.localStorage = localStorage; // either window.localStorage or null

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
    if (this.localStorage) {
      const models = {};

      for (const [modelId, model] of Object.entries(this.models)) {
        models[modelId] = model._toRawObject();
      }

      this.localStorage.setItem('origraph_models', JSON.stringify(models));
      this.trigger('save');
    }
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
var version = "0.1.5";
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
	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && node --inspect-brk node_modules/.bin/jest --runInBand -t",
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

let origraph = new Origraph(FileReader, null);
origraph.version = pkg.version;

module.exports = origraph;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguY2pzLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRXhwYW5kZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRmFjZXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UcmFuc3Bvc2VkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0Nvbm5lY3RlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdIHx8XG4gICAgICAgIHsgJyc6IFtdIH07XG4gICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10ucHVzaChjYWxsYmFjayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdID0gY2FsbGJhY2s7XG4gICAgICB9XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddID0gW107XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudCwgLi4uYXJncykge1xuICAgICAgY29uc3QgaGFuZGxlQ2FsbGJhY2sgPSBjYWxsYmFjayA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWVzcGFjZSBvZiBPYmplY3Qua2V5cyh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkpIHtcbiAgICAgICAgICBpZiAobmFtZXNwYWNlID09PSAnJykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmZvckVhY2goaGFuZGxlQ2FsbGJhY2spO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoYW5kbGVDYWxsYmFjayh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICB0aGlzLnRhYmxlID0gb3B0aW9ucy50YWJsZTtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLnRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGFuZCB0YWJsZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc09iaiA9IG9wdGlvbnMuY2xhc3NPYmogfHwgbnVsbDtcbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSBvcHRpb25zLmNvbm5lY3RlZEl0ZW1zIHx8IHt9O1xuICB9XG4gIGNvbm5lY3RJdGVtIChpdGVtKSB7XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdID0gdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdIHx8IFtdO1xuICAgIGlmICh0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0uaW5kZXhPZihpdGVtKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBgJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XyR7dGhpcy5pbmRleH1gO1xuICB9XG4gIGVxdWFscyAoaXRlbSkge1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlSWQgPT09IGl0ZW0uaW5zdGFuY2VJZDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAoeyB0YWJsZUlkcywgbGltaXQgPSBJbmZpbml0eSB9KSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSkge1xuICAgICAgeWllbGQgaXRlbTtcbiAgICAgIGkrKztcbiAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbdGFibGVJZHNbMF1dIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGhpc1RhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1t0aGlzVGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIHVzZWRCeUNsYXNzZXM6IHRoaXMuX3VzZWRCeUNsYXNzZXMsXG4gICAgICBkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zOiB7fSxcbiAgICAgIHN1cHByZXNzZWRBdHRyaWJ1dGVzOiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyxcbiAgICAgIHN1cHByZXNzSW5kZXg6IHRoaXMuX3N1cHByZXNzSW5kZXgsXG4gICAgICBhdHRyaWJ1dGVGaWx0ZXJzOiB7fSxcbiAgICAgIGluZGV4RmlsdGVyOiAodGhpcy5faW5kZXhGaWx0ZXIgJiYgdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbih0aGlzLl9pbmRleEZpbHRlcikpIHx8IG51bGxcbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICByZXN1bHQuYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaHlkcmF0ZUZ1bmN0aW9uIChzdHJpbmdpZmllZEZ1bmMpIHtcbiAgICBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBHZW5lcmljIGNhY2hpbmcgc3R1ZmY7IHRoaXMgaXNuJ3QganVzdCBmb3IgcGVyZm9ybWFuY2UuIENvbm5lY3RlZFRhYmxlJ3NcbiAgICAvLyBhbGdvcml0aG0gcmVxdWlyZXMgdGhhdCBpdHMgcGFyZW50IHRhYmxlcyBoYXZlIHByZS1idWlsdCBpbmRleGVzICh3ZVxuICAgIC8vIHRlY2huaWNhbGx5IGNvdWxkIGltcGxlbWVudCBpdCBkaWZmZXJlbnRseSwgYnV0IGl0IHdvdWxkIGJlIGV4cGVuc2l2ZSxcbiAgICAvLyByZXF1aXJlcyB0cmlja3kgbG9naWMsIGFuZCB3ZSdyZSBhbHJlYWR5IGJ1aWxkaW5nIGluZGV4ZXMgZm9yIHNvbWUgdGFibGVzXG4gICAgLy8gbGlrZSBBZ2dyZWdhdGVkVGFibGUgYW55d2F5KVxuICAgIGlmIChvcHRpb25zLnJlc2V0KSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQgPT09IHVuZGVmaW5lZCA/IEluZmluaXR5IDogb3B0aW9ucy5saW1pdDtcbiAgICAgIHlpZWxkICogT2JqZWN0LnZhbHVlcyh0aGlzLl9jYWNoZSkuc2xpY2UoMCwgbGltaXQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHlpZWxkICogYXdhaXQgdGhpcy5fYnVpbGRDYWNoZShvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpO1xuICAgIGxldCBjb21wbGV0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBpdGVyYXRpb24gd2FzIGNhbmNlbGxlZDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgY29tcGxldGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHRlbXAudmFsdWUpO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGVtcC52YWx1ZS5pbmRleF0gPSB0ZW1wLnZhbHVlO1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gd3JhcHBlZEl0ZW0ucm93KSB7XG4gICAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGRlbGV0ZSB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBmdW5jKHdyYXBwZWRJdGVtLnJvd1thdHRyXSk7XG4gICAgICBpZiAoIWtlZXApIHsgYnJlYWs7IH1cbiAgICB9XG4gICAgaWYgKGtlZXApIHtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbmlzaCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3cmFwcGVkSXRlbS5kaXNjb25uZWN0KCk7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaWx0ZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIGtlZXA7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBjbGFzc09iaiA/IGNsYXNzT2JqLl93cmFwKG9wdGlvbnMpIDogbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3Qgb3RoZXJJdGVtIG9mIG9wdGlvbnMuaXRlbXNUb0Nvbm5lY3QgfHwgW10pIHtcbiAgICAgIHdyYXBwZWRJdGVtLmNvbm5lY3RJdGVtKG90aGVySXRlbSk7XG4gICAgICBvdGhlckl0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGZvciAoY29uc3QgZGVyaXZlZFRhYmxlIG9mIHRoaXMuZGVyaXZlZFRhYmxlcykge1xuICAgICAgZGVyaXZlZFRhYmxlLnJlc2V0KCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncmVzZXQnKTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgYnVpbGRDYWNoZSAoKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGU7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0ZW1wIG9mIHRoaXMuX2J1aWxkQ2FjaGUoKSkge30gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgICAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgY291bnRSb3dzICgpIHtcbiAgICBjb25zdCBjYWNoZSA9IGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpO1xuICAgIHJldHVybiBjYWNoZSA/IE9iamVjdC5rZXlzKGNhY2hlKS5sZW5ndGggOiAtMTtcbiAgfVxuICBnZXRJbmRleERldGFpbHMgKCkge1xuICAgIGNvbnN0IGRldGFpbHMgPSB7IG5hbWU6IG51bGwgfTtcbiAgICBpZiAodGhpcy5fc3VwcHJlc3NJbmRleCkge1xuICAgICAgZGV0YWlscy5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBkZXRhaWxzLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGRldGFpbHM7XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZXhwZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ub2JzZXJ2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmRlcml2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0QXR0cmlidXRlRGV0YWlscygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBzdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZV0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgYWRkRmlsdGVyIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9pbmRleEZpbHRlciA9IGZ1bmM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgZGVsaW1pdGVyXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9O1xuICAgICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gaW5kZXhlcy5tYXAoaW5kZXggPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4XG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoeyBsaW1pdCB9KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdDb25uZWN0ZWRUYWJsZSdcbiAgICB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3Nlcykuc29tZShjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGVJZCA9PT0gdGhpcy50YWJsZUlkIHx8XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTEgfHxcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGlmICh0aGlzLmluVXNlKSB7XG4gICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBpbi11c2UgdGFibGUgJHt0aGlzLnRhYmxlSWR9YCk7XG4gICAgICBlcnIuaW5Vc2UgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3RUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpcmVkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEFnZ3JlZ2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMubW9kZWwuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMubW9kZWwuX2RlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gJ+KGpicgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSAoYXR0ciwgZnVuYykge1xuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIF91cGRhdGVJdGVtIChvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyhvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0udHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucykge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugc28gdGhhdCBBZ2dyZWdhdGVkVGFibGUgY2FuIHRha2UgYWR2YW50YWdlXG4gICAgLy8gb2YgdGhlIHBhcnRpYWxseS1idWlsdCBjYWNoZSBhcyBpdCBnb2VzLCBhbmQgcG9zdHBvbmUgZmluaXNoaW5nIGl0ZW1zXG4gICAgLy8gdW50aWwgYWZ0ZXIgdGhlIHBhcmVudCB0YWJsZSBoYXMgYmVlbiBmdWxseSBpdGVyYXRlZFxuXG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5faXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3dyYXBwZWRJdGVtLmluZGV4XSA9IHdyYXBwZWRJdGVtO1xuICAgICAgLy8gR28gYWhlYWQgYW5kIHlpZWxkIHRoZSB1bmZpbmlzaGVkIGl0ZW07IHRoaXMgbWFrZXMgaXQgcG9zc2libGUgZm9yXG4gICAgICAvLyBjbGllbnQgYXBwcyB0byBiZSBtb3JlIHJlc3BvbnNpdmUgYW5kIHJlbmRlciBwYXJ0aWFsIHJlc3VsdHMsIGJ1dCBhbHNvXG4gICAgICAvLyBtZWFucyB0aGF0IHRoZXkgbmVlZCB0byB3YXRjaCBmb3Igd3JhcHBlZEl0ZW0ub24oJ3VwZGF0ZScpIGV2ZW50c1xuICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgfVxuXG4gICAgLy8gU2Vjb25kIHBhc3M6IG5vdyB0aGF0IHdlJ3ZlIGNvbXBsZXRlZCB0aGUgZnVsbCBpdGVyYXRpb24gb2YgdGhlIHBhcmVudFxuICAgIC8vIHRhYmxlLCB3ZSBjYW4gZmluaXNoIGVhY2ggaXRlbVxuICAgIGZvciAoY29uc3QgaW5kZXggaW4gdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICBpZiAoIXRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gU3RyaW5nKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0pO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlW2luZGV4XSkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0l0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgICBleGlzdGluZ0l0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0oZXhpc3RpbmdJdGVtKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlSXRlbShleGlzdGluZ0l0ZW0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fdXBkYXRlSXRlbShuZXdJdGVtLCB3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSBzdXBlci5nZXRBdHRyaWJ1dGVEZXRhaWxzKCk7XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLnJlZHVjZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEFnZ3JlZ2F0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRXhwYW5kZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5kZWxpbWl0ZXIgPSBvcHRpb25zLmRlbGltaXRlciB8fCAnLCc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAn4oakJztcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IHZhbHVlcyA9ICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdIHx8ICcnKS5zcGxpdCh0aGlzLmRlbGltaXRlcik7XG4gICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuICAgICAgICBjb25zdCByb3cgPSB7fTtcbiAgICAgICAgcm93W3RoaXMuX2F0dHJpYnV0ZV0gPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdyxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmFjZXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICB0aGlzLl92YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBgWyR7dGhpcy5fdmFsdWV9XWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBpZiAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgLy8gTm9ybWFsIGZhY2V0aW5nIGp1c3QgZ2l2ZXMgYSBzdWJzZXQgb2YgdGhlIG9yaWdpbmFsIHRhYmxlXG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3c6IE9iamVjdC5hc3NpZ24oe30sIHdyYXBwZWRQYXJlbnQucm93KSxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmFjZXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBUcmFuc3Bvc2VkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2luZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5faW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5pbmRleCA9IHRoaXMuX2luZGV4O1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBg4bWAJHt0aGlzLl9pbmRleH1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGF3YWl0IHBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcblxuICAgIC8vIEl0ZXJhdGUgdGhlIHJvdydzIGF0dHJpYnV0ZXMgYXMgaW5kZXhlc1xuICAgIGNvbnN0IHdyYXBwZWRQYXJlbnQgPSBwYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5faW5kZXhdIHx8IHsgcm93OiB7fSB9O1xuICAgIGZvciAoY29uc3QgWyBpbmRleCwgdmFsdWUgXSBvZiBPYmplY3QuZW50cmllcyh3cmFwcGVkUGFyZW50LnJvdykpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBTcGluIHRocm91Z2ggYWxsIG9mIHRoZSBwYXJlbnRUYWJsZXMgc28gdGhhdCB0aGVpciBfY2FjaGUgaXMgcHJlLWJ1aWx0XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiBwYXJlbnRUYWJsZXMpIHtcbiAgICAgIGF3YWl0IHBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcbiAgICB9XG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZSkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbaW5kZXhdKVxuICAgICAgfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb25zID0gb3B0aW9ucy5hbm5vdGF0aW9ucyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zXG4gICAgfTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdGFibGUgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgX2Rlcml2ZU5ld0NsYXNzIChuZXdUYWJsZSwgdHlwZSA9IHRoaXMuY29uc3RydWN0b3IubmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlXG4gICAgfSk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKSk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUsIGRlbGltaXRlcikpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuVHJhbnNwb3NlKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXRTYW1wbGVHcmFwaCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMucm9vdENsYXNzID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5nZXRTYW1wbGVHcmFwaChvcHRpb25zKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0geyBsaW1pdDogSW5maW5pdHkgfSkge1xuICAgIGNvbnN0IGVkZ2VJZHMgPSBvcHRpb25zLmVkZ2VJZHMgfHwgdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHM7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIE9iamVjdC5rZXlzKGVkZ2VJZHMpKSB7XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLm1vZGVsLmNsYXNzZXNbZWRnZUlkXTtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc09iai5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMudGFibGVJZHMgPSBlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy50YWJsZUlkcyA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMob3B0aW9ucykpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgaSsrO1xuICAgICAgICBpZiAoaSA+PSBvcHRpb25zLmxpbWl0KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jICogcGFpcndpc2VOZWlnaGJvcmhvb2QgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgdGhpcy5lZGdlcyhvcHRpb25zKSkge1xuICAgICAgeWllbGQgKiBlZGdlLnBhaXJ3aXNlRWRnZXMob3B0aW9ucyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuZWRnZUNsYXNzSWRzID0gdGhpcy5lZGdlQ2xhc3NJZHM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgTm9kZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoeyBhdXRvY29ubmVjdCA9IGZhbHNlIH0pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgaWYgKCFhdXRvY29ubmVjdCB8fCBlZGdlQ2xhc3NJZHMubGVuZ3RoID4gMikge1xuICAgICAgLy8gSWYgdGhlcmUgYXJlIG1vcmUgdGhhbiB0d28gZWRnZXMsIGJyZWFrIGFsbCBjb25uZWN0aW9ucyBhbmQgbWFrZVxuICAgICAgLy8gdGhpcyBhIGZsb2F0aW5nIGVkZ2UgKGZvciBub3csIHdlJ3JlIG5vdCBkZWFsaW5nIGluIGh5cGVyZWRnZXMpXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gV2l0aCBvbmx5IG9uZSBjb25uZWN0aW9uLCB0aGlzIG5vZGUgc2hvdWxkIGJlY29tZSBhIHNlbGYtZWRnZVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAvLyBBcmUgd2UgdGhlIHNvdXJjZSBvciB0YXJnZXQgb2YgdGhlIGV4aXN0aW5nIGVkZ2UgKGludGVybmFsbHksIGluIHRlcm1zXG4gICAgICAvLyBvZiBzb3VyY2VJZCAvIHRhcmdldElkLCBub3QgZWRnZUNsYXNzLmRpcmVjdGlvbik/XG4gICAgICBjb25zdCBpc1NvdXJjZSA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQ7XG5cbiAgICAgIC8vIEFzIHdlJ3JlIGNvbnZlcnRlZCB0byBhbiBlZGdlLCBvdXIgbmV3IHJlc3VsdGluZyBzb3VyY2UgQU5EIHRhcmdldFxuICAgICAgLy8gc2hvdWxkIGJlIHdoYXRldmVyIGlzIGF0IHRoZSBvdGhlciBlbmQgb2YgZWRnZUNsYXNzIChpZiBhbnl0aGluZylcbiAgICAgIGlmIChpc1NvdXJjZSkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgICAgfVxuICAgICAgLy8gSWYgdGhlcmUgaXMgYSBub2RlIGNsYXNzIG9uIHRoZSBvdGhlciBlbmQgb2YgZWRnZUNsYXNzLCBhZGQgb3VyXG4gICAgICAvLyBpZCB0byBpdHMgbGlzdCBvZiBjb25uZWN0aW9uc1xuICAgICAgY29uc3Qgbm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF07XG4gICAgICBpZiAobm9kZUNsYXNzKSB7XG4gICAgICAgIG5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIHRhYmxlSWQgbGlzdHMgc2hvdWxkIGVtYW5hdGUgb3V0IGZyb20gdGhlIChuZXcpIGVkZ2UgdGFibGU7IGFzc3VtaW5nXG4gICAgICAvLyAoZm9yIGEgbW9tZW50KSB0aGF0IGlzU291cmNlID09PSB0cnVlLCB3ZSdkIGNvbnN0cnVjdCB0aGUgdGFibGVJZCBsaXN0XG4gICAgICAvLyBsaWtlIHRoaXM6XG4gICAgICBsZXQgdGFibGVJZExpc3QgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIGVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmICghaXNTb3VyY2UpIHtcbiAgICAgICAgLy8gV2hvb3BzLCBnb3QgaXQgYmFja3dhcmRzIVxuICAgICAgICB0YWJsZUlkTGlzdC5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZWRnZUNsYXNzLmRpcmVjdGVkO1xuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YWJsZUlkTGlzdDtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgIC8vIE9rYXksIHdlJ3ZlIGdvdCB0d28gZWRnZXMsIHNvIHRoaXMgaXMgYSBsaXR0bGUgbW9yZSBzdHJhaWdodGZvcndhcmRcbiAgICAgIGxldCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIGxldCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgIC8vIEZpZ3VyZSBvdXQgdGhlIGRpcmVjdGlvbiwgaWYgdGhlcmUgaXMgb25lXG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLmRpcmVjdGVkICYmIHRhcmdldEVkZ2VDbGFzcy5kaXJlY3RlZCkge1xuICAgICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGhhcHBlbmVkIHRvIGdldCB0aGUgZWRnZXMgaW4gb3JkZXI7IHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBnb3QgdGhlIGVkZ2VzIGJhY2t3YXJkczsgc3dhcCB0aGVtIGFuZCBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgICAgIHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBub3cgd2Uga25vdyBob3cgdG8gc2V0IHNvdXJjZSAvIHRhcmdldCBpZHNcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IHNvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICAvLyBBZGQgdGhpcyBjbGFzcyB0byB0aGUgc291cmNlJ3MgLyB0YXJnZXQncyBlZGdlQ2xhc3NJZHNcbiAgICAgIHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnRhcmdldENsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIC8vIENvbmNhdGVuYXRlIHRoZSBpbnRlcm1lZGlhdGUgdGFibGVJZCBsaXN0cywgZW1hbmF0aW5nIG91dCBmcm9tIHRoZVxuICAgICAgLy8gKG5ldykgZWRnZSB0YWJsZVxuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgc291cmNlRWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChzb3VyY2VFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFyZ2V0RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyB0YXJnZXRFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAodGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnRhcmdldFRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIC8vIERpc2Nvbm5lY3QgdGhlIGV4aXN0aW5nIGVkZ2UgY2xhc3NlcyBmcm9tIHRoZSBuZXcgKG5vdyBlZGdlKSBjbGFzc1xuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzSWRzO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBhdHRyaWJ1dGUsIG90aGVyQXR0cmlidXRlIH0pIHtcbiAgICBsZXQgdGhpc0hhc2gsIG90aGVySGFzaCwgc291cmNlVGFibGVJZHMsIHRhcmdldFRhYmxlSWRzO1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXNIYXNoID0gdGhpcy50YWJsZTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXNIYXNoID0gdGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gWyB0aGlzSGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGlmIChvdGhlckF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGU7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZS5hZ2dyZWdhdGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbIG90aGVySGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIC8vIElmIHdlIGhhdmUgYSBzZWxmIGVkZ2UgY29ubmVjdGluZyB0aGUgc2FtZSBhdHRyaWJ1dGUsIHdlIGNhbiBqdXN0IHVzZVxuICAgIC8vIHRoZSBBZ2dyZWdhdGVkVGFibGUgYXMgdGhlIGVkZ2UgdGFibGU7IG90aGVyd2lzZSB3ZSBuZWVkIHRvIGNyZWF0ZSBhXG4gICAgLy8gQ29ubmVjdGVkVGFibGVcbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXMgPT09IG90aGVyTm9kZUNsYXNzICYmIGF0dHJpYnV0ZSA9PT0gb3RoZXJBdHRyaWJ1dGVcbiAgICAgID8gdGhpc0hhc2ggOiB0aGlzSGFzaC5jb25uZWN0KFtvdGhlckhhc2hdKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldFRhYmxlSWRzXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdFZGdlQ2xhc3M7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHN1cGVyLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpO1xuICAgIHRoaXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBuZXdOb2RlQ2xhc3MsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgdGhpcy5jb25uZWN0ZWRDbGFzc2VzKCkpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgb3B0aW9ucy50YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmouc291cmNlVGFibGVJZHNcbiAgICAgIC5jb25jYXQoWyBzb3VyY2VUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkXS50YWJsZUlkO1xuICAgIG9wdGlvbnMudGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnRhcmdldFRhYmxlSWRzXG4gICAgICAuY29uY2F0KFsgdGFyZ2V0VGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogcGFpcndpc2VFZGdlcyAob3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucykpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucykpIHtcbiAgICAgICAgeWllbGQgeyBzb3VyY2UsIGVkZ2U6IHRoaXMsIHRhcmdldCB9O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyBoeXBlcmVkZ2UgKG9wdGlvbnMpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBzb3VyY2VzOiBbXSxcbiAgICAgIHRhcmdldHM6IFtdLFxuICAgICAgZWRnZTogdGhpc1xuICAgIH07XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgcmVzdWx0LnB1c2goc291cmNlKTtcbiAgICB9XG4gICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgcmVzdWx0LnB1c2godGFyZ2V0KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBFZGdlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAvLyBzb3VyY2VUYWJsZUlkcyBhbmQgdGFyZ2V0VGFibGVJZHMgYXJlIGxpc3RzIG9mIGFueSBpbnRlcm1lZGlhdGUgdGFibGVzLFxuICAgIC8vIGJlZ2lubmluZyB3aXRoIHRoZSBlZGdlIHRhYmxlIChidXQgbm90IGluY2x1ZGluZyBpdCksIHRoYXQgbGVhZCB0byB0aGVcbiAgICAvLyBzb3VyY2UgLyB0YXJnZXQgbm9kZSB0YWJsZXMgKGJ1dCBub3QgaW5jbHVkaW5nKSB0aG9zZVxuXG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMuc291cmNlVGFibGVJZHMgfHwgW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgfHwgW107XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC5zb3VyY2VUYWJsZUlkcyA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldFRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEVkZ2VXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIF9zcGxpdFRhYmxlSWRMaXN0ICh0YWJsZUlkTGlzdCwgb3RoZXJDbGFzcykge1xuICAgIGxldCByZXN1bHQgPSB7XG4gICAgICBub2RlVGFibGVJZExpc3Q6IFtdLFxuICAgICAgZWRnZVRhYmxlSWQ6IG51bGwsXG4gICAgICBlZGdlVGFibGVJZExpc3Q6IFtdXG4gICAgfTtcbiAgICBpZiAodGFibGVJZExpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBXZWlyZCBjb3JuZXIgY2FzZSB3aGVyZSB3ZSdyZSB0cnlpbmcgdG8gY3JlYXRlIGFuIGVkZ2UgYmV0d2VlblxuICAgICAgLy8gYWRqYWNlbnQgb3IgaWRlbnRpY2FsIHRhYmxlcy4uLiBjcmVhdGUgYSBDb25uZWN0ZWRUYWJsZVxuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGhpcy50YWJsZS5jb25uZWN0KG90aGVyQ2xhc3MudGFibGUpLnRhYmxlSWQ7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgYSB0YWJsZSBpbiB0aGUgbWlkZGxlIGFzIHRoZSBuZXcgZWRnZSB0YWJsZTsgcHJpb3JpdGl6ZVxuICAgICAgLy8gU3RhdGljVGFibGUgYW5kIFN0YXRpY0RpY3RUYWJsZVxuICAgICAgbGV0IHN0YXRpY0V4aXN0cyA9IGZhbHNlO1xuICAgICAgbGV0IHRhYmxlRGlzdGFuY2VzID0gdGFibGVJZExpc3QubWFwKCh0YWJsZUlkLCBpbmRleCkgPT4ge1xuICAgICAgICBzdGF0aWNFeGlzdHMgPSBzdGF0aWNFeGlzdHMgfHwgdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgcmV0dXJuIHsgdGFibGVJZCwgaW5kZXgsIGRpc3Q6IE1hdGguYWJzKHRhYmxlSWRMaXN0IC8gMiAtIGluZGV4KSB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIHRhYmxlRGlzdGFuY2VzID0gdGFibGVEaXN0YW5jZXMuZmlsdGVyKCh7IHRhYmxlSWQgfSkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHsgdGFibGVJZCwgaW5kZXggfSA9IHRhYmxlRGlzdGFuY2VzLnNvcnQoKGEsIGIpID0+IGEuZGlzdCAtIGIuZGlzdClbMF07XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0YWJsZUlkO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKDAsIGluZGV4KS5yZXZlcnNlKCk7XG4gICAgICByZXN1bHQubm9kZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoaW5kZXggKyAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICB0ZW1wLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICB0ZW1wLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh0ZW1wKTtcblxuICAgIGlmICh0ZW1wLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RlbXAuc291cmNlQ2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC5zb3VyY2VUYWJsZUlkcywgc291cmNlQ2xhc3MpO1xuICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IHRlbXAuc291cmNlQ2xhc3NJZCxcbiAgICAgICAgc291cmNlVGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0ZW1wLnRhcmdldENsYXNzSWQgJiYgdGVtcC5zb3VyY2VDbGFzc0lkICE9PSB0ZW1wLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RlbXAudGFyZ2V0Q2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC50YXJnZXRUYWJsZUlkcywgdGFyZ2V0Q2xhc3MpO1xuICAgICAgY29uc3QgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiB0ZW1wLnRhcmdldENsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBub2RlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLnNpZGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2Uob3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLnNpZGUgPT09ICd0YXJnZXQnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUG9saXRpY2FsT3V0c2lkZXJFcnJvcjogXCIke29wdGlvbnMuc2lkZX1cIiBpcyBhbiBpbnZhbGlkIHNpZGVgKTtcbiAgICB9XG4gIH1cbiAgdG9nZ2xlRGlyZWN0aW9uIChkaXJlY3RlZCkge1xuICAgIGlmIChkaXJlY3RlZCA9PT0gZmFsc2UgfHwgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBkZWxldGUgdGhpcy5zd2FwcGVkRGlyZWN0aW9uO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuZGlyZWN0ZWQpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERpcmVjdGVkIHdhcyBhbHJlYWR5IHRydWUsIGp1c3Qgc3dpdGNoIHNvdXJjZSBhbmQgdGFyZ2V0XG4gICAgICBsZXQgdGVtcCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IHRlbXA7XG4gICAgICB0ZW1wID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IHRlbXA7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RTb3VyY2UgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgfVxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUuYWdncmVnYXRlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MudGFibGUuYWdncmVnYXRlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFRhcmdldCAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gdGFyZ2V0Q2xhc3MudGFibGUgOiB0YXJnZXRDbGFzcy50YWJsZS5hZ2dyZWdhdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0U291cmNlICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuXG5pbXBvcnQgKiBhcyBUQUJMRVMgZnJvbSAnLi4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4uL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5cbmNvbnN0IERBVEFMSUJfRk9STUFUUyA9IHtcbiAgJ2pzb24nOiAnanNvbicsXG4gICdjc3YnOiAnY3N2JyxcbiAgJ3Rzdic6ICd0c3YnLFxuICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAndHJlZWpzb24nOiAndHJlZWpzb24nXG59O1xuXG5jbGFzcyBOZXR3b3JrTW9kZWwgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgb3JpZ3JhcGgsXG4gICAgbW9kZWxJZCxcbiAgICBuYW1lID0gbW9kZWxJZCxcbiAgICBhbm5vdGF0aW9ucyA9IHt9LFxuICAgIGNsYXNzZXMgPSB7fSxcbiAgICB0YWJsZXMgPSB7fVxuICB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9yaWdyYXBoO1xuICAgIHRoaXMubW9kZWxJZCA9IG1vZGVsSWQ7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmFubm90YXRpb25zID0gYW5ub3RhdGlvbnM7XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG4gICAgdGhpcy50YWJsZXMgPSB7fTtcblxuICAgIHRoaXMuX25leHRDbGFzc0lkID0gMTtcbiAgICB0aGlzLl9uZXh0VGFibGVJZCA9IDE7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXMoY2xhc3NlcykpIHtcbiAgICAgIHRoaXMuY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IHRoaXMuaHlkcmF0ZShjbGFzc09iaiwgQ0xBU1NFUyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgT2JqZWN0LnZhbHVlcyh0YWJsZXMpKSB7XG4gICAgICB0aGlzLnRhYmxlc1t0YWJsZS50YWJsZUlkXSA9IHRoaXMuaHlkcmF0ZSh0YWJsZSwgVEFCTEVTKTtcbiAgICB9XG5cbiAgICB0aGlzLm9uKCd1cGRhdGUnLCAoKSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc2F2ZVRpbWVvdXQpO1xuICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5fb3JpZ3JhcGguc2F2ZSgpO1xuICAgICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHVuZGVmaW5lZDtcbiAgICAgIH0sIDApO1xuICAgIH0pO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgY2xhc3NlcyA9IHt9O1xuICAgIGNvbnN0IHRhYmxlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpKSB7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0gPSB0YWJsZU9iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXS50eXBlID0gdGFibGVPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIG1vZGVsSWQ6IHRoaXMubW9kZWxJZCxcbiAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zLFxuICAgICAgY2xhc3NlcyxcbiAgICAgIHRhYmxlc1xuICAgIH07XG4gIH1cbiAgZ2V0IHVuc2F2ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9zYXZlVGltZW91dCAhPT0gdW5kZWZpbmVkO1xuICB9XG4gIGh5ZHJhdGUgKHJhd09iamVjdCwgVFlQRVMpIHtcbiAgICByYXdPYmplY3QubW9kZWwgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgVFlQRVNbcmF3T2JqZWN0LnR5cGVdKHJhd09iamVjdCk7XG4gIH1cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMudGFibGVJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0pKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke3RoaXMuX25leHRUYWJsZUlkfWA7XG4gICAgICB0aGlzLl9uZXh0VGFibGVJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFRBQkxFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMuY2xhc3NJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdKSkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHt0aGlzLl9uZXh0Q2xhc3NJZH1gO1xuICAgICAgdGhpcy5fbmV4dENsYXNzSWQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ0xBU1NFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG4gIHJlbmFtZSAobmV3TmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5ld05hbWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhbm5vdGF0ZSAoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYW5ub3RhdGlvbnNba2V5XSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlQW5ub3RhdGlvbiAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMuYW5ub3RhdGlvbnNba2V5XTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5fb3JpZ3JhcGguZGVsZXRlTW9kZWwodGhpcy5tb2RlbElkKTtcbiAgfVxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNUYWJsZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHlgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuX29yaWdyYXBoLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljVGFibGUoe1xuICAgICAgbmFtZTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljVGFibGUgKHsgbmFtZSwgZXh0ZW5zaW9uLCB0ZXh0IH0pIHtcbiAgICBsZXQgZGF0YSwgYXR0cmlidXRlcztcbiAgICBpZiAoIWV4dGVuc2lvbikge1xuICAgICAgZXh0ZW5zaW9uID0gbWltZS5leHRlbnNpb24obWltZS5sb29rdXAobmFtZSkpO1xuICAgIH1cbiAgICBpZiAoREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBkZWxldGVBbGxVbnVzZWRUYWJsZXMgKCkge1xuICAgIGZvciAoY29uc3QgdGFibGVJZCBpbiB0aGlzLnRhYmxlcykge1xuICAgICAgaWYgKHRoaXMudGFibGVzW3RhYmxlSWRdKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy50YWJsZXNbdGFibGVJZF0uZGVsZXRlKCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmICghZXJyLmluVXNlKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgZ2V0U2FtcGxlR3JhcGggKHtcbiAgICByb290Q2xhc3MgPSBudWxsLFxuICAgIGJyYW5jaExpbWl0ID0gSW5maW5pdHksXG4gICAgbm9kZUxpbWl0ID0gSW5maW5pdHksXG4gICAgZWRnZUxpbWl0ID0gSW5maW5pdHksXG4gICAgdHJpcGxlTGltaXQgPSBJbmZpbml0eVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBzYW1wbGVHcmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdLFxuICAgICAgZWRnZUxvb2t1cDoge30sXG4gICAgICBsaW5rczogW11cbiAgICB9O1xuXG4gICAgbGV0IG51bVRyaXBsZXMgPSAwO1xuICAgIGNvbnN0IGFkZE5vZGUgPSBub2RlID0+IHtcbiAgICAgIGlmIChzYW1wbGVHcmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gPSBzYW1wbGVHcmFwaC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIHNhbXBsZUdyYXBoLm5vZGVzLnB1c2gobm9kZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2FtcGxlR3JhcGgubm9kZXMubGVuZ3RoIDw9IG5vZGVMaW1pdDtcbiAgICB9O1xuICAgIGNvbnN0IGFkZEVkZ2UgPSBlZGdlID0+IHtcbiAgICAgIGlmIChzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF0gPSBzYW1wbGVHcmFwaC5lZGdlcy5sZW5ndGg7XG4gICAgICAgIHNhbXBsZUdyYXBoLmVkZ2VzLnB1c2goZWRnZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2FtcGxlR3JhcGguZWRnZXMubGVuZ3RoIDw9IGVkZ2VMaW1pdDtcbiAgICB9O1xuICAgIGNvbnN0IGFkZFRyaXBsZSA9IChzb3VyY2UsIGVkZ2UsIHRhcmdldCkgPT4ge1xuICAgICAgaWYgKGFkZE5vZGUoc291cmNlKSAmJiBhZGROb2RlKHRhcmdldCkgJiYgYWRkRWRnZShlZGdlKSkge1xuICAgICAgICBzYW1wbGVHcmFwaC5saW5rcy5wdXNoKHtcbiAgICAgICAgICBzb3VyY2U6IHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbc291cmNlLmluc3RhbmNlSWRdLFxuICAgICAgICAgIHRhcmdldDogc2FtcGxlR3JhcGgubm9kZUxvb2t1cFt0YXJnZXQuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgZWRnZTogc2FtcGxlR3JhcGguZWRnZUxvb2t1cFtlZGdlLmluc3RhbmNlSWRdXG4gICAgICAgIH0pO1xuICAgICAgICBudW1UcmlwbGVzKys7XG4gICAgICAgIHJldHVybiBudW1UcmlwbGVzIDw9IHRyaXBsZUxpbWl0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsZXQgY2xhc3NMaXN0ID0gcm9vdENsYXNzID8gW3Jvb3RDbGFzc10gOiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3Nlcyk7XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGlmICghYWRkTm9kZShub2RlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgc291cmNlLCBlZGdlLCB0YXJnZXQgfSBvZiBub2RlLnBhaXJ3aXNlTmVpZ2hib3Job29kKHsgbGltaXQ6IGJyYW5jaExpbWl0IH0pKSB7XG4gICAgICAgICAgICBpZiAoIWFkZFRyaXBsZShzb3VyY2UsIGVkZ2UsIHRhcmdldCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGlmICghYWRkRWRnZShlZGdlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgc291cmNlLCB0YXJnZXQgfSBvZiBlZGdlLnBhaXJ3aXNlRWRnZXMoeyBsaW1pdDogYnJhbmNoTGltaXQgfSkpIHtcbiAgICAgICAgICAgIGlmICghYWRkVHJpcGxlKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgfVxuICBhc3luYyBnZXRJbnN0YW5jZUdyYXBoIChpbnN0YW5jZXMpIHtcbiAgICBpZiAoIWluc3RhbmNlcykge1xuICAgICAgLy8gV2l0aG91dCBzcGVjaWZpZWQgaW5zdGFuY2VzLCBqdXN0IHBpY2sgdGhlIGZpcnN0IDUgZnJvbSBlYWNoIG5vZGVcbiAgICAgIC8vIGFuZCBlZGdlIGNsYXNzXG4gICAgICBpbnN0YW5jZXMgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgfHwgY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoeyBsaW1pdDogNSB9KSkge1xuICAgICAgICAgICAgaW5zdGFuY2VzLnB1c2goaXRlbSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBub2RlTG9va3VwOiB7fSxcbiAgICAgIGVkZ2VzOiBbXVxuICAgIH07XG4gICAgY29uc3QgZWRnZVRhYmxlRW50cmllcyA9IFtdO1xuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgaW5zdGFuY2VzKSB7XG4gICAgICBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGdyYXBoLm5vZGVMb29rdXBbaW5zdGFuY2UuaW5zdGFuY2VJZF0gPSBncmFwaC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICAgIG5vZGVJbnN0YW5jZTogaW5zdGFuY2UsXG4gICAgICAgICAgZHVtbXk6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbnN0YW5jZS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZWRnZVRhYmxlRW50cmllcy5wdXNoKGluc3RhbmNlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBlZGdlSW5zdGFuY2Ugb2YgZWRnZVRhYmxlRW50cmllcykge1xuICAgICAgY29uc3Qgc291cmNlcyA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgZWRnZUluc3RhbmNlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbc291cmNlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBzb3VyY2VzLnB1c2goZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCB0YXJnZXRzID0gW107XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlSW5zdGFuY2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXQuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRhcmdldHMucHVzaChncmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzb3VyY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBpZiAodGFyZ2V0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAvLyBXZSBoYXZlIGNvbXBsZXRlbHkgaGFuZ2luZyBlZGdlcywgbWFrZSBkdW1teSBub2RlcyBmb3IgdGhlXG4gICAgICAgICAgLy8gc291cmNlIGFuZCB0YXJnZXRcbiAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGggKyAxXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUaGUgc291cmNlcyBhcmUgaGFuZ2luZywgYnV0IHdlIGhhdmUgdGFyZ2V0c1xuICAgICAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgICB0YXJnZXRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0YXJnZXRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBUaGUgdGFyZ2V0cyBhcmUgaGFuZ2luZywgYnV0IHdlIGhhdmUgc291cmNlc1xuICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVpdGhlciB0aGUgc291cmNlLCBub3IgdGhlIHRhcmdldCBhcmUgaGFuZ2luZ1xuICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgICAgc291cmNlLFxuICAgICAgICAgICAgICB0YXJnZXRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TmV0d29ya01vZGVsR3JhcGggKHtcbiAgICByYXcgPSB0cnVlLFxuICAgIGluY2x1ZGVEdW1taWVzID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICBsZXQgZ3JhcGggPSB7XG4gICAgICBjbGFzc2VzOiBbXSxcbiAgICAgIGNsYXNzTG9va3VwOiB7fSxcbiAgICAgIGNsYXNzQ29ubmVjdGlvbnM6IFtdXG4gICAgfTtcblxuICAgIGNvbnN0IGNsYXNzTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgY2xhc3NMaXN0KSB7XG4gICAgICAvLyBBZGQgYW5kIGluZGV4IHRoZSBjbGFzcyBhcyBhIG5vZGVcbiAgICAgIGdyYXBoLmNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gZ3JhcGguY2xhc3Nlcy5sZW5ndGg7XG4gICAgICBjb25zdCBjbGFzc1NwZWMgPSByYXcgPyBjbGFzc09iai5fdG9SYXdPYmplY3QoKSA6IHsgY2xhc3NPYmogfTtcbiAgICAgIGNsYXNzU3BlYy50eXBlID0gY2xhc3NPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLmNsYXNzZXMucHVzaChjbGFzc1NwZWMpO1xuXG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIC8vIFN0b3JlIHRoZSBlZGdlIGNsYXNzIHNvIHdlIGNhbiBjcmVhdGUgY2xhc3NDb25uZWN0aW9ucyBsYXRlclxuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnICYmIGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IG5vZGVcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7Y2xhc3NPYmouY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGggLSAxLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGZhbHNlLFxuICAgICAgICAgIGxvY2F0aW9uOiAnbm9kZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBDcmVhdGUgZXhpc3RpbmcgY2xhc3NDb25uZWN0aW9uc1xuICAgICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZUNsYXNzZXMpIHtcbiAgICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgICAgLy8gQ29ubmVjdCB0aGUgc291cmNlIG5vZGUgY2xhc3MgdG8gdGhlIGVkZ2UgY2xhc3NcbiAgICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkfT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkXSxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJ1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgc291cmNlIGNsYXNzXG4gICAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBgZHVtbXk+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJyxcbiAgICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgICAgLy8gQ29ubmVjdCB0aGUgZWRnZSBjbGFzcyB0byB0aGUgdGFyZ2V0IG5vZGUgY2xhc3NcbiAgICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT4ke2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkfWAsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnRhcmdldENsYXNzSWRdLFxuICAgICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0J1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgdGFyZ2V0IGNsYXNzXG4gICAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0JyxcbiAgICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGggKCkge1xuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgdGFibGVzOiBbXSxcbiAgICAgIHRhYmxlTG9va3VwOiB7fSxcbiAgICAgIHRhYmxlTGlua3M6IFtdXG4gICAgfTtcbiAgICBjb25zdCB0YWJsZUxpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKTtcbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgY29uc3QgdGFibGVTcGVjID0gdGFibGUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZVNwZWMudHlwZSA9IHRhYmxlLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGdyYXBoLnRhYmxlcy5sZW5ndGg7XG4gICAgICBncmFwaC50YWJsZXMucHVzaCh0YWJsZVNwZWMpO1xuICAgIH1cbiAgICAvLyBGaWxsIHRoZSBncmFwaCB3aXRoIGxpbmtzIGJhc2VkIG9uIHBhcmVudFRhYmxlcy4uLlxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRhYmxlLnBhcmVudFRhYmxlcykge1xuICAgICAgICBncmFwaC50YWJsZUxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogZ3JhcGgudGFibGVMb29rdXBbcGFyZW50VGFibGUudGFibGVJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldEZ1bGxTY2hlbWFHcmFwaCAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24odGhpcy5nZXROZXR3b3JrTW9kZWxHcmFwaCgpLCB0aGlzLmdldFRhYmxlRGVwZW5kZW5jeUdyYXBoKCkpO1xuICB9XG4gIGNyZWF0ZVNjaGVtYU1vZGVsICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHRoaXMuZ2V0RnVsbFNjaGVtYUdyYXBoKCk7XG4gICAgY29uc3QgbmV3TW9kZWwgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVNb2RlbCh7IG5hbWU6IHRoaXMubmFtZSArICdfc2NoZW1hJyB9KTtcbiAgICBsZXQgY2xhc3NlcyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLmNsYXNzZXMsXG4gICAgICBuYW1lOiAnQ2xhc3NlcydcbiAgICB9KS5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgbGV0IGNsYXNzQ29ubmVjdGlvbnMgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLFxuICAgICAgbmFtZTogJ0NsYXNzIENvbm5lY3Rpb25zJ1xuICAgIH0pLmludGVycHJldEFzRWRnZXMoKTtcbiAgICBsZXQgdGFibGVzID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGgudGFibGVzLFxuICAgICAgbmFtZTogJ1RhYmxlcydcbiAgICB9KS5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgbGV0IHRhYmxlTGlua3MgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaC50YWJsZUxpbmtzLFxuICAgICAgbmFtZTogJ1RhYmxlIExpbmtzJ1xuICAgIH0pLmludGVycHJldEFzRWRnZXMoKTtcbiAgICBjbGFzc2VzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICBlZGdlQ2xhc3M6IGNsYXNzQ29ubmVjdGlvbnMsXG4gICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICBlZGdlQXR0cmlidXRlOiAnc291cmNlJ1xuICAgIH0pO1xuICAgIGNsYXNzZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgIGVkZ2VDbGFzczogY2xhc3NDb25uZWN0aW9ucyxcbiAgICAgIHNpZGU6ICd0YXJnZXQnLFxuICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIGVkZ2VBdHRyaWJ1dGU6ICd0YXJnZXQnXG4gICAgfSk7XG4gICAgdGFibGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICBlZGdlQ2xhc3M6IHRhYmxlTGlua3MsXG4gICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICBlZGdlQXR0cmlidXRlOiAnc291cmNlJ1xuICAgIH0pO1xuICAgIHRhYmxlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgZWRnZUNsYXNzOiB0YWJsZUxpbmtzLFxuICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICBub2RlQXR0cmlidXRlOiBudWxsLFxuICAgICAgZWRnZUF0dHJpYnV0ZTogJ3RhcmdldCdcbiAgICB9KTtcbiAgICBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAndGFibGVJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogJ3RhYmxlSWQnXG4gICAgfSkuc2V0Q2xhc3NOYW1lKCdDb3JlIFRhYmxlcycpO1xuICAgIHJldHVybiBuZXdNb2RlbDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTmV0d29ya01vZGVsO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgTmV0d29ya01vZGVsIGZyb20gJy4vQ29tbW9uL05ldHdvcmtNb2RlbC5qcyc7XG5cbmxldCBORVhUX01PREVMX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICBsZXQgZXhpc3RpbmdNb2RlbHMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnKTtcbiAgICBpZiAoZXhpc3RpbmdNb2RlbHMpIHtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyhKU09OLnBhcnNlKGV4aXN0aW5nTW9kZWxzKSkpIHtcbiAgICAgICAgbW9kZWwub3JpZ3JhcGggPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsc1ttb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwobW9kZWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgfVxuICByZWdpc3RlclBsdWdpbiAobmFtZSwgcGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW5zW25hbWVdID0gcGx1Z2luO1xuICB9XG4gIHNhdmUgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgbW9kZWxzID0ge307XG4gICAgICBmb3IgKGNvbnN0IFttb2RlbElkLCBtb2RlbF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5tb2RlbHMpKSB7XG4gICAgICAgIG1vZGVsc1ttb2RlbElkXSA9IG1vZGVsLl90b1Jhd09iamVjdCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnb3JpZ3JhcGhfbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG4gICAgICB0aGlzLnRyaWdnZXIoJ3NhdmUnKTtcbiAgICB9XG4gIH1cbiAgY2xvc2VDdXJyZW50TW9kZWwgKCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGdldCBjdXJyZW50TW9kZWwgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1t0aGlzLl9jdXJyZW50TW9kZWxJZF0gfHwgbnVsbDtcbiAgfVxuICBzZXQgY3VycmVudE1vZGVsIChtb2RlbCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbW9kZWwgPyBtb2RlbC5tb2RlbElkIDogbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGNyZWF0ZU1vZGVsIChvcHRpb25zID0ge30pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMubW9kZWxJZCB8fCB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdKSB7XG4gICAgICBvcHRpb25zLm1vZGVsSWQgPSBgbW9kZWwke05FWFRfTU9ERUxfSUR9YDtcbiAgICAgIE5FWFRfTU9ERUxfSUQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5vcmlncmFwaCA9IHRoaXM7XG4gICAgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwob3B0aW9ucyk7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBvcHRpb25zLm1vZGVsSWQ7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXTtcbiAgfVxuICBkZWxldGVNb2RlbCAobW9kZWxJZCA9IHRoaXMuY3VycmVudE1vZGVsSWQpIHtcbiAgICBpZiAoIXRoaXMubW9kZWxzW21vZGVsSWRdKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBub24tZXhpc3RlbnQgbW9kZWw6ICR7bW9kZWxJZH1gKTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWxzW21vZGVsSWRdO1xuICAgIGlmICh0aGlzLl9jdXJyZW50TW9kZWxJZCA9PT0gbW9kZWxJZCkge1xuICAgICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICB9XG4gICAgdGhpcy5zYXZlKCk7XG4gIH1cbiAgZGVsZXRlQWxsTW9kZWxzICgpIHtcbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE9yaWdyYXBoO1xuIiwiaW1wb3J0IE9yaWdyYXBoIGZyb20gJy4vT3JpZ3JhcGguanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IEZpbGVSZWFkZXIgZnJvbSAnZmlsZXJlYWRlcic7XG5cbmxldCBvcmlncmFwaCA9IG5ldyBPcmlncmFwaChGaWxlUmVhZGVyLCBudWxsKTtcbm9yaWdyYXBoLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgb3JpZ3JhcGg7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsIl9ldmVudEhhbmRsZXJzIiwiX3N0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImV2ZW50IiwibmFtZXNwYWNlIiwic3BsaXQiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJpbmRleE9mIiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJoYW5kbGVDYWxsYmFjayIsInNldFRpbWVvdXQiLCJhcHBseSIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJHZW5lcmljV3JhcHBlciIsIm9wdGlvbnMiLCJ0YWJsZSIsInVuZGVmaW5lZCIsIkVycm9yIiwiY2xhc3NPYmoiLCJyb3ciLCJjb25uZWN0ZWRJdGVtcyIsImNvbm5lY3RJdGVtIiwiaXRlbSIsInRhYmxlSWQiLCJkaXNjb25uZWN0IiwiaXRlbUxpc3QiLCJ2YWx1ZXMiLCJpbnN0YW5jZUlkIiwiY2xhc3NJZCIsImVxdWFscyIsIml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInRhYmxlSWRzIiwibGltaXQiLCJJbmZpbml0eSIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJtb2RlbCIsInRhYmxlcyIsImJ1aWxkQ2FjaGUiLCJfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwibGVuZ3RoIiwidGhpc1RhYmxlSWQiLCJyZW1haW5pbmdUYWJsZUlkcyIsInNsaWNlIiwiZXhlYyIsIm5hbWUiLCJUYWJsZSIsIl9leHBlY3RlZEF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVzIiwiX29ic2VydmVkQXR0cmlidXRlcyIsIl9kZXJpdmVkVGFibGVzIiwiZGVyaXZlZFRhYmxlcyIsIl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiaHlkcmF0ZUZ1bmN0aW9uIiwiX3N1cHByZXNzZWRBdHRyaWJ1dGVzIiwic3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJfc3VwcHJlc3NJbmRleCIsInN1cHByZXNzSW5kZXgiLCJfaW5kZXhGaWx0ZXIiLCJpbmRleEZpbHRlciIsIl9hdHRyaWJ1dGVGaWx0ZXJzIiwiYXR0cmlidXRlRmlsdGVycyIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwidXNlZEJ5Q2xhc3NlcyIsIl91c2VkQnlDbGFzc2VzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIml0ZXJhdGUiLCJyZXNldCIsIl9jYWNoZSIsIl9idWlsZENhY2hlIiwiX3BhcnRpYWxDYWNoZSIsIml0ZXJhdG9yIiwiX2l0ZXJhdGUiLCJjb21wbGV0ZWQiLCJuZXh0IiwiZG9uZSIsIl9maW5pc2hJdGVtIiwid3JhcHBlZEl0ZW0iLCJrZWVwIiwiX3dyYXAiLCJvdGhlckl0ZW0iLCJpdGVtc1RvQ29ubmVjdCIsImRlcml2ZWRUYWJsZSIsIl9jYWNoZVByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY291bnRSb3dzIiwiY2FjaGUiLCJnZXRJbmRleERldGFpbHMiLCJkZXRhaWxzIiwic3VwcHJlc3NlZCIsImZpbHRlcmVkIiwiZ2V0QXR0cmlidXRlRGV0YWlscyIsImFsbEF0dHJzIiwiZXhwZWN0ZWQiLCJvYnNlcnZlZCIsImRlcml2ZWQiLCJjdXJyZW50RGF0YSIsImRhdGEiLCJjb21wbGV0ZSIsImRlcml2ZUF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsInN1cHByZXNzQXR0cmlidXRlIiwiYWRkRmlsdGVyIiwiX2Rlcml2ZVRhYmxlIiwibmV3VGFibGUiLCJjcmVhdGVUYWJsZSIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZSIsImZpbmQiLCJ0YWJsZU9iaiIsImV2ZXJ5Iiwib3B0aW9uTmFtZSIsIm9wdGlvblZhbHVlIiwiYWdncmVnYXRlIiwiZXhwYW5kIiwiZGVsaW1pdGVyIiwiY2xvc2VkRmFjZXQiLCJvcGVuRmFjZXQiLCJjbG9zZWRUcmFuc3Bvc2UiLCJpbmRleGVzIiwib3BlblRyYW5zcG9zZSIsImNvbm5lY3QiLCJvdGhlclRhYmxlTGlzdCIsIm90aGVyVGFibGUiLCJjbGFzc2VzIiwicGFyZW50VGFibGVzIiwicmVkdWNlIiwiYWdnIiwiaW5Vc2UiLCJzb21lIiwic291cmNlVGFibGVJZHMiLCJ0YXJnZXRUYWJsZUlkcyIsImRlbGV0ZSIsImVyciIsInBhcmVudFRhYmxlIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQWdncmVnYXRlZFRhYmxlIiwiX2F0dHJpYnV0ZSIsIl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJyZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJfZGVoeWRyYXRlRnVuY3Rpb24iLCJkZXJpdmVSZWR1Y2VkQXR0cmlidXRlIiwiX3VwZGF0ZUl0ZW0iLCJvcmlnaW5hbFdyYXBwZWRJdGVtIiwibmV3V3JhcHBlZEl0ZW0iLCJ3cmFwcGVkUGFyZW50IiwiU3RyaW5nIiwiZXhpc3RpbmdJdGVtIiwibmV3SXRlbSIsInJlZHVjZWQiLCJFeHBhbmRlZFRhYmxlIiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJHZW5lcmljQ2xhc3MiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbnMiLCJzZXRDbGFzc05hbWUiLCJoYXNDdXN0b21OYW1lIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm92ZXJ3cml0ZSIsImNyZWF0ZUNsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIl9kZXJpdmVOZXdDbGFzcyIsImdldFNhbXBsZUdyYXBoIiwicm9vdENsYXNzIiwiTm9kZVdyYXBwZXIiLCJlZGdlcyIsImVkZ2VJZHMiLCJlZGdlQ2xhc3NJZHMiLCJlZGdlSWQiLCJlZGdlQ2xhc3MiLCJzb3VyY2VDbGFzc0lkIiwicmV2ZXJzZSIsImNvbmNhdCIsInBhaXJ3aXNlTmVpZ2hib3Job29kIiwiZWRnZSIsInBhaXJ3aXNlRWRnZXMiLCJOb2RlQ2xhc3MiLCJhdXRvY29ubmVjdCIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImlzU291cmNlIiwidGFyZ2V0Q2xhc3NJZCIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0Iiwibm9kZUNsYXNzIiwidGFibGVJZExpc3QiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsInRhcmdldEVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibmV3Tm9kZUNsYXNzIiwiY29ubmVjdGVkQ2xhc3NlcyIsImVkZ2VDbGFzc0lkIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VOb2RlcyIsInNvdXJjZVRhYmxlSWQiLCJ0YXJnZXROb2RlcyIsInRhcmdldFRhYmxlSWQiLCJzb3VyY2UiLCJ0YXJnZXQiLCJoeXBlcmVkZ2UiLCJzb3VyY2VzIiwidGFyZ2V0cyIsIkVkZ2VDbGFzcyIsIl9zcGxpdFRhYmxlSWRMaXN0Iiwib3RoZXJDbGFzcyIsIm5vZGVUYWJsZUlkTGlzdCIsImVkZ2VUYWJsZUlkIiwiZWRnZVRhYmxlSWRMaXN0Iiwic3RhdGljRXhpc3RzIiwidGFibGVEaXN0YW5jZXMiLCJzdGFydHNXaXRoIiwiZGlzdCIsIk1hdGgiLCJhYnMiLCJmaWx0ZXIiLCJzb3J0IiwiYSIsImIiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwic2lkZSIsImNvbm5lY3RTb3VyY2UiLCJjb25uZWN0VGFyZ2V0IiwidG9nZ2xlRGlyZWN0aW9uIiwic3dhcHBlZERpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsInVuc2hpZnQiLCJleGlzdGluZ1NvdXJjZUNsYXNzIiwiZXhpc3RpbmdUYXJnZXRDbGFzcyIsIkRBVEFMSUJfRk9STUFUUyIsIk5ldHdvcmtNb2RlbCIsIm9yaWdyYXBoIiwibW9kZWxJZCIsIl9vcmlncmFwaCIsIl9uZXh0Q2xhc3NJZCIsIl9uZXh0VGFibGVJZCIsImh5ZHJhdGUiLCJDTEFTU0VTIiwiVEFCTEVTIiwiX3NhdmVUaW1lb3V0Iiwic2F2ZSIsInVuc2F2ZWQiLCJyYXdPYmplY3QiLCJUWVBFUyIsInNlbGVjdG9yIiwicmVuYW1lIiwibmV3TmFtZSIsImFubm90YXRlIiwia2V5IiwiZGVsZXRlQW5ub3RhdGlvbiIsImRlbGV0ZU1vZGVsIiwiYWRkRmlsZUFzU3RhdGljVGFibGUiLCJmaWxlT2JqIiwiZW5jb2RpbmciLCJtaW1lIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJjb25zb2xlIiwid2FybiIsInRleHQiLCJyZWFkZXIiLCJGaWxlUmVhZGVyIiwib25sb2FkIiwicmVhZEFzVGV4dCIsImFkZFN0cmluZ0FzU3RhdGljVGFibGUiLCJleHRlbnNpb24iLCJsb29rdXAiLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNUYWJsZSIsIkFycmF5IiwiZGVsZXRlQWxsVW51c2VkVGFibGVzIiwiYnJhbmNoTGltaXQiLCJub2RlTGltaXQiLCJlZGdlTGltaXQiLCJ0cmlwbGVMaW1pdCIsInNhbXBsZUdyYXBoIiwibm9kZXMiLCJub2RlTG9va3VwIiwiZWRnZUxvb2t1cCIsImxpbmtzIiwibnVtVHJpcGxlcyIsImFkZE5vZGUiLCJub2RlIiwiYWRkRWRnZSIsImFkZFRyaXBsZSIsImNsYXNzTGlzdCIsImdldEluc3RhbmNlR3JhcGgiLCJpbnN0YW5jZXMiLCJncmFwaCIsImVkZ2VUYWJsZUVudHJpZXMiLCJpbnN0YW5jZSIsIm5vZGVJbnN0YW5jZSIsImR1bW15IiwiZWRnZUluc3RhbmNlIiwiZ2V0TmV0d29ya01vZGVsR3JhcGgiLCJyYXciLCJpbmNsdWRlRHVtbWllcyIsImVkZ2VDbGFzc2VzIiwiY2xhc3NMb29rdXAiLCJjbGFzc0Nvbm5lY3Rpb25zIiwiY2xhc3NTcGVjIiwiaWQiLCJsb2NhdGlvbiIsImdldFRhYmxlRGVwZW5kZW5jeUdyYXBoIiwidGFibGVMb29rdXAiLCJ0YWJsZUxpbmtzIiwidGFibGVMaXN0IiwidGFibGVTcGVjIiwiZ2V0RnVsbFNjaGVtYUdyYXBoIiwiY3JlYXRlU2NoZW1hTW9kZWwiLCJuZXdNb2RlbCIsImNyZWF0ZU1vZGVsIiwiTkVYVF9NT0RFTF9JRCIsIk9yaWdyYXBoIiwibG9jYWxTdG9yYWdlIiwicGx1Z2lucyIsIm1vZGVscyIsImV4aXN0aW5nTW9kZWxzIiwiZ2V0SXRlbSIsIkpTT04iLCJwYXJzZSIsIl9jdXJyZW50TW9kZWxJZCIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luIiwic2V0SXRlbSIsInN0cmluZ2lmeSIsImNsb3NlQ3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsSWQiLCJkZWxldGVBbGxNb2RlbHMiLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxjQUFMLEdBQXNCLEVBQXRCO1dBQ0tDLGVBQUwsR0FBdUIsRUFBdkI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNuQixDQUFDQyxLQUFELEVBQVFDLFNBQVIsSUFBcUJILFNBQVMsQ0FBQ0ksS0FBVixDQUFnQixHQUFoQixDQUF6QjtXQUNLUCxjQUFMLENBQW9CSyxLQUFwQixJQUE2QixLQUFLTCxjQUFMLENBQW9CSyxLQUFwQixLQUMzQjtZQUFNO09BRFI7O1VBRUksQ0FBQ0MsU0FBTCxFQUFnQjthQUNUTixjQUFMLENBQW9CSyxLQUFwQixFQUEyQixFQUEzQixFQUErQkcsSUFBL0IsQ0FBb0NKLFFBQXBDO09BREYsTUFFTzthQUNBSixjQUFMLENBQW9CSyxLQUFwQixFQUEyQkMsU0FBM0IsSUFBd0NGLFFBQXhDOzs7O0lBR0pLLEdBQUcsQ0FBRU4sU0FBRixFQUFhQyxRQUFiLEVBQXVCO1VBQ3BCLENBQUNDLEtBQUQsRUFBUUMsU0FBUixJQUFxQkgsU0FBUyxDQUFDSSxLQUFWLENBQWdCLEdBQWhCLENBQXpCOztVQUNJLEtBQUtQLGNBQUwsQ0FBb0JLLEtBQXBCLENBQUosRUFBZ0M7WUFDMUIsQ0FBQ0MsU0FBTCxFQUFnQjtjQUNWLENBQUNGLFFBQUwsRUFBZTtpQkFDUkosY0FBTCxDQUFvQkssS0FBcEIsRUFBMkIsRUFBM0IsSUFBaUMsRUFBakM7V0FERixNQUVPO2dCQUNESyxLQUFLLEdBQUcsS0FBS1YsY0FBTCxDQUFvQkssS0FBcEIsRUFBMkIsRUFBM0IsRUFB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
