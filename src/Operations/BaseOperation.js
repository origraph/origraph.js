import { InputSpec, OutputSpec } from './common.js';

class BaseOperation {
  constructor (mure) {
    this.mure = mure;
    this.terminatesChain = false;
    this.acceptsInputOptions = true;
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
    const inputSpecPromises = Object.values(items).map(item => this.inferItemInputs(item));
    return InputSpec.glomp(await Promise.all(inputSpecPromises));
  }
  async executeOnSelection (selection, inputOptions) {
    const items = await selection.items();
    const outputSpecPromises = Object.values(items).map(item => this.executeOnItem(item, inputOptions));
    return OutputSpec.glomp(await Promise.all(outputSpecPromises));
  }
}

export default BaseOperation;
