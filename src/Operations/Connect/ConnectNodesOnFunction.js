import { InputSpec, OutputSpec } from '../common.js';
import ConnectSubOp from './ConnectSubOp.js';

class ConnectNodesOnFunction extends ConnectSubOp {
  async inferSelectionInputs (selection) {
    let { nodeLists, saveEdgesIn } = this.extractNodeLists([await selection.items()]);
    let nodeList = nodeLists[0];
    if (nodeList.length === 0) {
      return null;
    }
    const inputs = new InputSpec();
    inputs.addToggleOption({
      name: 'direction',
      optionList: ['Undirected', 'Directed'],
      defaultValue: 'Undirected'
    });
    inputs.addValueOption({
      name: 'connectWhen',
      defaultValue: ConnectSubOp.DEFAULT_CONNECT_WHEN
    });
    inputs.addValueOption({
      name: 'targetSelection',
      defaultValue: null
    });
    inputs.addItemRequirement({
      name: 'saveEdgesIn',
      ItemType: this.mure.ITEM_TYPES.ContainerItem,
      defaultValue: saveEdgesIn
    });
    return inputs;
  }
  async executeOnSelection (selection, inputOptions) {
    let itemLists = [await selection.items()];
    if (inputOptions.targetSelection) {
      itemLists.push(await inputOptions.targetSelection.items());
    }
    let { nodeLists, saveEdgesIn } = this.extractNodeLists(itemLists);
    let sourceList = nodeLists[0];
    let targetList = nodeLists[1] || nodeLists[0];

    const outputPromises = [];
    for (let i = 0; i < sourceList.length; i++) {
      for (let j = 0; j < targetList.length; j++) {
        outputPromises.push(this.executeOnItem(
          sourceList[i], {
            otherItem: targetList[j],
            saveEdgesIn,
            connectWhen: inputOptions.connectWhen || ConnectSubOp.DEFAULT_CONNECT_WHEN
          }
        ));
      }
    }
    return OutputSpec.glomp(await Promise.all(outputPromises));
  }
}

export default ConnectNodesOnFunction;
