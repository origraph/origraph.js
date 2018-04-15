let process = require('process');
let fs = require('fs');

let nPlayers = process.argv[2] || 4;
let outFile = process.argv[3] || 'hearts.json';

let suits = ['♣', '♦', '♠', '♥'];
let values = [2, 3, 4, 5, 6, 7, 8, 9, 'J', 'Q', 'K', 'A'];

let allCards = [];
suits.forEach(suit => {
  values.forEach(value => {
    allCards.push({ suit, value });
  });
});

console.log('shuffling...');
for (let i = allCards.length - 1; i > 0; i--) {
  let j = Math.floor(Math.random() * (i + 1));
  let temp = allCards[i];
  allCards[i] = allCards[j];
  allCards[j] = temp;
}

console.log('dealing...');
let output = {
  hands: {},
  tricks: []
};
let currentPlayerNo = null;
let nTricks = 0;
while (allCards.length > 0) {
  if (allCards.length < nPlayers) {
    if (currentPlayerNo === null) {
      throw new Error('♣2 wound up in the kitty; try running again');
    }
    output.kitty = allCards;
    break;
  }
  nTricks++;
  for (let i = 1; i <= nPlayers; i++) {
    let hand = output.hands['Player ' + i] || [];
    let card = allCards.shift();
    if (card.suit === '♣' && card.value === 2) {
      currentPlayerNo = i;
    }
    hand.push(card);
    output.hands['Player ' + i] = hand;
  }
}

console.log('sorting each hand...');
function compareWrappers (a, b) {
  return values.indexOf(a.card.value) - values.indexOf(b.card.value);
}
let tempHands = {};
Object.keys(output.hands).forEach(player => {
  tempHands[player] = {};
  suits.forEach(suit => {
    tempHands[player][suit] = output.hands[player]
      .map((card, index) => { return { player, card, index }; })
      .filter(wrapper => wrapper.card.suit === suit)
      .sort(compareWrappers);
  });
});

console.log('playing...');
function playCard (trickNo, player) {
  // stupidly pick the lowest card that we can
  if (output.tricks[trickNo]) {
    let suit = output.tricks[trickNo].wrappers[0].card.suit;
    if (tempHands[player][suit].length > 0) {
      let wrapper = tempHands[player][suit].shift();
      output.tricks[trickNo].wrappers.push(wrapper);
      return wrapper;
    }
  } else {
    output.tricks.push({ wrappers: [] });
  }
  for (let i = 0; i < suits.length; i++) {
    let suit = suits[i];
    if (tempHands[player][suit].length > 0) {
      let wrapper = tempHands[player][suit].shift();
      output.tricks[trickNo].wrappers.push(wrapper);
      return wrapper;
    }
  }
  throw new Error("Wasn't able to play a card");
}
function trickWinner (wrapper) {
  let suit = wrapper[0].card.suit;
  let matchingWrappers = wrapper.filter(wrapper => wrapper.card.suit === suit)
    .sort(compareWrappers);
  let winningPlayer = matchingWrappers[matchingWrappers.length - 1];
  return parseInt(/Player (\d+)/.exec(winningPlayer.player)[1]);
}
for (let trickNo = 0; trickNo < nTricks; trickNo++) {
  let playerNo = currentPlayerNo;
  while (playerNo <= nPlayers) {
    playCard(trickNo, 'Player ' + playerNo);
    playerNo += 1;
  }
  playerNo = 1;
  while (playerNo < currentPlayerNo) {
    playCard(trickNo, 'Player ' + playerNo);
    playerNo += 1;
  }
  currentPlayerNo = trickWinner(output.tricks[trickNo].wrappers);
  output.tricks[trickNo].winner = 'Player ' + currentPlayerNo;
}

console.log('reshaping tricks...');
output.tricks.forEach(trick => {
  trick.wrappers.forEach(wrapper => {
    trick[wrapper.player] = `@$.contents.hands['${wrapper.player}']['${wrapper.index}']`;
  });
  delete trick.wrappers;
});

fs.writeFile(outFile, JSON.stringify(output, null, 2), 'utf8', () => { console.log('file written'); });
