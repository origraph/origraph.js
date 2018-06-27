import { InputSpec, OutputSpec } from './common.js';
import BaseOperation from './BaseOperation.js';

class AssignClassOperation extends BaseOperation {
  checkItemInputs (item, inputOptions) {
    return item instanceof this.mure.ITEM_TYPES.TaggableItem;
  }
  inferItemInputs (item) {
    if (!this.checkItemInputs(item)) {
      return null;
    } else {
      const temp = new InputSpec();
      temp.addValueOption({
        name: 'className',
        defaultValue: 'none'
      });
      return temp;
    }
  }
  async executeOnItem (item, inputOptions) {
    if (!this.checkItemInputs(item)) {
      throw new Error(`Must be a TaggableItem to assign a class`);
    }
    item.addClass(inputOptions.className || 'none');
    return new OutputSpec();
  }
}

export default AssignClassOperation;
