import GenericWrapper from './GenericWrapper.js';
import EdgeWrapper from './EdgeWrapper.js';

class NodeWrapper extends GenericWrapper {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$edges) {
      throw new TypeError(`NodeWrapper requires an $edges object`);
    }
  }
  connectTo (otherNode, container, direction = 'undirected') {
    let newEdge = container.createNewWrapper({}, undefined, EdgeWrapper);
    newEdge.attachTo(this, direction);
    newEdge.attachTo(otherNode, EdgeWrapper.oppositeDirection(direction));
    return newEdge;
  }
  async edgeSelectors (direction = null) {
    if (direction === null) {
      return Object.keys(this.value.$edges);
    } else {
      return (await this.edgeWrappers(direction)).map(item => item.uniqueSelector);
    }
  }
  async edgeWrappers (direction = null) {
    return (await this.mure.selectAll(Object.keys(this.value.$egdes))).items()
      .filter(item => {
        // null indicates that we allow all edges. If direction isn't null,
        // only include edges where we are the OPPOSITE direction (we are
        // at the beginning of the traversal)
        return direction === null ||
          item.$nodes[this.uniqueSelector][EdgeWrapper.oppositeDirection(direction)];
      });
  }
  async edgeWrapperCount (forward = null) {
    return (await this.edgeSelectors(forward)).length;
  }
}
NodeWrapper.getBoilerplateValue = () => {
  return { $tags: {}, $edges: {} };
};
NodeWrapper.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular GenericWrapper standardization
  value = GenericWrapper.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of an $edges object
  value.$edges = value.$edges || {};
  return value;
};

export default NodeWrapper;
