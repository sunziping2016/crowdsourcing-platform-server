const Router = require('koa-router');
const coreUser = require('../core/user');

async function createUser(ctx) {
  ctx.body = await coreUser.createUser(ctx.params, ctx.global);
}

async function findUser(ctx) {

}

async function patchUser(ctx) {

}

async function deleteUser(ctx) {

}

module.exports = function () {
  const router = new Router();
  router.post('/', createUser);
  router.get('/', findUser);
  router.patch('/:id', patchUser);
  router.delete('/:id', deleteUser);
  return router;
};
