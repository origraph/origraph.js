import ContextualOperation from '../Common/ContextualOperation.js';
import NavigateToContents from './NavigateToContents.js';
import NavigateToMembers from './NavigateToMembers.js';
import NavigateToNodes from './NavigateToNodes.js';
import NavigateToEdges from './NavigateToEdges.js';

class NavigateOperation extends ContextualOperation {
  constructor (mure) {
    super(mure, [
      NavigateToContents,
      NavigateToMembers,
      NavigateToNodes,
      NavigateToEdges
    ]);
  }
}

export default NavigateOperation;
