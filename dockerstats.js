/* requires unpublished dockerode checkout from github */
'use strict';

var Docker = require('../dockerode');
var fs     = require('fs');
var _ = require('lodash');
var util = require('util');

var socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
var stats  = fs.statSync(socket);

if (stats.isSocket()) {
  var docker = new Docker({socketPath: socket});

  docker.listContainers({all: true}, function(err, containers) {
    _.each(containers, function(container) {
      var c = docker.getContainer(container.Id);
      c.stats(null, function(err, stream) {
        console.log('stream to : /home/ubuntu/work/stats/' + container.Id + '.json');
        var ws = fs.createWriteStream('/home/ubuntu/work/stats/' + container.Id + '.json');
        ws.on('error', function (err) {
          console.log(err);
        });
        stream.pipe(ws);
      });
    });
  });
}
