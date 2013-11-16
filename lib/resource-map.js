const { Class } = require("sdk/core/heritage");
const { emit } = require("sdk/event/core");
const { EventTarget } = require("sdk/event/target");


var gPairID = 0;
var Pair = Class({
  extends: EventTarget,

  initialize: function(map, project=null, live=null) {
    this.map = map;
    this._updateSource("project", project, false);
    this._updateSource("live", live, false);
  },

  toString: function() {
    return "[Pair " + this._project + ":" + this._live + "]";
  },

  get project() { return this._project },
  set project(resource) {
    this._updateSource("project", resource, true);
  },

  get live() { return this._live },
  set live(resource) {
    this._updateSource("live", resource, true);
  },

  _updateSource: function(aspect, resource, notify) {
    let val = "_" + aspect;
    let map = this.map;

    if (resource === this[val]) {
      return;
    }

    if (resource) {
      // No other pair can own this.
      let other = map.pairs.get(resource);
      if (other) {
        other[aspect] = null;
      }
    }

    if (this[val]) {
      map.pairs.remove(this[val]);
    }

    this[val] = resource;

    if (resource) {
      map.pairs.set(resource, this);
    }

    if (notify) {
      emit(this, "changed", aspect);
    }
  },


  // Return a resource matching the predicate.  Prefer `first`
  // resource.
  select: function(p, first="project") {
    let items = [this.project, this.live].filter(p => !!p);
    if (first !== "project") {
      items.reverse();
    }
    for (let item of items) {
      if (p(item)) { return item };
    }
    return null;
  }
});

exports.Pair = Pair;

// Maintains the list of pairs.
var ResourceMap = Class({
  initialize: function() {
    this.liveStores = new Set();
    this.projectStores = new Set();
    this.projectPairStores = new Set();
    this.pairs = new Map();
  },

  addLiveStore: function(store, options={}) {
    this.liveStores.add(store);
  },
  removeLiveStore: function(store) {
    this.liveStores.delete(store);
  },

  addProjectStore: function(store, options={}) {
    this.projectStores.add(store);
    if (!options.noAutoPair) {
      this.projectPairStores.add(store);
    }
  },

  removeProjectStore: function(store) {
    this.projectStores.delete(store);
  },

  pair: function(resource) {
    if (this.pairs.has(resource)) {
      return this.pairs.get(resource);
    }

    // This redoes the search whenever asked, but it would probably be
    // better to build up a map once - mainly because the search algo
    // might not reverse correctly!
    let pair, project, live;
    if (resource.isProject) {
      project = resource;
      live = this._findPair(this.liveStores, resource);
      if (this.pairs.has(live)) {
        pair = this.pairs.get(live);
        pair.project = resource;
      }
    } else {
      live = resource;
      project = this._findPair(this.projectPairStores, resource);
      if (this.pairs.has(project)) {
        pair = this.pairs.get(project);
        pair.live = resource;
      }
    }
    if (!pair) {
      pair = new Pair(this, project, live);
    }

    return pair;
  },

  _findPair: function(searchStores, resource) {
    let matches = this._findBasenameMatches(searchStores, resource.basename);
    if (matches.length < 1) {
      console.log("No basename matches for " + resource.basename + "\n");
      return null;
    }

    let searchPath = resource.uri.path.split('/').filter(item => !!item);
    searchPath.reverse();
    console.log("Search path has " + searchPath + " components.");

    let bestMatch = null;
    let bestMatchConfidence = 0;
    for (let match of matches) {
      let matchPath = match.uri.path.split('/').filter(item => !!item);
      matchPath.reverse();
      let i;
      for (i = 0; i < matchPath.length && i < searchPath.length; i++) {
        if (matchPath[i] != searchPath[i]) {
          break;
        }
      }
      if (i > bestMatchConfidence) {
        bestMatch = match;
        bestMatchConfidence = i;
      }
    }

    return bestMatch;
  },

  _findBasenameMatches: function(searchStores, basename) {
    let matches = [];
    for (let store of searchStores) {
      matches = matches.concat(store.findBasename(basename));
    }
    return matches;
  }
});
exports.ResourceMap = ResourceMap;


