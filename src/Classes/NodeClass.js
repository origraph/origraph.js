import GenericClass from './GenericClass.js';

class NodeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.NodeWrapper;
    this.edgeConnections = options.edgeConnections || {};
  }
  toRawObject () {
    const result = super.toRawObject();
    // TODO: need to deep copy edgeConnections?
    result.edgeConnections = this.edgeConnections;
    return result;
  }
  interpretAsNodes () {
    return this;
  }
  interpretAsEdges () {
    throw new Error(`unimplemented`);
  }
  connectToNodeClass ({ otherNodeClass, directed, thisHashName, otherHashName }) {
    const edgeClass = this.mure.newClass({
      selector: null,
      ClassType: this.mure.CLASSES.EdgeClass,
      sourceClassId: this.classId,
      targetClassId: otherNodeClass.classId,
      directed
    });
    this.edgeConnections[edgeClass.classId] = { nodeHashName: thisHashName };
    otherNodeClass.edgeConnections[edgeClass.classId] = { nodeHashName: otherHashName };
    delete this._stream;
    this.mure.saveClasses();
  }
  connectToEdgeClass (options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    edgeClass.connectToNodeClass(options);
  }
  delete () {
    for (const edgeClassId of Object.keys(this.edgeConnections)) {
      const edgeClass = this.mure.classes[edgeClassId];
      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.sourceClassId = null;
      }
      if (edgeClass.targetClassId === this.classId) {
        edgeClass.targetClassId = null;
      }
    }
    super.delete();
  }
}

export default NodeClass;
