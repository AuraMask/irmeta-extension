const pump = require('pump');
const RpcEngine = require('json-rpc-engine');
const createErrorMiddleware = require('./createErrorMiddleware');
const createIdRemapMiddleware = require('json-rpc-engine/src/idRemapMiddleware');
const createStreamMiddleware = require('irc-json-rpc-middleware-stream');
const LocalStorageStore = require('obs-store');
const asStream = require('obs-store/lib/asStream');
const ObjectMultiplex = require('obj-multiplex');

module.exports = IrmetaInpageProvider;

function IrmetaInpageProvider(connectionStream) {
  const self = this;

  // setup connectionStream multiplexing
  const mux = self.mux = new ObjectMultiplex();
  pump(
    connectionStream,
    mux,
    connectionStream,
    (err) => logStreamDisconnectWarning('IrMeta', err),
  );

  // subscribe to irmeta public config (one-way)
  self.publicConfigStore = new LocalStorageStore({storageKey: 'IrMeta-Config'});

  pump(
    mux.createStream('publicConfig'),
    asStream(self.publicConfigStore),
    (err) => logStreamDisconnectWarning('IrMeta PublicConfigStore', err),
  );

  // ignore phishing warning message (handled elsewhere)
  mux.ignoreStream('phishing');

  // connect to async provider
  const streamMiddleware = createStreamMiddleware();
  pump(
    streamMiddleware.stream,
    mux.createStream('provider'),
    streamMiddleware.stream,
    (err) => logStreamDisconnectWarning('IrMeta RpcProvider', err),
  );

  // handle sendAsync requests via dapp-side rpc engine
  const rpcEngine = new RpcEngine();
  rpcEngine.push(createIdRemapMiddleware());
  rpcEngine.push(createErrorMiddleware());
  rpcEngine.push(streamMiddleware);
  self.rpcEngine = rpcEngine;
}

// handle sendAsync requests via asyncProvider
// also remap ids inbound and outbound
IrmetaInpageProvider.prototype.sendAsync = function(payload, cb) {
  const self = this;

  if (payload.method === 'irc_signTypedData') {
    console.warn(
      'IrMeta: This experimental version of irc_signTypedData will be deprecated in the next release in favor of the standard as defined in EIP-712. See https://git.io/fNzPl for more information on the new standard.');
  }

  self.rpcEngine.handle(payload, cb);
};


IrmetaInpageProvider.prototype.send = function(payload) {
  const self = this;

  let selectedAddress;
  let result = null;
  switch (payload.method) {

    case 'irc_accounts':
      // read from localStorage
      selectedAddress = self.publicConfigStore.getState().selectedAddress;
      result = selectedAddress ? [selectedAddress] : [];
      break;

    case 'irc_coinbase':
      // read from localStorage
      selectedAddress = self.publicConfigStore.getState().selectedAddress;
      result = selectedAddress || null;
      break;

    case 'irc_uninstallFilter':
      self.sendAsync(payload, noop);
      result = true;
      break;

    case 'net_version':
      const networkVersion = self.publicConfigStore.getState().networkVersion;
      result = networkVersion || null;
      break;

    // throw not-supported Error
    default:
      var link = 'https://github.com/IrMeta/faq/blob/master/DEVELOPERS.md#dizzy-all-async---think-of-irmeta-as-a-light-client';
      var message = `The IrMeta webu object does not support synchronous methods like ${payload.method} without a callback parameter. See ${link} for details.`;
      throw new Error(message);

  }

  // return the result
  return {
    id: payload.id,
    jsonrpc: payload.jsonrpc,
    result: result,
  };
};

IrmetaInpageProvider.prototype.isConnected = function() {
  return true;
};

IrmetaInpageProvider.prototype.isIrMeta = true;

// util

function logStreamDisconnectWarning(remoteLabel, err) {
  let warningMsg = `IrmetaInpageProvider - lost connection to ${remoteLabel}`;
  if (err) warningMsg += '\n' + err.stack;
  console.warn(warningMsg);
}

function noop() {}
