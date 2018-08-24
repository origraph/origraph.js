import GenericClass from './GenericClass.js';

class NodeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.NodeWrapper;
    this.edgeSelectors = options.edgeSelectors || {};
    Object.entries(this.edgeSelectors).forEach(([selector, { nodeHash, edgeHash }]) => {
      if (typeof nodeHash === 'string') {
        nodeHash = new Function(nodeHash); // eslint-disable-line no-new-func
      }
      if (typeof edgeHash === 'string') {
        edgeHash = new Function(edgeHash); // eslint-disable-line no-new-func
      }
      this.edgeSelectors[selector] = { nodeHash, edgeHash };
    });
  }
  async toRawObject () {
    // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
    // prevents `await super`; this is a workaround:
    const result = await GenericClass.prototype.toRawObject.call(this);
    result.edgeSelectors = {};
    Object.entries(this.edgeSelectors).forEach(([selector, { nodeHash, edgeHash }]) => {
      nodeHash = nodeHash.toString();
      edgeHash = edgeHash.toString();
      result.edgeSelectors[selector] = { nodeHash, edgeHash };
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
