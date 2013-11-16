// ... until sdk/core/promise uses Promise.jsm...

const { Cu } = require("chrome");
const { Promise } = Cu.import("resource://gre/modules/Promise.jsm", {});
module.exports = Promise;
