const logging = require('./logging.js');
const mure = require('../dist/mure.cjs.js');
require('events').EventEmitter.defaultMaxListeners = 30;

module.exports = [
  async () => {
    return new Promise((resolve, reject) => {
      const data = require('./data/hearts_for_schema_tests');
      const schemaResults = require('./data/schemaResults');

      (async () => {
        let tests = [];

        let uploadMessage = await mure.uploadString(
          'hearts_schema.json', 'application/json', 'UTF-8',
          JSON.stringify(data));

        tests.push({
          name: 'Upload file for schema testing',
          result: {
            passed: !!uploadMessage
          }
        });

        // Add classes, and interpet hands, tricks, and cards as nodes
        let doc = mure.selectDoc('application/json;hearts_schema.json');
        let hands = await doc.subSelect('.contents.hands[*]');
        await hands.convert({ context: 'Node' });
        await hands.assignClass({ className: 'player' });
        let tricks = await doc.subSelect('.contents.tricks[*]');
        await tricks.convert({ context: 'Node' });
        await tricks.assignClass({ className: 'trick' });
        let cards = await doc.subSelect('.contents.hands[*][*]');
        await cards.convert({ context: 'Node' });
        await cards.assignClass({ className: 'card' });

        let allClasses = await doc.subSelect('.classes');
        allClasses = Object.values(await allClasses.items())[0].value;

        tests.push({
          name: 'Add player, trick, and card classes',
          result: logging.testObjectEquality(schemaResults.allClasses1, allClasses)
        });

        let handConstructs = await hands.items();
        let trickConstructs = await tricks.items();
        let cardConstructs = await cards.items();

        const handsAreNodes = Object.values(handConstructs)
          .reduce((agg, item) => agg && !!item.value.$edges, true);
        const tricksAreNodes = Object.values(trickConstructs)
          .reduce((agg, item) => agg && !!item.value.$edges, true);
        const cardsAreNodes = Object.values(cardConstructs)
          .reduce((agg, item) => agg && !!item.value.$edges, true);
        const allNodes = handsAreNodes && tricksAreNodes && cardsAreNodes;

        tests.push({
          name: 'Interpret players, tricks, and cards as nodes',
          result: {
            passed: allNodes,
            details: allNodes ? undefined : JSON.stringify({
              handsAreNodes,
              tricksAreNodes,
              cardsAreNodes
            }, null, 2)
          }
        });

        // Add Won By edges
        let orphans = await doc.subSelect('.orphans');
        orphans = Object.values(await orphans.items())[0];
        const wonByEdges = await tricks.connect({
          context: 'Bipartite',
          target: hands,
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
          target: tricks,
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

        allClasses = await doc.subSelect('.classes');
        allClasses = Object.values(await allClasses.items())[0].value;

        tests.push({
          name: 'Add "Won By" and "Played" edges',
          result: logging.testObjectEquality(schemaResults.allClasses2, allClasses)
        });

        // Test schema summary functions
        let allConstructs = await hands.mergeSelection(cards);
        allConstructs = await allConstructs.mergeSelection(tricks);
        allConstructs = await allConstructs.mergeSelection(wonByEdges);
        allConstructs = await allConstructs.mergeSelection(playedEdges);

        let summary = await allConstructs.getFlatGraphSchema();
        tests.push({
          name: 'Flat graph schema test',
          result: logging.testObjectEquality(schemaResults.flatGraphSchema, summary)
        });

        resolve(tests);
      })();
    });
  }
];
