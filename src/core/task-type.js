const {coreOkay} = require('./errors');

/**
 * 获取任务类型列表
 * @param params
 * @param global
 * @return {Promise<void>}
 */
async function getTaskTypes(params, global) {
  const {taskTemplates} = global;
  return coreOkay({
    data: Object.values(taskTemplates).map(x => {
      return {
        id: x.meta.id,
        name: x.meta.name,
        description: x.meta.description,
        enabled: x.meta.enabled
      };
    })
  });
}

async function createTaskType(params, global) {
}

async function patchTaskType(params, global) {
}

async function deleteTaskType(params, global) {
}

module.exports = {
  getTaskTypes,
  createTaskType,
  patchTaskType,
  deleteTaskType
};
