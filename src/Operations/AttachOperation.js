import Selection from '../Selection.js';
import BaseOperation from './Common/BaseOperation.js';
import OutputSpec from './Common/OutputSpec.js';
import ContextualOption from './Common/ContextualOption.js';
import TypedOption from './Common/TypedOption.js';
import NestedAttributeOption from './Common/NestedAttributeOption.js';
import InputOption from './Common/InputOption.js';

const DEFAULT_CONNECT_WHEN = 'return edge.label === node.label;';

class AttachOperation extends BaseOperation {
  getInputSpec () {
    const result = super.getInputSpec();

    // Do we connect nodes in the current selection, or to the nodes inside some
    // set-like construct?
    const context = new ContextualOption({
      parameterName: 'context',
      choices: ['Within Selection', 'Bipartite'],
      hiddenChoices: ['Target Container'],
      defaultValue: 'Within Selection'
    });
    result.addOption(context);

    // For some contexts, we need to specify edge and/or node documents,
    // items, or sets (classes or groups)
    context.specs['Bipartite'].addOption(new TypedOption({
      parameterName: 'edges',
      validTypes: [
        this.mure.WRAPPERS.DocumentWrapper,
        this.mure.WRAPPERS.ContainerWrapper,
        this.mure.WRAPPERS.SetWrapper,
        this.mure.WRAPPERS.SupernodeWrapper,
        Selection
      ]
    }));
    const nodes = new TypedOption({
      parameterName: 'nodes',
      validTypes: [
        this.mure.WRAPPERS.DocumentWrapper,
        this.mure.WRAPPERS.ContainerWrapper,
        this.mure.WRAPPERS.SetWrapper,
        this.mure.WRAPPERS.SupernodeWrapper,
        Selection
      ]
    });
    context.specs['Bipartite'].addOption(nodes);
    context.specs['Target Container'].addOption(nodes);

    // Edge direction
    result.addOption(new InputOption({
      parameterName: 'direction',
      choices: ['undirected', 'source', 'target'],
      defaultValue: 'undirected'
    }));

    // All contexts can be executed by matching attributes or evaluating
    // a function
    const mode = new ContextualOption({
      parameterName: 'mode',
      choices: ['Attribute', 'Function'],
      defaultValue: 'Attribute'
    });
    result.addOption(mode);

    // Attribute mode needs edge and node attributes
    mode.specs['Attribute'].addOption(new NestedAttributeOption({
      parameterName: 'edgeAttribute',
      defaultValue: null, // null indicates that the label should be used
      getItemChoiceRole: (item, inputOptions) => {
        if (inputOptions.context === 'Bipartite') {
          if (inputOptions.edges && item.equals(inputOptions.edges)) {
            return 'deep';
          } else {
            return 'ignore';
          }
        } else if (inputOptions.nodes && item.equals(inputOptions.nodes)) {
          return 'ignore';
        } else {
          return 'standard';
        }
      }
    }));
    mode.specs['Attribute'].addOption(new NestedAttributeOption({
      parameterName: 'nodeAttribute',
      defaultValue: null, // null indicates that the label should be used
      getItemChoiceRole: (item, inputOptions) => {
        if (inputOptions.nodes && item.equals(inputOptions.nodes)) {
          return 'deep';
        } else if (inputOptions.context === 'Bipartite') {
          return 'ignore';
        } else {
          return 'standard';
        }
      }
    }));

    // Function mode needs the function
    mode.specs['Function'].addOption(new InputOption({
      parameterName: 'connectWhen',
      defaultValue: DEFAULT_CONNECT_WHEN,
      openEnded: true
    }));

    return result;
  }
  async canExecuteOnInstance (item, inputOptions) {
    return false;
  }
  async executeOnInstance (item, inputOptions) {
    throw new Error(`Running the Attach operation on an instance is not supported.`);
  }
  async canExecuteOnSelection (selection, inputOptions) {
    if (inputOptions.ignoreErrors !== 'Stop on Error') {
      return true;
    }
    if (inputOptions.context === 'Bipartite') {
      if (!(
        (inputOptions.edges instanceof this.mure.WRAPPERS.DocumentWrapper ||
         inputOptions.edges instanceof this.mure.WRAPPERS.ContainerWrapper ||
         inputOptions.edges instanceof this.mure.WRAPPERS.SetWrapper) &&
        (inputOptions.nodes instanceof this.mure.WRAPPERS.DocumentWrapper ||
         inputOptions.nodes instanceof this.mure.WRAPPERS.ContainerWrapper ||
         inputOptions.nodes instanceof this.mure.WRAPPERS.SetWrapper))) {
        return false;
      }
    } else if (inputOptions.context === 'Target Container') {
      if (!inputOptions.nodes || !inputOptions.nodes.items) {
        return false;
      }
      let edgeItems = await selection.items();
      let nodeItems = await inputOptions.nodes.items();
      return Object.values(edgeItems)
        .some(item => item instanceof this.mure.WRAPPERS.EdgeWrapper) &&
        Object.values(nodeItems)
          .some(item => item instanceof this.mure.WRAPPERS.NodeWrapper);
    } else { // inputOptions.context === 'Within Selection'
      const edgeItems = await selection.items();
      let oneNode = false;
      let oneEdge = false;
      return Object.values(edgeItems).some(item => {
        if (item instanceof this.mure.WRAPPERS.NodeWrapper) {
          oneNode = true;
        } else if (item instanceof this.mure.WRAPPERS.EdgeWrapper) {
          oneEdge = true;
        }
        return oneNode && oneEdge;
      });
    }
    if (inputOptions.mode === 'Function') {
      if (typeof inputOptions.connectWhen === 'function') {
        return true;
      }
      try {
        Function('edge', 'node', // eslint-disable-line no-new-func
          inputOptions.connectWhen || DEFAULT_CONNECT_WHEN);
        return true;
      } catch (err) {
        if (err instanceof SyntaxError) {
          return false;
        } else {
          throw err;
        }
      }
    } else {
      return inputOptions.edgeAttribute && inputOptions.nodeAttribute;
    }
  }
  async executeWithinSelection (items, connectWhen, direction, output) {
    // Within the selection, we only know which ones are edges and which ones
    // are nodes on the fly
    const itemList = Object.values(items);
    for (let i = 0; i < itemList.length; i++) {
      for (let j = i + 1; j < itemList.length; j++) {
        let edge =
          (itemList[i] instanceof this.mure.WRAPPERS.EdgeWrapper && itemList[i]) ||
          (itemList[j] instanceof this.mure.WRAPPERS.EdgeWrapper && itemList[j]);
        let node =
          (itemList[i] instanceof this.mure.WRAPPERS.NodeWrapper && itemList[i]) ||
          (itemList[j] instanceof this.mure.WRAPPERS.NodeWrapper && itemList[j]);
        if (edge && node && connectWhen(edge, node)) {
          edge.attachTo(node, direction);
          output.flagPollutedDoc(edge.doc);
          output.flagPollutedDoc(node.doc);
        }
      }
    }
    return output;
  }
  async executeOnSelection (selection, inputOptions) {
    const output = new OutputSpec();

    // Figure out the criteria for matching nodes
    let connectWhen;
    if (inputOptions.mode === 'Function') {
      connectWhen = inputOptions.connectWhen;
      if (typeof connectWhen !== 'function') {
        try {
          connectWhen = new Function('edge', 'node', // eslint-disable-line no-new-func
            inputOptions.connectWhen || DEFAULT_CONNECT_WHEN);
        } catch (err) {
          if (err instanceof SyntaxError) {
            output.warn(`connectWhen SyntaxError: ${err.message}`);
            return output;
          } else {
            throw err;
          }
        }
      }
    } else { // if (inputOptions.mode === 'Attribute')
      const getEdgeValue = inputOptions.edgeAttribute === null
        ? edge => edge.label
        : edge => edge.value[inputOptions.edgeAttribute];
      const getNodeValue = inputOptions.nodeAttribute === null
        ? node => node.label
        : node => node.value[inputOptions.nodeAttribute];
      connectWhen = (edge, node) => getEdgeValue(edge) === getNodeValue(node);
    }

    let edges;
    if (inputOptions.context === 'Bipartite') {
      if (inputOptions.edges instanceof this.mure.WRAPPERS.SetWrapper ||
          inputOptions.edges instanceof this.mure.WRAPPERS.SupernodeWrapper) {
        edges = await inputOptions.edges.getMembers();
      } else if (inputOptions.edges instanceof this.mure.WRAPPERS.DocumentWrapper ||
                 inputOptions.edges instanceof this.mure.WRAPPERS.ContainerWrapper) {
        edges = inputOptions.edges.getContents();
      } else {
        output.warn(`inputOptions.edges is of unexpected type ${inputOptions.edges && inputOptions.edges.type}`);
        return output;
      }
    } else {
      edges = await selection.items();
    }

    let edgeList = Object.values(edges);
    if (edgeList.length === 0) {
      output.warn(`No edges supplied to attach operation`);
      return output;
    }

    // At this point we know enough to deal with 'Within Selection' mode:
    if (inputOptions.context === 'Within Selection') {
      return this.executeWithinSelection(edges, connectWhen, inputOptions.direction, output);
    }

    let nodes;
    if (inputOptions.nodes instanceof Selection) {
      nodes = await inputOptions.nodes.items();
    } else if (inputOptions.nodes instanceof this.mure.WRAPPERS.SetWrapper ||
               inputOptions.nodes instanceof this.mure.WRAPPERS.SupernodeWrapper) {
      nodes = await inputOptions.nodes.getMembers();
    } else if (inputOptions.nodes instanceof this.mure.WRAPPERS.ContainerWrapper ||
               inputOptions.nodes instanceof this.mure.WRAPPERS.DocumentWrapper) {
      nodes = inputOptions.nodes.getContents();
    } else {
      output.warn(`inputOptions.nodes is of unexpected type ${inputOptions.nodes && inputOptions.nodes.type}`);
      return output;
    }

    const nodeList = Object.values(nodes);
    if (nodeList.length === 0) {
      output.warn('No nodes supplied to attach operation');
    }

    // Attach the edges!
    edgeList.forEach(edge => {
      nodeList.forEach(node => {
        if (edge instanceof this.mure.WRAPPERS.EdgeWrapper &&
            node instanceof this.mure.WRAPPERS.NodeWrapper &&
            connectWhen(edge, node)) {
          edge.attachTo(node, inputOptions.direction);
          output.flagPollutedDoc(edge.doc);
          output.flagPollutedDoc(node.doc);
        }
      });
    });
    return output;
  }
}

export default AttachOperation;
