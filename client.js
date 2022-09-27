'use strict';

const {PeerRPCClient} = require('grenache-nodejs-http');
const Link = require('grenache-nodejs-link');

const link = new Link({
  grape: 'http://127.0.0.1:30001',
});
link.start();

const peer = new PeerRPCClient(link, {});
peer.init();

const payload = { id: 'Buy-client', trade: 'Buy', pair: 'tETHUSD', amount: 10 };

peer.request('orderbook', payload, {timeout: 100000}, (err, result) => {
  if (err) {
    console.error(err);
    process.exit(0);
  }
  for (var key in result.singleOrderbookResponse) {
    console.log('Client specific order book:', key, ':');
    console.table(result.singleOrderbookResponse[key]);
  }
  for (var keys in result.multiOrderbookResponse) {
    console.log('\nMultiple order book:', keys, ':');
    console.table(result.multiOrderbookResponse[keys]);
  }
});
