import ContextualOperation from '../Common/ContextualOperation.js';
import PivotToContents from './PivotToContents.js';
import PivotToMembers from './PivotToMembers.js';
import PivotToNodes from './PivotToNodes.js';
import PivotToEdges from './PivotToEdges.js';

class PivotOperation extends ContextualOperation {
  constructor (mure) {
    super(mure, [
      PivotToContents,
      PivotToMembers,
      PivotToNodes,
      PivotToEdges
    ]);
  }
}

export default PivotOperation;
