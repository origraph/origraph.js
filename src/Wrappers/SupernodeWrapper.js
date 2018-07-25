import SetWrapper from './SetWrapper.js';
import NodeWrapper from './NodeWrapper.js';
import SetWrapperMixin from './SetWrapperMixin.js';

class SupernodeWrapper extends SetWrapperMixin(NodeWrapper) {}
SupernodeWrapper.getBoilerplateValue = () => {
  return { $tags: {}, $members: {}, $edges: {} };
};
SupernodeWrapper.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular NodeWrapper standardization
  value = NodeWrapper.standardize({ mure, value, path, doc, aggressive });
  // ... and the SetWrapper standardization
  value = SetWrapper.standardize({ value });
  return value;
};

export default SupernodeWrapper;
