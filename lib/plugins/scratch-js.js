const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const timers = require("sdk/timers");

const { Promise } = Cu.import("resource://gre/modules/Promise.jsm", {});
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// XXX: This timeout should probably go up into itchpad.
const REMOTE_TIMEOUT = require("sdk/preferences/service").get("devtools.debugger.remote-timeout");

var ScratchpadJS = Class({
  extends: Plugin,

  init: function(host) {
    let group = host.createToolbarGroup({
      parent: "plugin-toolbar-left"
    });

    this.showForCategories(group, ["js"]);

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
      this.evaluate(text);
    }
  },

  evaluate: function(aString) {
    let target = this.host.target;
    if (!target) {
      return;
    }

    let connection = ScratchpadTarget.consoleFor(target);

    let evalOptions = { url: "NOTUNIQUE" };

    return connection.then(({ debuggerClient, webConsoleClient }) => {
     let deferred = Promise.defer();

      webConsoleClient.evaluateJS(aString, aResponse => {
        this.debuggerClient = debuggerClient;
        this.webConsoleClient = webConsoleClient;
        if (aResponse.error) {
          deferred.reject(aResponse);
        }
        else if (aResponse.exception !== null) {
          deferred.resolve([aString, aResponse]);
        }
        else {
          deferred.resolve([aString, undefined, aResponse.result]);
        }
      }, evalOptions);

      return deferred.promise;
    }).then(null, console.error);
  }
});

/**
 * Represents the DebuggerClient connection to a specific tab as used by the
 * Scratchpad.
 *
 * @param object aTab
 *              The tab to connect to.
 */
var ScratchpadTarget = Class({
  initialize: function(aTarget) {
    this._target = aTarget;
    this._connector = null;
  },

  /**
   * Initialize a debugger client and connect it to the debugger server.
   *
   * @return Promise
   *         The promise for the result of connecting to this tab or window.
   */
  connect: function ST_connect()
  {
    if (this._connector) {
      return this._connector;
    }

    let deferred = Promise.defer();
    this._connector = deferred.promise;

    let connectTimer = timers.setTimeout(() => {
      deferred.reject({
        error: "timeout",
        message: Scratchpad.strings.GetStringFromName("connectionTimeout"),
      });
    }, REMOTE_TIMEOUT);

    deferred.promise.then(() => timers.clearTimeout(connectTimer));

    this._attach().then(aTarget => {
      let consoleActor = aTarget.form.consoleActor;
      let client = aTarget.client;
      client.attachConsole(consoleActor, [], (aResponse, aWebConsoleClient) => {
        if (aResponse.error) {
          reportError("attachConsole", aResponse);
          deferred.reject(aResponse);
        }
        else {
          deferred.resolve({
            webConsoleClient: aWebConsoleClient,
            debuggerClient: client
          });
        }
      });
    });

    return deferred.promise;
  },

  /**
   * Attach to this tab.
   *
   * @return Promise
   *         The promise for the TabTarget for this tab.
   */
  _attach: function ST__attach()
  {
    if (this._target.isRemote) {
      return Promise.resolve(this._target);
    }
    return this._target.makeRemote().then(() => this._target);
  }
});

let scratchpadTargets = new WeakMap();
ScratchpadTarget.consoleFor = function consoleFor(aSubject)
{
  if (!scratchpadTargets.has(aSubject)) {
    scratchpadTargets.set(aSubject, new this(aSubject));
  }
  return scratchpadTargets.get(aSubject).connect();
};


exports.ScratchpadJS = ScratchpadJS;
registerPlugin(ScratchpadJS);
