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

    this._onStyleSheetsCleared = this._onStyleSheetsCleared.bind(this);
    this._onDocumentLoad = this._onDocumentLoad.bind(this);

    this.rootNode = FolderNode(this);

    this.setTarget(target);
  },

  setTarget: function(target) {
    if (this.debuggee) {
      this.nodes.clear();
      this.debuggee.destroy();
    }

    this.target = target;

    if (!target) {
      return;
    }

    this.debuggee = new StyleEditorDebuggee(target);
    this.debuggee.on("stylesheets-cleared", this._onStyleSheetsCleared);
    this.debuggee.on("document-load", this._onDocumentLoad);
  },

  _onDocumentLoad: function() {
    this.rootNode.setSheets(this.debuggee);
  },

  _onStyleSheetsCleared: function() {
    this.nodes.clear();
    this.rootNode.setSheets(this.debuggee);
  },

  refresh: function() {
    // This is a live source, no explicit refresh needed.
    return Promise.resolve();
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

  get title() { return "Styles"; },
  get displayName() { return "Styles"; },
  get isDir() { return true; },
  get hasChildren() { return this.children.size > 0 },

  setSheets: function(debuggee) {
    this.children = new Set();
    for (let sheet of debuggee.styleSheets) {
      this.children.add(this.store.forSheet(sheet));
    }
    this.store.updateIndex();
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

  canAutoApply: true,

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
