import GenericWrapper from './GenericWrapper.js';

class NodeWrapper extends GenericWrapper {
  constructor (options) {
    super(options);
    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }
  async * edges (options = {}) {
    let edgeIds = options.classes
      ? options.classes.map(classObj => classObj.classId)
      : options.classIds || Object.keys(this.classObj.edgeClassIds);
    const iterators = [];
    for (const edgeId of edgeIds) {
      if (!this.classObj.edgeClassIds[edgeId]) {
        continue;
      }
      const edgeClass = this.classObj.model.classes[edgeId];
      const role = this.classObj.getEdgeRole(edgeClass);
      if (role === 'both' || role === 'source') {
        const tableIds = edgeClass.sourceTableIds.slice().reverse()
          .concat([edgeClass.tableId]);
        iterators.push(this.iterateAcrossConnections(tableIds));
      }
      if (role === 'both' || role === 'target') {
        const tableIds = edgeClass.targetTableIds.slice().reverse()
          .concat([edgeClass.tableId]);
        iterators.push(this.iterateAcrossConnections(tableIds));
      }
    }
    yield * this.handleLimit(options, iterators);
  }
  async * pairwiseNeighborhood (options) {
    for await (const edge of this.edges()) {
      yield * edge.pairwiseNeighborhood(options);
    }
  }
}

export default NodeWrapper;
