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
      {'suit': '♦', 'value': 4},
      {'suit': '♣', 'value': 5},
      {'suit': '♣', 'value': 3},
      {'suit': '♣', 'value': 'J'}
    ]);
  });

  test('PromoteToken', async () => {
    expect.assertions(2);

    const stream = mure.stream({
      selector: `root.values('hearts.json').values('hands').values().values()
                 .values('suit').promote(wrapSuit,,addToSuitCount)`,
      namedFunctions: {
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

    // We expect 13 cards of each suit
    expect(suits).toEqual([
      {'count': 13, 'suit': '♣'},
      {'count': 13, 'suit': '♠'},
      {'count': 13, 'suit': '♦'},
      {'count': 13, 'suit': '♥'}
    ]);
    jest.runAllTimers();
    // We expect 12 callbacks (the first seen card doesn't have a callback)
    expect(notificationCounts).toEqual({
      '♠': 12,
      '♣': 12,
      '♥': 12,
      '♦': 12
    });
  });

  test('JoinToken (no indexes)', async () => {
    expect.assertions(1);

    const winnerStream = mure.stream({
      selector: `root.values('hearts.json').values('tricks').values()`
    });
    const joinedStream = mure.stream({
      selector: `root.values('hearts.json').values('hands').values().join(winnerStream,key,getWinner,finish)`,
      namedStreams: { winnerStream },
      namedFunctions: {
        getWinner: function * (trick) {
          yield trick.rawItem.winner;
        },
        finish: function * (hand, trick) {
          yield `${hand.wrappedParent.rawItem} won Trick ${trick.wrappedParent.rawItem}`;
        }
      }
    });

    const joinedResults = [];
    for await (const winningPlayer of joinedStream.sample({ limit: 10 })) {
      joinedResults.push(winningPlayer.rawItem);
    }

    expect(joinedResults).toEqual([
      'Player 1 won Trick 0',
      'Player 1 won Trick 1',
      'Player 1 won Trick 2',
      'Player 4 won Trick 3',
      'Player 1 won Trick 4',
      'Player 1 won Trick 5',
      'Player 4 won Trick 6',
      'Player 4 won Trick 7',
      'Player 3 won Trick 8',
      'Player 3 won Trick 9'
    ]);
  });
});
