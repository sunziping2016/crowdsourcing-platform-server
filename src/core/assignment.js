/**
 * 作业模块。这里作业的接口分为两类，一类是通用接口，一类是特殊接口。
 * @module core/assignment
 */

const ajv = new (require('ajv'))();
const {errorsEnum, coreOkay, coreValidate, coreAssert} = require('./errors');

const idRegex = /^[a-f\d]{24}$/i;

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
 *
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
  if (params.query.populate) {
    const data = assignment.toPlainObject(params.auth);
    if (params.query.data)
      data.data = (typeof taskType.assignmentDataToPlainObject === 'function' &&
        taskType.assignmentDataToPlainObject(assignment, params.auth)) || {};
    return coreOkay({
      data
    });
  }
  return coreOkay({data: assignment._id});
}
async function getAssignment(params, global) {}
async function patchAssignment(params, global) {}
async function findAssignment(params, global) {}
async function deleteAssignment(params, global) {}

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
