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

/**
 * 搜索作业。只有发布者或订阅者可以使用。
 *  - ajax: GET /api/assignment
 *  - socket.io: emit assignment:find
 * @param params 请求数据
 *   - auth {object} 权限
 *   - query {object} 请求的query
 *     - populate {boolean} 是否展开数据
 *     - count {boolean} 统计总数，需要额外的开销
 *     - filter {Object.<string, string|Array<string>>}
 *         - search {string} 全文检索
 *     - limit {number} 可选，小于等于50大于0数字，默认为10
 *     - lastId {string} 可选，请求的上一个Id
 * @param global
 * @return {Promise<object>}
 */
async function findAssignment(params, global) {

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

async function postAssignmentData(ctx) {}
async function getAssignmentData(ctx) {}

module.exports = {
  createAssignment,
  getAssignment,
  patchAssignment,
  findAssignment,
  deleteAssignment,
  postAssignmentData,
  getAssignmentData
};
