'use strict';

var nes = require('never-ending-stream');
var through = require('through2');
var split = require('split2');
var pump = require('pump');
var allContainers = require('docker-allcontainers');

function stats(opts) {
  opts = opts || {};
  var result = through.obj();
  var events = opts.events || allContainers(opts);
  var streams = {};
  var oldDestroy = result.destroy;

  result.destroy = function() {
    Object.keys(streams).forEach(detachContainer);
    events.destroy();
    oldDestroy.call(this);
  };

  events.on('start', attachContainer);
  events.on('stop', function(meta) {
    detachContainer(meta.id);
  });

  return result;

  function detachContainer(id) {
    if (streams[id]) {
      streams[id].destroy();
      delete streams[id];
    }
  }

  function attachContainer(data, container) {
    // we are trying to tap into this container
    // we should not do that, or we might be stuck in
    // an output loop
    if (data.id.indexOf(process.env.HOSTNAME) === 0) {
      return
    }
    var stream = nes(function(cb) {
      container.stats(null, cb)
    });

    streams[data.Id] = stream;

    pump(
      stream,
      split(JSON.parse),
      through.obj(function(stats, enc, cb) {
        this.push({
          v: 0,
          id: data.id,
          image: data.image,
          stats: stats
        })
        cb()
      })
    ).pipe(result, { end: false });
  }
}

module.exports = stats

function cli() {
  stats().pipe(through.obj(function(chunk, enc, cb) {
    this.push(JSON.stringify(chunk))
    this.push('\n')
    cb()
  })).pipe(process.stdout)
}

if (require.main === module) {
  cli()
}
