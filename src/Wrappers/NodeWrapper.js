import GenericWrapper from './GenericWrapper.js';

class NodeWrapper extends GenericWrapper {
  constructor (options) {
    super(options);
    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }
  async * edges ({ limit = Infinity, edgeIds = this.classObj.edgeClassIds } = {}) {
    let i = 0;
    for (const edgeClassId of Object.keys(edgeIds)) {
      const tableIdChain = await this.classObj.prepShortestEdgePath(edgeClassId);
      const iterator = this.iterateAcrossConnections(tableIdChain);
      let temp = iterator.next();
      while (!temp.done && i < limit) {
        yield temp.value;
        i++;
        temp = iterator.next();
      }
      if (i >= limit) {
        return;
      }
    }
  }
}

export default NodeWrapper;
