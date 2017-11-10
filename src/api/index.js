const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const {errorsEnum, coreThrow} = require('../core/errors');

async function errorHandler(ctx, next) {
  try {
    await next();
  } catch (err) {
    if (err.expose === true) {
      ctx.status = err.status || 500;
      ctx.type = 'json';
      if (err.data)
        ctx.body = JSON.stringify(err.data);
      else
        ctx.body = err.message;
    } else {
      ctx.status = 500;
      ctx.type = 'json';
      ctx.body = JSON.stringify({
        code: 500,
        type: 'INTERNAL',
        message: 'Internal server error'
      });
      ctx.app.emit('error', err, ctx);
    }
  }
}

module.exports = function () {
  const router = new Router();
  router.use(errorHandler);
  router.use(bodyParser({
    onerror: (e, ctx) => {
      coreThrow(errorsEnum.PARSE, 'Cannot parse body');
    }
  }));
  return router;
};
