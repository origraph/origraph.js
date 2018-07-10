import Introspectable from '../../Common/Introspectable.js';
import InputSpec from './InputSpec.js';
import OutputSpec from './OutputSpec.js';

class BaseOperation extends Introspectable {
  constructor (mure) {
    super();
    this.mure = mure;
    this.terminatesChain = false;
    this.acceptsInputOptions = true;
  }
  checkConstructInputs (item, inputOptions) {
    return true;
  }
  inferConstructInputs (item) {
    if (!this.checkConstructInputs(item)) {
      return null;
    } else {
      return new InputSpec();
    }
  }
  async executeOnConstruct (item, inputOptions) {
    throw new Error('unimplemented');
  }
  async checkSelectionInputs (selection, inputOptions) {
    return true;
  }
  async inferSelectionInputs (selection) {
    const items = await selection.items();
    const inputSpecPromises = Object.values(items).map(item => this.inferConstructInputs(item));
    return InputSpec.glomp(await Promise.all(inputSpecPromises));
  }
  async executeOnSelection (selection, inputOptions) {
    const items = await selection.items();
    const outputSpecPromises = Object.values(items).map(item => this.executeOnConstruct(item, inputOptions));
    return OutputSpec.glomp(await Promise.all(outputSpecPromises));
  }
}
Object.defineProperty(BaseOperation, 'type', {
  get () {
    return /(.*)Operation/.exec(this.name)[1];
  }
});

export default BaseOperation;
