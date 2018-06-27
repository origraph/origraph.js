import ContextualOperation from '../ContextualOperation.js';
import ConvertContainerToNode from './ConvertContainerToNode.js';

class ConvertOperation extends ContextualOperation {
  constructor (mure) {
    super(mure, [
      ConvertContainerToNode
    ]);
  }
}

export default ConvertOperation;
