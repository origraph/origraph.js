const mure = require('../dist/mure.cjs.js');
mure.debug = true;

const hearts = require('./data/hearts.json');

describe('Token Tests', () => {
  beforeAll(async () => {
    await mure.addStaticDataSource('hearts.json', hearts);
  });

  afterAll(() => {
    mure.removeDataSource('hearts.json');
  });

  test('EvaluateToken', async () => {
    expect.assertions(1);

    const stream = mure.stream({
      selector: `root.values('hearts.json').values('tricks').values().values().evaluate()`
    });
    const result = [];
    for await (const card of stream.sample({ limit: 5 })) {
      result.push(card.rawItem);
    }
    expect(result).toEqual([
      {'suit': '♣', 'value': 2},
      {'suit': '♣', 'value': 5},
      {'suit': '♣', 'value': 3},
      {'suit': '♣', 'value': 4},
      {'suit': '♣', 'value': 6}
    ]);
  });
});
