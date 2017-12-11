/**
 * 在处理的时候，请求的结果可能包含以下情况：
 *   - `200 OK`：成功处理了请求，此时
 *   - `400 SCHEMA`：请求的格式不符合要求，或文件格式、大小不符合要求等可以预料到的错误
 *   - `400 INVALID`：请求在更高一层次上出现了违法，不可预料到的错误，比如用户名冲突、密码冲突
 *   - `400 PERMISSION`：请求的权限不够（认证信息是对的，但需要更高的权限）
 *   - `401 AUTH`：请求附带的认证信息出错，比如认证信息已被撤回，需要设置`WWW-Authenticate`头
 *   - `404 EXIST`：请求附带的ID字段未找到（一定是URL中的ID字段）
 *   - `405 METHOD`：不支持的请求方式，需要设置`Allow`头
 *   - `422 PARSE`：请求解析出错，如非法的JSON格式，请求体太大
 *   - `500 INTERNAL`：服务器内部错误
 *
 * 其中，`AUTH`、`PARSE`和`INTERNAL`由外部的中间件处理，不应在具体的事务处理过程中抛出。
 * `SCHEMA`由一些中间件和辅助函数处理，不是很建议手动处理。
 *
 * @module core/errors
 */
const ajv = new (require('ajv'))();
const createError = require('http-errors');

const errorsEnum = {
  OK: 200,
  SCHEMA: 400,
  INVALID: 400,
  PERMISSION: 400,
  AUTH: 401,
  EXIST: 404,
  PARSE: 422,
  INTERNAL: 500
};
Object.keys(errorsEnum).map(key =>
  errorsEnum[key] = {
    code: errorsEnum[key],
    type: key
  }
);

function coreOkay(data) {
  if (data === undefined)
    data = {};
  else if (typeof data === 'string')
    data = {message: data};
  return Object.assign({}, errorsEnum.OK, data);
}

function coreCreateError(error, data) {
  if (typeof data === 'string')
    data = {message: data};
  const err = createError(error.code, data.message);
  data.type = error.type;
  err.data = data;
  return err;
}

function coreThrow(error, data) {
  throw coreCreateError(error, data);
}

function coreValidate(schema, data) {
  if (!schema(data))
    coreThrow(errorsEnum.SCHEMA, {
      message: ajv.errorsText(schema.errors),
      data: schema.errors
    });
}

function coreAssert(predict, error, data) {
  if (!predict)
    coreThrow(error, data);
}

module.exports = {
  errorsEnum,
  coreOkay,
  coreCreateError,
  coreThrow,
  coreValidate,
  coreAssert
};
