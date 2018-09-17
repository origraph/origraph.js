import GenericWrapper from './GenericWrapper.js';

class NodeWrapper extends GenericWrapper {
  constructor (options) {
    super(options);
    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }
  async * edges (options = { limit: Infinity }) {
    const edgeIds = options.edgeIds || this.classObj.edgeClassIds;
    let i = 0;
    for (const edgeId of Object.keys(edgeIds)) {
      const edgeClass = this.classObj._mure.classes[edgeId];
      if (edgeClass.sourceClassId === this.classObj.classId) {
        options.tableIds = edgeClass.sourceTableIds.slice().reverse()
          .concat([edgeClass.tableId]);
      } else {
        options.tableIds = edgeClass.targetTableIds.slice().reverse()
          .concat([edgeClass.tableId]);
      }
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

export default NodeWrapper;
