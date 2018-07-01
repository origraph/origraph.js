import OutputSpec from '../Common/OutputSpec.js';
import BaseOperation from '../BaseOperation.js';
import ChainTerminatingMixin from '../ChainTerminatingMixin.js';
import ParameterlessMixin from '../ParameterlessMixin.js';

class PivotToMembers extends ParameterlessMixin(ChainTerminatingMixin(BaseOperation)) {
  checkItemInputs (item) {
    return item instanceof this.mure.ITEM_TYPES.SetItem;
  }
  async executeOnItem (item) {
    if (!this.checkItemInputs(item)) {
      throw new Error(`Must be a SetItem to PivotToMembers`);
    }
    return new OutputSpec({
      newSelectors: await item.memberSelectors()
    });
  }
}

export default PivotToMembers;
