/**
 * 专门用于处理`multipart/form-data`请求，对[`express/multer`](https://github.com/expressjs/multer)进行简单的封装
 * 这种请求主要用于文件上传。
 *
 * 部分代码借鉴了[`koa-modules/multer`](https://github.com/koa-modules/multer)。
 *
 * @module api/multer
 */
const originalMulter = require('multer');
const mime = require('mime-types');
const {errorsEnum, coreCreateError, coreThrow} = require('../core/errors');
const {randomAlnumString, promisify} = require('../utils');

/**
 * 初始化一个multer对象。
 *
 * @param options {object} 选项，包含以下内容：
 *   - destination {string} 上传文件路径
 *   - length {Number} 可选，随机文件名的长度，默认为40
 *   - types {Array.<string>} 可选，允许的mime-types，默认不做限定
 *   - maxSize {Number} 可选，最大文件的字节数，默认不做限定
 *   - fields {Object.<string, function>} 可选，某些非文件字段的转换函数，用以从字符串
 *     转换为对应的类型
 */
function multer(options) {
  options.length = options.length || 40;
  options.fields = options.fields || {};
  const multerOptions = {
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, options.destination);
      },
      filename: function (req, file, cb) {
        let name = randomAlnumString(options.length);
        const ext = mime.extension(file.mimetype);
        if (ext)
          name += '.' + ext;
        cb(null, name);
      }
    }),
    fileFilter: function (req, file, cb) {
      if (options.types && options.types.indexOf(file.mimetype) === -1)
        cb(coreCreateError(errorsEnum.SCHEMA, 'Wrong file type'));
      else
        cb(null, true);
    }
  };
  if (options.maxSize)
    multerOptions.limits = {fileSize: options.maxSize};
  const m = originalMulter(multerOptions);
  ['any', 'array', 'fields', 'none', 'single'].forEach(name => {
    if (!m[name])
      return;
    const fn = m[name];
    m[name] = function () {
      const middleware = promisify(fn.apply(this, arguments));
      return (ctx, next) => {
        return middleware(ctx.req, ctx.res).catch(err => {
          if (err.message === 'File too large')
            coreThrow(errorsEnum.SCHEMA, 'File too large');
          else if (err.message === 'Unexpected field')
            coreThrow(errorsEnum.SCHEMA, 'Unexpected field');
          else
            throw err;
        }).then(() => {
          if (ctx.req.file) {
            ctx.params.file = ctx.req.file;
            ctx.params._files.push(ctx.req.file.path);
          } if (Array.isArray(ctx.req.files)) {
            ctx.params.files = ctx.req.files;
            ctx.req.files.forEach(file => ctx.params._files.push(file.path));
          } else if (typeof ctx.req.files === 'object') {
            ctx.params.files = ctx.req.files;
            Object.values(ctx.req.files).forEach(files =>
              files.forEach(file => ctx.params._files.push(file.path))
            );
          }
          if (ctx.req.body) {
            const body = {};
            try {
              Object.keys(ctx.req.body).forEach(key => {
                if (options.fields[key])
                  body[key] = options.fields[key](ctx.req.body[key]);
                else
                  body[key] = ctx.req.body[key];
              });
            } catch (err) {
              coreThrow(errorsEnum.SCHEMA, 'Wrong field type');
            }
            ctx.params.data = body;
          }
        }).then(next);
      };
    };
  });
  return m;
}

multer.diskStorage = originalMulter.diskStorage;
multer.memoryStorage = originalMulter.memoryStorage;

module.exports = multer;
