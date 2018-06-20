import { InputSpec, OutputSpec } from './common.js';

class BaseOperation {
  constructor (mure) {
    this.mure = mure;
  }
  inferItemInputs (item) {
    throw new Error('unimplemented');
  }
  async inferSelectionInputs (selection) {
    const items = await selection.items();
    return InputSpec.glomp(items.map(item => this.inferItemInputs(item)));
  }
  executeOnItem (item, inputOptions) {
    throw new Error('unimplemented');
  }
  async executeOnSelection (selection, inputOptions) {
    const items = await selection.items();
    return OutputSpec.glomp(items.map(item => this.executeOnItem(item, inputOptions)));
  }
}

export default BaseOperation;
