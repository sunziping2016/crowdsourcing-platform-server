/**
 * 用户模块
 * @module core/user
 */

const ajv = new (require('ajv'))();
const {errorsEnum, coreOkay, coreValidate, coreThrow} = require('./errors');

const createUserSchema = ajv.compile({
  type: 'object',
  required: ['username', 'password', 'email', 'role'],
  properties: {
    username: {type: 'string', pattern: '^[a-zA-Z_0-9]+$'},
    password: {type: 'string', minLength: 8},
    email: {type: 'string', format: 'email'},
    roles: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'subscriber', 'publisher',
          'taskAdmin', 'userAdmin', 'siteAdmin'
        ]},
      uniqueItems: true,
      maxItems: 2
    }
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
 *     - email {string} 如果没有`USER_ADMIN`权限，则必须包含该字段，会发送验证邮件，否则不得包含该字段。
 *     - roles {string[]} 如果没有`USER_ADMIN`权限，则只能包含`subscriber`或`publisher`
 * @param global {object} 全局数据
 * @return {Promise.<object>} 发送验证邮件的时候，`message`为`Verification email sent`；
 *   成功创建用户的时候，`message`为`User created`，如果不`populate`，`data`为用户的`_id`，
 *   否则为整个用户字段。
 */
async function createUser(params, global) {
  const {users, emailSession} = global;
  coreValidate(createUserSchema, params.data);
  const query = {status: {$ne: users.statusEnum.DELETED}};
  if (params.data.email)
    query.$or = [
      {username: params.data.username},
      {email: params.data.email}
    ];
  else
    query.username = params.data.username;
  const duplicatedUser = await users.findOne(query);
  if (duplicatedUser !== null) {
    if (duplicatedUser.username === params.data.username)
      coreThrow(errorsEnum.DUPLICATED, {
        message: 'Username has been taken'
      });
    else
      coreThrow(errorsEnum.DUPLICATED, {
        message: 'Email has been taken'
      });
  }
  await emailSession.removeByIndex({email: params.data.email});
  // const sid = await emailSession.save(params.data);

  return coreOkay('Verification email sent');
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
