const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const {errorsEnum, coreThrow} = require('../core/errors');
const UserRouter = require('./user');

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
  const userRouter = new UserRouter();
  router.use(errorHandler);
  router.use(bodyParser({
    onerror: (e, ctx) => {
      coreThrow(errorsEnum.PARSE, 'Cannot parse body');
    }
  }));
  router.use((ctx, next) => {
    ctx.params = {
      ip: ctx.ip,
      transport: 'ajax'
    };
    if (ctx.request.body)
      ctx.params.data = ctx.request.body;
    if (ctx.query)
      ctx.params.query = ctx.query;
    return next();
  });
  router.use('/user', userRouter.routes(), userRouter.allowedMethods());
  return router;
};
