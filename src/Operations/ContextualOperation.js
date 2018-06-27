import BaseOperation from './BaseOperation.js';

class ContextualOperation extends BaseOperation {
  constructor (mure, subOperations) {
    super(mure);
    this.subOperations = {};
    subOperations.forEach(OperationClass => {
      this.subOperations[OperationClass.name] = new OperationClass(this.mure);
    });
  }
  checkItemInputs (item, inputOptions) {
    return inputOptions.context && this.subOperations[inputOptions.context];
  }
  inferItemInputs (item) {
    const itemInputs = {};
    Object.entries(this.subOperations).map(([subOpName, subOp]) => {
      itemInputs[subOpName] = subOp.inferItemInputs(item);
    });
    return itemInputs;
  }
  async executeOnItem (item, inputOptions) {
    throw new Error('unimplemented');
  }
  async checkSelectionInputs (selection, inputOptions) {
    return inputOptions.context && this.subOperations[inputOptions.context];
  }
  async inferSelectionInputs (selection) {
    const selectionInputs = {};
    const subOpList = Object.entries(this.subOperations);
    for (let i = 0; i < subOpList.length; i++) {
      let [subOpName, subOp] = subOpList[i];
      selectionInputs[subOpName] = await subOp.inferSelectionInputs(selection);
    }
    return selectionInputs;
  }
  async executeOnSelection (selection, inputOptions) {
    if (!(await this.checkSelectionInputs(selection, inputOptions))) {
      throw new Error(`Unknown operation context: ${inputOptions.context}`);
    }
    return this.subOperations[inputOptions.context].executeOnSelection(selection, inputOptions);
  }
}

export default ContextualOperation;
