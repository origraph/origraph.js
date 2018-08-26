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
  async connectToNodeClass ({ nodeClass, thisHashName, otherHashName }) {
    throw new Error(`unimplemented`);
  }
  async connectToEdgeClass (options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    edgeClass.connectToNodeClass(options);
  }
}

export default NodeClass;
