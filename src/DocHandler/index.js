import datalib from 'datalib';
import { createParser } from 'scalpel';
import mureInteractivityRunnerText from './mureInteractivityRunner.text.js'; // eslint-disable-line no-unused-vars
import defaultSvgContentTemplate from './default.text.svg';
import minimumSvgContent from './minimum.text.svg';

// sneakily embed the interactivity-running script
const defaultSvgContent = defaultSvgContentTemplate.replace(/\${mureInteractivityRunnerText}/, mureInteractivityRunnerText);

class DocHandler {
  constructor () {
    this.selectorParser = createParser();
    // todo: for efficiency, I should rename all of xml-js's default (lengthy!) key names
    this.keyNames = {};
    this.defaultSvgContent = this.parseXml(defaultSvgContent);
    this.minimumSvgContent = this.parseXml(minimumSvgContent);
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
  formatDoc (doc) {
    // TODO
    return 'todo';
  }
  standardize (doc) {
    // TODO
    return {
      contents: doc
    };
  }
}

export default new DocHandler();
