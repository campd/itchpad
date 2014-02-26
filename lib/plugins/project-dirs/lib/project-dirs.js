const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const prefs = require("sdk/preferences/service");
const picker = require("helpers/file-picker");

var ProjectDirs = Class({
  extends: Plugin,

  init: function(host) {
    let doc = host.document;
    let toolbar = doc.getElementById("project-toolbar");

    this.addCommand = host.addCommand({
      id: "add-project-dir",
    });

    this.removeCommand = host.addCommand({
      id: "remove-project-dir"
    });

    this.host.createMenuItem({
      parent: "#directory-menu-popup",
      id: "remove-project",
      label: "Remove this folder from project",
      command: "remove-project-dir"
    });

    this.addButton = host.createToolbarButton({
      parent: "#project-toolbar",
      class: "devtools-toolbarbutton add-dir-button",
      label: "+",
      command: this.addCommand,
      tooltiptext: "Add a directory to this project",
    });

    this.removeButton = host.createToolbarButton({
      parent: "#project-toolbar",
      class: "devtools-toolbarbutton remove-dir-button",
      label: "-",
      command: this.removeCommand,
      hidden: true,
      tooltiptext: "Remove directory to this project",
    });

    this.onTreeSelection = this.onTreeSelection.bind(this);
    this.host.projectTree.on("selection", this.onTreeSelection);
  },

  destroy: function() {
    this.host.projectTree.off("selection", this.onTreeSelection);
  },

  onTreeSelection: function(node) {
    let store = node.store;

    if (store.path &&
        this.host.project.stores.has(store.path) &&
        node.store.root === node) {
      this.removeButton.removeAttribute("hidden")
    } else {
      this.removeButton.setAttribute("hidden", "true");
    }
  },

  onCommand: function(id, cmd) {
    if (cmd === this.addCommand) {
      this.promptDir();
    } else if (cmd === this.removeCommand) {
      this.removeCurrentDir();
    }
  },

  promptDir: function() {
    picker.showOpenFolder({
      window: this.host.window
    }).then(path => {
      this.addDir(path);
    });
  },

  removeCurrentDir: function() {
    let path = this.host.projectTree.getSelected().store.path;
    this.host.project.removePath(path);
    this.host.project.save();
  },

  addDir: function(path) {
    this.host.project.addPath(path);
    this.host.project.save();
  }
});
exports.ProjectDirs = ProjectDirs;
registerPlugin(ProjectDirs);
