#! /usr/bin/env node

'use strict'

var nes = require('never-ending-stream')
var through = require('through2')
var split = require('split2')
var pump = require('pump')
var net = require('net')
var allContainers = require('docker-allcontainers')

function stats (opts) {
  opts = opts || {}
  var result = through.obj()
  var events = opts.events || allContainers(opts)
  var streams = {}
  var oldDestroy = result.destroy
  var interval = opts.statsinterval || 1

  result.setMaxListeners(0)

  result.destroy = function () {
    Object.keys(streams).forEach(detachContainer)
    events.destroy()
    oldDestroy.call(this)
  }

  events.on('start', attachContainer)
  events.on('stop', function (meta) {
    detachContainer(meta.id)
  })

  return result

  function detachContainer (id) {
    if (streams[id]) {
      streams[id].destroy()
      delete streams[id]
    }
  }

  function attachContainer (data, container) {
    var stream = nes(function (cb) {
      container.stats(function (err, stream) {
        cb(err, stream)
      })
    })

    streams[data.id] = stream

    var previousSystem = 0
    var previousCpu = 0

    var sampleCount = 0
    var cpuSum = 0
    var sysSum = 0

    pump(
      stream,
      split(JSON.parse),
      through.obj(function (stats, enc, cb) {
        sampleCount++

        cpuSum += stats.cpu_stats.cpu_usage.total_usage
        sysSum += stats.cpu_stats.system_cpu_usage

        if (sampleCount >= interval) {
          stats.cpu_stats.cpu_usage.total_usage = cpuSum / sampleCount
          stats.cpu_stats.system_cpu_usage = sysSum / sampleCount

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

          sampleCount = 0
          cpuSum = 0
          sysSum = 0
        }

        cb()
      })
    ).pipe(result, { end: false })
  }

  // Code taken from https://github.com/icecrime/docker-mon/blob/ee9ac3fbaffcdec60d26eedd16204ca0370041d8/widgets/cpu.js
  function calculateCPUPercent (statItem, previousCpu, previousSystem) {
    var cpuDelta = statItem.cpu_stats.cpu_usage.total_usage - previousCpu
    var systemDelta = statItem.cpu_stats.system_cpu_usage - previousSystem
    var cpuPercent = 0.0
    if (systemDelta > 0.0 && cpuDelta > 0.0) {
      cpuPercent = (cpuDelta * 1.0 / systemDelta) * statItem.cpu_stats.cpu_usage.percpu_usage.length * 100.0
    }
    return cpuPercent
  }
}

module.exports = stats

function cli () {
  var argv = require('minimist')(process.argv.slice(2))
  if (argv.host) {
    var hostAndPort = argv.host.split(':')
    var host = {
      host: hostAndPort[0]
    }
    if (hostAndPort.length > 1) {
      host.port = Number(hostAndPort[1])
    }
    console.log('Connecting to:', host)
    var stream = net.connect(host, function () {
      console.log('Starting stat stream')
      start(stream)
    })
  } else {
    start(process.stdout)
  }
}

function start (stream) {
  var argv = require('minimist')(process.argv.slice(2))
  pump(
    stats({
      statsinterval: argv.statsinterval,
      matchByName: argv.matchByName,
      matchByImage: argv.matchByImage,
      skipByName: argv.skipByName,
      skipByImage: argv.skipByImage
    }),
    through.obj(function (chunk, enc, cb) {
      this.push(JSON.stringify(chunk))
      this.push('\n')
      cb()
    }),
    stream
  )
}

if (require.main === module) {
  cli()
}
