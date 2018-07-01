import InputSpec from '../Common/InputSpec.js';
import OutputSpec from '../Common/OutputSpec.js';
import { glompLists, singleMode } from '../Common/utils.js';
import BaseOperation from '../BaseOperation.js';
import ChainTerminatingMixin from '../ChainTerminatingMixin.js';

class ConnectSubOp extends ChainTerminatingMixin(BaseOperation) {
  inferItemInputs (item) {
    const inputs = new InputSpec();
    inputs.addToggleOption({
      name: 'direction',
      choices: ['undirected', 'source', 'target'],
      defaultValue: 'undirected'
    });
    inputs.addValueOption({
      name: 'connectWhen',
      defaultValue: ConnectSubOp.DEFAULT_CONNECT_WHEN
    });
    inputs.addItemRequirement({
      name: 'otherItem',
      ItemType: this.mure.ITEM_TYPES.NodeItem
    });
    const orphanContainer = new this.mure.ITEM_TYPES.ContainerItem({
      mure: this.mure,
      value: item.doc.orphans,
      path: [`{"_id":"${item.doc._id}"}`, 'orphans'],
      doc: item.doc
    });
    const eligibleItems = {};
    eligibleItems[orphanContainer.uniqueSelector] = orphanContainer;
    inputs.addItemRequirement({
      name: 'saveEdgesIn',
      ItemType: this.mure.ITEM_TYPES.ContainerItem,
      defaultValue: orphanContainer,
      eligibleItems
    });
    return inputs;
  }
  async executeOnItem (item, inputOptions) {
    const match = inputOptions.connectWhen || ConnectSubOp.DEFAULT_CONNECT_WHEN;
    if (match(item, inputOptions.otherItem)) {
      const newEdge = item.linkTo(inputOptions.otherItem,
        inputOptions.saveEdgesIn, inputOptions.direction);

      return new OutputSpec({
        newSelectors: [ newEdge.uniqueSelector ],
        pollutedDocs: glompLists([
          [item.doc, inputOptions.otherItem.doc, newEdge.doc]
        ])
      });
    } else {
      return new OutputSpec();
    }
  }
  extractNodeLists (itemLists) {
    let saveEdgesInDoc;
    let nodeLists = itemLists.map(items => {
      return Object.values(items).reduce((agg, item) => {
        if (item instanceof this.mure.ITEM_TYPES.ContainerItem) {
          if (saveEdgesInDoc === undefined) {
            saveEdgesInDoc = item.doc;
          }
        }
        if (item instanceof this.mure.ITEM_TYPES.NodeItem) {
          return agg.concat([ item ]);
        }
        return agg;
      }, []);
    });
    if (!saveEdgesInDoc) {
      saveEdgesInDoc = singleMode(nodeLists.reduce((agg, items) => {
        return agg.concat(items.map(item => item.doc));
      }, []));
    }
    let saveEdgesIn = null;
    if (saveEdgesInDoc) {
      saveEdgesIn = new this.mure.ITEM_TYPES.ContainerItem({
        mure: this.mure,
        value: saveEdgesInDoc.orphans,
        path: [`{"_id":"${saveEdgesInDoc._id}"}`, 'orphans'],
        doc: saveEdgesInDoc
      });
    }
    return { nodeLists, saveEdgesIn };
  }
}
ConnectSubOp.DEFAULT_CONNECT_WHEN = (a, b) => { return a.label === b.label; };

export default ConnectSubOp;
