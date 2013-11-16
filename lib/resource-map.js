const { Class } = require("sdk/core/heritage");
const { emit } = require("sdk/event/core");
const { EventTarget } = require("sdk/event/target");


var gPairID = 0;
var Pair = Class({
  extends: EventTarget,

  initialize: function(map, local=null, remote=null) {
    this.map = map;
    this._updateSource("local", local, false);
    this._updateSource("remote", remote, false);
  },

  toString: function() {
    return "[Pair " + this._local + ":" + this._remote + "]";
  },

  get local() { return this._local },
  set local(resource) {
    this._updateSource("local", resource, true);
  },

  get remote() { return this._remote },
  set remote(resource) {
    this._updateSource("remote", resource, true);
  },

  _updateSource: function(name, resource, notify) {
    let val = "_" + name;
    let map = this.map;

    if (resource === this[val]) {
      return;
    }

    if (resource) {
      // No other pair can own this.
      let other = map.pairs.get(resource);
      if (other) {
        other[name] = null;
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
      emit(this, "changed", name);
    }
  },


  // Return a resource matching the predicate.  Prefer `first`
  // resource.
  select: function(p, first="local") {
    let items = [this.local, this.remote].filter(p => !!p);
    if (first !== "local") {
      items.reverse();
    }
    for (let item of items) {
      if (p(item)) { return item };
    }
    return null;
  }
});

exports.Pair = Pair;

var ResourceMap = Class({
  initialize: function() {
    this.remoteStores = new Set();
    this.localStores = new Set();
    this.localPairStores = new Set();
    this.pairs = new Map();
  },

  addRemoteStore: function(store, options={}) {
    this.remoteStores.add(store);
  },
  removeRemoteStore: function(store) {
    this.remoteStores.delete(store);
  },

  addLocalStore: function(store, options={}) {
    this.localStores.add(store);
    if (!options.noAutoPair) {
      this.localPairStores.add(store);
    }
  },

  removeLocalStore: function(store) {
    this.localStores.delete(store);
  },

  pair: function(resource) {
    if (this.pairs.has(resource)) {
      return this.pairs.get(resource);
    }

    // This redoes the search whenever asked, but it would probably be
    // better to build up a map once - mainly because the search algo
    // might not reverse correctly!
    let pair, local, remote;
    if (resource.isProject) {
      local = resource;
      remote = this._findPair(this.remoteStores, resource);
      if (this.pairs.has(remote)) {
        pair = this.pairs.get(remote);
        pair.local = resource;
      }
    } else {
      remote = resource;
      local = this._findPair(this.localPairStores, resource);
      if (this.pairs.has(local)) {
        pair = this.pairs.get(local);
        pair.remote = resource;
      }
    }
    if (!pair) {
      pair = new Pair(this, local, remote);
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


