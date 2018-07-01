import TaggableItem from './TaggableItem.js';
import EdgeItem from './EdgeItem.js';

class NodeItem extends TaggableItem {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$edges) {
      throw new TypeError(`NodeItem requires an $edges object`);
    }
  }
  linkTo (otherNode, container, direction = 'undirected') {
    let newEdge = container.createNewItem({}, undefined, EdgeItem);

    const helper = (node, direction) => {
      node.value.$edges[newEdge.uniqueSelector] = true;
      let nodeId = node.uniqueSelector;
      newEdge.value.$nodes[nodeId] = newEdge.value.$nodes[nodeId] || {};
      newEdge.value.$nodes[nodeId][direction] = newEdge.value.$nodes[nodeId][direction] || 0;
      newEdge.value.$nodes[nodeId][direction] += 1;
    };

    helper(this, direction);
    helper(otherNode, EdgeItem.oppositeDirection(direction));
    return newEdge;
  }
  async edgeSelectors (direction = null) {
    if (direction === null) {
      return Object.keys(this.value.$edges);
    } else {
      return (await this.edgeItems(direction)).map(item => item.uniqueSelector);
    }
  }
  async edgeItems (direction = null) {
    return (await this.mure.selectAll(Object.keys(this.value.$egdes))).items()
      .filter(item => {
        // null indicates that we allow all edges. If direction isn't null,
        // only include edges where we are the OPPOSITE direction (we are
        // at the beginning of the traversal)
        return direction === null ||
          item.$nodes[this.uniqueSelector][EdgeItem.oppositeDirection(direction)];
      });
  }
  async edgeItemCount (forward = null) {
    return (await this.edgeSelectors(forward)).length;
  }
}
NodeItem.getBoilerplateValue = () => {
  return { $tags: {}, $edges: {} };
};
NodeItem.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular TaggableItem standardization
  value = TaggableItem.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of an $edges object
  value.$edges = value.$edges || {};
  return value;
};

export default NodeItem;
