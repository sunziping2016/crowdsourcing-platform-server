const ajv = new (require('ajv'))();
const createError = require('http-errors');

const errorsEnum = {
  OK: 200,
  INVALID: 400,
  SCHEMA: 400,
  PARSE: 422,
  AUTH: 401,
  PERMISSION: 400,
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
