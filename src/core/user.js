/**
 * 用户模块
 * @module core/user
 */

const ajv = new (require('ajv'))();
const bcrypt = require('bcrypt');
const {errorsEnum, coreOkay, coreValidate, coreThrow, coreAssert} = require('./errors');
const {makeThumbnail} = require('./utils');

const idRegex = /^[a-f\d]{24}$/i;

const querySchema = ajv.compile({
  type: 'object',
  properties: {
    populate: {type: 'string', enum: ['false', 'true']}
  },
  additionalProperties: false
});

const createUserSchema = ajv.compile({
  type: 'object',
  required: ['username', 'password', 'roles'],
  properties: {
    username: {type: 'string', pattern: '^[a-zA-Z_0-9]+$'},
    password: {type: 'string', minLength: 8},
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
});

/**
 * 创建用户。必须拥有`USER_ADMIN`权限。通过以下两种方式暴露：
 *   - ajax: POST /api/user
 *   - socket.io: emit user:create
 * @param params {object} 请求数据
 *   - auth {object} 权限
 *   - query {object} 请求的query
 *     - populate {boolean} 可选，默认false
 *   - data {object} 请求的data
 *     - username {string} 必须，必须是英文数字下线符，不能为空
 *     - password {string} 必须，长度必须大于8
 *     - roles {string[]} 权限
 * @param global {object} 全局数据
 * @return {Promise.<object>} 如果不`populate`，`data`为用户的`_id`，否则为整个用户字段。
 */
async function createUser(params, global) {
  const {users} = global;
  coreAssert(params.auth && (params.auth.role & users.roleEnum.USER_ADMIN),
    errorsEnum.PERMISSION, 'Requires user admin privilege');
  coreValidate(querySchema, params.query);
  coreValidate(createUserSchema, params.data);
  const duplicatedUser = await users.findOne({username: params.data.username}).notDeleted();
  if (duplicatedUser)
    coreThrow(errorsEnum.INVALID,
      duplicatedUser.username === params.data.username
        ? 'Username has been taken' : 'Email has been taken'
    );
  params.data.password = await bcrypt.hash(params.data.password, 10);
  let role = 0;
  params.data.roles.forEach(x => role |= users.roleEnum[x]);
  params.data.roles = role;
  const user = new users(params.data);
  await user.save();
  return coreOkay({
    data: params.query.populate === 'true'
      ? user.toPlainObject(params.auth) : user._id
  });
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
  const {users} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  const user = await users.findById(params.id).notDeleted();
  coreAssert(user, errorsEnum.INVALID, 'User does not exist');
  return coreOkay({
    data: user.toPlainObject(params.auth)
  });
}

const patchUserSchema = ajv.compile({
  type: 'object',
  properties: {
    password: {type: 'string', minLength: 8},
    blocked: {type: 'boolean'},
    roles: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['SUBSCRIBER', 'PUBLISHER', 'TASK_ADMIN',
          'USER_ADMIN', 'SITE_ADMIN']
      },
      uniqueItems: true
    },
    settings: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  additionalProperties: false
});

/**
 * 修改某个用户的信息，如果信息中包含了password或者roles，会导致用户的JWT被清空。通过以下两种方式暴露：
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
  const {config, users, jwt} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  coreValidate(querySchema, params.query);
  coreValidate(patchUserSchema, params.data);
  const isSelf = params.auth && params.auth.uid === params.id;
  const isUserAdmin = params.auth && (params.auth.role & users.roleEnum.USER_ADMIN);
  coreAssert(isSelf || isUserAdmin, errorsEnum.PERMISSION, 'Permission denied');
  coreAssert((params.data.password === undefined && params.data.settings === undefined &&
    params.file === undefined) || isSelf, errorsEnum.PERMISSION, 'Requires self privilege');
  coreAssert((params.data.blocked === undefined && params.data.roles === undefined) ||
    isUserAdmin, errorsEnum.PERMISSION, 'Requires user admin privilege');
  const user = await users.findById(params.id).notDeleted();
  coreAssert(user, errorsEnum.INVALID, 'User does not exist');
  let refreshJWT = false;
  if (params.data.password !== undefined) {
    user.password = await bcrypt.hash(params.data.password, 10);
    refreshJWT = true;
  }
  if (params.data.blocked !== undefined && user.blocked !== params.data.blocked) {
    user.blocked = params.data.blocked;
    refreshJWT = true;
  }
  if (params.data.roles !== undefined) {
    let role = 0;
    params.data.roles.forEach(x => role |= users.roleEnum[x]);
    if (user.roles !== role) {
      user.roles = role;
      refreshJWT = true;
    }
  }
  if (params.file) {
    const thumbnail = await makeThumbnail(params.file.path, {
      size: [64, 64],
      destination: config['upload-dir']
    });
    params._files.push(thumbnail.path);
    user.avatar = params.file.filename;
    user.avatarThumbnail64 = thumbnail.filename;
  }
  if (refreshJWT)
    await jwt.revoke(params.id);
  if (params.data.settings)
    Object.assign(user.settings, params.data.settings);
  await user.save();
  return coreOkay({
    data: params.query.populate === 'true'
      ? user.toPlainObject(params.auth) : user._id
  });
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
  const {jwt, users} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  coreAssert(params.auth && (params.auth.role & users.roleEnum.USER_ADMIN),
    errorsEnum.PERMISSION, 'Requires user admin privilege');
  const user = await users.findById(params.id).notDeleted();
  coreAssert(user, errorsEnum.INVALID, 'User does not exist');
  await jwt.revoke(params.id);
  await user.delete();
  return coreOkay();
}

module.exports = {
  createUser,
  getUser,
  patchUser,
  deleteUser
};
