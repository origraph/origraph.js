import InputSpec from '../Common/InputSpec.js';
import OutputSpec from '../Common/OutputSpec.js';

export default (superclass) => class extends superclass {
  async inferSelectionInputs (selection) {
    const inputs = new InputSpec();
    inputs.addValueOption({
      name: 'sourceAttribute',
      defaultValue: null // indicates that the label should be used
    });
    inputs.addValueOption({
      name: 'targetAttribute',
      defaultValue: null // indicates that the label should be used
    });
    return inputs;
  }
  async executeOnSelection (selection, inputOptions) {
    const {sourceList, targetList, containers} = await this
      .getSelectionExecutionLists(selection, inputOptions);

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
