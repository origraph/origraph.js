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
      this.stickyTriggers[eventName] = this.stickyTriggers[eventName] || {
        argObj: {}
      };
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

class Table extends TriggerableMixin(Introspectable) {
  constructor(options) {
    super();
    this._origraph = options.origraph;
    this.tableId = options.tableId;

    if (!this._origraph || !this.tableId) {
      throw new Error(`origraph and tableId are required`);
    }

    this._expectedAttributes = options.attributes || {};
    this._observedAttributes = {};
    this._derivedTables = options.derivedTables || {};
    this._derivedAttributeFunctions = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions || {})) {
      this._derivedAttributeFunctions[attr] = this._origraph.hydrateFunction(stringifiedFunc);
    }

    this._suppressedAttributes = options.suppressedAttributes || {};
    this._suppressIndex = !!options.suppressIndex;
    this._indexSubFilter = options.indexSubFilter && this._origraph.hydrateFunction(options.indexSubFilter) || null;
    this._attributeSubFilters = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.attributeSubFilters || {})) {
      this._attributeSubFilters[attr] = this._origraph.hydrateFunction(stringifiedFunc);
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
      attributeSubFilters: {},
      indexSubFilter: this._indexSubFilter && this._origraph.dehydrateFunction(this._indexSubFilter) || null
    };

    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this._origraph.dehydrateFunction(func);
    }

    for (const [attr, func] of Object.entries(this._attributeSubFilters)) {
      result.attributeSubFilters[attr] = this._origraph.dehydrateFunction(func);
    }

    return result;
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

    if (this._indexSubFilter) {
      keep = this._indexSubFilter(wrappedItem.index);
    }

    for (const [attr, func] of Object.entries(this._attributeSubFilters)) {
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
    const wrappedItem = classObj ? classObj._wrap(options) : new this._origraph.WRAPPERS.GenericWrapper(options);

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
    return Object.keys((await this.buildCache())).length;
  }

  getIndexDetails() {
    const details = {
      name: null
    };

    if (this._suppressIndex) {
      details.suppressed = true;
    }

    if (this._indexSubFilter) {
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

    for (const attr in this._attributeSubFilters) {
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

  addSubFilter(attribute, func) {
    if (attribute === null) {
      this._indexSubFilter = func;
    } else {
      this._attributeSubFilters[attribute] = func;
    }

    this.reset();
  }

  _deriveTable(options) {
    const newTable = this._origraph.createTable(options);

    this._derivedTables[newTable.tableId] = true;

    this._origraph.saveTables();

    return newTable;
  }

  _getExistingTable(options) {
    // Check if the derived table has already been defined
    const existingTableId = this.derivedTables.find(tableObj => {
      return Object.entries(options).every(([optionName, optionValue]) => {
        if (optionName === 'type') {
          return tableObj.constructor.name === optionValue;
        } else {
          return tableObj['_' + optionName] === optionValue;
        }
      });
    });
    return existingTableId && this._origraph.tables[existingTableId] || null;
  }

  shortestPathToTable(otherTable) {
    // Dijkstra's algorithm...
    const visited = {};
    const distances = {};
    const prevTables = {};

    const visit = targetId => {
      const targetTable = this._origraph.tables[targetId]; // Only check the unvisited derived and parent tables

      const neighborList = Object.keys(targetTable._derivedTables).concat(targetTable.parentTables.map(parentTable => parentTable.tableId)).filter(tableId => !visited[tableId]); // Check and assign (or update) tentative distances to each neighbor

      for (const neighborId of neighborList) {
        if (distances[neighborId] === undefined) {
          distances[neighborId] = Infinity;
        }

        if (distances[targetId] + 1 < distances[neighborId]) {
          distances[neighborId] = distances[targetId] + 1;
          prevTables[neighborId] = targetId;
        }
      } // Okay, this table is officially visited; take it out of the running
      // for future visits / checks


      visited[targetId] = true;
      delete distances[targetId];
    }; // Start with this table


    prevTables[this.tableId] = null;
    distances[this.tableId] = 0;
    let toVisit = Object.keys(distances);

    while (toVisit.length > 0) {
      // Visit the next table that has the shortest distance
      toVisit.sort((a, b) => distances[a] - distances[b]);
      let nextId = toVisit.shift();

      if (nextId === otherTable.tableId) {
        // Found otherTable! Send back the chain of connected tables
        const chain = [];

        while (prevTables[nextId] !== null) {
          chain.unshift(this._origraph.tables[nextId]);
          nextId = prevTables[nextId];
        }

        return chain;
      } else {
        // Visit the table
        visit(nextId);
        toVisit = Object.keys(distances);
      }
    } // We didn't find it; there's no connection


    return null;
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
    const newTable = this._origraph.createTable({
      type: 'ConnectedTable'
    });

    this._derivedTables[newTable.tableId] = true;

    for (const otherTable of otherTableList) {
      otherTable._derivedTables[newTable.tableId] = true;
    }

    this._origraph.saveTables();

    return newTable;
  }

  get classObj() {
    return Object.values(this._origraph.classes).find(classObj => {
      return classObj.table === this;
    });
  }

  get parentTables() {
    return Object.values(this._origraph.tables).reduce((agg, tableObj) => {
      if (tableObj._derivedTables[this.tableId]) {
        agg.push(tableObj);
      }

      return agg;
    }, []);
  }

  get derivedTables() {
    return Object.keys(this._derivedTables).map(tableId => {
      return this._origraph.tables[tableId];
    });
  }

  get inUse() {
    if (Object.keys(this._derivedTables).length > 0) {
      return true;
    }

    return Object.values(this._origraph.classes).some(classObj => {
      return classObj.tableId === this.tableId || classObj.sourceTableIds.indexOf(this.tableId) !== -1 || classObj.targetTableIds.indexOf(this.tableId) !== -1;
    });
  }

  delete() {
    if (this.inUse) {
      throw new Error(`Can't delete in-use table ${this.tableId}`);
    }

    for (const parentTable of this.parentTables) {
      delete parentTable.derivedTables[this.tableId];
    }

    delete this._origraph.tables[this.tableId];

    this._origraph.saveTables();
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
        throw new Error(`Parent table is requierd for table of type ${this.type}`);
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
      this._reduceAttributeFunctions[attr] = this._origraph.hydrateFunction(stringifiedFunc);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.reduceAttributeFunctions = {};

    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      obj.reduceAttributeFunctions[attr] = this._origraph._dehydrateFunction(func);
    }

    return obj;
  }

  get name() {
    return this.parentTable.name + '↦';
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

const DuplicatableAttributesMixin = function (superclass) {
  return class extends superclass {
    constructor(options) {
      super(options);
      this._instanceOfDuplicatableAttributesMixin = true;
      this._duplicatedAttributes = options.duplicatedAttributes || {};
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.duplicatedAttributes = this._duplicatedAttributes;
      return obj;
    }

    duplicateAttribute(parentId, attribute) {
      this._duplicatedAttributes[parentId] = this._duplicatedAttributes[parentId] || [];

      this._duplicatedAttributes[parentId].push(attribute);

      this.reset();
    }

    _duplicateAttributes(wrappedItem) {
      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const parentName = this._origraph.tables[parentId].name;
        wrappedItem.row[`${parentName}.${attr}`] = wrappedItem.connectedItems[parentId][0].row[attr];
      }
    }

    getAttributeDetails() {
      const allAttrs = super.getAttributeDetails();

      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const attrName = `${this._origraph.tables[parentId].name}.${attr}`;
        allAttrs[attrName] = allAttrs[attrName] || {
          name: attrName
        };
        allAttrs[attrName].copied = true;
      }

      return allAttrs;
    }

  };
};

Object.defineProperty(DuplicatableAttributesMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfDuplicatableAttributesMixin
});

class ExpandedTable extends DuplicatableAttributesMixin(SingleParentMixin(Table)) {
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

            _this._duplicateAttributes(newItem);

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

class ConnectedTable extends DuplicatableAttributesMixin(Table) {
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

        _this._duplicateAttributes(newItem);

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
    this._origraph = options.origraph;
    this.classId = options.classId;
    this.tableId = options.tableId;

    if (!this._origraph || !this.classId || !this.tableId) {
      throw new Error(`_origraph, classId, and tableId are required`);
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

    this._origraph.saveClasses();
  }

  get hasCustomName() {
    return this._className !== null;
  }

  get className() {
    return this._className || this.table.name;
  }

  getHashTable(attribute) {
    return attribute === null ? this.table : this.table.aggregate(attribute);
  }

  get table() {
    return this._origraph.tables[this.tableId];
  }

  _wrap(options) {
    options.classObj = this;
    return new this._origraph.WRAPPERS.GenericWrapper(options);
  }

  interpretAsNodes() {
    const options = this._toRawObject();

    options.type = 'NodeClass';
    this.table.reset();
    return this._origraph.newClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    this.table.reset();
    return this._origraph.newClass(options);
  }

  _deriveGenericClass(newTable, type = this.constructor.name) {
    return this._origraph.newClass({
      tableId: newTable.tableId,
      type
    });
  }

  aggregate(attribute) {
    return this._deriveGenericClass(this.table.aggregate(attribute));
  }

  expand(attribute, delimiter) {
    return this._deriveGenericClass(this.table.expand(attribute, delimiter));
  }

  closedFacet(attribute, values) {
    return this.table.closedFacet(attribute, values).map(newTable => {
      return this._deriveGenericClass(newTable);
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
          yield _this._deriveGenericClass(newTable);
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
      return this._deriveGenericClass(newTable);
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
          yield _this2._deriveGenericClass(newTable);
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
    delete this._origraph.classes[this.classId];

    this._origraph.saveClasses();
  }

}

Object.defineProperty(GenericClass, 'type', {
  get() {
    return /(.*)Class/.exec(this.name)[1];
  }

});

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
    return new this._origraph.WRAPPERS.NodeWrapper(options);
  }

  interpretAsNodes() {
    return this;
  }

  interpretAsEdges() {
    const edgeClassIds = Object.keys(this.edgeClassIds);

    const options = super._toRawObject();

    if (edgeClassIds.length > 2) {
      // If there are more than two edges, break all connections and make
      // this a floating edge (for now, we're not dealing in hyperedges)
      this.disconnectAllEdges();
    } else if (edgeClassIds.length === 1) {
      // With only one connection, this node should become a self-edge
      const edgeClass = this._origraph.classes[edgeClassIds[0]]; // Are we the source or target of the existing edge (internally, in terms
      // of sourceId / targetId, not edgeClass.direction)?

      const isSource = edgeClass.sourceClassId === this.classId; // As we're converted to an edge, our new resulting source AND target
      // should be whatever is at the other end of edgeClass (if anything)

      if (isSource) {
        options.sourceClassId = options.targetClassId = edgeClass.targetClassId;
      } else {
        options.sourceClassId = options.targetClassId = edgeClass.sourceClassId;
      } // tableId lists should emanate out from the (new) edge table; assuming
      // (for a moment) that isSource === true, we'd construct the tableId list
      // like this:


      let tableIdList = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]).concat(edgeClass.sourceTableIds);

      if (!isSource) {
        // Whoops, got it backwards!
        tableIdList.reverse();
      }

      options.directed = edgeClass.directed;
      options.sourceTableIds = options.targetTableIds = tableIdList; // TODO: instead of deleting the existing edge class, should we leave it
      // hanging + unconnected?

      edgeClass.delete();
    } else if (edgeClassIds.length === 2) {
      // Okay, we've got two edges, so this is a little more straightforward
      let sourceEdgeClass = this._origraph.classes[edgeClassIds[0]];
      let targetEdgeClass = this._origraph.classes[edgeClassIds[1]]; // Figure out the direction, if there is one

      options.directed = false;

      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        if (sourceEdgeClass.targetClassId === this.classId && targetEdgeClass.sourceClassId === this.classId) {
          // We happened to get the edges in order; set directed to true
          options.directed = true;
        } else if (sourceEdgeClass.sourceClassId === this.classId && targetEdgeClass.targetClassId === this.classId) {
          // We got the edges backwards; swap them and set directed to true
          targetEdgeClass = this._origraph.classes[edgeClassIds[0]];
          sourceEdgeClass = this._origraph.classes[edgeClassIds[1]];
          options.directed = true;
        }
      } // Okay, now we know how to set source / target ids


      options.sourceClassId = sourceEdgeClass.classId;
      options.targetClassId = targetEdgeClass.classId; // Concatenate the intermediate tableId lists, emanating out from the
      // (new) edge table

      options.sourceTableIds = sourceEdgeClass.targetTableIds.slice().reverse().concat([sourceEdgeClass.tableId]).concat(sourceEdgeClass.sourceTableIds);

      if (sourceEdgeClass.targetClassId === this.classId) {
        options.sourceTableIds.reverse();
      }

      options.targetTableIds = targetEdgeClass.targetTableIds.slice().reverse().concat([targetEdgeClass.tableId]).concat(targetEdgeClass.sourceTableIds);

      if (targetEdgeClass.targetClassId === this.classId) {
        options.targetTableIds.reverse();
      } // Delete each of the edge classes


      sourceEdgeClass.delete();
      targetEdgeClass.delete();
    }

    this.delete();
    delete options.classId;
    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    this.table.reset();
    return this._origraph.newClass(options);
  }

  connectToNodeClass({
    otherNodeClass,
    attribute,
    otherAttribute
  }) {
    const thisHash = this.getHashTable(attribute);
    const otherHash = otherNodeClass.getHashTable(otherAttribute);
    const connectedTable = thisHash.connect([otherHash]);

    const newEdgeClass = this._origraph.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceTableIds: [thisHash.tableId],
      targetClassId: otherNodeClass.classId,
      targetTableIds: [otherHash.tableId]
    });

    this.edgeClassIds[newEdgeClass.classId] = true;
    otherNodeClass.edgeClassIds[newEdgeClass.classId] = true;

    this._origraph.saveClasses();

    return newEdgeClass;
  }

  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    return edgeClass.connectToNodeClass(options);
  }

  disconnectAllEdges() {
    for (const edgeClass of this.connectedClasses()) {
      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSource();
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTarget();
      }
    }
  }

  *connectedClasses() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      yield this._origraph.classes[edgeClassId];
    }
  }

  delete() {
    this.disconnectAllEdges();
    super.delete();
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
    return new this._origraph.WRAPPERS.EdgeWrapper(options);
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
        staticExists = staticExists || this._origraph.tables[tableId].type.startsWith('Static');
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
          return this._origraph.tables[tableId].type.startsWith('Static');
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

    this.delete();
    temp.type = 'NodeClass';
    delete temp.classId;

    const newNodeClass = this._origraph.createClass(temp);

    if (temp.sourceClassId) {
      const sourceClass = this._origraph.classes[temp.sourceClassId];

      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.sourceTableIds, sourceClass);

      const sourceEdgeClass = this._origraph.createClass({
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
      const targetClass = this._origraph.classes[temp.targetClassId];

      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.targetTableIds, targetClass);

      const targetEdgeClass = this._origraph.createClass({
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

    this._origraph.saveClasses();

    return newNodeClass;
  }

  *connectedClasses() {
    if (this.sourceClassId) {
      yield this._origraph.classes[this.sourceClassId];
    }

    if (this.targetClassId) {
      yield this._origraph.classes[this.targetClassId];
    }
  }

  interpretAsEdges() {
    return this;
  }

  connectToNodeClass({
    nodeClass,
    side,
    nodeAttribute,
    edgeAttribute
  }) {
    if (side === 'source') {
      this.connectSource({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    } else if (side === 'target') {
      this.connectTarget({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    } else {
      throw new Error(`PoliticalOutsiderError: "${side}" is an invalid side`);
    }

    this._origraph.saveClasses();
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

    this._origraph.saveClasses();
  }

  connectSource({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null,
    skipSave = false
  } = {}) {
    if (this.sourceClassId) {
      this.disconnectSource({
        skipSave: true
      });
    }

    this.sourceClassId = nodeClass.classId;
    const sourceClass = this._origraph.classes[this.sourceClassId];
    sourceClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.getHashTable(nodeAttribute);
    this.sourceTableIds = [edgeHash.connect([nodeHash]).tableId];

    if (edgeAttribute !== null) {
      this.sourceTableIds.unshift(edgeHash.tableId);
    }

    if (nodeAttribute !== null) {
      this.sourceTableIds.push(nodeHash.tableId);
    }

    if (!skipSave) {
      this._origraph.saveClasses();
    }
  }

  connectTarget({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null,
    skipSave = false
  } = {}) {
    if (this.targetClassId) {
      this.disconnectTarget({
        skipSave: true
      });
    }

    this.targetClassId = nodeClass.classId;
    const targetClass = this._origraph.classes[this.targetClassId];
    targetClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.getHashTable(nodeAttribute);
    this.targetTableIds = [edgeHash.connect([nodeHash]).tableId];

    if (edgeAttribute !== null) {
      this.targetTableIds.unshift(edgeHash.tableId);
    }

    if (nodeAttribute !== null) {
      this.targetTableIds.push(nodeHash.tableId);
    }

    if (!skipSave) {
      this._origraph.saveClasses();
    }
  }

  disconnectSource({
    skipSave = false
  } = {}) {
    const existingSourceClass = this._origraph.classes[this.sourceClassId];

    if (existingSourceClass) {
      delete existingSourceClass.edgeClassIds[this.classId];
    }

    this.sourceTableIds = [];
    this.sourceClassId = null;

    if (!skipSave) {
      this._origraph.saveClasses();
    }
  }

  disconnectTarget({
    skipSave = false
  } = {}) {
    const existingTargetClass = this._origraph.classes[this.targetClassId];

    if (existingTargetClass) {
      delete existingTargetClass.edgeClassIds[this.classId];
    }

    this.targetTableIds = [];
    this.targetClassId = null;

    if (!skipSave) {
      this._origraph.saveClasses();
    }
  }

  delete() {
    this.disconnectSource({
      skipSave: true
    });
    this.disconnectTarget({
      skipSave: true
    });
    super.delete();
  }

}



var CLASSES = /*#__PURE__*/Object.freeze({
  GenericClass: GenericClass,
  NodeClass: NodeClass,
  EdgeClass: EdgeClass
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

  iterateAcrossConnections({
    tableIds,
    limit = Infinity
  }) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // First make sure that all the table caches have been fully built and
      // connected
      yield _awaitAsyncGenerator(Promise.all(tableIds.map(tableId => {
        return _this.classObj._origraph.tables[tableId].buildCache();
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
        const edgeClass = _this.classObj._origraph.classes[edgeId];

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

      const sourceTableId = _this.classObj._origraph.classes[_this.classObj.sourceClassId].tableId;
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

      const targetTableId = _this2.classObj._origraph.classes[_this2.classObj.targetClassId].tableId;
      options.tableIds = _this2.classObj.targetTableIds.concat([targetTableId]);
      yield* _asyncGeneratorDelegate(_asyncIterator(_this2.iterateAcrossConnections(options)), _awaitAsyncGenerator);
    })();
  }

}



var WRAPPERS = /*#__PURE__*/Object.freeze({
  GenericWrapper: GenericWrapper,
  NodeWrapper: NodeWrapper,
  EdgeWrapper: EdgeWrapper
});

class InMemoryIndex {
  constructor({
    entries = {},
    complete = false
  } = {}) {
    this.entries = entries;
    this.complete = complete;
  }

  async toRawObject() {
    return this.entries;
  }

  iterEntries() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (const [hash, valueList] of Object.entries(_this.entries)) {
        yield {
          hash,
          valueList
        };
      }
    })();
  }

  iterHashes() {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      for (const hash of Object.keys(_this2.entries)) {
        yield hash;
      }
    })();
  }

  iterValueLists() {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      for (const valueList of Object.values(_this3.entries)) {
        yield valueList;
      }
    })();
  }

  async getValueList(hash) {
    return this.entries[hash] || [];
  }

  async addValue(hash, value) {
    // TODO: add some kind of warning if this is getting big?
    this.entries[hash] = await this.getValueList(hash);

    if (this.entries[hash].indexOf(value) === -1) {
      this.entries[hash].push(value);
    }
  }

}



var INDEXES = /*#__PURE__*/Object.freeze({
  InMemoryIndex: InMemoryIndex
});

let NEXT_CLASS_ID = 1;
let NEXT_TABLE_ID = 1;

class Origraph extends TriggerableMixin(class {}) {
  constructor(FileReader, localStorage) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node

    this.localStorage = localStorage; // either window.localStorage or null

    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set origraph.debug to true to debug streams

    this.plugins = {}; // extensions that we want datalib to handle

    this.DATALIB_FORMATS = {
      'json': 'json',
      'csv': 'csv',
      'tsv': 'tsv',
      'topojson': 'topojson',
      'treejson': 'treejson'
    }; // Access to core classes via the main library helps avoid circular imports

    this.TABLES = TABLES;
    this.CLASSES = CLASSES;
    this.WRAPPERS = WRAPPERS;
    this.INDEXES = INDEXES; // Default named functions

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
        yield {
          left: thisWrappedItem.rawItem,
          right: otherWrappedItem.rawItem
        };
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    }; // Object containing each of our data sources

    this.tables = this.hydrate('origraph_tables', this.TABLES);
    NEXT_TABLE_ID = Object.keys(this.tables).reduce((highestNum, tableId) => {
      return Math.max(highestNum, parseInt(tableId.match(/table(\d*)/)[1]));
    }, 0) + 1; // Object containing our class specifications

    this.classes = this.hydrate('origraph_classes', this.CLASSES);
    NEXT_CLASS_ID = Object.keys(this.classes).reduce((highestNum, classId) => {
      return Math.max(highestNum, parseInt(classId.match(/class(\d*)/)[1]));
    }, 0) + 1;
  }

  saveTables() {
    this.dehydrate('origraph_tables', this.tables);
    this.trigger('tableUpdate');
  }

  saveClasses() {
    this.dehydrate('origraph_classes', this.classes);
    this.trigger('classUpdate');
  }

  hydrate(storageKey, TYPES) {
    let container = this.localStorage && this.localStorage.getItem(storageKey);
    container = container ? JSON.parse(container) : {};

    for (const [key, value] of Object.entries(container)) {
      const type = value.type;
      delete value.type;
      value.origraph = this;
      container[key] = new TYPES[type](value);
    }

    return container;
  }

  dehydrate(storageKey, container) {
    if (this.localStorage) {
      const result = {};

      for (const [key, value] of Object.entries(container)) {
        result[key] = value._toRawObject();
        result[key].type = value.constructor.name;
      }

      this.localStorage.setItem(storageKey, JSON.stringify(result));
    }
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

  createTable(options) {
    if (!options.tableId) {
      options.tableId = `table${NEXT_TABLE_ID}`;
      NEXT_TABLE_ID += 1;
    }

    const Type = this.TABLES[options.type];
    delete options.type;
    options.origraph = this;
    this.tables[options.tableId] = new Type(options);
    return this.tables[options.tableId];
  }

  createClass(options = {
    selector: `empty`
  }) {
    if (!options.classId) {
      options.classId = `class${NEXT_CLASS_ID}`;
      NEXT_CLASS_ID += 1;
    }

    const Type = this.CLASSES[options.type];
    delete options.type;
    options.origraph = this;
    this.classes[options.classId] = new Type(options);
    return this.classes[options.classId];
  }

  newTable(options) {
    const newTableObj = this.createTable(options);
    this.saveTables();
    return newTableObj;
  }

  newClass(options) {
    const newClassObj = this.createClass(options);
    this.saveClasses();
    return newClassObj;
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
        throw new Error(`${fileMB}MB file is too large to load statically; try addDynamicTable() instead.`);
      }
    } // extensionOverride allows things like topojson or treejson (that don't
    // have standardized mimeTypes) to be parsed correctly


    let text = await new Promise((resolve, reject) => {
      let reader = new this.FileReader();

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
    extension = 'txt',
    text
  }) {
    let data, attributes;

    if (this.DATALIB_FORMATS[extension]) {
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
    let newTable = this.newTable(options);
    return this.newClass({
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
        } catch (err) {}
      }
    }
  }

  deleteAllClasses() {
    for (const classObj of Object.values(this.classes)) {
      classObj.delete();
    }
  }

  getClassData() {
    const results = {};

    for (const classObj of Object.values(this.classes)) {
      results[classObj.classId] = classObj.currentData;
    }
  }

  registerPlugin(name, plugin) {
    this.plugins[name] = plugin;
  }

}

var name = "origraph";
var version = "0.1.4";
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
	"@babel/core": "^7.1.2",
	"@babel/plugin-proposal-async-generator-functions": "^7.1.0",
	"@babel/preset-env": "^7.1.0",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.6.0",
	coveralls: "^3.0.2",
	jest: "^23.6.0",
	rollup: "^0.66.6",
	"rollup-plugin-babel": "^4.0.3",
	"rollup-plugin-commonjs": "^9.2.0",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.4.0",
	"rollup-plugin-node-resolve": "^3.4.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.1",
	filereader: "^0.10.3",
	"mime-types": "^2.1.20",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL09yaWdyYXBoLmpzIiwiLi4vc3JjL21vZHVsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcblxuY2xhc3MgVGFibGUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9wdGlvbnMub3JpZ3JhcGg7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5fb3JpZ3JhcGggfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBvcmlncmFwaCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG5cbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzID0gb3B0aW9ucy5kZXJpdmVkVGFibGVzIHx8IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIHx8IHt9KSkge1xuICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX29yaWdyYXBoLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cblxuICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5zdXBwcmVzc2VkQXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gISFvcHRpb25zLnN1cHByZXNzSW5kZXg7XG5cbiAgICB0aGlzLl9pbmRleFN1YkZpbHRlciA9IChvcHRpb25zLmluZGV4U3ViRmlsdGVyICYmIHRoaXMuX29yaWdyYXBoLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4U3ViRmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZVN1YkZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzW2F0dHJdID0gdGhpcy5fb3JpZ3JhcGguaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgYXR0cmlidXRlczogdGhpcy5fYXR0cmlidXRlcyxcbiAgICAgIGRlcml2ZWRUYWJsZXM6IHRoaXMuX2Rlcml2ZWRUYWJsZXMsXG4gICAgICB1c2VkQnlDbGFzc2VzOiB0aGlzLl91c2VkQnlDbGFzc2VzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge30sXG4gICAgICBzdXBwcmVzc2VkQXR0cmlidXRlczogdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMsXG4gICAgICBzdXBwcmVzc0luZGV4OiB0aGlzLl9zdXBwcmVzc0luZGV4LFxuICAgICAgYXR0cmlidXRlU3ViRmlsdGVyczoge30sXG4gICAgICBpbmRleFN1YkZpbHRlcjogKHRoaXMuX2luZGV4U3ViRmlsdGVyICYmIHRoaXMuX29yaWdyYXBoLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4U3ViRmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fb3JpZ3JhcGguZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnMpKSB7XG4gICAgICByZXN1bHQuYXR0cmlidXRlU3ViRmlsdGVyc1thdHRyXSA9IHRoaXMuX29yaWdyYXBoLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gR2VuZXJpYyBjYWNoaW5nIHN0dWZmOyB0aGlzIGlzbid0IGp1c3QgZm9yIHBlcmZvcm1hbmNlLiBDb25uZWN0ZWRUYWJsZSdzXG4gICAgLy8gYWxnb3JpdGhtIHJlcXVpcmVzIHRoYXQgaXRzIHBhcmVudCB0YWJsZXMgaGF2ZSBwcmUtYnVpbHQgaW5kZXhlcyAod2VcbiAgICAvLyB0ZWNobmljYWxseSBjb3VsZCBpbXBsZW1lbnQgaXQgZGlmZmVyZW50bHksIGJ1dCBpdCB3b3VsZCBiZSBleHBlbnNpdmUsXG4gICAgLy8gcmVxdWlyZXMgdHJpY2t5IGxvZ2ljLCBhbmQgd2UncmUgYWxyZWFkeSBidWlsZGluZyBpbmRleGVzIGZvciBzb21lIHRhYmxlc1xuICAgIC8vIGxpa2UgQWdncmVnYXRlZFRhYmxlIGFueXdheSlcbiAgICBpZiAob3B0aW9ucy5yZXNldCkge1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgICB5aWVsZCAqIE9iamVjdC52YWx1ZXModGhpcy5fY2FjaGUpLnNsaWNlKDAsIGxpbWl0KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB5aWVsZCAqIGF3YWl0IHRoaXMuX2J1aWxkQ2FjaGUob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZShvcHRpb25zKTtcbiAgICBsZXQgY29tcGxldGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gaXRlcmF0aW9uIHdhcyBjYW5jZWxsZWQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGNvbXBsZXRlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKTtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3RlbXAudmFsdWUuaW5kZXhdID0gdGVtcC52YWx1ZTtcbiAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbXBsZXRlZCkge1xuICAgICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHdyYXBwZWRJdGVtLnJvdykge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBkZWxldGUgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICBsZXQga2VlcCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2luZGV4U3ViRmlsdGVyKSB7XG4gICAgICBrZWVwID0gdGhpcy5faW5kZXhTdWJGaWx0ZXIod3JhcHBlZEl0ZW0uaW5kZXgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSkge1xuICAgICAga2VlcCA9IGtlZXAgJiYgZnVuYyh3cmFwcGVkSXRlbS5yb3dbYXR0cl0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyB0aGlzLl9vcmlncmFwaC5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IG90aGVySXRlbSBvZiBvcHRpb25zLml0ZW1zVG9Db25uZWN0IHx8IFtdKSB7XG4gICAgICB3cmFwcGVkSXRlbS5jb25uZWN0SXRlbShvdGhlckl0ZW0pO1xuICAgICAgb3RoZXJJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBmb3IgKGNvbnN0IGRlcml2ZWRUYWJsZSBvZiB0aGlzLmRlcml2ZWRUYWJsZXMpIHtcbiAgICAgIGRlcml2ZWRUYWJsZS5yZXNldCgpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jlc2V0Jyk7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jIGJ1aWxkQ2FjaGUgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fY2FjaGVQcm9taXNlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9jYWNoZVByb21pc2UgPSBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGVtcCBvZiB0aGlzLl9idWlsZENhY2hlKCkpIHt9IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbiAgICAgICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgfVxuICB9XG4gIGFzeW5jIGNvdW50Um93cyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpKS5sZW5ndGg7XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleFN1YkZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIGFkZFN1YkZpbHRlciAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhTdWJGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB0aGlzLl9vcmlncmFwaC5zYXZlVGFibGVzKCk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZUlkID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlSWQgJiYgdGhpcy5fb3JpZ3JhcGgudGFibGVzW2V4aXN0aW5nVGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgc2hvcnRlc3RQYXRoVG9UYWJsZSAob3RoZXJUYWJsZSkge1xuICAgIC8vIERpamtzdHJhJ3MgYWxnb3JpdGhtLi4uXG4gICAgY29uc3QgdmlzaXRlZCA9IHt9O1xuICAgIGNvbnN0IGRpc3RhbmNlcyA9IHt9O1xuICAgIGNvbnN0IHByZXZUYWJsZXMgPSB7fTtcbiAgICBjb25zdCB2aXNpdCA9IHRhcmdldElkID0+IHtcbiAgICAgIGNvbnN0IHRhcmdldFRhYmxlID0gdGhpcy5fb3JpZ3JhcGgudGFibGVzW3RhcmdldElkXTtcbiAgICAgIC8vIE9ubHkgY2hlY2sgdGhlIHVudmlzaXRlZCBkZXJpdmVkIGFuZCBwYXJlbnQgdGFibGVzXG4gICAgICBjb25zdCBuZWlnaGJvckxpc3QgPSBPYmplY3Qua2V5cyh0YXJnZXRUYWJsZS5fZGVyaXZlZFRhYmxlcylcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRUYWJsZS5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLnRhYmxlSWQpKVxuICAgICAgICAuZmlsdGVyKHRhYmxlSWQgPT4gIXZpc2l0ZWRbdGFibGVJZF0pO1xuICAgICAgLy8gQ2hlY2sgYW5kIGFzc2lnbiAob3IgdXBkYXRlKSB0ZW50YXRpdmUgZGlzdGFuY2VzIHRvIGVhY2ggbmVpZ2hib3JcbiAgICAgIGZvciAoY29uc3QgbmVpZ2hib3JJZCBvZiBuZWlnaGJvckxpc3QpIHtcbiAgICAgICAgaWYgKGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZGlzdGFuY2VzW25laWdoYm9ySWRdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRpc3RhbmNlc1t0YXJnZXRJZF0gKyAxIDwgZGlzdGFuY2VzW25laWdoYm9ySWRdKSB7XG4gICAgICAgICAgZGlzdGFuY2VzW25laWdoYm9ySWRdID0gZGlzdGFuY2VzW3RhcmdldElkXSArIDE7XG4gICAgICAgICAgcHJldlRhYmxlc1tuZWlnaGJvcklkXSA9IHRhcmdldElkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCB0aGlzIHRhYmxlIGlzIG9mZmljaWFsbHkgdmlzaXRlZDsgdGFrZSBpdCBvdXQgb2YgdGhlIHJ1bm5pbmdcbiAgICAgIC8vIGZvciBmdXR1cmUgdmlzaXRzIC8gY2hlY2tzXG4gICAgICB2aXNpdGVkW3RhcmdldElkXSA9IHRydWU7XG4gICAgICBkZWxldGUgZGlzdGFuY2VzW3RhcmdldElkXTtcbiAgICB9O1xuXG4gICAgLy8gU3RhcnQgd2l0aCB0aGlzIHRhYmxlXG4gICAgcHJldlRhYmxlc1t0aGlzLnRhYmxlSWRdID0gbnVsbDtcbiAgICBkaXN0YW5jZXNbdGhpcy50YWJsZUlkXSA9IDA7XG4gICAgbGV0IHRvVmlzaXQgPSBPYmplY3Qua2V5cyhkaXN0YW5jZXMpO1xuICAgIHdoaWxlICh0b1Zpc2l0Lmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIFZpc2l0IHRoZSBuZXh0IHRhYmxlIHRoYXQgaGFzIHRoZSBzaG9ydGVzdCBkaXN0YW5jZVxuICAgICAgdG9WaXNpdC5zb3J0KChhLCBiKSA9PiBkaXN0YW5jZXNbYV0gLSBkaXN0YW5jZXNbYl0pO1xuICAgICAgbGV0IG5leHRJZCA9IHRvVmlzaXQuc2hpZnQoKTtcbiAgICAgIGlmIChuZXh0SWQgPT09IG90aGVyVGFibGUudGFibGVJZCkge1xuICAgICAgICAvLyBGb3VuZCBvdGhlclRhYmxlISBTZW5kIGJhY2sgdGhlIGNoYWluIG9mIGNvbm5lY3RlZCB0YWJsZXNcbiAgICAgICAgY29uc3QgY2hhaW4gPSBbXTtcbiAgICAgICAgd2hpbGUgKHByZXZUYWJsZXNbbmV4dElkXSAhPT0gbnVsbCkge1xuICAgICAgICAgIGNoYWluLnVuc2hpZnQodGhpcy5fb3JpZ3JhcGgudGFibGVzW25leHRJZF0pO1xuICAgICAgICAgIG5leHRJZCA9IHByZXZUYWJsZXNbbmV4dElkXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2hhaW47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBWaXNpdCB0aGUgdGFibGVcbiAgICAgICAgdmlzaXQobmV4dElkKTtcbiAgICAgICAgdG9WaXNpdCA9IE9iamVjdC5rZXlzKGRpc3RhbmNlcyk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFdlIGRpZG4ndCBmaW5kIGl0OyB0aGVyZSdzIG5vIGNvbm5lY3Rpb25cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnQWdncmVnYXRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnRXhwYW5kZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBkZWxpbWl0ZXJcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKHsgbGltaXQgfSkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiBpbmRleGVzLm1hcChpbmRleCA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXhcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXg6IHdyYXBwZWRJdGVtLmluZGV4XG4gICAgICB9O1xuICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZVRhYmxlKHsgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJyB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9vcmlncmFwaC5zYXZlVGFibGVzKCk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIGdldCBjbGFzc09iaiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5fb3JpZ3JhcGguY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5fb3JpZ3JhcGgudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX29yaWdyYXBoLnRhYmxlc1t0YWJsZUlkXTtcbiAgICB9KTtcbiAgfVxuICBnZXQgaW5Vc2UgKCkge1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5fb3JpZ3JhcGguY2xhc3Nlcykuc29tZShjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGVJZCA9PT0gdGhpcy50YWJsZUlkIHx8XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTEgfHxcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGlmICh0aGlzLmluVXNlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBpbi11c2UgdGFibGUgJHt0aGlzLnRhYmxlSWR9YCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9vcmlncmFwaC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLl9vcmlncmFwaC5zYXZlVGFibGVzKCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUYWJsZSwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVGFibGUvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IFtdO1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLl9kYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93OiB0aGlzLl9kYXRhW2luZGV4XSB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljRGljdFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB7fTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY0RpY3RUYWJsZTtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWllcmQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgQWdncmVnYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIHx8IHt9KSkge1xuICAgICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fb3JpZ3JhcGguaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX29yaWdyYXBoLl9kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqYnO1xuICB9XG4gIGRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUgKGF0dHIsIGZ1bmMpIHtcbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfdXBkYXRlSXRlbSAob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHNvIHRoYXQgQWdncmVnYXRlZFRhYmxlIGNhbiB0YWtlIGFkdmFudGFnZVxuICAgIC8vIG9mIHRoZSBwYXJ0aWFsbHktYnVpbHQgY2FjaGUgYXMgaXQgZ29lcywgYW5kIHBvc3Rwb25lIGZpbmlzaGluZyBpdGVtc1xuICAgIC8vIHVudGlsIGFmdGVyIHRoZSBwYXJlbnQgdGFibGUgaGFzIGJlZW4gZnVsbHkgaXRlcmF0ZWRcblxuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuX2l0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt3cmFwcGVkSXRlbS5pbmRleF0gPSB3cmFwcGVkSXRlbTtcbiAgICAgIC8vIEdvIGFoZWFkIGFuZCB5aWVsZCB0aGUgdW5maW5pc2hlZCBpdGVtOyB0aGlzIG1ha2VzIGl0IHBvc3NpYmxlIGZvclxuICAgICAgLy8gY2xpZW50IGFwcHMgdG8gYmUgbW9yZSByZXNwb25zaXZlIGFuZCByZW5kZXIgcGFydGlhbCByZXN1bHRzLCBidXQgYWxzb1xuICAgICAgLy8gbWVhbnMgdGhhdCB0aGV5IG5lZWQgdG8gd2F0Y2ggZm9yIHdyYXBwZWRJdGVtLm9uKCd1cGRhdGUnKSBldmVudHNcbiAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgIH1cblxuICAgIC8vIFNlY29uZCBwYXNzOiBub3cgdGhhdCB3ZSd2ZSBjb21wbGV0ZWQgdGhlIGZ1bGwgaXRlcmF0aW9uIG9mIHRoZSBwYXJlbnRcbiAgICAvLyB0YWJsZSwgd2UgY2FuIGZpbmlzaCBlYWNoIGl0ZW1cbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIHRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgaWYgKCF0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IFN0cmluZyh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0pIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgICAgZXhpc3RpbmdJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB3cmFwcGVkUGFyZW50LmNvbm5lY3RJdGVtKGV4aXN0aW5nSXRlbSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0oZXhpc3RpbmdJdGVtLCB3cmFwcGVkUGFyZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0obmV3SXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0gc3VwZXIuZ2V0QXR0cmlidXRlRGV0YWlscygpO1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5yZWR1Y2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBBZ2dyZWdhdGVkVGFibGU7XG4iLCJjb25zdCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5kdXBsaWNhdGVkQXR0cmlidXRlcyB8fCB7fTtcbiAgICB9XG4gICAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgICAgb2JqLmR1cGxpY2F0ZWRBdHRyaWJ1dGVzID0gdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXM7XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICBkdXBsaWNhdGVBdHRyaWJ1dGUgKHBhcmVudElkLCBhdHRyaWJ1dGUpIHtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzW3BhcmVudElkXSA9IHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzW3BhcmVudElkXSB8fCBbXTtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzW3BhcmVudElkXS5wdXNoKGF0dHJpYnV0ZSk7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuICAgIF9kdXBsaWNhdGVBdHRyaWJ1dGVzICh3cmFwcGVkSXRlbSkge1xuICAgICAgZm9yIChjb25zdCBbcGFyZW50SWQsIGF0dHJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICBjb25zdCBwYXJlbnROYW1lID0gdGhpcy5fb3JpZ3JhcGgudGFibGVzW3BhcmVudElkXS5uYW1lO1xuICAgICAgICB3cmFwcGVkSXRlbS5yb3dbYCR7cGFyZW50TmFtZX0uJHthdHRyfWBdID0gd3JhcHBlZEl0ZW0uY29ubmVjdGVkSXRlbXNbcGFyZW50SWRdWzBdLnJvd1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gICAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgICBjb25zdCBhbGxBdHRycyA9IHN1cGVyLmdldEF0dHJpYnV0ZURldGFpbHMoKTtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgYXR0ck5hbWUgPSBgJHt0aGlzLl9vcmlncmFwaC50YWJsZXNbcGFyZW50SWRdLm5hbWV9LiR7YXR0cn1gO1xuICAgICAgICBhbGxBdHRyc1thdHRyTmFtZV0gPSBhbGxBdHRyc1thdHRyTmFtZV0gfHwgeyBuYW1lOiBhdHRyTmFtZSB9O1xuICAgICAgICBhbGxBdHRyc1thdHRyTmFtZV0uY29waWVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhbGxBdHRycztcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgRXhwYW5kZWRUYWJsZSBleHRlbmRzIER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbihTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLmRlbGltaXRlciA9IG9wdGlvbnMuZGVsaW1pdGVyIHx8ICcsJztcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqQnO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgdmFsdWVzID0gKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gfHwgJycpLnNwbGl0KHRoaXMuZGVsaW1pdGVyKTtcbiAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdmFsdWVzKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IHt9O1xuICAgICAgICByb3dbdGhpcy5fYXR0cmlidXRlXSA9IHZhbHVlO1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlcyhuZXdJdGVtKTtcbiAgICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFeHBhbmRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBGYWNldGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSB8fCAhdGhpcy5fdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgYW5kIHZhbHVlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGBbJHt0aGlzLl92YWx1ZX1dYDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAvLyBOb3JtYWwgZmFjZXRpbmcganVzdCBnaXZlcyBhIHN1YnNldCBvZiB0aGUgb3JpZ2luYWwgdGFibGVcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogT2JqZWN0LmFzc2lnbih7fSwgd3JhcHBlZFBhcmVudC5yb3cpLFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGYWNldGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIFRyYW5zcG9zZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5faW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIGlmICh0aGlzLl9pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmluZGV4ID0gdGhpcy5faW5kZXg7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGDhtYAke3RoaXMuX2luZGV4fWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIC8vIFByZS1idWlsZCB0aGUgcGFyZW50IHRhYmxlJ3MgY2FjaGVcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgYXdhaXQgcGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuXG4gICAgLy8gSXRlcmF0ZSB0aGUgcm93J3MgYXR0cmlidXRlcyBhcyBpbmRleGVzXG4gICAgY29uc3Qgd3JhcHBlZFBhcmVudCA9IHBhcmVudFRhYmxlLl9jYWNoZVt0aGlzLl9pbmRleF0gfHwgeyByb3c6IHt9IH07XG4gICAgZm9yIChjb25zdCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgcm93OiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gdmFsdWUgOiB7IHZhbHVlIH0sXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVHJhbnNwb3NlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiBmcm9tICcuL0R1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbi5qcyc7XG5cbmNsYXNzIENvbm5lY3RlZFRhYmxlIGV4dGVuZHMgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluKFRhYmxlKSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBTcGluIHRocm91Z2ggYWxsIG9mIHRoZSBwYXJlbnRUYWJsZXMgc28gdGhhdCB0aGVpciBfY2FjaGUgaXMgcHJlLWJ1aWx0XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiBwYXJlbnRUYWJsZXMpIHtcbiAgICAgIGF3YWl0IHBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcbiAgICB9XG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZSkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbaW5kZXhdKVxuICAgICAgfSk7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKG5ld0l0ZW0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX29yaWdyYXBoID0gb3B0aW9ucy5vcmlncmFwaDtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5fb3JpZ3JhcGggfHwgIXRoaXMuY2xhc3NJZCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYF9vcmlncmFwaCwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb25zID0gb3B0aW9ucy5hbm5vdGF0aW9ucyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zXG4gICAgfTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5fb3JpZ3JhcGguc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXRIYXNoVGFibGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiBhdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgfVxuICBnZXQgdGFibGUgKCkge1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgdGhpcy5fb3JpZ3JhcGguV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMuX29yaWdyYXBoLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIF9kZXJpdmVHZW5lcmljQ2xhc3MgKG5ld1RhYmxlLCB0eXBlID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuX29yaWdyYXBoLm5ld0NsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlXG4gICAgfSk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRUcmFuc3Bvc2UoaW5kZXhlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAoKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5UcmFuc3Bvc2UoKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5fb3JpZ3JhcGguY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMuX29yaWdyYXBoLnNhdmVDbGFzc2VzKCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyB0aGlzLl9vcmlncmFwaC5XUkFQUEVSUy5Ob2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAvLyBBcmUgd2UgdGhlIHNvdXJjZSBvciB0YXJnZXQgb2YgdGhlIGV4aXN0aW5nIGVkZ2UgKGludGVybmFsbHksIGluIHRlcm1zXG4gICAgICAvLyBvZiBzb3VyY2VJZCAvIHRhcmdldElkLCBub3QgZWRnZUNsYXNzLmRpcmVjdGlvbik/XG4gICAgICBjb25zdCBpc1NvdXJjZSA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQ7XG5cbiAgICAgIC8vIEFzIHdlJ3JlIGNvbnZlcnRlZCB0byBhbiBlZGdlLCBvdXIgbmV3IHJlc3VsdGluZyBzb3VyY2UgQU5EIHRhcmdldFxuICAgICAgLy8gc2hvdWxkIGJlIHdoYXRldmVyIGlzIGF0IHRoZSBvdGhlciBlbmQgb2YgZWRnZUNsYXNzIChpZiBhbnl0aGluZylcbiAgICAgIGlmIChpc1NvdXJjZSkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoIWlzU291cmNlKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgICAvLyBUT0RPOiBpbnN0ZWFkIG9mIGRlbGV0aW5nIHRoZSBleGlzdGluZyBlZGdlIGNsYXNzLCBzaG91bGQgd2UgbGVhdmUgaXRcbiAgICAgIC8vIGhhbmdpbmcgKyB1bmNvbm5lY3RlZD9cbiAgICAgIGVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgIC8vIE9rYXksIHdlJ3ZlIGdvdCB0d28gZWRnZXMsIHNvIHRoaXMgaXMgYSBsaXR0bGUgbW9yZSBzdHJhaWdodGZvcndhcmRcbiAgICAgIGxldCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5fb3JpZ3JhcGguY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5fb3JpZ3JhcGguY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgICAgIHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgLy8gQ29uY2F0ZW5hdGUgdGhlIGludGVybWVkaWF0ZSB0YWJsZUlkIGxpc3RzLCBlbWFuYXRpbmcgb3V0IGZyb20gdGhlXG4gICAgICAvLyAobmV3KSBlZGdlIHRhYmxlXG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gc291cmNlRWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBzb3VyY2VFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHRhcmdldEVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQodGFyZ2V0RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmICh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgLy8gRGVsZXRlIGVhY2ggb2YgdGhlIGVkZ2UgY2xhc3Nlc1xuICAgICAgc291cmNlRWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgICAgdGFyZ2V0RWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgIH1cbiAgICB0aGlzLmRlbGV0ZSgpO1xuICAgIGRlbGV0ZSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzSWRzO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5fb3JpZ3JhcGgubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBhdHRyaWJ1dGUsIG90aGVyQXR0cmlidXRlIH0pIHtcbiAgICBjb25zdCB0aGlzSGFzaCA9IHRoaXMuZ2V0SGFzaFRhYmxlKGF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MuZ2V0SGFzaFRhYmxlKG90aGVyQXR0cmlidXRlKTtcbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzOiBbIHRoaXNIYXNoLnRhYmxlSWQgXSxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkczogWyBvdGhlckhhc2gudGFibGVJZCBdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLl9vcmlncmFwaC5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdFZGdlQ2xhc3M7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBkaXNjb25uZWN0QWxsRWRnZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIHRoaXMuY29ubmVjdGVkQ2xhc3NlcygpKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgeWllbGQgdGhpcy5fb3JpZ3JhcGguY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIC8vIHNvdXJjZVRhYmxlSWRzIGFuZCB0YXJnZXRUYWJsZUlkcyBhcmUgbGlzdHMgb2YgYW55IGludGVybWVkaWF0ZSB0YWJsZXMsXG4gICAgLy8gYmVnaW5uaW5nIHdpdGggdGhlIGVkZ2UgdGFibGUgKGJ1dCBub3QgaW5jbHVkaW5nIGl0KSwgdGhhdCBsZWFkIHRvIHRoZVxuICAgIC8vIHNvdXJjZSAvIHRhcmdldCBub2RlIHRhYmxlcyAoYnV0IG5vdCBpbmNsdWRpbmcpIHRob3NlXG5cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgdGhpcy5fb3JpZ3JhcGguV1JBUFBFUlMuRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLl9vcmlncmFwaC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgcmV0dXJuIHsgdGFibGVJZCwgaW5kZXgsIGRpc3Q6IE1hdGguYWJzKHRhYmxlSWRMaXN0IC8gMiAtIGluZGV4KSB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIHRhYmxlRGlzdGFuY2VzID0gdGFibGVEaXN0YW5jZXMuZmlsdGVyKCh7IHRhYmxlSWQgfSkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCB7IHRhYmxlSWQsIGluZGV4IH0gPSB0YWJsZURpc3RhbmNlcy5zb3J0KChhLCBiKSA9PiBhLmRpc3QgLSBiLmRpc3QpWzBdO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGFibGVJZDtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZSgwLCBpbmRleCkucmV2ZXJzZSgpO1xuICAgICAgcmVzdWx0Lm5vZGVUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKGluZGV4ICsgMSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICB0ZW1wLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICBkZWxldGUgdGVtcC5jbGFzc0lkO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW3RlbXAuc291cmNlQ2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC5zb3VyY2VUYWJsZUlkcywgc291cmNlQ2xhc3MpO1xuICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiB0ZW1wLnNvdXJjZUNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGVtcC50YXJnZXRDbGFzc0lkICYmIHRlbXAuc291cmNlQ2xhc3NJZCAhPT0gdGVtcC50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiB0ZW1wLnRhcmdldENsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBub2RlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICB0aGlzLl9vcmlncmFwaC5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgc2lkZSwgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KSB7XG4gICAgaWYgKHNpZGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2UoeyBub2RlQ2xhc3MsIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSk7XG4gICAgfSBlbHNlIGlmIChzaWRlID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFBvbGl0aWNhbE91dHNpZGVyRXJyb3I6IFwiJHtzaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgICB0aGlzLl9vcmlncmFwaC5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIHRvZ2dsZURpcmVjdGlvbiAoZGlyZWN0ZWQpIHtcbiAgICBpZiAoZGlyZWN0ZWQgPT09IGZhbHNlIHx8IHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgZGVsZXRlIHRoaXMuc3dhcHBlZERpcmVjdGlvbjtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmRpcmVjdGVkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEaXJlY3RlZCB3YXMgYWxyZWFkeSB0cnVlLCBqdXN0IHN3aXRjaCBzb3VyY2UgYW5kIHRhcmdldFxuICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSB0ZW1wO1xuICAgICAgdGVtcCA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSB0ZW1wO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5fb3JpZ3JhcGguc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBjb25uZWN0U291cmNlICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNraXBTYXZlID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5fb3JpZ3JhcGguY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLmdldEhhc2hUYWJsZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyBzb3VyY2VDbGFzcy50YWJsZSA6IHNvdXJjZUNsYXNzLmdldEhhc2hUYWJsZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cblxuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fb3JpZ3JhcGguc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc2tpcFNhdmUgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMuZ2V0SGFzaFRhYmxlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRhcmdldENsYXNzLnRhYmxlIDogdGFyZ2V0Q2xhc3MuZ2V0SGFzaFRhYmxlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9vcmlncmFwaC5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGlzY29ubmVjdFNvdXJjZSAoeyBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX29yaWdyYXBoLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fb3JpZ3JhcGguc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gIH1cbiAgZGlzY29ubmVjdCAoKSB7XG4gICAgZm9yIChjb25zdCBpdGVtTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuY29ubmVjdGVkSXRlbXMpKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbUxpc3QpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSAoaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdIHx8IFtdKS5pbmRleE9mKHRoaXMpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IHt9O1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh7IHRhYmxlSWRzLCBsaW1pdCA9IEluZmluaXR5IH0pIHtcbiAgICAvLyBGaXJzdCBtYWtlIHN1cmUgdGhhdCBhbGwgdGhlIHRhYmxlIGNhY2hlcyBoYXZlIGJlZW4gZnVsbHkgYnVpbHQgYW5kXG4gICAgLy8gY29ubmVjdGVkXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwodGFibGVJZHMubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3NPYmouX29yaWdyYXBoLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSkge1xuICAgICAgeWllbGQgaXRlbTtcbiAgICAgIGkrKztcbiAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbdGFibGVJZHNbMF1dIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGhpc1RhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1t0aGlzVGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0geyBsaW1pdDogSW5maW5pdHkgfSkge1xuICAgIGNvbnN0IGVkZ2VJZHMgPSBvcHRpb25zLmVkZ2VJZHMgfHwgdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHM7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIE9iamVjdC5rZXlzKGVkZ2VJZHMpKSB7XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLl9vcmlncmFwaC5jbGFzc2VzW2VkZ2VJZF07XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NPYmouY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnRhYmxlSWRzID0gZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnMudGFibGVJZHMgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgIGkrKztcbiAgICAgICAgaWYgKGkgPj0gb3B0aW9ucy5saW1pdCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogc291cmNlTm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlVGFibGVJZCA9IHRoaXMuY2xhc3NPYmouX29yaWdyYXBoXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgb3B0aW9ucy50YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmouc291cmNlVGFibGVJZHNcbiAgICAgIC5jb25jYXQoWyBzb3VyY2VUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkID0gdGhpcy5jbGFzc09iai5fb3JpZ3JhcGhcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF0udGFibGVJZDtcbiAgICBvcHRpb25zLnRhYmxlSWRzID0gdGhpcy5jbGFzc09iai50YXJnZXRUYWJsZUlkc1xuICAgICAgLmNvbmNhdChbIHRhcmdldFRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICBpZiAodGhpcy5lbnRyaWVzW2hhc2hdLmluZGV4T2YodmFsdWUpID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcbmxldCBORVhUX1RBQkxFX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBvcmlncmFwaC5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UQUJMRVMgPSBUQUJMRVM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHsgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbTsgfSxcbiAgICAgIGtleTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKCF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICAhd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR3JhbmRwYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIHlpZWxkIHtcbiAgICAgICAgICBsZWZ0OiB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICByaWdodDogb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgICAgIG5vb3A6ICgpID0+IHt9XG4gICAgfTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMudGFibGVzID0gdGhpcy5oeWRyYXRlKCdvcmlncmFwaF90YWJsZXMnLCB0aGlzLlRBQkxFUyk7XG4gICAgTkVYVF9UQUJMRV9JRCA9IE9iamVjdC5rZXlzKHRoaXMudGFibGVzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgdGFibGVJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQodGFibGVJZC5tYXRjaCgvdGFibGUoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgb3VyIGNsYXNzIHNwZWNpZmljYXRpb25zXG4gICAgdGhpcy5jbGFzc2VzID0gdGhpcy5oeWRyYXRlKCdvcmlncmFwaF9jbGFzc2VzJywgdGhpcy5DTEFTU0VTKTtcbiAgICBORVhUX0NMQVNTX0lEID0gT2JqZWN0LmtleXModGhpcy5jbGFzc2VzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgY2xhc3NJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQoY2xhc3NJZC5tYXRjaCgvY2xhc3MoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuICB9XG5cbiAgc2F2ZVRhYmxlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ29yaWdyYXBoX3RhYmxlcycsIHRoaXMudGFibGVzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3RhYmxlVXBkYXRlJyk7XG4gIH1cbiAgc2F2ZUNsYXNzZXMgKCkge1xuICAgIHRoaXMuZGVoeWRyYXRlKCdvcmlncmFwaF9jbGFzc2VzJywgdGhpcy5jbGFzc2VzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NsYXNzVXBkYXRlJyk7XG4gIH1cblxuICBoeWRyYXRlIChzdG9yYWdlS2V5LCBUWVBFUykge1xuICAgIGxldCBjb250YWluZXIgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKHN0b3JhZ2VLZXkpO1xuICAgIGNvbnRhaW5lciA9IGNvbnRhaW5lciA/IEpTT04ucGFyc2UoY29udGFpbmVyKSA6IHt9O1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvbnRhaW5lcikpIHtcbiAgICAgIGNvbnN0IHR5cGUgPSB2YWx1ZS50eXBlO1xuICAgICAgZGVsZXRlIHZhbHVlLnR5cGU7XG4gICAgICB2YWx1ZS5vcmlncmFwaCA9IHRoaXM7XG4gICAgICBjb250YWluZXJba2V5XSA9IG5ldyBUWVBFU1t0eXBlXSh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cbiAgZGVoeWRyYXRlIChzdG9yYWdlS2V5LCBjb250YWluZXIpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlLl90b1Jhd09iamVjdCgpO1xuICAgICAgICByZXN1bHRba2V5XS50eXBlID0gdmFsdWUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oc3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gICAgfVxuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG5cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMudGFibGVJZCkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHtORVhUX1RBQkxFX0lEfWA7XG4gICAgICBORVhUX1RBQkxFX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLlRBQkxFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5vcmlncmFwaCA9IHRoaXM7XG4gICAgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdO1xuICB9XG4gIGNyZWF0ZUNsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYGVtcHR5YCB9KSB7XG4gICAgaWYgKCFvcHRpb25zLmNsYXNzSWQpIHtcbiAgICAgIG9wdGlvbnMuY2xhc3NJZCA9IGBjbGFzcyR7TkVYVF9DTEFTU19JRH1gO1xuICAgICAgTkVYVF9DTEFTU19JRCArPSAxO1xuICAgIH1cbiAgICBjb25zdCBUeXBlID0gdGhpcy5DTEFTU0VTW29wdGlvbnMudHlwZV07XG4gICAgZGVsZXRlIG9wdGlvbnMudHlwZTtcbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIG5ld1RhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGVPYmogPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZU9iajtcbiAgfVxuICBuZXdDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld0NsYXNzT2JqID0gdGhpcy5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0NsYXNzT2JqO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljVGFibGUgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY1RhYmxlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24gPSAndHh0JywgdGV4dCB9KSB7XG4gICAgbGV0IGRhdGEsIGF0dHJpYnV0ZXM7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5uZXdUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5uZXdDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBkZWxldGVBbGxVbnVzZWRUYWJsZXMgKCkge1xuICAgIGZvciAoY29uc3QgdGFibGVJZCBpbiB0aGlzLnRhYmxlcykge1xuICAgICAgaWYgKHRoaXMudGFibGVzW3RhYmxlSWRdKSB7XG4gICAgICAgIHRyeSB7IHRoaXMudGFibGVzW3RhYmxlSWRdLmRlbGV0ZSgpOyB9IGNhdGNoIChlcnIpIHt9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGRlbGV0ZUFsbENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc09iai5kZWxldGUoKTtcbiAgICB9XG4gIH1cbiAgZ2V0Q2xhc3NEYXRhICgpIHtcbiAgICBjb25zdCByZXN1bHRzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIHJlc3VsdHNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5jdXJyZW50RGF0YTtcbiAgICB9XG4gIH1cbiAgcmVnaXN0ZXJQbHVnaW4gKG5hbWUsIHBsdWdpbikge1xuICAgIHRoaXMucGx1Z2luc1tuYW1lXSA9IHBsdWdpbjtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBPcmlncmFwaDtcbiIsImltcG9ydCBPcmlncmFwaCBmcm9tICcuL09yaWdyYXBoLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG9yaWdyYXBoID0gbmV3IE9yaWdyYXBoKHdpbmRvdy5GaWxlUmVhZGVyLCB3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm9yaWdyYXBoLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgb3JpZ3JhcGg7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycyIsImluZGV4T2YiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImZvckVhY2giLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJPYmplY3QiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwiY29uZmlndXJhYmxlIiwiZ2V0IiwidGVtcCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIlRhYmxlIiwib3B0aW9ucyIsIl9vcmlncmFwaCIsIm9yaWdyYXBoIiwidGFibGVJZCIsIkVycm9yIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleFN1YkZpbHRlciIsImluZGV4U3ViRmlsdGVyIiwiX2F0dHJpYnV0ZVN1YkZpbHRlcnMiLCJhdHRyaWJ1dGVTdWJGaWx0ZXJzIiwiX3RvUmF3T2JqZWN0IiwicmVzdWx0IiwiX2F0dHJpYnV0ZXMiLCJ1c2VkQnlDbGFzc2VzIiwiX3VzZWRCeUNsYXNzZXMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsImZ1bmMiLCJpdGVyYXRlIiwicmVzZXQiLCJfY2FjaGUiLCJsaW1pdCIsInVuZGVmaW5lZCIsIkluZmluaXR5IiwidmFsdWVzIiwic2xpY2UiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJpdGVyYXRvciIsIl9pdGVyYXRlIiwiY29tcGxldGVkIiwibmV4dCIsImRvbmUiLCJfZmluaXNoSXRlbSIsIndyYXBwZWRJdGVtIiwicm93Iiwia2VlcCIsImRpc2Nvbm5lY3QiLCJfd3JhcCIsInRhYmxlIiwiY2xhc3NPYmoiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwib3RoZXJJdGVtIiwiaXRlbXNUb0Nvbm5lY3QiLCJjb25uZWN0SXRlbSIsImRlcml2ZWRUYWJsZSIsIm5hbWUiLCJidWlsZENhY2hlIiwiX2NhY2hlUHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY291bnRSb3dzIiwia2V5cyIsImxlbmd0aCIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImNvbXBsZXRlIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRTdWJGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwic2F2ZVRhYmxlcyIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZUlkIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJ0YWJsZXMiLCJzaG9ydGVzdFBhdGhUb1RhYmxlIiwib3RoZXJUYWJsZSIsInZpc2l0ZWQiLCJkaXN0YW5jZXMiLCJwcmV2VGFibGVzIiwidmlzaXQiLCJ0YXJnZXRJZCIsInRhcmdldFRhYmxlIiwibmVpZ2hib3JMaXN0IiwiY29uY2F0IiwicGFyZW50VGFibGVzIiwibWFwIiwicGFyZW50VGFibGUiLCJmaWx0ZXIiLCJuZWlnaGJvcklkIiwidG9WaXNpdCIsInNvcnQiLCJhIiwiYiIsIm5leHRJZCIsInNoaWZ0IiwiY2hhaW4iLCJ1bnNoaWZ0IiwiYWdncmVnYXRlIiwiZXhwYW5kIiwiZGVsaW1pdGVyIiwiY2xvc2VkRmFjZXQiLCJvcGVuRmFjZXQiLCJjbG9zZWRUcmFuc3Bvc2UiLCJpbmRleGVzIiwib3BlblRyYW5zcG9zZSIsImNvbm5lY3QiLCJvdGhlclRhYmxlTGlzdCIsImNsYXNzZXMiLCJyZWR1Y2UiLCJhZ2ciLCJpblVzZSIsInNvbWUiLCJzb3VyY2VUYWJsZUlkcyIsInRhcmdldFRhYmxlSWRzIiwiZGVsZXRlIiwiZXhlYyIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIml0ZW0iLCJTdGF0aWNEaWN0VGFibGUiLCJTaW5nbGVQYXJlbnRNaXhpbiIsIl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4iLCJBZ2dyZWdhdGVkVGFibGUiLCJfYXR0cmlidXRlIiwiX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsInJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsIl9kZWh5ZHJhdGVGdW5jdGlvbiIsImRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUiLCJfdXBkYXRlSXRlbSIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJuZXdXcmFwcGVkSXRlbSIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwicmVkdWNlZCIsIkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIiwiX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlZEF0dHJpYnV0ZXMiLCJkdXBsaWNhdGVBdHRyaWJ1dGUiLCJwYXJlbnRJZCIsIl9kdXBsaWNhdGVBdHRyaWJ1dGVzIiwicGFyZW50TmFtZSIsImNvbm5lY3RlZEl0ZW1zIiwiYXR0ck5hbWUiLCJjb3BpZWQiLCJFeHBhbmRlZFRhYmxlIiwic3BsaXQiLCJGYWNldGVkVGFibGUiLCJfdmFsdWUiLCJUcmFuc3Bvc2VkVGFibGUiLCJfaW5kZXgiLCJDb25uZWN0ZWRUYWJsZSIsImpvaW4iLCJiYXNlUGFyZW50VGFibGUiLCJvdGhlclBhcmVudFRhYmxlcyIsIkdlbmVyaWNDbGFzcyIsImNsYXNzSWQiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbnMiLCJzZXRDbGFzc05hbWUiLCJzYXZlQ2xhc3NlcyIsImhhc0N1c3RvbU5hbWUiLCJnZXRIYXNoVGFibGUiLCJpbnRlcnByZXRBc05vZGVzIiwibmV3Q2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiX2Rlcml2ZUdlbmVyaWNDbGFzcyIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc0lkcyIsIk5vZGVXcmFwcGVyIiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiZWRnZUNsYXNzIiwiaXNTb3VyY2UiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsInRhYmxlSWRMaXN0IiwicmV2ZXJzZSIsImRpcmVjdGVkIiwic291cmNlRWRnZUNsYXNzIiwidGFyZ2V0RWRnZUNsYXNzIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJuZXdFZGdlQ2xhc3MiLCJjcmVhdGVDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5vZGVDbGFzcyIsImNvbm5lY3RlZENsYXNzZXMiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsImVkZ2VDbGFzc0lkIiwiRWRnZUNsYXNzIiwiRWRnZVdyYXBwZXIiLCJfc3BsaXRUYWJsZUlkTGlzdCIsIm90aGVyQ2xhc3MiLCJub2RlVGFibGVJZExpc3QiLCJlZGdlVGFibGVJZCIsImVkZ2VUYWJsZUlkTGlzdCIsInN0YXRpY0V4aXN0cyIsInRhYmxlRGlzdGFuY2VzIiwic3RhcnRzV2l0aCIsImRpc3QiLCJNYXRoIiwiYWJzIiwibmV3Tm9kZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsInNpZGUiLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImNvbm5lY3RTb3VyY2UiLCJjb25uZWN0VGFyZ2V0IiwidG9nZ2xlRGlyZWN0aW9uIiwic3dhcHBlZERpcmVjdGlvbiIsInNraXBTYXZlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwiaXRlbUxpc3QiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsImFsbCIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0aGlzVGFibGVJZCIsInJlbWFpbmluZ1RhYmxlSWRzIiwiZWRnZXMiLCJlZGdlSWRzIiwiZWRnZUlkIiwic291cmNlTm9kZXMiLCJzb3VyY2VUYWJsZUlkIiwidGFyZ2V0Tm9kZXMiLCJ0YXJnZXRUYWJsZUlkIiwiSW5NZW1vcnlJbmRleCIsInRvUmF3T2JqZWN0IiwiaXRlckVudHJpZXMiLCJoYXNoIiwidmFsdWVMaXN0IiwiaXRlckhhc2hlcyIsIml0ZXJWYWx1ZUxpc3RzIiwiZ2V0VmFsdWVMaXN0IiwiYWRkVmFsdWUiLCJORVhUX0NMQVNTX0lEIiwiTkVYVF9UQUJMRV9JRCIsIk9yaWdyYXBoIiwiRmlsZVJlYWRlciIsImxvY2FsU3RvcmFnZSIsIm1pbWUiLCJkZWJ1ZyIsInBsdWdpbnMiLCJEQVRBTElCX0ZPUk1BVFMiLCJUQUJMRVMiLCJDTEFTU0VTIiwiSU5ERVhFUyIsIk5BTUVEX0ZVTkNUSU9OUyIsImlkZW50aXR5IiwicmF3SXRlbSIsImtleSIsIlR5cGVFcnJvciIsInBhcmVudFR5cGUiLCJkZWZhdWx0RmluaXNoIiwidGhpc1dyYXBwZWRJdGVtIiwib3RoZXJXcmFwcGVkSXRlbSIsImxlZnQiLCJyaWdodCIsInNoYTEiLCJKU09OIiwic3RyaW5naWZ5Iiwibm9vcCIsImh5ZHJhdGUiLCJoaWdoZXN0TnVtIiwibWF4IiwicGFyc2VJbnQiLCJtYXRjaCIsImRlaHlkcmF0ZSIsInN0b3JhZ2VLZXkiLCJUWVBFUyIsImNvbnRhaW5lciIsImdldEl0ZW0iLCJwYXJzZSIsInNldEl0ZW0iLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiVHlwZSIsInNlbGVjdG9yIiwibmV3VGFibGVPYmoiLCJuZXdDbGFzc09iaiIsImFkZEZpbGVBc1N0YXRpY1RhYmxlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJjb25zb2xlIiwid2FybiIsInRleHQiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJlcnIiLCJkZWxldGVBbGxDbGFzc2VzIiwiZ2V0Q2xhc3NEYXRhIiwicmVzdWx0cyIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luIiwid2luZG93IiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QkMsdUJBQXZCLEVBQWdEO1VBQzVDLENBQUMsS0FBS0wsYUFBTCxDQUFtQkcsU0FBbkIsQ0FBTCxFQUFvQzthQUM3QkgsYUFBTCxDQUFtQkcsU0FBbkIsSUFBZ0MsRUFBaEM7OztVQUVFLENBQUNFLHVCQUFMLEVBQThCO1lBQ3hCLEtBQUtMLGFBQUwsQ0FBbUJHLFNBQW5CLEVBQThCRyxPQUE5QixDQUFzQ0YsUUFBdEMsTUFBb0QsQ0FBQyxDQUF6RCxFQUE0RDs7Ozs7V0FJekRKLGFBQUwsQ0FBbUJHLFNBQW5CLEVBQThCSSxJQUE5QixDQUFtQ0gsUUFBbkM7OztJQUVGSSxHQUFHLENBQUVMLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNwQixLQUFLSixhQUFMLENBQW1CRyxTQUFuQixDQUFKLEVBQW1DO1lBQzdCLENBQUNDLFFBQUwsRUFBZTtpQkFDTixLQUFLSixhQUFMLENBQW1CRyxTQUFuQixDQUFQO1NBREYsTUFFTztjQUNETSxLQUFLLEdBQUcsS0FBS1QsYUFBTCxDQUFtQkcsU0FBbkIsRUFBOEJHLE9BQTlCLENBQXNDRixRQUF0QyxDQUFaOztjQUNJSyxLQUFLLElBQUksQ0FBYixFQUFnQjtpQkFDVFQsYUFBTCxDQUFtQkcsU0FBbkIsRUFBOEJPLE1BQTlCLENBQXFDRCxLQUFyQyxFQUE0QyxDQUE1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
