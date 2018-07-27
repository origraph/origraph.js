import mime from 'mime-types';
import datalib from 'datalib';
import { Model } from 'uki';
import Selection from './Selection.js';
import * as TOKENS from './Tokens/Tokens.js';
import * as WRAPPERS from './Wrappers/Wrappers.js';
import * as OPERATIONS from './Operations/Operations.js';

class Mure extends Model {
  constructor (FileReader) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node
    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    // Object containing each of our data sources
    this.root = {
      '⌘overrides': {},
      '⌘mixins': {
        '⌘nodes': {},
        '⌘edges': {},
        '⌘classes': {}
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

    this.TRUTHY_STRINGS = {
      'true': true,
      'yes': true,
      'y': true
    };
    this.FALSEY_STRINGS = {
      'false': true,
      'no': true,
      'n': true
    };

    // Access to core classes available via the main library helps avoid
    // circular imports, as well as enabling external tools to do things like
    // instanceof
    this.TOKENS = TOKENS;
    this.WRAPPERS = WRAPPERS;

    // Auto-mappings from native javascript types to Wrappers
    this.JSTYPES = {
      'undefined': this.WRAPPERS.UndefinedWrapper,
      'null': this.WRAPPERS.NullWrapper,
      'boolean': this.WRAPPERS.BooleanWrapper,
      'number': this.WRAPPERS.NumberWrapper,
      'function': this.WRAPPERS.InvalidWrapper,
      'symbol': this.WRAPPERS.InvalidWrapper
    };

    // Helpers for looking up / assigning mixins
    this.WRAPPER_MIXINS = {
      '⌘nodes': this.WRAPPERS.NodeMixin,
      '⌘edges': this.WRAPPERS.EdgeMixin,
      '⌘classes': this.WRAPPERS.SetMixin
    };

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
  pathSupersedes (superPath, path) {
    return superPath && path && superPath.length === path.length &&
      superPath.every((token, i) => token.isSuperSetOf(path[i]));
  }
  wrap ({ value, path, metaData, aggressive = false }) {
    let WrapperClass;

    if (metaData['⌘overrides']) {
      // First check and see if the user has specified an override; if so, we
      // already know the base class. We should also standardize the value.
      WrapperClass = this.WRAPPERS[metaData['⌘overrides']];
      value = WrapperClass.standardize(value);
    } else {
      // Auto-infer the class, based on the value
      const jsType = typeof value;
      if (this.JSTYPES[jsType]) {
        WrapperClass = this.JSTYPES[jsType];
      } else if (jsType === 'string') {
        if (value[0] === '@' && this.parseSelector(value) !== null) {
          // Attempt to parse as a reference
          WrapperClass = this.WRAPPERS.ReferenceWrapper;
        } else if (aggressive) {
          // Aggressively attempt to identify something more specific than string
          if (!isNaN(Number(value))) {
            WrapperClass = this.WRAPPERS.NumberWrapper;
          /*
           For now, we don't attempt to identify dates, even in aggressive mode,
           because things like new Date('Player 1') will successfully parse as a
           date. If we can find smarter ways to auto-infer dates (e.g. does the
           value fall suspiciously near the unix epoch, y2k, or more than +/-500
           years from now? Are siblings consistently wrapped as a date?), then
           maybe we'll add this back...
          */
          // } else if (!isNaN(new Date(value))) {
          // value = new Date(value);
          // WrapperClass = this.WRAPPERS.DateWrapper;
          } else {
            const temp = value.toLowerCase();
            if (this.TRUTHY_STRINGS[temp]) {
              WrapperClass = this.WRAPPERS.BooleanWrapper;
            } else if (this.FALSEY_STRINGS[temp]) {
              WrapperClass = this.WRAPPERS.BooleanWrapper;
            } else if (temp === 'null') {
              WrapperClass = this.WRAPPERS.NullWrapper;
            }
          }
          // If we found something in aggressive mode, we need to standardize
          // the value
          if (WrapperClass) {
            value = WrapperClass.standardize(value);
          }
        }
        if (!WrapperClass) {
          // We couldn't infer anything else, so it's just a string
          WrapperClass = this.WRAPPERS.StringWrapper;
        }
      } else if (value instanceof Date) {
        WrapperClass = this.WRAPPERS.DateWrapper;
      } else {
        WrapperClass = this.WRAPPERS.GenericWrapper;
      }
    }

    // Now the fun part! Add any interperative mixins specified by the metadata
    for (let mixinType in (metaData['⌘mixins'] || {})) {
      if (this.WRAPPER_MIXINS[mixinType]) {
        WrapperClass = this.WRAPPER_MIXINS[mixinType](WrapperClass);
      }
    }

    // Finally, instantiate the class
    return new WrapperClass({ value, path, metaData });
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
