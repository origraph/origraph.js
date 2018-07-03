import { InputSpec, OutputSpec } from './common.js';
import BaseOperation from './BaseOperation.js';

class ConvertOperation extends BaseOperation {
  inferItemInputs (item) {

  }
  executeOnItem (item, inputOptions) {

  }
}

export default ConvertOperation;

/*
Conversion code stripped out of Items:

*** BaseItem

canConvertTo (ItemType) {
  return ItemType === this.constructor;
}
convertTo (ItemType) {
  if (ItemType === this.constructor) {
    return this;
  } else {
    throw new Error(`Conversion from ${this.constructor.name} to ${ItemType.name} not yet implemented.`);
  }
}

*** Generic BaseItem behavior

canConvertTo (ItemType) {
  return BaseItem.prototype.canConvertTo.call(this, ItemType);
}
convertTo (ItemType) {
  return BaseItem.prototype.convertTo.call(this, ItemType);
}

*** ContainerItem

canConvertTo (ItemType) {
  return ItemType === NodeItem ||
    super.canConvertTo(ItemType);
}
convertTo (ItemType) {
  if (ItemType === NodeItem) {
    this.value.$edges = {};
    this.value.$tags = {};
    return new NodeItem(this.value, this.path, this.doc);
  } else {
    return super.convertTo(ItemType);
  }
}

*** DateItem

canConvertTo (ItemType) {
  return ItemType === NumberItem ||
    ItemType === StringItem ||
    super.canConvertTo(ItemType);
}
convertTo (ItemType) {
  if (ItemType === NumberItem) {
    this.parent[this.label] = this._value = Number(this.value);
    return new NumberItem(this._value, this.path, this.doc);
  } else if (ItemType === StringItem) {
    this.parent[this.label] = this._value = String(this.value);
    return new StringItem(this._value, this.path, this.doc);
  } else {
    return super.convertTo(ItemType);
  }
}

*** PrimitiveItem

canConvertTo (ItemType) {
  return ItemType === BooleanItem ||
    ItemType === NumberItem ||
    ItemType === StringItem ||
    ItemType === DateItem ||
    super.canConvertTo(ItemType);
}
convertTo (ItemType) {
  if (ItemType === BooleanItem) {
    this.value = !!this.value;
  } else if (ItemType === NumberItem) {
    this.value = Number(this.value);
  } else if (ItemType === StringItem) {
    this.value = String(this.value);
  } else if (ItemType === DateItem) {
    this.value = {
      $isDate: true,
      str: new Date(this.value).toString()
    };
  } else {
    return super.convertTo(ItemType);
  }
  return new ItemType({
    mure: this.mure,
    value: this.value,
    path: this.path,
    doc: this.doc
  });
}

***


 */
