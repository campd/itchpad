const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const URL = require("sdk/url");

const { StyleEditorDebuggee, StyleSheet } = Cu.import("resource:///modules/devtools/StyleEditorDebuggee.jsm", {});
const { Promise } = Cu.import("resource://gre/modules/Promise.jsm");
const { ProjectStore, ProjectNode } = require("stores/base");

var StylesStore = Class({
  extends: ProjectStore,
  initialize: function(target) {
    this.initStore();

    this.debuggee = new StyleEditorDebuggee(target);
    this.debuggee.on("stylesheets-cleared", this._onStyleSheetsCleared.bind(this));
    this.debuggee.on("document-load", this._onDocumentLoad.bind(this));

    this._refreshDeferred = Promise.defer();
    this._refreshPromise = this._refreshDeferred.promise;

    this.rootNode = FolderNode(this);
  },

  _onDocumentLoad: function() {
    this.rootNode.setSheets(this.debuggee);
    this._refreshDeferred.resolve();
  },

  _onStyleSheetsCleared: function() {
    this.nodes.clear();
    this.rootNode.setSheets(this.debuggee);
    this._refreshDeferred = Promise.defer();
  },

  refresh: function() {
    return this._refreshDeferred.promise;
  },

  root: function() {
    return this.refresh().then(() => {
      return this.rootNode;
    });
  },

  forSheet: function(sheet) {
    if (this.nodes.has(sheet.actor)) {
      return this.nodes.get(sheet.actor);
    }

    let node = SheetNode(this, sheet);
    this.nodes.set(sheet.actor, node);
    return node;
  }
});
exports.StylesStore = StylesStore;

var FolderNode = Class({
  extends: ProjectNode,

  initialize: function(store) {
    this.store = store;
    this.children = new Set();
  },

  get title() { return "Style Sheets"; },
  get displayName() { return "Style Sheets"; },
  get isDir() { return true; },
  get hasChildren() { return this.children.size > 0 },

  setSheets: function(debuggee) {
    this.children = new Set();
    for (let sheet of debuggee.styleSheets) {
      this.children.add(this.store.forSheet(sheet));
    }
    console.log("Sheets changed, now have: " + this.children.size);
    emit(this, "children-changed");
  }
});

var SheetNode = Class({
  extends: ProjectNode,

  initialize: function(store, sheet) {
    this.store = store;
    this.sheet = sheet;
    this.children = new Set();
    this.uri = new URL.URL(sheet.href, store.debuggee.baseURI.spec);
  },

  get isDir() { return false; },
  get hasChildren() { return false; },
  get contentType() {
    // Good enough.
    return "text/css";
  },

  load: function() {
    if (this._fetch) {
      return this._fetch.promise;
    }

    this._fetch = Promise.defer();
    this.sheet.once("source-load", (event, source) => {
      this._fetch.resolve(source)
    });
    this.sheet.fetchSource();
    return this._fetch.promise;
  },

  apply: function(text) {
    let doApply = () => {
      let deferred = Promise.defer();
      this._applyPromise = deferred.promise;
      this.sheet.on("style-applied", () => {
        deferred.resolve();
      });
      this.sheet.update(text);
    }
    if (this._applyPromise) {
      this._applyPromise.then(doApply);
    } else {
      doApply();
    }
  }

});
