const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const { emit } = require("sdk/event/core");
const tabs = require("sdk/tabs");
const { devtoolsRequire } = require("devtools/core");
const { TargetFactory } = devtoolsRequire("devtools/framework/target");

var TargetChooser = Class({
  extends: Plugin,

  init: function(host) {
    host.on("toolbox-changed", this.checkToolbox.bind(this));
    tabs.on("activate", () => console.log("TAB CHANGE"));
    this.locked = true;
    this.updateTarget = this.updateTarget.bind(this);
    this.checkToolbox();
  },

  // If the pad has been associated with a toolbox, lock the
  // target to that toolbox's target.
  checkToolbox: function() {
    if (this.host.toolbox) {
      this.lock(this.host.toolbox.target);
      return;
    }

    this.unlock();
  },

  // Lock the pad to a given target
  lock: function(target) {
    this.host.setTarget(this.host.toolbox.target);
    if (!this.locked) {
      tabs.off("activate", this.updateTarget);
    }
    this.locked = true;
  },

  // Follow the currently-active window and use it as the pad's
  // target.
  unlock: function() {
    if (this.locked) {
      tabs.on("activate", this.updateTarget);
    }
    this.locked = false;
    this.updateTarget();
  },

  // Get a target for the currently-active tab.
  updateTarget: function() {
    this.host.setTarget(TargetFactory.forTab(this.activeTab()));
  },

  // Irakli promised me viewFor(tabs.activeTab), so this will be replaced soon.
  activeTab: function() {
    const { getMostRecentWindow } = require("sdk/window/utils");
    const { getActiveTab } = require("sdk/tabs/utils");
    return getActiveTab(getMostRecentWindow("navigator:browser"));
  }
});
exports.TargetChooser = TargetChooser;
registerPlugin(TargetChooser);
