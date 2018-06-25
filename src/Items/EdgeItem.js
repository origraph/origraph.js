import TaggableItem from './TaggableItem.js';

class EdgeItem extends TaggableItem {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$nodes) {
      throw new TypeError(`EdgeItem requires a $nodes object`);
    }
  }
  async nodeSelectors (forward = null) {
    return Object.entries(this.value.$nodes)
      .filter(([selector, direction]) => {
        return forward === null || // Not limited by direction; grab all nodes
          // Forward traversal: grab all nodes that we point to
          (forward === true && direction === 'target') ||
          // Backward traversal: grab all nodes that we point from
          (forward === false && direction === 'source');
      }).map(([selector, direction]) => selector);
  }
  async nodeItems (forward = null) {
    return this.mure.selectAll((await this.nodeSelectors(forward))).items();
  }
  async nodeItemCount (forward = null) {
    return (await this.nodeSelectors(forward)).length;
  }
}
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

export default EdgeItem;
