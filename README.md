# docker-stats

Collect all your Docker stats!

## Install

```sh
npm install docker-stats --save
```

## Usage

```
var stats = require('docker-stats')
var opts = {
  docker: null, // here goes options for Dockerode
  events: null // an instance of docker-allcontainers
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
