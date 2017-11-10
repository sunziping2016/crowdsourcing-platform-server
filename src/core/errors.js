const ajv = new (require('ajv'))();
const createError = require('http-errors');

const errorsEnum = {
  SCHEMA: 400,
  PARSE: 422,
  INTERNAL: 500
};
Object.keys(errorsEnum).map(key =>
  errorsEnum[key] = {
    code: errorsEnum[key],
    type: key
  }
);

function coreThrow(error, data) {
  if (typeof data === 'string')
    data = {message: data};
  const err = createError(error.code, data.message);
  data.code = error.code;
  data.type = error.type;
  err.data = data;
  throw err;
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
  coreThrow,
  coreValidate,
  coreAssert
};
