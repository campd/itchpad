const { Cc, Ci, Cu } = require('chrome');
const Itchpad = require("itchpad");
const { Class } = require("sdk/core/heritage");
const { Unknown, Service } = require('sdk/platform/xpcom');
const { registerPlugin } = require("plugins/core");
const prefs = require("sdk/preferences/service");
const { Projects } = require("project");
const { Menuitem } = require("menuitems");
const promise = require("helpers/promise");

Menuitem({
  id: 'devtools-itchpad-menuitem',
  menuid: 'menuWebDeveloperPopup',
  label: 'Itchpad',
  useChrome: true,
  onCommand: function(window) {
    const { getMostRecentWindow } = require("sdk/window/utils");
    let current = getMostRecentWindow("devtools:itchpad");
    if (current) {
      current.focus();
      return;
    }

    Projects.defaultProject().then(project => {
      let win = openItchpadWindow(project);
      win.focus();

    }).then(null, console.error);
  }
});

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

    // XXX: Temporarily do not return the real project, just a fake one.
    // return promise.resolve(new Itchpad.Itchpad(window, null, toolbox));

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


function openItchpadWindow(proj) {
  let windowName = "Itchpad-project:" + proj.id;

  let windows = require("sdk/window/utils").windows();
  for (let win of windows) {
    if (win.name === windowName) {
      return win;
    }
  }

  const { open } = require("sdk/window/utils");
  let params = Cc["@mozilla.org/embedcomp/dialogparam;1"]
               .createInstance(Ci.nsIDialogParamBlock);

  params.SetNumberStrings(1);
  params.SetString(0, proj.id);

  let win = open("chrome://itchpad/content/itchpad.xul", {
    name: windowName,
    features: {
      chrome: true,
      titlebar: true,
      toolbar: true,
      centerscreen: true,
      resizable: true,
      dialog: "no",
    },
    args: params
  });

  return win;
}

require("appmanager").modifyAppManager();

// Load default plugins

// Uncomment to get logging of addon events.
require("plugins/logging");

require("plugins/apply");
require("plugins/dirty");
require("plugins/delete");
require("plugins/new");
require("plugins/save");
require("plugins/open");
require("plugins/style");
//require("plugins/target-chooser");
require("plugins/scratch-js");
require("plugins/scratch-css");
// require("plugins/variable-sidebar");
require("plugins/notify");
require("plugins/search");
require("plugins/manifest-save");
require("plugins/project-dirs");
require("plugins/project-refresh");
// require("plugins/project-live-preview");
require("plugins/project-settings");
require("plugins/drag-drop-new");
require("plugins/app-manager-renderer");

