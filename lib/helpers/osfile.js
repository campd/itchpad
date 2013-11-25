const { Cu } = require("chrome");
const { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});
module.exports = OS;
