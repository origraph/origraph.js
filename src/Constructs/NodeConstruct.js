import TaggableConstruct from './TaggableConstruct.js';
import EdgeConstruct from './EdgeConstruct.js';

class NodeConstruct extends TaggableConstruct {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$edges) {
      throw new TypeError(`NodeConstruct requires an $edges object`);
    }
  }
  connectTo (otherNode, container, direction = 'undirected') {
    let newEdge = container.createNewConstruct({}, undefined, EdgeConstruct);
    newEdge.attachTo(this, direction);
    newEdge.attachTo(otherNode, EdgeConstruct.oppositeDirection(direction));
    return newEdge;
  }
  async edgeSelectors (direction = null) {
    if (direction === null) {
      return Object.keys(this.value.$edges);
    } else {
      return (await this.edgeConstructs(direction)).map(item => item.uniqueSelector);
    }
  }
  async edgeConstructs (direction = null) {
    return (await this.mure.selectAll(Object.keys(this.value.$egdes))).items()
      .filter(item => {
        // null indicates that we allow all edges. If direction isn't null,
        // only include edges where we are the OPPOSITE direction (we are
        // at the beginning of the traversal)
        return direction === null ||
          item.$nodes[this.uniqueSelector][EdgeConstruct.oppositeDirection(direction)];
      });
  }
  async edgeConstructCount (forward = null) {
    return (await this.edgeSelectors(forward)).length;
  }
}
NodeConstruct.getBoilerplateValue = () => {
  return { $tags: {}, $edges: {} };
};
NodeConstruct.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular TaggableConstruct standardization
  value = TaggableConstruct.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of an $edges object
  value.$edges = value.$edges || {};
  return value;
};

export default NodeConstruct;
