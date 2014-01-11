const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const promise = require("helpers/promise");
const URL = require("sdk/url");

const { StyleSheetsFront } = require("devtools/server/actors/stylesheets");
const { StyleEditorFront } = require("devtools/server/actors/styleeditor");
const {CssLogic} = require("devtools/styleinspector/css-logic");

const { LiveStore, Resource } = require("stores/base");


var StylesStore = Class({
  extends: LiveStore,

  defaultCategory: "css",

  initialize: function(target) {
    this.initStore();

    this._onStyleSheetsCleared = this._onStyleSheetsCleared.bind(this);
    this._onNavigate = this._onNavigate.bind(this);

    this.setRoot(FolderResource(this));

    this.setTarget(target);
  },

  setTarget: function(target) {
    if (this.debuggee) {
      this.resources.clear();
      this.debuggee.destroy();
      this.target.off("will-navigate", this._onStyleSheetsCleared);
      this.target.off("navigate", this._onNavigate);
    }

    this.target = target;

    if (!target) {
      return;
    }

    // XXX: Need to share style editor fronts with the style editor.
    if (this.target.form.styleSheetsActor) {
      this.debuggee = StyleSheetsFront(this.target.client, this.target.form);
    } else {
      // We're talking to a pre-firefox 29 server-side
      this.debuggee = StyleEditorFront(this.target.client, this.target.form);
    }

    this.debuggee.getStyleSheets().then(styleSheets => {
      if (this.target !== target) {
        return;
      }
      this.root.setSheets(styleSheets);
      this.target.on("will-navigate", this._onStyleSheetsCleared);
      this.target.on("navigate", this._onNavigate);
    }).then(null, console.error);
  },

  _onNavigate: function() {
    this.debuggee.getStyleSheets().then(styleSheets => {
      this.root.setSheets(styleSheets);
    });
  },

  _onStyleSheetsCleared: function() {
    this.resources.clear();
    this.root.setSheets();
  },

  refresh: function() {
    // This is a live source, no explicit refresh needed.
    return promise.resolve();
  },

  forSheet: function(sheet) {
    if (this.resources.has(sheet.actorID)) {
      return this.resources.get(sheet.actorID);
    }

    let resource = SheetResource(this, sheet);
    this.resources.set(sheet.actorID, resource);
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

  setSheets: function(sheets=[]) {
    let newChildren = new Set();
    for (let sheet of sheets) {
      newChildren.add(this.store.forSheet(sheet));
    }
    this.setChildren(newChildren);
  },

  createChild: function(name) {
    if (!this.store.debuggee) {
      console.error("Tried to create a child without a debuggee.");
      deferred.reject(new Error("Can't create child without a target."));
    }
    return this.store.debuggee.addStyleSheet("").then(sheet => {
      let resource = this.store.forSheet(sheet);
      resource._title = name;
      this.addChild(resource);
      return resource;
    }).then(null, console.error);
  }
});

var SheetResource = Class({
  extends: Resource,

  initialize: function(store, sheet) {
    this.store = store;
    this.sheet = sheet;
    this.children = new Set();
    if (sheet.href) {
      this.setURI(new URL.URL(sheet.href));
    } else {
      this.setURI(new URL.URL("#sheet-" + sheet.styleSheetIndex, sheet.nodeHref));
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

    this._title = CssLogic.shortSource({ href: this.sheet.href });
    try {
      this._title = decodeURI(this._title);
    } catch(ex) {
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
    return this.sheet.getText().then(longstr => {
      return longstr.string();
    });
  },

  apply: function(text) {
    return this.sheet.update(text, true);
  }
});
