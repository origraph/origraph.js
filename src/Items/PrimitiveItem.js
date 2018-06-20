import TypedItem from './TypedItem.js';
import BooleanItem from './BooleanItem.js';
import NumberItem from './NumberItem.js';
import StringItem from './StringItem.js';
import DateItem from './DateItem.js';

class PrimitiveItem extends TypedItem {
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
  stringValue () {
    return String(this.value);
  }
}

export default PrimitiveItem;
