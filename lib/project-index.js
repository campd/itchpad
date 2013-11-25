const { Class } = require("sdk/core/heritage");

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
    set.remove(item);
  },

  get: function(key) {
    return this.map.get(key) || new Set();
  }
});

var ProjectIndex = Class({
  initialize: function() {
    this.basenames = new IndexMap();
  },

  add: function(resource) {
    dump("Indexing " + resource.basename + "\n");
    this.basenames.add(resource.basename, resource);
  },

  remove: function(resource) {
    this.basenames.remove(resource.basename, resource);
  },

  findBasename: function(basename) {
    return this.basenames.get(basename);
  }
});
exports.ProjectIndex = ProjectIndex;


