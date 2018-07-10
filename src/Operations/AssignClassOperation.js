import InputSpec from './Common/InputSpec.js';
import OutputSpec from './Common/OutputSpec.js';
import BaseOperation from './Common/BaseOperation.js';

class AssignClassOperation extends BaseOperation {
  checkConstructInputs (item, inputOptions) {
    return item instanceof this.mure.CONSTRUCTS.TaggableConstruct;
  }
  inferConstructInputs (item) {
    if (!this.checkConstructInputs(item)) {
      return null;
    } else {
      const temp = new InputSpec();
      temp.addValueOption({
        name: 'className',
        defaultValue: 'none',
        suggestions: Object.keys(item.doc.classes || {})
          .filter(c => !this.mure.RESERVED_OBJ_KEYS[c])
      });
      return temp;
    }
  }
  async executeOnConstruct (item, inputOptions) {
    if (!this.checkConstructInputs(item)) {
      throw new Error(`Must be a TaggableConstruct to assign a class`);
    }
    item.addClass(inputOptions.className || 'none');
    return new OutputSpec({
      pollutedDocs: [item.doc]
    });
  }
}

export default AssignClassOperation;
