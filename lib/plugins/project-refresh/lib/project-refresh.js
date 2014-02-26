const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const { emit } = require("sdk/event/core");

var RefreshProject = Class({
  extends: Plugin,

  init: function(host) {
    let doc = host.document;

    this.command = host.addCommand({
      id: "refresh-project",
    });

    // this.button = host.createToolbarButton({
    //   parent: "#project-toolbar",
    //   class: "devtools-toolbarbutton refresh-button",
    //   command: this.command,
    //   tooltiptext: "Refresh project changes from disk",
    // });
  },

  onCommand: function(id, cmd) {
    if (cmd === this.command) {
      this.host.projectTree.refresh();
    }
  }
});
exports.RefreshProject = RefreshProject;
registerPlugin(RefreshProject);
