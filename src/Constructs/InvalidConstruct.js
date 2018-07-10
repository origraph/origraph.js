import jsonPath from 'jsonpath';
import BaseConstruct from './BaseConstruct.js';

class InvalidConstruct extends BaseConstruct {
  constructor ({ mure, value, path, doc }) {
    let parent;
    if (path.length < 2) {
      parent = null;
    } else if (path.length === 2) {
      parent = doc;
    } else {
      let temp = jsonPath.stringify(path.slice(1, path.length - 1));
      parent = jsonPath.value(doc, temp);
    }
    const docPathQuery = path[0] || '';
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
  }
  stringValue () {
    return 'Invalid: ' + String(this.value);
  }
}
InvalidConstruct.JSTYPE = 'object';

export default InvalidConstruct;
