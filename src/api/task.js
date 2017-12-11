const Router = require('koa-router');
const coreTask = require('../core/task');
const multer = require('./multer');
const {coreToMiddleware} = require('./utils');

module.exports = function (global) {
  const router = new Router();
  const pictureMulter = multer({
    destination: global.config['upload-dir'],
    types: ['image/png', 'image/gif', 'image/jpeg'],
    maxSize: 10 * 1024 * 1024,
    fields: {
      tags: x => JSON.parse(x)
    }
  }).single('picture');
  const pictureAndDataMulter = multer({
    destination: {
      picture: global.config['upload-dir'],
      data: global.config['temp-dir']
    },
    types: {
      picture: ['image/png', 'image/gif', 'image/jpeg'],
      data: ['application/zip', 'application/octet-stream']
    },
    maxSize: {
      picture: 10 * 1024 * 1024,
      data: 1024 * 1024 * 1024
    },
    fields: {
      tags: x => JSON.parse(x)
    }
  }).fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'data', maxCount: 1 }
  ]);
  router.post('/', pictureMulter, coreToMiddleware(coreTask.createTask));
  router.get('/:id', coreToMiddleware(coreTask.getTask));
  router.patch('/:id', pictureAndDataMulter, coreToMiddleware(coreTask.patchTask));
  return router;
};
