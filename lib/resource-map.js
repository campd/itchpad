const { Class } = require("sdk/core/heritage");

var ResourceMap = Class({
  initialize: function() {
    this.remoteStores = new Set();
    this.localStores = new Set();
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
    // This redoes the search whenever asked, but it would probably be
    // better to build up a map once - mainly because the search algo
    // might not reverse correctly!
    let local, remote;
    if (this.isLocalNode(node)) {
      local = node;
      remote = this._findPair(this.remoteStores, node);
    } else {
      local = this._findPair(this.localStores, node);
      remote = node;
    }
    return {
      local: local,
      remote: remote,
      hash: (local ? local.uri : "null") + "|" + (remote ? remote.uri : "null")
    }
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


