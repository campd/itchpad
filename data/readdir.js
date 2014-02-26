importScripts("resource://gre/modules/osfile.jsm");

function readDir(path, ignore, maxDepth = Infinity) {
  let ret = {};

  let set = new Set();

  let info = OS.File.stat(path);
  set.add({
    path: path,
    name: info.name,
    isDir: info.isDir,
    isSymLink: info.isSymLink,
    depth: 0
  });

  for (let info of set) {
    let children = [];

    if (info.isDir && !info.isSymLink) {
      if (info.depth > maxDepth) {
        continue;
      }

      let iterator = new OS.File.DirectoryIterator(info.path);
      try {
        for (let child in iterator) {
          if (ignore && child.name.match(ignore)) {
            continue;
          }

          children.push(child.path);
          set.add({
            path: child.path,
            name: child.name,
            isDir: child.isDir,
            isSymLink: child.isSymLink,
            depth: info.depth + 1
          });
        }
      } finally {
        iterator.close();
      }
    }

    ret[info.path] = {
      name: info.name,
      isDir: info.isDir,
      isSymLink: info.isSymLink,
      depth: info.depth,
      children: children,
    };
  }

  return ret;
};

onmessage = function (event) {
  try {
    let {path, ignore, depth} = event.data;
    let message = readDir(path, ignore, depth);
    postMessage(message);
  } catch(ex) {
    console.log(ex);
  }
};


