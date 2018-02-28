import datalib from 'datalib';
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
    this.defaultSvgDoc = this.parseXml(defaultSvgDoc);
    this.minimumSvgDoc = this.parseXml(minimumSvgDoc);
  }
  parseXml (xml) {
    // TODO
  }
  parseTabular (csv, datalibOptions) {
    datalibOptions = datalibOptions || {type: 'dsv', parse: 'auto'};
    return datalib.read(csv, datalibOptions);
  }
  parseJson (json, datalibOptions) {
    datalibOptions = datalibOptions || {type: 'json', parse: 'auto'};
    return datalib.read(json, datalibOptions);
  }
  standardizeSvg (testObj, standardObj) {
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
