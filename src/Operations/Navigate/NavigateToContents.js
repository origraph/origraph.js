import OutputSpec from '../Common/OutputSpec.js';
import BaseOperation from '../Common/BaseOperation.js';
import ChainTerminatingMixin from '../Common/ChainTerminatingMixin.js';
import ParameterlessMixin from '../Common/ParameterlessMixin.js';

class NavigateToContents extends ParameterlessMixin(ChainTerminatingMixin(BaseOperation)) {
  checkConstructInputs (item) {
    return item instanceof this.mure.CONSTRUCTS.ItemConstruct ||
      item instanceof this.mure.CONSTRUCTS.DocumentConstruct;
  }
  async executeOnConstruct (item) {
    if (!this.checkConstructInputs(item)) {
      throw new Error(`Must be a ItemConstruct or a DocumentConstruct to \
NavigateToContents`);
    }
    return new OutputSpec({
      newSelectors: (await item.contentConstructs())
        .map(childConstruct => childConstruct.uniqueSelector)
    });
  }
}

export default NavigateToContents;
