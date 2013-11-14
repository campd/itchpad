const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { TextEditor, HTMLEditor, CSSEditor, JSEditor, ImageEditor } = require("views/editors");

const { devtoolsRequire } = require("devtools");
const NetworkHelper = devtoolsRequire("devtools/toolkit/webconsole/network-helper");

let categoryMap = {
  "txt": TextEditor,
  "html": HTMLEditor,
  "xml": HTMLEditor,
  "css": CSSEditor,
  "js": JSEditor,
  "json": JSEditor,
  "image": ImageEditor
};

function editorTypeForNode(node)
{
  let contentType = node.contentType;
  let mapped = NetworkHelper.mimeCategoryMap[contentType];
  return categoryMap[mapped] || TextEditor;
}

function pairMethod(operation) {
  return function() {
    let node = this._nodeFor(operation);
    if (!node) {
      return Promise.resolve();
    }
    return this.currentEditor[operation](node);
  }
}

var PairEditor = Class({
  extends: EventTarget,

  initialize: function(document, pair, selectedNode) {
    this.doc = document;
    this.local = pair.local;
    this.remote = pair.remote;
    this.source = selectedNode === this.remote ? "remote" : "local";

    this.elt = this.doc.createElement("deck");
    this.elt.editor = this;

    this.editors = { local: null, remote: null};

    this._ensureEditor();
  },

  forwardEvent: function(sub, event) {
    sub.on(event, (...args) => {
      emit(this, event, sub, ...args);
    });
  },

  _ensureEditor: function() {
    let source = this.source;
    if (this.editors[source]) {
      let editor = this.editors[source];
      this.elt.setAttribute("selectedIndex", editor.deckIndex);
      this.currentEditor = editor;
      return;
    }

    let node = this.node;
    let constructor = editorTypeForNode(node);
    let editor = new constructor(this.doc);

    this.forwardEvent(editor, "dirty-changed");
    this.forwardEvent(editor.editor, "change");

    this.editors[source] = editor;
    editor.node = node;
    // XXX: too tired to figure out why .selectedPanel isn't working.
    editor.deckIndex = this.elt.children.length;
    this.elt.appendChild(editor.elt);
    this.elt.setAttribute("selectedIndex", editor.deckIndex);
    this.currentEditor = editor;
    this.load();
  },

  // Either "local" or "remote"
  // this isn't necessary.
  get selectedSource() {
    return this.source;
  },

  get node() {
    return this[this.source];
  },

  // Source can be either "local" or "remote"
  selectSource: function(source) {
    let source = (source === "local") ? "local" : "remote";
    if (this[source] && source != this.source) {
      this.source = source;
      this._ensureEditor();
      emit(this, "source-changed");
    }
  },

  load: pairMethod("load"),
  apply: pairMethod("apply"),
  get canApply() { return this._nodeFor("apply") != null },
  save: pairMethod("save"),

  _nodeFor: function(operation) {
    if (operation in this.node) {
      return this.node;
    }
    let other = (this.source === "local") ? this.remote : this.local;
    if (other && operation in other) {
      return other;
    }
    return null;
  }
});

var History = Class({
  initialize: function() {
    this.items = [];
    this.index = -1;
  },

  navigate: function(item) {
    this.items = this.items.filter(i => i != item);
    this.items.push(item);
    this.index = this.items.length - 1;
  },

  get current() {
    return this.index >= 0 ? this.items[this.index] : null;
  },

  canBack: function() { return this.index > 0 },
  back: function() {
    return this.canBack() ? this.items[--this.index] : this.current;
  },

  canForward: function() { return this.index < (this.items.length - 1) },
  forward: function() {
    return this.canForward() ? this.items[++this.index] : this.current;
  }
});

var EditorPane = Class({
  extends: EventTarget,

  initialize: function(document, appendTo) {
    this.doc = document;
    this.deck = this.doc.createElement("deck");
    this.deck.setAttribute("flex", "1");
    this.elt = this.deck;

    this.editors = new Map();

    this.history = History();
  },

  open: function(pair, defaultNode) {
    // XXX: This doesn't work if pairing changes...
    let editor = this.editors.get(pair.hash);
    if (!editor) {
      editor = this.createEditor(pair, defaultNode);
      this.editors.set(pair.hash, editor);
    }
    this.history.navigate(editor);
    this.selectEditor(editor);
    return editor;
  },

  back: function() {
    this.selectEditor(this.history.back());
  },

  forward: function() {
    this.selectEditor(this.history.forward());
  },

  editorFor: function(node) {
    return this.editors.get(node);
  },

  selectEditor: function(editor) {
    if (this.deck.selectedPanel.editor != editor) {
      this.deck.selectedPanel = editor.elt;
      emit(this, "editor-changed");
    }
  },

  get currentEditor() {
    return this.deck.selectedPanel.editor;
  },

  createEditor: function(pair, defaultNode) {
    let pairEditor = PairEditor(this.doc, pair, defaultNode);
    pairEditor.load();

    this.forwardEvent(pairEditor, "dirty-changed");

    this.deck.appendChild(pairEditor.elt);
    return pairEditor;
  },

  forwardEvent: function(sub, event) {
    sub.on(event, (...args) => {
      emit(this, event, sub, ...args);
    });
  }
});
exports.EditorPane = EditorPane;
