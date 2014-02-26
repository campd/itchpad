const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const promise = require("helpers/promise");

const Editor  = require("devtools/sourceeditor/editor");

const { Cu } = require("chrome");
const { VariablesView } = Cu.import("resource:///modules/devtools/VariablesView.jsm", {});
const { ObjectClient } = Cu.import("resource://gre/modules/devtools/dbg-client.jsm", {});
const { EnvironmentClient } = Cu.import("resource://gre/modules/devtools/dbg-client.jsm", {});

var Notify = Class({
  extends: Plugin,

  init: function(host) {
    this.host.addCommand({
      id: "cmd-hide-sidebar",
      key: "VK_ESCAPE"
    });
    this.host.pluginMethods.notify = this;
    this.host.createElement("splitter", {
      parent: "#shells",
      class: "devtools-horizontal-splitter",
    });
    this.div = this.host.createElement("div", {
      parent: "#shells",
      class: "output-pane",
      flex: 1,
      hidden: "true",
    });

  },

  get client() { return this.host.target.client },

  showPane: function() {
    this.div.removeAttribute("hidden");
    if (!this.editor) {
      this.editor = new Editor({
        mode: Editor.modes.text,
        lineWrapping: true,
        readOnly: true
      });
      this.appended = this.editor.appendTo(this.div);
    }
    return this.appended;
  },

  hidePane: function() {
    this.div.setAttribute("hidden", "true");
  },

  onCommand: function(cmd) {
    if (cmd === "cmd-hide-sidebar") {
      this.host.hideSidebar();
      this.hidePane();
    }
  },

  info: function(item) {
    this.showPane();
    return this._writePrimitive(item).then(this._append.bind(this));
  },

  error: function(item) {
    this.showPane();
    return this._writeError(item).then(this._append.bind(this));
  },

  _append: function(value) {
    return this.appended.then(() => {
      let editor = this.editor;
      let line = editor.lineCount();
      editor.replaceText(value + "\n", { line: line, col: 0 });
      editor.setFirstVisibleLine(line);
    });
  },

  _writePrimitive: function(value) {
    let deferred = promise.defer();
    if (value.type == "longString") {
      this.host.getWebConsoleClient().then(client => {
        client.longString(value).substring(0, value.length, response => {
          if (response.error) {
            console.error("Display failed: " + response.error + " " + response.message);
            deferred.reject(response);
          } else {
            deferred.resolve(response.substring);
          }
        });
      });
    } else {
      deferred.resolve(value.type || value);
    }

    return deferred.promise;
  },


  _writeError: function(error) {
    let deferred = promise.defer();

    if (VariablesView.isPrimitive({ value: error })) {
      let type = error.type;
      if (type == "undefined" ||
          type == "null" ||
          type == "Infinity" ||
          type == "-Infinity" ||
          type == "NaN" ||
          type == "-0") {
        deferred.resolve(type);
      } else if (type == "longString") {
        deferred.resolve(error.initial + "\u2026");
      } else {
        deferred.resolve(error);
      }
    } else {
      let objectClient = new ObjectClient(this.client, error);
      objectClient.getPrototypeAndProperties(response => {
        if (response.error) {
          deferred.reject(response);
          return;
        }

        let { ownProperties, safeGetterValues } = response;
        let error = Object.create(null);

        // Combine all the property descriptor/getter values into one object.
        for (let key of Object.keys(safeGetterValues)) {
          error[key] = safeGetterValues[key].getterValue;
        }

        for (let key of Object.keys(ownProperties)) {
          error[key] = ownProperties[key].value;
        }

        // Assemble the best possible stack we can given the properties we have.
        let stack;
        if (typeof error.stack == "string") {
          stack = error.stack;
        } else if (typeof error.fileName == "number") {
          stack = "@" + error.fileName;
          if (typeof error.lineNumber == "number") {
            stack += ":" + error.lineNumber;
          }
        } else if (typeof error.lineNumber == "number") {
          stack = "@" + error.lineNumber;
        }

        stack = stack ? "\n" + stack.replace(/\n$/, "") : "";

        if (typeof error.message == "string") {
          deferred.resolve(error.message + stack);
        } else {
          objectClient.getDisplayString(response => {
            if (response.error) {
              deferred.reject(response);
            } else if (typeof response.displayString == "string") {
              deferred.resolve(response.displayString + stack);
            } else {
              deferred.resolve(stack);
            }
          });
        }
      });
    }

    return deferred.promise.then(value => "Exception: " + value);
  },
});
exports.Notify = Notify;

registerPlugin(Notify);
