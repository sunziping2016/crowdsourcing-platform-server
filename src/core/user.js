/**
 * 用户模块
 * @module core/user
 */

const ajv = new (require('ajv'))();
const bcrypt = require('bcrypt');
const {errorsEnum, coreOkay, coreValidate, coreAssert} = require('./errors');
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
    username: {type: 'string', pattern: '^[a-zA-Z_\\d]+$'},
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
  coreAssert(duplicatedUser === null, errorsEnum.INVALID, 'Username has been taken');
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
 *   - id {string} 要获取的用户信息的Email has been takenID
 * @param global
 * @return {Promise.<object>}
 */
async function getUser(params, global) {
  const {users} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  const user = await users.findById(params.id).notDeleted();
  coreAssert(user, errorsEnum.EXIST, 'User does not exist');
  return coreOkay({
    data: user.toPlainObject(params.auth)
  });
}

const findUserSchema = ajv.compile({
  type: 'object',
  properties: {
    populate: {type: 'string', enum: ['false', 'true']},
    count: {type: 'string', enum: ['false', 'true']},
    filter: {
      type: 'object',
      properties: {
        search: {type: 'string'},
        username: {type: 'string'},
        email: {type: 'string'},
        role: {
          type: 'string',
          enum: ['SUBSCRIBER', 'PUBLISHER', 'TASK_ADMIN', 'USER_ADMIN', 'SITE_ADMIN']
        },
        blocked: {type: 'string', enum: ['true', 'false']}
      },
      additionalProperties: false
    },
    limit: {type: 'string', pattern: '^\\d+$'},
    lastId: {type: 'string', pattern: '[a-fA-F\\d]{24}'}
  },
  additionalProperties: false
});

/**
 * 搜索用户，通过以下两种方式暴露：
 *   - ajax: GET /api/user
 *   - socket.io: emit user:find
 * @param params 请求数据
 *   - auth {object} 权限，必须拥有userAdmin
 *   - query {object} 请求的query
 *     - populate {boolean} 是否展开数据
 *     - count {boolean} 统计总数，需要额外的开销
 *     - filter {Object.<string, string|Array<string>>}
 *         - search {string} 全文检索
 *         - username {string}
 *         - email {string}
 *         - role {string} 权限，某个值
 *         - blocked {boolean}
 *     - limit {number} 可选，小于等于50大于0数字，默认为10
 *     - lastId {string} 可选，请求的上一个Id
 * @param global
 * @return {Promise<object>} `data`为返回的数组，`lastId`为最后一个元素的`_id`
 * `total`为总数（需要count为1）。
 */
async function findUser(params, global) {
  const {users} = global;
  coreAssert(params.auth && (params.auth.role & users.roleEnum.USER_ADMIN),
    errorsEnum.PERMISSION, 'Requires user admin privilege');
  coreValidate(findUserSchema, params.query);
  let limit;
  if (params.query.limit !== undefined) {
    limit = parseInt(params.query.limit);
    coreAssert(limit > 0 && limit < 50, errorsEnum.SCHEMA, 'Invalid limit');
  } else
    limit = 10;
  if (params.query.filter !== undefined) {
    if (params.query.filter.search !== undefined) {
      const search = params.query.filter.search
        .split(/\s+/).filter(x => x)
        .map(x => new RegExp(x.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&'), 'i'));
      delete params.query.filter.search;
      if (search.length !== 0) {
        const or = params.query.filter.$or = params.query.filter.$or || [];
        search.forEach(x => {
          or.push({username: {$regex: x}});
          or.push({email: {$regex: x}});
        });
      }
    }
    if (params.query.filter.role !== undefined) {
      params.query.filter.roles = {
        $bitsAllSet: users.roleEnum[params.query.filter.role]
      };
      delete params.query.filter.role;
    }
    if (params.query.filter.blocked !== undefined) {
      const blocked = params.query.filter.blocked === 'true';
      if (blocked)
        params.query.filter.blocked = true;
      else
        params.query.filter.blocked = {$ne: true};
    }
  } else
    params.query.filter = {};
  const result = {};
  if (params.query.lastId !== undefined) {
    params.query.filter._id = {$gt: params.query.lastId};
    result.lastId = params.query.lastId;
  }
  if (params.query.populate === 'true') {
    result.data = (await users.find(params.query.filter)
      .notDeleted()
      .sort({_id: 1})
      .limit(limit)).map(x => x.toPlainObject(params.auth));
    if (result.data.length !== 0)
      result.lastId = result.data[result.data.length - 1]._id;
  } else {
    result.data = (await users.find(params.query.filter)
      .notDeleted()
      .sort({_id: 1})
      .select({_id: 1})
      .limit(limit)).map(x => x._id);
    if (result.data.length !== 0)
      result.lastId = result.data[result.data.length - 1];
  }
  if (params.query.count === 'true') {
    delete params.query.filter._id;
    result.total = await users.count(params.query.filter).notDeleted();
  }
  return coreOkay({data: result});
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
  coreAssert((params.data.password === undefined && params.file === undefined) || isSelf,
    errorsEnum.PERMISSION, 'Requires self privilege');
  coreAssert((params.data.blocked === undefined && params.data.roles === undefined) ||
    isUserAdmin, errorsEnum.PERMISSION, 'Requires user admin privilege');
  const user = await users.findById(params.id).notDeleted();
  coreAssert(user, errorsEnum.EXIST, 'User does not exist');
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
 *   - id {string} 用户的ID
 * @param global
 * @return {Promise<object>}
 */
async function deleteUser(params, global) {
  const {jwt, users} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  coreAssert(params.auth && (params.auth.role & users.roleEnum.USER_ADMIN),
    errorsEnum.PERMISSION, 'Requires user admin privilege');
  const user = await users.findById(params.id).notDeleted();
  coreAssert(user, errorsEnum.EXIST, 'User does not exist');
  await jwt.revoke(params.id);
  await user.delete();
  return coreOkay();
}

/**
 * 获取某个用户的个人数据，必须是该用户本人。通过以下两种方式暴露
 *   - ajax: GET /api/user/:id/data
 *   - socket.io: emit user:getData
 * @param params 请求数据
 *   - auth {object} 权限
 *   - id {string} 用户的ID
 * @param global
 * @return {Promise<object>}
 */
async function getUserData(params, global) {
  const {users} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  coreAssert(params.auth && params.auth.uid === params.id,
    errorsEnum.PERMISSION, 'Permission denied');
  const user = await users.findById(params.id).notDeleted().select('+data');
  coreAssert(user, errorsEnum.EXIST, 'User does not exist');
  return coreOkay({
    data: user.data || {}
  });
}

const postUserDataSchema = ajv.compile({
  type: 'object',
  properties: {
    history: {
      type: 'array',
      items: {type: 'string', pattern: '[a-fA-F\\d]{24}'},
      maxItems: 50
    },
    favorites: {
      type: 'array',
      items: {type: 'string', pattern: '[a-fA-F\\d]{24}'},
      maxItems: 50
    }
  },
  additionalProperties: false
});

/**
 * 设置某个用户的个人数据，必须是该用户本人。通过以下两种方式暴露
 *   - ajax: POST /api/user/:id/data
 *   - socket.io: emit user:setData
 * @param params 请求数据
 *   - auth {object} 权限
 *   - id {string} 用户的ID
 *   - data {object} 请求的data
 *     - history {string[]} 看过的历史，最多50条
 *     - favorites {string[]} 喜爱的，最多50条
 * @param global
 * @return {Promise<object>}
 */
async function postUserData(params, global) {
  const {users} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  coreAssert(params.auth && params.auth.uid === params.id,
    errorsEnum.PERMISSION, 'Permission denied');
  coreValidate(postUserDataSchema, params.data);
  const user = await users.findById(params.id).notDeleted().select('+data');
  coreAssert(user, errorsEnum.EXIST, 'User does not exist');
  user.data = params.data;
  user.markModified('data');
  await user.save();
  return coreOkay();
}

module.exports = {
  createUser,
  getUser,
  findUser,
  patchUser,
  deleteUser,
  getUserData,
  postUserData
};
