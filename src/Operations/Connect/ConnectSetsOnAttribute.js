import InputSpec from '../Common/InputSpec.js';
import OutputSpec from '../Common/OutputSpec.js';
import ConnectSubOp from './ConnectSubOp.js';

class ConnectSetsOnAttribute extends ConnectSubOp {
  async inferSelectionInputs (selection) {
    let setA = null;
    let setB = null;
    let containers = await this.pollSelection(selection, item => {
      if (item.value && item.value.$members) {
        if (!setA) {
          setA = item;
        } else if (!setB) {
          setB = item;
        }
      }
    });
    if (!setA) {
      return null;
    }
    let setSuggestions = [setA];
    if (setB) {
      setSuggestions.push(setB);
    }

    const inputs = new InputSpec();
    inputs.addToggleOption({
      name: 'direction',
      choices: ['undirected', 'source', 'target'],
      defaultValue: 'target'
    });
    inputs.addItemRequirement({
      name: 'sourceSet',
      defaultValue: setA,
      itemTypes: [this.mure.ITEM_TYPES.SetItem, this.mure.ITEM_TYPES.SupernodeItem],
      suggestions: setSuggestions
    });
    inputs.addValueOption({
      name: 'sourceAttribute',
      defaultValue: null // indicates that the label should be used
    });
    inputs.addItemRequirement({
      name: 'targetSet',
      defaultValue: setB,
      itemTypes: [this.mure.ITEM_TYPES.SetItem, this.mure.ITEM_TYPES.SupernodeItem],
      suggestions: setSuggestions
    });
    inputs.addValueOption({
      name: 'targetAttribute',
      defaultValue: null // indicates that the label should be used
    });
    inputs.addItemRequirement({
      name: 'saveEdgesIn',
      defaultValue: containers[0],
      itemTypes: [this.mure.ITEM_TYPES.ContainerItem],
      suggestions: containers
    });
    return inputs;
  }
  async executeOnSelection (selection, inputOptions) {
    let [sourceList, targetList, containers] = await Promise.all([
      inputOptions.sourceSet.memberItems(),
      inputOptions.targetSet ? inputOptions.targetSet.memberItems() : null,
      this.pollSelection(selection)
    ]);
    sourceList = Object.values(sourceList)
      .filter(item => item instanceof this.mure.ITEM_TYPES.NodeItem);
    if (targetList) {
      targetList = Object.values(targetList)
        .filter(item => item instanceof this.mure.ITEM_TYPES.NodeItem);
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
            connectWhen: (source, target) => {
              const sourceVal = inputOptions.sourceAttribute
                ? source.value[inputOptions.sourceAttribute] : source.label;
              const targetVal = inputOptions.targetAttribute
                ? target.value[inputOptions.targetAttribute] : target.label;
              return sourceVal === targetVal;
            },
            direction: inputOptions.direction || 'target'
          }
        ));
      }
    }
    return OutputSpec.glomp(await Promise.all(outputPromises));
  }
}

export default ConnectSetsOnAttribute;
