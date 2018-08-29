import GenericClass from './GenericClass.js';

class NodeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.NodeWrapper;
    this.edgeConnections = options.edgeConnections || {};
  }
  async toRawObject () {
    // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
    // prevents `await super`; this is a workaround:
    const result = await GenericClass.prototype.toRawObject.call(this);
    // TODO: need to deep copy edgeConnections?
    result.edgeConnections = this.edgeConnections;
    return result;
  }
  async interpretAsNodes () {
    return this;
  }
  async interpretAsEdges () {
    throw new Error(`unimplemented`);
  }
  async connectToNodeClass ({ otherNodeClass, directed, thisHashName, otherHashName }) {
    const edgeClass = await this.mure.newClass({
      selector: null,
      ClassType: this.mure.CLASSES.EdgeClass,
      sourceClassId: this.classId,
      targetClassId: otherNodeClass.classId,
      directed
    });
    this.edgeConnections[edgeClass.classId] = { nodeHashName: thisHashName };
    otherNodeClass.edgeConnections[edgeClass.classId] = { nodeHashName: otherHashName };
    delete this._stream;
    await this.mure.saveClasses();
  }
  async connectToEdgeClass (options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    edgeClass.connectToNodeClass(options);
  }
  async delete () {
    for (const edgeClassId of Object.keys(this.edgeConnections)) {
      const edgeClass = this.mure.classes[edgeClassId];
      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.sourceClassId = null;
      }
      if (edgeClass.targetClassId === this.classId) {
        edgeClass.targetClassId = null;
      }
    }
    await super.delete();
  }
}

export default NodeClass;
