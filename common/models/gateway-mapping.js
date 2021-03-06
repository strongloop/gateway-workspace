// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: gateway-workspace
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var path = require('path');
var debug = require('debug')('gateway-workspace:models:gateway-mapping');

module.exports = function(GatewayMapping) {
  GatewayMapping.getUniqueId = function(data) {
    return data.name || data.id;
  };

  /**
   * Load all policy-config instances from cache
   * @param cache
   */
  function loadFromCache(cache) {
    var Pipeline = GatewayMapping.app.models.Pipeline;
    var Policy = GatewayMapping.app.models.Policy;

    var mappings = GatewayMapping.allFromCache(cache);
    var pipelines = Pipeline.allFromCache(cache);
    var policies = Policy.allFromCache(cache);
    // var scopes = buildScopes(mappings, pipelines, policies);
    mappings = mappings.map(
      GatewayMapping.getConfigFromData.bind(GatewayMapping));
    pipelines = pipelines.map(Pipeline.getConfigFromData.bind(Pipeline));
    policies = policies.map(Policy.getConfigFromData.bind(Policy));
    return {
      mappings: mappings,
      pipelines: pipelines,
      policies: policies
    };
  }

  /**
   * Build a set of scopes from mappings/pipelines/policies
   * @param {GatewayMapping[]) mappings
   * @param {Pipeline[]) pipelines
   * @param {Policy[]) policies
   * @returns {{}}
   */
  GatewayMapping.buildScopes = function(mappings, pipelines, policies) {
    var scopes = {};
    mappings = mappings || [];
    mappings.forEach(function(m) {
      var matchedPipelines = pipelines.filter(function(pipeline) {
        return m.pipelineId === pipeline.id;
      });
      matchedPipelines.forEach(function(pipeline) {
        var matchedPolicies = policies.filter(function(policy) {
          return policy.type === 'auth' &&
            pipeline.policyIds.indexOf(policy.id) !== -1;
        });
        matchedPolicies.forEach(function(policy) {
          if (policy.scopes) {
            policy.scopes.forEach(function(s) {
              var routes = scopes[s];
              if (!routes) {
                routes = [];
                scopes[s] = routes;
              }
              routes.push({verb: m.verb, endpoint: m.endpoint});
            });
          }
        });
      });
    });
    return scopes;
  };

  /**
   * Serialize the policy model instances to the JSON object for
   * policy-config.json
   * @param {*[]} cache The cache data source
   * @param {String} facetName Facet name
   * @returns {ConfigFile}
   */
  GatewayMapping.serialize = function(cache, facetName) {
    if (facetName !== 'server') {
      return null;
    }
    var ConfigFile = GatewayMapping.app.models.ConfigFile;
    var policyConfigPath = path.join(facetName, 'policy-config.json');
    var configs = loadFromCache(cache);

    debug('Writing to policy-config.json: %j', configs);
    return new ConfigFile({
      path: policyConfigPath,
      data: configs
    });
  };

  /**
   * Load the policy config from the file into cache.
   * @param cache
   * @param facetName
   * @param configFile
   */
  GatewayMapping.deserialize = function(cache, facetName, configFile) {
    if (facetName !== 'server') {
      return;
    }
    var Policy = GatewayMapping.app.models.Policy;
    var Pipeline = GatewayMapping.app.models.Pipeline;
    var configs = configFile.data || {};
    if (Array.isArray(configs.policies)) {
      configs.policies.forEach(function(p) {
        debug('loading [%s] policy into cache', p.name);
        Policy.addToCache(cache, p);
      });
    }
    if (Array.isArray(configs.pipelines)) {
      configs.pipelines.forEach(function(p) {
        debug('loading [%s] pipeline into cache', p.name);
        Pipeline.addToCache(cache, p);
      });
    }
    if (Array.isArray(configs.mappings)) {
      configs.mappings.forEach(function(m) {
        debug('loading [%s] mapping into cache', m.name);
        GatewayMapping.addToCache(cache, m);
      });
    }
  };

  /**
   * Get the list of scope mappings
   * @param cb
   */
  GatewayMapping.getAuthScopes = function(cb) {
    // Find referenced pipeline/policies of type `auth`
    GatewayMapping.find({
      include: {
        pipeline: {
          relation: 'policies',
          scope: {
            where: {
              type: 'auth'
            }
          }
        }
      }
    }, function(err, mappings) {
      if (err) return cb(err);
      var scopes = {};
      mappings = mappings || [];
      mappings.forEach(function(m) {
        var mapping = m.toJSON();
        if (mapping.pipeline) {
          if (mapping.pipeline.policies) {
            mapping.pipeline.policies.forEach(function(policy) {
              if (policy.scopes) {
                policy.scopes.forEach(function(s) {
                  var routes = scopes[s];
                  if (!routes) {
                    routes = [];
                    scopes[s] = routes;
                  }
                  routes.push({verb: mapping.verb, endpoint: mapping.endpoint});
                });
              }
            });
          }
        }
      });
      cb(null, scopes);
    });
  };

  GatewayMapping.remoteMethod('getAuthScopes', {
    isStatic: true,
    accepts: [],
    returns: [
      {
        arg: 'scopes',
        type: 'object',
        root: true
      }
    ],
    http: {
      verb: 'get',
      path: '/authScopes'
    }
  });

  /**
   * Rename a mapping
   * @param {String} currentName Current name
   * @param {String} newName New Name
   * @param cb
   */
  GatewayMapping.rename = function(currentName, newName, cb) {
    if (currentName === newName) {
      return process.nextTick(function() {
        cb(null, false);
      });
    }
    this.findOne({where: {name: currentName}}, function(err, result) {
      if (err) return cb(err);
      if (!result) {
        // Cannot find the GatewayMapping by name
        err = new Error('GatewayMapping not found: ' + currentName);
        err.statusCode = 404;
        cb(err);
        return;
      }
      result.updateAttributes({name: newName},
        function(err, mapping) {
          if (err) return cb(err);
          mapping.id = GatewayMapping.getUniqueId(mapping);
          cb(null, mapping);
        });
    });
  };

  GatewayMapping.remoteMethod('rename', {
    isStatic: true,
    accepts: [{
      arg: 'currentName',
      type: 'string',
      required: true,
      description: 'Current name'
    },
      {
        arg: 'newName',
        type: 'string',
        required: true,
        description: 'New name'
      }
    ],
    returns: [
      {
        arg: 'mapping',
        type: 'GatewayMapping',
        root: true
      }
    ]
  });
};

