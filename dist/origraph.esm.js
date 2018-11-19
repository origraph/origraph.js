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
        window.setTimeout(() => {
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
  constructor(FileReader, localStorage) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node

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

let origraph = new Origraph(window.FileReader, window.localStorage);
origraph.version = pkg.version;

export default origraph;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRXhwYW5kZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRmFjZXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UcmFuc3Bvc2VkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0Nvbm5lY3RlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gfHxcbiAgICAgICAgeyAnJzogW10gfTtcbiAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0gPSBjYWxsYmFjaztcbiAgICAgIH1cbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10gPSBbXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50LCAuLi5hcmdzKSB7XG4gICAgICBjb25zdCBoYW5kbGVDYWxsYmFjayA9IGNhbGxiYWNrID0+IHtcbiAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWVzcGFjZSBvZiBPYmplY3Qua2V5cyh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkpIHtcbiAgICAgICAgICBpZiAobmFtZXNwYWNlID09PSAnJykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmZvckVhY2goaGFuZGxlQ2FsbGJhY2spO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoYW5kbGVDYWxsYmFjayh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICB0aGlzLnRhYmxlID0gb3B0aW9ucy50YWJsZTtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLnRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGFuZCB0YWJsZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc09iaiA9IG9wdGlvbnMuY2xhc3NPYmogfHwgbnVsbDtcbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSBvcHRpb25zLmNvbm5lY3RlZEl0ZW1zIHx8IHt9O1xuICB9XG4gIGNvbm5lY3RJdGVtIChpdGVtKSB7XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdID0gdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdIHx8IFtdO1xuICAgIGlmICh0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0uaW5kZXhPZihpdGVtKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBgJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XyR7dGhpcy5pbmRleH1gO1xuICB9XG4gIGVxdWFscyAoaXRlbSkge1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlSWQgPT09IGl0ZW0uaW5zdGFuY2VJZDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAoeyB0YWJsZUlkcywgbGltaXQgPSBJbmZpbml0eSB9KSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSkge1xuICAgICAgeWllbGQgaXRlbTtcbiAgICAgIGkrKztcbiAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbdGFibGVJZHNbMF1dIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGhpc1RhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1t0aGlzVGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIHVzZWRCeUNsYXNzZXM6IHRoaXMuX3VzZWRCeUNsYXNzZXMsXG4gICAgICBkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zOiB7fSxcbiAgICAgIHN1cHByZXNzZWRBdHRyaWJ1dGVzOiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyxcbiAgICAgIHN1cHByZXNzSW5kZXg6IHRoaXMuX3N1cHByZXNzSW5kZXgsXG4gICAgICBhdHRyaWJ1dGVGaWx0ZXJzOiB7fSxcbiAgICAgIGluZGV4RmlsdGVyOiAodGhpcy5faW5kZXhGaWx0ZXIgJiYgdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbih0aGlzLl9pbmRleEZpbHRlcikpIHx8IG51bGxcbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICByZXN1bHQuYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaHlkcmF0ZUZ1bmN0aW9uIChzdHJpbmdpZmllZEZ1bmMpIHtcbiAgICBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBHZW5lcmljIGNhY2hpbmcgc3R1ZmY7IHRoaXMgaXNuJ3QganVzdCBmb3IgcGVyZm9ybWFuY2UuIENvbm5lY3RlZFRhYmxlJ3NcbiAgICAvLyBhbGdvcml0aG0gcmVxdWlyZXMgdGhhdCBpdHMgcGFyZW50IHRhYmxlcyBoYXZlIHByZS1idWlsdCBpbmRleGVzICh3ZVxuICAgIC8vIHRlY2huaWNhbGx5IGNvdWxkIGltcGxlbWVudCBpdCBkaWZmZXJlbnRseSwgYnV0IGl0IHdvdWxkIGJlIGV4cGVuc2l2ZSxcbiAgICAvLyByZXF1aXJlcyB0cmlja3kgbG9naWMsIGFuZCB3ZSdyZSBhbHJlYWR5IGJ1aWxkaW5nIGluZGV4ZXMgZm9yIHNvbWUgdGFibGVzXG4gICAgLy8gbGlrZSBBZ2dyZWdhdGVkVGFibGUgYW55d2F5KVxuICAgIGlmIChvcHRpb25zLnJlc2V0KSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQgPT09IHVuZGVmaW5lZCA/IEluZmluaXR5IDogb3B0aW9ucy5saW1pdDtcbiAgICAgIHlpZWxkICogT2JqZWN0LnZhbHVlcyh0aGlzLl9jYWNoZSkuc2xpY2UoMCwgbGltaXQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHlpZWxkICogYXdhaXQgdGhpcy5fYnVpbGRDYWNoZShvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpO1xuICAgIGxldCBjb21wbGV0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBpdGVyYXRpb24gd2FzIGNhbmNlbGxlZDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgY29tcGxldGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHRlbXAudmFsdWUpO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGVtcC52YWx1ZS5pbmRleF0gPSB0ZW1wLnZhbHVlO1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gd3JhcHBlZEl0ZW0ucm93KSB7XG4gICAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGRlbGV0ZSB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBmdW5jKHdyYXBwZWRJdGVtLnJvd1thdHRyXSk7XG4gICAgICBpZiAoIWtlZXApIHsgYnJlYWs7IH1cbiAgICB9XG4gICAgaWYgKGtlZXApIHtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbmlzaCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3cmFwcGVkSXRlbS5kaXNjb25uZWN0KCk7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaWx0ZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIGtlZXA7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBjbGFzc09iaiA/IGNsYXNzT2JqLl93cmFwKG9wdGlvbnMpIDogbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3Qgb3RoZXJJdGVtIG9mIG9wdGlvbnMuaXRlbXNUb0Nvbm5lY3QgfHwgW10pIHtcbiAgICAgIHdyYXBwZWRJdGVtLmNvbm5lY3RJdGVtKG90aGVySXRlbSk7XG4gICAgICBvdGhlckl0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGZvciAoY29uc3QgZGVyaXZlZFRhYmxlIG9mIHRoaXMuZGVyaXZlZFRhYmxlcykge1xuICAgICAgZGVyaXZlZFRhYmxlLnJlc2V0KCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncmVzZXQnKTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgYnVpbGRDYWNoZSAoKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGU7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0ZW1wIG9mIHRoaXMuX2J1aWxkQ2FjaGUoKSkge30gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgICAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgY291bnRSb3dzICgpIHtcbiAgICBjb25zdCBjYWNoZSA9IGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpO1xuICAgIHJldHVybiBjYWNoZSA/IE9iamVjdC5rZXlzKGNhY2hlKS5sZW5ndGggOiAtMTtcbiAgfVxuICBnZXRJbmRleERldGFpbHMgKCkge1xuICAgIGNvbnN0IGRldGFpbHMgPSB7IG5hbWU6IG51bGwgfTtcbiAgICBpZiAodGhpcy5fc3VwcHJlc3NJbmRleCkge1xuICAgICAgZGV0YWlscy5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBkZXRhaWxzLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGRldGFpbHM7XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZXhwZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ub2JzZXJ2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmRlcml2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0QXR0cmlidXRlRGV0YWlscygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBzdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZV0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgYWRkRmlsdGVyIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9pbmRleEZpbHRlciA9IGZ1bmM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgZGVsaW1pdGVyXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9O1xuICAgICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gaW5kZXhlcy5tYXAoaW5kZXggPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4XG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoeyBsaW1pdCB9KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdDb25uZWN0ZWRUYWJsZSdcbiAgICB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3Nlcykuc29tZShjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGVJZCA9PT0gdGhpcy50YWJsZUlkIHx8XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTEgfHxcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGlmICh0aGlzLmluVXNlKSB7XG4gICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBpbi11c2UgdGFibGUgJHt0aGlzLnRhYmxlSWR9YCk7XG4gICAgICBlcnIuaW5Vc2UgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3RUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpcmVkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEFnZ3JlZ2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMubW9kZWwuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMubW9kZWwuX2RlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gJ+KGpicgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSAoYXR0ciwgZnVuYykge1xuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIF91cGRhdGVJdGVtIChvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyhvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0udHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucykge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugc28gdGhhdCBBZ2dyZWdhdGVkVGFibGUgY2FuIHRha2UgYWR2YW50YWdlXG4gICAgLy8gb2YgdGhlIHBhcnRpYWxseS1idWlsdCBjYWNoZSBhcyBpdCBnb2VzLCBhbmQgcG9zdHBvbmUgZmluaXNoaW5nIGl0ZW1zXG4gICAgLy8gdW50aWwgYWZ0ZXIgdGhlIHBhcmVudCB0YWJsZSBoYXMgYmVlbiBmdWxseSBpdGVyYXRlZFxuXG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5faXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3dyYXBwZWRJdGVtLmluZGV4XSA9IHdyYXBwZWRJdGVtO1xuICAgICAgLy8gR28gYWhlYWQgYW5kIHlpZWxkIHRoZSB1bmZpbmlzaGVkIGl0ZW07IHRoaXMgbWFrZXMgaXQgcG9zc2libGUgZm9yXG4gICAgICAvLyBjbGllbnQgYXBwcyB0byBiZSBtb3JlIHJlc3BvbnNpdmUgYW5kIHJlbmRlciBwYXJ0aWFsIHJlc3VsdHMsIGJ1dCBhbHNvXG4gICAgICAvLyBtZWFucyB0aGF0IHRoZXkgbmVlZCB0byB3YXRjaCBmb3Igd3JhcHBlZEl0ZW0ub24oJ3VwZGF0ZScpIGV2ZW50c1xuICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgfVxuXG4gICAgLy8gU2Vjb25kIHBhc3M6IG5vdyB0aGF0IHdlJ3ZlIGNvbXBsZXRlZCB0aGUgZnVsbCBpdGVyYXRpb24gb2YgdGhlIHBhcmVudFxuICAgIC8vIHRhYmxlLCB3ZSBjYW4gZmluaXNoIGVhY2ggaXRlbVxuICAgIGZvciAoY29uc3QgaW5kZXggaW4gdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICBpZiAoIXRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gU3RyaW5nKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0pO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlW2luZGV4XSkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0l0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgICBleGlzdGluZ0l0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0oZXhpc3RpbmdJdGVtKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlSXRlbShleGlzdGluZ0l0ZW0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fdXBkYXRlSXRlbShuZXdJdGVtLCB3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSBzdXBlci5nZXRBdHRyaWJ1dGVEZXRhaWxzKCk7XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLnJlZHVjZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEFnZ3JlZ2F0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRXhwYW5kZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5kZWxpbWl0ZXIgPSBvcHRpb25zLmRlbGltaXRlciB8fCAnLCc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAn4oakJztcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IHZhbHVlcyA9ICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdIHx8ICcnKS5zcGxpdCh0aGlzLmRlbGltaXRlcik7XG4gICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuICAgICAgICBjb25zdCByb3cgPSB7fTtcbiAgICAgICAgcm93W3RoaXMuX2F0dHJpYnV0ZV0gPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdyxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmFjZXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICB0aGlzLl92YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBgWyR7dGhpcy5fdmFsdWV9XWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBpZiAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgLy8gTm9ybWFsIGZhY2V0aW5nIGp1c3QgZ2l2ZXMgYSBzdWJzZXQgb2YgdGhlIG9yaWdpbmFsIHRhYmxlXG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3c6IE9iamVjdC5hc3NpZ24oe30sIHdyYXBwZWRQYXJlbnQucm93KSxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmFjZXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBUcmFuc3Bvc2VkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2luZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5faW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5pbmRleCA9IHRoaXMuX2luZGV4O1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBg4bWAJHt0aGlzLl9pbmRleH1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGF3YWl0IHBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcblxuICAgIC8vIEl0ZXJhdGUgdGhlIHJvdydzIGF0dHJpYnV0ZXMgYXMgaW5kZXhlc1xuICAgIGNvbnN0IHdyYXBwZWRQYXJlbnQgPSBwYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5faW5kZXhdIHx8IHsgcm93OiB7fSB9O1xuICAgIGZvciAoY29uc3QgWyBpbmRleCwgdmFsdWUgXSBvZiBPYmplY3QuZW50cmllcyh3cmFwcGVkUGFyZW50LnJvdykpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBTcGluIHRocm91Z2ggYWxsIG9mIHRoZSBwYXJlbnRUYWJsZXMgc28gdGhhdCB0aGVpciBfY2FjaGUgaXMgcHJlLWJ1aWx0XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiBwYXJlbnRUYWJsZXMpIHtcbiAgICAgIGF3YWl0IHBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcbiAgICB9XG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZSkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbaW5kZXhdKVxuICAgICAgfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb25zID0gb3B0aW9ucy5hbm5vdGF0aW9ucyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zXG4gICAgfTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdGFibGUgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgX2Rlcml2ZU5ld0NsYXNzIChuZXdUYWJsZSwgdHlwZSA9IHRoaXMuY29uc3RydWN0b3IubmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlXG4gICAgfSk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKSk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUsIGRlbGltaXRlcikpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuVHJhbnNwb3NlKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXRTYW1wbGVHcmFwaCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMucm9vdENsYXNzID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5nZXRTYW1wbGVHcmFwaChvcHRpb25zKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0geyBsaW1pdDogSW5maW5pdHkgfSkge1xuICAgIGNvbnN0IGVkZ2VJZHMgPSBvcHRpb25zLmVkZ2VJZHMgfHwgdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHM7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIE9iamVjdC5rZXlzKGVkZ2VJZHMpKSB7XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLm1vZGVsLmNsYXNzZXNbZWRnZUlkXTtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc09iai5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMudGFibGVJZHMgPSBlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy50YWJsZUlkcyA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMob3B0aW9ucykpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgaSsrO1xuICAgICAgICBpZiAoaSA+PSBvcHRpb25zLmxpbWl0KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jICogcGFpcndpc2VOZWlnaGJvcmhvb2QgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgdGhpcy5lZGdlcyhvcHRpb25zKSkge1xuICAgICAgeWllbGQgKiBlZGdlLnBhaXJ3aXNlRWRnZXMob3B0aW9ucyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuZWRnZUNsYXNzSWRzID0gdGhpcy5lZGdlQ2xhc3NJZHM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgTm9kZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoeyBhdXRvY29ubmVjdCA9IGZhbHNlIH0pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgaWYgKCFhdXRvY29ubmVjdCB8fCBlZGdlQ2xhc3NJZHMubGVuZ3RoID4gMikge1xuICAgICAgLy8gSWYgdGhlcmUgYXJlIG1vcmUgdGhhbiB0d28gZWRnZXMsIGJyZWFrIGFsbCBjb25uZWN0aW9ucyBhbmQgbWFrZVxuICAgICAgLy8gdGhpcyBhIGZsb2F0aW5nIGVkZ2UgKGZvciBub3csIHdlJ3JlIG5vdCBkZWFsaW5nIGluIGh5cGVyZWRnZXMpXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gV2l0aCBvbmx5IG9uZSBjb25uZWN0aW9uLCB0aGlzIG5vZGUgc2hvdWxkIGJlY29tZSBhIHNlbGYtZWRnZVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAvLyBBcmUgd2UgdGhlIHNvdXJjZSBvciB0YXJnZXQgb2YgdGhlIGV4aXN0aW5nIGVkZ2UgKGludGVybmFsbHksIGluIHRlcm1zXG4gICAgICAvLyBvZiBzb3VyY2VJZCAvIHRhcmdldElkLCBub3QgZWRnZUNsYXNzLmRpcmVjdGlvbik/XG4gICAgICBjb25zdCBpc1NvdXJjZSA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQ7XG5cbiAgICAgIC8vIEFzIHdlJ3JlIGNvbnZlcnRlZCB0byBhbiBlZGdlLCBvdXIgbmV3IHJlc3VsdGluZyBzb3VyY2UgQU5EIHRhcmdldFxuICAgICAgLy8gc2hvdWxkIGJlIHdoYXRldmVyIGlzIGF0IHRoZSBvdGhlciBlbmQgb2YgZWRnZUNsYXNzIChpZiBhbnl0aGluZylcbiAgICAgIGlmIChpc1NvdXJjZSkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgICAgfVxuICAgICAgLy8gSWYgdGhlcmUgaXMgYSBub2RlIGNsYXNzIG9uIHRoZSBvdGhlciBlbmQgb2YgZWRnZUNsYXNzLCBhZGQgb3VyXG4gICAgICAvLyBpZCB0byBpdHMgbGlzdCBvZiBjb25uZWN0aW9uc1xuICAgICAgY29uc3Qgbm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF07XG4gICAgICBpZiAobm9kZUNsYXNzKSB7XG4gICAgICAgIG5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIHRhYmxlSWQgbGlzdHMgc2hvdWxkIGVtYW5hdGUgb3V0IGZyb20gdGhlIChuZXcpIGVkZ2UgdGFibGU7IGFzc3VtaW5nXG4gICAgICAvLyAoZm9yIGEgbW9tZW50KSB0aGF0IGlzU291cmNlID09PSB0cnVlLCB3ZSdkIGNvbnN0cnVjdCB0aGUgdGFibGVJZCBsaXN0XG4gICAgICAvLyBsaWtlIHRoaXM6XG4gICAgICBsZXQgdGFibGVJZExpc3QgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIGVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmICghaXNTb3VyY2UpIHtcbiAgICAgICAgLy8gV2hvb3BzLCBnb3QgaXQgYmFja3dhcmRzIVxuICAgICAgICB0YWJsZUlkTGlzdC5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZWRnZUNsYXNzLmRpcmVjdGVkO1xuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YWJsZUlkTGlzdDtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgIC8vIE9rYXksIHdlJ3ZlIGdvdCB0d28gZWRnZXMsIHNvIHRoaXMgaXMgYSBsaXR0bGUgbW9yZSBzdHJhaWdodGZvcndhcmRcbiAgICAgIGxldCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIGxldCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgIC8vIEZpZ3VyZSBvdXQgdGhlIGRpcmVjdGlvbiwgaWYgdGhlcmUgaXMgb25lXG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLmRpcmVjdGVkICYmIHRhcmdldEVkZ2VDbGFzcy5kaXJlY3RlZCkge1xuICAgICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGhhcHBlbmVkIHRvIGdldCB0aGUgZWRnZXMgaW4gb3JkZXI7IHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBnb3QgdGhlIGVkZ2VzIGJhY2t3YXJkczsgc3dhcCB0aGVtIGFuZCBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgICAgIHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBub3cgd2Uga25vdyBob3cgdG8gc2V0IHNvdXJjZSAvIHRhcmdldCBpZHNcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IHNvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICAvLyBBZGQgdGhpcyBjbGFzcyB0byB0aGUgc291cmNlJ3MgLyB0YXJnZXQncyBlZGdlQ2xhc3NJZHNcbiAgICAgIHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnRhcmdldENsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIC8vIENvbmNhdGVuYXRlIHRoZSBpbnRlcm1lZGlhdGUgdGFibGVJZCBsaXN0cywgZW1hbmF0aW5nIG91dCBmcm9tIHRoZVxuICAgICAgLy8gKG5ldykgZWRnZSB0YWJsZVxuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgc291cmNlRWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChzb3VyY2VFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFyZ2V0RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyB0YXJnZXRFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAodGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnRhcmdldFRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIC8vIERpc2Nvbm5lY3QgdGhlIGV4aXN0aW5nIGVkZ2UgY2xhc3NlcyBmcm9tIHRoZSBuZXcgKG5vdyBlZGdlKSBjbGFzc1xuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzSWRzO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBhdHRyaWJ1dGUsIG90aGVyQXR0cmlidXRlIH0pIHtcbiAgICBsZXQgdGhpc0hhc2gsIG90aGVySGFzaCwgc291cmNlVGFibGVJZHMsIHRhcmdldFRhYmxlSWRzO1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXNIYXNoID0gdGhpcy50YWJsZTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXNIYXNoID0gdGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gWyB0aGlzSGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGlmIChvdGhlckF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGU7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZS5hZ2dyZWdhdGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbIG90aGVySGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIC8vIElmIHdlIGhhdmUgYSBzZWxmIGVkZ2UgY29ubmVjdGluZyB0aGUgc2FtZSBhdHRyaWJ1dGUsIHdlIGNhbiBqdXN0IHVzZVxuICAgIC8vIHRoZSBBZ2dyZWdhdGVkVGFibGUgYXMgdGhlIGVkZ2UgdGFibGU7IG90aGVyd2lzZSB3ZSBuZWVkIHRvIGNyZWF0ZSBhXG4gICAgLy8gQ29ubmVjdGVkVGFibGVcbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXMgPT09IG90aGVyTm9kZUNsYXNzICYmIGF0dHJpYnV0ZSA9PT0gb3RoZXJBdHRyaWJ1dGVcbiAgICAgID8gdGhpc0hhc2ggOiB0aGlzSGFzaC5jb25uZWN0KFtvdGhlckhhc2hdKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldFRhYmxlSWRzXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdFZGdlQ2xhc3M7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHN1cGVyLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpO1xuICAgIHRoaXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBuZXdOb2RlQ2xhc3MsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgdGhpcy5jb25uZWN0ZWRDbGFzc2VzKCkpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgb3B0aW9ucy50YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmouc291cmNlVGFibGVJZHNcbiAgICAgIC5jb25jYXQoWyBzb3VyY2VUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkXS50YWJsZUlkO1xuICAgIG9wdGlvbnMudGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnRhcmdldFRhYmxlSWRzXG4gICAgICAuY29uY2F0KFsgdGFyZ2V0VGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogcGFpcndpc2VFZGdlcyAob3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucykpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucykpIHtcbiAgICAgICAgeWllbGQgeyBzb3VyY2UsIGVkZ2U6IHRoaXMsIHRhcmdldCB9O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyBoeXBlcmVkZ2UgKG9wdGlvbnMpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBzb3VyY2VzOiBbXSxcbiAgICAgIHRhcmdldHM6IFtdLFxuICAgICAgZWRnZTogdGhpc1xuICAgIH07XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgcmVzdWx0LnB1c2goc291cmNlKTtcbiAgICB9XG4gICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgcmVzdWx0LnB1c2godGFyZ2V0KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBFZGdlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAvLyBzb3VyY2VUYWJsZUlkcyBhbmQgdGFyZ2V0VGFibGVJZHMgYXJlIGxpc3RzIG9mIGFueSBpbnRlcm1lZGlhdGUgdGFibGVzLFxuICAgIC8vIGJlZ2lubmluZyB3aXRoIHRoZSBlZGdlIHRhYmxlIChidXQgbm90IGluY2x1ZGluZyBpdCksIHRoYXQgbGVhZCB0byB0aGVcbiAgICAvLyBzb3VyY2UgLyB0YXJnZXQgbm9kZSB0YWJsZXMgKGJ1dCBub3QgaW5jbHVkaW5nKSB0aG9zZVxuXG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMuc291cmNlVGFibGVJZHMgfHwgW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgfHwgW107XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC5zb3VyY2VUYWJsZUlkcyA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldFRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEVkZ2VXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIF9zcGxpdFRhYmxlSWRMaXN0ICh0YWJsZUlkTGlzdCwgb3RoZXJDbGFzcykge1xuICAgIGxldCByZXN1bHQgPSB7XG4gICAgICBub2RlVGFibGVJZExpc3Q6IFtdLFxuICAgICAgZWRnZVRhYmxlSWQ6IG51bGwsXG4gICAgICBlZGdlVGFibGVJZExpc3Q6IFtdXG4gICAgfTtcbiAgICBpZiAodGFibGVJZExpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBXZWlyZCBjb3JuZXIgY2FzZSB3aGVyZSB3ZSdyZSB0cnlpbmcgdG8gY3JlYXRlIGFuIGVkZ2UgYmV0d2VlblxuICAgICAgLy8gYWRqYWNlbnQgb3IgaWRlbnRpY2FsIHRhYmxlcy4uLiBjcmVhdGUgYSBDb25uZWN0ZWRUYWJsZVxuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGhpcy50YWJsZS5jb25uZWN0KG90aGVyQ2xhc3MudGFibGUpLnRhYmxlSWQ7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgYSB0YWJsZSBpbiB0aGUgbWlkZGxlIGFzIHRoZSBuZXcgZWRnZSB0YWJsZTsgcHJpb3JpdGl6ZVxuICAgICAgLy8gU3RhdGljVGFibGUgYW5kIFN0YXRpY0RpY3RUYWJsZVxuICAgICAgbGV0IHN0YXRpY0V4aXN0cyA9IGZhbHNlO1xuICAgICAgbGV0IHRhYmxlRGlzdGFuY2VzID0gdGFibGVJZExpc3QubWFwKCh0YWJsZUlkLCBpbmRleCkgPT4ge1xuICAgICAgICBzdGF0aWNFeGlzdHMgPSBzdGF0aWNFeGlzdHMgfHwgdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgcmV0dXJuIHsgdGFibGVJZCwgaW5kZXgsIGRpc3Q6IE1hdGguYWJzKHRhYmxlSWRMaXN0IC8gMiAtIGluZGV4KSB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIHRhYmxlRGlzdGFuY2VzID0gdGFibGVEaXN0YW5jZXMuZmlsdGVyKCh7IHRhYmxlSWQgfSkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHsgdGFibGVJZCwgaW5kZXggfSA9IHRhYmxlRGlzdGFuY2VzLnNvcnQoKGEsIGIpID0+IGEuZGlzdCAtIGIuZGlzdClbMF07XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0YWJsZUlkO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKDAsIGluZGV4KS5yZXZlcnNlKCk7XG4gICAgICByZXN1bHQubm9kZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoaW5kZXggKyAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICB0ZW1wLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICB0ZW1wLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh0ZW1wKTtcblxuICAgIGlmICh0ZW1wLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RlbXAuc291cmNlQ2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC5zb3VyY2VUYWJsZUlkcywgc291cmNlQ2xhc3MpO1xuICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IHRlbXAuc291cmNlQ2xhc3NJZCxcbiAgICAgICAgc291cmNlVGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0ZW1wLnRhcmdldENsYXNzSWQgJiYgdGVtcC5zb3VyY2VDbGFzc0lkICE9PSB0ZW1wLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RlbXAudGFyZ2V0Q2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC50YXJnZXRUYWJsZUlkcywgdGFyZ2V0Q2xhc3MpO1xuICAgICAgY29uc3QgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiB0ZW1wLnRhcmdldENsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBub2RlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLnNpZGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2Uob3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLnNpZGUgPT09ICd0YXJnZXQnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUG9saXRpY2FsT3V0c2lkZXJFcnJvcjogXCIke29wdGlvbnMuc2lkZX1cIiBpcyBhbiBpbnZhbGlkIHNpZGVgKTtcbiAgICB9XG4gIH1cbiAgdG9nZ2xlRGlyZWN0aW9uIChkaXJlY3RlZCkge1xuICAgIGlmIChkaXJlY3RlZCA9PT0gZmFsc2UgfHwgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBkZWxldGUgdGhpcy5zd2FwcGVkRGlyZWN0aW9uO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuZGlyZWN0ZWQpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERpcmVjdGVkIHdhcyBhbHJlYWR5IHRydWUsIGp1c3Qgc3dpdGNoIHNvdXJjZSBhbmQgdGFyZ2V0XG4gICAgICBsZXQgdGVtcCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IHRlbXA7XG4gICAgICB0ZW1wID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IHRlbXA7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RTb3VyY2UgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgfVxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUuYWdncmVnYXRlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MudGFibGUuYWdncmVnYXRlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFRhcmdldCAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gdGFyZ2V0Q2xhc3MudGFibGUgOiB0YXJnZXRDbGFzcy50YWJsZS5hZ2dyZWdhdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0U291cmNlICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuXG5pbXBvcnQgKiBhcyBUQUJMRVMgZnJvbSAnLi4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4uL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5cbmNvbnN0IERBVEFMSUJfRk9STUFUUyA9IHtcbiAgJ2pzb24nOiAnanNvbicsXG4gICdjc3YnOiAnY3N2JyxcbiAgJ3Rzdic6ICd0c3YnLFxuICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAndHJlZWpzb24nOiAndHJlZWpzb24nXG59O1xuXG5jbGFzcyBOZXR3b3JrTW9kZWwgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgb3JpZ3JhcGgsXG4gICAgbW9kZWxJZCxcbiAgICBuYW1lID0gbW9kZWxJZCxcbiAgICBhbm5vdGF0aW9ucyA9IHt9LFxuICAgIGNsYXNzZXMgPSB7fSxcbiAgICB0YWJsZXMgPSB7fVxuICB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9yaWdyYXBoO1xuICAgIHRoaXMubW9kZWxJZCA9IG1vZGVsSWQ7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmFubm90YXRpb25zID0gYW5ub3RhdGlvbnM7XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG4gICAgdGhpcy50YWJsZXMgPSB7fTtcblxuICAgIHRoaXMuX25leHRDbGFzc0lkID0gMTtcbiAgICB0aGlzLl9uZXh0VGFibGVJZCA9IDE7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXMoY2xhc3NlcykpIHtcbiAgICAgIHRoaXMuY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IHRoaXMuaHlkcmF0ZShjbGFzc09iaiwgQ0xBU1NFUyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgT2JqZWN0LnZhbHVlcyh0YWJsZXMpKSB7XG4gICAgICB0aGlzLnRhYmxlc1t0YWJsZS50YWJsZUlkXSA9IHRoaXMuaHlkcmF0ZSh0YWJsZSwgVEFCTEVTKTtcbiAgICB9XG5cbiAgICB0aGlzLm9uKCd1cGRhdGUnLCAoKSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc2F2ZVRpbWVvdXQpO1xuICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5fb3JpZ3JhcGguc2F2ZSgpO1xuICAgICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHVuZGVmaW5lZDtcbiAgICAgIH0sIDApO1xuICAgIH0pO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgY2xhc3NlcyA9IHt9O1xuICAgIGNvbnN0IHRhYmxlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpKSB7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0gPSB0YWJsZU9iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXS50eXBlID0gdGFibGVPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIG1vZGVsSWQ6IHRoaXMubW9kZWxJZCxcbiAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zLFxuICAgICAgY2xhc3NlcyxcbiAgICAgIHRhYmxlc1xuICAgIH07XG4gIH1cbiAgZ2V0IHVuc2F2ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9zYXZlVGltZW91dCAhPT0gdW5kZWZpbmVkO1xuICB9XG4gIGh5ZHJhdGUgKHJhd09iamVjdCwgVFlQRVMpIHtcbiAgICByYXdPYmplY3QubW9kZWwgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgVFlQRVNbcmF3T2JqZWN0LnR5cGVdKHJhd09iamVjdCk7XG4gIH1cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMudGFibGVJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0pKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke3RoaXMuX25leHRUYWJsZUlkfWA7XG4gICAgICB0aGlzLl9uZXh0VGFibGVJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFRBQkxFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMuY2xhc3NJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdKSkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHt0aGlzLl9uZXh0Q2xhc3NJZH1gO1xuICAgICAgdGhpcy5fbmV4dENsYXNzSWQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ0xBU1NFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG4gIHJlbmFtZSAobmV3TmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5ld05hbWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhbm5vdGF0ZSAoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYW5ub3RhdGlvbnNba2V5XSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlQW5ub3RhdGlvbiAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMuYW5ub3RhdGlvbnNba2V5XTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5fb3JpZ3JhcGguZGVsZXRlTW9kZWwodGhpcy5tb2RlbElkKTtcbiAgfVxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNUYWJsZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHlgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuX29yaWdyYXBoLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljVGFibGUoe1xuICAgICAgbmFtZTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljVGFibGUgKHsgbmFtZSwgZXh0ZW5zaW9uLCB0ZXh0IH0pIHtcbiAgICBsZXQgZGF0YSwgYXR0cmlidXRlcztcbiAgICBpZiAoIWV4dGVuc2lvbikge1xuICAgICAgZXh0ZW5zaW9uID0gbWltZS5leHRlbnNpb24obWltZS5sb29rdXAobmFtZSkpO1xuICAgIH1cbiAgICBpZiAoREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBkZWxldGVBbGxVbnVzZWRUYWJsZXMgKCkge1xuICAgIGZvciAoY29uc3QgdGFibGVJZCBpbiB0aGlzLnRhYmxlcykge1xuICAgICAgaWYgKHRoaXMudGFibGVzW3RhYmxlSWRdKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy50YWJsZXNbdGFibGVJZF0uZGVsZXRlKCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmICghZXJyLmluVXNlKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgZ2V0U2FtcGxlR3JhcGggKHtcbiAgICByb290Q2xhc3MgPSBudWxsLFxuICAgIGJyYW5jaExpbWl0ID0gSW5maW5pdHksXG4gICAgbm9kZUxpbWl0ID0gSW5maW5pdHksXG4gICAgZWRnZUxpbWl0ID0gSW5maW5pdHksXG4gICAgdHJpcGxlTGltaXQgPSBJbmZpbml0eVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBzYW1wbGVHcmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdLFxuICAgICAgZWRnZUxvb2t1cDoge30sXG4gICAgICBsaW5rczogW11cbiAgICB9O1xuXG4gICAgbGV0IG51bVRyaXBsZXMgPSAwO1xuICAgIGNvbnN0IGFkZE5vZGUgPSBub2RlID0+IHtcbiAgICAgIGlmIChzYW1wbGVHcmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gPSBzYW1wbGVHcmFwaC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIHNhbXBsZUdyYXBoLm5vZGVzLnB1c2gobm9kZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2FtcGxlR3JhcGgubm9kZXMubGVuZ3RoIDw9IG5vZGVMaW1pdDtcbiAgICB9O1xuICAgIGNvbnN0IGFkZEVkZ2UgPSBlZGdlID0+IHtcbiAgICAgIGlmIChzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF0gPSBzYW1wbGVHcmFwaC5lZGdlcy5sZW5ndGg7XG4gICAgICAgIHNhbXBsZUdyYXBoLmVkZ2VzLnB1c2goZWRnZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2FtcGxlR3JhcGguZWRnZXMubGVuZ3RoIDw9IGVkZ2VMaW1pdDtcbiAgICB9O1xuICAgIGNvbnN0IGFkZFRyaXBsZSA9IChzb3VyY2UsIGVkZ2UsIHRhcmdldCkgPT4ge1xuICAgICAgaWYgKGFkZE5vZGUoc291cmNlKSAmJiBhZGROb2RlKHRhcmdldCkgJiYgYWRkRWRnZShlZGdlKSkge1xuICAgICAgICBzYW1wbGVHcmFwaC5saW5rcy5wdXNoKHtcbiAgICAgICAgICBzb3VyY2U6IHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbc291cmNlLmluc3RhbmNlSWRdLFxuICAgICAgICAgIHRhcmdldDogc2FtcGxlR3JhcGgubm9kZUxvb2t1cFt0YXJnZXQuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgZWRnZTogc2FtcGxlR3JhcGguZWRnZUxvb2t1cFtlZGdlLmluc3RhbmNlSWRdXG4gICAgICAgIH0pO1xuICAgICAgICBudW1UcmlwbGVzKys7XG4gICAgICAgIHJldHVybiBudW1UcmlwbGVzIDw9IHRyaXBsZUxpbWl0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsZXQgY2xhc3NMaXN0ID0gcm9vdENsYXNzID8gW3Jvb3RDbGFzc10gOiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3Nlcyk7XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGlmICghYWRkTm9kZShub2RlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgc291cmNlLCBlZGdlLCB0YXJnZXQgfSBvZiBub2RlLnBhaXJ3aXNlTmVpZ2hib3Job29kKHsgbGltaXQ6IGJyYW5jaExpbWl0IH0pKSB7XG4gICAgICAgICAgICBpZiAoIWFkZFRyaXBsZShzb3VyY2UsIGVkZ2UsIHRhcmdldCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGlmICghYWRkRWRnZShlZGdlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgc291cmNlLCB0YXJnZXQgfSBvZiBlZGdlLnBhaXJ3aXNlRWRnZXMoeyBsaW1pdDogYnJhbmNoTGltaXQgfSkpIHtcbiAgICAgICAgICAgIGlmICghYWRkVHJpcGxlKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgfVxuICBhc3luYyBnZXRJbnN0YW5jZUdyYXBoIChpbnN0YW5jZXMpIHtcbiAgICBpZiAoIWluc3RhbmNlcykge1xuICAgICAgLy8gV2l0aG91dCBzcGVjaWZpZWQgaW5zdGFuY2VzLCBqdXN0IHBpY2sgdGhlIGZpcnN0IDUgZnJvbSBlYWNoIG5vZGVcbiAgICAgIC8vIGFuZCBlZGdlIGNsYXNzXG4gICAgICBpbnN0YW5jZXMgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgfHwgY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoeyBsaW1pdDogNSB9KSkge1xuICAgICAgICAgICAgaW5zdGFuY2VzLnB1c2goaXRlbSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBub2RlTG9va3VwOiB7fSxcbiAgICAgIGVkZ2VzOiBbXVxuICAgIH07XG4gICAgY29uc3QgZWRnZVRhYmxlRW50cmllcyA9IFtdO1xuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgaW5zdGFuY2VzKSB7XG4gICAgICBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGdyYXBoLm5vZGVMb29rdXBbaW5zdGFuY2UuaW5zdGFuY2VJZF0gPSBncmFwaC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICAgIG5vZGVJbnN0YW5jZTogaW5zdGFuY2UsXG4gICAgICAgICAgZHVtbXk6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbnN0YW5jZS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZWRnZVRhYmxlRW50cmllcy5wdXNoKGluc3RhbmNlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBlZGdlSW5zdGFuY2Ugb2YgZWRnZVRhYmxlRW50cmllcykge1xuICAgICAgY29uc3Qgc291cmNlcyA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgZWRnZUluc3RhbmNlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbc291cmNlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBzb3VyY2VzLnB1c2goZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCB0YXJnZXRzID0gW107XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlSW5zdGFuY2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXQuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRhcmdldHMucHVzaChncmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzb3VyY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBpZiAodGFyZ2V0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAvLyBXZSBoYXZlIGNvbXBsZXRlbHkgaGFuZ2luZyBlZGdlcywgbWFrZSBkdW1teSBub2RlcyBmb3IgdGhlXG4gICAgICAgICAgLy8gc291cmNlIGFuZCB0YXJnZXRcbiAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGggKyAxXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUaGUgc291cmNlcyBhcmUgaGFuZ2luZywgYnV0IHdlIGhhdmUgdGFyZ2V0c1xuICAgICAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgICB0YXJnZXRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0YXJnZXRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBUaGUgdGFyZ2V0cyBhcmUgaGFuZ2luZywgYnV0IHdlIGhhdmUgc291cmNlc1xuICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVpdGhlciB0aGUgc291cmNlLCBub3IgdGhlIHRhcmdldCBhcmUgaGFuZ2luZ1xuICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgICAgc291cmNlLFxuICAgICAgICAgICAgICB0YXJnZXRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TmV0d29ya01vZGVsR3JhcGggKHtcbiAgICByYXcgPSB0cnVlLFxuICAgIGluY2x1ZGVEdW1taWVzID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICBsZXQgZ3JhcGggPSB7XG4gICAgICBjbGFzc2VzOiBbXSxcbiAgICAgIGNsYXNzTG9va3VwOiB7fSxcbiAgICAgIGNsYXNzQ29ubmVjdGlvbnM6IFtdXG4gICAgfTtcblxuICAgIGNvbnN0IGNsYXNzTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgY2xhc3NMaXN0KSB7XG4gICAgICAvLyBBZGQgYW5kIGluZGV4IHRoZSBjbGFzcyBhcyBhIG5vZGVcbiAgICAgIGdyYXBoLmNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gZ3JhcGguY2xhc3Nlcy5sZW5ndGg7XG4gICAgICBjb25zdCBjbGFzc1NwZWMgPSByYXcgPyBjbGFzc09iai5fdG9SYXdPYmplY3QoKSA6IHsgY2xhc3NPYmogfTtcbiAgICAgIGNsYXNzU3BlYy50eXBlID0gY2xhc3NPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLmNsYXNzZXMucHVzaChjbGFzc1NwZWMpO1xuXG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIC8vIFN0b3JlIHRoZSBlZGdlIGNsYXNzIHNvIHdlIGNhbiBjcmVhdGUgY2xhc3NDb25uZWN0aW9ucyBsYXRlclxuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnICYmIGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IG5vZGVcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7Y2xhc3NPYmouY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGggLSAxLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGZhbHNlLFxuICAgICAgICAgIGxvY2F0aW9uOiAnbm9kZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBDcmVhdGUgZXhpc3RpbmcgY2xhc3NDb25uZWN0aW9uc1xuICAgICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZUNsYXNzZXMpIHtcbiAgICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgICAgLy8gQ29ubmVjdCB0aGUgc291cmNlIG5vZGUgY2xhc3MgdG8gdGhlIGVkZ2UgY2xhc3NcbiAgICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkfT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkXSxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJ1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgc291cmNlIGNsYXNzXG4gICAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBgZHVtbXk+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJyxcbiAgICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgICAgLy8gQ29ubmVjdCB0aGUgZWRnZSBjbGFzcyB0byB0aGUgdGFyZ2V0IG5vZGUgY2xhc3NcbiAgICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT4ke2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkfWAsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnRhcmdldENsYXNzSWRdLFxuICAgICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0J1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgdGFyZ2V0IGNsYXNzXG4gICAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0JyxcbiAgICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGggKCkge1xuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgdGFibGVzOiBbXSxcbiAgICAgIHRhYmxlTG9va3VwOiB7fSxcbiAgICAgIHRhYmxlTGlua3M6IFtdXG4gICAgfTtcbiAgICBjb25zdCB0YWJsZUxpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKTtcbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgY29uc3QgdGFibGVTcGVjID0gdGFibGUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZVNwZWMudHlwZSA9IHRhYmxlLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGdyYXBoLnRhYmxlcy5sZW5ndGg7XG4gICAgICBncmFwaC50YWJsZXMucHVzaCh0YWJsZVNwZWMpO1xuICAgIH1cbiAgICAvLyBGaWxsIHRoZSBncmFwaCB3aXRoIGxpbmtzIGJhc2VkIG9uIHBhcmVudFRhYmxlcy4uLlxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRhYmxlLnBhcmVudFRhYmxlcykge1xuICAgICAgICBncmFwaC50YWJsZUxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogZ3JhcGgudGFibGVMb29rdXBbcGFyZW50VGFibGUudGFibGVJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldEZ1bGxTY2hlbWFHcmFwaCAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24odGhpcy5nZXROZXR3b3JrTW9kZWxHcmFwaCgpLCB0aGlzLmdldFRhYmxlRGVwZW5kZW5jeUdyYXBoKCkpO1xuICB9XG4gIGNyZWF0ZVNjaGVtYU1vZGVsICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHRoaXMuZ2V0RnVsbFNjaGVtYUdyYXBoKCk7XG4gICAgY29uc3QgbmV3TW9kZWwgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVNb2RlbCh7IG5hbWU6IHRoaXMubmFtZSArICdfc2NoZW1hJyB9KTtcbiAgICBsZXQgY2xhc3NlcyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLmNsYXNzZXMsXG4gICAgICBuYW1lOiAnQ2xhc3NlcydcbiAgICB9KS5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgbGV0IGNsYXNzQ29ubmVjdGlvbnMgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLFxuICAgICAgbmFtZTogJ0NsYXNzIENvbm5lY3Rpb25zJ1xuICAgIH0pLmludGVycHJldEFzRWRnZXMoKTtcbiAgICBsZXQgdGFibGVzID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGgudGFibGVzLFxuICAgICAgbmFtZTogJ1RhYmxlcydcbiAgICB9KS5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgbGV0IHRhYmxlTGlua3MgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaC50YWJsZUxpbmtzLFxuICAgICAgbmFtZTogJ1RhYmxlIExpbmtzJ1xuICAgIH0pLmludGVycHJldEFzRWRnZXMoKTtcbiAgICBjbGFzc2VzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICBlZGdlQ2xhc3M6IGNsYXNzQ29ubmVjdGlvbnMsXG4gICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICBlZGdlQXR0cmlidXRlOiAnc291cmNlJ1xuICAgIH0pO1xuICAgIGNsYXNzZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgIGVkZ2VDbGFzczogY2xhc3NDb25uZWN0aW9ucyxcbiAgICAgIHNpZGU6ICd0YXJnZXQnLFxuICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIGVkZ2VBdHRyaWJ1dGU6ICd0YXJnZXQnXG4gICAgfSk7XG4gICAgdGFibGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICBlZGdlQ2xhc3M6IHRhYmxlTGlua3MsXG4gICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICBlZGdlQXR0cmlidXRlOiAnc291cmNlJ1xuICAgIH0pO1xuICAgIHRhYmxlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgZWRnZUNsYXNzOiB0YWJsZUxpbmtzLFxuICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICBub2RlQXR0cmlidXRlOiBudWxsLFxuICAgICAgZWRnZUF0dHJpYnV0ZTogJ3RhcmdldCdcbiAgICB9KTtcbiAgICBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAndGFibGVJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogJ3RhYmxlSWQnXG4gICAgfSkuc2V0Q2xhc3NOYW1lKCdDb3JlIFRhYmxlcycpO1xuICAgIHJldHVybiBuZXdNb2RlbDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTmV0d29ya01vZGVsO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgTmV0d29ya01vZGVsIGZyb20gJy4vQ29tbW9uL05ldHdvcmtNb2RlbC5qcyc7XG5cbmxldCBORVhUX01PREVMX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICBsZXQgZXhpc3RpbmdNb2RlbHMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnKTtcbiAgICBpZiAoZXhpc3RpbmdNb2RlbHMpIHtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyhKU09OLnBhcnNlKGV4aXN0aW5nTW9kZWxzKSkpIHtcbiAgICAgICAgbW9kZWwub3JpZ3JhcGggPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsc1ttb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwobW9kZWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgfVxuICByZWdpc3RlclBsdWdpbiAobmFtZSwgcGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW5zW25hbWVdID0gcGx1Z2luO1xuICB9XG4gIHNhdmUgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgbW9kZWxzID0ge307XG4gICAgICBmb3IgKGNvbnN0IFttb2RlbElkLCBtb2RlbF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5tb2RlbHMpKSB7XG4gICAgICAgIG1vZGVsc1ttb2RlbElkXSA9IG1vZGVsLl90b1Jhd09iamVjdCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnb3JpZ3JhcGhfbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG4gICAgICB0aGlzLnRyaWdnZXIoJ3NhdmUnKTtcbiAgICB9XG4gIH1cbiAgY2xvc2VDdXJyZW50TW9kZWwgKCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGdldCBjdXJyZW50TW9kZWwgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1t0aGlzLl9jdXJyZW50TW9kZWxJZF0gfHwgbnVsbDtcbiAgfVxuICBzZXQgY3VycmVudE1vZGVsIChtb2RlbCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbW9kZWwgPyBtb2RlbC5tb2RlbElkIDogbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGNyZWF0ZU1vZGVsIChvcHRpb25zID0ge30pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMubW9kZWxJZCB8fCB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdKSB7XG4gICAgICBvcHRpb25zLm1vZGVsSWQgPSBgbW9kZWwke05FWFRfTU9ERUxfSUR9YDtcbiAgICAgIE5FWFRfTU9ERUxfSUQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5vcmlncmFwaCA9IHRoaXM7XG4gICAgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwob3B0aW9ucyk7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBvcHRpb25zLm1vZGVsSWQ7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXTtcbiAgfVxuICBkZWxldGVNb2RlbCAobW9kZWxJZCA9IHRoaXMuY3VycmVudE1vZGVsSWQpIHtcbiAgICBpZiAoIXRoaXMubW9kZWxzW21vZGVsSWRdKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBub24tZXhpc3RlbnQgbW9kZWw6ICR7bW9kZWxJZH1gKTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWxzW21vZGVsSWRdO1xuICAgIGlmICh0aGlzLl9jdXJyZW50TW9kZWxJZCA9PT0gbW9kZWxJZCkge1xuICAgICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICB9XG4gICAgdGhpcy5zYXZlKCk7XG4gIH1cbiAgZGVsZXRlQWxsTW9kZWxzICgpIHtcbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE9yaWdyYXBoO1xuIiwiaW1wb3J0IE9yaWdyYXBoIGZyb20gJy4vT3JpZ3JhcGguanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgb3JpZ3JhcGggPSBuZXcgT3JpZ3JhcGgod2luZG93LkZpbGVSZWFkZXIsIHdpbmRvdy5sb2NhbFN0b3JhZ2UpO1xub3JpZ3JhcGgudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBvcmlncmFwaDtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiX2V2ZW50SGFuZGxlcnMiLCJfc3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiZXZlbnQiLCJuYW1lc3BhY2UiLCJzcGxpdCIsInB1c2giLCJvZmYiLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImhhbmRsZUNhbGxiYWNrIiwid2luZG93Iiwic2V0VGltZW91dCIsImFwcGx5IiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwiY29uZmlndXJhYmxlIiwiZ2V0IiwidGVtcCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkdlbmVyaWNXcmFwcGVyIiwib3B0aW9ucyIsInRhYmxlIiwidW5kZWZpbmVkIiwiRXJyb3IiLCJjbGFzc09iaiIsInJvdyIsImNvbm5lY3RlZEl0ZW1zIiwiY29ubmVjdEl0ZW0iLCJpdGVtIiwidGFibGVJZCIsImRpc2Nvbm5lY3QiLCJpdGVtTGlzdCIsInZhbHVlcyIsImluc3RhbmNlSWQiLCJjbGFzc0lkIiwiZXF1YWxzIiwiaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwidGFibGVJZHMiLCJsaW1pdCIsIkluZmluaXR5IiwiUHJvbWlzZSIsImFsbCIsIm1hcCIsIm1vZGVsIiwidGFibGVzIiwiYnVpbGRDYWNoZSIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJsZW5ndGgiLCJ0aGlzVGFibGVJZCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX3RvUmF3T2JqZWN0IiwicmVzdWx0IiwiX2F0dHJpYnV0ZXMiLCJ1c2VkQnlDbGFzc2VzIiwiX3VzZWRCeUNsYXNzZXMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsImZ1bmMiLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiaXRlcmF0ZSIsInJlc2V0IiwiX2NhY2hlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlIiwiaXRlcmF0b3IiLCJfaXRlcmF0ZSIsImNvbXBsZXRlZCIsIm5leHQiLCJkb25lIiwiX2ZpbmlzaEl0ZW0iLCJ3cmFwcGVkSXRlbSIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZGVyaXZlZFRhYmxlIiwiX2NhY2hlUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJjb3VudFJvd3MiLCJjYWNoZSIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImNvbXBsZXRlIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJhZ2dyZWdhdGUiLCJleHBhbmQiLCJkZWxpbWl0ZXIiLCJjbG9zZWRGYWNldCIsIm9wZW5GYWNldCIsImNsb3NlZFRyYW5zcG9zZSIsImluZGV4ZXMiLCJvcGVuVHJhbnNwb3NlIiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0Iiwib3RoZXJUYWJsZSIsImNsYXNzZXMiLCJwYXJlbnRUYWJsZXMiLCJyZWR1Y2UiLCJhZ2ciLCJpblVzZSIsInNvbWUiLCJzb3VyY2VUYWJsZUlkcyIsInRhcmdldFRhYmxlSWRzIiwiZGVsZXRlIiwiZXJyIiwicGFyZW50VGFibGUiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJTdGF0aWNEaWN0VGFibGUiLCJTaW5nbGVQYXJlbnRNaXhpbiIsIl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4iLCJBZ2dyZWdhdGVkVGFibGUiLCJfYXR0cmlidXRlIiwiX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsInJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsIl9kZWh5ZHJhdGVGdW5jdGlvbiIsImRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUiLCJfdXBkYXRlSXRlbSIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJuZXdXcmFwcGVkSXRlbSIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwicmVkdWNlZCIsIkV4cGFuZGVkVGFibGUiLCJGYWNldGVkVGFibGUiLCJfdmFsdWUiLCJUcmFuc3Bvc2VkVGFibGUiLCJfaW5kZXgiLCJDb25uZWN0ZWRUYWJsZSIsImpvaW4iLCJiYXNlUGFyZW50VGFibGUiLCJvdGhlclBhcmVudFRhYmxlcyIsIkdlbmVyaWNDbGFzcyIsIl9jbGFzc05hbWUiLCJjbGFzc05hbWUiLCJhbm5vdGF0aW9ucyIsInNldENsYXNzTmFtZSIsImhhc0N1c3RvbU5hbWUiLCJpbnRlcnByZXRBc05vZGVzIiwib3ZlcndyaXRlIiwiY3JlYXRlQ2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiX2Rlcml2ZU5ld0NsYXNzIiwiZ2V0U2FtcGxlR3JhcGgiLCJyb290Q2xhc3MiLCJOb2RlV3JhcHBlciIsImVkZ2VzIiwiZWRnZUlkcyIsImVkZ2VDbGFzc0lkcyIsImVkZ2VJZCIsImVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzSWQiLCJyZXZlcnNlIiwiY29uY2F0IiwicGFpcndpc2VOZWlnaGJvcmhvb2QiLCJlZGdlIiwicGFpcndpc2VFZGdlcyIsIk5vZGVDbGFzcyIsImF1dG9jb25uZWN0IiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiaXNTb3VyY2UiLCJ0YXJnZXRDbGFzc0lkIiwiZGlzY29ubmVjdFNvdXJjZSIsImRpc2Nvbm5lY3RUYXJnZXQiLCJub2RlQ2xhc3MiLCJ0YWJsZUlkTGlzdCIsImRpcmVjdGVkIiwic291cmNlRWRnZUNsYXNzIiwidGFyZ2V0RWRnZUNsYXNzIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJuZXdFZGdlQ2xhc3MiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJuZXdOb2RlQ2xhc3MiLCJjb25uZWN0ZWRDbGFzc2VzIiwiZWRnZUNsYXNzSWQiLCJFZGdlV3JhcHBlciIsInNvdXJjZU5vZGVzIiwic291cmNlVGFibGVJZCIsInRhcmdldE5vZGVzIiwidGFyZ2V0VGFibGVJZCIsInNvdXJjZSIsInRhcmdldCIsImh5cGVyZWRnZSIsInNvdXJjZXMiLCJ0YXJnZXRzIiwiRWRnZUNsYXNzIiwiX3NwbGl0VGFibGVJZExpc3QiLCJvdGhlckNsYXNzIiwibm9kZVRhYmxlSWRMaXN0IiwiZWRnZVRhYmxlSWQiLCJlZGdlVGFibGVJZExpc3QiLCJzdGF0aWNFeGlzdHMiLCJ0YWJsZURpc3RhbmNlcyIsInN0YXJ0c1dpdGgiLCJkaXN0IiwiTWF0aCIsImFicyIsImZpbHRlciIsInNvcnQiLCJhIiwiYiIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJzaWRlIiwiY29ubmVjdFNvdXJjZSIsImNvbm5lY3RUYXJnZXQiLCJ0b2dnbGVEaXJlY3Rpb24iLCJzd2FwcGVkRGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwidW5zaGlmdCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwiREFUQUxJQl9GT1JNQVRTIiwiTmV0d29ya01vZGVsIiwib3JpZ3JhcGgiLCJtb2RlbElkIiwiX29yaWdyYXBoIiwiX25leHRDbGFzc0lkIiwiX25leHRUYWJsZUlkIiwiaHlkcmF0ZSIsIkNMQVNTRVMiLCJUQUJMRVMiLCJfc2F2ZVRpbWVvdXQiLCJzYXZlIiwidW5zYXZlZCIsInJhd09iamVjdCIsIlRZUEVTIiwic2VsZWN0b3IiLCJyZW5hbWUiLCJuZXdOYW1lIiwiYW5ub3RhdGUiLCJrZXkiLCJkZWxldGVBbm5vdGF0aW9uIiwiZGVsZXRlTW9kZWwiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsIm1pbWUiLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsImNvbnNvbGUiLCJ3YXJuIiwidGV4dCIsInJlYWRlciIsIkZpbGVSZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImxvb2t1cCIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJicmFuY2hMaW1pdCIsIm5vZGVMaW1pdCIsImVkZ2VMaW1pdCIsInRyaXBsZUxpbWl0Iiwic2FtcGxlR3JhcGgiLCJub2RlcyIsIm5vZGVMb29rdXAiLCJlZGdlTG9va3VwIiwibGlua3MiLCJudW1UcmlwbGVzIiwiYWRkTm9kZSIsIm5vZGUiLCJhZGRFZGdlIiwiYWRkVHJpcGxlIiwiY2xhc3NMaXN0IiwiZ2V0SW5zdGFuY2VHcmFwaCIsImluc3RhbmNlcyIsImdyYXBoIiwiZWRnZVRhYmxlRW50cmllcyIsImluc3RhbmNlIiwibm9kZUluc3RhbmNlIiwiZHVtbXkiLCJlZGdlSW5zdGFuY2UiLCJnZXROZXR3b3JrTW9kZWxHcmFwaCIsInJhdyIsImluY2x1ZGVEdW1taWVzIiwiZWRnZUNsYXNzZXMiLCJjbGFzc0xvb2t1cCIsImNsYXNzQ29ubmVjdGlvbnMiLCJjbGFzc1NwZWMiLCJpZCIsImxvY2F0aW9uIiwiZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgiLCJ0YWJsZUxvb2t1cCIsInRhYmxlTGlua3MiLCJ0YWJsZUxpc3QiLCJ0YWJsZVNwZWMiLCJnZXRGdWxsU2NoZW1hR3JhcGgiLCJjcmVhdGVTY2hlbWFNb2RlbCIsIm5ld01vZGVsIiwiY3JlYXRlTW9kZWwiLCJORVhUX01PREVMX0lEIiwiT3JpZ3JhcGgiLCJsb2NhbFN0b3JhZ2UiLCJwbHVnaW5zIiwibW9kZWxzIiwiZXhpc3RpbmdNb2RlbHMiLCJnZXRJdGVtIiwiSlNPTiIsInBhcnNlIiwiX2N1cnJlbnRNb2RlbElkIiwicmVnaXN0ZXJQbHVnaW4iLCJwbHVnaW4iLCJzZXRJdGVtIiwic3RyaW5naWZ5IiwiY2xvc2VDdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWxJZCIsImRlbGV0ZUFsbE1vZGVscyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxjQUFMLEdBQXNCLEVBQXRCO1dBQ0tDLGVBQUwsR0FBdUIsRUFBdkI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNuQixDQUFDQyxLQUFELEVBQVFDLFNBQVIsSUFBcUJILFNBQVMsQ0FBQ0ksS0FBVixDQUFnQixHQUFoQixDQUF6QjtXQUNLUCxjQUFMLENBQW9CSyxLQUFwQixJQUE2QixLQUFLTCxjQUFMLENBQW9CSyxLQUFwQixLQUMzQjtZQUFNO09BRFI7O1VBRUksQ0FBQ0MsU0FBTCxFQUFnQjthQUNUTixjQUFMLENBQW9CSyxLQUFwQixFQUEyQixFQUEzQixFQUErQkcsSUFBL0IsQ0FBb0NKLFFBQXBDO09BREYsTUFFTzthQUNBSixjQUFMLENBQW9CSyxLQUFwQixFQUEyQkMsU0FBM0IsSUFBd0NGLFFBQXhDOzs7O0lBR0pLLEdBQUcsQ0FBRU4sU0FBRixFQUFhQyxRQUFiLEVBQXVCO1VBQ3BCLENBQUNDLEtBQUQsRUFBUUMsU0FBUixJQUFxQkgsU0FBUyxDQUFDSSxLQUFWLENBQWdCLEdBQWhCLENBQXpCOztVQUNJLEtBQUtQLGNBQUwsQ0FBb0JLLEtBQXBCLENBQUosRUFBZ0M7WUFDMUIsQ0FBQ0MsU0FBTCxFQUFnQjtjQUNWLENBQUNGLFFBQUwsRUFBZTtpQkFDUkosY0FBTCxDQUFvQkssS0FBcEIsRUFBMkIsRUFBM0IsSUFBaUMsRUFBakM7V0FERixNQUVPO2dCQUNESyxLQUFLLEdBQUcsS0FBS1YsY0FBTCxDQUFvQkssS0FBcEIsRUFBMkIsRUFBM0IsRUFBK0JN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
