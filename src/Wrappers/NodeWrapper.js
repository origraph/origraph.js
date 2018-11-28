import GenericWrapper from './GenericWrapper.js';

class NodeWrapper extends GenericWrapper {
  constructor (options) {
    super(options);
    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }
  async * edges (options = { limit: Infinity }) {
    let edgeIds = options.classes
      ? options.classes.map(classObj => classObj.classId)
      : options.classIds || Object.keys(this.classObj.edgeClassIds);
    let i = 0;
    for (const edgeId of edgeIds) {
      if (!this.classObj.edgeClassIds[edgeId]) {
        continue;
      }
      const edgeClass = this.classObj.model.classes[edgeId];
      const role = this.classObj.getEdgeRole(edgeClass);
      options.tableIds = [];
      if (role === 'both' || role === 'source') {
        options.tableIds = edgeClass.sourceTableIds.slice().reverse()
          .concat([edgeClass.tableId]);
        for await (const item of this.iterateAcrossConnections(options)) {
          yield item;
          i++;
          if (i >= options.limit) {
            return;
          }
        }
      }
      if (role === 'both' || role === 'target') {
        options.tableIds = edgeClass.targetTableIds.slice().reverse()
          .concat([edgeClass.tableId]);
        for await (const item of this.iterateAcrossConnections(options)) {
          yield item;
          i++;
          if (i >= options.limit) {
            return;
          }
        }
      }
    }
  }
  async * pairwiseNeighborhood (options) {
    for await (const edge of this.edges(options)) {
      yield * edge.pairwiseEdges(options);
    }
  }
}

export default NodeWrapper;
