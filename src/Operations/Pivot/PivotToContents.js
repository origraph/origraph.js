import { OutputSpec } from '../common.js';
import BaseOperation from '../BaseOperation.js';
import ChainTerminatingMixin from '../ChainTerminatingMixin.js';
import ParameterlessMixin from '../ParameterlessMixin.js';

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
