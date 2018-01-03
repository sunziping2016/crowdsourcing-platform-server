const Router = require('koa-router');
const coreTaskType = require('../core/task-type');
const multer = require('./multer');
const {coreToMiddleware} = require('./utils');

module.exports = function (global) {
  const router = new Router();
  const scriptMulter = multer({
    destination: global.config['task-template-dir'],
    types: ['application/javascript'],
    maxSize: 1024 * 1024
  }).single('script');
  router.get('/', coreToMiddleware(coreTaskType.getTaskTypes));
  router.post('/', scriptMulter, coreToMiddleware(coreTaskType.createTaskType));
  router.patch('/:id', coreToMiddleware(coreTaskType.patchTaskType));
  router.delete('/:id', coreToMiddleware(coreTaskType.deleteTaskType));
  return router;
};
