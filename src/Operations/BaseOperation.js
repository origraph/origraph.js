import { InputSpec, OutputSpec } from './common.js';

class BaseOperation {
  constructor (mure) {
    this.mure = mure;
    this.terminatesChain = false;
  }
  checkItemInputs (item, inputOptions) {
    return true;
  }
  inferItemInputs (item) {
    if (!this.checkItemInputs(item)) {
      return null;
    } else {
      return new InputSpec();
    }
  }
  async executeOnItem (item, inputOptions) {
    throw new Error('unimplemented');
  }
  async checkSelectionInputs (selection) {
    return true;
  }
  async inferSelectionInputs (selection) {
    const items = await selection.items();
    return InputSpec.glomp(items.map(item => this.inferItemInputs(item)));
  }
  async executeOnSelection (selection, inputOptions) {
    const items = await selection.items();
    return OutputSpec.glomp(await Promise.all(
      items.map(item => this.executeOnItem(item, inputOptions))
    ));
  }
}

export default BaseOperation;
