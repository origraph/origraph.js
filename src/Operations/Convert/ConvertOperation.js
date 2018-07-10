import ContextualOperation from '../Common/ContextualOperation.js';
import ConvertContainerToNodeOperation from './ConvertContainerToNodeOperation.js';

class ConvertOperation extends ContextualOperation {
  constructor (mure) {
    super(mure, [
      ConvertContainerToNodeOperation
    ]);
  }
}

export default ConvertOperation;
