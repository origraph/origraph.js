const mure = require('../dist/mure.cjs.js');
const pkg = require('../package.json');

describe('Basic Tests', () => {
  test('Version check', () => {
    expect(pkg.version).toBe(mure.version);
  });
});
