import BaseOperation from './Common/BaseOperation.js';
import OutputSpec from './Common/OutputSpec.js';
import ContextualOption from './Common/ContextualOption.js';
import InputOption from './Common/InputOption.js';

class SelectOperation extends BaseOperation {
  getInputSpec () {
    const result = super.getInputSpec();
    const context = new ContextualOption({
      parameterName: 'context',
      choices: ['Children', 'Parents', 'Nodes', 'Edges', 'Members'],
      defaultValue: 'Children'
    });
    result.addOption(context);

    const direction = new InputOption({
      parameterName: 'direction',
      choices: ['Ignore', 'Forward', 'Backward'],
      defaultValue: 'Ignore'
    });
    context.specs['Nodes'].addOption(direction);
    context.specs['Edges'].addOption(direction);
  }
  async canExecuteOnInstance (item, inputOptions) {
    if (await super.canExecuteOnInstance(item, inputOptions)) {
      return true;
    }
    if (inputOptions.context === 'Children') {
      return item instanceof this.mure.CONSTRUCTS.ItemConstruct ||
        item instanceof this.mure.CONSTRUCTS.DocumentConstruct;
    } else if (inputOptions.context === 'Parents') {
      return !(item instanceof this.mure.CONSTRUCTS.DocumentConstruct ||
        item instanceof this.mure.CONSTRUCTS.RootConstruct);
    } else if (inputOptions.context === 'Nodes') {
      return item instanceof this.mure.CONSTRUCTS.NodeConstruct ||
        item instanceof this.mure.CONSTRUCTS.EdgeConstruct;
    } else if (inputOptions.context === 'Edges') {
      return item instanceof this.mure.CONSTRUCTS.NodeConstruct ||
        item instanceof this.mure.CONSTRUCTS.EdgeConstruct;
    } else if (inputOptions.context === 'Members') {
      return item instanceof this.mure.CONSTRUCTS.SetConstruct ||
        item instanceof this.mure.CONSTRUCTS.SupernodeConstruct;
    }
  }
  async executeOnInstance (item, inputOptions) {
    const output = new OutputSpec();
    const direction = inputOptions.direction || 'Ignore';
    const forward = direction === 'Forward' ? true
      : direction === 'Backward' ? false
        : null;
    if (inputOptions.context === 'Children' &&
       (item instanceof this.mure.CONSTRUCTS.ItemConstruct ||
        item instanceof this.mure.CONSTRUCTS.DocumentConstruct)) {
      output.addSelectors((await item.contentConstructs())
        .map(childConstruct => childConstruct.uniqueSelector));
    } else if (inputOptions.context === 'Parents' &&
             !(item instanceof this.mure.CONSTRUCTS.DocumentConstruct ||
               item instanceof this.mure.CONSTRUCTS.RootConstruct)) {
      output.addSelectors([item.parentConstruct.uniqueSelector]);
    } else if (inputOptions.context === 'Nodes' &&
               item instanceof this.mure.CONSTRUCTS.EdgeConstruct) {
      output.addSelectors(await item.nodeSelectors(forward));
    } else if (inputOptions.context === 'Nodes' &&
               item instanceof this.mure.CONSTRUCTS.NodeConstruct) {
      output.addSelectors(await Promise.all((await item.edgeConstructs(forward))
        .map(edge => edge.nodeSelectors(forward))));
    } else if (inputOptions.context === 'Edges' &&
               item instanceof this.mure.CONSTRUCTS.NodeConstruct) {
      output.addSelectors(await item.edgeSelectors(forward));
    } else if (inputOptions.context === 'Edges' &&
               item instanceof this.mure.CONSTRUCTS.EdgeConstruct) {
      output.addSelectors(await Promise.all((await item.nodeConstructs(forward))
        .map(node => node.edgeSelectors(forward))));
    } else if (inputOptions.context === 'Members' &&
              (item instanceof this.mure.CONSTRUCTS.SetConstruct ||
               item instanceof this.mure.CONSTRUCTS.SupernodeConstruct)) {
      output.addSelectors(await item.memberConstructs());
    } else {
      output.warn(`Can't select ${inputOptions.context} from ${item.type}`);
    }
    return output;
  }
}

export default SelectOperation;
