const mure = require('../dist/mure.cjs.js');
const pkg = require('../package.json');

test('Version check', () => {
  expect(pkg.version).toBe(mure.version);
});

test('DB Status: synced === false', async () => {
  expect.assertions(1);
  expect((await mure.dbStatus).synced).toBe(false);
});

test('DB Status: indexed === true', async () => {
  expect.assertions(1);
  expect((await mure.dbStatus).indexed).toBe(true);
});

test('DB Status: linkedUserSelection === true', async () => {
  expect.assertions(1);
  expect((await mure.dbStatus).linkedUserSelection).toBe(true);
});

test('DB Status: linkedViewSettings === true', async () => {
  expect.assertions(1);
  expect((await mure.dbStatus).linkedViewSettings).toBe(true);
});

test('Simple d3n test', () => {
  let svg = mure.d3n.createSVG(500, 500);
  svg.append('g');
  svg.select('g').classed('test', true);
  expect(mure.d3n.svgString())
    .toMatch('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><g class="test"></g></svg>');
});
