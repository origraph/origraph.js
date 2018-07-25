import GenericWrapper from './GenericWrapper.js';

class EdgeWrapper extends GenericWrapper {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$nodes) {
      throw new TypeError(`EdgeWrapper requires a $nodes object`);
    }
  }
  attachTo (node, direction = 'undirected') {
    node.value.$edges[this.uniqueSelector] = true;
    let nodeId = node.uniqueSelector;
    this.value.$nodes[nodeId] = this.value.$nodes[nodeId] || {};
    this.value.$nodes[nodeId][direction] = this.value.$nodes[nodeId][direction] || 0;
    this.value.$nodes[nodeId][direction] += 1;
  }
  async nodeSelectors (direction = null) {
    return Object.entries(this.value.$nodes)
      .filter(([selector, directions]) => {
        // null indicates that we allow all movement
        return direction === null || directions[direction];
      }).map(([selector, directions]) => selector);
  }
  async nodeWrappers (forward = null) {
    return this.mure.selectAll((await this.nodeSelectors(forward))).items();
  }
  async nodeWrapperCount (forward = null) {
    return (await this.nodeSelectors(forward)).length;
  }
}
EdgeWrapper.oppositeDirection = direction => {
  return direction === 'source' ? 'target'
    : direction === 'target' ? 'source'
      : 'undirected';
};
EdgeWrapper.getBoilerplateValue = () => {
  return { $tags: {}, $nodes: {} };
};
EdgeWrapper.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular GenericWrapper standardization
  value = GenericWrapper.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of a $nodes object
  value.$nodes = value.$nodes || {};
  return value;
};
EdgeWrapper.glompValue = edgeList => {
  let temp = GenericWrapper.glomp(edgeList);
  temp.value.$nodes = {};
  edgeList.forEach(edgeWrapper => {
    Object.entries(edgeWrapper.value.$nodes).forEach(([selector, directions]) => {
      temp.$nodes[selector] = temp.value.$nodes[selector] || {};
      Object.keys(directions).forEach(direction => {
        temp.value.$nodes[selector][direction] = temp.value.$nodes[selector][direction] || 0;
        temp.value.$nodes[selector][direction] += directions[direction];
      });
    });
  });
  return temp;
};

export default EdgeWrapper;
