import BaseOperation from './Common/BaseOperation.js';
import OutputSpec from './Common/OutputSpec.js';
import ContextualOption from './Common/ContextualOption.js';
import ClassOption from './Common/ClassOption.js';
import InputOption from './Common/InputOption.js';

const DEFAULT_FILTER_FUNC = 'return item.value === true';

class FilterOperation extends BaseOperation {
  getInputSpec () {
    const result = super.getInputSpec();
    const context = new ContextualOption({
      parameterName: 'context',
      choices: ['Class', 'Function'],
      defaultValue: 'Class'
    });
    result.addOption(context);

    context.specs['Class'].addOption(new ClassOption({
      parameterName: 'className'
    }));
    context.specs['Function'].addOption(new InputOption({
      parameterName: 'filterFunction',
      defaultValue: DEFAULT_FILTER_FUNC,
      openEnded: true
    }));

    return result;
  }
  async canExecuteOnInstance (item, inputOptions) {
    return false;
  }
  async executeOnInstance (item, inputOptions) {
    throw new Error(`The Filter operation is not yet supported at the instance level`);
  }
  async canExecuteOnSelection (selection, inputOptions) {
    if (inputOptions.context === 'Function') {
      if (typeof inputOptions.filterFunction === 'function') {
        return true;
      }
      try {
        Function('item', // eslint-disable-line no-new-func
          inputOptions.connectWhen || DEFAULT_FILTER_FUNC);
        return true;
      } catch (err) {
        if (err instanceof SyntaxError) {
          return false;
        } else {
          throw err;
        }
      }
    } else {
      return inputOptions.className;
    }
  }
  async executeOnSelection (selection, inputOptions) {
    const output = new OutputSpec();
    let filterFunction;
    if (inputOptions.context === 'Function') {
      filterFunction = inputOptions.filterFunction;
      if (typeof filterFunction !== 'function') {
        try {
          filterFunction = new Function('item', // eslint-disable-line no-new-func
            inputOptions.connectWhen || DEFAULT_FILTER_FUNC);
        } catch (err) {
          if (err instanceof SyntaxError) {
            output.warn(`filterFunction SyntaxError: ${err.message}`);
            return output;
          } else {
            throw err;
          }
        }
      }
    } else { // if (inputOptions.context === 'Class')
      filterFunction = item => {
        return item.getClasses && item.getClasses().indexOf(inputOptions.className) !== -1;
      };
    }
    Object.values(await selection.items()).forEach(item => {
      if (filterFunction(item)) {
        output.addSelectors([item.uniqueSelector]);
      }
    });
    return output;
  }
}

export default FilterOperation;
