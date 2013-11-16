importScripts("resource://gre/modules/osfile.jsm");

function readDir(path, ignore) {
  let ret = {};

  let set = new Set();

  let info = OS.File.stat(path);
  info.path = path;
  set.add(info);

  for (let info of set) {
    let children = [];

    if (info.isDir && !info.isSymLink) {
      let iterator = new OS.File.DirectoryIterator(info.path);
      try {
        for (let child in iterator) {
          if (ignore && child.name.match(ignore)) {
            continue;
          }

          children.push(child.path);
          set.add(child);
        }
      } finally {
        iterator.close();
      }
    }

    ret[info.path] = {
      name: info.name,
      isDir: info.isDir,
      isSymLink: info.isSymLink,
      children: children
    };
  }

  return ret;
};

onmessage = function (event) {
  postMessage(readDir(event.data.path, event.data.ignore));
};


