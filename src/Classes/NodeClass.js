import GenericClass from './GenericClass.js';

class NodeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.edgeClassIds = options.edgeClassIds || {};
    this.Wrapper = this._mure.WRAPPERS.NodeWrapper;
  }
  _toRawObject () {
    const result = super._toRawObject();
    result.edgeClassIds = this.edgeClassIds;
    return result;
  }
  interpretAsNodes () {
    return this;
  }
  interpretAsEdges () {
    throw new Error(`unimplemented`);
  }
  connectToNodeClass ({ otherNodeClass, directed, attribute, otherAttribute }) {
    const thisHash = this.getHashTable(attribute);
    const otherHash = otherNodeClass.getHashTable(otherAttribute);
    const connectedTable = thisHash.connect([otherHash]);
    return this._mure.newClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceNodeAttr: attribute,
      targetClassId: otherNodeClass.classId,
      targetNodeAttr: otherAttribute
    });
  }
  connectToEdgeClass (options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    return edgeClass.connectToNodeClass(options);
  }
  disconnectAllEdges () {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      const edgeClass = this._mure.classes[edgeClassId];
      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSources();
      }
      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTargets();
      }
    }
  }
  delete () {
    this.disconnectAllEdges();
    super.delete();
  }
}

export default NodeClass;
