import GenericClass from './GenericClass.js';

class NodeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.NodeWrapper;
    this.edgeIds = options.edgeIds || {};
    Object.entries(this.edgeIds).forEach(([classId, { nodeHash, edgeHash }]) => {
      if (typeof nodeHash === 'string') {
        nodeHash = new Function(nodeHash); // eslint-disable-line no-new-func
      }
      if (typeof edgeHash === 'string') {
        edgeHash = new Function(edgeHash); // eslint-disable-line no-new-func
      }
      this.edgeIds[classId] = { nodeHash, edgeHash };
    });
  }
  async toRawObject () {
    // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
    // prevents `await super`; this is a workaround:
    const result = await GenericClass.prototype.toRawObject.call(this);
    result.edgeIds = {};
    Object.entries(this.edgeIds).forEach(([classId, { nodeHash, edgeHash }]) => {
      nodeHash = nodeHash.toString();
      edgeHash = edgeHash.toString();
      result.edgeIds[classId] = { nodeHash, edgeHash };
    });
    return result;
  }
  async interpretAsNodes () {
    return this;
  }
  async interpretAsEdges () {
    throw new Error(`unimplemented`);
  }
  async connectToNodeClass ({ nodeClass, thisHash, otherHash }) {
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
