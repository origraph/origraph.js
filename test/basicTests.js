const mure = require('../dist/mure.cjs.js');
const pkg = require('../package.json');

describe('Basic Tests', () => {
  test('Version check', () => {
    expect(pkg.version).toBe(mure.version);
  });

  test('Simple d3n test', () => {
    let svg = mure.d3n.createSVG(500, 500);
    svg.append('g');
    svg.select('g').classed('test', true);
    expect(mure.d3n.svgString())
      .toMatch('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><g class="test"></g></svg>');
  });
});
