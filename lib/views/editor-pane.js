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
}

function editorTypeForNode(node)
{
  let contentType = node.contentType;
  let mapped = NetworkHelper.mimeCategoryMap[contentType];
  return categoryMap[mapped] || TextEditor;
}

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
    this.elt = this.doc.createElement("vbox");
    this.elt.setAttribute("flex", "1");

    this.deck = this.doc.createElement("deck");
    this.deck.setAttribute("flex", "1");
    this.elt.appendChild(this.deck);

    this.editors = new Map();

    this.history = History();
  },

  open: function(node) {
    let editor = this.editors.get(node);
    if (!editor) {
      console.log("Creating a new editor!\n");
      editor = this.createEditor(node);
      this.editors.set(node, editor);
    }
    this.history.navigate(editor);
    this.selectEditor(editor);
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

  createEditor: function(node) {
    let constructor = editorTypeForNode(node);
    let editor = new constructor(this.doc, node);
    editor.load();

    this.forwardEditorEvent(editor, "dirty-changed");

    this.deck.appendChild(editor.elt);
    return editor;
  },

  forwardEditorEvent: function(editor, event) {
    editor.on(event, (...args) => {
      dump("forwarding " + event + "\n");
      emit(this, event, editor, ...args);
    });
  }
});
exports.EditorPane = EditorPane;
