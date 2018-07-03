import OutputSpec from '../Common/OutputSpec.js';
import BaseOperation from '../Common/BaseOperation.js';
import ChainTerminatingMixin from '../Common/ChainTerminatingMixin.js';
import ParameterlessMixin from '../Common/ParameterlessMixin.js';

class PivotToContents extends ParameterlessMixin(ChainTerminatingMixin(BaseOperation)) {
  checkItemInputs (item) {
    return item instanceof this.mure.ITEM_TYPES.ContainerItem ||
      item instanceof this.mure.ITEM_TYPES.DocumentItem;
  }
  async executeOnItem (item) {
    if (!this.checkItemInputs(item)) {
      throw new Error(`Must be a ContainerItem or a DocumentItem to \
PivotToContents`);
    }
    return new OutputSpec({
      newSelectors: (await item.contentItems())
        .map(childItem => childItem.uniqueSelector)
    });
  }
}

export default PivotToContents;
