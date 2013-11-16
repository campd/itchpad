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
  return categoryMap[node.contentCategory] || TextEditor;
}

var PairEditor = Class({
  extends: EventTarget,

  initialize: function(document, pair, selectedNode) {
    this.doc = document;
    this.pair = pair;
    this.source = selectedNode === this.remote ? "remote" : "local";

    this.elt = this.doc.createElement("deck");
    this.elt.editor = this;

    this.editors = { local: null, remote: null };

    this._ensureEditor();
  },

  get local() { return this.pair.local; },
  get remote() { return this.pair.remote; },

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
    let editor = constructor(this.doc);
    editor.appended.then(() => {
      emit(this, "editor-created", editor);
    });

    this.editors[source] = editor;
    editor.source = source;
    editor.pair = this.pair;

    // XXX: too tired to figure out why .selectedPanel isn't working.
    editor.deckIndex = this.elt.children.length;
    this.elt.appendChild(editor.elt);
    this.elt.setAttribute("selectedIndex", editor.deckIndex);
    this.currentEditor = editor;
    editor.load(node);
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
    let editor = this.editors.get(pair);
    if (!editor) {
      editor = this.createEditor(pair, defaultNode);
      this.editors.set(pair, editor);
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

  get currentPairEditor() {
    return this.deck.selectedPanel.editor;
  },

  get currentEditor() {
    return this.deck.selectedPanel ? this.deck.selectedPanel.editor.currentEditor : null;
  },

  createEditor: function(pair, defaultNode) {
    let pairEditor = PairEditor(this.doc, pair, defaultNode);
    pairEditor.on("editor-created", (editor) => {
      this.editors.set(pairEditor.pair[pairEditor.source], editor);
      emit(this, "editor-created", editor);
    });;

    this.deck.appendChild(pairEditor.elt);
    return pairEditor;
  },
});
exports.EditorPane = EditorPane;
