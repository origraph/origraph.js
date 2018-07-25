import BaseOperation from './Common/BaseOperation.js';
import OutputSpec from './Common/OutputSpec.js';
import ContextualOption from './Common/ContextualOption.js';
import AttributeOption from './Common/AttributeOption.js';
import ClassOption from './Common/ClassOption.js';

class AssignClassOperation extends BaseOperation {
  getInputSpec () {
    const result = super.getInputSpec();
    const context = new ContextualOption({
      parameterName: 'context',
      choices: ['String', 'Attribute'],
      defaultValue: 'String'
    });
    result.addOption(context);
    context.specs['String'].addOption(new ClassOption({
      parameterName: 'className',
      openEnded: true
    }));
    context.specs['Attribute'].addOption(new AttributeOption({
      parameterName: 'attribute'
    }));

    return result;
  }
  potentiallyExecutableOnItem (item) {
    return item instanceof this.mure.WRAPPERS.GenericWrapper;
  }
  async canExecuteOnInstance (item, inputOptions) {
    return (await super.canExecuteOnInstance(item, inputOptions)) ||
      item instanceof this.mure.WRAPPERS.GenericWrapper;
  }
  async executeOnInstance (item, inputOptions) {
    const output = new OutputSpec();
    let className = inputOptions.className;
    if (!inputOptions.className) {
      if (!inputOptions.attribute) {
        output.warn(`No className or attribute option supplied`);
        return output;
      }
      if (item.getValue) {
        className = await item.getValue(inputOptions.attribute);
      } else {
        output.warn(`Can't get attributes from ${item.type} instance`);
        return output;
      }
      if (!className) {
        output.warn(`${item.type} instance missing attribute ${inputOptions.attribute}`);
        return output;
      }
    }
    if (!item.addClass) {
      output.warn(`Can't assign class to non-taggable ${item.type}`);
    } else {
      item.addClass(className);
      output.flagPollutedDoc(item.doc);
    }
    return output;
  }
}

export default AssignClassOperation;
