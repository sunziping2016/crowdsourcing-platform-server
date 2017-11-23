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
  'bind': function (url) {
    return {
      subject: '请确认绑定您的邮箱',
      text: `点击或在浏览器中打开以下链接以绑定您此邮箱至您的账号：\n${url}`,
      html: `<p>点击<a href="${url}">此处</a>或在浏览器中打开以绑定您此邮箱至您的账号：</p>
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
  required: ['username', 'password'],
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
      maxItems: 5
    }
  },
  additionalProperties: false
});

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

module.exports = {
  createUser
};
