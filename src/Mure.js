import mime from 'mime-types';
import datalib from 'datalib';
import sha1 from 'sha1';
import TriggerableMixin from './Common/TriggerableMixin.js';
import Stream from './Stream.js';
import * as TOKENS from './Tokens/Tokens.js';
import * as CLASSES from './Classes/Classes.js';
import * as WRAPPERS from './Wrappers/Wrappers.js';
import * as INDEXES from './Indexes/Indexes.js';

class Mure extends TriggerableMixin(class {}) {
  constructor (FileReader) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node
    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set mure.debug to true to debug streams

    // Object containing each of our data sources
    this.root = {};
    this.classes = {};

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

    // Access to core classes via the main library helps avoid circular imports
    this.TOKENS = TOKENS;
    this.CLASSES = CLASSES;
    this.WRAPPERS = WRAPPERS;
    this.INDEXES = INDEXES;

    // Monkey-patch available tokens as functions onto the Stream class
    for (const tokenClassName in this.TOKENS) {
      const TokenClass = this.TOKENS[tokenClassName];
      Stream.prototype[TokenClass.lowerCamelCaseType] = function (argList, options) {
        return this.extend(TokenClass, argList, options);
      };
    }

    // Default named functions
    this.NAMED_FUNCTIONS = {
      identity: function * (wrappedParent) { yield wrappedParent.rawItem; },
      key: function * (wrappedParent) {
        const parentType = typeof wrappedParent.rawItem;
        if (!(parentType === 'number' || parentType === 'string')) {
          throw new TypeError(`Parent isn't a key / index`);
        } else if (!wrappedParent.wrappedParent ||
            typeof wrappedParent.wrappedParent.rawItem !== 'object') {
          throw new TypeError(`Parent is not an object / array`);
        } else {
          yield wrappedParent.rawItem;
        }
      },
      defaultFinish: function * (thisWrappedItem, otherWrappedItem) {
        yield [
          thisWrappedItem.rawItem,
          otherWrappedItem.rawItem
        ];
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    };
  }

  parseSelector (selectorString) {
    if (!selectorString.startsWith('root')) {
      throw new SyntaxError(`Selectors must start with 'root'`);
    }
    const tokenStrings = selectorString.match(/\.([^(]*)\(([^)]*)\)/g);
    if (!tokenStrings) {
      throw new SyntaxError(`Invalid selector string: ${selectorString}`);
    }
    const tokenClassList = [{
      TokenClass: this.TOKENS.RootToken
    }];
    tokenStrings.forEach(chunk => {
      const temp = chunk.match(/^.([^(]*)\(([^)]*)\)/);
      if (!temp) {
        throw new SyntaxError(`Invalid token: ${chunk}`);
      }
      const tokenClassName = temp[1][0].toUpperCase() + temp[1].slice(1) + 'Token';
      const argList = temp[2].split(/(?<!\\),/).map(d => {
        d = d.trim();
        return d === '' ? undefined : d;
      });
      if (tokenClassName === 'ValuesToken') {
        tokenClassList.push({
          TokenClass: this.TOKENS.KeysToken,
          argList
        });
        tokenClassList.push({
          TokenClass: this.TOKENS.ValueToken
        });
      } else if (this.TOKENS[tokenClassName]) {
        tokenClassList.push({
          TokenClass: this.TOKENS[tokenClassName],
          argList
        });
      } else {
        throw new SyntaxError(`Unknown token: ${temp[1]}`);
      }
    });
    return tokenClassList;
  }

  stream (options) {
    options.mure = this;
    options.tokenClassList = this.parseSelector(options.selector || `root.values()`);
    return new Stream(options);
  }

  newClass (options = { selector: `root.values()` }) {
    if (this.classes[options.selector]) {
      return this.classes[options.selector];
    }
    const ClassType = options.ClassType || this.CLASSES.GenericClass;
    delete options.ClassType;
    options.mure = this;
    this.classes[options.selector] = new ClassType(options);
    return this.classes[options.selector];
  }

  async addFileAsStaticDataSource ({
    fileObj,
    encoding = mime.charset(fileObj.type),
    extensionOverride = null,
    skipSizeCheck = false
  } = {}) {
    const fileMB = fileObj.size / 1048576;
    if (fileMB >= 30) {
      if (skipSizeCheck) {
        console.warn(`Attempting to load ${fileMB}MB file into memory`);
      } else {
        throw new Error(`${fileMB}MB file is too large to load statically; try addDynamicDataSource() instead.`);
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
      if (extension === 'csv' || extension === 'tsv') {
        delete obj.columns;
      }
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
    this.root[key] = obj;
    return this.newClass({
      selector: `root.values('${key}').values()`
    });
  }

  removeDataSource (key) {
    delete this.root[key];
  }
}

export default Mure;
