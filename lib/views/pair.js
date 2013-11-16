const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { emit } = require("sdk/event/core");
const { EventTarget } = require("sdk/event/target");

const { Promise } = Cu.import("resource://gre/modules/Promise.jsm", {});

var PairChooser = Class({
  initialize: function(document, options) {
    this.doc = document;
    this.elt = document.getElementById("pair-choice");
    this.live = document.getElementById("pair-live");
    this.project = document.getElementById("pair-project");

    this.update = this.update.bind(this);

    this.live.addEventListener("click", () => {
      if (this.editor) {
        this.editor.selectAspect("live");
      }
    });

    this.project.addEventListener("click", () => {
      if (this.editor) {
        this.editor.selectAspect("project");
      }
    });
  },

  setEditor: function(editor) {
    if (this.editor) {
      this.editor.off("aspect-changed", this.update);
      this.editor.pair.off("changed", this.update);
    }
    this.editor = editor;
    if (!editor) {
      this.elt.setAttribute("aspects", "");
      return;
    }
    this.editor.on("aspect-changed", this.update);
    this.editor.pair.on("changed", this.update);

    this.update();
  },

  update: function() {
    let editor = this.editor;

    let aspects = (editor.live ? "live " : "") + (editor.project ? "project " : "");
    this.elt.setAttribute("aspects", aspects);

    this.project.setAttribute("label", editor.project ? editor.project.displayName : "None");
    this.live.setAttribute("label", editor.live ? editor.live.displayName : "None");

    let selected = editor.currentAspect;
    let notSelected = selected === "project" ? "live" : "project";
    this.doc.getElementById("pair-" + selected).setAttribute("selected", "true");
    this.doc.getElementById("pair-" + notSelected).removeAttribute("selected");
  }
});
exports.PairChooser = PairChooser;
