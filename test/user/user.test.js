const assert = require('assert');
const {startServer, stopServer, server, clearRedis, clearDBs,
  createUsers, createJwts, filterObjectField} = require('../helper');

const userData = [
  {username: 'foo', password: '12345678', roles: 0b11},
  {username: 'foobar', email: 'foobar@example.com', password: '23456789', roles: 0b11100}
];

let jwtData;

describe('User API test', () => {
  let request, users;

  before(async () => {
    await clearRedis();
    await clearDBs();
    request = await startServer();
    (await createUsers(userData)).forEach((x, i) => userData[i]._id = x._id.toString());
    jwtData = (await createJwts([{
      payload: {uid: userData[1]._id, role: userData[1].roles},
      options: {expiresIn: '1d'}
    }]))[0];
    users = server.app.context.global.users;
  });
  after(async () => {
    await stopServer();
  });

  describe('create user test', () => {
    it('should return 200 when everything is okay', async () => {
      const id = (await request
        .post('/api/user')
        .set('Authorization', 'Bearer ' + jwtData)
        .send({
          'username': 'abcde',
          'password': 'abcdefgh',
          'roles': ['SUBSCRIBER']
        })
        .expect(200)).body.data;
      const user = await users.findById(id);
      assert.strictEqual(typeof user, 'object');
      assert.deepStrictEqual(filterObjectField(user, ['username', 'roles']), {
        username: 'abcde',
        roles: 0b1
      });
    });

    it('should return 400 when username has been taken', async () => {
      return request
        .post('/api/user')
        .set('Authorization', 'Bearer ' + jwtData)
        .send({
          'username': 'foo',
          'password': 'abcdefgh',
          'roles': ['SUBSCRIBER']
        })
        .expect(400)
        .then(req =>
          assert.strictEqual(req.body.message, 'Username has been taken')
        );
    });
  });
});
