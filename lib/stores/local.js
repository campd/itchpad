/**
 * Hastily-written local file backend for ItchPad
 */

const { Cc, Ci, Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { TextEncoder, TextDecoder } = require('sdk/io/buffer')
const { emit } = require("sdk/event/core");
const { ProjectStore, Node } = require("stores/base");

const URL = require("sdk/url");
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

const IGNORE_REGEX = /(^\.)|(\~$)|(^node_modules$)/;

function shouldIgnore(path) {
  let basename = OS.Path.basename(path);
  return basename.match(IGNORE_REGEX);
}

var LocalStore = Class({
  extends: ProjectStore,

  defaultCategory: "js",

  initialize: function(path) {
    this.initStore();
    this.rootPath = path;
    this.displayName = path;
    this.rootNode = this.forPath(path);
    this.refresh();
  },

  forPath: function(path, info=null) {
    if (this.nodes.has(path)) {
      return this.nodes.get(path);
    }

    let node = FileNode(this, path, info);
    this.nodes.set(path, node);
    return this.nodes.get(path);
  },

  refresh: function() {
    return spawn(function() {
      for (let [path, node] of this.nodes) {
        yield node.refresh();
      }
      this.updateIndex();
      console.log("Done refreshing store: " + this.displayName + "\n");
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
  extends: Node,

  initialize: function(store, path, info) {
    this.store = store;
    this.path = path;
    this.info = info;
    this.uri = URL.URL(URL.fromFilename(path));
    this.children = new Set();
    this._lastReadModification = undefined;

    this.parent = null;
  },

  toString: function() {
    return "[FileNode:" + this.path + "]";
  },

  get displayName() { return this.basename + (this.isDir ? "/" : "") },

  get isDir() { return this.info.isDir },
  get hasChildren() { return this.children.size > 0 },

  refresh: function() {
    return spawn(function*() {
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

  addChild: function(name, initial="") {
    if (!this.isDir) {
      return Promise.reject(new Error("Cannot add child to a regular file"));
    }

    let newPath = OS.Path.join(this.path, name);

    let buffer = initial ? gEncoder.encode(initial) : "";
    console.log("Creating " + newPath);
    return OS.File.writeAtomic(newPath, buffer, {
      noOverwrite: true
    }).then(() => {
      return this.refresh();
    }).then(() => {
      return this.store.nodes.get(newPath);
    }).then(null, console.error);
  },

  /**
   * Write a string to the file.
   */
  save: function(str) {
    let buffer = gEncoder.encode(str);
    return OS.File.writeAtomic(this.path, buffer, { tmpPath: this.path + ".tmp" });
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
    emit(this, "label-change");
    return this.updateChildren();
  },

  updateChildren: function(force) {
    if (this.isDir && (force || this._lastReadModification != this.info.lastModificationDate.getTime())) {
      dump("really updating children\n");
      return this._updateChildren();
    }
    dump("not bothering to update children\n");
    return Promise.resolve(undefined);
  },

  _updateChildren: function() {
    this._lastReadModification = this.info.lastModificationDate.getTime();
    console.log("last read modification is: " + this._lastReadModification);
    let newChildren = new Set();
    let iterator = new OS.File.DirectoryIterator(this.path);
    return spawn(function() {
      while(true) {
        let entry = yield iterator.next();

        if (shouldIgnore(entry.path)) {
          continue;
        }

        let node = this.store.forPath(entry.path, entry);
        if (node.parent && node.parent != this) {
          console.error("Shouldn't be able to reparent.");
        }
        node.parent = this;
        newChildren.add(node);
      }
    }.bind(this))
    .then(() => {
      iterator.close();
      this.children = newChildren;
      emit(this, "children-changed");
    }, console.error);
  }
});

var ScratchStore = Class({
  extends: LocalStore,

  initialize: function() {
    let path = OS.Path.join(OS.Constants.Path.profileDir, "Scratch");
    this.initStore();
    this.rootPath = path;
    this.displayName = "Scratch";

    this._rootPromise = OS.File.makeDir(path, {
      ignoreExisting: true
    }).then(() => {
      return OS.File.stat(this.rootPath);
    }).then(info => {
      this.rootNode = ScratchRoot(this, path, info);
      this.nodes.set(path, this.rootNode);
      this.refresh();
      return this.rootNode;
    });
  },

  root: function() {
    return this._rootPromise;
  }
});
exports.ScratchStore = ScratchStore;

var ScratchRoot = Class({
  extends: FileNode,

  initialize: function(store, path, info) {
    FileNode.prototype.initialize.call(this, store, path, info);
  },

  get displayName() { return "Scratch" }
})

