const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const { emit } = require("sdk/event/core");
const tabs = require("sdk/tabs");
const { viewFor } = require('sdk/view/core')
const { TargetFactory } = require("devtools/framework/target");
const { MatchPattern } = require("sdk/util/match-pattern");

var TargetChooser = Class({
  extends: Plugin,

  init: function(host) {
    this.updateTarget = this.updateTarget.bind(this);
    this.unsetTarget = this.unsetTarget.bind(this);

    host.on("toolbox-changed", this.checkToolbox.bind(this));
    this.locked = true;
    this.checkToolbox();
  },

  lateInit: function() {
    const { ProjectSettings } = require("plugins/project-settings");
    let settings = this.host.getPlugin(ProjectSettings);
    settings.addTextField({
      group: "settings",
      id: "url-pattern",
      title: "URL Pattern",
      populate: (editor) => {
        return this.host.project.pattern;
      },
      onApply: (value) => {
        return this.host.project.setPattern(value);
      }
    });
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
      tabs.removeListener("activate", this.updateTarget);
      tabs.removeListener("ready", this.updateTarget);
    }
    this.locked = true;
  },

  // Follow the currently-active window and use it as the pad's
  // target.
  unlock: function() {
    if (this.locked) {
      tabs.on("activate", this.updateTarget);
      tabs.on("ready", this.updateTarget);
    }
    this.locked = false;
    this.updateTarget();
  },

  // Get a target for the currently-active tab.
  updateTarget: function() {
    let tab = tabs.activeTab;
    let project = this.host.project;

    if (tab.url === "about:app-manager" && project.manifestPath) {
      let win = viewFor(tab).linkedBrowser.contentWindow.wrappedJSObject;
      let doc = viewFor(tab).linkedBrowser.contentDocument;
      if (!doc._targetChooserWatching) {
        doc.addEventListener("NewTarget", this.updateTarget);
      }

      let target = null;
      if (win.UI.targetsForManifest.has(project.manifestPath)) {
        target = win.UI.targetsForManifest.get(project.manifestPath);
      }
      this.setTarget(target, false);
    } else {
      let pattern = new MatchPattern(project.pattern);
      if (pattern.test(tab.url)) {
        this.setTarget(TargetFactory.forTab(viewFor(tab)), true);
      } else {
        this.setTarget(null);
      }
    }
  },

  setTarget: function(target, owned) {
    if (this.host.target) {
      this.host.target.off("close", this.unsetTarget);
    }
    this.host.setTarget(target, owned);
    if (target) {
      target.on("close", this.unsetTarget);
    }
  },

  unsetTarget: function() {
    this.host.setTarget(null);
  },
});
exports.TargetChooser = TargetChooser;
registerPlugin(TargetChooser);
