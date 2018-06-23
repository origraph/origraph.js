import TypedItem from './TypedItem.js';

class PrimitiveItem extends TypedItem {
  stringValue () {
    return String(this.value);
  }
}

export default PrimitiveItem;
