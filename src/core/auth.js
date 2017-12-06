/**
 * 验证模块
 * @module core/auth
 */

const ajv = new (require('ajv'))();
const {errorsEnum, coreOkay, coreValidate, coreThrow, coreAssert} = require('./errors');

const authenticateSchema = {
  basic: ajv.compile({
    type: 'object',
    required: ['strategy', 'payload'],
    properties: {
      strategy: {type: 'string', enum: ['username', 'email', 'jwt']},
      payload: {type: 'object'}
    },
    additionalProperties: false
  }),
  username: ajv.compile({
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: {type: 'string', pattern: '^[a-zA-Z_0-9]+$'},
      password: {type: 'string', minLength: 8}
    },
    additionalProperties: false
  }),
  email: ajv.compile({
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {type: 'string', format: 'email'},
      password: {type: 'string', minLength: 8}
    },
    additionalProperties: false
  }),
  jwt: ajv.compile({
    type: 'object',
    required: ['jwt'],
    properties: {
      jwt: {type: 'string'}
    },
    additionalProperties: false
  })
};

/**
 * 验证用户，并颁发JWT。通过以下两种方式暴露：
 *   - ajax: POST /api/auth
 *   - socket.io: emit auth
 * @param params {object} 请求数据
 *   - data {object} 请求的data
 *     - strategy {string} 可以为`username`、`email`、`jwt`
 *     - payload {object} 如果`strategy`为`local`，则为{username,password}或
 *       {email,password}；如果`strategy`为`{jwt}`则重新续`jwt`的使用时间
 * @param global {object}
 * @return {Promise<object>} data 为新的JWT。
 */
async function authenticate(params, global) {
  const {jwt, users} = global;
  coreValidate(authenticateSchema.basic, params.data);
  coreValidate(authenticateSchema[params.data.strategy], params.data.payload);
  if (params.data.strategy === 'jwt') {
    let data;
    try {
      data = await jwt.verify(params.data.payload.jwt);
    } catch (err) {
      coreThrow(errorsEnum.INVALID, err.message);
    }
    await jwt.revoke(data.uid, data.jti);
    const user = await users.findById(data.uid).notDeleted();
    coreAssert(user, errorsEnum.INVALID, 'User does not exist');
    const token = await jwt.sign({uid: data.uid, role: user.roles}, {
      expiresIn: '10d'
    });
    return coreOkay({data: token});
  } else {
    const password = params.data.payload.password;
    delete params.data.payload.password;
    const user = await users.findOne(params.data.payload).notDeleted();
    coreAssert(user, errorsEnum.INVALID, 'User does not exist');
    coreAssert(await user.checkPassword(password), errorsEnum.INVALID, 'Wrong password');
    const token = await jwt.sign({uid: user._id.toString(), role: user.roles}, {
      expiresIn: '10d'
    });
    return coreOkay({data: token});
  }
}

module.exports = {
  authenticate
};
