import { OutputSpec } from '../common.js';
import BaseOperation from '../BaseOperation.js';
import ChainTerminatingMixin from '../ChainTerminatingMixin.js';

class PivotToContents extends ChainTerminatingMixin(BaseOperation) {
  checkItemInputs (item, inputOptions) {
    return item instanceof this.mure.ITEM_TYPES.ContainerItem &&
      item instanceof this.mure.ITEM_TYPES.DocumentItem;
  }
  async executeOnItem (item, inputOptions) {
    if (!this.checkItemInputs(item, inputOptions)) {
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
