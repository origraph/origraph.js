import TypedConstruct from './TypedConstruct.js';
import SetConstructMixin from './SetConstructMixin.js';

class SetConstruct extends SetConstructMixin(TypedConstruct) {}
SetConstruct.getBoilerplateValue = () => {
  return { $members: {} };
};
SetConstruct.standardize = ({ value }) => {
  // Ensure the existence of a $members object
  value.$members = value.$members || {};
  return value;
};

export default SetConstruct;
