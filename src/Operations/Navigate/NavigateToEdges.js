import { glompLists } from '../Common/utils.js';
import OutputSpec from '../Common/OutputSpec.js';
import DirectedNavigate from './DirectedNavigate.js';

class NavigateToEdges extends DirectedNavigate {
  async executeOnConstruct (item, inputOptions) {
    if (!this.checkInputs(item, inputOptions)) {
      throw new Error(`Must be an EdgeConstruct or NodeConstruct to NavigateToEdges`);
    }
    let forward = this._forward === undefined
      ? this.getForward(inputOptions) : this._forward;

    if (item instanceof this.mure.CONSTRUCTS.EdgeConstruct) {
      return new OutputSpec({
        newSelectors: await item.nodeSelectors(forward)
      });
    } else { // if (item instanceof this.mure.CONSTRUCTS.NodeConstruct) {
      let temp = await item.edgeConstructs(forward);
      temp = temp.map(edgeConstruct => edgeConstruct.nodeSelectors(forward));
      return new OutputSpec({
        newSelectors: glompLists(await Promise.all(temp))
      });
    }
  }
}

export default NavigateToEdges;
