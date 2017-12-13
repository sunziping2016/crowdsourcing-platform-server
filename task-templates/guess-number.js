async function postTaskData(task, params, global) {}
async function getTaskData(task, params, global) {}

async function createAssignment(task, params, global) {}

async function postAssignmentData(assignment, params, global) {}
async function getAssignmentData(assignment, params, global) {}

async function changeAssignmentStatus(assignment, status, params, global) {}

module.exports = {
  meta: {
    name: '猜数字',
    id: 'guess-number'
  },
  postTaskData,
  getTaskData,
  createAssignment,
  postAssignmentData,
  getAssignmentData,
  changeAssignmentStatus
};
