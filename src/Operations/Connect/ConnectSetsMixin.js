import OutputSpec from '../Common/OutputSpec.js';

export default (superclass) => class extends superclass {
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

    const inputs = await super.inferSelectionInputs(selection);
    inputs.addToggleOption({
      name: 'direction',
      choices: ['undirected', 'source', 'target'],
      defaultValue: 'target'
    });
    inputs.addConstructRequirement({
      name: 'sourceSet',
      defaultValue: setA,
      itemTypes: [this.mure.CONSTRUCTS.SetConstruct, this.mure.CONSTRUCTS.SupernodeConstruct],
      suggestions: setSuggestions
    });
    inputs.addConstructRequirement({
      name: 'targetSet',
      defaultValue: setB,
      itemTypes: [this.mure.CONSTRUCTS.SetConstruct, this.mure.CONSTRUCTS.SupernodeConstruct],
      suggestions: setSuggestions
    });
    inputs.addConstructRequirement({
      name: 'saveEdgesIn',
      defaultValue: containers[0],
      itemTypes: [this.mure.CONSTRUCTS.ItemConstruct],
      suggestions: containers
    });
    return inputs;
  }
  async executeOnSelection (selection, inputOptions) {
    let [sourceList, targetList, containers] = await Promise.all([
      inputOptions.sourceSet.memberConstructs(),
      inputOptions.targetSet ? inputOptions.targetSet.memberConstructs() : null,
      this.pollSelection(selection)
    ]);
    sourceList = Object.values(sourceList)
      .filter(item => item instanceof this.mure.CONSTRUCTS.NodeConstruct);
    if (targetList) {
      targetList = Object.values(targetList)
        .filter(item => item instanceof this.mure.CONSTRUCTS.NodeConstruct);
    } else {
      targetList = sourceList;
    }

    const outputPromises = [];
    for (let i = 0; i < sourceList.length; i++) {
      for (let j = 0; j < targetList.length; j++) {
        outputPromises.push(this.executeOnConstruct(
          sourceList[i], {
            otherConstruct: targetList[j],
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
};
