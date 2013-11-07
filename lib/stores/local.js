/**
 * Hastily-written local file backend for ItchPad
 */

const { Cc, Ci, Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { TextEncoder, TextDecoder } = require('sdk/io/buffer')

const { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});
const { Task } = Cu.import("resource://gre/modules/Task.jsm", {});
const { Promise } = Cu.import("resource://gre/modules/Promise.jsm", {});
const { FileUtils } = Cu.import("resource://gre/modules/FileUtils.jsm", {});
const { NetUtil } = Cu.import("resource://gre/modules/NetUtil.jsm", {});
const { XPCOMUtils } = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});

XPCOMUtils.defineLazyServiceGetter(this, "mimeService", "@mozilla.org/mime;1", "nsIMIMEService");

const spawn = Task.spawn;

const gDecoder = new TextDecoder();
const gEncoder = new TextEncoder();

var LocalStore = Class({
  initialize: function(path) {
    this.rootPath = path;
    this.displayName = path;
    this.nodes = new Map();
    this.rootNode = this.forPath(path);
  },

  forPath: function(path, info=null) {
    if (this.nodes.has(path)) {
      return this.nodes.get(path);
    }

    let node = FileNode(this, path, info);
    this.nodes.set(path, node);
    return this.nodes.get(path);
    return node;
  },

  refresh: function(path) {
    return spawn(function() {
      for (let [path, node] of this.nodes) {
        console.log("GOT A NODE: " + node.path);
        yield node.refresh();
      }
    }.bind(this));
  },

  root: function() {
    return OS.File.stat(this.rootPath).then(info => {
      return this.forPath(this.rootPath, info);
    });
  }
});
exports.LocalStore = LocalStore;

var FileNode = Class({
  initialize: function(store, path, info) {
    this.store = store;
    this.path = path;
    this.info = info;
    this.basename = OS.Path.basename(path);
    this.parent = null;
    this.children = new Set();
    this._lastReadModification = undefined;
  },

  get title() { return this.basename },
  get displayName() { return this.basename + (this.isDir ? "/" : "") },
  get uri() { return NetUtil.newURI(new FileUtils.File(this.path)); },

  get isDir() { return this.info.isDir },
  get hasChildren() { return this.children.size > 0 },

  refresh: function() {
    return spawn(function() {
      let info = yield OS.File.stat(this.path);
      yield this.updateInfo(info);
    }.bind(this));
  },

  load: function() {
    return OS.File.read(this.path).then(bytes => {
      console.log("done file reading...\n");
      return gDecoder.decode(bytes);
    });
  },

  get contentType() {
    if (this._contentType) {
      return this._contentType;
    }
    try {
      this._contentType = mimeService.getTypeFromFile(new FileUtils.File(this.path));
    } catch(ex) {
      console.error(ex);
      this._contentType = null;
    }
    return this._contentType;
  },

  updateInfo: function(info) {
    this.info = info;
    return this.updateChildren();
  },

  updateChildren: function() {
    if (this.isDir && this._lastReadModification != this.info.lastModificationDate.getTime()) {
      return this._updateChildren();
    }
    return Promise.resolve(undefined);
  },

  _updateChildren: function() {
    this._lastReadModification = this.info.lastModificationDate.getTime();
    let newChildren = new Set();
    let iterator = new OS.File.DirectoryIterator(this.path);
    return spawn(function() {
      while(true) {
        let entry = yield iterator.next();
        let node = this.store.forPath(entry.path, entry);
        if (node.parent && node.parent != this) {
          console.error("Shouldn't be able to reparent.");
        }
        newChildren.add(node);
      }
    }.bind(this))
    .then(() => {
      iterator.close();
      dump("SETTING CHILDREN\n");
      this.children = newChildren;
    }, console.error);
  }
})
