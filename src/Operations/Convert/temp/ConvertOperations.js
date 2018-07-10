import { InputSpec, OutputSpec } from './common.js';
import BaseOperation from './BaseOperation.js';

class ConvertOperation extends BaseOperation {
  inferConstructInputs (item) {

  }
  executeOnConstruct (item, inputOptions) {

  }
}

export default ConvertOperation;

/*
Conversion code stripped out of Constructs:

*** BaseConstruct

canConvertTo (ConstructType) {
  return ConstructType === this.constructor;
}
convertTo (ConstructType) {
  if (ConstructType === this.constructor) {
    return this;
  } else {
    throw new Error(`Conversion from ${this.constructor.name} to ${ConstructType.name} not yet implemented.`);
  }
}

*** Generic BaseConstruct behavior

canConvertTo (ConstructType) {
  return BaseConstruct.prototype.canConvertTo.call(this, ConstructType);
}
convertTo (ConstructType) {
  return BaseConstruct.prototype.convertTo.call(this, ConstructType);
}

*** ItemConstruct

canConvertTo (ConstructType) {
  return ConstructType === NodeConstruct ||
    super.canConvertTo(ConstructType);
}
convertTo (ConstructType) {
  if (ConstructType === NodeConstruct) {
    this.value.$edges = {};
    this.value.$tags = {};
    return new NodeConstruct(this.value, this.path, this.doc);
  } else {
    return super.convertTo(ConstructType);
  }
}

*** DateConstruct

canConvertTo (ConstructType) {
  return ConstructType === NumberConstruct ||
    ConstructType === StringConstruct ||
    super.canConvertTo(ConstructType);
}
convertTo (ConstructType) {
  if (ConstructType === NumberConstruct) {
    this.parent[this.label] = this._value = Number(this.value);
    return new NumberConstruct(this._value, this.path, this.doc);
  } else if (ConstructType === StringConstruct) {
    this.parent[this.label] = this._value = String(this.value);
    return new StringConstruct(this._value, this.path, this.doc);
  } else {
    return super.convertTo(ConstructType);
  }
}

*** PrimitiveConstruct

canConvertTo (ConstructType) {
  return ConstructType === BooleanConstruct ||
    ConstructType === NumberConstruct ||
    ConstructType === StringConstruct ||
    ConstructType === DateConstruct ||
    super.canConvertTo(ConstructType);
}
convertTo (ConstructType) {
  if (ConstructType === BooleanConstruct) {
    this.value = !!this.value;
  } else if (ConstructType === NumberConstruct) {
    this.value = Number(this.value);
  } else if (ConstructType === StringConstruct) {
    this.value = String(this.value);
  } else if (ConstructType === DateConstruct) {
    this.value = {
      $isDate: true,
      str: new Date(this.value).toString()
    };
  } else {
    return super.convertTo(ConstructType);
  }
  return new ConstructType({
    mure: this.mure,
    value: this.value,
    path: this.path,
    doc: this.doc
  });
}

***


 */
