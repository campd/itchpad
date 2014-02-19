const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const { emit } = require("sdk/event/core");

var RefreshProject = Class({
  extends: Plugin,

  init: function(host) {
    let doc = host.document;
    let toolbar = doc.getElementById("project-toolbar");

    this.command = host.addCommand({
      id: "refresh-project",
    });
  },

  onCommand: function(id, cmd) {
    if (cmd === this.command) {
      this.host.project.refresh();
    }
  }
});
exports.RefreshProject = RefreshProject;
registerPlugin(RefreshProject);
