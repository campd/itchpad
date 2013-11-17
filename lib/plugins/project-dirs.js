const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const { Cu, Cc, Ci } = require("chrome");
const prefs = require("sdk/preferences/service");
const { LocalStore } = require("stores/local");

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

    this.addButton = host.createToolbarButton({
      parent: "project-toolbar",
      class: "devtools-toolbarbutton add-dir-button",
      label: "+",
      command: this.addCommand,
      tooltiptext: "Add a directory to this project",
    });

    this.removeButton = host.createToolbarButton({
      parent: "project-toolbar",
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
        this.host.projectStores.has(store.path) &&
        node.store.rootResource === node) {
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
    let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(this.host.window, "Select a File", Ci.nsIFilePicker.modeGetFolder);
    if (fp.show() === Ci.nsIFilePicker.returnOK) {
      this.addDir(fp.file.path);
    }
  },

  removeCurrentDir: function() {
    let path = this.host.projectTree.getSelected().store.path;

    let dirs = new Set(prefs.get("itchpad.project-dirs", "").split(":"));
    dirs.delete(path);
    prefs.set("itchpad.project-dirs", [...dirs].join(":"));
  },

  addDir: function(path) {
    this.host.addProjectStore(new LocalStore(path));

    let dirs = new Set(prefs.get("itchpad.project-dirs", "").split(":"));
    dirs.add(path);
    prefs.set("itchpad.project-dirs", [...dirs].join(":"));
  }
});
exports.ProjectDirs = ProjectDirs;
registerPlugin(ProjectDirs);
