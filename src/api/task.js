const Router = require('koa-router');
const coreTask = require('../core/task');
const {coreToMiddleware} = require('./utils');

module.exports = function () {
  const router = new Router();
  router.post('/', coreToMiddleware(coreTask.createTask));
  router.get('/:id', coreToMiddleware(coreTask.getTask));
  router.patch('/:id', coreToMiddleware(coreTask.patchTask));
  return router;
};

