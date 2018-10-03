import Origraph from './Origraph.js';
import pkg from '../package.json';

let origraph = new Origraph(window.FileReader, window.localStorage);
origraph.version = pkg.version;

export default origraph;
