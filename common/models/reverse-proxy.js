var app = require('../../');

module.exports = function(ReverseProxy) {
  app.once('ready', function() {
    ready(ReverseProxy);
  });
}

function ready(ReverseProxy) {
  var debug = require('debug')('workspace:policy:reverse-proxy');

  var Middleware = app.models.Middleware;
  var ReverseProxy = app.models.ReverseProxy;

  ReverseProxy.prototype.addMapping = function(mapping, cb) {
    this.params.routes = this.params.routes || [];
    if(typeof mapping === 'string') {

    } else if(typeof mapping === 'object') {

    } else {

    }
  };
};