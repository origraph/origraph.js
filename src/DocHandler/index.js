import xmlJs from 'xml-js';
import { createParser } from 'scalpel';
import mureInteractivityRunnerText from './mureInteractivityRunner.text.js'; // eslint-disable-line no-unused-vars
import defaultSvgDocTemplate from './default.text.svg';
import minimumSvgDoc from './minimum.text.svg';

// sneakily embed the interactivity-running script
const defaultSvgDoc = defaultSvgDocTemplate.replace(/\${mureInteractivityRunnerText}/, mureInteractivityRunnerText);

class DocHandler {
  /**
   *
   */
  constructor () {
    this.selectorParser = createParser();
    // todo: for efficiency, I should rename all of xml-js's default (lengthy!) key names
    this.keyNames = {};
    this.json2xmlSettings = Object.assign({
      'compact': false,
      'indentCdata': true
    }, this.keyNames);
    this.xml2jsonSettings = Object.assign({
      'compact': false,
      'nativeType': true,
      'alwaysArray': true,
      'addParent': true
    }, this.keyNames);
    this.defaultJsonDoc = this.xml2json(defaultSvgDoc);
    this.minimumJsDoc = this.xml2js(minimumSvgDoc);
  }
  xml2js (text) { return xmlJs.xml2js(text, this.xml2jsonSettings); }
  xml2json (text) { return xmlJs.xml2json(text, this.xml2jsonSettings); }
  json2xml (text) { return xmlJs.json2xml(text, this.json2xmlSettings); }
  js2xml (text) { return xmlJs.js2xml(text, this.json2xmlSettings); }
  standardize (testObj, standardObj) {
    if (!standardObj) {
      if (!testObj._id) {
        throw new Error('You must at least supply an id to standardize the document');
      }
      testObj.currentSelection = testObj.currentSelection || null;
      testObj.contents = this.standardize(testObj.contents || {}, this.minimumJsDoc);
    } else {
      // TODO
    }
    return testObj;
  }
  iterate (obj, callback) {
    const nodes = [];
    nodes.push(obj);
    do {
      obj = nodes.shift();
      callback(obj);
      if (obj.elements) {
        nodes.unshift(...obj.elements);
      }
    } while (nodes.length > 0);
  }
  matchObject (obj, queryTokens) {
    // TODO
  }
  selectAll (root, selector) {
    const queryTokens = this.selectorParser.parse(selector);
    const elements = [];
    this.iterate(root, obj => {
      if (this.matchObject(obj, queryTokens)) {
        elements.push(obj);
      }
    });
    return elements;
  }
}

export default new DocHandler();
