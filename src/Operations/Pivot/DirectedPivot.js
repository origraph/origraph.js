import { InputSpec } from '../common.js';
import BaseOperation from '../BaseOperation.js';
import ChainTerminatingMixin from '../ChainTerminatingMixin.js';

class DirectedPivot extends ChainTerminatingMixin(BaseOperation) {
  checkItemInputs (item, inputOptions) {
    return item instanceof this.mure.ITEM_TYPES.EdgeItem ||
      item instanceof this.mure.ITEM_TYPES.NodeItem;
  }
  inferItemInputs (item) {
    if (!this.checkItemInputs(item)) {
      return null;
    }
    const inputs = new InputSpec();
    inputs.addOption({
      name: 'direction',
      options: ['Ignore Edge Direction', 'Follow Edge Direction', 'Follow Reversed Direction'],
      defaultValue: 'Ignore Edge Direction'
    });
    return inputs;
  }
  getForward (inputOptions) {
    if (!inputOptions.direction) {
      return null;
    } else if (inputOptions.direction === 'Follow Edge Direction') {
      return true;
    } else if (inputOptions.direction === 'Follow Reversed Direction') {
      return false;
    } else { // if (inputOptions.direction === 'Ignore Edge Direction')
      return null;
    }
  }
  async executeOnSelection (selection, inputOptions) {
    this._forward = this.getForward(inputOptions);
    const temp = await super.executeOnSelection(selection, inputOptions);
    delete this._forward;
    return temp;
  }
}

export default DirectedPivot;
