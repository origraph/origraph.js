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
    this.table.reset();
    this.model.trigger('update');
    return newNodeClass;
  }
  * connectedClasses () {
    if (this.sourceClassId) {
      yield this.model.classes[this.sourceClassId];
    }
    if (this.targetClassId) {
      yield this.model.classes[this.targetClassId];
    }
  }
  interpretAsEdges () {
    return this;
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

    const edgeHash = edgeAttribute === null ? this.table : this.table.aggregate(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.table.aggregate(nodeAttribute);
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

    const edgeHash = edgeAttribute === null ? this.table : this.table.aggregate(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.table.aggregate(nodeAttribute);
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
  delete () {
    this.disconnectSource();
    this.disconnectTarget();
    super.delete();
  }
}

export default EdgeClass;
