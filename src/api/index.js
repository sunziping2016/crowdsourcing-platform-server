/**
 * 这是通过AJAX的方式调用的API的入口。所有AJAX请求的最终处理会交由`core`模块处理。其中`params`
 * 参数包括了以下部分：
 *   - ip {string} 对方的IP
 *   - transport {string} `ajax`
 *   - auth {object} 可选，对方如果提供了`authorization`头，则为解析出的JWT的数据。
 *     如果解析的过程中出错则会直接返回错误。数据包含以下字段：
 *     - uid {string} 用户ID
 *     - jti {string} JWT的ID
 *     - role {Number} 权限
 *     - iat {Number}
 *     - exp {Number}
 *   - query {object} 请求中的query string解析出的对象，支持数组和嵌套对象
 *   - data {object} POST等请求中的body数据，只支持json和urlencoded，某些接口会支持multipart
 *   - id {string} 可选，对于某些会包含ID的请求类型，这是URL中的ID
 *   - file|files 可选，上传的文件，其中文件的值的内容见[Multer文档](https://github.com/expressjs/multer)
 *   - _files {Array.<string>} 这次请求创建的所有临时文件的路径（不仅是上传的文件，比如还包含处理过的图片），
 *     如果返回值不是200或有异常抛出，上述_files中的文件将被删除
 * @module api
 */

const fs = require('fs');
const logger = require('winston');
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

function cleanFiles(files) {
  files.forEach(file =>
    fs.unlink(file, err => {
      if (err) {
        logger.error(`Failed to delete file "${file}".`);
        logger.error(err);
      }
    })
  );
}

module.exports = function (global) {
  const router = new Router();
  const userRouter = new UserRouter(global);
  router.use(errorHandler);
  router.use(bodyParser({
    onerror: (e, ctx) => coreThrow(errorsEnum.PARSE, 'Cannot parse body')
  }));
  router.use(async (ctx, next) => {
    ctx.params = {
      ip: ctx.ip,
      transport: 'ajax',
      _files: []
    };
    if (ctx.request.body)
      ctx.params.data = ctx.request.body;
    if (ctx.query)
      ctx.params.query = ctx.query;
    let token = ctx.headers['authorization'];
    if (token) {
      try {
        token = token.split(/\s+/);
        token = token[token.length - 1];
        ctx.params.auth = await ctx.global.jwt.verify(token);
      } catch (err) {
        ctx.set('WWW-Authenticate', 'Bearer');
        coreThrow(errorsEnum.AUTH, {
          message: err.message
        });
      }
    }
    try {
      await next();
      if (ctx.status !== 200)
        cleanFiles(ctx.params._files);
    } catch (err) {
      cleanFiles(ctx.params._files);
      throw err;
    }
  });
  router.use('/user', userRouter.routes(), userRouter.allowedMethods());
  return router;
};
