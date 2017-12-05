const Router = require('koa-router');
const coreEmail = require('../core/email');
const {coreToMiddleware} = require('./utils');

module.exports = function () {
  const router = new Router();
  router.post('/', coreToMiddleware(coreEmail.sendEmail));
  router.post('/:id', coreToMiddleware(coreEmail.confirmEmail));
  return router;
};
