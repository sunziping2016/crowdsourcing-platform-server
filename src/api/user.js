const Router = require('koa-router');
const coreUser = require('../core/user');
const multer = require('./multer');
const {coreToMiddleware} = require('./utils');

module.exports = function (global) {
  const avatarMulter = multer({
    destination: global.config['upload-dir'],
    types: ['image/png', 'image/gif', 'image/jpeg'],
    maxSize: 5 * 1024 * 1024,
    fields: {
      blocked: x => x === 'true'
    }
  }).single('avatar');
  const router = new Router();
  router.post('/', coreToMiddleware(coreUser.createUser));
  router.get('/', coreToMiddleware(coreUser.findUser));
  router.get('/:id', coreToMiddleware(coreUser.getUser));
  router.patch('/:id', avatarMulter, coreToMiddleware(coreUser.patchUser));
  router.delete('/:id', coreToMiddleware(coreUser.deleteUser));
  router.get('/:id/data', coreToMiddleware(coreUser.getUserData));
  router.post('/:id/data', coreToMiddleware(coreUser.postUserData));
  return router;
};
