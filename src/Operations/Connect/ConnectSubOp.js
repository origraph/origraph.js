import { InputSpec, OutputSpec, glompLists, singleMode } from '../common.js';
import BaseOperation from '../BaseOperation.js';
import ChainTerminatingMixin from '../ChainTerminatingMixin.js';

class ConnectSubOp extends ChainTerminatingMixin(BaseOperation) {
  inferItemInputs (item) {
    const inputs = new InputSpec();
    inputs.addToggleOption({
      name: 'direction',
      optionList: ['Undirected', 'Directed'],
      defaultValue: 'Undirected'
    });
    inputs.addValueOption({
      name: 'connectWhen',
      defaultValue: ConnectSubOp.DEFAULT_CONNECT_WHEN
    });
    inputs.addItemRequirement({
      name: 'otherItem',
      ItemType: this.mure.ITEM_TYPES.NodeItem
    });
    inputs.addItemRequirement({
      name: 'saveEdgesIn',
      ItemType: this.mure.ITEM_TYPES.ContainerItem,
      defaultValue: new this.mure.ITEM_TYPES.ContainerItem(
        this.mure,
        item.doc.orphans,
        [`{"_id":"${item.doc._id}"}`, 'orphans'],
        item.doc
      )
    });
    return inputs;
  }
  async executeOnItem (item, inputOptions) {
    const match = inputOptions.connectWhen || ConnectSubOp.DEFAULT_CONNECT_WHEN;
    if (match(item, inputOptions.otherItem)) {
      const newEdge = item.linkTo(inputOptions.otherItem,
        inputOptions.saveEdgesIn, inputOptions.directed === 'Directed');

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
