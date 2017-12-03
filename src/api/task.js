const Router = require('koa-router');
const coreTask = require('../core/task');

async function getTask(ctx) {
  ctx.body = await coreTask.getTask(ctx.params, ctx.global);
}

module.exports = function () {
  const router = new Router();
  router.get('/', getTask);
  router.post('/', getTask);
  return router;
};
