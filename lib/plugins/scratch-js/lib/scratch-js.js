const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const timers = require("sdk/timers");
const promise = require("helpers/promise");

const { VariablesView } = Cu.import("resource:///modules/devtools/VariablesView.jsm", {});

const { XPCOMUtils } = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});

var ScratchpadJS = Class({
  extends: Plugin,

  init: function(host) {
    let group = host.createToolbarGroup({
      parent: "#plugin-toolbar-right",
      hidden: true // XXX: hide scratchpad buttons for now
    });

    this.showForCategories(group, ["js"]);

    this.host.addCommand({
      id: "sp-cmd-run",
      key: "r",
      modifiers: "accel"
    });
    this.host.addCommand({
      id: "sp-cmd-inspect",
      key: "i",
      modifiers: "accel"
    });

    host.createToolbarButton({
      parent: group,
      label: "Run",
      command: "sp-cmd-run"
    });
    host.createToolbarButton({
      parent: group,
      label: "Inspect",
      command: "sp-cmd-inspect"
    });
    host.createToolbarButton({
      parent: group,
      label: "Display",
      command: "sp-cmd-run"
    });
  },

  onCommand: function(cmd) {
    if (cmd === "sp-cmd-run") {
      let editor = this.host.currentEditor.editor;
      let text = editor.getSelection() || editor.getText();
      this.evaluate(text);
    } else if (cmd === "sp-cmd-inspect") {
      let editor = this.host.currentEditor.editor;
      let text = editor.getSelection() || editor.getText();
      this.inspect(text);
    }
  },

  evaluate: function(string) {
    let target = this.host.target;
    if (!target) {
      return;
    }

    let evalOptions = { url: "NOTUNIQUE" };

    return this.host.getWebConsoleClient().then(consoleClient => {
     let deferred = promise.defer();

      consoleClient.evaluateJS(string, response => {
        if (response.error) {
          deferred.reject(response);
        }
        else if (response.exception !== null) {
          deferred.resolve([string, response]);
        }
        else {
          deferred.resolve([string, undefined, response.result]);
        }
      }, evalOptions);

      return deferred.promise;
    }).then(null, console.error);
  },

  display: function(string) {
    return this.evaluate(string);
  },

  inspect: function(string) {
    if (!this.host.pluginMethods.viewVariable) {
      return this.display(string);
    }

    this.evaluate(string).then(([string, error, result]) => {
      if (error) {
        this.host.pluginMethods.notify.error(error.exception);
      } else if (VariablesView.isPrimitive({value: result})) {
        this.host.pluginMethods.notify.info(result);
      } else {
        this.host.pluginMethods.viewVariable(result);
      }
    });
  }
});

exports.ScratchpadJS = ScratchpadJS;
registerPlugin(ScratchpadJS);
