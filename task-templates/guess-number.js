const ajv = new (require('ajv'))();
const {errorsEnum, coreOkay, coreValidate, coreAssert} = require('../src/core/errors');

const postTaskDataSchema = ajv.compile({
  type: 'object',
  required: ['min', 'max'],
  properties: {
    min: {type: 'integer', minimum: 0, maximum: 100},
    max: {type: 'integer', minimum: 0, maximum: 100},
    total: {type: 'integer', minimum: 1},
    maxGuessTimes: {type: 'integer', minimum: 0, maximum: 100},
    signupMultipleTimes: {type: 'boolean'},
    signupAutoPass: {type: 'boolean'},
    submitAutoPass: {type: 'boolean'}
  },
  additionalProperties: false
});

function clearFiles(task) {}

async function postTaskData(task, params, global) {
  const {tasks} = global;
  coreAssert(params.auth && task.publisher.equals(params.auth.uid),
    errorsEnum.PERMISSION, 'Requires publisher privilege');
  coreAssert(task.status === tasks.statusEnum.EDITING,
    errorsEnum.INVALID, 'Task is not at EDITING status');
  coreValidate(postTaskDataSchema, params.data);
  coreAssert(params.data.min < params.data.max,
    errorsEnum.SCHEMA, 'Invalid min and max');
  clearFiles(task);
  if (params.data.total !== undefined) {
    task.total = params.data.total;
    task.remain = params.data.total;
    delete params.data.total;
  } else {
    task.total = -1;
    delete task.remain;
  }
  task.valid = true;
  task.data = params.data;
  task.markModified('data');
  await task.save();
  return coreOkay();
}
async function getTaskData(task, params, global) {
  return coreOkay({
    data: task.data || {}
  });
}

async function createAssignment(task, params, global) {}

async function postAssignmentData(assignment, params, global) {}
async function getAssignmentData(assignment, params, global) {}

async function changeAssignmentStatus(assignment, status, params, global) {}

module.exports = {
  meta: {
    id: 'guess-number',
    name: '猜数字',
    description: '这只是一个测试，证明我们好像是可以发布任务，报名参加任务。'
  },
  postTaskData,
  getTaskData,
  createAssignment,
  postAssignmentData,
  getAssignmentData,
  changeAssignmentStatus
};
