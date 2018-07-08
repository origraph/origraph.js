import { glompLists } from '../Common/utils.js';

export default (superclass) => class extends superclass {
  async inferSelectionInputs (selection) {
    const containers = await this.pollSelection(selection);

    const inputs = await super.inferSelectionInputs(selection);
    inputs.addToggleOption({
      name: 'direction',
      choices: ['undirected', 'source', 'target'],
      defaultValue: 'target'
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
  async getSelectionExecutionLists (selection, inputOptions) {
    let [source, target] = await Promise.all([
      this.extractNodes(selection),
      inputOptions.targetSelection && this.extractNodes(inputOptions.targetSelection)
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

    return {sourceList, targetList, containers};
  }
};
