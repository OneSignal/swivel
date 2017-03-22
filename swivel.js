'use strict';

function complain() {
  throw new Error('Swivel couldn\'t detect ServiceWorker support. Please feature detect before using Swivel in your web pages!');
}

var api = {
  on: complain,
  once: complain,
  off: complain,
  emit: complain,
  broadcast: complain
};

if (typeof navigator !== "undefined") {
  if ('serviceWorker' in navigator) {
    api = require('./page');
  } else if ('clients' in self) {
    api = require('./worker');
  }
}

module.exports = api;
