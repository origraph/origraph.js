const mure = require('../dist/mure.cjs.js');
mure.debug = true;

const hearts = require('./data/hearts.json');

describe('Token Tests', () => {
  beforeAll(async () => {
    jest.useFakeTimers();
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

  test('PromoteToken', async () => {
    expect.assertions(2);

    const stream = mure.stream({
      selector: `root.values('hearts.json').values('hands').values().values()
                 .values('suit').promote(wrapSuit,,addToSuitCount)`,
      functions: {
        wrapSuit: function * (wrappedItem) {
          yield { suit: wrappedItem.rawItem, count: 1 };
        },
        addToSuitCount: (originalWrappedItem, newRawItem) => {
          originalWrappedItem.rawItem.count += 1;
        }
      }
    });

    const suits = [];
    const notificationCounts = {};
    for await (const wrappedSuit of stream.sample({ limit: Infinity })) {
      suits.push(wrappedSuit.rawItem);
      notificationCounts[wrappedSuit.rawItem.suit] = 0;
      wrappedSuit.on('update', () => {
        notificationCounts[wrappedSuit.rawItem.suit] += 1;
      });
    }

    // We expect 12 cards of each suit
    expect(suits).toEqual([
      {'count': 12, 'suit': '♥'},
      {'count': 12, 'suit': '♦'},
      {'count': 12, 'suit': '♠'},
      {'count': 12, 'suit': '♣'}
    ]);
    jest.runAllTimers();
    // We expect 11 callbacks (the first seen card doesn't have a callback)
    expect(notificationCounts).toEqual({
      '♠': 11,
      '♣': 11,
      '♥': 11,
      '♦': 11
    });
  });
});
