import InputSpec from '../Common/InputSpec.js';
import BaseOperation from '../Common/BaseOperation.js';
import ChainTerminatingMixin from '../Common/ChainTerminatingMixin.js';

class DirectedNavigation extends ChainTerminatingMixin(BaseOperation) {
  checkConstructInputs (item, inputOptions) {
    return item instanceof this.mure.CONSTRUCTS.EdgeConstruct ||
      item instanceof this.mure.CONSTRUCTS.NodeConstruct;
  }
  inferConstructInputs (item) {
    if (!this.checkConstructInputs(item)) {
      return null;
    }
    const inputs = new InputSpec();
    inputs.addToggleOption({
      name: 'direction',
      choices: ['Ignore Edge Direction', 'Follow Edge Direction', 'Follow Reversed Direction'],
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

export default DirectedNavigation;
