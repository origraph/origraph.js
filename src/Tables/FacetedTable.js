import Table from './Table.js';
import SingleParentMixin from './SingleParentMixin.js';

class FacetedTable extends SingleParentMixin(Table) {
  constructor (options) {
    super(options);
    this._attribute = options.attribute;
    this._value = options.value;
    if (!this._attribute === undefined || !this._value === undefined) {
      throw new Error(`attribute and value are required`);
    }
  }
  _toRawObject () {
    const obj = super._toRawObject();
    obj.attribute = this._attribute;
    obj.value = this._value;
    return obj;
  }
  get name () {
    return `[${this._value}]`;
  }
  async * _iterate (options) {
    let index = 0;
    const parentTable = this.parentTable;
    for await (const wrappedParent of parentTable.iterate(options)) {
      if (this.attribute === null && wrappedParent.index === this._value) {
        // Faceting by index transforms a row into a table
        for (const [ childIndex, childRow ] of Object.entries(wrappedParent.row)) {
          const newItem = this._wrap({
            index: childIndex,
            row: childRow,
            itemsToConnect: [ wrappedParent ]
          });
          if (this._finishItem(newItem)) {
            yield newItem;
          }
        }
        return;
      } else if (this._attribute !== null && wrappedParent.row[this._attribute] === this._value) {
        // Normal faceting just gives a subset of the original table
        const newItem = this._wrap({
          index,
          row: Object.assign({}, wrappedParent.row),
          itemsToConnect: [ wrappedParent ]
        });
        if (this._finishItem(newItem)) {
          yield newItem;
        }
        index++;
      }
    }
  }
}
export default FacetedTable;
