/**
 * 一个用于比较逗逼的测试任务类型，可以众筹大家在知道整数范围时，猜测出整数需要次数的分布。这里用户
 * 猜测完毕之后可以得到偏大、偏小或者等于。
 *
 * 任务和作业本身的多态性是建立在`task.data`和`assignment.data`这两个无schema的数据上的。
 *
 * 就这个猜数字项目`task.data`主要包含了以下几个字段：
 *   - min {number} 最小的数值
 *   - max {number} 最大的数值
 *   - maxGuessTimes {number} 可选设置，默认无穷
 *   - submitMultipleTimes {boolean} 可选设置，是否允许一个人参与多次，默认false
 *   - signupMultipleTimes {boolean} 可选设置，是否允许一个人被拒后再次报名，默认false
 *   - noSignup {boolean} 可选设置，是否自动完成报名的步骤（即无需报名），默认false
 *   - submitAutoPass {boolean} 可选设置，是否自动审批任务（即任务提交即接受），默认false
 *   - dir {string} 内部使用，这是`uploads`目录下属于该工程的文件夹。
 *   - signedUsers {string[]} 内部使用，对于非noSignup，这是报名了的用户的列表
 *   - blockedUsers {string[]} 内部使用，对于非noSignup且非signupMultipleTimes，这是封禁用户的列表
 *   - exported {boolean} 内部使用，项目是否导出
 *
 * 而`assignment.data`主要包含了以下几个字段，而`assignment.valid`对于非signup类任务，表示能否继续猜：
 *   - signup {boolean} 表示这是一个用于注册的任务
 *   - answer {boolean} 对于非signup类任务，这是真正的答案
 *   - guesses {number} 对于非signup类任务，这是猜测的次数
 * @module task-templates/guess-number
 */
const ajv = new (require('ajv'))();
const path = require('path');
const logger = require('winston');
const fs = require('fs');
const {errorsEnum, coreOkay, coreValidate, coreAssert} = require('../src/core/errors');
const {randomAlnumString, promisify} = require('../src/utils');
const rimraf = require('rimraf');

const exportedFilename = 'result.csv';

/**
 * 将`task.data`转换为对象发送给对应可见性的人。这个函数会在postTaskData或者getTaskData返回
 * undefined的时候默认调用。理论上，调用者要么是任务发布者，要么是订阅者
 *
 * 对本任务而言，而`exportedResult`只有任务拥有者能获得。
 *
 * @param task {object}
 * @param auth {object}
 * @return {object}
 */
function taskDataToPlainObject(task, auth) {
  const isPublisher = auth && task.publisher.equals(auth.uid);
  const result = {};
  if (task.data) {
    if (task.data.min !== undefined && task.data.max !== undefined) {
      result.min = task.data.min;
      result.max = task.data.max;
    }
    if (task.data.maxGuessTimes !== undefined)
      result.maxGuessTimes = task.data.maxGuessTimes;
    if (task.data.submitMultipleTimes !== undefined)
      result.submitMultipleTimes = task.data.submitMultipleTimes;
    if (task.data.signupMultipleTimes !== undefined)
      result.signupMultipleTimes = task.data.signupMultipleTimes;
    if (task.data.noSignup !== undefined)
      result.noSignup = task.data.noSignup;
    if (task.data.submitAutoPass !== undefined)
      result.submitAutoPass = task.data.submitAutoPass;
    if (isPublisher && task.data.exported)
      result.exportedResult = '/uploads/' + task.data.dir + '/' + exportedFilename;
  }
  return result;
}

function cleanFiles(task, dir) {
  if (task.data && task.data.dir) {
    dir = path.join(dir, task.data.dir);
    rimraf(dir, err => {
      if (err) {
        logger.error(`Failed to delete directory "${dir}".`);
        logger.error(err);
      }
    });
  }
}

/**
 * 这是postTaskData AJAX请求执行之前的中间件。通常这里用以处理文件上传的multipart请求。缺省
 * 情况下直接调用postTaskData。
 *
 * 对于本任务而言，没有文件上传。不做任何处理。
 *
 * @param ctx {object}
 * @param next {function}
 * @return {Promise<void>}
 */
async function postTaskDataMiddleware(ctx, next) {
  await next();
}

const postTaskDataSchema = ajv.compile({
  type: 'object',
  required: ['min', 'max'],
  properties: {
    min: {type: 'integer', minimum: 0, maximum: 100},
    max: {type: 'integer', minimum: 0, maximum: 100},
    total: {type: 'integer', minimum: 1},
    maxGuessTimes: {type: 'integer', minimum: 0, maximum: 100},
    submitMultipleTimes: {type: 'boolean'},
    signupMultipleTimes: {type: 'boolean'},
    noSignup: {type: 'boolean'},
    submitAutoPass: {type: 'boolean'}
  },
  additionalProperties: false
});

/**
 * 提交任务的数据，这里已经确保提交者为任务的发布者，且任务处于`EDITING`状态。但该任务可能已经
 * 提交过数据，因而应当清除以前的数据。原则上，这个过程结束后，应当重置任务的`total`、`remain`、
 * `valid`和`data`状态。原则上，该过程如果没有返回错误码，`valid`应当为true。
 *
 * 如果这个函数没有返回值，则会依据情况调用taskDataToPlainObject。如果有返回值则会作为响应。
 *
 * 对于本任务而言，主要上传的数据是一些设置选项。
 *
 * @param task {object} 任务对象
 * @param params {object} 请求的数据
 *   - query 请求的query
 *     - data {boolean} 是否返回数据
 *   - data 请求的data
 *     - min {number} 必须，最小的数值，0到100
 *     - max {number} 必须，最大的数值，0到100且min<max
 *     - total {number} 可选设置，全部的任务数目，大于0，默认无穷
 *     - maxGuessTimes {number} 可选设置，默认无穷
 *     - submitMultipleTimes {boolean} 可选设置，是否允许一个人参与多次，默认false
 *     - signupMultipleTimes {boolean} 可选设置，是否允许一个人被拒后再次报名，默认false
 *     - noSignup {boolean} 可选设置，是否无需报名，默认false
 *     - submitAutoPass {boolean} 可选设置，是否自动审批任务（即任务提交即接受），默认false
 * @param global {object}
 * @return {Promise<void>}
 */
async function postTaskData(task, params, global) {
  const {config} = global;
  coreValidate(postTaskDataSchema, params.data);
  coreAssert(params.data.min < params.data.max,
    errorsEnum.SCHEMA, 'Invalid min and max');
  cleanFiles(task, config['upload-dir']);
  const dirname = randomAlnumString(40);
  const dir = path.join(config['upload-dir'], dirname);
  await promisify(fs.mkdir)(dir);
  params.data.dir = dir;
  if (params.data.total !== undefined) {
    task.total = params.data.total;
    task.remain = params.data.total;
    delete params.data.total;
  } else {
    task.total = -1;
    task.remain = undefined;
  }
  if (!params.data.noSignup) {
    params.data.signedUsers = [];
    if (!params.data.signupMultipleTimes)
      params.data.blockedUsers = [];
  }
  task.valid = true;
  task.data = params.data;
  task.markModified('data');
  await task.save();
}

/**
 * 获取任务的数据。这里已经确保要么提交者为任务的发布者，要么提交者为订阅者且任务处于`PUBLISHED`状态
 * 如果这个函数没有返回值，则会依据情况调用postTaskDataSchema。如果有返回值则会作为响应。
 *
 * 对于本任务，如果不是发布者，就采用默认的调用taskDataToPlainObject。如果是订阅者且`PUBLISHED`，
 * 还会返回在`userStatus`内返回以下几个字段：
 *   - signed：用户是否已经注册，对于noSignup的任务而言，这永远为真
 *   - blocked：用户是否被拒绝参加改任务，对于noSignup或signupMultipleTimes的任务而言，这永远为假
 *   - signing：对于非signed用户而言，这个属性表示用户是否正在报名
 *   - created：对于任务非submitMultipleTimes且用户signed，表示是否已经创建了一个作业
 * @param task {object} 任务对象
 * @param params {object}
 * @param global {object}
 * @return {Promise<object|void>}
 */
async function getTaskData(task, params, global) {
  const {users, tasks, assignments} = global;
  if (params.auth && (params.auth.role & users.roleEnum.SUBSCRIBER) &&
    task.status === tasks.statusEnum.PUBLISHED) {
    const userStatus = {};
    if (task.data.noSignup) {
      userStatus.signed = true;
      userStatus.blocked = false;
    } else {
      userStatus.signed = task.data.signedUsers.indexOf(params.auth.uid) !== -1;
      if (userStatus.signed === false)
        userStatus.signing = (await assignments.findOne({
          task: task._id,
          subscriber: params.auth.uid,
          status: assignments.statusEnum.SUBMITTED,
          'data.signup': true
        }).notDeleted()) !== null;
      if (task.data.signupMultipleTimes)
        userStatus.blocked = false;
      else
        userStatus.blocked = task.data.blockedUsers.indexOf(params.auth.uid) !== -1;
    }
    if (userStatus.signed && !task.data.submitMultipleTimes)
      userStatus.created = (await assignments.findOne({
        task: task._id,
        subscriber: params.auth.uid,
        'data.signup': {$ne: true}
      }).notDeleted()) !== null;
    return coreOkay({
      data: Object.assign({userStatus}, taskDataToPlainObject(task, params.auth))
    });
  }
}

/**
 * 将`assignment.data`转换为对象发送给对应可见性的人。这个函数会在createAssignment、
 * getAssignmentData或者getAssignmentData返回undefined的时候默认调用。
 * 理论上，调用者是订阅者或者发布者。
 *
 * 对本任务而言，只有作业是一个非报名作业才返回数据，如下：
 *   - guessTimes {number} 猜测次数
 *   - finished {boolean} 是否完成
 *   - answer {boolean} 答案（完成之后才返回）
 * @param assignment {object}
 * @param auth {object}
 * @return {object}
 */
function assignmentDataToPlainObject(assignment, auth) {
  if (!assignment.data || assignment.data.signup)
    return {
      signup: true
    };
  const result = {
    signup: false,
    guessTimes: assignment.data.guesses.length,
    finished: assignment.valid
  };
  if (assignment.valid)
    result.answer = assignment.data.answer;
  if (assignment.data.compare)
    result.compare = assignment.data.compare;
  return result;
}

const createAssignmentSchema = ajv.compile({
  type: 'object',
  properties: {
    signup: {type: 'boolean'}
  },
  additionalProperties: false
});

/**
 * 创建任务，这里已经确保提交者为订阅者，且任务处于`PUBLISHED`状态。原则上，这个过程结束后，
 * 应当设置好`valid`、`status`、`summary`、`data`的字段。如果该函数缺省，则会创建一个
 * 不valid、编辑状态、无`summary`和`data`字段的任务。assignment会被保存。
 *
 * 如果这个函数没有返回值，则依据情况调用assignmentDataToPlainObject。
 * 如果有返回值则会作为响应。
 *
 * 对于本任务而言，主要确认创建的是一个报名作业还是真正的猜数字作业。
 *
 * @param task {object} 任务对象
 * @param assignment {object} 作业对象
 * @param params {object} 请求的数据
 *   - query 请求的query
 *     - populate {boolean} 是否返回
 *     - data {boolean} 是否返回数据
 *   - data 请求的data
 *    - task {string} 任务
 *    - data {object} 额外的数据
 *      - signup {boolean} 是否是报名任务
 * @param global {object}
 * @return {Promise<void>}
 */
async function createAssignment(task, assignment, params, global) {
  const {assignments} = global;
  if (params.data.data !== undefined)
    coreValidate(createAssignmentSchema, params.data.data);
  const signup = params.data.data && params.data.data.signup;
  if (signup) {
    coreAssert(!task.data.noSignup, errorsEnum.INVALID, 'Task requires no signup');
    coreAssert(task.data.signedUsers.indexOf(params.auth.uid) === -1,
      errorsEnum.INVALID, 'User has already signed up');
    coreAssert(task.data.signupMultipleTimes ||
      task.data.blockedUsers.indexOf(params.auth.uid) === -1,
      // eslint-disable-next-line
      errorsEnum.INVALID, 'User has been blocked');
    coreAssert((await assignments.findOne({
      task: task._id,
      subscriber: params.auth.uid,
      status: assignments.statusEnum.SUBMITTED,
      'data.signup': true
    }).notDeleted()) === null, errorsEnum.INVALID, 'User has already created a signup request');
    assignment.valid = true;
    assignment.summary = '报名';
    assignment.status = assignments.statusEnum.SUBMITTED;
    assignment.data = {signup: true};
    assignment.markModified('data');
  } else {
    coreAssert((task.total < 0 || task.remain > 0) &&
      (!task.deadline || Date.now() <= task.deadline.getTime()),
      // eslint-disable-next-line
      errorsEnum.INVALID, 'Task has completed');
    coreAssert(task.data.noSignup || task.data.signedUsers.indexOf(params.auth.uid) !== -1,
      errorsEnum.INVALID, 'User has not signed up');
    coreAssert(task.data.submitMultipleTimes || (await assignments.findOne({
      task: task._id,
      subscriber: params.auth.uid,
      'data.signup': {$ne: true}
    }).notDeleted()) === null, errorsEnum.INVALID, 'User has already created an assignment');
    assignment.summary = '未完成，猜测0次';
    assignment.data = {
      guesses: [],
      answer: Math.round(Math.random() * (task.data.max - task.data.min + 1)) + task.data.min
    };
    assignment.markModified('data');
  }
}

/**
 * 这个函数是作业状态更改的钩子，确保作业的状态发生更改，可能的更改包括订阅者从编辑到提交，同时作业必须为valid，
 * 以及发布者从提交到接受或拒绝。assignment会被保存。
 *
 * 本任务主要是处理自动pass和验证通过的逻辑的。
 *
 * @param assignment {object}
 * @param params
 * @param global
 * @return {Promise<void>}
 */
async function assignmentStatusChanged(assignment, params, global) {
  if (assignment.data.signup) {
    const {tasks, assignments} = global;
    const task = await tasks.findById(assignment.task).notDeleted().select('+data');
    coreAssert(task, errorsEnum.INVALID, 'Task deleted');
    if (assignment.status === assignments.statusEnum.ADMITTED) {
      task.data.signedUsers.push(assignment.subscriber.toString());
      task.markModified('data.signedUsers');
      await task.save();
    } else if (!task.data.signupMultipleTimes) {
      task.data.blockedUsers.push(assignment.subscriber.toString());
      task.markModified('data.signedUsers');
      await task.save();
    }
  } else {
    const {tasks, assignments} = global;
    const task = await tasks.findById(assignment.task).notDeleted().select('+data');
    coreAssert(task, errorsEnum.INVALID, 'Task deleted');
    if (task.data.submitAutoPass && assignment.status === assignments.statusEnum.SUBMITTED)
      assignment.status = assignments.statusEnum.ADMITTED;
    if (task.total > 0 && assignment.status === assignments.statusEnum.ADMITTED)
      await tasks.findOneAndUpdate({_id: task._id}, {$inc: {remain: -1}}).notDeleted();
  }
}

/**
 * 这是postAssignmentData AJAX请求执行之前的中间件。通常这里用以处理文件上传的multipart请求。
 * 缺省情况下直接调用postAssignmentData。
 *
 * 对于本任务的作业而言，没有文件上传。不做任何处理。
 *
 * @param ctx {object}
 * @param next {function}
 * @return {Promise<void>}
 */
async function postAssignmentDataMiddleware(ctx, next) {
  await next();
}

const postAssignmentDataSchema = ajv.compile({
  type: 'object',
  required: ['guess'],
  properties: {
    guess: {type: 'integer', minimum: 0, maximum: 100}
  },
  additionalProperties: false
});

/**
 * 提交作业的数据，这里已经确保提交者为作业的订阅者，且作业处于`EDITING`状态。但该作业可能已经
 * 提交过数据，因而应当清除以前的数据。原则上，这个过程结束后，应当重置作业的`summary`、
 * `valid`和`data`状态。原则上，该过程如果没有返回错误码，`valid`应当为true。
 *
 * 如果这个函数没有返回值，则会依据情况调用assignmentDataToPlainObject。如果有返回值则会作为响应。
 *
 * 对于本任务的作业而言，情况略有不同，这是有状态的，不可逆的故而不清除数据。主要上传的数据是猜的答案。
 * 返回的数据还会包含一个额外的字段：
 *   - compare {number} -1：偏小，0：猜对，1：偏大
 * @param assignment {object} 任务对象
 * @param params {object} 请求的数据
 *   - query 请求的query
 *     - data {boolean} 是否返回数据
 *   - data 请求的data
 *     - guess {number} 必须
 * @param global {object}
 * @return {Promise<object>}
 */
async function postAssignmentData(assignment, params, global) {
  coreValidate(postAssignmentDataSchema, params.data);
  coreAssert(!assignment.valid, errorsEnum.INVALID, 'Assignment already finished');
  assignment.data.guesses.push(params.data.guess);
  let compare;
  if (params.data.guess === assignment.data.answer) {
    compare = 0;
    assignment.valid = true;
    assignment.summary = `已完成，猜测${assignment.data.guesses.length}次，正确`;
  } else if (params.data.guess < assignment.data.answer)
    compare = -1;
  else
    compare = 1;
  assignment.data.compare = compare;
  if (compare !== 0) {
    const {tasks} = global;
    const task = await tasks.findById(assignment.task).notDeleted().select('+data');
    coreAssert(task, errorsEnum.INVALID, 'Task deleted');
    if (task.data.maxGuessTimes === undefined ||
        assignment.data.guesses.length < task.data.maxGuessTimes)
      assignment.summary = `未完成，猜测${assignment.data.guesses.length}次`;
    else {
      assignment.valid = true;
      assignment.summary = `已完成，猜测${assignment.data.guesses.length}次，错误`;
    }
  }
  assignment.markModified('data');
  await assignment.save();
  return coreOkay({
    data: params.query.data === 'true'
      ? Object.assign({compare}, assignmentDataToPlainObject(assignment, params.auth))
      : {compare}
  });
}

/**
 * 获取作业的数据。这里已经确保要么提交者为作业的订阅者或发布者。如果这个函数没有返回值，
 * 则会依据情况调用assignmentDataToPlainObject。如果有返回值则会作为响应。
 *
 * 对于本任务，就采用默认的assignmentDataToPlainObject。
 * @param assignment {object} 任务对象
 * @param params {object}
 * @param global {object}
 * @return {Promise<void>}
 */
async function getAssignmentData(assignment, params, global) {}

module.exports = {
  meta: {
    id: 'guess-number',
    name: '猜数字',
    description: '这只是一个测试，证明我们好像是可以发布任务，报名参加任务。'
  },
  taskDataToPlainObject,
  postTaskDataMiddleware,
  postTaskData,
  getTaskData,
  assignmentDataToPlainObject,
  createAssignment,
  assignmentStatusChanged,
  postAssignmentDataMiddleware,
  postAssignmentData,
  getAssignmentData
};
