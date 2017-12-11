/**
 * 邮箱模块
 * @module core/email
 */
const url = require('url');
const ajv = new (require('ajv'))();
const bcrypt = require('bcrypt');
const {errorsEnum, coreOkay, coreValidate, coreThrow, coreAssert} = require('./errors');
const {escapeHtml} = require('../utils');

const sidRegex = /^[a-zA-Z_0-9]{40}$/;

const emailTemplates = {
  createUser(url) {
    const escapedUrl = escapeHtml(url);
    return {
      subject: '请确认您的账号',
      text: `点击或在浏览器中打开以下链接以激活您的账号：\n${url}`,
      html: `<p>点击<a href="${escapedUrl}">此处</a>或在浏览器中打开以下链接以激活您的账号：</p>
             <p><a href="${escapedUrl}">${escapedUrl}</a></p>`
    };
  },
  resetPassword(url) {
    const escapedUrl = escapeHtml(url);
    return {
      subject: '请重置您的密码',
      text: `点击或在浏览器中打开以下链接以重置您账号的密码：\n${url}`,
      html: `<p>点击<a href="${escapedUrl}">此处</a>或在浏览器中打开以下链接以重置您账号的密码：</p>
             <p><a href="${escapedUrl}">${escapedUrl}</a></p>`
    };
  }
};

const sendEmailSchema = ajv.compile({
  type: 'object',
  required: ['action', 'email', 'to'],
  properties: {
    action: {type: 'string', enum: ['create-user', 'reset-password']},
    email: {type: 'string', format: 'email'},
    to: {type: 'string'},
    username: {type: 'string', pattern: '^[a-zA-Z_0-9]+$'},
    password: {type: 'string', minLength: 8},
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
});

/**
 * 发送邮件，用于创建用户或重置密码。通过以下两种方式暴露：
 *   - ajax: POST /api/email
 *   - socket.io: emit email:create
 * @param params {object} 请求数据
 *   - data {object} 请求的data
 *     - action {string} `create-user`或`reset-password`
 *     - email {string} 发送验证邮件
 *     - to {string} 邮件跳转的地址，必须符合同源要求
 *     - username {string} 如果是`create-user`，则英文数字下线符，不能为空
 *     - password {string} 如果是`create-user`，则长度必须大于8
 *     - roles {string[]} 如果是`create-user`，则只能包含`SUBSCRIBER`或`PUBLISHER`
 * @param global {object} 全局数据
 * @return {Promise<object>}
 */
async function sendEmail(params, global) {
  const {config, users, email} = global;
  coreValidate(sendEmailSchema, params.data);
  const to = new url.URL(params.data.to || '/', config.site);
  coreAssert(to.origin === config.site, errorsEnum.SCHEMA, 'Cross site redirection');
  const isCreateUser = params.data.action === 'create-user';
  coreAssert(isCreateUser === (params.data.username !== undefined),
    errorsEnum.SCHEMA, 'Invalid username field');
  coreAssert(isCreateUser === (params.data.password !== undefined),
    errorsEnum.SCHEMA, 'Invalid password field');
  coreAssert(isCreateUser === (params.data.roles !== undefined),
    errorsEnum.SCHEMA, 'Invalid roles field');
  if (isCreateUser) {
    const {createUserSession} = global;
    const duplicatedUser = await users.findOne({
      $or: [
        {username: params.data.username},
        {email: params.data.email}
      ]
    }).notDeleted();
    if (duplicatedUser)
      coreThrow(errorsEnum.INVALID,
        duplicatedUser.username === params.data.username
          ? 'Username has been taken' : 'Email has been taken'
      );
    params.data.password = await bcrypt.hash(params.data.password, 10);
    let role = 0;
    params.data.roles.forEach(x => role |= users.roleEnum[x]);
    params.data.roles = role;
    await createUserSession.removeByIndex({email: params.data.email});
    const token = await createUserSession.save(params.data);
    to.searchParams.set('token', token);
    to.searchParams.set('action', 'create-user');
    const template = Object.assign({}, emailTemplates.createUser(to.href), {
      from: `"${config.name}" <${config.email.auth.user}>`,
      to: params.data.email
    });
    await email.sendMail(template);
    return coreOkay();
  } else {
    const {resetPasswordSession} = global;
    const user = await users.findOne({email: params.data.email}).notDeleted();
    coreAssert(user, errorsEnum.INVALID, 'User does not exist');
    await resetPasswordSession.removeByIndex({email: params.data.email});
    const token = await resetPasswordSession.save({
      email: params.data.email,
      id: user._id.toString()
    });
    to.searchParams.set('token', token);
    to.searchParams.set('action', 'reset-password');
    const template = Object.assign({}, emailTemplates.resetPassword(to.href), {
      from: `"${config.name}" <${config.email.auth.user}>`,
      to: params.data.email
    });
    await email.sendMail(template);
    return coreOkay();
  }
}

const confirmEmailSchema = ajv.compile({
  type: 'object',
  required: ['action'],
  properties: {
    action: {type: 'string', enum: ['create-user', 'reset-password']},
    password: {type: 'string', minLength: 8}
  },
  additionalProperties: false
});

/**
 * 确认邮件链接，并执行对应的操作。通过以下两种方式暴露：
 *   - ajax: POST /api/email/:id
 *   - socket.io: confirm-email
 * @param params {object} 请求数据
 *  - id {string} 回话的id，长度为40
 *  - data {object} 请求的token
 *    - action {string} `create-user`或`reset-password`
 *    - password {string} `reset-password`时，为新的密码，长度至少为8。否则不能存在
 * @param global {object}
 * @return {Promise<object>}
 */
async function confirmEmail(params, global) {
  const {users} = global;
  coreValidate(confirmEmailSchema, params.data);
  coreAssert((params.data.action === 'create-user') === (params.data.password === undefined),
    errorsEnum.SCHEMA, 'Invalid password field');
  coreAssert(params.id && sidRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid token field');
  if (params.data.action === 'create-user') {
    const {createUserSession} = global;
    const data = await createUserSession.loadAndRemove(params.id);
    coreAssert(data, errorsEnum.EXIST, 'Invalid token');
    data.role = parseInt(data.role);
    const duplicatedUser = await users.findOne({
      $or: [
        {username: data.username},
        {email: data.email}
      ]
    }).notDeleted();
    if (duplicatedUser)
      coreThrow(errorsEnum.INVALID,
        duplicatedUser.username === data.username
          ? 'Username has been taken' : 'Email has been taken'
      );
    const user = new users(data);
    await user.save();
    return coreOkay();
  } else {
    const {resetPasswordSession, jwt} = global;
    const data = await resetPasswordSession.loadAndRemove(params.id);
    coreAssert(data, errorsEnum.EXIST, 'Invalid token');
    const user = await users.findById(data.id).notDeleted();
    coreAssert(user, errorsEnum.INVALID, 'User does not exist');
    user.password = await bcrypt.hash(params.data.password, 10);
    await jwt.revoke(data.id);
    await user.save();
    return coreOkay();
  }
}

module.exports = {
  emailTemplates,
  sendEmail,
  confirmEmail
};
