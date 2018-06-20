import { InputSpec, OutputSpec } from './common.js';
import BaseOperation from './BaseOperation.js';

class PivotOperation extends BaseOperation {
  inferItemInputs (item) {
    let inputs = new InputSpec();
    if (item instanceof this.mure.ITEM_TYPES.SupernodeItem) {
      inputs.addOption({
        name: 'mode',
        options: ['Pivot to Edges', 'Pivot to Members'],
        defaultValue: 'Pivot to Edges'
      });
    }
    if (item instanceof this.mure.ITEM_TYPES.EdgeItem || item instanceof this.mure.ITEM_TYPES.NodeItem) {
      inputs.addOption({
        name: 'direction',
        options: ['Ignore Edge Direction', 'Follow Edge Direction', 'Follow Reversed Direction'],
        defaultValue: 'Ignore Edge Direction'
      });
    }
    return inputs;
  }
  executeOnItem (item, inputOptions) {
    if (item instanceof this.mure.ITEM_TYPES.SetItem ||
        (item instanceof this.mure.ITEM_TYPES.SupernodeItem &&
        inputOptions.mode === 'Pivot to Members')) {
      return new OutputSpec({
        newSelectors: Object.keys(item.value.$members)
      });
    } else if (item instanceof this.mure.ITEM_TYPES.NodeItem &&
               (!(item instanceof this.mure.ITEM_TYPES.SupernodeItem) ||
                inputOptions.mode === 'Pivot to Edges')) {
      if (inputOptions.direction === 'Ignore Edge Direction') {
        // TODO!
      } else if (inputOptions.direction === 'Follow Edge Direction') {
        // TODO!
      }
      // TODO!
    }
  }
}

export default PivotOperation;
