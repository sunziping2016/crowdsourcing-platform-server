/**
 * 用户模块
 * @module core/user
 */

const url = require('url');
const ajv = new (require('ajv'))();
const bcrypt = require('bcrypt');
const {errorsEnum, coreOkay, coreValidate, coreThrow, coreAssert} = require('./errors');
const {emailTemplates} = require('./email');

const createUserSchema = [
  ajv.compile({
    type: 'object',
    required: ['username', 'password', 'email', 'roles'],
    properties: {
      username: {type: 'string', pattern: '^[a-zA-Z_0-9]+$'},
      password: {type: 'string', minLength: 8},
      email: {type: 'string', format: 'email'},
      roles: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['SUBSCRIBER', 'PUBLISHER']
        },
        uniqueItems: true
      }
    },
    additionalProperties: false
  }),
  ajv.compile({
    type: 'object',
    required: ['username', 'password', 'roles'],
    properties: {
      username: {type: 'string', pattern: '^[a-zA-Z_0-9]+$'},
      password: {type: 'string', minLength: 8},
      email: {type: 'string', format: 'email'},
      roles: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['SUBSCRIBER', 'PUBLISHER', 'TASK_ADMIN',
            'USER_ADMIN', 'SITE_ADMIN']
        },
        uniqueItems: true
      }
    },
    additionalProperties: false
  })
];
const createUserQuerySchema = ajv.compile({
  type: 'object',
  properties: {
    populate: {type: 'string', enum: ['false', 'true']},
    to: {type: 'string'}
  },
  additionalProperties: false
});

/**
 * 创建用户。如果拥有`USER_ADMIN`权限则试图直接创建，否则会发送验证邮件。通过以下两种方式暴露：
 *   - ajax: POST /api/user
 *   - socket.io: emit user:create
 * @param params {object} 请求数据
 *   - auth {object} 可选，权限
 *   - query {object} 请求的query
 *     - populate {boolean} 可选，默认false
 *     - to {string}，邮件跳转的URL，必须符合同源要求
 *   - data {object} 请求的data
 *     - username {string} 必须，必须是英文数字下线符，不能为空
 *     - password {string} 必须，长度必须大于8
 *     - email {string} 如果没有`USER_ADMIN`权限，则必须包含该字段，会发送验证邮件。
 *       否则为可选字段。格式必须为email的格式
 *     - roles {string[]} 如果没有`USER_ADMIN`权限，则只能包含`SUBSCRIBER`或`PUBLISHER`
 * @param global {object} 全局数据
 * @return {Promise.<object>} 发送验证邮件的时候，`message`为`Verification email sent`；
 *   成功创建用户的时候，`message`为`User created`，如果不`populate`，`data`为用户的`_id`，
 *   否则为整个用户字段。
 */
async function createUser(params, global) {
  const {config, users, email, createUserSession} = global;
  const isUserAdmin = params.auth && (params.auth.role &
    users.roleEnum.USER_ADMIN) !== 0;
  coreValidate(createUserQuerySchema, params.query);
  coreValidate(createUserSchema[isUserAdmin ? 1 : 0], params.data);
  if (!isUserAdmin) {
    params.query.to = new url.URL(params.query.to || '/', config.site);
    coreAssert(params.query.to.origin === config.site, errorsEnum.SCHEMA, 'Cross site redirection');
  }
  const query = {};
  if (params.data.email)
    query.$or = [
      {username: params.data.username},
      {email: params.data.email}
    ];
  else
    query.username = params.data.username;
  const duplicatedUser = await users.findOne(query).notDeleted();
  if (duplicatedUser !== null) {
    if (duplicatedUser.username === params.data.username)
      coreThrow(errorsEnum.INVALID, {
        message: 'Username has been taken'
      });
    else
      coreThrow(errorsEnum.INVALID, {
        message: 'Email has been taken'
      });
  }
  params.data.password = await bcrypt.hash(params.data.password, 10);
  let role = 0;
  params.data.roles.forEach(x => role |= users.roleEnum[x]);
  params.data.roles = role;
  if (isUserAdmin) {
    const user = new users(params.data);
    await user.save();
    return coreOkay({
      message: 'User created',
      data: params.query.populate ? user.toPlainObject(params.auth) : user._id
    });
  } else {
    await createUserSession.removeByIndex({email: params.data.email});
    const token = await createUserSession.save(params.data);
    const to = params.query.to;
    to.searchParams.set('token', token);
    to.searchParams.set('action', 'create-user');
    const template = Object.assign({}, emailTemplates.createUser(to.href), {
      from: `"${config.name}" <${config.email.auth.user}>`,
      to: params.data.email
    });
    await email.sendMail(template);
    return coreOkay('Verification email sent');
  }
}

/**
 * 获取某个用户的信息。通过以下两种方式暴露：
 *   - ajax: GET /api/user/:id
 *   - socket.io: emit user:get
 * @param params 请求数据
 *   - auth {object} 权限
 *   - id {string} 要获取的用户信息的ID
 * @param global
 * @return {Promise.<object>}
 */
async function getUser(params, global) {
}

/**
 * 修改某个用户的信息，如果信息中包含了password，会导致用户的JWT被清空。通过以下两种方式暴露：
 *   - ajax: PATCH /api/user/:id
 *   - socket.io: emit user:patch
 * @param params 请求数据
 *   - auth {object} 权限
 *   - id {string} 要获取的用户信息
 *   - query {object} 请求的query
 *     - populate {boolean} 可选，默认false。为假时返回的data是id，为真时，返回的data
 *   - data {object} 请求的data
 *     - password {string} 必须是自己的才能修改
 *     - blocked {boolean} 必须拥有`USER_ADMIN`权限
 *     - roles {Array.<string>} 必须拥有`USER_ADMIN`权限
 *     - settings {object} 必须是自己的才能修改
 *   - file {object} 请求的文件，这里作为头像
 * @param global
 * @return {Promise<object>}
 */
async function patchUser(params, global) {
}

/**
 * 删除某个用户，必须拥有`USER_ADMIN`。通过以下两种方式暴露
 *   - ajax: DELETE /api/user/:id
 *   - socket.io: emit user:delete
 * @param params 请求数据
 *   - auth {object} 权限
 *   - id {string} 要获取的用户信息
 * @param global
 * @return {Promise<object>}
 */
async function deleteUser(params, global) {
}

module.exports = {
  createUser,
  getUser,
  patchUser,
  deleteUser
};
