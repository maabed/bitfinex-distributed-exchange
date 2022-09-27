'use strict';

const { PeerRPCServer } = require('grenache-nodejs-http');
const Link = require('grenache-nodejs-link');
const axios = require('axios');

const link = new Link({ grape: 'http://127.0.0.1:30001' });
const multiOrderbook = {};
const singleOrderbook = {};
const multiPairTotals = {};
const singlePairTotals = {};
let locked = false;

link.start();

const peer = new PeerRPCServer(link, { timeout: 300000 });
peer.init();

const port = 1024 + Math.floor(Math.random() * 1000);
const service = peer.transport('server');
service.listen(port);

setInterval(() => {
  link.announce('orderbook', service.port, {});
}, 1000);

service.on('request', async (_rid, _key, payload, handler) => {
  const singleOrderbookResponse = await handleSingleOrderBook(payload);
  console.log('singleOrderbookResponse:', singleOrderbookResponse);
  let multiOrderbookResponse;

  // Only add to Multi order book if it is not currently being updated
  if (!locked) {
    multiOrderbookResponse = await handleMultiOrderBook(payload);
    console.log('multiOrderbookResponse:', multiOrderbookResponse);
    locked = false;
  } else {
    console.log('orderbook is being updated currently, Slow down there kiddo! ...');
  }

  handler.reply(null, { singleOrderbookResponse, multiOrderbookResponse });
});


const handleMultiOrderBook = async (order) => {
  // prevent a race condition when two clients try to add Multi Orders at the same time.
  locked = true;
  console.log('Adding order: ', order, ' to Multi order book');

  // orderbook symbol: 'tETHUSD-Buy'
  const multiOrders = `${order.pair}-${order.trade}`;

  if (!multiOrderbook[multiOrders]) {
    order.total = order.amount;
    multiPairTotals[multiOrders] = order.amount;
    order.price = await getPairPrice(order.pair);
    console.log('order price: ', order.price);
    multiOrderbook[multiOrders] = [order];
  } else {
    if (checkIfClientOrderExists(order, multiOrders)) {
      multiPairTotals[multiOrders] = order.amount + multiPairTotals[multiOrders];
      order.total = multiPairTotals[multiOrders];
    } else {
      multiPairTotals[multiOrders] = order.amount + multiPairTotals[multiOrders];
      order.total = multiPairTotals[multiOrders];
      order.price = await getPairPrice(order.pair);
      console.log('order price: ', order.price);
      multiOrderbook[multiOrders].push(order);
    }
  }
  console.log('multiOrderbook: ', multiOrderbook);
  return multiOrderbook;
}

const handleSingleOrderBook = async (order) => {
  // operation symbol: 'client1-tETHUSD-Buy'
  const operation = `${order.id}-${order.pair}-${order.trade}`;
  console.log('operation: ', operation);

  if (!singleOrderbook[operation]) {
    order.total = order.amount;
    singlePairTotals[operation] = order.amount;
    order.price = await getPairPrice(order.pair);
    console.log('order price: ', order.price);
    singleOrderbook[operation] = [order];
  } else {
    singlePairTotals[operation] = order.amount + singlePairTotals[operation];
    order.total = singlePairTotals[operation];
    order.price = await getPairPrice(order.pair);
    console.log('order price: ', order.price);
    singleOrderbook[operation].push(order);
  }

  console.log('singleOrderbook: ', singleOrderbook);

  return singleOrderbook;
}

// Retrive trading pair price using Bitfinex public API
const getPairPrice = (tradingPair) => {
  console.log('price from Bitfinex for trading pair: ', tradingPair)

  const baseUrl = 'https://api-pub.bitfinex.com/v2/';
  const pathParams = 'tickers';
  const queryParams = `symbols=${tradingPair}`;

  return axios.get(`${baseUrl}/${pathParams}?${queryParams}`).then(
    ({ data }) => data[0][7],
    error => console.log(error),
  );
}

const checkIfClientOrderExists = (order, multiOrders) => {
  for (let i = 0; i < multiOrderbook[multiOrders].length; i++) {
    if (
      order.trade === multiOrderbook[multiOrders][i].trade &&
      order.pair === multiOrderbook[multiOrders][i].pair &&
      order.price === multiOrderbook[multiOrders][i].price
    ) {
      console.log('Found existing trade: ', multiOrderbook[multiOrders][i])
      // already exists! then increment the amount of existing one by the new matching trade
      multiOrderbook[multiOrders][i].amount = multiOrderbook[multiOrders][i].amount + order.amount;
      multiOrderbook[multiOrders][i].total = multiOrderbook[multiOrders][i].total + order.amount;
      return true;
    }
  }
}
