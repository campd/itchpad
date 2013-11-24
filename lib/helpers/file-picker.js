const { Cu, Cc, Ci } = require("chrome");
const { FileUtils } = Cu.import("resource://gre/modules/FileUtils.jsm", {});
const promise = require("helpers/promise");
const { merge } = require("sdk/util/object");

function showPicker(options) {
  let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  if (options.directory) {
    try {
      fp.displayDirectory = FileUtils.File(options.directory);
    } catch(ex) {
      console.warn(ex);
    }
  }

  if (options.defaultName) {
    fp.defaultString = options.defaultName;
  }

  fp.init(options.window, options.title, options.mode);
  let deferred = promise.defer();
  fp.open({
    done: function(res) {
      if (res === Ci.nsIFilePicker.returnOK || res === Ci.nsIFilePicker.returnReplace) {
        deferred.resolve(fp.file.path);
      } else {
        deferred.reject();
      }
    }
  });
  return deferred.promise;
}
exports.showPicker = showPicker;

function showSave(options) {
  return showPicker(merge({
    title: "Select a File",
    mode: Ci.nsIFilePicker.modeSave
  }, options));
}
exports.showSave = showSave;

function showOpen(options) {
  return showPicker(merge({
    title: "Open a File",
    mode: Ci.nsIFilePicker.modeOpen
  }, options));
}
exports.showOpen = showOpen;

function showOpenFolder(options) {
  return showPicker(merge({
    title: "Select a Folder",
    mode: Ci.nsIFilePicker.modeGetFolder
  }, options));
}
exports.showOpenFolder = showOpenFolder;
