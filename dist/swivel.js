(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.swivel = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function atoa (a, n) { return Array.prototype.slice.call(a, n); }

},{}],2:[function(require,module,exports){
'use strict';

var ticky = require('ticky');

module.exports = function debounce (fn, args, ctx) {
  if (!fn) { return; }
  ticky(function run () {
    fn.apply(ctx || null, args || []);
  });
};

},{"ticky":4}],3:[function(require,module,exports){
'use strict';

var atoa = require('atoa');
var debounce = require('./debounce');

module.exports = function emitter (thing, options) {
  var opts = options || {};
  var evt = {};
  if (thing === undefined) { thing = {}; }
  thing.on = function (type, fn) {
    if (!evt[type]) {
      evt[type] = [fn];
    } else {
      evt[type].push(fn);
    }
    return thing;
  };
  thing.once = function (type, fn) {
    fn._once = true; // thing.off(fn) still works!
    thing.on(type, fn);
    return thing;
  };
  thing.off = function (type, fn) {
    var c = arguments.length;
    if (c === 1) {
      delete evt[type];
    } else if (c === 0) {
      evt = {};
    } else {
      var et = evt[type];
      if (!et) { return thing; }
      et.splice(et.indexOf(fn), 1);
    }
    return thing;
  };
  thing.emit = function () {
    var args = atoa(arguments);
    return thing.emitterSnapshot(args.shift()).apply(this, args);
  };
  thing.emitterSnapshot = function (type) {
    var et = (evt[type] || []).slice(0);
    return function () {
      var args = atoa(arguments);
      var ctx = this || thing;
      if (type === 'error' && opts.throws !== false && !et.length) { throw args.length === 1 ? args[0] : args; }
      et.forEach(function emitter (listen) {
        if (opts.async) { debounce(listen, args, ctx); } else { listen.apply(ctx, args); }
        if (listen._once) { thing.off(type, listen); }
      });
      return thing;
    };
  };
  return thing;
};

},{"./debounce":2,"atoa":1}],4:[function(require,module,exports){
var si = typeof setImmediate === 'function', tick;
if (si) {
  tick = function (fn) { setImmediate(fn); };
} else {
  tick = function (fn) { setTimeout(fn, 0); };
}

module.exports = tick;
},{}],5:[function(require,module,exports){
'use strict';

var atoa = require('atoa');
var serialization = require('./serialization');
var emitter = require('contra/emitter');

module.exports = createChannel;

function createChannel () {
  var channel = at(navigator.serviceWorker.controller);
  return channel;

  function at (worker) {
    var internalEmitter = emitter();
    var api = {
      on: selfed('on'),
      once: selfed('once'),
      off: selfed('off'),
      emit: postToWorker,
      at: at
    };
    var postFromWorker = serialization.emission(internalEmitter, { broadcast: false });
    navigator.serviceWorker.addEventListener('message', broadcastHandler);
    return api;

    function selfed (method) {
      return function selfish () {
        internalEmitter[method].apply(null, arguments);
        return api;
      };
    }

    function postToWorker () {
      if (!worker) {
        return Promise.reject(new Error('ServiceWorker not found.'));
      }
      var payload = serialization.parsePayload(atoa(arguments));
      var messageChannel = new MessageChannel();
      messageChannel.port1.addEventListener('message', postFromWorker);
      return worker.postMessage(payload, [messageChannel.port2]);
    }

    function broadcastHandler (e) {
      var data = e.data;
      if (data) {
        if (data.__broadcast) {
          serialization.emission(internalEmitter, {broadcast: true})(e);
        } else {
          serialization.emission(internalEmitter, {broadcast: false})(e);
        }
      }
    }
  }
}

},{"./serialization":6,"atoa":1,"contra/emitter":3}],6:[function(require,module,exports){
'use strict';

function serializeError (err) {
  return err ? err.toString() : null;
}

function deserializeError (err) {
  return err ? new Error(err) : null;
}

function parsePayload (payload) {
  var type = payload.shift();
  if (type === 'error') {
    return { error: serializeError(payload[0]), type: type, payload: [] };
  }
  return { error: null, type: type, payload: payload };
}

function emission (emitter, context) {
  return emit;
  function emit (e) {
    var data = e.data;
    if (data.type === 'error') {
      emitter.emit.call(null, 'error', context, deserializeError(data.error));
    } else {
      emitter.emit.apply(null, [data.type, context].concat(data.payload));
    }
  }
}

module.exports = {
  parsePayload: parsePayload,
  emission: emission
};

},{}],7:[function(require,module,exports){
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

},{"./page":5,"./worker":8}],8:[function(require,module,exports){
'use strict';

var atoa = require('atoa');
var serialization = require('./serialization');
var emitter = require('contra/emitter');

module.exports = createChannel;

function createChannel () {
  var internalEmitter = emitter();
  var api = {
    on: selfed('on'),
    once: selfed('once'),
    off: selfed('off'),
    broadcast: broadcastToPages,
    emit: replyToClient
  };

  self.addEventListener('message', postFromPage);

  return api;

  function selfed (method) {
    return function selfish () {
      internalEmitter[method].apply(null, arguments);
      return api;
    };
  }

  function postFromPage (e) {
    var context = {
      reply: replyToPage(e)
    };
    serialization.emission(internalEmitter, context)(e);
  }

  function broadcastToPages (type) {
    var payload = atoa(arguments, 1);
    return self.clients.matchAll({includeUncontrolled: true}).then(gotClients);
    function gotClients (clients) {
      return clients.map(emitToClient);
    }
    function emitToClient (client) {
      return client.postMessage({ type: type, payload: payload, __broadcast: true });
    }
  }

  function replyTo (client) {
    var payload = serialization.parsePayload(atoa(arguments, 1));
    return client.postMessage(payload);
  }

  function replyToPage (e) {
    return replyTo.bind(null, e.ports[0]);
  }

  function replyToClient (clientId) {
        var payload = serialization.parsePayload(atoa(arguments, 1));
    return self.clients.matchAll({includeUncontrolled: true}).then(function(clients) {
      var wasClientFound = false;
      clients.forEach(function(client) {
        if (client.id === clientId) {
          wasClientFound = true;
          return client.postMessage(payload);
        }
      });
      if (!wasClientFound) {
        return Promise.reject('Could not find service worker client with ID ' + clientId + ' to reply to.');
      }
    });
  }
}

},{"./serialization":6,"atoa":1,"contra/emitter":3}]},{},[7])(7)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYXRvYS9hdG9hLmpzIiwibm9kZV9tb2R1bGVzL2NvbnRyYS9kZWJvdW5jZS5qcyIsIm5vZGVfbW9kdWxlcy9jb250cmEvZW1pdHRlci5qcyIsIm5vZGVfbW9kdWxlcy90aWNreS90aWNreS1icm93c2VyLmpzIiwicGFnZS5qcyIsInNlcmlhbGl6YXRpb24uanMiLCJzd2l2ZWwuanMiLCJ3b3JrZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBhdG9hIChhLCBuKSB7IHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhLCBuKTsgfVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdGlja3kgPSByZXF1aXJlKCd0aWNreScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlYm91bmNlIChmbiwgYXJncywgY3R4KSB7XG4gIGlmICghZm4pIHsgcmV0dXJuOyB9XG4gIHRpY2t5KGZ1bmN0aW9uIHJ1biAoKSB7XG4gICAgZm4uYXBwbHkoY3R4IHx8IG51bGwsIGFyZ3MgfHwgW10pO1xuICB9KTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBhdG9hID0gcmVxdWlyZSgnYXRvYScpO1xudmFyIGRlYm91bmNlID0gcmVxdWlyZSgnLi9kZWJvdW5jZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGVtaXR0ZXIgKHRoaW5nLCBvcHRpb25zKSB7XG4gIHZhciBvcHRzID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIGV2dCA9IHt9O1xuICBpZiAodGhpbmcgPT09IHVuZGVmaW5lZCkgeyB0aGluZyA9IHt9OyB9XG4gIHRoaW5nLm9uID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgaWYgKCFldnRbdHlwZV0pIHtcbiAgICAgIGV2dFt0eXBlXSA9IFtmbl07XG4gICAgfSBlbHNlIHtcbiAgICAgIGV2dFt0eXBlXS5wdXNoKGZuKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaW5nO1xuICB9O1xuICB0aGluZy5vbmNlID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgZm4uX29uY2UgPSB0cnVlOyAvLyB0aGluZy5vZmYoZm4pIHN0aWxsIHdvcmtzIVxuICAgIHRoaW5nLm9uKHR5cGUsIGZuKTtcbiAgICByZXR1cm4gdGhpbmc7XG4gIH07XG4gIHRoaW5nLm9mZiA9IGZ1bmN0aW9uICh0eXBlLCBmbikge1xuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBpZiAoYyA9PT0gMSkge1xuICAgICAgZGVsZXRlIGV2dFt0eXBlXTtcbiAgICB9IGVsc2UgaWYgKGMgPT09IDApIHtcbiAgICAgIGV2dCA9IHt9O1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZXQgPSBldnRbdHlwZV07XG4gICAgICBpZiAoIWV0KSB7IHJldHVybiB0aGluZzsgfVxuICAgICAgZXQuc3BsaWNlKGV0LmluZGV4T2YoZm4pLCAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaW5nO1xuICB9O1xuICB0aGluZy5lbWl0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBhcmdzID0gYXRvYShhcmd1bWVudHMpO1xuICAgIHJldHVybiB0aGluZy5lbWl0dGVyU25hcHNob3QoYXJncy5zaGlmdCgpKS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfTtcbiAgdGhpbmcuZW1pdHRlclNuYXBzaG90ID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICB2YXIgZXQgPSAoZXZ0W3R5cGVdIHx8IFtdKS5zbGljZSgwKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGFyZ3MgPSBhdG9hKGFyZ3VtZW50cyk7XG4gICAgICB2YXIgY3R4ID0gdGhpcyB8fCB0aGluZztcbiAgICAgIGlmICh0eXBlID09PSAnZXJyb3InICYmIG9wdHMudGhyb3dzICE9PSBmYWxzZSAmJiAhZXQubGVuZ3RoKSB7IHRocm93IGFyZ3MubGVuZ3RoID09PSAxID8gYXJnc1swXSA6IGFyZ3M7IH1cbiAgICAgIGV0LmZvckVhY2goZnVuY3Rpb24gZW1pdHRlciAobGlzdGVuKSB7XG4gICAgICAgIGlmIChvcHRzLmFzeW5jKSB7IGRlYm91bmNlKGxpc3RlbiwgYXJncywgY3R4KTsgfSBlbHNlIHsgbGlzdGVuLmFwcGx5KGN0eCwgYXJncyk7IH1cbiAgICAgICAgaWYgKGxpc3Rlbi5fb25jZSkgeyB0aGluZy5vZmYodHlwZSwgbGlzdGVuKTsgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpbmc7XG4gICAgfTtcbiAgfTtcbiAgcmV0dXJuIHRoaW5nO1xufTtcbiIsInZhciBzaSA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09ICdmdW5jdGlvbicsIHRpY2s7XG5pZiAoc2kpIHtcbiAgdGljayA9IGZ1bmN0aW9uIChmbikgeyBzZXRJbW1lZGlhdGUoZm4pOyB9O1xufSBlbHNlIHtcbiAgdGljayA9IGZ1bmN0aW9uIChmbikgeyBzZXRUaW1lb3V0KGZuLCAwKTsgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0aWNrOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIGF0b2EgPSByZXF1aXJlKCdhdG9hJyk7XG52YXIgc2VyaWFsaXphdGlvbiA9IHJlcXVpcmUoJy4vc2VyaWFsaXphdGlvbicpO1xudmFyIGVtaXR0ZXIgPSByZXF1aXJlKCdjb250cmEvZW1pdHRlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUNoYW5uZWw7XG5cbmZ1bmN0aW9uIGNyZWF0ZUNoYW5uZWwgKCkge1xuICB2YXIgY2hhbm5lbCA9IGF0KG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmNvbnRyb2xsZXIpO1xuICByZXR1cm4gY2hhbm5lbDtcblxuICBmdW5jdGlvbiBhdCAod29ya2VyKSB7XG4gICAgdmFyIGludGVybmFsRW1pdHRlciA9IGVtaXR0ZXIoKTtcbiAgICB2YXIgYXBpID0ge1xuICAgICAgb246IHNlbGZlZCgnb24nKSxcbiAgICAgIG9uY2U6IHNlbGZlZCgnb25jZScpLFxuICAgICAgb2ZmOiBzZWxmZWQoJ29mZicpLFxuICAgICAgZW1pdDogcG9zdFRvV29ya2VyLFxuICAgICAgYXQ6IGF0XG4gICAgfTtcbiAgICB2YXIgcG9zdEZyb21Xb3JrZXIgPSBzZXJpYWxpemF0aW9uLmVtaXNzaW9uKGludGVybmFsRW1pdHRlciwgeyBicm9hZGNhc3Q6IGZhbHNlIH0pO1xuICAgIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBicm9hZGNhc3RIYW5kbGVyKTtcbiAgICByZXR1cm4gYXBpO1xuXG4gICAgZnVuY3Rpb24gc2VsZmVkIChtZXRob2QpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbiBzZWxmaXNoICgpIHtcbiAgICAgICAgaW50ZXJuYWxFbWl0dGVyW21ldGhvZF0uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgcmV0dXJuIGFwaTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcG9zdFRvV29ya2VyICgpIHtcbiAgICAgIGlmICghd29ya2VyKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ1NlcnZpY2VXb3JrZXIgbm90IGZvdW5kLicpKTtcbiAgICAgIH1cbiAgICAgIHZhciBwYXlsb2FkID0gc2VyaWFsaXphdGlvbi5wYXJzZVBheWxvYWQoYXRvYShhcmd1bWVudHMpKTtcbiAgICAgIHZhciBtZXNzYWdlQ2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuICAgICAgbWVzc2FnZUNoYW5uZWwucG9ydDEuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHBvc3RGcm9tV29ya2VyKTtcbiAgICAgIHJldHVybiB3b3JrZXIucG9zdE1lc3NhZ2UocGF5bG9hZCwgW21lc3NhZ2VDaGFubmVsLnBvcnQyXSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYnJvYWRjYXN0SGFuZGxlciAoZSkge1xuICAgICAgdmFyIGRhdGEgPSBlLmRhdGE7XG4gICAgICBpZiAoZGF0YSkge1xuICAgICAgICBpZiAoZGF0YS5fX2Jyb2FkY2FzdCkge1xuICAgICAgICAgIHNlcmlhbGl6YXRpb24uZW1pc3Npb24oaW50ZXJuYWxFbWl0dGVyLCB7YnJvYWRjYXN0OiB0cnVlfSkoZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2VyaWFsaXphdGlvbi5lbWlzc2lvbihpbnRlcm5hbEVtaXR0ZXIsIHticm9hZGNhc3Q6IGZhbHNlfSkoZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gc2VyaWFsaXplRXJyb3IgKGVycikge1xuICByZXR1cm4gZXJyID8gZXJyLnRvU3RyaW5nKCkgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBkZXNlcmlhbGl6ZUVycm9yIChlcnIpIHtcbiAgcmV0dXJuIGVyciA/IG5ldyBFcnJvcihlcnIpIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gcGFyc2VQYXlsb2FkIChwYXlsb2FkKSB7XG4gIHZhciB0eXBlID0gcGF5bG9hZC5zaGlmdCgpO1xuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIHJldHVybiB7IGVycm9yOiBzZXJpYWxpemVFcnJvcihwYXlsb2FkWzBdKSwgdHlwZTogdHlwZSwgcGF5bG9hZDogW10gfTtcbiAgfVxuICByZXR1cm4geyBlcnJvcjogbnVsbCwgdHlwZTogdHlwZSwgcGF5bG9hZDogcGF5bG9hZCB9O1xufVxuXG5mdW5jdGlvbiBlbWlzc2lvbiAoZW1pdHRlciwgY29udGV4dCkge1xuICByZXR1cm4gZW1pdDtcbiAgZnVuY3Rpb24gZW1pdCAoZSkge1xuICAgIHZhciBkYXRhID0gZS5kYXRhO1xuICAgIGlmIChkYXRhLnR5cGUgPT09ICdlcnJvcicpIHtcbiAgICAgIGVtaXR0ZXIuZW1pdC5jYWxsKG51bGwsICdlcnJvcicsIGNvbnRleHQsIGRlc2VyaWFsaXplRXJyb3IoZGF0YS5lcnJvcikpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbWl0dGVyLmVtaXQuYXBwbHkobnVsbCwgW2RhdGEudHlwZSwgY29udGV4dF0uY29uY2F0KGRhdGEucGF5bG9hZCkpO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgcGFyc2VQYXlsb2FkOiBwYXJzZVBheWxvYWQsXG4gIGVtaXNzaW9uOiBlbWlzc2lvblxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gY29tcGxhaW4oKSB7XG4gIHRocm93IG5ldyBFcnJvcignU3dpdmVsIGNvdWxkblxcJ3QgZGV0ZWN0IFNlcnZpY2VXb3JrZXIgc3VwcG9ydC4gUGxlYXNlIGZlYXR1cmUgZGV0ZWN0IGJlZm9yZSB1c2luZyBTd2l2ZWwgaW4geW91ciB3ZWIgcGFnZXMhJyk7XG59XG5cbnZhciBhcGkgPSB7XG4gIG9uOiBjb21wbGFpbixcbiAgb25jZTogY29tcGxhaW4sXG4gIG9mZjogY29tcGxhaW4sXG4gIGVtaXQ6IGNvbXBsYWluLFxuICBicm9hZGNhc3Q6IGNvbXBsYWluXG59O1xuXG5pZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gXCJ1bmRlZmluZWRcIikge1xuICBpZiAoJ3NlcnZpY2VXb3JrZXInIGluIG5hdmlnYXRvcikge1xuICAgIGFwaSA9IHJlcXVpcmUoJy4vcGFnZScpO1xuICB9IGVsc2UgaWYgKCdjbGllbnRzJyBpbiBzZWxmKSB7XG4gICAgYXBpID0gcmVxdWlyZSgnLi93b3JrZXInKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFwaTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGF0b2EgPSByZXF1aXJlKCdhdG9hJyk7XG52YXIgc2VyaWFsaXphdGlvbiA9IHJlcXVpcmUoJy4vc2VyaWFsaXphdGlvbicpO1xudmFyIGVtaXR0ZXIgPSByZXF1aXJlKCdjb250cmEvZW1pdHRlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUNoYW5uZWw7XG5cbmZ1bmN0aW9uIGNyZWF0ZUNoYW5uZWwgKCkge1xuICB2YXIgaW50ZXJuYWxFbWl0dGVyID0gZW1pdHRlcigpO1xuICB2YXIgYXBpID0ge1xuICAgIG9uOiBzZWxmZWQoJ29uJyksXG4gICAgb25jZTogc2VsZmVkKCdvbmNlJyksXG4gICAgb2ZmOiBzZWxmZWQoJ29mZicpLFxuICAgIGJyb2FkY2FzdDogYnJvYWRjYXN0VG9QYWdlcyxcbiAgICBlbWl0OiByZXBseVRvQ2xpZW50XG4gIH07XG5cbiAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgcG9zdEZyb21QYWdlKTtcblxuICByZXR1cm4gYXBpO1xuXG4gIGZ1bmN0aW9uIHNlbGZlZCAobWV0aG9kKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIHNlbGZpc2ggKCkge1xuICAgICAgaW50ZXJuYWxFbWl0dGVyW21ldGhvZF0uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiBhcGk7XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBvc3RGcm9tUGFnZSAoZSkge1xuICAgIHZhciBjb250ZXh0ID0ge1xuICAgICAgcmVwbHk6IHJlcGx5VG9QYWdlKGUpXG4gICAgfTtcbiAgICBzZXJpYWxpemF0aW9uLmVtaXNzaW9uKGludGVybmFsRW1pdHRlciwgY29udGV4dCkoZSk7XG4gIH1cblxuICBmdW5jdGlvbiBicm9hZGNhc3RUb1BhZ2VzICh0eXBlKSB7XG4gICAgdmFyIHBheWxvYWQgPSBhdG9hKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIHNlbGYuY2xpZW50cy5tYXRjaEFsbCh7aW5jbHVkZVVuY29udHJvbGxlZDogdHJ1ZX0pLnRoZW4oZ290Q2xpZW50cyk7XG4gICAgZnVuY3Rpb24gZ290Q2xpZW50cyAoY2xpZW50cykge1xuICAgICAgcmV0dXJuIGNsaWVudHMubWFwKGVtaXRUb0NsaWVudCk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGVtaXRUb0NsaWVudCAoY2xpZW50KSB7XG4gICAgICByZXR1cm4gY2xpZW50LnBvc3RNZXNzYWdlKHsgdHlwZTogdHlwZSwgcGF5bG9hZDogcGF5bG9hZCwgX19icm9hZGNhc3Q6IHRydWUgfSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVwbHlUbyAoY2xpZW50KSB7XG4gICAgdmFyIHBheWxvYWQgPSBzZXJpYWxpemF0aW9uLnBhcnNlUGF5bG9hZChhdG9hKGFyZ3VtZW50cywgMSkpO1xuICAgIHJldHVybiBjbGllbnQucG9zdE1lc3NhZ2UocGF5bG9hZCk7XG4gIH1cblxuICBmdW5jdGlvbiByZXBseVRvUGFnZSAoZSkge1xuICAgIHJldHVybiByZXBseVRvLmJpbmQobnVsbCwgZS5wb3J0c1swXSk7XG4gIH1cblxuICBmdW5jdGlvbiByZXBseVRvQ2xpZW50IChjbGllbnRJZCkge1xuICAgICAgICB2YXIgcGF5bG9hZCA9IHNlcmlhbGl6YXRpb24ucGFyc2VQYXlsb2FkKGF0b2EoYXJndW1lbnRzLCAxKSk7XG4gICAgcmV0dXJuIHNlbGYuY2xpZW50cy5tYXRjaEFsbCh7aW5jbHVkZVVuY29udHJvbGxlZDogdHJ1ZX0pLnRoZW4oZnVuY3Rpb24oY2xpZW50cykge1xuICAgICAgdmFyIHdhc0NsaWVudEZvdW5kID0gZmFsc2U7XG4gICAgICBjbGllbnRzLmZvckVhY2goZnVuY3Rpb24oY2xpZW50KSB7XG4gICAgICAgIGlmIChjbGllbnQuaWQgPT09IGNsaWVudElkKSB7XG4gICAgICAgICAgd2FzQ2xpZW50Rm91bmQgPSB0cnVlO1xuICAgICAgICAgIHJldHVybiBjbGllbnQucG9zdE1lc3NhZ2UocGF5bG9hZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKCF3YXNDbGllbnRGb3VuZCkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoJ0NvdWxkIG5vdCBmaW5kIHNlcnZpY2Ugd29ya2VyIGNsaWVudCB3aXRoIElEICcgKyBjbGllbnRJZCArICcgdG8gcmVwbHkgdG8uJyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==
