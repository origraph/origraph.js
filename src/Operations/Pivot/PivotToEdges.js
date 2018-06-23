import { OutputSpec, glompLists } from '../common.js';
import DirectedPivot from '../DirectedPivot.js';

class PivotToEdges extends DirectedPivot {
  async executeOnItem (item, inputOptions) {
    if (!this.checkInputs(item, inputOptions)) {
      throw new Error(`Must be an EdgeItem or NodeItem to PivotToEdges`);
    }
    let forward = this._forward === undefined
      ? this.getForward(inputOptions) : this._forward;

    if (item instanceof this.mure.ITEM_TYPES.EdgeItem) {
      return new OutputSpec({
        newSelectors: await item.nodeSelectors(forward)
      });
    } else { // if (item instanceof this.mure.ITEM_TYPES.NodeItem) {
      let temp = await item.edgeItems(forward);
      temp = temp.map(edgeItem => edgeItem.nodeSelectors(forward));
      return new OutputSpec({
        newSelectors: glompLists(await Promise.all(temp))
      });
    }
  }
}

export default PivotToEdges;
