const Router = require('koa-router');
const coreAssignment = require('../core/assignment');
const {coreToMiddleware} = require('./utils');

module.exports = function (global) {
  const router = new Router();
  router.post('/', coreToMiddleware(coreAssignment.createAssignment));
  router.get('/', coreToMiddleware(coreAssignment.findAssignment));
  router.get('/:id', coreToMiddleware(coreAssignment.getAssignment));
  router.patch('/:id', coreToMiddleware(coreAssignment.patchAssignment));
  router.delete('/:id', coreToMiddleware(coreAssignment.deleteAssignment));
  router.post('/:id/data', coreAssignment.postAssignmentData);
  router.get('/:id/data', coreAssignment.getAssignmentData);
  return router;
};
