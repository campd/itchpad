const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");

const { VariablesViewController } = Cu.import("resource:///modules/devtools/VariablesViewController.jsm", {});
const { VariablesView } = Cu.import("resource:///modules/devtools/VariablesView.jsm", {});
const { ObjectClient } = Cu.import("resource://gre/modules/devtools/dbg-client.jsm", {});
const { EnvironmentClient } = Cu.import("resource://gre/modules/devtools/dbg-client.jsm", {});

const VARIABLES_VIEW_URL = "chrome://browser/content/devtools/widgets/VariablesView.xul";

var VariableSidebar = Class({
  extends: Plugin,

  init: function(host) {
    console.log("ADDING VARIABLE SIDEBAR");
    this.sidebarTab = this.host.addSidebar("variables", VARIABLES_VIEW_URL, true);
    this.sidebarTab.then(window => {
      dump("GOT THE SIDEBAR\n");
      let container = window.document.querySelector("#variables");

      this.host.sidebar.show();
      this.variablesView = new VariablesView(container, {
        searchEnabled: true,
        searchPlaceholder: "Search" // XXX
      });
      this.variablesView.emptyText = "No variable selected.";

      VariablesViewController.attach(this.variablesView, {
        getEnvironmentClient: grip => {
          return new EnvironmentClient(this.client, grip);
        },
        getObjectClient: grip => {
          return new ObjectClient(this.client, grip);
        },
        getLongStringClient: actor => {
          return this.webConsoleClient.longString(actor);
        },
        releaseActor: actor => {
          this.client.release(actor);
        }
      });
      console.log("DONE SETTING UP VARIABLES VIEW");
    }).then(null, console.error);

    this.viewVariable = this.viewVariable.bind(this);
    this.host.pluginMethods.viewVariable = this.viewVariable;
  },

  get client() { return this.host.target.client; },

  viewVariable: function(obj) {

    dump("Viewing variable!\n");
    this.host.showSidebar("variables");

    return this.host.getWebConsoleClient().then(client => {
      this.webConsoleClient = client;
      console.log("got a client");
      return this.sidebarTab;
    }).then(() => {
      console.log("got a sidebar");
      this.variablesView.empty();
      this.variablesView.controller.setSingleVariable({ objectActor: obj }).expanded;
      console.log("Done setting controller");
    });
  }
});
exports.VariableSidebar = VariableSidebar;
registerPlugin(VariableSidebar);
