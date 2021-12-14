/* eslint-disable max-len */
// main functions used by index.js or bollingerGenerator.js
// import { readFileSync } from 'fs';
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json').toString());

// instantiate LEGS and TF (timeframe)
const { FRONT_LEG } = config;
const { MID_LEG } = config;
const { BACK_LEG } = config;

// instantiate JOHANSEN VECTORS
const { FRONT_VECTOR } = config;
const { MIDDLE_VECTOR } = config;
const { BACK_VECTOR } = config;

function reauthenticator(token, websocket) {
  console.log('token expiry detected...');
  console.log('reauthenticating...');
  const reauthMsg = {
    jsonrpc: '2.0',
    id: 9929,
    method: 'public/auth',
    params: {
      grant_type: 'refresh_token',
      refresh_token: token,
    },
  };
  websocket.send(JSON.stringify(reauthMsg));
}

// returns Spread of last item in each leg's tick array
function spreadCalc(frontTicks, midTicks, backTicks) {
  // merge list of 3 arrays on common ticks
  // eslint-disable-next-line max-len
  const lastSpreadObject = {};

  const prelimArray = frontTicks.map((ft) => ({ ...ft, ...midTicks.find((mt) => mt.tick === ft.tick) }));

  // eslint-disable-next-line max-len
  const spreadArray = backTicks.map((bt) => ({ ...bt, ...prelimArray.find((sal1) => sal1.tick === bt.tick) }));

  let spread;
  const lastItem = spreadArray.length - 1;

  console.log('printing last item of spreadArray...');
  console.log(JSON.stringify(spreadArray[lastItem]));

  if (spreadArray.length >= 1) {
    const frontMultiple = spreadArray[lastItem][FRONT_LEG] * FRONT_VECTOR;
    const midMultiple = spreadArray[lastItem][MID_LEG] * MIDDLE_VECTOR;
    const backMultiple = spreadArray[lastItem][BACK_LEG] * BACK_VECTOR;

    // calculate the spread
    spread = frontMultiple + midMultiple + backMultiple;

    // create single object for eventual appending to array-list

    lastSpreadObject.tick = spreadArray[lastItem].tick;
    lastSpreadObject.spread = spread;

    if (spread !== null) {
      console.log(`current spread is ${spread}`);
      console.log(JSON.stringify(lastSpreadObject));
      return lastSpreadObject;
    } console.log('spread not yet fully formed, doing nothing.');
  }
}
// catches ticks that are fresh and not repeated in variable leg object so far
function freshTicker(message, legProcessedList) {
  // define a tick first
  // learnt how to define variable key into JS object
  // adapted from https://stackoverflow.com/questions/11508463/javascript-set-object-key-by-variable
  const tickDateTime = message.params.data.tick;
  let tickChannelName = message.params.channel.toString();

  if (tickChannelName.includes(FRONT_LEG)) {
    tickChannelName = FRONT_LEG;
  } else if (tickChannelName.includes(MID_LEG)) {
    tickChannelName = MID_LEG;
  } else {
    tickChannelName = BACK_LEG;
  }

  const tickClosePrice = message.params.data.close;
  const potentialTick = {};
  // assign tick-time, channel-name and close price to keys
  potentialTick.tick = tickDateTime;
  potentialTick[tickChannelName] = tickClosePrice;

  console.log('reviewing leg tick...');
  // console.log(tickDateTime);
  // console.log(tickClosePrice);
  console.log(JSON.stringify(potentialTick));

  // checking if some key exists in list of objects: https://stackoverflow.com/questions/8217419/how-to-determine-if-javascript-array-contains-an-object-with-an-attribute-that-e
  if (legProcessedList.some((item) => item.tick === tickDateTime) === false) {
    legProcessedList.push(potentialTick);
    console.log(`appending new candlestick to ${tickChannelName} list of arrays...`);
    console.log(`length of ${tickChannelName} candlesticks is now  ${legProcessedList.length}`);
  }
  else if (legProcessedList.some((item) => item.tick === tickDateTime) === true) {
    console.log(`repeat leg tick for ${JSON.stringify(potentialTick)}, doing nothing.`);
    console.log(`length of ${tickChannelName} candlesticks is still ${legProcessedList.length}`);
  }
}

// if ticks are fresh, get the timeframe specific candlesticks for the 3 legs
// and get the timeframe-specific spread
function candlesticker(message, frontLeg, midLeg, backLeg, frontTicks, midTicks, backTicks, spreadTicks) {
  let potentialSpread = {};
  let spreadTickDateTime;
  // let pureSpread;

  if (message.method === 'subscription') {
    console.log('processing candlesticks...');
    if (message.params.channel.includes(frontLeg)) {
      console.log(`${frontLeg} subscription message received`);
      freshTicker(message, frontTicks);
    }
    if (message.params.channel.includes(midLeg)) {
      console.log(`${midLeg} subscription message received`);
      freshTicker(message, midTicks);
    }
    if (message.params.channel.includes(backLeg)) {
      console.log(`${backLeg} subscription message received`);
      freshTicker(message, backTicks);
    }

    if (frontTicks.length === midTicks.length && midTicks.length === backTicks.length) {
      console.log(`length of ticklists: ${frontLeg}:${frontTicks.length}, ${midLeg}:${midTicks.length}, ${backLeg}:${backTicks.length}`);
      potentialSpread = spreadCalc(frontTicks, midTicks, backTicks);
      console.log('potentialSpread spread:');
      // pureSpread = potentialSpread.spread;
      // console.log(pureSpread);
      spreadTickDateTime = potentialSpread.tick;

      console.log('reviewing spread tick...');

      if (spreadTicks.some((entry) => entry.tick === spreadTickDateTime) === false) {
        spreadTicks.push(potentialSpread);
        console.log('appending new spread to list of spread arrays...');
        console.log(`length of spreadTicks is now  ${spreadTicks.length}`);
        // pureSpreads.push(pureSpread);
      } else if (spreadTicks.some((tick) => tick.tick === spreadTickDateTime) === true) {
        console.log(`repeat spread tick for ${JSON.stringify(potentialSpread)}, doing nothing.`);
        console.log(`length of spreadTicks is still ${spreadTicks.length}`);
      }
    }
  }
}

function timeConverter(unixTimestamp) {
  const a = new Date(unixTimestamp);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = a.getFullYear();
  const month = months[a.getMonth()];
  const date = a.getDate();
  const hour = a.getHours();
  const min = a.getMinutes();
  const sec = a.getSeconds();
  const time = `${date} ${month} ${year} ${hour}:${min}:${sec}`;
  return time;
}
// get the live spread right now
// function liveTickerSpreader(message, frontLeg, midLeg, backLeg) {
// function liveTickerSpreader(message, frontLeg, midLeg, backLeg, frontVector, midVector, backVector, frontAsk, frontBid, midBid, midAsk, backAsk, backBid) {
//   if (message.method === 'subscription') {
//     console.log('processing subscription ticks...');
//     if (message.params.channel.includes(frontLeg)) {
//       console.log(`${frontLeg} subscription message received`);
//       frontAsk = message.params.data.best_ask_price;
//       frontBid = message.params.data.best_bid_price;
//       console.log(`best price to buy ${frontLeg}: ${frontAsk}`);
//       console.log(`best price to sell ${frontLeg}: ${frontBid}`);
//     }
//     if (message.params.channel.includes(midLeg)) {
//       console.log(`${midLeg} subscription message received`);
//       midBid = message.params.data.best_bid_price;
//       midAsk = message.params.data.best_ask_price;
//       console.log(`best price to sell ${midLeg}: ${midBid}`);
//       console.log(`best price to buy ${midLeg}: ${midAsk}`);
//     }
//     if (message.params.channel.includes(backLeg)) {
//       console.log(`${backLeg} subscription message received`);
//       backAsk = message.params.data.best_ask_price;
//       backBid = message.params.data.best_bid_price;
//       console.log(`best price to buy ${backLeg}: ${backAsk}`);
//       console.log(`best price to sell ${backLeg}: ${backBid}`);
//     }
//   }

// if (typeof (frontAsk) === 'number' && typeof (midBid) === 'number' && typeof (backAsk) === 'number') {
// liveLongButterfly = (frontAsk * frontVector) + (midBid * midVector) + (backAsk * backVector);
// console.log(`live Long Butterfly: ${liveLongButterfly}`);

// liveShortButterfly === (frontBid * frontVector) + (midAsk * midVector) + (backBid * backVector);

// console.log(`live Short Butterfly: ${liveShortButterfly}`);

module.exports = { candlesticker, reauthenticator, timeConverter };
