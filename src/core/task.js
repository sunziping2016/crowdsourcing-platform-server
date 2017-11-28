const ajv = new (require('ajv'))();
const {errorsEnum, coreValidate, coreThrow} = require('./errors');

const createTaskSchema = [
  ajv.compile({
    type: 'object',
    required: ['taskName', 'publisher', 'description', 'moneyLeft', 'spentMoney', 'taskType'],
    properties: {
      taskName: {type: 'string'},
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
 *    - taskname {string} 必须，任务标题
 *    - publisher {string} 必须，必须是某一username
 *    - description {string} 必须，任务描述
 *    - moneyLeft {number} 必须，剩余金额
 *    - moneySpent {number} 必须，已花金额
 * @param global {object}`
 *  - tasks {object} Tasks model
 *  - users {object} Users model
 * @return {Promise.<*>} `message`
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
    coreThrow(errorsEnum.INTERNAL, 'Failed creating task documents.');
  }
}

module.exports = {
  createTask
};
