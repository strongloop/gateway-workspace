// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: gateway-workspace
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = function(app) {
  // Registering policy handlers with the Facet
  var Facet = app.models.Facet;
  var GatewayMapping = app.models.GatewayMapping;
  if (Facet && Facet.artifactTypes) {
    Facet.registerArtifactType('policy-config', {
      load: function(cache, facetName, configFile, cb) {
        configFile.load(function(err) {
          if (err) return cb(err);
          GatewayMapping.deserialize(cache, facetName, configFile);
          cb();
        });
      },
      save: function(cache, facetName) {
        var configFile = GatewayMapping.serialize(cache, facetName);
        return configFile;
      }
    });
  }
};
