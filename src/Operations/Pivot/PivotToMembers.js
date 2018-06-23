import { OutputSpec } from '../common.js';
import BaseOperation from '../BaseOperation.js';
import ChainTerminatingMixin from '../ChainTerminatingMixin.js';

class PivotToMembers extends ChainTerminatingMixin(BaseOperation) {
  checkItemInputs (item, inputOptions) {
    return item instanceof this.mure.ITEM_TYPES.SetItem;
  }
  async executeOnItem (item, inputOptions) {
    if (!this.checkItemInputs(item, inputOptions)) {
      throw new Error(`Must be a SetItem to PivotToMembers`);
    }
    return new OutputSpec({
      newSelectors: await item.memberSelectors()
    });
  }
}

export default PivotToMembers;
