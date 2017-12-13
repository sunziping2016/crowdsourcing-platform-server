const fs = require('fs');
const path = require('path');
const logger = require('winston');
const decache = require('decache');
const {promisify} = require('./utils');
const ajv = new (require('ajv'))();

const ignore = new Set(['.gitignore']);

const metaSchema = ajv.compile({
  type: 'object',
  required: ['name', 'id'],
  properties: {
    name: {type: 'string', minLength: 1},
    id: {type: 'string', pattern: '^[-_a-zA-Z\\d]+$'},
    enabled: {type: 'boolean'}
  }
});

async function loadTaskTemplates(dir) {
  const results = {files: {}, ids: {}};
  (await promisify(fs.readdir)(dir))
    .filter(x => !ignore.has(x))
    .forEach(x => {
      try {
        const filename = path.resolve(dir, x);
        const template = require(filename);
        if (!metaSchema(template.meta))
          // noinspection ExceptionCaughtLocallyJS
          throw new Error(ajv.errorsText(metaSchema.errors));
        template.meta.filename = filename;
        template.meta.enabled = template.meta.enabled || true;
        results.ids[template.meta.id] = template;
        results.files[filename] = template;
      } catch (err) {
        logger.error(`Failed to load task template "${x}"`);
        logger.error(err);
      }
    });
  return results;
}

function loadTaskTemplate(dir, file, results) {
  const filename = path.resolve(dir, file);
  if (results.files[filename] !== undefined) {
    delete results.ids[results.files[filename].meta.id];
    delete results.files[filename];
    decache(filename);
  }
  const template = require(filename);
  if (!metaSchema(template.meta))
    // noinspection ExceptionCaughtLocallyJS
    throw new Error(ajv.errorsText(metaSchema.errors));
  template.meta.filename = filename;
  template.meta.enabled = template.meta.enabled || true;
  if (results.ids[template.meta.id] !== undefined)
    throw new Error('Id collision');
  results.ids[template.meta.id] = template;
  results.files[filename] = template;
}

module.exports = {
  loadTaskTemplates,
  loadTaskTemplate
};
