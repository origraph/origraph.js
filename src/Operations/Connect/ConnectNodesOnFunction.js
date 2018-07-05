import InputSpec from '../Common/InputSpec.js';
import OutputSpec from '../Common/OutputSpec.js';
import { glompLists } from '../Common/utils.js';
import ConnectSubOp from './ConnectSubOp.js';

class ConnectNodesOnFunction extends ConnectSubOp {
  async inferSelectionInputs (selection) {
    const containers = await this.pollSelection(selection);

    const inputs = new InputSpec();
    inputs.addToggleOption({
      name: 'direction',
      choices: ['undirected', 'source', 'target'],
      defaultValue: 'target'
    });
    inputs.addValueOption({
      name: 'connectWhen',
      defaultValue: ConnectSubOp.DEFAULT_CONNECT_WHEN
    });
    inputs.addMiscOption({
      name: 'targetSelection',
      defaultValue: selection
    });
    inputs.addItemRequirement({
      name: 'saveEdgesIn',
      itemTypes: [this.mure.ITEM_TYPES.ContainerItem],
      defaultValue: containers[0],
      suggestions: containers
    });
    return inputs;
  }
  async extractNodes (selection) {
    const nodeList = [];
    const containers = await this.pollSelection(selection, item => {
      if (item instanceof this.mure.ITEM_TYPES.NodeItem) {
        nodeList.push(item);
      }
    });
    return { nodeList, containers };
  }
  async executeOnSelection (selection, inputOptions) {
    let [source, target] = await Promise.all([
      this.extractNodes(selection),
      inputOptions.targetSelection ? this.extractNodes(inputOptions.targetSelection) : {}
    ]);
    let sourceList = source.nodeList;
    let containers = source.containers;
    let targetList;
    if (target) {
      targetList = target.nodeList;
      containers = glompLists([containers, target.containers]);
    } else {
      targetList = sourceList;
    }

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
}

export default ConnectNodesOnFunction;
