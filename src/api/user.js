const Router = require('koa-router');
const coreUser = require('../core/user');
const multer = require('./multer');

async function createUser(ctx) {
  ctx.body = await coreUser.createUser(ctx.params, ctx.global);
}

async function findUser(ctx) {

}

async function getUser(ctx) {

}

async function patchUser(ctx) {

}

async function deleteUser(ctx) {

}

module.exports = function (global) {
  const avtarMulter = multer({
    destination: global.config['upload-dir'],
    types: ['image/png', 'image/gif', 'image/jpeg'],
    maxSize: 5 * 1024 * 1024
  }).single('avatar');
  const router = new Router();
  router.post('/', createUser);
  router.get('/', findUser);
  router.get('/:id', getUser);
  router.patch('/:id', avtarMulter, patchUser);
  router.delete('/:id', deleteUser);
  return router;
};
