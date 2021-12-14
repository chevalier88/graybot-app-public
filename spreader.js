/* eslint-disable max-len */
const WebSocket = require('ws');
const fs = require('fs');
// const WebSocket = require('ws');
// const jfs = require('./jsonFileStorage.js');
const fn = require('./functions.js');

const lws = new WebSocket('ws://localhost:3000');
const config = JSON.parse(fs.readFileSync('config.json').toString());

console.log(config);
// A variable declared outside a function, becomes GLOBAL.

// instantiate LEGS and TF (timeframe)
const { FRONT_LEG } = config;
const { MID_LEG } = config;
const { BACK_LEG } = config;

const { TF } = config;

console.log('printing legs and tf...');
console.log(FRONT_LEG, MID_LEG, BACK_LEG, TF);

// instantiate JOHANSEN VECTORS
const { FRONT_VECTOR } = config;
const { MIDDLE_VECTOR } = config;
const { BACK_VECTOR } = config;

console.log('printing vectors...');
console.log(FRONT_VECTOR, MIDDLE_VECTOR, BACK_VECTOR);

// instantiate Bollinger Indicators
let UPPER_BAND;
let LOWER_BAND;
let MOVING_AVERAGE;
let LONG_STOP_LOSS_BAND;
let SHORT_STOP_LOSS_BAND;
let bollingerObject;

// instantiate Live Butterfly Objects
let frontAsk;
let frontBid;
let midBid;
let midAsk;
let backAsk;
let backBid;
let liveLongButterfly;
let liveShortButterfly;

// authenticate and open Websockets connection
const ws = new WebSocket('wss://test.deribit.com/ws/api/v2');

let refreshToken;
const authID = 9930;
const tickerID = 2001;

// testnet only.
// const authMsg = {
//   jsonrpc: '2.0',
//   id: authID,
//   method: 'public/auth',
//   params: {
//     grant_type: 'client_credentials',
//     client_id: 'ecj-dUOA',
//     client_secret: 'SXEd7cTD7kHungC09h8__9YEHyTY2kPXpdi5T9MhOfk',
//   },
// };

const frontTickerString = `ticker.${FRONT_LEG}.raw`;
const midTickerString = `ticker.${MID_LEG}.raw`;
const backTickerString = `ticker.${BACK_LEG}.raw`;

const tickersMsg = {
  jsonrpc: '2.0',
  id: tickerID,
  method: 'public/subscribe',
  params: {
    channels: [
      frontTickerString,
      midTickerString,
      backTickerString,
    ],
  },
};

// instantiate initial reauthenticate state
let reauthenticateState = false;

lws.onopen = function () {
  lws.send('asking for first bollingers from local host');
  // subscribe to instrument tickers
};

lws.onmessage = function (e) {
  bollingerObject = JSON.parse(e.data);
  MOVING_AVERAGE = bollingerObject.moving_average;
  LOWER_BAND = bollingerObject.lower_band;
  UPPER_BAND = bollingerObject.upper_band;
  LONG_STOP_LOSS_BAND = bollingerObject.long_sl_band;
  SHORT_STOP_LOSS_BAND = bollingerObject.short_sl_band;
  setTimeout(() => {
    lws.send('asking again from local host');
  }, 1500);

  // console.log(bollingerObject);
  // console.log(`moving average is ${MOVING_AVERAGE}`);
};

lws.onerror = function (e) {
  console.log('\nlocal Websocket Host error! Ending Bollinger stream...\n');
  ws.close();
};

lws.onclose = function (e) {
  console.log('\nlocal Websocket Host stopped! Ending bollinger stream...');

  ws.close();
};

ws.onmessage = function (e) {
  // do something with the response...
  console.log('received from deribit server:\n ');
  // console.log(e.data);

  let expiresIn;

  const message = JSON.parse(e.data);
  // console.log(message);

  if (message.id === authID) {
    if (reauthenticateState === false) {
      console.log('initial authentication successful!');
      console.log(`session expires in ${message.result.expires_in / 1000 / 60} minutes...`);

      // store refresh token
      refreshToken = message.result.refresh_token;

      // for mainnet, but 10 mins or 600k millseconds refresh is safe

      // expiresIn = message.result.expires_in;

      expiresIn = 60000;
      console.log(`...but we will reauthenticate in ${expiresIn / 1000} seconds`);

      console.log('new refresh token stored');
      console.log(`current refresh token is ${refreshToken}`);

      reauthenticateState = true;
      setTimeout(() => {
        fn.reauthenticator(refreshToken, ws);
      }, expiresIn);
      console.log('reauthenticateState is now true');
    } else {
      // get datetime now
      const today = new Date();
      const date = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
      const time = `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`;
      const dateTime = `${date} ${time}`;

      console.log(`Successfully Refreshed your Auth at ${dateTime}!`);

      // store refresh token
      refreshToken = message.result.refresh_token;

      // reset expiry time
      expiresIn = 60000;

      setTimeout(() => {
        fn.reauthenticator(refreshToken, ws);
      }, expiresIn);
      console.log(`new refresh token: ${refreshToken}`);
      console.log(`refreshing in ${expiresIn / 1000} seconds`);
    }
  }

  if (message.method === 'subscription') {
    if (message.params.channel.includes(FRONT_LEG)) {
      // console.log(`${FRONT_LEG} subscription message received`);
      frontAsk = message.params.data.best_ask_price;
      frontBid = message.params.data.best_bid_price;
    } if (message.params.channel.includes(MID_LEG)) {
      // console.log(`${MID_LEG} subscription messag received`);
      midBid = message.params.data.best_bid_price;
      midAsk = message.params.data.best_ask_price;
    } if (message.params.channel.includes(BACK_LEG)) {
      backAsk = message.params.data.best_ask_price;
      backBid = message.params.data.best_bid_price;
    }
  }

  liveLongButterfly = (FRONT_VECTOR * frontAsk) + (MIDDLE_VECTOR * midBid) + (BACK_VECTOR * backAsk);
  liveShortButterfly = (FRONT_VECTOR * frontBid) + (MIDDLE_VECTOR * midAsk) + (BACK_VECTOR * backBid);

  console.log(bollingerObject);
  console.log(`Unix Datetime now:${Date.now()}`);
  console.log(`Long Spread now: ${liveLongButterfly}`, `Lower Band now: ${LOWER_BAND}`);
  console.log(`Short Spread now: ${liveShortButterfly}`, `Upper Band now: ${UPPER_BAND}`);
  console.log(`Moving Average now: ${MOVING_AVERAGE}`);
};

ws.onclose = function () {
  console.log('Ending Live Spread stream...');
};

ws.onerror = function () {
  console.log('Deribit Websocket Error! Ending Live Spread stream...');
};

ws.onopen = function () {
  // ws.send(JSON.stringify(authMsg));
  // subscribe to instrument tickers
  ws.send(JSON.stringify(tickersMsg));
};
