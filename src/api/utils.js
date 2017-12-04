/**
 * 一些`api`模块的辅助函数
 * @module api/utils
 */

/**
 * 把`core`模块下的函数转换为Koa的中间件
 * @param func {function}
 */
function coreToMiddleware(func) {
  return async function createUser(ctx) {
    ctx.body = await func(ctx.params, ctx.global);
  };
}

module.exports = {
  coreToMiddleware
};
