import { OutputSpec, glompLists } from '../common.js';
import DirectedPivot from './DirectedPivot.js';

class PivotToNodes extends DirectedPivot {
  async executeOnItem (item, inputOptions) {
    if (!this.checkInputs(item, inputOptions)) {
      throw new Error(`Must be an EdgeItem or NodeItem to PivotToNodes`);
    }
    let forward = this._forward === undefined
      ? this.getForward(inputOptions) : this._forward;

    if (item instanceof this.mure.ITEM_TYPES.NodeItem) {
      return new OutputSpec({
        newSelectors: await item.edgeSelectors(forward)
      });
    } else { // if (item instanceof this.mure.ITEM_TYPES.EdgeItem) {
      let temp = await item.nodeItems(forward);
      temp = temp.map(edgeItem => edgeItem.edgeSelectors(forward));
      return new OutputSpec({
        newSelectors: glompLists(await Promise.all(temp))
      });
    }
  }
}

export default PivotToNodes;
