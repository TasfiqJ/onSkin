// query-string 7 consumes a callable CommonJS export. Keep the supported
// upstream decoder intact and adapt only its module export shape.
module.exports = require('decode-uri-component').default;
