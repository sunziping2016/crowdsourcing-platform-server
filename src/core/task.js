/**
 * 用户模块
 * @module core/task
 */

const ajv = new (require('ajv'))();
const taskTypes = require('./task-types');
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

const createTaskSchema = ajv.compile({
  type: 'object',
  required: ['name', 'description', 'excerption'],
  properties: {
    name: {type: 'string'},
    description: {type: 'string'},
    excerption: {type: 'string', maxLength: 140},
    deadline: {type: 'string', format: 'date-time'},
    type: {type: 'string', enum: Object.keys(taskTypes)},
    tags: {
      type: 'array',
      items: {
        type: 'string'
      },
      maxItems: 5
    }
  },
  additionalProperties: false
});

/**
 * 创建任务。需要具有`PUBLISHER`权限`
 *  - ajax: POST /api/task/:id
 *  - socket.io: emit task:create
 * @param params {object}
 *  - auth {object} 权限
 *  - query {object} 请求query
 *    - populate {boolean} 可选，默认false,返回task id
 *  - files {object} 上传的图片，额外的数据请通过`PATCH`上传
 *    - picture {object} 上传的图片
 *  - data {object} 访问的数据
 *    - name {string} 必须，任务标题
 *    - description {string} 必须，任务描述，Markdown
 *    - excerption {string} 必须，任务摘要，无Markdown，最长只能有140字
 *    - tags {string[]} 可选，标签，最多只有5个
 *    - type {string} 任务类型，如果创建的时候指定了就不能够再次更改
 *    - deadline {string} 可选，失效日期
 * @param global {object}
 *  - tasks {object} Tasks model
 * @return {Promise.<object>} 如果不`populate`，`data`为任务的`_id`，否则为整个任务字段。
 */

async function createTask(params, global) {
  const {tasks, users, config} = global;
  coreAssert(params.auth && (params.auth.role & users.roleEnum.PUBLISHER),
    errorsEnum.PERMISSION, 'Requires publisher privilege');
  coreValidate(querySchema, params.query);
  coreValidate(createTaskSchema, params.data);
  if (params.data.deadline !== undefined)
    params.data.deadline = new Date(params.data.deadline);
  const task = await new tasks(
    Object.assign({}, params.data, {
      valid: false,
      status: tasks.statusEnum.EDITING,
      publisher: params.auth.uid
    })
  );
  if (params.file) {
    const thumbnail = await makeThumbnail(params.file.path, {
      size: [487, 365],
      destination: config['upload-dir']
    });
    params._files.push(thumbnail.path);
    task.picture = params.file.filename;
    task.pictureThumbnail = thumbnail.filename;
  }
  await task.save();
  return coreOkay({
    data: params.query.populate === 'true' ? task.toPlainObject(params.auth) : task._id
  });
}

/**
 * 获取任务详情。如果任务处于未发布状态，只有任务本身的发布者或者任务管理员可以有权限获取。
 *  - ajax: GET /api/task/:id
 *  - socket.io: emit task:get
 * @param params {object}
 *  - auth {object} 权限
 *  - id {string} 要获取详情的任务的id
 * @param global {object}`
 *  - tasks {object} Tasks model
 * @return {Promise.<object>}
 */

async function getTask(params, global) {
  const {tasks, users} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  const task = await tasks.findById(params.id).notDeleted();
  coreAssert(
    task.status === tasks.statusEnum.PUBLISHED ||
      (params.auth && (task.publisher.equals(params.auth.uid) ||
      params.auth.role & users.roleEnum.TASK_ADMIN)),
    errorsEnum.PERMISSION, 'Permission denied'
  );
  coreAssert(task, errorsEnum.INVALID, 'Task not found.');
  return coreOkay(task.toPlainObject(params.auth));
}

const patchTaskSchema = ajv.compile({
  type: 'object',
  properties: {
    name: {type: 'string'},
    description: {type: 'string'},
    excerption: {type: 'string', maxLength: 140},
    deadline: {type: 'string', format: 'date-time'},
    type: {type: 'string', enum: Object.keys(taskTypes)},
    tags: {
      type: 'array',
      items: {
        type: 'string'
      },
      maxItems: 5
    }
  },
  additionalProperties: false
});

/**
 * 修改任务详情。
 *  - ajax: PATCH /api/task/:id
 *  - socket.io: emit task:patch
 * @param params {object}
 *  - id {string} 要修改的任务的id
 *  - query {object}
 *    - populate {boolean} 可选，默认false,返回task id
 *  - data {object} 修改的数据，必须是该任务publisher或TASK_ADMIN才能修改
 *    - name {string} 任务标题
 *    - description {string} 任务描述
 *    - status {number} 任物状态
 *    - expiredAt {date} 失效日期
 *    - tags {[string]} 标签
 * @param global {object}
 *  - tasks {object} Tasks model
 *  - users {object} Users model
 * @return {Promise.<object>}
 */

async function patchTask(params, global) {
  const {tasks, users} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  coreValidate(querySchema, params.query);
  coreValidate(patchTaskSchema, params.data);
  const task = await tasks.findById(params.id).notDeleted();
  coreAssert(task, errorsEnum.EXIST, 'Task does not exist');
  const isPublisher = params.auth && params.auth.uid === task.publisher;
  const isTaskAdmin = params.auth && (params.auth.role & users.roleEnum.TASK_ADMIN);
  coreAssert(isPublisher || isTaskAdmin, errorsEnum.PERMISSION, 'Permission denied');
  await task.set(params.data);
  await task.save();
  return coreOkay({
    data: params.query.populate === 'true' ? task : task._id
  });
}

module.exports = {
  createTask,
  getTask,
  patchTask
};
