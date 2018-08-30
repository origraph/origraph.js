class Chain {
  constructor ({ nodeHash = null, edgeHash = null, intermediates = [] } = {}) {
    this.nodeHash = nodeHash;
    this.edgeHash = edgeHash;
    this.intermediates = intermediates;
  }
  toRawObject () {
    return {
      nodeHash: this.nodeHash,
      edgeHash: this.edgeHash,
      intermediates: this.intermediates
    };
  }
  split () {
    throw new Error(`unimplemented`);
    // return [ edgewardChain, nodewardChain ]
  }
}
export default Chain;
