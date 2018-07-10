import OutputSpec from '../Common/OutputSpec.js';
import BaseOperation from '../Common/BaseOperation.js';
import ParameterlessMixin from '../Common/ParameterlessMixin.js';

class ConvertContainerToNodeOperation extends ParameterlessMixin(BaseOperation) {
  checkConstructInputs (item) {
    return item instanceof this.mure.CONSTRUCTS.ItemConstruct;
  }
  async executeOnConstruct (item) {
    if (!this.checkConstructInputs(item)) {
      throw new Error(`Construct must be a ItemConstruct`);
    }
    item.value.$tags = item.value.$tags || {};
    item.value.$edges = item.value.$edges || {};
    return new OutputSpec({
      pollutedDocs: [item.doc]
    });
  }
  async executeOnSelection (selection) {
    const temp = await super.executeOnSelection(selection);
    // Invalidate the selection's cache of items so they're properly wrapped
    // for the next chained operation
    delete selection._cachedConstructs;
    return temp;
  }
}

export default ConvertContainerToNodeOperation;
