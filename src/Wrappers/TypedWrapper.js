import jsonPath from 'jsonpath';
import BaseWrapper from './BaseWrapper.js';

class TypedWrapper extends BaseWrapper {
  constructor ({ mure, value, path, doc }) {
    let parent;
    if (path.length < 2) {
      throw new Error(`Can't create a non-Root or non-Doc Wrapper with a path length less than 2`);
    } else if (path.length === 2) {
      parent = doc;
    } else {
      let temp = jsonPath.stringify(path.slice(1, path.length - 1));
      parent = jsonPath.value(doc, temp);
    }
    const docPathQuery = path[0];
    const uniqueJsonPath = jsonPath.stringify(path.slice(1));
    super({
      mure,
      path,
      value,
      parent,
      doc,
      label: path[path.length - 1],
      uniqueSelector: '@' + docPathQuery + uniqueJsonPath
    });
    if (this.constructor.isBadValue(value)) {
      throw new TypeError(`typeof ${value} is ${typeof value}, which does not match required ${this.constructor.JSTYPE}`);
    }
  }
  get parentWrapper () {
    const ParentType = this.mure.inferType(this.parent);
    return new ParentType({
      mure: this.mure,
      value: this.parent,
      path: this.path.slice(0, this.path.length - 1),
      doc: this.doc
    });
  }
}
TypedWrapper.JSTYPE = 'object';
TypedWrapper.isBadValue = function (value) {
  return (typeof value) !== this.JSTYPE; // eslint-disable-line valid-typeof
};

export default TypedWrapper;
