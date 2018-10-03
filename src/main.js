import Origraph from './Origraph.js';
import pkg from '../package.json';
import FileReader from 'filereader';

let origraph = new Origraph(FileReader, null);
origraph.version = pkg.version;

export default origraph;
