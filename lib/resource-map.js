const { Class } = require("sdk/core/heritage");
const { emit } = require("sdk/event/core");
const { EventTarget } = require("sdk/event/target");


var gPairID = 0;
var Pair = Class({
  extends: EventTarget,

  initialize: function(local, remote) {
    this._local = local;
    this._remote = remote;
    this._id = ++gPairID;
  },

  get local() { return this._local },
  set local(node) {
    this._local = node;
    emit(this, "changed", "local");
  },

  get remote() { return this._remote },
  set remote(node) {
    this._remote = node;
    emit(this, "changed", "remote");
  },

  // Return a node matching the predicate.  Prefer `first`
  // node.
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
    this.pairs = new Map();
  },

  addRemoteStore: function(store) {
    this.remoteStores.add(store);
  },
  removeRemoteStore: function(store) {
    this.remoteStores.delete(store);
  },

  addLocalStore: function(store) {
    this.localStores.add(store);
  },

  removeLocalStore: function(store) {
    this.localStores.delete(store);
  },

  isLocalNode: function(node) {
    return this.localStores.has(node.store);
  },

  // Given a node, return:
  // {
  //   local: <node>
  //   remote: <node>
  //   hash: <string unique to this pair>
  // }
  // ... where the passed in node will be one of the
  // two nodes.
  pair: function(node) {
    if (this.pairs.has(node)) {
      return this.pairs.get(node);
    }

    // This redoes the search whenever asked, but it would probably be
    // better to build up a map once - mainly because the search algo
    // might not reverse correctly!
    let pair, local, remote;
    if (this.isLocalNode(node)) {
      local = node;
      remote = this._findPair(this.remoteStores, node);
      if (this.pairs.has(remote)) {
        pair = this.pairs.get(remote);
        pair.local = node;
      }
    } else {
      remote = node;
      local = this._findPair(this.localStores, node);
      if (this.pairs.has(local)) {
        pair = this.pairs.get(local);
        pair.remote = node;
      }
    }
    if (!pair) {
      pair = new Pair(local, remote);
    }
    if (local) {
      this.pairs.set(local, pair);
    }
    if (remote) {
      this.pairs.set(remote, pair);
    }

    return pair;
  },

  _findPair: function(searchStores, node) {
    let matches = this._findBasenameMatches(searchStores, node.basename);
    if (matches.length < 1) {
      console.log("No basename matches for " + node.basename + "\n");
      return null;
    }

    let searchPath = node.uri.path.split('/').filter(item => !!item);
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


