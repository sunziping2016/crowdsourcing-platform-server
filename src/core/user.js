/**
 * 用户模块
 * @module core/user
 */

const ajv = new (require('ajv'))();
const {errorsEnum, coreValidate, coreThrow} = require('./errors');

/*
const emailTemplates = {
  'register': function (url) {
    return {
      subject: '请确认您的账号',
      text: `点击或在浏览器中打开以下链接以激活您的账号：\n${url}`,
      html: `<p>点击<a href="${url}">此处</a>或在浏览器中打开以下链接以激活您的账号：</p>
           <p><a href="${url}">${url}</a></p>`
    };
  },
  'reset-password': function (url) {
    return {
      subject: '请重置您的密码',
      text: `点击或在浏览器中打开以下链接以重置您账号的密码：\n${url}`,
      html: `<p>点击<a href="${url}">此处</a>或在浏览器中打开以下链接以重置您账号的密码：</p>
           <p><a href="${url}">${url}</a></p>`
    };
  }
};
*/

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
 * 创建用户。如果拥有`USER_ADMIN`权限则试图直接创建，并通知userAdmin组，否则会发送验证邮件。通过以下两种方式暴露：
 *   - ajax: POST /api/user
 *   - socket.io: emit user:create
 * @param params {object} 请求数据
 *   - auth {object} 可选，权限
 *   - query {object} 请求的query
 *     - populate {boolean} 可选，默认false
 *   - data {object} 请求的data
 *     - username {string} 必须，必须是英文数字下线符，不能为空
 *     - password {string} 必须，长度必须大于8
 *     - email {string} 如果没有`USER_ADMIN`权限，则必须包含该字段，会发送验证邮件
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

  return Object.assign({}, errorsEnum.OK, {
    message: 'Verification email sent'
  });
}

/**
 * 获取某个用户的信息。如果请求的是自己的话，返回的内容会额外包含`email`和`settings`字段。如果
 * 拥有`USER_ADMIN`权限，会额外包含`email`，通过以下两种方式暴露：
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

async function patchUser(params, global) {
}

async function deleteUser(params, global) {
}

module.exports = {
  createUser,
  getUser,
  patchUser,
  deleteUser
};
