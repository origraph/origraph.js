import GenericClass from './GenericClass.js';

class EdgeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.Wrapper = this._mure.WRAPPERS.EdgeWrapper;

    this.sourceClassId = options.sourceClassId || null;
    this.targetClassId = options.targetClassId || null;
    this.directed = options.directed || false;
  }
  _toRawObject () {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.targetClassId = this.targetClassId;
    result.directed = this.directed;
    return result;
  }
  _pickEdgeTable (otherClass) {
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
        return { table, dist };
      });
      if (staticExists) {
        chain = chain.filter(({ table }) => {
          return table.type.startsWith('Static');
        });
      }
      edgeTable = chain[0].table;
    }
    return edgeTable;
  }
  interpretAsNodes () {
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
    edgeHash.connect([nodeHash]);

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
    edgeHash.connect([nodeHash]);

    if (!skipSave) { this._mure.saveClasses(); }
  }
  disconnectSource ({ skipSave = false } = {}) {
    if (this._mure.classes[this.sourceClassId]) {
      delete this._mure.classes[this.sourceClassId].edgeClassIds[this.classId];
    }
    if (!skipSave) { this._mure.saveClasses(); }
  }
  disconnectTarget ({ skipSave = false } = {}) {
    if (this._mure.classes[this.targetClassId]) {
      delete this._mure.classes[this.targetClassId].edgeClassIds[this.classId];
    }
    if (!skipSave) { this._mure.saveClasses(); }
  }
  delete () {
    this.disconnectSource({ skipSave: true });
    this.disconnectTarget({ skipSave: true });
    super.delete();
  }
}

export default EdgeClass;
