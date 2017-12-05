const ajv = new (require('ajv'))();
const {errorsEnum, coreValidate, coreThrow} = require('./errors');

const createTaskSchema = [
  ajv.compile({
    type: 'object',
    required: ['taskName', 'publisher', 'description', 'moneyLeft', 'spentMoney', 'taskType'],
    properties: {
      name: {type: 'string'},
      publisher: {type: 'string', pattern: '^[a-zA-Z_0-9]+$'},
      description: {type: 'string'},
      moneyLeft: {type: 'number'},
      moneySpent: {type: 'number'},
      taskType: {type: 'number'},
      tags: {
        type: 'array',
        items: {
          type: 'string'
        }
      }
    },
    additionalProperties: false
  })
];

/**
 * 创建任务。
 *   ajax: POST /api/task
 *   socket.io: emit task:create
 * @param params {object}
 *  - data {object} 访问的数据
 *    - name {string} 必须，任务标题
 *    - publisher {string} 必须，必须是某一username
 *    - description {string} 必须，任务描述
 *    - moneyLeft {number} 必须，剩余金额
 *    - moneySpent {number} 必须，已花金额
 *    - taskType {number} 必须，任物类型
 *    - status {number} 必须，任物状态
 * @param global {object}
 *  - tasks {object} Tasks model
 *  - users {object} Users model
 * @return {Promise.<*>} Object,含task的各项信息
 */

async function createTask(params, global) {
  const {tasks} = global;
  coreValidate(createTaskSchema, params.data);
  try {
    await tasks.create(params.data);
    return Object.assign({}, errorsEnum.OK, {
      message: 'Task document created.'
    });
  } catch (err) {
    coreThrow(errorsEnum.INTERNAL, {message: 'Failed creating task documents.'});
  }
}

/**
 * 獲取任务詳情。
 *   ajax: GET /api/task
 *   socket.io: emit task:get(?)
 * @param params {object}
 *  - query {object}
 *   - _id {string} 要获取详情的任务的_id
 * @param global {object}`
 *  - tasks {object} Tasks model
 * @return {Promise.<*>} `message`
 */

async function getTask(params, global) {
  const {tasks} = global;
  try {
    let task = await tasks.findById(params.query._id);
    console.log(task);
    return Object.assign({}, errorsEnum.OK, {
      message: 'Task found.'
    }, task);
  } catch (err) {
    coreThrow(errorsEnum.INTERNAL, {message: 'Failed Finding task documents.'});
  }
}

module.exports = {
  createTask,
  getTask
};
