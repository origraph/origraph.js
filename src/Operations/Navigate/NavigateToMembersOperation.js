import OutputSpec from '../Common/OutputSpec.js';
import BaseOperation from '../Common/BaseOperation.js';
import ChainTerminatingMixin from '../Common/ChainTerminatingMixin.js';
import ParameterlessMixin from '../Common/ParameterlessMixin.js';

class NavigateToMembersOperation extends ParameterlessMixin(ChainTerminatingMixin(BaseOperation)) {
  checkConstructInputs (item) {
    return item instanceof this.mure.CONSTRUCTS.SetConstruct;
  }
  async executeOnConstruct (item) {
    if (!this.checkConstructInputs(item)) {
      throw new Error(`Must be a SetConstruct to NavigateToMembers`);
    }
    return new OutputSpec({
      newSelectors: await item.memberSelectors()
    });
  }
}

export default NavigateToMembersOperation;
