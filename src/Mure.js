import mime from 'mime-types';
import datalib from 'datalib';
import { Model } from 'uki';
import Selection from './Selection.js';
import * as TOKENS from './Tokens/Tokens.js';
import * as OPERATIONS from './Operations/Operations.js';

class Mure extends Model {
  constructor (FileReader) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node
    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    // Object containing each of our data sources
    this.root = {
      '⌘graph': {
        'containerSelectors': ['@$[*]'],
        '⌘nodes': {},
        '⌘edges': {},
        '⌘classes': {},
        '⌘groups': {}
      }
    };

    // extensions that we want datalib to handle
    this.DATALIB_FORMATS = {
      'json': 'json',
      'csv': 'csv',
      'tsv': 'tsv',
      'topojson': 'topojson',
      'treejson': 'treejson'
    };

    // Modes for deriving selections
    this.DERIVE_MODES = {
      REPLACE: 'REPLACE',
      UNION: 'UNION',
      XOR: 'XOR'
    };

    // Access to core classes available via the main library helps avoid
    // circular imports, as well as enabling external tools to do things like
    // instanceof
    this.TOKENS = TOKENS;

    // Unlike the other core classes, we actually want to instantiate all the
    // operations with a reference to this. While we're at it, monkey patch them
    // onto the Selection class
    this.OPERATIONS = {};
    Object.values(OPERATIONS).forEach(Operation => {
      const temp = new Operation(this);
      this.OPERATIONS[temp.type] = temp;
      Selection.prototype[temp.lowerCamelCaseType] = async function (inputOptions) {
        return this.execute(temp, inputOptions);
      };
    });

    // Auto-mappings from native javascript types to Wrappers
    this.JSTYPES = {
      'null': this.WRAPPERS.NullWrapper,
      'boolean': this.WRAPPERS.BooleanWrapper,
      'number': this.WRAPPERS.NumberWrapper
    };
  }
  selectAll (selectorList) {
    return new Selection(this, selectorList);
  }
  parseSelector (selectorString) {
    if (selectorString[0] !== '@') {
      return null;
    }
    selectorString = selectorString.slice(1);
    const tokenList = [];
    while (selectorString.length > 0) {
      const initialLength = selectorString.length;
      for (let Token in this.TOKENS) {
        const temp = selectorString.match(Token.REGEX);
        if (temp) {
          tokenList.push(new Token(temp[1]));
          selectorString = selectorString.slice(temp[0].length);
          break;
        }
      }
      if (selectorString.length >= initialLength) {
        return null;
      }
    }
    return tokenList;
  }
  pathToSelector (path) {
    if (!path[0] === this.root) {
      throw new Error('Path does not begin with root');
    }
    let result = '@$';
    path.slice(1, path.length - 1).forEach(obj => {
      const objType = typeof obj;
      if (objType === 'string' || objType === 'number') {
        result += `['${obj}']`;
      } else if (objType === 'object') {
        result += '→';
      }
    });
    return result;
  }

  // TODO: continue here!

  inferType (value, aggressive = false) {
    const jsType = typeof value;
    if (this.JSTYPES[jsType]) {
      return this.JSTYPES[jsType];
    } else if (jsType === 'string') {
      // Attempt to parse as a reference
      if (value[0] === '@' && this.parseSelector(value) !== null) {
        return this.WRAPPERS.ReferenceWrapper;
      }
      // Not a reference...
      if (aggressive) {
        // Aggressively attempt to identify something more specific than string
        if (!isNaN(Number(value))) {
          return this.WRAPPERS.NumberWrapper;
        /*
         For now, we don't attempt to identify dates, even in aggressive mode,
         because things like new Date('Player 1') will successfully parse as a
         date. If we can find smarter ways to auto-infer dates (e.g. does the
         value fall suspiciously near the unix epoch, y2k, or more than +/-500
         years from now? Do sibling container items parse this as a date?), then
         maybe we'll add this back...
        */
        // } else if (!isNaN(new Date(value))) {
        //  return WRAPPERS.DateWrapper;
        } else {
          const temp = value.toLowerCase();
          if (temp === 'true') {
            return this.WRAPPERS.BooleanWrapper;
          } else if (temp === 'false') {
            return this.WRAPPERS.BooleanWrapper;
          } else if (temp === 'null') {
            return this.WRAPPERS.NullWrapper;
          }
        }
      }
      // Okay, it's just a string
      return this.WRAPPERS.StringWrapper;
    } else if (jsType === 'function' || jsType === 'symbol' || jsType === 'undefined' || value instanceof Array) {
      return this.WRAPPERS.InvalidWrapper;
    } else if (value === null) {
      return this.WRAPPERS.NullWrapper;
    } else if (value instanceof Date || value.$isDate === true) {
      return this.WRAPPERS.DateWrapper;
    } else if (value.$nodes) {
      return this.WRAPPERS.EdgeWrapper;
    } else if (value.$edges) {
      if (value.$members) {
        return this.WRAPPERS.SupernodeWrapper;
      } else {
        return this.WRAPPERS.NodeWrapper;
      }
    } else if (value.$members) {
      return this.WRAPPERS.SetWrapper;
    } else if (value.$tags) {
      return this.WRAPPERS.GenericWrapper;
    } else {
      return this.WRAPPERS.ContainerWrapper;
    }
  }
  async followRelativeLink (selector, doc) {
    // This selector specifies to follow the link
    if (typeof selector !== 'string') {
      return [];
    }
    let docQuery = this.extractDocQuery(selector);
    let crossDoc;
    if (!docQuery) {
      selector = `@{"_id":"${doc._id}"}${selector.slice(1)}`;
      crossDoc = false;
    } else {
      crossDoc = docQuery._id !== doc._id;
    }
    let tempSelection;
    try {
      tempSelection = new Selection(this, selector);
    } catch (err) {
      if (err.INVALID_SELECTOR) {
        return [];
      } else {
        throw err;
      }
    }
    let docLists = crossDoc ? await tempSelection.docLists() : [[ doc ]];
    return tempSelection.items(docLists);
  }

  // TODO: port these to Operations

  async addFileAsStaticDataSource ({
    fileObj,
    encoding = mime.charset(fileObj.type),
    extensionOverride = null,
    skipSizeCheck = false
  } = {}) {
    const fileMB = fileObj.size / 1048576;
    if (fileMB >= 5) {
      if (skipSizeCheck) {
        console.warn(`Attempting to load ${fileMB}MB file into localStorage`);
      } else {
        throw new Error(`Can't load ${fileMB}MB file into the browser; try addDynamicDataSource() instead.`);
      }
    }
    // extensionOverride allows things like topojson or treejson (that don't
    // have standardized mimeTypes) to be parsed correctly
    let text = await new Promise((resolve, reject) => {
      let reader = new this.FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsText(fileObj, encoding);
    });
    return this.addStringAsStaticDataSource({
      key: fileObj.name,
      extension: extensionOverride || mime.extension(fileObj.type),
      text
    });
  }
  async addStringAsStaticDataSource ({
    key,
    extension = 'txt',
    text
  }) {
    let obj;
    if (this.DATALIB_FORMATS[extension]) {
      obj = datalib.read(text, { type: extension });
    } else if (extension === 'xml') {
      throw new Error('unimplemented');
    } else if (extension === 'txt') {
      throw new Error('unimplemented');
    } else {
      throw new Error(`Unsupported file extension: ${extension}`);
    }
    return this.addStaticDataSource(key, obj);
  }
  async addStaticDataSource (key, obj) {

    throw new Error('unimplemented');
  }
}

export default Mure;
