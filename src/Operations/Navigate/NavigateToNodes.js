import { glompLists } from '../Common/utils.js';
import OutputSpec from '../Common/OutputSpec.js';
import DirectedNavigate from './DirectedNavigate.js';

class NavigateToNodes extends DirectedNavigate {
  async executeOnConstruct (item, inputOptions) {
    if (!this.checkInputs(item, inputOptions)) {
      throw new Error(`Must be an EdgeConstruct or NodeConstruct to NavigateToNodes`);
    }
    let forward = this._forward === undefined
      ? this.getForward(inputOptions) : this._forward;

    if (item instanceof this.mure.CONSTRUCTS.NodeConstruct) {
      return new OutputSpec({
        newSelectors: await item.edgeSelectors(forward)
      });
    } else { // if (item instanceof this.mure.CONSTRUCTS.EdgeConstruct) {
      let temp = await item.nodeConstructs(forward);
      temp = temp.map(edgeConstruct => edgeConstruct.edgeSelectors(forward));
      return new OutputSpec({
        newSelectors: glompLists(await Promise.all(temp))
      });
    }
  }
}

export default NavigateToNodes;
