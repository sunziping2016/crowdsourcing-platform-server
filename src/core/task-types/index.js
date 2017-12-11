module.exports = {};

['image-categorize', 'image-collection', 'survey'].forEach(x =>
  module.exports[x] = require('./' + x)
);
