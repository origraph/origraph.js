import Origraph from './Origraph.js';
import pkg from '../package.json';

let origraph = new Origraph(null);
origraph.version = pkg.version;

export default origraph;
