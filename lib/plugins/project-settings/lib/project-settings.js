const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");

var ProjectSettings = Class({
  extends: Plugin,

  init: function(host) {
    this.groups = {};

    this.command = host.addCommand({
      id: "project-settings"
    });

    this.button = host.createToolbarButton({
      parent: "#project-toolbar",
      class: "devtools-toolbarbutton settings-button",
      command: this.command,
      tooltiptext: "Project settings"
    });

    this.updaters = [];

    this.addGroup("settings", "Settings");

    this.addTextField({
      group: "settings",
      id: "name",
      title: "Name",
      populate: (editor) => {
        return this.host.project.name;
      },
      onApply: (value) => {
        this.host.project.setName(value);
      }
    });

    this.refresh = this.refresh.bind(this);
    this.host.project.on("name-change", this.refresh);

    this.host.document.querySelector("#project-settings-close").addEventListener("click", () => {
      this.host.document.querySelector("#main-deck").selectedIndex = 0;
    });
  },

  onCommand: function(id, cmd) {
    if (cmd === this.command) {
      this.showSettings();
    }
  },

  refresh: function() {
    let project = this.host.project;

    this.host.document.querySelector("#project-settings-name").textContent = project.name;

    for (let updater of this.updaters) {
      updater();
    }
  },

  showSettings: function() {
    let deck = this.host.document.querySelector("#main-deck");
    deck.selectedIndex = 1;

    this.refresh();
  },

  addGroup: function(id, title) {
    let group = this.host.createElement("vbox", {
      parent: "#settings-hbox",
      class:"options-vertical-pane"
    });
    let header = this.host.createElement("label", {
      parent: group,
      value: title
    });
    let ul = this.host.createElement("vbox", {
      parent: group,
      class: "options-groupbox",
      id: "project-settings-group-" + id
    });
  },

  addTextField: function(options) {

    let line = this.host.createElement("hbox", {
      parent: "#project-settings-group-" + options.group
    });

    let label = this.host.createElement("label", {
      parent: line,
      value: options.title + ":"
    });

    let text = this.host.createElement("textbox", {
      parent: line
    });

    if (options.onApply) {
      text.addEventListener("keypress", (e) => {
        if ((e.keyCode === e.DOM_VK_RETURN) || (e.keyCode === e.DOM_VK_ENTER)) {
          options.onApply(text.value);
        }
      }, false);
    }

    if (options.populate) {
      this.updaters.push(() => {
        let str = options.populate(text);
        if (str !== undefined) {
          text.value = str;
        }
      });
    }

    return text;
  }
});

exports.ProjectSettings = ProjectSettings;
registerPlugin(ProjectSettings);
