import ItemConstruct from '../../Constructs/ItemConstruct.js';
import InputOption from './InputOption.js';

class TypedOption extends InputOption {
  constructor ({
    parameterName,
    defaultValue,
    choices,
    validTypes = [],
    suggestOrphans = false
  }) {
    super({
      parameterName,
      defaultValue,
      choices,
      openEnded: false
    });
    this.validTypes = validTypes;
    this.suggestOrphans = suggestOrphans;
  }
  async populateChoicesFromSelection (selection) {
    const itemLookup = {};
    const orphanLookup = {};
    const items = await selection.items();
    Object.values(items).forEach(item => {
      if (this.validTypes.indexOf(item.constructor) !== -1) {
        itemLookup[item.uniqueSelector] = item;
      }
      if (this.suggestOrphans && item.doc && !orphanLookup[item.doc._id]) {
        orphanLookup[item.doc._id] = new ItemConstruct({
          mure: this.mure,
          value: item.doc.orphans,
          path: [item.path[0], 'orphans'],
          doc: item.doc
        });
      }
    });
    this.choices = Object.values(itemLookup).concat(Object.values(orphanLookup));
  }
}
export default TypedOption;
