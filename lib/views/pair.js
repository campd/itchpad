const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { emit } = require("sdk/event/core");
const { EventTarget } = require("sdk/event/target");

const { Promise } = Cu.import("resource://gre/modules/Promise.jsm", {});


var PairChooser = Class({
  initialize: function(document, options) {
    this.doc = document;
    this.elt = document.getElementById("pair-choice");
    this.remote = document.getElementById("pair-remote");
    this.local = document.getElementById("pair-local");

    this.update = this.update.bind(this);

    this.remote.addEventListener("click", () => {
      if (this.editor) {
        this.editor.selectSource("remote");
      }
    });

    this.local.addEventListener("click", () => {
      if (this.editor) {
        this.editor.selectSource("local");
      }
    });
  },

  onSourceChange: function() {
    this.update();
  },

  setEditor: function(editor) {
    if (this.editor) {
      this.editor.off("source-changed", this.update);
      this.editor.pair.off("changed", this.update);
    }
    this.editor = editor;
    if (!editor) {
      this.elt.setAttribute("sources", "");
      return;
    }
    this.editor.on("source-changed", this.update);
    this.editor.pair.on("changed", this.update);

    this.update();
  },

  update: function() {
    let editor = this.editor;

    let sources = (editor.remote ? "remote " : "") + (editor.local ? "local " : "");
    this.elt.setAttribute("sources", sources);

    this.local.setAttribute("label", editor.local ? editor.local.displayName : "None");
    this.remote.setAttribute("label", editor.remote ? editor.remote.displayName : "None");

    let selected = editor.selectedSource;
    let notSelected = selected === "local" ? "remote" : "local";
    this.doc.getElementById("pair-" + selected).setAttribute("selected", "true");
    this.doc.getElementById("pair-" + notSelected).removeAttribute("selected");
  }
});
exports.PairChooser = PairChooser;
