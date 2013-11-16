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
      if (this.shell) {
        this.shell.selectAspect("live");
      }
    });

    this.project.addEventListener("click", () => {
      if (this.shell) {
        this.shell.selectAspect("project");
      }
    });
  },

  setShell: function(shell) {
    if (this.shell) {
      this.shell.off("aspect-changed", this.update);
      this.shell.pair.off("changed", this.update);
    }
    this.shell = shell;
    if (!shell) {
      this.elt.setAttribute("aspects", "");
      return;
    }
    this.shell.on("aspect-changed", this.update);
    this.shell.pair.on("changed", this.update);

    this.update();
  },

  update: function() {
    let shell = this.shell;

    let aspects = (shell.live ? "live " : "") + (shell.project ? "project " : "");
    this.elt.setAttribute("aspects", aspects);

    this.project.setAttribute("label", shell.project ? shell.project.displayName : "None");
    this.live.setAttribute("label", shell.live ? shell.live.displayName : "None");

    let selected = shell.currentAspect;
    dump("UPDATING WITH SELECTED ASPECT: " + selected + "\n");
    let notSelected = selected === "project" ? "live" : "project";
    this.doc.getElementById("pair-" + selected).setAttribute("selected", "true");
    this.doc.getElementById("pair-" + notSelected).removeAttribute("selected");
  }
});
exports.PairChooser = PairChooser;
