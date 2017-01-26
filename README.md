# docker-stats

Collect all your Docker stats!

## Install

```sh
npm install docker-stats --save
```

## Usage

```
var stats = require('docker-stats')
var through = require('through2')
var opts = {
  docker: null, // here goes options for Dockerode
  events: null, // an instance of docker-allcontainers

  statsinterval: 10, // downsample stats. Collect a number of statsinterval logs
                     // and output their mean value

  // the following options limit the containers being matched
  // so we can avoid catching logs for unwanted containers
  matchByName: /hello/, // optional
  matchByImage: /matteocollina/, // optional
  skipByName: /.*pasteur.*/, // optional
  skipByImage: /.*dockerfile.*/ // optional
}
stats(opts).pipe(through.obj(function(chunk, enc, cb) {
  this.push(JSON.stringify(chunk))
  this.push('\n')
  cb()
})).pipe(process.stdout)
```

## Acknowledgements

This project was kindly sponsored by [nearForm](http://nearform.com).

## License

MIT
