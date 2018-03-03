import { createParser } from 'scalpel';

class Selection {
  constructor (selector, context) {
    let parser = createParser();
    this.queryTokens = parser.parse(selector);
    this.context = context;
  }
  iterate (callback) {
    /*
    if (selector instanceof Selection)
    const queryTokens = this.selectorParser.parse(selector);
    const elements = [];
    this.iterateObj(root, obj => {
      if (this.matchObject(obj, queryTokens)) {
        elements.push(obj);
      }
    });
    return elements;
    */
  }
  iterateObj (obj, callback) {
    /*
    const nodes = [];
    nodes.push(obj);
    do {
      obj = nodes.shift();
      callback(obj);
      if (obj.elements) {
        nodes.unshift(...obj.elements);
      }
    } while (nodes.length > 0);
    */
  }
  matchObject (obj, queryTokens) {
    // TODO
  }
}
export default Selection;
