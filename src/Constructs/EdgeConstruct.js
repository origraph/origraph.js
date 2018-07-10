import TaggableConstruct from './TaggableConstruct.js';

class EdgeConstruct extends TaggableConstruct {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$nodes) {
      throw new TypeError(`EdgeConstruct requires a $nodes object`);
    }
  }
  async nodeSelectors (direction = null) {
    return Object.entries(this.value.$nodes)
      .filter(([selector, directions]) => {
        // null indicates that we allow all movement
        return direction === null || directions[direction];
      }).map(([selector, directions]) => selector);
  }
  async nodeConstructs (forward = null) {
    return this.mure.selectAll((await this.nodeSelectors(forward))).items();
  }
  async nodeConstructCount (forward = null) {
    return (await this.nodeSelectors(forward)).length;
  }
}
EdgeConstruct.oppositeDirection = direction => {
  return direction === 'source' ? 'target'
    : direction === 'target' ? 'source'
      : 'undirected';
};
EdgeConstruct.getBoilerplateValue = () => {
  return { $tags: {}, $nodes: {} };
};
EdgeConstruct.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular TaggableConstruct standardization
  value = TaggableConstruct.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of a $nodes object
  value.$nodes = value.$nodes || {};
  return value;
};
EdgeConstruct.glompValue = edgeList => {
  let temp = TaggableConstruct.glomp(edgeList);
  temp.value.$nodes = {};
  edgeList.forEach(edgeConstruct => {
    Object.entries(edgeConstruct.value.$nodes).forEach(([selector, directions]) => {
      temp.$nodes[selector] = temp.value.$nodes[selector] || {};
      Object.keys(directions).forEach(direction => {
        temp.value.$nodes[selector][direction] = temp.value.$nodes[selector][direction] || 0;
        temp.value.$nodes[selector][direction] += directions[direction];
      });
    });
  });
  return temp;
};

export default EdgeConstruct;
