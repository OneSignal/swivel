'use strict';

function complain() { }

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
