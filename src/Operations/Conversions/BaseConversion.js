import Introspectable from '../../Common/Introspectable.js';

class BaseConversion extends Introspectable {
  constructor ({ mure, TargetType, standardTypes = [], specialTypes = [] }) {
    super();
    this.mure = mure;
    this.TargetType = TargetType;
    this.standardTypes = {};
    standardTypes.forEach(Type => { this.standardTypes[Type.type] = Type; });
    this.specialTypes = {};
    specialTypes.forEach(Type => { this.specialTypes[Type.type] = Type; });
    this.standardTypes = [
      mure.CONSTRUCTS.NullConstruct,
      mure.CONSTRUCTS.BooleanConstruct,
      mure.CONSTRUCTS.NumberConstruct,
      mure.CONSTRUCTS.StringConstruct,
      mure.CONSTRUCTS.DateConstruct,
      mure.CONSTRUCTS.ReferenceConstruct,
      mure.CONSTRUCTS.NodeConstruct,
      mure.CONSTRUCTS.EdgeConstruct,
      mure.CONSTRUCTS.SetConstruct,
      mure.CONSTRUCTS.SupernodeConstruct
    ];
    this.specialTypes = [];
  }
  canExecuteOnInstance (item, inputOptions) {
    return this.standardTypes[item.type] || this.specialTypes[item.type];
  }
  convertItem (item, inputOptions, outputSpec) {
    if (this.standardTypes[item.type]) {
      this.standardConversion(item, inputOptions, outputSpec);
    } else if (this.specialTypes[item.type]) {
      this.specialConversion(item, inputOptions, outputSpec);
    } else {
      outputSpec.warn(`Conversion from ${item.type} to ${this.TargetType.type} is not supported`);
    }
  }
  addOptionsToSpec (inputSpec) {}
  standardConversion (item, inputOptions, outputSpec) {
    // Because of BaseConstruct's setter, this will actually apply to the
    // item's document as well as to the item wrapper
    item.value = this.TargetType.standardize(item.value);
    if (this.TargetType.isBadValue(item.value)) {
      outputSpec.warn(`Converted ${item.type} to ${item.value}`);
    }
  }
  specialConversion (item, inputOptions, outputSpec) {
    throw new Error('unimiplemented');
  }
}
Object.defineProperty(BaseConversion, 'type', {
  get () {
    return /(.*)Conversion/.exec(this.name)[1];
  }
});
export default BaseConversion;
