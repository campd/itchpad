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
  initialize: function(document, node) {
    this.doc = document;
    this.node = node;
    this.elt = this.doc.createElement("vbox");
    this.elt.setAttribute("flex", "1");
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

    this.editor = new Editor({
      mode: this.mode,
      lineNumbers: true,
    });
    this.appended = this.editor.appendTo(this.elt);
  },

  load: function() {
    return this.appended.then(() => {
      return this.node.load();
    }).then(text => {
      dump("DONE LOADING NODE\n");
      this.editor.setText(text);
    });
  }
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


var EditorList = Class({
  initialize: function(document, appendTo) {
    dump("initializing editor list");
    this.doc = document;
    this.elt = this.doc.createElement("vbox");
    this.elt.setAttribute("flex", "1");

    this.deck = this.doc.createElement("deck");
    this.deck.setAttribute("flex", "1");
    this.elt.appendChild(this.deck);
  },

  open: function(node) {
    let radio = this.doc.createElement("radio");
    // The radio element is not being used in the conventional way, thus
    // the devtools-tab class replaces the radio XBL binding with its base
    // binding (the control-item binding).
    radio.className = "devtools-tab";

    let spacer = this.doc.createElement("spacer");
    spacer.setAttribute("flex", "1");
    radio.appendChild(spacer);

    let label = this.doc.createElement("label");
    label.setAttribute("value", node.title);
    label.setAttribute("crop", "end");
    label.setAttribute("flex", "1");
    radio.appendChild(label);

    this.toolbar.appendChild(radio);

    let constructor = editorTypeForNode(node);
    let editor = new constructor(this.doc, node);
    editor.load();

    this.deck.appendChild(editor.elt);
    this.deck.selectedPanel = editor.elt;

    radio.addEventListener("command", () => {
      this.deck.selectedPanel = editor.elt;
    });
  }
});
exports.EditorList = EditorList;
