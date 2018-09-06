'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var sha1 = _interopDefault(require('sha1'));
var FileReader = _interopDefault(require('filereader'));

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
    this._mure = options.mure;
    this.tableId = options.tableId;

    if (!this._mure || !this.tableId) {
      throw new Error(`mure and tableId are required`);
    }

    this._expectedAttributes = options.attributes || {};
    this._observedAttributes = {};
    this._derivedTables = options.derivedTables || {};
    this._derivedAttributeFunctions = {};

    if (options.derivedAttributeFunctions) {
      for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions)) {
        this._derivedAttributeFunctions[attr] = this._mure.hydrateFunction(stringifiedFunc);
      }
    }
  }

  _toRawObject() {
    const result = {
      tableId: this.tableId,
      attributes: this._attributes,
      derivedTables: this._derivedTables,
      usedByClasses: this._usedByClasses,
      derivedAttributeFunctions: {}
    };

    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this._mure.dehydrateFunction(func);
    }

    return result;
  }

  get name() {
    throw new Error(`this function should be overridden`);
  }

  async *iterate(options = {}) {
    // Generic caching stuff; this isn't just for performance. ConnectedTable's
    // algorithm requires that its parent tables have pre-built indexes (we
    // technically could implement it differently, but it would be expensive,
    // requires tricky logic, and we're already building indexes for some tables
    // like AggregatedTable anyway)
    if (options.reset) {
      this.reset();
    }

    if (this._cache) {
      for (const finishedItem of Object.values(this._cache)) {
        yield finishedItem;
      }

      return;
    }

    yield* await this._buildCache(options);
  }

  reset() {
    delete this._partialCache;
    delete this._cache;

    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }

    this.trigger('reset');
  }

  async *_buildCache(options) {
    // TODO: in large data scenarios, we should build the cache / index
    // externally on disk
    this._partialCache = {};
    const limit = options.limit === undefined ? Infinity : options.limit;
    delete options.limit;

    const iterator = this._iterate(options);

    let completed = false;

    for (let i = 0; i < limit; i++) {
      const temp = await iterator.next();

      if (!this._partialCache) {
        // iteration was cancelled; return immediately
        return;
      }

      if (temp.done) {
        completed = true;
        break;
      } else {
        this._finishItem(temp.value);

        this._partialCache[temp.value.index] = temp.value;
        yield temp.value;
      }
    }

    if (completed) {
      this._cache = this._partialCache;
    }

    delete this._partialCache;
  }

  async *_iterate(options) {
    throw new Error(`this function should be overridden`);
  }

  _finishItem(wrappedItem) {
    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      wrappedItem.row[attr] = func(wrappedItem);
    }

    for (const attr of Object.keys(wrappedItem.row)) {
      this._observedAttributes[attr] = true;
    }

    wrappedItem.trigger('finish');
  }

  _wrap(options) {
    options.table = this;
    const classObj = this.classObj;
    return classObj ? classObj._wrap(options) : new this._mure.WRAPPERS.GenericWrapper(options);
  }

  _getAllAttributes() {
    const allAttrs = {};

    for (const attr in this._expectedAttributes) {
      allAttrs[attr] = true;
    }

    for (const attr in this._observedAttributes) {
      allAttrs[attr] = true;
    }

    for (const attr in this._derivedAttributeFunctions) {
      allAttrs[attr] = true;
    }

    return allAttrs;
  }

  get attributes() {
    return Object.keys(this._getAllAttributes());
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

  _deriveTable(options) {
    const newTable = this._mure.createTable(options);

    this._derivedTables[newTable.tableId] = true;

    this._mure.saveTables();

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
    return existingTableId && this._mure.tables[existingTableId] || null;
  }

  shortestPathToTable(otherTable) {
    // Dijkstra's algorithm...
    const visited = {};
    const distances = {};
    const prevTables = {};

    const visit = targetId => {
      const targetTable = this._mure.tables[targetId]; // Only check the unvisited derived and parent tables

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
          chain.unshift(this._mure.tables[nextId]);
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
        type: 'FilteredTable',
        attribute,
        value
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }

  async *openFacet(attribute, limit = Infinity) {
    const values = {};

    for await (const wrappedItem of this.iterate({
      limit
    })) {
      const value = wrappedItem.row[attribute];

      if (!values[value]) {
        values[value] = true;
        const options = {
          type: 'FilteredTable',
          attribute,
          value
        };
        yield this._getExistingTable(options) || this._deriveTable(options);
      }
    }
  }

  connect(otherTableList) {
    const newTable = this._mure.createTable({
      type: 'ConnectedTable'
    });

    this._derivedTables[newTable.tableId] = true;

    for (const otherTable of otherTableList) {
      otherTable._derivedTables[newTable.tableId] = true;
    }

    this._mure.saveTables();

    return newTable;
  }

  get classObj() {
    return Object.values(this._mure.classes).find(classObj => {
      return classObj.table === this;
    });
  }

  get parentTables() {
    return Object.values(this._mure.tables).reduce((agg, tableObj) => {
      if (tableObj._derivedTables[this.tableId]) {
        agg.push(tableObj);
      }

      return agg;
    }, []);
  }

  get derivedTables() {
    return Object.keys(this._derivedTables).map(tableId => {
      return this._mure.tables[tableId];
    });
  }

  delete() {
    if (Object.keys(this._derivedTables).length > 0 || this.classObj) {
      throw new Error(`Can't delete in-use table ${this.tableId}`);
    }

    for (const parentTable of this.parentTables) {
      delete parentTable.derivedTables[this.tableId];
    }

    delete this._mure.tables[this.tableId];

    this._mure.saveTables();
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

  async *_iterate(options) {
    for (let index = 0; index < this._data.length; index++) {
      const item = this._wrap({
        index,
        row: this._data[index]
      });

      this._finishItem(item);

      yield item;
    }
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

  async *_iterate(options) {
    for (const [index, row] of Object.entries(this._data)) {
      const item = this._wrap({
        index,
        row
      });

      this._finishItem(item);

      yield item;
    }
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

    if (options.reduceAttributeFunctions) {
      for (const [attr, stringifiedFunc] of Object.entries(options.reduceAttributeFunctions)) {
        this._reduceAttributeFunctions[attr] = this._mure.hydrateFunction(stringifiedFunc);
      }
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.reduceAttributeFunctions = {};

    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      obj.reduceAttributeFunctions[attr] = this._mure._dehydrateFunction(func);
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

  async *_buildCache(options) {
    // We override _buildCache because so that AggregatedTable can take advantage
    // of the partially-built cache as it goes, and postpone finishing items
    // until after the parent table has been fully iterated
    // TODO: in large data scenarios, we should build the cache / index
    // externally on disk
    this._partialCache = {};

    for await (const wrappedItem of this._iterate(options)) {
      this._partialCache[wrappedItem.index] = wrappedItem; // Go ahead and yield the unfinished item; this makes it possible for
      // client apps to be more responsive and render partial results, but also
      // means that they need to watch for wrappedItem.on('update') events

      yield wrappedItem;
    } // Second pass: now that we've completed the full iteration of the parent
    // table, we can finish each item


    for (const index in this._partialCache) {
      const wrappedItem = this._partialCache[index];

      this._finishItem(wrappedItem);
    }

    this._cache = this._partialCache;
    delete this._partialCache;
  }

  async *_iterate(options) {
    for await (const wrappedParent of this.parentTable.iterate(options)) {
      const index = wrappedParent.row[this._attribute];

      if (!this._partialCache) {
        // We were reset; return immediately
        return;
      } else if (this._partialCache[index]) {
        this._updateItem(this._partialCache[index], wrappedParent);
      } else {
        const newItem = this._wrap({
          index,
          connectedRows: {
            wrappedParent
          }
        }); // Reduce operations still need to be applied to the first item


        this._updateItem(newItem, newItem);

        yield newItem;
      }
    }
  }

  _getAllAttributes() {
    const result = super._getAllAttributes();

    for (const attr in this._reduceAttributeFunctions) {
      result[attr] = true;
    }

    return result;
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

    _duplicateAttributes(wrappedItem, connectedRows) {
      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const parentName = this._mure.tables[parentId].name;
        wrappedItem.row[`${parentName}.${attr}`] = connectedRows[parentId].row[attr];
      }
    }

    _getAllAttributes() {
      const result = super._getAllAttributes();

      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const parentName = this._mure.tables[parentId].name;
        result[`${parentName}.${attr}`] = true;
      }

      return result;
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

  async *_iterate(options) {
    let index = 0;
    const parentTableId = this.parentTable.tableId;

    for await (const wrappedParent of this.parentTable.iterate(options)) {
      const values = (wrappedParent.row[this._attribute] || '').split(this.delimiter);

      for (const value of values) {
        const row = {};
        row[this._attribute] = value;
        const connectedRows = {};
        connectedRows[parentTableId] = wrappedParent;

        const wrappedItem = this._wrap({
          index,
          row,
          connectedRows
        });

        this._duplicateAttributes(wrappedItem, connectedRows);

        this._finishItem(wrappedItem);

        yield wrappedItem;
        index++;
      }
    }
  }

}

class FilteredTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;
    this._value = options.value;

    if (!this._attribute === undefined || !this._value === undefined) {
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
    return `${this.parentTable.name}[${this._value}]`;
  }

  async *_iterate(options) {
    let index = 0;

    for await (const wrappedParent of this.parentTable.iterate(options)) {
      const includeItem = () => {
        const wrappedItem = this._wrap({
          index,
          row: wrappedParent.row,
          connectedRows: {
            wrappedParent
          }
        });

        this._finishItem(wrappedItem);

        index++;
        return wrappedItem;
      };

      if (this._attribute === null) {
        if (wrappedParent.index === this._value) {
          yield includeItem();
        }
      } else {
        if (wrappedParent.row[this._attribute] === this._value) {
          yield includeItem();
        }
      }
    }
  }

}

class ConnectedTable extends DuplicatableAttributesMixin(Table) {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('⨯');
  }

  async *_iterate(options) {
    const parentTables = this.parentTables; // Spin through all of the parentTables so that their _cache is pre-built

    for (const parentTable of parentTables) {
      if (!parentTable._cache) {
        const iterator = parentTable.iterate();
        let temp;

        while (!temp || !temp.done) {
          temp = await iterator.next();
        }
      }
    } // Now that the caches are built, just iterate their keys directly


    for (const parentTable of parentTables) {
      if (!parentTable._cache) {
        // One of the parent tables was reset; return immediately
        return;
      }

      for (const index in parentTable._cache) {
        if (!this._partialCache[index]) {
          const connectedRows = {};

          for (const parentTable2 of parentTables) {
            connectedRows[parentTable2.tableId] = parentTable2._cache[index];
          }

          const wrappedItem = this._wrap({
            index,
            connectedRows
          });

          this._duplicateAttributes(wrappedItem, connectedRows);

          this._finishItem(wrappedItem);

          yield wrappedItem;
        }
      }
    }
  }

}



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDictTable: StaticDictTable,
  AggregatedTable: AggregatedTable,
  ExpandedTable: ExpandedTable,
  FilteredTable: FilteredTable,
  ConnectedTable: ConnectedTable
});

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this._mure = options.mure;
    this.classId = options.classId;
    this.tableId = options.tableId;

    if (!this._mure || !this.classId || !this.tableId) {
      throw new Error(`_mure, classId, and tableId are required`);
    }

    this._className = options.className || null;
    this.annotation = options.annotation || '';
  }

  _toRawObject() {
    return {
      classId: this.classId,
      tableId: this.tableId,
      className: this._className,
      annotation: this.annotation
    };
  }

  setClassName(value) {
    this._className = value;

    this._mure.saveClasses();
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
    return this._mure.tables[this.tableId];
  }

  _wrap(options) {
    return new this._mure.WRAPPERS.GenericWrapper(options);
  }

  interpretAsNodes() {
    const options = this._toRawObject();

    options.type = 'NodeClass';
    return this._mure.newClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    return this._mure.newClass(options);
  }

  _deriveGenericClass(newTable) {
    return this._mure.newClass({
      tableId: newTable.tableId,
      type: 'GenericClass'
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

  async *openFacet(attribute) {
    for await (const newTable of this.table.openFacet(attribute)) {
      yield this._deriveGenericClass(newTable);
    }
  }

  delete() {
    delete this._mure.classes[this.classId];

    this._mure.saveClasses();
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
    this.Wrapper = this._mure.WRAPPERS.NodeWrapper;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.edgeClassIds = this.edgeClassIds;
    return result;
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
      // (or a floating edge if edgeClass.sourceClassId is null)
      const edgeClass = this._mure.classes[edgeClassIds[0]];
      options.sourceClassId = edgeClass.sourceClassId;
      options.targetClassId = edgeClass.sourceClassId;
      options.directed = edgeClass.directed;
      edgeClass.delete();
    } else if (edgeClassIds.length === 2) {
      let sourceEdgeClass = this._mure.classes[edgeClassIds[0]];
      let targetEdgeClass = this._mure.classes[edgeClassIds[1]]; // Figure out the direction, if there is one

      options.directed = false;

      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        if (sourceEdgeClass.targetClassId === this.classId && targetEdgeClass.sourceClassId === this.classId) {
          // We happened to get the edges in order; set directed to true
          options.directed = true;
        } else if (sourceEdgeClass.sourceClassId === this.classId && targetEdgeClass.targetClassId === this.classId) {
          // We got the edges backwards; swap them and set directed to true
          targetEdgeClass = this._mure.classes[edgeClassIds[0]];
          sourceEdgeClass = this._mure.classes[edgeClassIds[1]];
          options.directed = true;
        }
      } // Okay, now we know how to set source / target ids


      options.sourceClassId = sourceEdgeClass.classId;
      options.targetClassId = targetEdgeClass.classId; // Delete each of the edge classes

      sourceEdgeClass.delete();
      targetEdgeClass.delete();
    }

    this.delete();
    delete options.classId;
    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    return this._mure.newClass(options);
  }

  connectToNodeClass({
    otherNodeClass,
    directed,
    attribute,
    otherAttribute
  }) {
    const thisHash = this.getHashTable(attribute);
    const otherHash = otherNodeClass.getHashTable(otherAttribute);
    const connectedTable = thisHash.connect([otherHash]);

    const newEdgeClass = this._mure.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      directed,
      sourceClassId: this.classId,
      targetClassId: otherNodeClass.classId
    });

    this.edgeClassIds[newEdgeClass.classId] = true;
    otherNodeClass.edgeClassIds[newEdgeClass.classId] = true;

    this._mure.saveClasses();

    return newEdgeClass;
  }

  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    return edgeClass.connectToNodeClass(options);
  }

  disconnectAllEdges() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      const edgeClass = this._mure.classes[edgeClassId];

      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSource();
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTarget();
      }
    }
  }

  delete() {
    this.disconnectAllEdges();
    super.delete();
  }

}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this._mure.WRAPPERS.EdgeWrapper;
    this.sourceClassId = options.sourceClassId || null;
    this.targetClassId = options.targetClassId || null;
    this.directed = options.directed || false;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.targetClassId = this.targetClassId;
    result.directed = this.directed;
    return result;
  }

  _pickEdgeTable(otherClass) {
    let edgeTable;
    let chain = this.table.shortestPathToTable(otherClass.table);

    if (chain === null) {
      throw new Error(`Underlying table chain between edge and node classes is broken`);
    } else if (chain.length <= 2) {
      // Weird corner case where we're trying to create an edge between
      // adjacent or identical tables... create a ConnectedTable
      edgeTable = this.table.connect(otherClass.table);
    } else {
      // Use a table in the middle; prioritize StaticTable and StaticDictTable
      let staticExists = false;
      chain = chain.slice(1, chain.length - 1).map((table, dist) => {
        staticExists = staticExists || table.type.startsWith('Static');
        return {
          table,
          dist
        };
      });

      if (staticExists) {
        chain = chain.filter(({
          table
        }) => {
          return table.type.startsWith('Static');
        });
      }

      edgeTable = chain[0].table;
    }

    return edgeTable;
  }

  interpretAsNodes() {
    const temp = this._toRawObject();

    this.delete();
    temp.type = 'NodeClass';
    delete temp.classId;

    const newNodeClass = this._mure.createClass(temp);

    if (temp.sourceClassId) {
      const sourceClass = this._mure.classes[this.sourceClassId];

      const edgeTable = this._pickEdgeTable(sourceClass);

      const sourceEdgeClass = this._mure.createClass({
        type: 'EdgeClass',
        tableId: edgeTable.tableId,
        directed: temp.directed,
        sourceClassId: temp.sourceClassId,
        targetClassId: newNodeClass.classId
      });

      sourceClass.edgeClassIds[sourceEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[sourceEdgeClass.classId] = true;
    }

    if (temp.targetClassId) {
      const targetClass = this._mure.classes[this.targetClassId];

      const edgeTable = this._pickEdgeTable(targetClass);

      const targetEdgeClass = this._mure.createClass({
        type: 'EdgeClass',
        tableId: edgeTable.tableId,
        directed: temp.directed,
        sourceClassId: newNodeClass.classId,
        targetClassId: temp.targetClassId
      });

      targetClass.edgeClassIds[targetEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[targetEdgeClass.classId] = true;
    }

    this._mure.saveClasses();

    return newNodeClass;
  }

  interpretAsEdges() {
    return this;
  }

  connectToNodeClass({
    nodeClass,
    direction,
    nodeAttribute,
    edgeAttribute
  }) {
    if (direction) {
      this.directed = true;
    }

    if (direction !== 'source' && direction !== 'target') {
      direction = this.targetClassId === null ? 'target' : 'source';
    }

    if (direction === 'target') {
      this.connectTarget({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    } else {
      this.connectSource({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    }

    this._mure.saveClasses();
  }

  toggleNodeDirection(sourceClassId) {
    if (!sourceClassId) {
      this.directed = false;
    } else {
      this.directed = true;

      if (sourceClassId !== this.sourceClassId) {
        if (sourceClassId !== this.targetClassId) {
          throw new Error(`Can't swap to unconnected class id: ${sourceClassId}`);
        }

        let temp = this.sourceClassId;
        this.sourceClassId = this.targetClassId;
        this.targetClassId = temp;
      }
    }

    this._mure.saveClasses();
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
    const sourceClass = this._mure.classes[this.sourceClassId];
    sourceClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.getHashTable(nodeAttribute);
    edgeHash.connect([nodeHash]);

    if (!skipSave) {
      this._mure.saveClasses();
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
    const targetClass = this._mure.classes[this.targetClassId];
    targetClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.getHashTable(nodeAttribute);
    edgeHash.connect([nodeHash]);

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  disconnectSource({
    skipSave = false
  } = {}) {
    if (this._mure.classes[this.sourceClassId]) {
      delete this._mure.classes[this.sourceClassId].edgeClassIds[this.classId];
    }

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  disconnectTarget({
    skipSave = false
  } = {}) {
    if (this._mure.classes[this.targetClassId]) {
      delete this._mure.classes[this.targetClassId].edgeClassIds[this.classId];
    }

    if (!skipSave) {
      this._mure.saveClasses();
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

    if (this.index === undefined) {
      throw new Error(`index is required`);
    }

    this.row = options.row || {};
    this.connectedRows = options.connectedRows || {};
  }

}

Object.defineProperty(GenericWrapper, 'type', {
  get() {
    return /(.*)Wrapper/.exec(this.name)[1];
  }

});

class NodeWrapper extends GenericWrapper {}

class EdgeWrapper extends GenericWrapper {}



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

  async *iterEntries() {
    for (const [hash, valueList] of Object.entries(this.entries)) {
      yield {
        hash,
        valueList
      };
    }
  }

  async *iterHashes() {
    for (const hash of Object.keys(this.entries)) {
      yield hash;
    }
  }

  async *iterValueLists() {
    for (const valueList of Object.values(this.entries)) {
      yield valueList;
    }
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

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader$$1, localStorage) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node

    this.localStorage = localStorage; // either window.localStorage or null

    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set mure.debug to true to debug streams
    // extensions that we want datalib to handle

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

    this.tables = this.hydrate('mure_tables', this.TABLES);
    NEXT_TABLE_ID = Object.keys(this.tables).reduce((highestNum, tableId) => {
      return Math.max(highestNum, parseInt(tableId.match(/table(\d*)/)[1]));
    }, 0) + 1; // Object containing our class specifications

    this.classes = this.hydrate('mure_classes', this.CLASSES);
    NEXT_CLASS_ID = Object.keys(this.classes).reduce((highestNum, classId) => {
      return Math.max(highestNum, parseInt(classId.match(/class(\d*)/)[1]));
    }, 0) + 1;
  }

  saveTables() {
    this.dehydrate('mure_tables', this.tables);
    this.trigger('tableUpdate');
  }

  saveClasses() {
    this.dehydrate('mure_classes', this.classes);
    this.trigger('classUpdate');
  }

  hydrate(storageKey, TYPES) {
    let container = this.localStorage && this.localStorage.getItem(storageKey);
    container = container ? JSON.parse(container) : {};

    for (const [key, value] of Object.entries(container)) {
      const type = value.type;
      delete value.type;
      value.mure = this;
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
    options.mure = this;
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
    options.mure = this;
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

}

var name = "mure";
var version = "0.5.4";
var description = "A library for flexible graph reshaping";
var main = "dist/mure.cjs.js";
var module$1 = "dist/mure.esm.js";
var browser = "dist/mure.umd.js";
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
	url: "git+https://github.com/mure-apps/mure-library.git"
};
var author = "Alex Bigelow";
var license = "MIT";
var bugs = {
	url: "https://github.com/mure-apps/mure-library/issues"
};
var homepage = "https://github.com/mure-apps/mure-library#readme";
var devDependencies = {
	"@babel/core": "^7.0.0",
	"@babel/preset-env": "^7.0.0",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.4.2",
	coveralls: "^3.0.2",
	filereader: "^0.10.3",
	jest: "^23.5.0",
	rollup: "^0.65.0",
	"rollup-plugin-babel": "^4.0.2",
	"rollup-plugin-commonjs": "^9.1.6",
	"rollup-plugin-json": "^3.0.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.2.1",
	"rollup-plugin-node-resolve": "^3.3.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.1",
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

let mure = new Mure(FileReader, null);
mure.version = pkg.version;

module.exports = mure;
