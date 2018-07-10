import TypedConstruct from './TypedConstruct.js';
import SetConstructMixin from './SetConstructMixin.js';

class SetConstruct extends SetConstructMixin(TypedConstruct) {
  memberSelectors () {
    return Object.keys(this.value.$members);
  }
  async memberConstructs () {
    return this.mure.selectAll(this.memberSelectors()).items();
  }
}
SetConstruct.getBoilerplateValue = () => {
  return { $members: {} };
};
SetConstruct.standardize = ({ value }) => {
  // Ensure the existence of a $members object
  value.$members = value.$members || {};
  return value;
};

export default SetConstruct;
