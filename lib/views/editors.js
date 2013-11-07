const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { emit } = require("sdk/event/core");
const { EventTarget } = require("sdk/event/target");
const { merge } = require("sdk/util/object");

const { devtoolsRequire } = require("devtools");
const Editor  = devtoolsRequire("devtools/sourceeditor/editor");
const NetworkHelper = devtoolsRequire("devtools/toolkit/webconsole/network-helper");

const { Promise } = Cu.import("resource://gre/modules/Promise.jsm", {});

const HTML_NS = "http://www.w3.org/1999/xhtml";
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var ItchEditor = Class({
  extends: EventTarget,

  initialize: function(document, node) {
    this.doc = document;
    this.node = node;
    this.elt = this.doc.createElement("vbox");
    this.elt.setAttribute("flex", "1");
    this.elt.editor = this;
  },

  load: function() {
    return Promise.resolve();
  }
});

var TextEditor = Class({
  extends: ItchEditor,

  mode: Editor.modes.text,

  initialize: function(document, node) {
    ItchEditor.prototype.initialize.call(this, document, node);

    this._dirty = false;

    this.editor = new Editor({
      mode: this.mode,
      lineNumbers: true,
    });

    this.editor.on("change", this._onEditorChange.bind(this));

    this.appended = this.editor.appendTo(this.elt);
  },

  _onEditorChange: function() {
    this._emitDirty();
  },

  get dirty() {
    return !this.editor.isClean();
  },

  set dirty(val) {
    if (!val && this.editor)
      this.editor.markClean();
    this._emitDirty();
  },

  _emitDirty: function() {
    if (this._signaledDirty != this.dirty) {
      this._signaledDirty = this.dirty;
      emit(this, "dirty-changed");
    }
  },

  load: function() {
    return this.appended.then(() => {
      return this.node.load();
    }).then(text => {
      this.editor.setText(text);
      this.dirty = false;
    });
  },

  save: function() {
    return this.node.save(this.editor.getText()).then(() => {
      this.dirty = false;
    });
  },
});

var JSEditor = Class({
  extends: TextEditor,

  mode: Editor.modes.js,

  initialize: function(document, node) {
    TextEditor.prototype.initialize.call(this, document, node);
  }
});

var CSSEditor = Class({
  extends: TextEditor,

  mode: Editor.modes.css,

  initialize: function(document, node) {
    TextEditor.prototype.initialize.call(this, document, node);
  }
});

var HTMLEditor = Class({
  extends: TextEditor,

  mode: Editor.modes.html,

  initialize: function(document, node) {
    TextEditor.prototype.initialize.call(this, document, node);
  }
});

var ImageEditor = Class({
  extends: ItchEditor,

  initialize: function(document, node) {
    ItchEditor.protype.initialize.call(this, document, node);

    let image = document.createElement("image");
    image.setAttribute(src, node.uri);
    this.elt.appendChild(image);
  }
})

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

var EditorList = Class({
  extends: EventTarget,

  initialize: function(document, appendTo) {
    dump("initializing editor list");
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
exports.EditorList = EditorList;

