/**
 * 任务模块。这里任务的接口分为两类，一类是通用接口，一类是特殊接口。
 * @module core/task
 */

const ajv = new (require('ajv'))();
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

const dataSchema = ajv.compile({
  type: 'object',
  properties: {
    data: {type: 'string', enum: ['false', 'true']}
  },
  additionalProperties: false
});

const createTaskSchema = ajv.compile({
  type: 'object',
  required: ['name', 'description', 'excerption'],
  properties: {
    name: {type: 'string', minLength: 1},
    description: {type: 'string', minLength: 1},
    excerption: {type: 'string', minLength: 1, maxLength: 140},
    deadline: {type: 'string', format: 'date-time'},
    type: {type: 'string'},
    tags: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1
      },
      uniqueItems: true,
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
  const {tasks, users, config, taskTemplates} = global;
  coreAssert(params.auth && (params.auth.role & users.roleEnum.PUBLISHER),
    errorsEnum.PERMISSION, 'Requires publisher privilege');
  coreValidate(querySchema, params.query);
  coreValidate(createTaskSchema, params.data);
  coreAssert(params.data.type === undefined ||
    (taskTemplates[params.data.type] !== undefined &&
      taskTemplates[params.data.type].meta.enabled), errorsEnum.INVALID, {
    message: 'Invalid type',
    data: Object.keys(taskTemplates)
  });
  if (params.data.deadline !== undefined)
    params.data.deadline = new Date(params.data.deadline);
  const task = await new tasks(
    Object.assign({
      valid: false,
      status: tasks.statusEnum.EDITING,
      publisher: params.auth.uid
    }, params.data)
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
 * @param global {object}
 *  - tasks {object} Tasks model
 * @return {Promise<object>}
 */
async function getTask(params, global) {
  const {tasks, users} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  const task = await tasks.findById(params.id).notDeleted();
  coreAssert(task, errorsEnum.EXIST, 'Task does not exist');
  coreAssert(
    task.status === tasks.statusEnum.PUBLISHED ||
      (params.auth && (task.publisher.equals(params.auth.uid) ||
      params.auth.role & users.roleEnum.TASK_ADMIN)),
    errorsEnum.PERMISSION, 'Permission denied'
  );
  return coreOkay({
    data: task.toPlainObject(params.auth)
  });
}

const findTaskSchema = ajv.compile({
  type: 'object',
  properties: {
    populate: {type: 'string', enum: ['false', 'true']},
    count: {type: 'string', enum: ['false', 'true']},
    filter: {
      type: 'object',
      properties: {
        search: {type: 'string'},
        name: {type: 'string', minLength: 1},
        publisher: {type: 'string', pattern: '[a-fA-F\\d]{24}'},
        tag: {type: 'string', minLength: 1},
        type: {type: 'string'},
        deadline: {
          type: 'object',
          properties: {
            from: {type: 'string', format: 'date-time'},
            to: {type: 'string', format: 'date-time'}
          },
          additionalProperties: false
        },
        status: {type: 'string', enum: ['EDITING', 'SUBMITTED', 'ADMITTED', 'PUBLISHED']},
        completed: {type: 'string', enum: ['true', 'false']}
      },
      additionalProperties: false
    },
    limit: {type: 'string', pattern: '^\\d+$'},
    lastId: {type: 'string', pattern: '[a-fA-F\\d]{24}'}
  },
  additionalProperties: false
});

/**
 * 搜索任务，通过以下两种方式暴露：
 *   - ajax：GET /api/task
 *   - socket.io: emit task:find
 * @param params 请求数据
 *   - auth {object} 权限
 *   - query {object} 请求的query
 *     - populate {boolean} 是否展开数据
 *     - count {boolean} 统计总数，需要额外的开销
 *     - filter {Object.<string, string|Array<string>>}
 *         - search {string} 全文检索
 *         - name {string}
 *         - publisher {string} 对于发布者，这个值只能是自己。必须拥有TASK_ADMIN权限
 *           才能设置别的值，考虑对于同时有两权限的用户的请求一致性，建议以发布者身份搜索时永远设置这个值，
 *           以普通用户身份搜索时，请不要附带权限信息。
 *         - tag {string} 包含某个标签
 *         - type {string}
 *         - deadline {{from:string, to:string}} 某个时间范围，无deadline等价于deadline无穷
 *         - status 对于普通用户，这个值只能是`PUBLISHED`，而发布者和任务管理员可以设置别的值，
 *           同样考虑多种权限的用户的请求一致性，建议以普通用户搜索时永远设置这个值。
 *         - completed {boolean} 对于没有进度概念的，等价于永远未完成
 *     - limit {number} 可选，小于等于50大于0数字，默认为10
 *     - lastId {string} 可选，请求的上一个Id
 * @param global
 * @return {Promise<object>}
 */
async function findTask(params, global) {
  const {tasks, users} = global;
  coreValidate(findTaskSchema, params.query);
  let role; // 0 for subscriber, 1 for publisher, 2 for task admin
  if (!params.auth)
    role = 0;
  else if (params.auth.role & users.roleEnum.TASK_ADMIN)
    role = 2;
  else if (params.auth.role & users.roleEnum.PUBLISHER)
    role = 1;
  else
    coreThrow(errorsEnum.PERMISSION, 'Permission denied');
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
          or.push({name: {$regex: x}});
          or.push({description: {$regex: x}});
          or.push({excerption: {$regex: x}});
        });
      }
    }
    if (params.query.filter.tag !== undefined) {
      params.query.filter.tags = params.query.filter.tag;
      delete params.query.filter.tag;
    }
    if (params.query.filter.deadline !== undefined) {
      const from = params.query.filter.deadline.from;
      const to = params.query.filter.deadline.to;
      delete params.query.filter.deadline.from;
      delete params.query.filter.deadline.to;
      if (from !== undefined && to !== undefined) {
        params.query.filter.$and = params.query.filter.$and || [];
        params.query.filter.$and.push({deadline: {$gte: new Date(from)}});
        params.query.filter.$and.push({deadline: {$lte: new Date(to)}});
      } else if (to !== undefined)
        params.query.filter.deadline = {$lte: new Date(to)};
      else if (from !== undefined) {
        params.query.filter.$or = params.query.filter.$or || [];
        params.query.filter.$or.push({deadline: {$exists: false}});
        params.query.filter.$or.push({deadline: {$gte: new Date(from)}});
      }
    }
    if (params.query.filter.status !== undefined)
      params.query.filter.status = tasks.statusEnum[params.query.filter.status];
    if (params.query.filter.completed !== undefined) {
      const completed = params.query.filter.completed;
      delete params.query.filter.completed;
      params.query.filter.$or = params.query.filter.$or || [];
      params.query.filter.$or.push({remain: {$exists: false}});
      if (completed)
        params.query.filter.$or.push({remain: {$lte: 0}});
      else
        params.query.filter.$or.push({remain: {$gt: 0}});
    }
  } else
    params.query.filter = {};
  if (role === 1) {
    if (params.query.filter.publisher !== undefined)
      coreAssert(params.query.filter.publisher === params.auth.uid,
        errorsEnum.SCHEMA, 'Invalid publisher');
    else
      params.query.filter.publisher = params.auth.uid;
  } else if (role === 0) {
    if (params.query.filter.status !== undefined)
      coreAssert(params.query.filter.status === tasks.statusEnum.PUBLISHED,
        errorsEnum.SCHEMA, 'Invalid status');
    else
      params.query.filter.status = tasks.statusEnum.PUBLISHED;
  }
  const result = {};
  if (params.query.lastId !== undefined) {
    params.query.filter._id = {$gt: params.query.lastId};
    result.lastId = params.query.lastId;
  }
  if (params.query.populate === 'true') {
    result.data = (await tasks.find(params.query.filter)
      .notDeleted()
      .sort({_id: 1})
      .limit(limit)).map(x => x.toPlainObject(params.auth));
    if (result.data.length !== 0)
      result.lastId = result.data[result.data.length - 1]._id;
  } else {
    result.data = (await tasks.find(params.query.filter)
      .notDeleted()
      .sort({_id: 1})
      .select({_id: 1})
      .limit(limit)).map(x => x._id);
    if (result.data.length !== 0)
      result.lastId = result.data[result.data.length - 1];
  }
  if (params.query.count === 'true') {
    delete params.query.filter._id;
    result.total = await tasks.count(params.query.filter).notDeleted();
  }
  return coreOkay({data: result});
}

const patchTaskSchema = ajv.compile({
  type: 'object',
  properties: {
    name: {type: 'string', minLength: 1},
    description: {type: 'string', minLength: 1},
    excerption: {type: 'string', minLength: 1, maxLength: 140},
    deadline: {type: ['string', 'null'], format: 'date-time'},
    type: {type: 'string'},
    tags: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1
      },
      uniqueItems: true,
      maxItems: 5
    },
    status: {type: 'string', enum: ['EDITING', 'SUBMITTED', 'ADMITTED', 'PUBLISHED']}
  },
  additionalProperties: false
});

/**
 * 修改任务详情。任务的拥有者能修改`EDITING`时的任务信息，type只能从无到有，状态可由`EDITING`
 * 转换为`SUBMITTED`，同时该任务必须是valid的，也可在`ADMITTED`的更改任务状态为`EDITING`
 * 或者`PUBLISHED`。任务管理员可以将任务的状态由`SUBMITTED`改成`EDITING`或者`ADMITTED`。
 *  - ajax: PATCH /api/task/:id
 *  - socket.io: emit task:patch
 * @param params {object}
 *  - id {string} 要修改的任务的id
 *  - query {object}
 *    - populate {boolean} 可选，默认false,返回task id
 *  - data {object} 修改的数据，必须是该任务publisher或TASK_ADMIN才能修改
 *    - name {string} 必须，任务标题
 *    - description {string} 任务描述，Markdown
 *    - excerption {string} 任务摘要，无Markdown，最长只能有140字
 *    - tags {string[]} 标签，最多只有5个
 *    - type {string} 任务类型，如果创建的时候指定了就不能够再次更改
 *    - deadline {string|null} 可选，失效日期
 *    - status {string} 任务状态，`EDITING`，`SUBMITTED`，`ADMITTED`和`PUBLISHED`
 * @param global {object}
 *  - tasks {object} Tasks model
 * @return {Promise.<object>}
 */

async function patchTask(params, global) {
  const {tasks, users, taskTemplates} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  coreValidate(querySchema, params.query);
  coreValidate(patchTaskSchema, params.data);
  coreAssert(params.auth && (params.auth.role & (users.roleEnum.TASK_ADMIN |
    users.roleEnum.PUBLISHER)), errorsEnum.PERMISSION, 'Permission denied');
  const task = await tasks.findById(params.id).notDeleted();
  coreAssert(task, errorsEnum.EXIST, 'Task does not exist');
  const isPublisher = task.publisher.equals(params.auth.uid);
  const isTaskAdmin = !!(params.auth.role & users.roleEnum.TASK_ADMIN);
  coreAssert(isPublisher || isTaskAdmin, errorsEnum.PERMISSION, 'Permission denied');
  const isUpdateInfo = params.data.name !== undefined || params.data.description !== undefined ||
    params.data.excerption !== undefined || params.data.deadline !== undefined ||
    params.data.type !== undefined || params.data.tags !== undefined;
  coreAssert(!isUpdateInfo || isPublisher,
    errorsEnum.PERMISSION, 'Requires self privilege');
  coreAssert(!isUpdateInfo || task.status === tasks.statusEnum.EDITING,
    errorsEnum.INVALID, 'Task is not at EDITING status');
  if (params.data.type !== undefined) {
    coreAssert(task.type === undefined, errorsEnum.INVALID, 'Task already has a type');
    coreAssert(taskTemplates[params.data.type] !== undefined &&
        taskTemplates[params.data.type].meta.enabled, errorsEnum.INVALID, {
      message: 'Invalid type',
      data: Object.keys(taskTemplates)
    });
  }
  if (params.data.deadline !== undefined) {
    if (params.data.deadline === null)
      params.data.deadline = undefined;
    else
      params.data.deadline = new Date(params.data.deadline);
  }
  if (params.data.status !== undefined) {
    params.data.status = tasks.statusEnum[params.data.status];
    if (params.data.status === task.status)
      delete params.data.status;
  }
  coreAssert(params.data.status !== tasks.statusEnum.EDITING ||
    (isPublisher && task.status === tasks.statusEnum.ADMITTED) ||
    (isTaskAdmin && task.status === tasks.statusEnum.SUBMITTED),
    // eslint-disable-next-line indent
    errorsEnum.INVALID, 'Invalid status');
  coreAssert(params.data.status !== tasks.statusEnum.SUBMITTED ||
    (isPublisher && task.status === tasks.statusEnum.EDITING && task.valid),
    // eslint-disable-next-line indent
    errorsEnum.INVALID, 'Invalid status');
  coreAssert(params.data.status !== tasks.statusEnum.ADMITTED ||
    (isTaskAdmin && task.status === tasks.statusEnum.SUBMITTED),
    // eslint-disable-next-line indent
    errorsEnum.INVALID, 'Invalid status');
  coreAssert(params.data.status !== tasks.statusEnum.PUBLISHED ||
    (isPublisher && task.status === tasks.statusEnum.ADMITTED),
    // eslint-disable-next-line indent
    errorsEnum.INVALID, 'Invalid status');
  Object.assign(task, params.data);
  await task.save();
  return coreOkay({
    data: params.query.populate === 'true' ? task.toPlainObject(params.auth) : task._id
  });
}

/**
 * 删除任务，必须为publisher或者拥有`TASK_ADMIN`权限
 * @param params
 * @param global
 * @return {Promise<void>}
 */
async function deleteTask(params, global) {
  const {tasks, users} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  coreAssert(params.auth && (params.auth.role & (users.roleEnum.TASK_ADMIN |
    users.roleEnum.PUBLISHER)), errorsEnum.PERMISSION, 'Permission denied');
  const task = await tasks.findById(params.id).notDeleted();
  coreAssert(task, errorsEnum.EXIST, 'Task does not exist');
  const isPublisher = task.publisher.equals(params.auth.uid);
  const isTaskAdmin = !!(params.auth.role & users.roleEnum.TASK_ADMIN);
  coreAssert(isPublisher || isTaskAdmin, errorsEnum.PERMISSION, 'Permission denied');
  await task.delete();
  return coreOkay();
}

/**
 * 上传任务数据，提交者必须为任务的发布者，且任务处于`EDITING`状态
 * @param ctx {object} koa的context
 *   - params {object} 请求的数据
 *     - query {object} 请求的query
 *       - data {boolean} 是否返回数据，默认false
 * @return {Promise<void>}
 */
async function postTaskData(ctx) {
  const {params, global} = ctx;
  const {tasks, taskTemplates} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  coreValidate(dataSchema, params.query);
  const task = await tasks.findById(params.id).notDeleted().select('+data');
  coreAssert(task, errorsEnum.EXIST, 'Task does not exist');
  coreAssert(task.type !== undefined && taskTemplates[task.type] !== undefined &&
    taskTemplates[task.type].meta.enabled, errorsEnum.INVALID, 'Invalid task type');
  coreAssert(params.auth && task.publisher.equals(params.auth.uid),
    errorsEnum.PERMISSION, 'Requires publisher privilege');
  coreAssert(task.status === tasks.statusEnum.EDITING,
    errorsEnum.INVALID, 'Task is not at EDITING status');
  const taskType = taskTemplates[task.type];
  let data;
  const next = async () => {
    if (typeof taskType.postTaskData === 'function')
      data = await taskType.postTaskData(task, params, global);
  };
  if (typeof taskType.postTaskDataMiddleware === 'function')
    await taskType.postTaskDataMiddleware(ctx, next);
  else
    await next();
  if (data !== undefined)
    ctx.body = data;
  else if (params.query.data === 'true')
    ctx.body = coreOkay({
      data: (typeof taskType.taskDataToPlainObject === 'function' &&
        taskType.taskDataToPlainObject(task, params.auth)) || {}
    });
  else
    ctx.body = coreOkay();
}

async function getTaskData(ctx) {
  const {params, global} = ctx;
  const {users, tasks, taskTemplates} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  const task = await tasks.findById(params.id).notDeleted().select('+data');
  coreAssert(task, errorsEnum.EXIST, 'Task does not exist');
  coreAssert(task.type !== undefined && taskTemplates[task.type] !== undefined &&
    taskTemplates[task.type].meta.enabled, errorsEnum.INVALID, 'Invalid task type');
  coreAssert(params.auth && (task.publisher.equals(params.auth.uid) ||
    ((params.auth.role & users.roleEnum.SUBSCRIBER) &&
      task.status === tasks.statusEnum.PUBLISHED)),
    // eslint-disable-next-line
    errorsEnum.PERMISSION, 'Permission denied');
  const taskType = taskTemplates[task.type];
  let data;
  if (typeof taskType.getTaskData === 'function')
    data = await taskType.getTaskData(task, params, global);
  if (data !== undefined)
    ctx.body = data;
  else
    ctx.body = coreOkay({
      data: (typeof taskType.taskDataToPlainObject === 'function' &&
        taskType.taskDataToPlainObject(task, params.auth)) || {}
    });
}

module.exports = {
  createTask,
  getTask,
  findTask,
  patchTask,
  deleteTask,
  postTaskData,
  getTaskData
};
