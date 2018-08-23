import Mure from './Mure.js';
import pkg from '../package.json';
import FileReader from 'filereader';

let mure = new Mure(FileReader, null);
mure.version = pkg.version;

export default mure;
