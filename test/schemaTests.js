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

        // Add classes
        let doc = mure.selectDoc('application/json;hearts_schema.json');
        let hands = doc.selectAll('@$.contents.hands[*]')
          .addClass('player');
        let tricks = doc.selectAll('@$.contents.tricks[*]')
          .addClass('trick');
        let cards = doc.selectAll('@$.contents.hands[*][*]')
          .addClass('card');
        await hands.save();
        await tricks.save();
        await cards.save();

        let allClasses = Object.values(await doc.select('@$.classes').items())[0].value;

        tests.push({
          name: 'Add player, trick, and card classes',
          result: logging.testObjectEquality(schemaResults.allClasses1, allClasses)
        });

        // Add edges
        let wonBy = tricks.connect(hands, {
          connectWhen: (trick, hand) => {
            return trick.value.winner === hand.label;
          },
          directed: true,
          className: 'Won By'
        });
        await wonBy.save();
        let played = cards.connect(tricks, {
          connectWhen: (card, trick) => {
            return trick[card.parent.label] === card.label;
          },
          directed: true,
          className: 'Played'
        });
        await played.save();

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
