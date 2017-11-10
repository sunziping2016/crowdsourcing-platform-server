/**
 * Koa日志工具
 *
 * @module koa-logger
 */
const chalk = require('chalk');
const logger = require('winston');
const STATUS_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green'
};

/**
 * Koa性能测试的中间件。打印请求处理的总体时间和返回的状态码。
 *
 * @param ctx {Koa.context}
 * @param next {function}
 * @return {Promise.<void>}
 */
async function koaLogger(ctx, next) {
  const start = new Date();
  let status;
  try {
    await next();
    status = ctx.status;
  } catch (err) {
    status = err.status || 500;
    throw err;
  } finally {
    const duration = new Date() - start;
    let logLevel;
    if (status >= 500)
      logLevel = 'error';
    else if (status >= 400)
      logLevel = 'warn';
    else
      logLevel = 'info';
    const msg = chalk.gray(`${ctx.method} ${ctx.originalUrl}`) +
      chalk[STATUS_COLORS[logLevel]](` ${status} `) +
      chalk.gray(`${duration}ms`);
    logger.log(logLevel, msg);
  }
}

module.exports = koaLogger;
