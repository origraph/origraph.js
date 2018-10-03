const origraph = require('../dist/origraph.cjs.js');
const pkg = require('../package.json');

describe('Basic Tests', () => {
  test('Version check', () => {
    expect(pkg.version).toBe(origraph.version);
  });
});
