import SetConstruct from './SetConstruct.js';
import NodeConstruct from './NodeConstruct.js';
import SetConstructMixin from './SetConstructMixin.js';

class SupernodeConstruct extends SetConstructMixin(NodeConstruct) {}
SupernodeConstruct.getBoilerplateValue = () => {
  return { $tags: {}, $members: {}, $edges: {} };
};
SupernodeConstruct.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular NodeConstruct standardization
  value = NodeConstruct.standardize({ mure, value, path, doc, aggressive });
  // ... and the SetConstruct standardization
  value = SetConstruct.standardize({ value });
  return value;
};

export default SupernodeConstruct;
