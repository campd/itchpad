const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");

var FindAndReplace = Class({
  extends: Plugin,

  init: function(host) {
    this.command = this.host.addCommand({
      id: "find",
      key: "f",
      modifiers: "accel"
    });

    this.searchBox = this.host.createElement("textbox", {
      parent: "#plugin-toolbar-right",
      type: "search",
      timeout: "50",
      hidden: true,
      class: "devtools-searchinput",
    });

    this.onSearchFocus = this.onSearchFocus.bind(this);
    this.onSearchInput = this.onSearchInput.bind(this);
    this.onSearchKey = this.onSearchKey.bind(this);

    this.searchBox.addEventListener("focus", this.onSearchFocus, true);
    this.searchBox.addEventListener("input", this.onSearchInput, true);
    this.searchBox.addEventListener("keypress", this.onSearchKey, true);
  },

  onSearchFocus: function() {

  },

  onSearchInput: function() {

  },

  onSearchKey: function(e) {
    switch (e.keyCode) {
      case e.DOM_VK_RETURN:
      case e.DOM_VK_ENTER: {
        break;
      }
      case e.DOM_VK_DOWN: {
        break;
      }
      case e.DOM_VK_UP: {
        break;
      }
      case e.DOM_VK_ESCAPE: {
        this.finish();
        break;
      }
    }
  },

  finish: function() {
    this.searchBox.value = "";
    this.searchBox.setAttribute("hidden", "true");
  },

  onCommand: function(cmd, target) {
    if (cmd === "find") {
      this.searchBox.removeAttribute("hidden");
      this.searchBox.focus();
      this.searchBox.select();
    }
  }
});

exports.FindAndReplace = FindAndReplace;
registerPlugin(FindAndReplace);
