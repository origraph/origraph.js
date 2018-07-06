import InputSpec from '../Common/InputSpec.js';
import OutputSpec from '../Common/OutputSpec.js';
import ConnectSubOp from './ConnectSubOp.js';

export default (superclass) => class extends superclass {
  async inferSelectionInputs (selection) {
    const inputs = new InputSpec();
    inputs.addValueOption({
      name: 'connectWhen',
      defaultValue: ConnectSubOp.DEFAULT_CONNECT_WHEN
    });
    return inputs;
  }
  async executeOnSelection (selection, inputOptions) {
    const {sourceList, targetList, containers} = await this
      .getSelectionExecutionLists(selection, inputOptions);
    const outputPromises = [];
    for (let i = 0; i < sourceList.length; i++) {
      for (let j = 0; j < targetList.length; j++) {
        outputPromises.push(this.executeOnItem(
          sourceList[i], {
            otherItem: targetList[j],
            saveEdgesIn: inputOptions.saveEdgesIn || containers[0],
            connectWhen: inputOptions.connectWhen || ConnectSubOp.DEFAULT_CONNECT_WHEN,
            direction: inputOptions.direction || 'target'
          }
        ));
      }
    }
    return OutputSpec.glomp(await Promise.all(outputPromises));
  }
};
