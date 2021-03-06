import GenericClass from './GenericClass.js';
import EdgeWrapper from '../Wrappers/EdgeWrapper.js';

class EdgeClass extends GenericClass {
  constructor (options) {
    super(options);

    // sourceTableIds and targetTableIds are lists of any intermediate tables,
    // beginning with the edge table (but not including it), that lead to the
    // source / target node tables (but not including) those

    this.sourceClassId = options.sourceClassId || null;
    this.sourceTableIds = options.sourceTableIds || [];
    this.targetClassId = options.targetClassId || null;
    this.targetTableIds = options.targetTableIds || [];
    this.directed = options.directed || false;
  }
  get sourceClass () {
    return (this.sourceClassId && this.model.classes[this.sourceClassId]) || null;
  }
  get targetClass () {
    return (this.targetClassId && this.model.classes[this.targetClassId]) || null;
  }
  * connectedClasses () {
    if (this.sourceClassId) {
      yield this.model.classes[this.sourceClassId];
    }
    if (this.targetClassId) {
      yield this.model.classes[this.targetClassId];
    }
  }
  _toRawObject () {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.sourceTableIds = this.sourceTableIds;
    result.targetClassId = this.targetClassId;
    result.targetTableIds = this.targetTableIds;
    result.directed = this.directed;
    return result;
  }
  _wrap (options) {
    options.classObj = this;
    return new EdgeWrapper(options);
  }
  _splitTableIdList (tableIdList, otherClass) {
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
        return { tableId, index, dist: Math.abs(tableIdList / 2 - index) };
      });
      if (staticExists) {
        tableDistances = tableDistances.filter(({ tableId }) => {
          return this.model.tables[tableId].type.startsWith('Static');
        });
      }
      const { tableId, index } = tableDistances.sort((a, b) => a.dist - b.dist)[0];
      result.edgeTableId = tableId;
      result.edgeTableIdList = tableIdList.slice(0, index).reverse();
      result.nodeTableIdList = tableIdList.slice(index + 1);
    }
    return result;
  }
  interpretAsNodes () {
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
  interpretAsEdges () {
    return this;
  }
  interpretAsGeneric () {
    this.disconnectSource();
    this.disconnectTarget();
    return super.interpretAsGeneric();
  }
  connectToNodeClass (options) {
    if (options.side === 'source') {
      this.connectSource(options);
    } else if (options.side === 'target') {
      this.connectTarget(options);
    } else {
      throw new Error(`PoliticalOutsiderError: "${options.side}" is an invalid side`);
    }
  }
  toggleDirection (directed) {
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
  connectSource ({
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
    this.sourceTableIds = [ edgeHash.connect([nodeHash]).tableId ];
    if (edgeAttribute !== null) {
      this.sourceTableIds.unshift(edgeHash.tableId);
    }
    if (nodeAttribute !== null) {
      this.sourceTableIds.push(nodeHash.tableId);
    }
    this.model.trigger('update');
  }
  connectTarget ({
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
    this.targetTableIds = [ edgeHash.connect([nodeHash]).tableId ];
    if (edgeAttribute !== null) {
      this.targetTableIds.unshift(edgeHash.tableId);
    }
    if (nodeAttribute !== null) {
      this.targetTableIds.push(nodeHash.tableId);
    }
    this.model.trigger('update');
  }
  disconnectSource () {
    const existingSourceClass = this.model.classes[this.sourceClassId];
    if (existingSourceClass) {
      delete existingSourceClass.edgeClassIds[this.classId];
    }
    this.sourceTableIds = [];
    this.sourceClassId = null;
    this.model.trigger('update');
  }
  disconnectTarget () {
    const existingTargetClass = this.model.classes[this.targetClassId];
    if (existingTargetClass) {
      delete existingTargetClass.edgeClassIds[this.classId];
    }
    this.targetTableIds = [];
    this.targetClassId = null;
    this.model.trigger('update');
  }
  promote (attribute) {
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
  rollup (attribute) {
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
  connectFacetedClass (newEdgeClass) {
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
  closedFacet (attribute, values) {
    const newClasses = super.closedFacet(attribute, values);
    for (const newClass of newClasses) {
      this.connectFacetedClass(newClass);
    }
    return newClasses;
  }
  async * openFacet (attribute) {
    for await (const newClass of super.openFacet(attribute)) {
      this.connectFacetedClass(newClass);
      yield newClass;
    }
  }
  delete () {
    this.disconnectSource();
    this.disconnectTarget();
    super.delete();
  }
}

export default EdgeClass;
