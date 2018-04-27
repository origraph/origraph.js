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
            passed: uploadMessage.ok,
            details: uploadMessage.ok
              ? undefined : 'Message:\n' + JSON.stringify(uploadMessage, null, 2)
          }
        });

        // Add classes, and interpet hands, tricks, and cards as nodes
        let doc = mure.selectDoc('application/json;hearts_schema.json');
        let hands = doc.selectAll('@$.contents.hands[*]')
          .addClass('player')
          .setInterpretation(mure.INTERPRETATIONS.node);
        let tricks = doc.selectAll('@$.contents.tricks[*]')
          .addClass('trick')
          .setInterpretation(mure.INTERPRETATIONS.node);
        let cards = doc.selectAll('@$.contents.hands[*][*]')
          .addClass('card')
          .setInterpretation(mure.INTERPRETATIONS.node);
        await hands.save();
        await tricks.save();
        await cards.save();

        let allClasses = Object.values(await doc.select('@$.classes').items())[0].value;

        tests.push({
          name: 'Add player, trick, and card classes',
          result: logging.testObjectEquality(schemaResults.allClasses1, allClasses)
        });

        let handItems = await hands.items();
        let trickItems = await tricks.items();
        let cardItems = await cards.items();

        const handsAreNodes = Object.values(handItems)
          .reduce((agg, item) => agg && !!item.value.$edges, true);
        const tricksAreNodes = Object.values(trickItems)
          .reduce((agg, item) => agg && !!item.value.$edges, true);
        const cardsAreNodes = Object.values(cardItems)
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

        // Add edges
        await tricks.connect(hands,
          (trick, hand) => {
            return trick.value.winner === hand.label;
          },
          {
            directed: true,
            className: 'Won By'
          }).save();
        await cards.connect(tricks,
          (card, trick) => {
            return Object.entries(trick.value)
              .filter(([player, index]) => {
                return card.doc.contents.hands[player] !== undefined &&
                  card.doc.contents.hands[player][index] === card;
              }).length > 0;
          },
          {
            directed: true,
            className: 'Played'
          }).save();

        allClasses = Object.values(await doc.select('@$.classes').items())[0].value;

        tests.push({
          name: 'Add "Won By" and "Played" edges',
          result: logging.testObjectEquality(schemaResults.allClasses2, allClasses)
        });

        // TODO: test schema summary functions

        resolve(tests);
      })();
    });
  }
];
