module.exports = {};

['guess-number'].forEach(x =>
  module.exports[x] = require('./' + x)
);
