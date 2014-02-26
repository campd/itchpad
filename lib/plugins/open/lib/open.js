const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const picker = require("helpers/file-picker");

var OpenPlugin = Class({
  extends: Plugin,

  init: function(host) {

    this.command = this.host.addCommand({
      id: "cmd-open",
      key: "o",
      modifiers: "accel"
    });

    this.fileLabel = this.host.createElement("label", {
      parent: "#plugin-toolbar-left",
      class: "itchpad-file-label"
    });
    this.onTreeSelection = this.onTreeSelection.bind(this);
    this.host.projectTree.on("selection", this.onTreeSelection);
  },

  destroy: function() {
    this.host.projectTree.off("selection", this.onTreeSelection);
  },

  onCommand: function(cmd) {
    if (cmd === "cmd-open") {
      picker.showOpen({
        window: this.host.window
      }).then(path => {
        this.open(path);
      });
    }
  },

  onTreeSelection: function(node) {
    if (!node.isDir) {
      this.fileLabel.textContent = node.basename;
    } else if (!node.parent) {
      this.fileLabel.textContent = "";
    }
  },

  open: function(path) {
    this.host.project.resourceFor(path).then(resource => {
      this.host.openResource(resource);
    });
  }
});

exports.OpenPlugin = OpenPlugin;
registerPlugin(OpenPlugin);
