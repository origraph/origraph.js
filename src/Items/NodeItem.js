import TaggableItem from './TaggableItem.js';
import EdgeItem from './EdgeItem.js';

class NodeItem extends TaggableItem {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$edges) {
      throw new TypeError(`NodeItem requires an $edges object`);
    }
  }
  linkTo (otherNode, container, directed) {
    let newEdge = container.createNewItem({}, undefined, EdgeItem);

    if (this.doc === container.doc) {
      newEdge.value.$nodes[this.value._id] = directed ? 'source' : true;
      this.value.$edges[newEdge.value._id] = true;
    } else {
      newEdge.value.$nodes[this.uniqueSelector] = directed ? 'source' : true;
      this.value.$edges[this.mure.idToUniqueSelector(newEdge.value._id, container.doc._id)] = true;
    }

    if (otherNode.doc === container.doc) {
      newEdge.value.$nodes[otherNode.value._id] = directed ? 'target' : true;
      otherNode.value.$edges[newEdge.value._id] = true;
    } else {
      newEdge.value.$nodes[otherNode.uniqueSelector] = directed ? 'target' : true;
      otherNode.value.$edges[this.mure.idToUniqueSelector(newEdge.value._id, container.doc._id)] = true;
    }
    return newEdge;
  }
  async edgeSelectors (forward = null) {
    if (forward === null) {
      return Object.keys(this.value.$edges);
    } else {
      return (await this.edgeItems(forward)).map(item => item.uniqueSelector);
    }
  }
  async edgeItems (forward = null) {
    return (await this.mure.selectAll(Object.keys(this.value.$egdes))).items()
      .filter(item => {
        return forward === null || // Not limited by direction; grab all edges
          // Forward traversal: only grab the edges where we are a source node
          (forward === true && item.$nodes[this.uniqueSelector] === 'source') ||
          // Backward traversal: only grab edges where we are a target node
          (forward === false && item.$nodes[this.uniqueSelector] === 'target');
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
