import OutputSpec from '../Common/OutputSpec.js';
import BaseOperation from '../Common/BaseOperation.js';
import ChainTerminatingMixin from '../Common/ChainTerminatingMixin.js';
import ParameterlessMixin from '../Common/ParameterlessMixin.js';

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
