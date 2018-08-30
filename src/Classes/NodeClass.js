import GenericClass from './GenericClass.js';

class NodeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.NodeWrapper;
    this.edgeConnections = options.edgeConnections || {};
  }
  toRawObject () {
    const result = super.toRawObject();
    result.edgeConnections = this.edgeConnections;
    return result;
  }
  interpretAsNodes () {
    return this;
  }
  interpretAsEdges () {
    throw new Error(`unimplemented`);
    /*
    const edgeIds = Object.keys(this.edgeConnections);
    if (edgeIds.length > 2) {
      this.disconnectAllEdges();
    }
    const options = super.toRawObject();
    options.ClassType = this.mure.CLASSES.EdgeClass;
    const newEdgeClass = this.mure.createClass(options);
    if (edgeIds.length === 1 || edgeIds.length === 2) {
      const sourceEdgeClass = this.mure.classes[edgeIds[0]];
      newEdgeClass.sourceClassId = sourceEdgeClass.sourceClassId;
      newEdgeClass.sourceChain = sourceEdgeClass.
      newEdgeClass.glompSourceEdge(this.mure.classes[edgeIds[0]]);
    }
    if (edgeIds.length === 2) {
      newEdgeClass.glompTargetEdge(this.mure.classes[edgeIds[1]]);
    }
    this.mure.saveClasses();
    */
  }
  connectToNodeClass ({ otherNodeClass, directed, thisHashName, otherHashName }) {
    const newEdge = this.mure.createClass({
      selector: null,
      ClassType: this.mure.CLASSES.EdgeClass,
      sourceClassId: this.classId,
      sourceChain: { nodeHash: thisHashName, edgeHash: null },
      targetClassId: otherNodeClass.classId,
      targetHashName: { nodeHash: otherHashName, edgeHash: null },
      directed
    });
    this.edgeConnections[newEdge.classId] = true;
    otherNodeClass.edgeConnections[newEdge.classId] = true;
    this.mure.saveClasses();
  }
  connectToEdgeClass (options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    edgeClass.connectToNodeClass(options);
  }
  disconnectAllEdges () {
    for (const edgeClassId of Object.keys(this.edgeConnections)) {
      const edgeClass = this.mure.classes[edgeClassId];
      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSources();
      }
      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTargets();
      }
      delete this.edgeConnections[edgeClassId];
    }
  }
  delete () {
    this.disconnectAllEdges();
    super.delete();
  }
}

export default NodeClass;
