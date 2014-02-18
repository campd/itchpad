const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const { emit } = require("sdk/event/core");
const tabs = require("sdk/tabs");

// XXX: Experimenting with hooking a tab up with a live view of a project

var LivePreviewProject = Class({
  extends: Plugin,

  init: function(host) {
    let doc = host.document;
    let toolbar = doc.getElementById("project-toolbar");

    this.command = host.addCommand({
      id: "live-preview-project",
    });

    this.button = host.createToolbarButton({
      parent: "#project-toolbar",
      class: "devtools-toolbarbutton refresh-button",
      command: this.command,
      tooltiptext: "Live preview this project",
    });
  },

  onCommand: function(id, cmd) {
    if (cmd === this.command) {
      let paths = [store.path for ([id, store] of this.host.project.localStores)];
      if (paths[0]) {
        tabs.open(paths[0] + "/index.html");
      }
    }
  }
});

exports.LivePreviewProject = LivePreviewProject;
registerPlugin(LivePreviewProject);
