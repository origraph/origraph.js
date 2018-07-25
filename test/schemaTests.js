const mure = require('../dist/mure.cjs.js');

const heartsSchema = require('./data/hearts_for_schema_tests.json');
const schemaResults = require('./data/schemaResults.json');

describe('Schema Tests', () => {
  beforeAll(async () => {
    if (!mure.db) {
      mure.getOrInitDb();
    }
    await mure.uploadString('hearts_schema.json', 'application/json', 'UTF-8', JSON.stringify(heartsSchema));
  });

  afterEach(async () => {
    await mure.db.destroy();
    delete mure.db;
  });

  test('(Crappy serial tests): interpret as nodes, add classes, and connect', async () => {
    expect.assertions(5);

    let doc = mure.selectDoc('application/json;hearts_schema.json');

    // Add classes, and interpet hands, tricks, and cards as nodes
    let hands = await doc.subSelect('.contents.hands[*]');
    await hands.convert({ context: 'Node' });
    await hands.assignClass({ className: 'player' });
    let tricks = await doc.subSelect('.contents.tricks[*]');
    await tricks.convert({ context: 'Node' });
    await tricks.assignClass({ className: 'trick' });
    let cards = await doc.subSelect('.contents.hands[*][*]');
    await cards.convert({ context: 'Node' });
    await cards.assignClass({ className: 'card' });

    // Check that the classes are what we expect
    let allClasses = await doc.subSelect('.classes');
    allClasses = Object.values(await allClasses.items())[0].value;

    expect(allClasses).toEqual(schemaResults.allClasses1);

    // Check that everything is nodes
    let handWrappers = await hands.items();
    let trickWrappers = await tricks.items();
    let cardWrappers = await cards.items();

    const handsAreNodes = Object.values(handWrappers)
      .reduce((agg, item) => agg && !!item.value.$edges, true);
    expect(handsAreNodes).toBeTruthy();

    const tricksAreNodes = Object.values(trickWrappers)
      .reduce((agg, item) => agg && !!item.value.$edges, true);
    expect(tricksAreNodes).toBeTruthy();

    const cardsAreNodes = Object.values(cardWrappers)
      .reduce((agg, item) => agg && !!item.value.$edges, true);
    expect(cardsAreNodes).toBeTruthy();

    // Add Won By edges
    let orphans = await doc.subSelect('.orphans');
    orphans = Object.values(await orphans.items())[0];
    const wonByEdges = await tricks.connect({
      context: 'Target Container',
      targets: hands,
      sourceAttribute: 'winner',
      targetAttribute: null,
      directed: 'Directed',
      saveEdgesIn: orphans
    });
    await wonByEdges.assignClass({ className: 'Won By' });

    // Add Played edges
    orphans = await doc.subSelect('.orphans');
    orphans = Object.values(await orphans.items())[0];
    const playedEdges = await cards.connect({
      context: 'Bipartite',
      sources: cards,
      targets: tricks,
      mode: 'Function',
      connectWhen: (card, trick) => {
        return Object.entries(trick.value)
          .filter(([player, index]) => {
            return card.doc.contents.hands[player] !== undefined &&
              card.doc.contents.hands[player][index] === card.value;
          }).length > 0;
      },
      directed: 'Directed',
      saveEdgesIn: orphans
    });
    const dummyPromise = playedEdges.assignClass({ className: 'Played' });
    await dummyPromise;

    // Make sure the classes are what we expect
    allClasses = await doc.subSelect('.classes');
    allClasses = Object.values(await allClasses.items())[0].value;

    expect(allClasses).toEqual(schemaResults.allClasses2);
  });
});
