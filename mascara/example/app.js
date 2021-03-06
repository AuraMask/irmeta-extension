const Irc = require('irc.js');

window.addEventListener('load', loadProvider);
window.addEventListener('message', console.warn);

async function loadProvider() {
  const irchainProvider = window.irmeta.createDefaultProvider({host: 'http://localhost:9001'});
  const irc = new Irc(irchainProvider);
  const accounts = await irc.accounts();
  window.IRMETA_ACCOUNT = accounts[0] || 'locked';
  logToDom(accounts.length ? accounts[0] : 'LOCKED or undefined', 'account');
  setupButtons(irc);
}

function logToDom(message, context) {
  document.getElementById(context).innerText = message;
  console.log(message);
}

function setupButtons(irc) {
  const accountButton = document.getElementById('action-button-1');
  accountButton.addEventListener('click', async() => {
    const accounts = await irc.accounts();
    window.IRMETA_ACCOUNT = accounts[0] || 'locked';
    logToDom(accounts.length ? accounts[0] : 'LOCKED or undefined', 'account');
  });
  const txButton = document.getElementById('action-button-2');
  txButton.addEventListener('click', async() => {
    if (!window.IRMETA_ACCOUNT || window.IRMETA_ACCOUNT === 'locked') return;
    const txHash = await irc.sendTransaction({
      from: window.IRMETA_ACCOUNT,
      to: window.IRMETA_ACCOUNT,
      data: '',
    });
    logToDom(txHash, 'cb-value');
  });
}
