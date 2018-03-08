const logging = require('./logging.js');
const mure = require('../dist/mure.cjs.js');
const pkg = require('../package.json');

module.exports = [
  async () => {
    return Promise.resolve([{
      name: 'Version check',
      result: logging.testStringEquality(pkg.version, mure.version)
    }]);
  },
  async () => {
    let svg = mure.d3n.createSVG(500, 500);
    svg.append('g');
    svg.select('g').classed('test', true);
    return Promise.resolve([{
      name: 'Simple d3n test',
      result: logging.testStringEquality(mure.d3n.svgString(),
        '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><g class="test"></g></svg>')
    }]);
  }
];