const Router = require('koa-router');
const coreUser = require('../core/user');
const multer = require('./multer');
const {coreToMiddleware} = require('./utils');

module.exports = function (global) {
  const avtarMulter = multer({
    destination: global.config['upload-dir'],
    types: ['image/png', 'image/gif', 'image/jpeg'],
    maxSize: 5 * 1024 * 1024
  }).single('avatar');
  const router = new Router();
  router.post('/', coreToMiddleware(coreUser.createUser));
  // router.get('/', coreToMiddleware(coreUser.findUser));
  router.get('/:id', coreToMiddleware(coreUser.getUser));
  router.patch('/:id', avtarMulter, coreToMiddleware(coreUser.patchUser));
  router.delete('/:id', coreToMiddleware(coreUser.deleteUser));
  return router;
};
