import TypedWrapper from './TypedWrapper.js';
import SetWrapperMixin from './SetWrapperMixin.js';

class SetWrapper extends SetWrapperMixin(TypedWrapper) {}
SetWrapper.getBoilerplateValue = () => {
  return { $members: {} };
};
SetWrapper.standardize = ({ value }) => {
  // Ensure the existence of a $members object
  value.$members = value.$members || {};
  return value;
};

export default SetWrapper;
