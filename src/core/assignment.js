/**
 * 作业模块。这里作业的接口分为两类，一类是通用接口，一类是特殊接口。
 * @module core/assignment
 */

const ajv = new (require('ajv'))();
const {errorsEnum, coreOkay, coreValidate, coreAssert} = require('./errors');

const idRegex = /^[a-f\d]{24}$/i;

const querySchema = ajv.compile({
  type: 'object',
  properties: {
    populate: {type: 'string', enum: ['false', 'true']}
  },
  additionalProperties: false
});

const queryWithDataSchema = ajv.compile({
  type: 'object',
  properties: {
    populate: {type: 'string', enum: ['false', 'true']},
    data: {type: 'string', enum: ['false', 'true']}
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

const createAssignmentSchema = ajv.compile({
  type: 'object',
  required: ['task'],
  properties: {
    task: {type: 'string', pattern: '[a-fA-F\\d]{24}'},
    data: {type: 'object'}
  },
  additionalProperties: false
});

/**
 * 创建任务，用户必须具有subscriber权限。
 *  - ajax: POST /api/assignment
 *  - socket.io: emit assignment:create
 * @param params {object}
 *   - query {object}
 *     - populate {boolean} 是否返回
 *     - data {boolean} 是否返回数据
 *   - data {object}
 *     - task {string} 任务
 *     - data {object} 额外的数据
 * @param global
 * @return {Promise<object>}
 */
async function createAssignment(params, global) {
  const {users, tasks, taskTemplates, assignments} = global;
  coreAssert(params.auth && (params.auth.role & users.roleEnum.SUBSCRIBER),
    errorsEnum.PERMISSION, 'Requires subscriber privilege');
  coreValidate(queryWithDataSchema, params.query);
  coreValidate(createAssignmentSchema, params.data);
  const task = await tasks.findById(params.data.task).notDeleted().select('+data');
  coreAssert(task, errorsEnum.INVALID, 'Task does not exist');
  coreAssert(task.status === tasks.statusEnum.PUBLISHED,
    errorsEnum.INVALID, 'Task is not at PUBLISHED status');
  coreAssert(task.type !== undefined && taskTemplates[task.type] !== undefined &&
    taskTemplates[task.type].meta.enabled, errorsEnum.INVALID, 'Invalid task type');
  const taskType = taskTemplates[task.type];
  const assignment = new assignments({
    task: task._id,
    publisher: task.publisher,
    subscriber: params.auth.uid,
    type: task.type,
    status: assignments.statusEnum.EDITING,
    valid: false
  });
  if (typeof taskType.createAssignment === 'function') {
    const data = await taskType.createAssignment(task, assignment, params, global);
    if (data !== undefined)
      return data;
  }
  await assignment.save();
  if (params.query.populate === 'true') {
    const data = assignment.toPlainObject(params.auth);
    if (params.query.data === 'true')
      data.data = (typeof taskType.assignmentDataToPlainObject === 'function' &&
        taskType.assignmentDataToPlainObject(assignment, params.auth)) || {};
    return coreOkay({
      data
    });
  }
  return coreOkay({data: assignment._id});
}

/**
 * 获取作业详情。
 *  - ajax: GET /api/assignment/:id
 *  - socket.io: emit assignment:get
 * @param params params {object}
 *  - auth {object} 权限
 *  - id {string} 要获取详情的作业的id
 * @param global
 * @return {Promise<object>}
 */
async function getAssignment(params, global) {
  const {assignments} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  const assignment = await assignments.findById(params.id).notDeleted();
  coreAssert(assignment, errorsEnum.EXIST, 'Assignment does not exist');
  coreAssert(params.auth && (assignment.publisher.equals(params.auth.uid) ||
    assignment.subscriber.equals(params.auth.uid)),
    // eslint-disable-next-line
    errorsEnum.PERMISSION, 'Permission denied'
  );
  return coreOkay({
    data: assignment.toPlainObject(params.auth)
  });
}

const patchAssignmentSchema = ajv.compile({
  type: 'object',
  properties: {
    status: {type: 'string', enum: ['SUBMITTED', 'ADMITTED', 'REJECTED']}
  },
  additionalProperties: false
});

/**
 * 更改作业的状态，可能的更改包括订阅者从编辑到提交（作业必须为valid）和发布者从提交到接受或拒绝
 *  - ajax: PATCH /api/assignment/:id
 *  - socket.io: emit assignment:patch
 * @param params {object} 请求的数据
 *   - query {object} 请求的query
 *     - populate {boolean}
 *   - data {object} 请求的status
 *     - status {string} 可选，状态
 * @param global {object}
 * @return {Promise<object>}
 */
async function patchAssignment(params, global) {
  const {assignments, taskTemplates} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  coreValidate(querySchema, params.query);
  coreValidate(patchAssignmentSchema, params.data);
  if (params.data.status !== undefined)
    params.data.status = assignments.statusEnum[params.data.status];
  const assignment = await assignments.findById(params.id).notDeleted().select('+data');
  coreAssert(assignment, errorsEnum.EXIST, 'Assignment does not exist');
  coreAssert(taskTemplates[assignment.type] !== undefined &&
    taskTemplates[assignment.type].meta.enabled, errorsEnum.INVALID, 'Invalid task type');
  const taskType = taskTemplates[assignment.type];
  const isPublisher = params.auth && assignment.publisher.equals(params.auth.uid);
  const isSubscriber = params.auth && assignment.subscriber.equals(params.auth.uid);
  coreAssert(isPublisher || isSubscriber, errorsEnum.PERMISSION, 'Permission denied');
  coreAssert(params.data.status !== assignments.statusEnum.SUBMITTED ||
    (isSubscriber && assignment.status === assignments.statusEnum.EDITING && assignment.valid),
    // eslint-disable-next-line indent
    errorsEnum.INVALID, 'Invalid status'
  );
  coreAssert((params.data.status !== assignments.statusEnum.ADMITTED &&
    params.data.status !== assignments.statusEnum.REJECTED) ||
    (isPublisher && assignment.status === assignments.statusEnum.SUBMITTED),
    // eslint-disable-next-line indent
    errorsEnum.INVALID, 'Invalid status'
  );
  const oldStatus = assignment.status;
  Object.assign(assignment, params.data);
  if (assignment.status !== oldStatus && typeof taskType.assignmentStatusChanged === 'function')
    await taskType.assignmentStatusChanged(assignment, params, global);
  await assignment.save();
  return coreOkay({
    data: params.query.populate === 'true'
      ? assignment.toPlainObject(params.auth) : assignment._id
  });
}

const findAssignmentSchema = ajv.compile({
  type: 'object',
  properties: {
    populate: {type: 'string', enum: ['false', 'true']},
    count: {type: 'string', enum: ['false', 'true']},
    filter: {
      type: 'object',
      properties: {
        search: {type: 'string'},
        task: {type: 'string', pattern: '[a-fA-F\\d]{24}'},
        publisher: {type: 'string', pattern: '[a-fA-F\\d]{24}'},
        subscriber: {type: 'string', pattern: '[a-fA-F\\d]{24}'},
        type: {type: 'string', pattern: '^[-_a-zA-Z\\d]+$'},
        status: {type: 'string', enum: ['EDITING', 'SUBMITTED', 'ADMITTED', 'REJECTED']},
        valid: {type: 'string', enum: ['true', 'false']}
      },
      additionalProperties: false
    },
    limit: {type: 'string', pattern: '^\\d+$'},
    lastId: {type: 'string', pattern: '[a-fA-F\\d]{24}'}
  },
  additionalProperties: false
});

/**
 * 搜索作业。只有发布者或订阅者可以使用。
 *  - ajax: GET /api/assignment
 *  - socket.io: emit assignment:find
 * @param params 请求数据
 *   - auth {object} 权限
 *   - query {object} 请求的query
 *     - populate {boolean} 是否展开数据
 *     - count {boolean} 统计总数，需要额外的开销
 *     - filter {Object.<string, string>}
 *         - search {string} 全文检索
 *         - task {string}
 *         - publisher {string} 对于发布者，这个值只能是自己，建议以发布者身份搜索时永远设置这个值。
 *         - subscriber {string} 对于订阅者，这个值只能是自己，建议以订阅者身份搜索时永远设置这个值。
 *         - type {string}
 *         - status {string}
 *         - valid {boolean}
 *     - limit {number} 可选，小于等于50大于0数字，默认为10
 *     - lastId {string} 可选，请求的上一个Id
 * @param global
 * @return {Promise<object>}
 */
async function findAssignment(params, global) {
  const {assignments, users} = global;
  coreValidate(findAssignmentSchema, params.query);
  coreAssert(params.auth && (params.auth.role & (users.roleEnum.SUBSCRIBER | users.roleEnum.PUBLISHER)),
    errorsEnum.PERMISSION, 'Permission denied');
  const isSubscriber = !!(params.auth.role & users.roleEnum.SUBSCRIBER);
  const isPublisher = !!(params.auth.role & users.roleEnum.PUBLISHER);
  let limit;
  if (params.query.limit !== undefined) {
    limit = parseInt(params.query.limit);
    coreAssert(limit > 0 && limit < 50, errorsEnum.SCHEMA, 'Invalid limit');
  } else
    limit = 10;
  params.query.filter = params.query.filter || {};
  const and = params.query.filter.$and = [];
  if (params.query.filter.search !== undefined) {
    const search = params.query.filter.search
      .split(/\s+/).filter(x => x)
      .map(x => new RegExp(x.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&'), 'i'));
    delete params.query.filter.search;
    if (search.length !== 0) {
      const or = [];
      search.forEach(x => {
        or.push({summary: {$regex: x}});
      });
      and.push({$or: or});
    }
  }
  if (params.query.valid !== undefined)
    params.query.valid = params.query.valid === 'true';
  if (params.query.filter.status !== undefined)
    params.query.filter.status = assignments.statusEnum[params.query.filter.status];
  if (isPublisher && isSubscriber) {
    const setSubscriber = params.query.filter.subscriber !== undefined;
    const setPublisher = params.query.filter.publisher !== undefined;
    if (setSubscriber && setPublisher)
      coreAssert(params.query.filter.subscriber === params.auth.uid ||
        params.query.filter.publisher === params.auth.uid,
        // eslint-disable-next-line
        errorsEnum.SCHEMA, 'Invalid subscriber or publisher');
    else if (setSubscriber) {
      if (params.query.filter.subscriber !== params.auth.uid)
        params.query.filter.publisher = params.auth.uid;
    } else if (setPublisher) {
      if (params.query.filter.publisher !== params.auth.uid)
        params.query.filter.subscriber = params.auth.uid;
    } else
      and.push({
        $or: [
          {subscriber: params.auth.uid},
          {publisher: params.auth.uid}
        ]
      });
  } else if (isPublisher) {
    coreAssert(params.query.filter.publisher === undefined ||
      params.query.filter.publisher === params.auth.uid,
      // eslint-disable-next-line
      errorsEnum.INVALID, 'Invalid publisher');
    params.query.filter.publisher = params.auth.uid;
  } else {
    coreAssert(params.query.filter.subscriber === undefined ||
      params.query.filter.subscriber === params.auth.uid,
      // eslint-disable-next-line
      errorsEnum.INVALID, 'Invalid subscriber');
    params.query.filter.subscriber = params.auth.uid;
  }
  if (params.query.filter.$and.length === 0)
    delete params.query.filter.$and;
  const result = {};
  if (params.query.lastId !== undefined) {
    params.query.filter._id = {$lt: params.query.lastId};
    result.lastId = params.query.lastId;
  }
  if (params.query.populate === 'true') {
    result.data = (await assignments.find(params.query.filter)
      .notDeleted()
      .sort({_id: -1})
      .limit(limit)).map(x => x.toPlainObject(params.auth));
    if (result.data.length !== 0)
      result.lastId = result.data[result.data.length - 1]._id;
  } else {
    result.data = (await assignments.find(params.query.filter)
      .notDeleted()
      .sort({_id: -1})
      .select({_id: 1})
      .limit(limit)).map(x => x._id);
    if (result.data.length !== 0)
      result.lastId = result.data[result.data.length - 1];
  }
  if (params.query.count === 'true') {
    delete params.query.filter._id;
    result.total = await assignments.count(params.query.filter).notDeleted();
  }
  return coreOkay({data: result});
}

/**
 * 删除作业。必须是任务的订阅者或者任务的提交者。
 * @param params
 * @param global
 * @return {Promise<void>}
 */
async function deleteAssignment(params, global) {
  const {assignments} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  const assignment = await assignments.findById(params.id).notDeleted();
  coreAssert(assignment, errorsEnum.EXIST, 'Assignment does not exist');
  const isPublisher = params.auth && assignment.publisher.equals(params.auth.uid);
  const isSubscriber = params.auth && assignment.subscriber.equals(params.auth.uid);
  coreAssert(isPublisher || isSubscriber, errorsEnum.PERMISSION, 'Permission denied');
  await assignment.delete();
  return coreOkay();
}

/**
 * 上传作业数据，提交者必须为作业的订阅者，且作业处于`EDITING`状态
 * @param ctx {object} koa的context
 *   - params {object} 请求的数据
 *     - query {object} 请求的query
 *       - data {boolean} 是否返回数据，默认false
 * @return {Promise<void>}
 */
async function postAssignmentData(ctx) {
  const {params, global} = ctx;
  const {assignments, taskTemplates} = global;
  coreValidate(dataSchema, params.query);
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  const assignment = await assignments.findById(params.id).notDeleted().select('+data');
  coreAssert(assignment, errorsEnum.EXIST, 'Assignment does not exist');
  coreAssert(assignment.type !== undefined && taskTemplates[assignment.type] !== undefined &&
    taskTemplates[assignment.type].meta.enabled, errorsEnum.INVALID, 'Invalid task type');
  coreAssert(params.auth && assignment.subscriber.equals(params.auth.uid),
    errorsEnum.PERMISSION, 'Requires subscriber privilege');
  coreAssert(assignment.status === assignments.statusEnum.EDITING,
    errorsEnum.INVALID, 'Assignment is not at EDITING status');
  const taskType = taskTemplates[assignment.type];
  let data;
  const next = async () => {
    if (typeof taskType.postAssignmentData === 'function')
      data = await taskType.postAssignmentData(assignment, params, global);
  };
  if (typeof taskType.postAssignmentDataMiddleware === 'function')
    await taskType.postAssignmentDataMiddleware(ctx, next);
  else
    await next();
  if (data !== undefined)
    ctx.body = data;
  else if (params.query.data === 'true')
    ctx.body = coreOkay({
      data: (typeof taskType.assignmentDataToPlainObject === 'function' &&
        taskType.assignmentDataToPlainObject(assignment, params.auth)) || {}
    });
  else
    ctx.body = coreOkay();
}

/**
 * 获取作业数据，可以是作业的发布者，或订阅者
 * @param ctx {object} koa的context
 * @return {Promise<void>}
 */
async function getAssignmentData(ctx) {
  const {params, global} = ctx;
  const {assignments, taskTemplates} = global;
  coreAssert(params.id && idRegex.test(params.id), errorsEnum.SCHEMA, 'Invalid id');
  const assignment = await assignments.findById(params.id).notDeleted().select('+data');
  coreAssert(assignment, errorsEnum.EXIST, 'Assignment does not exist');
  coreAssert(assignment.type !== undefined && taskTemplates[assignment.type] !== undefined &&
    taskTemplates[assignment.type].meta.enabled, errorsEnum.INVALID, 'Invalid task type');
  coreAssert(params.auth && (assignment.subscriber.equals(params.auth.uid) ||
    assignment.publisher.equals(params.auth.uid)),
    // eslint-disable-next-line
    errorsEnum.PERMISSION, 'Permission denied');
  const taskType = taskTemplates[assignment.type];
  let data;
  if (typeof taskType.getAssignmentData === 'function')
    data = await taskType.getAssignmentData(assignment, params, global);
  if (data !== undefined)
    ctx.body = data;
  else
    ctx.body = coreOkay({
      data: (typeof taskType.assignmentDataToPlainObject === 'function' &&
        taskType.assignmentDataToPlainObject(assignment, params.auth)) || {}
    });
}

module.exports = {
  createAssignment,
  getAssignment,
  patchAssignment,
  findAssignment,
  deleteAssignment,
  postAssignmentData,
  getAssignmentData
};
