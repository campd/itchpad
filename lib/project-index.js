const { Class } = require("sdk/core/heritage");
const match = require("path-match");

var IndexMap = Class({
  initialize: function() {
    this.map = new Map();
  },

  add: function(key, item) {
    let set = this.map.get(key)
    if (!set) {
      set = new Set();
      this.map.set(key, set);
    }
    set.add(item);
  },

  remove: function(key, item) {
    let set = this.map.get(key);
    if (!set) {
      return;
    }
    set.delete(item);
  },

  get: function(key) {
    return this.map.get(key) || new Set();
  },

  keys: function() {
    let keys = new Set();
    for (let [key, value] of this.map) {
      keys.add(key);
    }
    return keys;
  }
});

var ProjectIndex = Class({
  initialize: function() {
    this.basenames = new IndexMap();
    this.relativePaths = new IndexMap();
  },

  add: function(resource) {
    this.basenames.add(resource.basename, resource);
    let path = resource.relativePath();
    this.relativePaths.add(path, resource);
  },

  remove: function(resource) {
    this.basenames.remove(resource.basename, resource);
  },

  findBasename: function(basename) {
    return this.basenames.get(basename);
  },

  fuzzyMatchPath: function(search) {
    let start = Date.now();

    let candidates = [];
    for (let path of this.relativePaths.keys()) {
      if (match.quickMatch(search, path)) {
        candidates.push(path);
      }
    }

    let matches = [];
    let candidateMisses = [];
    let re = match.pathMatchExpression(search);
    for (let candidate of candidates) {
      let score = match.score(re, candidate);
      if (score > 0) {
        for (let resource of this.relativePaths.get(candidate)) {
          if (!resource.isDir) {
            matches.push({ score: score, resource: resource });
          }
        }
      }
    }

    console.log("Search took " + (Date.now() - start) + " and returned " + matches.length + " results.");

    return matches;
  }
});
exports.ProjectIndex = ProjectIndex;


