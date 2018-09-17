import GenericClass from './GenericClass.js';

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
    return new this._mure.WRAPPERS.EdgeWrapper(options);
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
        staticExists = staticExists || this._mure.tables[tableId].type.startsWith('Static');
        return { tableId, index, dist: Math.abs(tableIdList / 2 - index) };
      });
      if (staticExists) {
        tableDistances = tableDistances.filter(({ tableId }) => {
          return this._mure.tables[tableId].type.startsWith('Static');
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
    this.delete();
    temp.type = 'NodeClass';
    delete temp.classId;
    const newNodeClass = this._mure.createClass(temp);

    if (temp.sourceClassId) {
      const sourceClass = this._mure.classes[temp.sourceClassId];
      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.sourceTableIds, sourceClass);
      const sourceEdgeClass = this._mure.createClass({
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
      const targetClass = this._mure.classes[temp.targetClassId];
      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.targetTableIds, targetClass);
      const targetEdgeClass = this._mure.createClass({
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
    this._mure.saveClasses();
    return newNodeClass;
  }
  interpretAsEdges () {
    return this;
  }
  connectToNodeClass ({ nodeClass, direction, nodeAttribute, edgeAttribute }) {
    if (direction) {
      this.directed = true;
    }
    if (direction !== 'source' && direction !== 'target') {
      direction = this.targetClassId === null ? 'target' : 'source';
    }
    if (direction === 'target') {
      this.connectTarget({ nodeClass, nodeAttribute, edgeAttribute });
    } else {
      this.connectSource({ nodeClass, nodeAttribute, edgeAttribute });
    }
    this._mure.saveClasses();
  }
  toggleNodeDirection (sourceClassId) {
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
        temp = this.sourceTableIds;
        this.sourceTableIds = this.targetTableIds;
        this.targetTableIds = temp;
      }
    }
    this._mure.saveClasses();
  }
  connectSource ({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null,
    skipSave = false
  } = {}) {
    if (this.sourceClassId) {
      this.disconnectSource({ skipSave: true });
    }
    this.sourceClassId = nodeClass.classId;
    const sourceClass = this._mure.classes[this.sourceClassId];
    sourceClass.edgeClassIds[this.classId] = true;

    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.getHashTable(nodeAttribute);
    this.sourceTableIds = [ edgeHash.connect([nodeHash]).tableId ];
    if (edgeAttribute !== null) {
      this.sourceTableIds.unshift(edgeHash.tableId);
    }
    if (nodeAttribute !== null) {
      this.sourceTableIds.push(nodeHash.tableId);
    }

    if (!skipSave) { this._mure.saveClasses(); }
  }
  connectTarget ({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null,
    skipSave = false
  } = {}) {
    if (this.targetClassId) {
      this.disconnectTarget({ skipSave: true });
    }
    this.targetClassId = nodeClass.classId;
    const targetClass = this._mure.classes[this.targetClassId];
    targetClass.edgeClassIds[this.classId] = true;

    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.getHashTable(nodeAttribute);
    this.targetTableIds = [ edgeHash.connect([nodeHash]).tableId ];
    if (edgeAttribute !== null) {
      this.targetTableIds.unshift(edgeHash.tableId);
    }
    if (nodeAttribute !== null) {
      this.targetTableIds.push(nodeHash.tableId);
    }

    if (!skipSave) { this._mure.saveClasses(); }
  }
  disconnectSource ({ skipSave = false } = {}) {
    const existingSourceClass = this._mure.classes[this.sourceClassId];
    if (existingSourceClass) {
      delete existingSourceClass.edgeClassIds[this.classId];
    }
    this.sourceTableIds = [];
    this.sourceClassId = null;
    if (!skipSave) { this._mure.saveClasses(); }
  }
  disconnectTarget ({ skipSave = false } = {}) {
    const existingTargetClass = this._mure.classes[this.targetClassId];
    if (existingTargetClass) {
      delete existingTargetClass.edgeClassIds[this.classId];
    }
    this.targetTableIds = [];
    this.targetClassId = null;
    if (!skipSave) { this._mure.saveClasses(); }
  }
  delete () {
    this.disconnectSource({ skipSave: true });
    this.disconnectTarget({ skipSave: true });
    super.delete();
  }
}

export default EdgeClass;
