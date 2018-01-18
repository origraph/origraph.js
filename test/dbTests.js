const assert = require('assert');
const mure = require('../dist/mure.cjs.js');

const tests = [
  {
    execute: () => {
      let svg = mure.d3n.createSVG(500, 500);
      svg.append('g');
      svg.select('g').classed('test', true);
      assert.equal(mure.d3n.svgString(),
        '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><g class="test"></g></svg>');
    }
  }
];

tests.forEach(test => test.execute());
