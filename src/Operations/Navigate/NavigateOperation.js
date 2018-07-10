import ContextualOperation from '../Common/ContextualOperation.js';
import NavigateToContentsOperation from './NavigateToContentsOperation.js';
import NavigateToMembersOperation from './NavigateToMembersOperation.js';
import NavigateToNodesOperation from './NavigateToNodesOperation.js';
import NavigateToEdgesOperation from './NavigateToEdgesOperation.js';

class NavigateOperation extends ContextualOperation {
  constructor (mure) {
    super(mure, [
      NavigateToContentsOperation,
      NavigateToMembersOperation,
      NavigateToNodesOperation,
      NavigateToEdgesOperation
    ]);
  }
}

export default NavigateOperation;
