import Selection from '../../Selection.js';
import BaseConversion from './BaseConversion.js';
import InputOption from '../Common/InputOption.js';
import ContextualOption from '../Common/ContextualOption.js';
import NestedAttributeOption from '../Common/NestedAttributeOption.js';
import TypedOption from '../Common/TypedOption.js';

const DEFAULT_CONNECT_WHEN = 'return edge.label === node.label;';

class EdgeConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.CONSTRUCTS.EdgeConstruct,
      standardTypes: [],
      specialTypes: [
        mure.CONSTRUCTS.ItemConstruct
      ]
    });
  }
  addOptionsToSpec (inputSpec) {
    inputSpec.addOption(new TypedOption({
      parameterName: 'sources',
      validTypes: [
        this.mure.CONSTRUCTS.DocumentConstruct,
        this.mure.CONSTRUCTS.ItemConstruct,
        this.mure.CONSTRUCTS.SetConstruct,
        this.mure.CONSTRUCTS.SupernodeConstruct,
        Selection
      ]
    }));
    inputSpec.addOption(new TypedOption({
      parameterName: 'targets',
      validTypes: [
        this.mure.CONSTRUCTS.DocumentConstruct,
        this.mure.CONSTRUCTS.ItemConstruct,
        this.mure.CONSTRUCTS.SetConstruct,
        this.mure.CONSTRUCTS.SupernodeConstruct,
        Selection
      ]
    }));
    inputSpec.addOption(new InputOption({
      parameterName: 'directed',
      choices: ['Undirected', 'Directed'],
      defaultValue: 'Undirected'
    }));

    const mode = new ContextualOption({
      parameterName: 'mode',
      choices: ['Attribute', 'Function'],
      defaultValue: 'Attribute'
    });
    inputSpec.addOption(mode);

    // Attribute mode needs source and target attributes
    mode.specs['Attribute'].addOption(new NestedAttributeOption({
      parameterName: 'sourceAttribute',
      defaultValue: null, // null indicates that the label should be used
      getItemChoiceRole: (item, inputOptions) => {
        if (inputOptions.sources && item.equals(inputOptions.sources)) {
          return 'deep';
        } else {
          return 'ignore';
        }
      }
    }));
    mode.specs['Attribute'].addOption(new NestedAttributeOption({
      parameterName: 'targetAttribute',
      defaultValue: null, // null indicates that the label should be used
      getItemChoiceRole: (item, inputOptions) => {
        if (inputOptions.targets && item.equals(inputOptions.targets)) {
          return 'deep';
        } else if (inputOptions.context === 'Bipartite') {
          return 'ignore';
        }
      }
    }));

    // Function mode needs the function
    mode.specs['Function'].addOption(new InputOption({
      parameterName: 'connectWhen',
      defaultValue: DEFAULT_CONNECT_WHEN,
      openEnded: true
    }));
  }
  async specialConversion (item, inputOptions, outputSpec) {
    if (item instanceof this.mure.CONSTRUCTS.ItemConstruct) {
      let connectWhen;
      if (inputOptions.mode === 'Function') {
        connectWhen = inputOptions.connectWhen;
        if (typeof connectWhen !== 'function') {
          try {
            connectWhen = new Function('edge', 'node', // eslint-disable-line no-new-func
              inputOptions.connectWhen || DEFAULT_CONNECT_WHEN);
          } catch (err) {
            if (err instanceof SyntaxError) {
              outputSpec.warn(`connectWhen SyntaxError: ${err.message}`);
              return outputSpec;
            } else {
              throw err;
            }
          }
        }
      } else { // if (inputOptions.mode === 'Attribute')
        const getSourceValue = inputOptions.sourceAttribute === null
          ? source => source.label
          : source => source.value[inputOptions.sourceAttribute];
        const getTargetValue = inputOptions.targetAttribute === null
          ? target => target.label
          : target => target.value[inputOptions.targetAttribute];
        connectWhen = (source, target) => getSourceValue(source) === getTargetValue(target);
      }
      item.value = this.mure.CONSTRUCTS.EdgeConstruct.standardize({
        mure: this.mure,
        value: item.value,
        path: item.path,
        doc: item.doc
      });
      let direction = inputOptions.directed === 'Directed' ? 'source' : 'undirected';
      Object.values(await inputOptions.sources.items()).forEach(source => {
        if (connectWhen(item, source)) {
          item.value.$nodes[source.uniqueSelector] = item.value.$nodes[source.uniqueSelector] || {};
          item.value.$nodes[source.uniqueSelector][direction] = item.value.$nodes[source.uniqueSelector][direction] || 0;
          item.value.$nodes[source.uniqueSelector][direction] += 1;
        }
      });
      direction = inputOptions.directed === 'Directed' ? 'target' : 'undirected';
      Object.values(await inputOptions.sources.items()).forEach(target => {
        if (connectWhen(item, target)) {
          item.value.$nodes[target.uniqueSelector] = item.value.$nodes[target.uniqueSelector] || {};
          item.value.$nodes[target.uniqueSelector][direction] = item.value.$nodes[target.uniqueSelector][direction] || 0;
          item.value.$nodes[target.uniqueSelector][direction] += 1;
        }
      });
    }
  }
}
export default EdgeConversion;
