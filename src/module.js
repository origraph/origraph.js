import Mure from './Mure.js';
import pkg from '../package.json';

let mure = new Mure(window.FileReader, window.localStorage);
mure.version = pkg.version;

export default mure;
