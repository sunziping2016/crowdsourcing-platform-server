const Router = require('koa-router');
const coreAuth = require('../core/auth');
const {coreToMiddleware} = require('./utils');

module.exports = function () {
  const router = new Router();
  router.post('/', coreToMiddleware(coreAuth.authenticate));
  return router;
};
