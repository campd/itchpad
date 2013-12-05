const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const promise = require("helpers/promise");
const URL = require("sdk/url");

const { StyleEditorDebuggee, StyleSheet } = Cu.import("resource:///modules/devtools/StyleEditorDebuggee.jsm", {});
const { LiveStore, Resource } = require("stores/base");

var StylesStore = Class({
  extends: LiveStore,

  defaultCategory: "css",

  initialize: function(target) {
    this.initStore();

    this._onStyleSheetsCleared = this._onStyleSheetsCleared.bind(this);
    this._onDocumentLoad = this._onDocumentLoad.bind(this);

    this.setRoot(FolderResource(this));

    this.setTarget(target);
  },

  setTarget: function(target) {
    if (this.debuggee) {
      this.resources.clear();
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
    this.root.setSheets(this.debuggee);
  },

  _onStyleSheetsCleared: function() {
    this.resources.clear();
    this.root.setSheets(this.debuggee);
  },

  refresh: function() {
    // This is a live source, no explicit refresh needed.
    return promise.resolve();
  },

  forSheet: function(sheet) {
    if (this.resources.has(sheet.actor)) {
      return this.resources.get(sheet.actor);
    }

    let resource = SheetResource(this, sheet);
    this.resources.set(sheet.actor, resource);
    this.notifyAdd(resource);
    return resource;
  }
});
exports.StylesStore = StylesStore;

var FolderResource = Class({
  extends: Resource,

  initialize: function(store) {
    this.store = store;
    this.children = new Set();
  },

  get displayName() { return "Styles"; },
  get isDir() { return true; },
  get hasChildren() { return this.children.size > 0 },

  setSheets: function(debuggee) {
    let newChildren = new Set();
    for (let sheet of debuggee.styleSheets) {
      newChildren.add(this.store.forSheet(sheet));
    }
    this.setChildren(newChildren);
  },

  createChild: function(name) {
    if (!this.store.debuggee) {
      console.error("Tried to create a child without a debuggee.");
      deferred.reject(new Error("Can't create child without a target."));
    }
    let deferred = promise.defer();
    console.log("Creating a stylesheet");
    this.store.debuggee.createStyleSheet("", (sheet) => {
      console.log("done creating a stylessheet");
      try {
        let resource = this.store.forSheet(sheet);
        resource._title = name;
        console.log("adding a child");
        this.addChild(resource);
        console.log("Done adding a child.");
        deferred.resolve(resource);
      } catch(ex) {
        console.error(ex);
        deferred.reject(ex);
      }
    })
    return deferred.promise;
  }
});

var SheetResource = Class({
  extends: Resource,

  initialize: function(store, sheet) {
    this.store = store;
    this.sheet = sheet;
    this.children = new Set();
    if (sheet.href) {
      this.setURI(new URL.URL(sheet.href, store.debuggee.baseURI.spec));
    } else {
      this.setURI(new URL.URL("#sheet-" + sheet.styleSheetIndex, store.debuggee.baseURI.spec));
    }
  },

  toString: function() {
    return "[SheetResource:" + this.uri + "]";
  },

  get displayName() {
    if (this._title) {
      return this._title;
    }

    if (!this.sheet.href) {
      this._title = "<inline style sheet " + this.sheet.styleSheetIndex + ">";
      return this._title;
    }

    let sheetURI = this.sheet.href;
    let contentURI = this.sheet.debuggee.baseURI;
    let contentURIScheme = contentURI.scheme;
    let contentURILeafIndex = contentURI.specIgnoringRef.lastIndexOf("/");
    contentURI = contentURI.specIgnoringRef;

    // get content base URI without leaf name (if any)
    if (contentURILeafIndex > contentURIScheme.length) {
      contentURI = contentURI.substring(0, contentURILeafIndex + 1);
    }

    // avoid verbose repetition of absolute URI when the style sheet URI
    // is relative to the content URI
    this._title = (sheetURI.indexOf(contentURI) == 0)
                         ? sheetURI.substring(contentURI.length)
                         : sheetURI;
    try {
      this._title = decodeURI(this._title);
    } catch (ex) {
    }
    return this._title;
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

    this._fetch = promise.defer();
    this.sheet.once("source-load", (event, source) => {
      this._fetch.resolve(source)
    });
    this.sheet.fetchSource();
    return this._fetch.promise;
  },

  apply: function(text) {
    let doApply = () => {
      let deferred = promise.defer();
      this._applypromise = deferred.promise;
      this.sheet.on("style-applied", () => {
        deferred.resolve();
      });
      this.sheet.update(text);
      return deferred.promise;
    }
    if (this._applypromise) {
      return this._applypromise.then(doApply);
    } else {
      return doApply();
    }
  }

});
