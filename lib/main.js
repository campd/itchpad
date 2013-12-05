const { Cc, Ci, Cu } = require('chrome');
const Itchpad = require("itchpad");
const { Class } = require("sdk/core/heritage");
const { Unknown, Service } = require('sdk/platform/xpcom');
const { registerPlugin } = require("plugins/core");
const prefs = require("sdk/preferences/service");
const { Projects } = require("project");

// Set up some preferences from the environment for easier cfx testing.
(function setupPrefs() {
  const { env } = require("sdk/system/environment");

  if (env.ITCHPAD_PROJECT_DIRS) {
    prefs.set("itchpad.project-dirs", env.ITCHPAD_PROJECT_DIRS);
  }
})();

var CONTRACT_ID = "@mozilla.org/devtools/itchpad;1";

// XPCOM Service for communicating with the itchpad.
var ItchpadLoader = Class({
  extends: Unknown,

  get wrappedJSObject() this,

  // Called from itchpad.xul to create an appropriate itchpad instance.
  initItchpad: function(window, projectID, toolbox) {
    projectID = projectID || "default";
    return Projects.projectForID(projectID).then(project => {
      return new Itchpad.Itchpad(window, project, toolbox);
    })
  },

  openManifest: function(path) {
    Projects.forManifest(path).then(proj => {
      let win = Itchpad.forProject(proj);
      win.focus();
    }).then(null, console.error);
  },

  registerPlugin: function(constr) {
    registerPlugin(constr);
  },
});

var ItchpadService = Service({
  contract: CONTRACT_ID,
  Component: ItchpadLoader
});

// Be a jerk and replace scratchpad for now.
let { ScratchpadManager } = Cu.import("resource:///modules/devtools/scratchpad-manager.jsm", {});
let realScratchpadOpen = ScratchpadManager.openScratchpad;
let openSerial = 0;
ScratchpadManager.openScratchpad = function() {
  const { getMostRecentWindow } = require("sdk/window/utils");
  let current = getMostRecentWindow("devtools:itchpad");
  if (current) {
    current.focus();
    return;
  }

  Projects.defaultProject().then(project => {
    let win = Itchpad.forProject(project);
    win.focus();

  }).then(null, console.error);
};

// Put the real scratchpad back when we're done.
require("sdk/system/unload").when(reason => {
  ScratchpadManager.openScratchpad = realScratchpadOpen;
});

require("appmanager").modifyAppManager();

// Load default plugins

// Uncomment to get logging of addon events.
require("plugins/logging");

require("plugins/apply");
require("plugins/dirty");
require("plugins/new");
require("plugins/save");
require("plugins/open");
require("plugins/style");
require("plugins/target-chooser");
require("plugins/scratch-js");
require("plugins/scratch-css");
require("plugins/variable-sidebar");
require("plugins/notify");
require("plugins/aspect-chooser");
require("plugins/search");
require("plugins/manifest-save");
require("plugins/project-dirs");
require("plugins/project-refresh");
require("plugins/project-settings");

