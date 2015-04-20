#! /usr/bin/env node

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

  result.setMaxListeners(0);

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
      return;
    }

    var stream = nes(container.stats.bind(container));

    streams[data.Id] = stream;

    var previousSystem = 0;
    var previousCpu = 0;

    pump(
      stream,
      split(JSON.parse),
      through.obj(function(stats, enc, cb) {
        var percent = calculateCPUPercent(stats, previousCpu, previousSystem)
        stats.cpu_stats.cpu_usage.cpu_percent = percent
        this.push({
          v: 0,
          id: data.id.slice(0, 12),
          image: data.image,
          name: data.name,
          stats: stats
        })
        previousCpu = stats.cpu_stats.cpu_usage.total_usage
        previousSystem = stats.cpu_stats.system_cpu_usage
        cb()
      })
    ).pipe(result, { end: false });
  }

  // Code taken from https://github.com/icecrime/docker-mon/blob/ee9ac3fbaffcdec60d26eedd16204ca0370041d8/widgets/cpu.js
  function calculateCPUPercent(statItem, previousCpu, previousSystem) {
    var cpuDelta = statItem.cpu_stats.cpu_usage.total_usage - previousCpu
    var systemDelta = statItem.cpu_stats.system_cpu_usage - previousSystem

    var cpuPercent = 0.0
    if (systemDelta > 0.0 && cpuDelta > 0.0) {
      cpuPercent = (cpuDelta / systemDelta) * statItem.cpu_stats.cpu_usage.percpu_usage.length * 100.0
    }
    return cpuPercent
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
