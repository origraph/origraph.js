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

    yield* await this.buildCache(options);
  }

  reset() {
    delete this._partialCache;
    delete this._cache;

    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }

    this.trigger('reset');
  }

  async *buildCache(options) {
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
        type: 'FacetedTable',
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
          type: 'FacetedTable',
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

  async *buildCache(options) {
    // We override buildCache because so that AggregatedTable can take advantage
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

class FacetedTable extends SingleParentMixin(Table) {
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
  FacetedTable: FacetedTable,
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

    if (temp.targetClassId && temp.sourceClassId !== temp.targetClassId) {
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
  constructor(FileReader, localStorage) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node

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
var version = "0.5.5";
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

let mure = new Mure(window.FileReader, window.localStorage);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TaW5nbGVQYXJlbnRNaXhpbi5qcyIsIi4uL3NyYy9UYWJsZXMvQWdncmVnYXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0V4cGFuZGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0ZpbHRlcmVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0Nvbm5lY3RlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0luZGV4ZXMvSW5NZW1vcnlJbmRleC5qcyIsIi4uL3NyYy9NdXJlLmpzIiwiLi4vc3JjL21vZHVsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcblxuY2xhc3MgVGFibGUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMuX211cmUgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtdXJlIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzID0gb3B0aW9ucy5kZXJpdmVkVGFibGVzIHx8IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGlmIChvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIHVzZWRCeUNsYXNzZXM6IHRoaXMuX3VzZWRCeUNsYXNzZXMsXG4gICAgICBkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zOiB7fVxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBHZW5lcmljIGNhY2hpbmcgc3R1ZmY7IHRoaXMgaXNuJ3QganVzdCBmb3IgcGVyZm9ybWFuY2UuIENvbm5lY3RlZFRhYmxlJ3NcbiAgICAvLyBhbGdvcml0aG0gcmVxdWlyZXMgdGhhdCBpdHMgcGFyZW50IHRhYmxlcyBoYXZlIHByZS1idWlsdCBpbmRleGVzICh3ZVxuICAgIC8vIHRlY2huaWNhbGx5IGNvdWxkIGltcGxlbWVudCBpdCBkaWZmZXJlbnRseSwgYnV0IGl0IHdvdWxkIGJlIGV4cGVuc2l2ZSxcbiAgICAvLyByZXF1aXJlcyB0cmlja3kgbG9naWMsIGFuZCB3ZSdyZSBhbHJlYWR5IGJ1aWxkaW5nIGluZGV4ZXMgZm9yIHNvbWUgdGFibGVzXG4gICAgLy8gbGlrZSBBZ2dyZWdhdGVkVGFibGUgYW55d2F5KVxuICAgIGlmIChvcHRpb25zLnJlc2V0KSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgZm9yIChjb25zdCBmaW5pc2hlZEl0ZW0gb2YgT2JqZWN0LnZhbHVlcyh0aGlzLl9jYWNoZSkpIHtcbiAgICAgICAgeWllbGQgZmluaXNoZWRJdGVtO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHlpZWxkICogYXdhaXQgdGhpcy5fYnVpbGRDYWNoZShvcHRpb25zKTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGU7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpO1xuICAgIGxldCBjb21wbGV0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBpdGVyYXRpb24gd2FzIGNhbmNlbGxlZDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgY29tcGxldGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHRlbXAudmFsdWUpO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGVtcC52YWx1ZS5pbmRleF0gPSB0ZW1wLnZhbHVlO1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgT2JqZWN0LmtleXMod3JhcHBlZEl0ZW0ucm93KSkge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgcmV0dXJuIGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBfZ2V0QWxsQXR0cmlidXRlcyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG4gIGdldCBhdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZ2V0QWxsQXR0cmlidXRlcygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMuX211cmUuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlVGFibGVzKCk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZUlkID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlSWQgJiYgdGhpcy5fbXVyZS50YWJsZXNbZXhpc3RpbmdUYWJsZUlkXSkgfHwgbnVsbDtcbiAgfVxuICBzaG9ydGVzdFBhdGhUb1RhYmxlIChvdGhlclRhYmxlKSB7XG4gICAgLy8gRGlqa3N0cmEncyBhbGdvcml0aG0uLi5cbiAgICBjb25zdCB2aXNpdGVkID0ge307XG4gICAgY29uc3QgZGlzdGFuY2VzID0ge307XG4gICAgY29uc3QgcHJldlRhYmxlcyA9IHt9O1xuICAgIGNvbnN0IHZpc2l0ID0gdGFyZ2V0SWQgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0VGFibGUgPSB0aGlzLl9tdXJlLnRhYmxlc1t0YXJnZXRJZF07XG4gICAgICAvLyBPbmx5IGNoZWNrIHRoZSB1bnZpc2l0ZWQgZGVyaXZlZCBhbmQgcGFyZW50IHRhYmxlc1xuICAgICAgY29uc3QgbmVpZ2hib3JMaXN0ID0gT2JqZWN0LmtleXModGFyZ2V0VGFibGUuX2Rlcml2ZWRUYWJsZXMpXG4gICAgICAgIC5jb25jYXQodGFyZ2V0VGFibGUucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS50YWJsZUlkKSlcbiAgICAgICAgLmZpbHRlcih0YWJsZUlkID0+ICF2aXNpdGVkW3RhYmxlSWRdKTtcbiAgICAgIC8vIENoZWNrIGFuZCBhc3NpZ24gKG9yIHVwZGF0ZSkgdGVudGF0aXZlIGRpc3RhbmNlcyB0byBlYWNoIG5laWdoYm9yXG4gICAgICBmb3IgKGNvbnN0IG5laWdoYm9ySWQgb2YgbmVpZ2hib3JMaXN0KSB7XG4gICAgICAgIGlmIChkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9IEluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIGlmIChkaXN0YW5jZXNbdGFyZ2V0SWRdICsgMSA8IGRpc3RhbmNlc1tuZWlnaGJvcklkXSkge1xuICAgICAgICAgIGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9IGRpc3RhbmNlc1t0YXJnZXRJZF0gKyAxO1xuICAgICAgICAgIHByZXZUYWJsZXNbbmVpZ2hib3JJZF0gPSB0YXJnZXRJZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgdGhpcyB0YWJsZSBpcyBvZmZpY2lhbGx5IHZpc2l0ZWQ7IHRha2UgaXQgb3V0IG9mIHRoZSBydW5uaW5nXG4gICAgICAvLyBmb3IgZnV0dXJlIHZpc2l0cyAvIGNoZWNrc1xuICAgICAgdmlzaXRlZFt0YXJnZXRJZF0gPSB0cnVlO1xuICAgICAgZGVsZXRlIGRpc3RhbmNlc1t0YXJnZXRJZF07XG4gICAgfTtcblxuICAgIC8vIFN0YXJ0IHdpdGggdGhpcyB0YWJsZVxuICAgIHByZXZUYWJsZXNbdGhpcy50YWJsZUlkXSA9IG51bGw7XG4gICAgZGlzdGFuY2VzW3RoaXMudGFibGVJZF0gPSAwO1xuICAgIGxldCB0b1Zpc2l0ID0gT2JqZWN0LmtleXMoZGlzdGFuY2VzKTtcbiAgICB3aGlsZSAodG9WaXNpdC5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBWaXNpdCB0aGUgbmV4dCB0YWJsZSB0aGF0IGhhcyB0aGUgc2hvcnRlc3QgZGlzdGFuY2VcbiAgICAgIHRvVmlzaXQuc29ydCgoYSwgYikgPT4gZGlzdGFuY2VzW2FdIC0gZGlzdGFuY2VzW2JdKTtcbiAgICAgIGxldCBuZXh0SWQgPSB0b1Zpc2l0LnNoaWZ0KCk7XG4gICAgICBpZiAobmV4dElkID09PSBvdGhlclRhYmxlLnRhYmxlSWQpIHtcbiAgICAgICAgLy8gRm91bmQgb3RoZXJUYWJsZSEgU2VuZCBiYWNrIHRoZSBjaGFpbiBvZiBjb25uZWN0ZWQgdGFibGVzXG4gICAgICAgIGNvbnN0IGNoYWluID0gW107XG4gICAgICAgIHdoaWxlIChwcmV2VGFibGVzW25leHRJZF0gIT09IG51bGwpIHtcbiAgICAgICAgICBjaGFpbi51bnNoaWZ0KHRoaXMuX211cmUudGFibGVzW25leHRJZF0pO1xuICAgICAgICAgIG5leHRJZCA9IHByZXZUYWJsZXNbbmV4dElkXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2hhaW47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBWaXNpdCB0aGUgdGFibGVcbiAgICAgICAgdmlzaXQobmV4dElkKTtcbiAgICAgICAgdG9WaXNpdCA9IE9iamVjdC5rZXlzKGRpc3RhbmNlcyk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFdlIGRpZG4ndCBmaW5kIGl0OyB0aGVyZSdzIG5vIGNvbm5lY3Rpb25cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnQWdncmVnYXRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnRXhwYW5kZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBkZWxpbWl0ZXJcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGaWx0ZXJlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGaWx0ZXJlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMuX211cmUuY3JlYXRlVGFibGUoeyB0eXBlOiAnQ29ubmVjdGVkVGFibGUnIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5fbXVyZS50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fbXVyZS50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCB8fCB0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBpbi11c2UgdGFibGUgJHt0aGlzLnRhYmxlSWR9YCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9tdXJlLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICB0aGlzLl9maW5pc2hJdGVtKGl0ZW0pO1xuICAgICAgeWllbGQgaXRlbTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICB0aGlzLl9maW5pc2hJdGVtKGl0ZW0pO1xuICAgICAgeWllbGQgaXRlbTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY0RpY3RUYWJsZTtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWllcmQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgQWdncmVnYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBpZiAob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuX2RlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpic7XG4gIH1cbiAgZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSAoYXR0ciwgZnVuYykge1xuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIF91cGRhdGVJdGVtIChvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyhvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0udHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucykge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugc28gdGhhdCBBZ2dyZWdhdGVkVGFibGUgY2FuIHRha2UgYWR2YW50YWdlXG4gICAgLy8gb2YgdGhlIHBhcnRpYWxseS1idWlsdCBjYWNoZSBhcyBpdCBnb2VzLCBhbmQgcG9zdHBvbmUgZmluaXNoaW5nIGl0ZW1zXG4gICAgLy8gdW50aWwgYWZ0ZXIgdGhlIHBhcmVudCB0YWJsZSBoYXMgYmVlbiBmdWxseSBpdGVyYXRlZFxuXG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5faXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3dyYXBwZWRJdGVtLmluZGV4XSA9IHdyYXBwZWRJdGVtO1xuICAgICAgLy8gR28gYWhlYWQgYW5kIHlpZWxkIHRoZSB1bmZpbmlzaGVkIGl0ZW07IHRoaXMgbWFrZXMgaXQgcG9zc2libGUgZm9yXG4gICAgICAvLyBjbGllbnQgYXBwcyB0byBiZSBtb3JlIHJlc3BvbnNpdmUgYW5kIHJlbmRlciBwYXJ0aWFsIHJlc3VsdHMsIGJ1dCBhbHNvXG4gICAgICAvLyBtZWFucyB0aGF0IHRoZXkgbmVlZCB0byB3YXRjaCBmb3Igd3JhcHBlZEl0ZW0ub24oJ3VwZGF0ZScpIGV2ZW50c1xuICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgfVxuXG4gICAgLy8gU2Vjb25kIHBhc3M6IG5vdyB0aGF0IHdlJ3ZlIGNvbXBsZXRlZCB0aGUgZnVsbCBpdGVyYXRpb24gb2YgdGhlIHBhcmVudFxuICAgIC8vIHRhYmxlLCB3ZSBjYW4gZmluaXNoIGVhY2ggaXRlbVxuICAgIGZvciAoY29uc3QgaW5kZXggaW4gdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICB0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMucGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgaW5kZXggPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlW2luZGV4XSkge1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGNvbm5lY3RlZFJvd3M6IHsgd3JhcHBlZFBhcmVudCB9XG4gICAgICAgIH0pO1xuICAgICAgICAvLyBSZWR1Y2Ugb3BlcmF0aW9ucyBzdGlsbCBuZWVkIHRvIGJlIGFwcGxpZWQgdG8gdGhlIGZpcnN0IGl0ZW1cbiAgICAgICAgdGhpcy5fdXBkYXRlSXRlbShuZXdJdGVtLCBuZXdJdGVtKTtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgX2dldEFsbEF0dHJpYnV0ZXMgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl9nZXRBbGxBdHRyaWJ1dGVzKCk7XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgcmVzdWx0W2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQWdncmVnYXRlZFRhYmxlO1xuIiwiY29uc3QgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuZHVwbGljYXRlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgfVxuICAgIF90b1Jhd09iamVjdCAoKSB7XG4gICAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICAgIG9iai5kdXBsaWNhdGVkQXR0cmlidXRlcyA9IHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgZHVwbGljYXRlQXR0cmlidXRlIChwYXJlbnRJZCwgYXR0cmlidXRlKSB7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gPSB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gfHwgW107XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0ucHVzaChhdHRyaWJ1dGUpO1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBfZHVwbGljYXRlQXR0cmlidXRlcyAod3JhcHBlZEl0ZW0sIGNvbm5lY3RlZFJvd3MpIHtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgcGFyZW50TmFtZSA9IHRoaXMuX211cmUudGFibGVzW3BhcmVudElkXS5uYW1lO1xuICAgICAgICB3cmFwcGVkSXRlbS5yb3dbYCR7cGFyZW50TmFtZX0uJHthdHRyfWBdID0gY29ubmVjdGVkUm93c1twYXJlbnRJZF0ucm93W2F0dHJdO1xuICAgICAgfVxuICAgIH1cbiAgICBfZ2V0QWxsQXR0cmlidXRlcyAoKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fZ2V0QWxsQXR0cmlidXRlcygpO1xuICAgICAgZm9yIChjb25zdCBbcGFyZW50SWQsIGF0dHJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICBjb25zdCBwYXJlbnROYW1lID0gdGhpcy5fbXVyZS50YWJsZXNbcGFyZW50SWRdLm5hbWU7XG4gICAgICAgIHJlc3VsdFtgJHtwYXJlbnROYW1lfS4ke2F0dHJ9YF0gPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgRXhwYW5kZWRUYWJsZSBleHRlbmRzIER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbihTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLmRlbGltaXRlciA9IG9wdGlvbnMuZGVsaW1pdGVyIHx8ICcsJztcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqQnO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlSWQgPSB0aGlzLnBhcmVudFRhYmxlLnRhYmxlSWQ7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMucGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgdmFsdWVzID0gKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gfHwgJycpLnNwbGl0KHRoaXMuZGVsaW1pdGVyKTtcbiAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdmFsdWVzKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IHt9O1xuICAgICAgICByb3dbdGhpcy5fYXR0cmlidXRlXSA9IHZhbHVlO1xuICAgICAgICBjb25zdCBjb25uZWN0ZWRSb3dzID0ge307XG4gICAgICAgIGNvbm5lY3RlZFJvd3NbcGFyZW50VGFibGVJZF0gPSB3cmFwcGVkUGFyZW50O1xuICAgICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93LCBjb25uZWN0ZWRSb3dzIH0pO1xuICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKHdyYXBwZWRJdGVtLCBjb25uZWN0ZWRSb3dzKTtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmlsdGVyZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlID09PSB1bmRlZmluZWQgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBgJHt0aGlzLnBhcmVudFRhYmxlLm5hbWV9WyR7dGhpcy5fdmFsdWV9XWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMucGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgaW5jbHVkZUl0ZW0gPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiB3cmFwcGVkUGFyZW50LnJvdyxcbiAgICAgICAgICBjb25uZWN0ZWRSb3dzOiB7IHdyYXBwZWRQYXJlbnQgfVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgICAgIGluZGV4Kys7XG4gICAgICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgICAgIH07XG4gICAgICBpZiAodGhpcy5fYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICAgIGlmICh3cmFwcGVkUGFyZW50LmluZGV4ID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAgIHlpZWxkIGluY2x1ZGVJdGVtKCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAgIHlpZWxkIGluY2x1ZGVJdGVtKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZpbHRlcmVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIFNwaW4gdGhyb3VnaCBhbGwgb2YgdGhlIHBhcmVudFRhYmxlcyBzbyB0aGF0IHRoZWlyIF9jYWNoZSBpcyBwcmUtYnVpbHRcbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgaWYgKCFwYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgICAgY29uc3QgaXRlcmF0b3IgPSBwYXJlbnRUYWJsZS5pdGVyYXRlKCk7XG4gICAgICAgIGxldCB0ZW1wO1xuICAgICAgICB3aGlsZSAoIXRlbXAgfHwgIXRlbXAuZG9uZSkge1xuICAgICAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiBwYXJlbnRUYWJsZXMpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGluZGV4IGluIHBhcmVudFRhYmxlLl9jYWNoZSkge1xuICAgICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0pIHtcbiAgICAgICAgICBjb25zdCBjb25uZWN0ZWRSb3dzID0ge307XG4gICAgICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZTIgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICAgICAgICBjb25uZWN0ZWRSb3dzW3BhcmVudFRhYmxlMi50YWJsZUlkXSA9IHBhcmVudFRhYmxlMi5fY2FjaGVbaW5kZXhdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgY29ubmVjdGVkUm93cyB9KTtcbiAgICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKHdyYXBwZWRJdGVtLCBjb25uZWN0ZWRSb3dzKTtcbiAgICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fbXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5fbXVyZSB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgX211cmUsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9uID0gb3B0aW9ucy5hbm5vdGF0aW9uIHx8ICcnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGNsYXNzTmFtZTogdGhpcy5fY2xhc3NOYW1lLFxuICAgICAgYW5ub3RhdGlvbjogdGhpcy5hbm5vdGF0aW9uXG4gICAgfTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lICE9PSBudWxsO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHwgdGhpcy50YWJsZS5uYW1lO1xuICB9XG4gIGdldEhhc2hUYWJsZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIGF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpO1xuICB9XG4gIGdldCB0YWJsZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RoaXMudGFibGVJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgX2Rlcml2ZUdlbmVyaWNDbGFzcyAobmV3VGFibGUpIHtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyh7XG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcydcbiAgICB9KTtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3ModGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKSk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3ModGhpcy50YWJsZS5leHBhbmQoYXR0cmlidXRlLCBkZWxpbWl0ZXIpKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkcyA9IG9wdGlvbnMuZWRnZUNsYXNzSWRzIHx8IHt9O1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMuX211cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXI7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuZWRnZUNsYXNzSWRzID0gdGhpcy5lZGdlQ2xhc3NJZHM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICAvLyAob3IgYSBmbG9hdGluZyBlZGdlIGlmIGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkIGlzIG51bGwpXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZWRnZUNsYXNzLmRpcmVjdGVkO1xuICAgICAgZWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgbGV0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIG5vdyB3ZSBrbm93IGhvdyB0byBzZXQgc291cmNlIC8gdGFyZ2V0IGlkc1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSB0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIC8vIERlbGV0ZSBlYWNoIG9mIHRoZSBlZGdlIGNsYXNzZXNcbiAgICAgIHNvdXJjZUVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICAgIHRhcmdldEVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICB9XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICBkZWxldGUgb3B0aW9ucy5jbGFzc0lkO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGRpcmVjdGVkLCBhdHRyaWJ1dGUsIG90aGVyQXR0cmlidXRlIH0pIHtcbiAgICBjb25zdCB0aGlzSGFzaCA9IHRoaXMuZ2V0SGFzaFRhYmxlKGF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MuZ2V0SGFzaFRhYmxlKG90aGVyQXR0cmlidXRlKTtcbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMuX211cmUuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgZGlyZWN0ZWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMuX211cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG5cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF9waWNrRWRnZVRhYmxlIChvdGhlckNsYXNzKSB7XG4gICAgbGV0IGVkZ2VUYWJsZTtcbiAgICBsZXQgY2hhaW4gPSB0aGlzLnRhYmxlLnNob3J0ZXN0UGF0aFRvVGFibGUob3RoZXJDbGFzcy50YWJsZSk7XG4gICAgaWYgKGNoYWluID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZGVybHlpbmcgdGFibGUgY2hhaW4gYmV0d2VlbiBlZGdlIGFuZCBub2RlIGNsYXNzZXMgaXMgYnJva2VuYCk7XG4gICAgfSBlbHNlIGlmIChjaGFpbi5sZW5ndGggPD0gMikge1xuICAgICAgLy8gV2VpcmQgY29ybmVyIGNhc2Ugd2hlcmUgd2UncmUgdHJ5aW5nIHRvIGNyZWF0ZSBhbiBlZGdlIGJldHdlZW5cbiAgICAgIC8vIGFkamFjZW50IG9yIGlkZW50aWNhbCB0YWJsZXMuLi4gY3JlYXRlIGEgQ29ubmVjdGVkVGFibGVcbiAgICAgIGVkZ2VUYWJsZSA9IHRoaXMudGFibGUuY29ubmVjdChvdGhlckNsYXNzLnRhYmxlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIGEgdGFibGUgaW4gdGhlIG1pZGRsZTsgcHJpb3JpdGl6ZSBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBjaGFpbiA9IGNoYWluLnNsaWNlKDEsIGNoYWluLmxlbmd0aCAtIDEpLm1hcCgodGFibGUsIGRpc3QpID0+IHtcbiAgICAgICAgc3RhdGljRXhpc3RzID0gc3RhdGljRXhpc3RzIHx8IHRhYmxlLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIHJldHVybiB7IHRhYmxlLCBkaXN0IH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgY2hhaW4gPSBjaGFpbi5maWx0ZXIoKHsgdGFibGUgfSkgPT4ge1xuICAgICAgICAgIHJldHVybiB0YWJsZS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVkZ2VUYWJsZSA9IGNoYWluWzBdLnRhYmxlO1xuICAgIH1cbiAgICByZXR1cm4gZWRnZVRhYmxlO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGVsZXRlKCk7XG4gICAgdGVtcC50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgZGVsZXRlIHRlbXAuY2xhc3NJZDtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IGVkZ2VUYWJsZSA9IHRoaXMuX3BpY2tFZGdlVGFibGUoc291cmNlQ2xhc3MpO1xuICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGUudGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IHRlbXAuc291cmNlQ2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWRcbiAgICAgIH0pO1xuICAgICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0ZW1wLnRhcmdldENsYXNzSWQgJiYgdGVtcC5zb3VyY2VDbGFzc0lkICE9PSB0ZW1wLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgICBjb25zdCBlZGdlVGFibGUgPSB0aGlzLl9waWNrRWRnZVRhYmxlKHRhcmdldENsYXNzKTtcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlLnRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogdGVtcC50YXJnZXRDbGFzc0lkXG4gICAgICB9KTtcbiAgICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIGRpcmVjdGlvbiwgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KSB7XG4gICAgaWYgKGRpcmVjdGlvbikge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmIChkaXJlY3Rpb24gIT09ICdzb3VyY2UnICYmIGRpcmVjdGlvbiAhPT0gJ3RhcmdldCcpIHtcbiAgICAgIGRpcmVjdGlvbiA9IHRoaXMudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCA/ICd0YXJnZXQnIDogJ3NvdXJjZSc7XG4gICAgfVxuICAgIGlmIChkaXJlY3Rpb24gPT09ICd0YXJnZXQnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RUYXJnZXQoeyBub2RlQ2xhc3MsIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZSh7IG5vZGVDbGFzcywgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KTtcbiAgICB9XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIHRvZ2dsZU5vZGVEaXJlY3Rpb24gKHNvdXJjZUNsYXNzSWQpIHtcbiAgICBpZiAoIXNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICBpZiAoc291cmNlQ2xhc3NJZCAhPT0gdGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IHN3YXAgdG8gdW5jb25uZWN0ZWQgY2xhc3MgaWQ6ICR7c291cmNlQ2xhc3NJZH1gKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgdGVtcCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSB0ZW1wO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbCxcbiAgICBza2lwU2F2ZSA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLmdldEhhc2hUYWJsZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyBzb3VyY2VDbGFzcy50YWJsZSA6IHNvdXJjZUNsYXNzLmdldEhhc2hUYWJsZShub2RlQXR0cmlidXRlKTtcbiAgICBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pO1xuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNraXBTYXZlID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMuZ2V0SGFzaFRhYmxlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRhcmdldENsYXNzLnRhYmxlIDogdGFyZ2V0Q2xhc3MuZ2V0SGFzaFRhYmxlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSk7XG5cbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKHsgc2tpcFNhdmUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHtcbiAgICAgIGRlbGV0ZSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdKSB7XG4gICAgICBkZWxldGUgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRSb3dzID0gb3B0aW9ucy5jb25uZWN0ZWRSb3dzIHx8IHt9O1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiY2xhc3MgSW5NZW1vcnlJbmRleCB7XG4gIGNvbnN0cnVjdG9yICh7IGVudHJpZXMgPSB7fSwgY29tcGxldGUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICB0aGlzLmVudHJpZXMgPSBlbnRyaWVzO1xuICAgIHRoaXMuY29tcGxldGUgPSBjb21wbGV0ZTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcztcbiAgfVxuICBhc3luYyAqIGl0ZXJFbnRyaWVzICgpIHtcbiAgICBmb3IgKGNvbnN0IFtoYXNoLCB2YWx1ZUxpc3RdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHsgaGFzaCwgdmFsdWVMaXN0IH07XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlckhhc2hlcyAoKSB7XG4gICAgZm9yIChjb25zdCBoYXNoIG9mIE9iamVjdC5rZXlzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIGhhc2g7XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlclZhbHVlTGlzdHMgKCkge1xuICAgIGZvciAoY29uc3QgdmFsdWVMaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgdmFsdWVMaXN0O1xuICAgIH1cbiAgfVxuICBhc3luYyBnZXRWYWx1ZUxpc3QgKGhhc2gpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzW2hhc2hdIHx8IFtdO1xuICB9XG4gIGFzeW5jIGFkZFZhbHVlIChoYXNoLCB2YWx1ZSkge1xuICAgIC8vIFRPRE86IGFkZCBzb21lIGtpbmQgb2Ygd2FybmluZyBpZiB0aGlzIGlzIGdldHRpbmcgYmlnP1xuICAgIHRoaXMuZW50cmllc1toYXNoXSA9IGF3YWl0IHRoaXMuZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgIGlmICh0aGlzLmVudHJpZXNbaGFzaF0uaW5kZXhPZih2YWx1ZSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbk1lbW9yeUluZGV4O1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgKiBhcyBUQUJMRVMgZnJvbSAnLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuaW1wb3J0ICogYXMgV1JBUFBFUlMgZnJvbSAnLi9XcmFwcGVycy9XcmFwcGVycy5qcyc7XG5pbXBvcnQgKiBhcyBJTkRFWEVTIGZyb20gJy4vSW5kZXhlcy9JbmRleGVzLmpzJztcblxubGV0IE5FWFRfQ0xBU1NfSUQgPSAxO1xubGV0IE5FWFRfVEFCTEVfSUQgPSAxO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoRmlsZVJlYWRlciwgbG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBlaXRoZXIgd2luZG93LmxvY2FsU3RvcmFnZSBvciBudWxsXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG4gICAgdGhpcy5EQVRBTElCX0ZPUk1BVFMgPSB7XG4gICAgICAnanNvbic6ICdqc29uJyxcbiAgICAgICdjc3YnOiAnY3N2JyxcbiAgICAgICd0c3YnOiAndHN2JyxcbiAgICAgICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICAgICAndHJlZWpzb24nOiAndHJlZWpzb24nXG4gICAgfTtcblxuICAgIC8vIEFjY2VzcyB0byBjb3JlIGNsYXNzZXMgdmlhIHRoZSBtYWluIGxpYnJhcnkgaGVscHMgYXZvaWQgY2lyY3VsYXIgaW1wb3J0c1xuICAgIHRoaXMuVEFCTEVTID0gVEFCTEVTO1xuICAgIHRoaXMuQ0xBU1NFUyA9IENMQVNTRVM7XG4gICAgdGhpcy5XUkFQUEVSUyA9IFdSQVBQRVJTO1xuICAgIHRoaXMuSU5ERVhFUyA9IElOREVYRVM7XG5cbiAgICAvLyBEZWZhdWx0IG5hbWVkIGZ1bmN0aW9uc1xuICAgIHRoaXMuTkFNRURfRlVOQ1RJT05TID0ge1xuICAgICAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7IHlpZWxkIHdyYXBwZWRJdGVtLnJhd0l0ZW07IH0sXG4gICAgICBrZXk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7XG4gICAgICAgIGlmICghd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEdyYW5kcGFyZW50IGlzIG5vdCBhbiBvYmplY3QgLyBhcnJheWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICBpZiAoIShwYXJlbnRUeXBlID09PSAnbnVtYmVyJyB8fCBwYXJlbnRUeXBlID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXJlbnQgaXNuJ3QgYSBrZXkgLyBpbmRleGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRGaW5pc2g6IGZ1bmN0aW9uICogKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkge1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgbGVmdDogdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0sXG4gICAgICAgICAgcmlnaHQ6IG90aGVyV3JhcHBlZEl0ZW0ucmF3SXRlbVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHNoYTE6IHJhd0l0ZW0gPT4gc2hhMShKU09OLnN0cmluZ2lmeShyYXdJdGVtKSksXG4gICAgICBub29wOiAoKSA9PiB7fVxuICAgIH07XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnRhYmxlcyA9IHRoaXMuaHlkcmF0ZSgnbXVyZV90YWJsZXMnLCB0aGlzLlRBQkxFUyk7XG4gICAgTkVYVF9UQUJMRV9JRCA9IE9iamVjdC5rZXlzKHRoaXMudGFibGVzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgdGFibGVJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQodGFibGVJZC5tYXRjaCgvdGFibGUoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgb3VyIGNsYXNzIHNwZWNpZmljYXRpb25zXG4gICAgdGhpcy5jbGFzc2VzID0gdGhpcy5oeWRyYXRlKCdtdXJlX2NsYXNzZXMnLCB0aGlzLkNMQVNTRVMpO1xuICAgIE5FWFRfQ0xBU1NfSUQgPSBPYmplY3Qua2V5cyh0aGlzLmNsYXNzZXMpXG4gICAgICAucmVkdWNlKChoaWdoZXN0TnVtLCBjbGFzc0lkKSA9PiB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heChoaWdoZXN0TnVtLCBwYXJzZUludChjbGFzc0lkLm1hdGNoKC9jbGFzcyhcXGQqKS8pWzFdKSk7XG4gICAgICB9LCAwKSArIDE7XG4gIH1cblxuICBzYXZlVGFibGVzICgpIHtcbiAgICB0aGlzLmRlaHlkcmF0ZSgnbXVyZV90YWJsZXMnLCB0aGlzLnRhYmxlcyk7XG4gICAgdGhpcy50cmlnZ2VyKCd0YWJsZVVwZGF0ZScpO1xuICB9XG4gIHNhdmVDbGFzc2VzICgpIHtcbiAgICB0aGlzLmRlaHlkcmF0ZSgnbXVyZV9jbGFzc2VzJywgdGhpcy5jbGFzc2VzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NsYXNzVXBkYXRlJyk7XG4gIH1cblxuICBoeWRyYXRlIChzdG9yYWdlS2V5LCBUWVBFUykge1xuICAgIGxldCBjb250YWluZXIgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKHN0b3JhZ2VLZXkpO1xuICAgIGNvbnRhaW5lciA9IGNvbnRhaW5lciA/IEpTT04ucGFyc2UoY29udGFpbmVyKSA6IHt9O1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvbnRhaW5lcikpIHtcbiAgICAgIGNvbnN0IHR5cGUgPSB2YWx1ZS50eXBlO1xuICAgICAgZGVsZXRlIHZhbHVlLnR5cGU7XG4gICAgICB2YWx1ZS5tdXJlID0gdGhpcztcbiAgICAgIGNvbnRhaW5lcltrZXldID0gbmV3IFRZUEVTW3R5cGVdKHZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbnRhaW5lcjtcbiAgfVxuICBkZWh5ZHJhdGUgKHN0b3JhZ2VLZXksIGNvbnRhaW5lcikge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0ge307XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb250YWluZXIpKSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICAgIHJlc3VsdFtrZXldLnR5cGUgPSB2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShzdG9yYWdlS2V5LCBKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcbiAgICB9XG4gIH1cbiAgaHlkcmF0ZUZ1bmN0aW9uIChzdHJpbmdpZmllZEZ1bmMpIHtcbiAgICBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cblxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy50YWJsZUlkKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke05FWFRfVEFCTEVfSUR9YDtcbiAgICAgIE5FWFRfVEFCTEVfSUQgKz0gMTtcbiAgICB9XG4gICAgY29uc3QgVHlwZSA9IHRoaXMuVEFCTEVTW29wdGlvbnMudHlwZV07XG4gICAgZGVsZXRlIG9wdGlvbnMudHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIGlmICghb3B0aW9ucy5jbGFzc0lkKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke05FWFRfQ0xBU1NfSUR9YDtcbiAgICAgIE5FWFRfQ0xBU1NfSUQgKz0gMTtcbiAgICB9XG4gICAgY29uc3QgVHlwZSA9IHRoaXMuQ0xBU1NFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIG5ld1RhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGVPYmogPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZU9iajtcbiAgfVxuICBuZXdDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld0NsYXNzT2JqID0gdGhpcy5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0NsYXNzT2JqO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljVGFibGUgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY1RhYmxlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24gPSAndHh0JywgdGV4dCB9KSB7XG4gICAgbGV0IGRhdGEsIGF0dHJpYnV0ZXM7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5uZXdUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5uZXdDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBkZWxldGVBbGxVbnVzZWRUYWJsZXMgKCkge1xuICAgIGZvciAoY29uc3QgdGFibGVJZCBpbiB0aGlzLnRhYmxlcykge1xuICAgICAgaWYgKHRoaXMudGFibGVzW3RhYmxlSWRdKSB7XG4gICAgICAgIHRyeSB7IHRoaXMudGFibGVzW3RhYmxlSWRdLmRlbGV0ZSgpOyB9IGNhdGNoIChlcnIpIHt9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGRlbGV0ZUFsbENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc09iai5kZWxldGUoKTtcbiAgICB9XG4gIH1cbiAgZ2V0Q2xhc3NEYXRhICgpIHtcbiAgICBjb25zdCByZXN1bHRzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIHJlc3VsdHNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5jdXJyZW50RGF0YTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXVyZTtcbiIsImltcG9ydCBNdXJlIGZyb20gJy4vTXVyZS5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUod2luZG93LkZpbGVSZWFkZXIsIHdpbmRvdy5sb2NhbFN0b3JhZ2UpO1xubXVyZS52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycyIsImluZGV4T2YiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImZvckVhY2giLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJPYmplY3QiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwiY29uZmlndXJhYmxlIiwiZ2V0IiwidGVtcCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIlRhYmxlIiwib3B0aW9ucyIsIl9tdXJlIiwibXVyZSIsInRhYmxlSWQiLCJFcnJvciIsIl9leHBlY3RlZEF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVzIiwiX29ic2VydmVkQXR0cmlidXRlcyIsIl9kZXJpdmVkVGFibGVzIiwiZGVyaXZlZFRhYmxlcyIsIl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImF0dHIiLCJzdHJpbmdpZmllZEZ1bmMiLCJlbnRyaWVzIiwiaHlkcmF0ZUZ1bmN0aW9uIiwiX3RvUmF3T2JqZWN0IiwicmVzdWx0IiwiX2F0dHJpYnV0ZXMiLCJ1c2VkQnlDbGFzc2VzIiwiX3VzZWRCeUNsYXNzZXMiLCJmdW5jIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJuYW1lIiwiaXRlcmF0ZSIsInJlc2V0IiwiX2NhY2hlIiwiZmluaXNoZWRJdGVtIiwidmFsdWVzIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlIiwiZGVyaXZlZFRhYmxlIiwibGltaXQiLCJ1bmRlZmluZWQiLCJJbmZpbml0eSIsIml0ZXJhdG9yIiwiX2l0ZXJhdGUiLCJjb21wbGV0ZWQiLCJuZXh0IiwiZG9uZSIsIl9maW5pc2hJdGVtIiwid3JhcHBlZEl0ZW0iLCJyb3ciLCJrZXlzIiwiX3dyYXAiLCJ0YWJsZSIsImNsYXNzT2JqIiwiV1JBUFBFUlMiLCJHZW5lcmljV3JhcHBlciIsIl9nZXRBbGxBdHRyaWJ1dGVzIiwiYWxsQXR0cnMiLCJjdXJyZW50RGF0YSIsImRhdGEiLCJjb21wbGV0ZSIsImRlcml2ZUF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsIl9kZXJpdmVUYWJsZSIsIm5ld1RhYmxlIiwiY3JlYXRlVGFibGUiLCJzYXZlVGFibGVzIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlSWQiLCJmaW5kIiwidGFibGVPYmoiLCJldmVyeSIsIm9wdGlvbk5hbWUiLCJvcHRpb25WYWx1ZSIsInRhYmxlcyIsInNob3J0ZXN0UGF0aFRvVGFibGUiLCJvdGhlclRhYmxlIiwidmlzaXRlZCIsImRpc3RhbmNlcyIsInByZXZUYWJsZXMiLCJ2aXNpdCIsInRhcmdldElkIiwidGFyZ2V0VGFibGUiLCJuZWlnaGJvckxpc3QiLCJjb25jYXQiLCJwYXJlbnRUYWJsZXMiLCJtYXAiLCJwYXJlbnRUYWJsZSIsImZpbHRlciIsIm5laWdoYm9ySWQiLCJ0b1Zpc2l0IiwibGVuZ3RoIiwic29ydCIsImEiLCJiIiwibmV4dElkIiwic2hpZnQiLCJjaGFpbiIsInVuc2hpZnQiLCJhZ2dyZWdhdGUiLCJleHBhbmQiLCJkZWxpbWl0ZXIiLCJjbG9zZWRGYWNldCIsIm9wZW5GYWNldCIsImNvbm5lY3QiLCJvdGhlclRhYmxlTGlzdCIsImNsYXNzZXMiLCJyZWR1Y2UiLCJhZ2ciLCJkZWxldGUiLCJleGVjIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiaXRlbSIsIlN0YXRpY0RpY3RUYWJsZSIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIkFnZ3JlZ2F0ZWRUYWJsZSIsIl9hdHRyaWJ1dGUiLCJfcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIiwicmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIiwiX2RlaHlkcmF0ZUZ1bmN0aW9uIiwiZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSIsIl91cGRhdGVJdGVtIiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsIm5ld1dyYXBwZWRJdGVtIiwid3JhcHBlZFBhcmVudCIsIm5ld0l0ZW0iLCJjb25uZWN0ZWRSb3dzIiwiRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIiwiX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfZHVwbGljYXRlZEF0dHJpYnV0ZXMiLCJkdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZUF0dHJpYnV0ZSIsInBhcmVudElkIiwiX2R1cGxpY2F0ZUF0dHJpYnV0ZXMiLCJwYXJlbnROYW1lIiwiRXhwYW5kZWRUYWJsZSIsInBhcmVudFRhYmxlSWQiLCJzcGxpdCIsIkZpbHRlcmVkVGFibGUiLCJfdmFsdWUiLCJpbmNsdWRlSXRlbSIsIkNvbm5lY3RlZFRhYmxlIiwiam9pbiIsInBhcmVudFRhYmxlMiIsIkdlbmVyaWNDbGFzcyIsImNsYXNzSWQiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbiIsInNldENsYXNzTmFtZSIsInNhdmVDbGFzc2VzIiwiaGFzQ3VzdG9tTmFtZSIsImdldEhhc2hUYWJsZSIsImludGVycHJldEFzTm9kZXMiLCJuZXdDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJfZGVyaXZlR2VuZXJpY0NsYXNzIiwiTm9kZUNsYXNzIiwiZWRnZUNsYXNzSWRzIiwiV3JhcHBlciIsIk5vZGVXcmFwcGVyIiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiZWRnZUNsYXNzIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsInRhcmdldEVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY3JlYXRlQ2xhc3MiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJub2RlQ2xhc3MiLCJlZGdlQ2xhc3NJZCIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0IiwiRWRnZUNsYXNzIiwiRWRnZVdyYXBwZXIiLCJfcGlja0VkZ2VUYWJsZSIsIm90aGVyQ2xhc3MiLCJlZGdlVGFibGUiLCJzdGF0aWNFeGlzdHMiLCJzbGljZSIsImRpc3QiLCJzdGFydHNXaXRoIiwibmV3Tm9kZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsImRpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiY29ubmVjdFRhcmdldCIsImNvbm5lY3RTb3VyY2UiLCJ0b2dnbGVOb2RlRGlyZWN0aW9uIiwic2tpcFNhdmUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwiSW5NZW1vcnlJbmRleCIsInRvUmF3T2JqZWN0IiwiaXRlckVudHJpZXMiLCJoYXNoIiwidmFsdWVMaXN0IiwiaXRlckhhc2hlcyIsIml0ZXJWYWx1ZUxpc3RzIiwiZ2V0VmFsdWVMaXN0IiwiYWRkVmFsdWUiLCJORVhUX0NMQVNTX0lEIiwiTkVYVF9UQUJMRV9JRCIsIk11cmUiLCJGaWxlUmVhZGVyIiwibG9jYWxTdG9yYWdlIiwibWltZSIsImRlYnVnIiwiREFUQUxJQl9GT1JNQVRTIiwiVEFCTEVTIiwiQ0xBU1NFUyIsIklOREVYRVMiLCJOQU1FRF9GVU5DVElPTlMiLCJpZGVudGl0eSIsInJhd0l0ZW0iLCJrZXkiLCJUeXBlRXJyb3IiLCJwYXJlbnRUeXBlIiwiZGVmYXVsdEZpbmlzaCIsInRoaXNXcmFwcGVkSXRlbSIsIm90aGVyV3JhcHBlZEl0ZW0iLCJsZWZ0IiwicmlnaHQiLCJzaGExIiwiSlNPTiIsInN0cmluZ2lmeSIsIm5vb3AiLCJoeWRyYXRlIiwiaGlnaGVzdE51bSIsIk1hdGgiLCJtYXgiLCJwYXJzZUludCIsIm1hdGNoIiwiZGVoeWRyYXRlIiwic3RvcmFnZUtleSIsIlRZUEVTIiwiY29udGFpbmVyIiwiZ2V0SXRlbSIsInBhcnNlIiwic2V0SXRlbSIsIkZ1bmN0aW9uIiwidG9TdHJpbmciLCJUeXBlIiwic2VsZWN0b3IiLCJuZXdUYWJsZU9iaiIsIm5ld0NsYXNzT2JqIiwiYWRkRmlsZUFzU3RhdGljVGFibGUiLCJmaWxlT2JqIiwiZW5jb2RpbmciLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsImNvbnNvbGUiLCJ3YXJuIiwidGV4dCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicmVhZGVyIiwib25sb2FkIiwicmVhZEFzVGV4dCIsImFkZFN0cmluZ0FzU3RhdGljVGFibGUiLCJleHRlbnNpb24iLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNUYWJsZSIsIkFycmF5IiwiZGVsZXRlQWxsVW51c2VkVGFibGVzIiwiZXJyIiwiZGVsZXRlQWxsQ2xhc3NlcyIsImdldENsYXNzRGF0YSIsInJlc3VsdHMiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLEdBQUk7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGFBQUwsR0FBcUIsRUFBckI7V0FDS0MsY0FBTCxHQUFzQixFQUF0Qjs7O0lBRUZDLEVBQUUsQ0FBRUMsU0FBRixFQUFhQyxRQUFiLEVBQXVCQyx1QkFBdkIsRUFBZ0Q7VUFDNUMs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
