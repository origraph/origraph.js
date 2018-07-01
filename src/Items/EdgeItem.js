import TaggableItem from './TaggableItem.js';

class EdgeItem extends TaggableItem {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$nodes) {
      throw new TypeError(`EdgeItem requires a $nodes object`);
    }
  }
  async nodeSelectors (direction = null) {
    return Object.entries(this.value.$nodes)
      .filter(([selector, directions]) => {
        // null indicates that we allow all movement
        return direction === null || directions[direction];
      }).map(([selector, directions]) => selector);
  }
  async nodeItems (forward = null) {
    return this.mure.selectAll((await this.nodeSelectors(forward))).items();
  }
  async nodeItemCount (forward = null) {
    return (await this.nodeSelectors(forward)).length;
  }
}
EdgeItem.oppositeDirection = direction => {
  return direction === 'source' ? 'target'
    : direction === 'target' ? 'source'
      : 'undirected';
};
EdgeItem.getBoilerplateValue = () => {
  return { $tags: {}, $nodes: {} };
};
EdgeItem.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular TaggableItem standardization
  value = TaggableItem.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of a $nodes object
  value.$nodes = value.$nodes || {};
  return value;
};
EdgeItem.glompValue = edgeList => {
  let temp = TaggableItem.glomp(edgeList);
  temp.value.$nodes = {};
  edgeList.forEach(edgeItem => {
    Object.entries(edgeItem.value.$nodes).forEach(([selector, directions]) => {
      temp.$nodes[selector] = temp.value.$nodes[selector] || {};
      Object.keys(directions).forEach(direction => {
        temp.value.$nodes[selector][direction] = temp.value.$nodes[selector][direction] || 0;
        temp.value.$nodes[selector][direction] += directions[direction];
      });
    });
  });
  return temp;
};

export default EdgeItem;
