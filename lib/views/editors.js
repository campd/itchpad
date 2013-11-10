const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { merge } = require("sdk/util/object");

const { devtoolsRequire } = require("devtools");

const Editor  = devtoolsRequire("devtools/sourceeditor/editor");

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
exports.ItchEditor = ItchEditor;

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
exports.TextEditor = TextEditor;

var JSEditor = Class({
  extends: TextEditor,

  mode: Editor.modes.js,

  initialize: function(document, node) {
    TextEditor.prototype.initialize.call(this, document, node);
  }
});
exports.JSEditor = JSEditor;

var CSSEditor = Class({
  extends: TextEditor,

  mode: Editor.modes.css,

  initialize: function(document, node) {
    TextEditor.prototype.initialize.call(this, document, node);
  }
});
exports.CSSEditor = CSSEditor;

var HTMLEditor = Class({
  extends: TextEditor,

  mode: Editor.modes.html,

  initialize: function(document, node) {
    TextEditor.prototype.initialize.call(this, document, node);
  }
});
exports.HTMLEditor = HTMLEditor;

var ImageEditor = Class({
  extends: ItchEditor,

  initialize: function(document, node) {
    ItchEditor.protype.initialize.call(this, document, node);

    let image = document.createElement("image");
    image.setAttribute(src, node.uri);
    this.elt.appendChild(image);
  }
});
exports.ImageEditor = ImageEditor;

