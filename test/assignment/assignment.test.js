const assert = require('assert');
const {startServer, stopServer, clearRedis, clearDBs,
  createUsers, createJwts} = require('../helper');

const userData = [
  {username: 'foo', password: '12345678', roles: 0b11}
];

let jwtData;

describe('Task API test', () => {
  let request;

  before(async () => {
    await clearRedis();
    await clearDBs();
    request = await startServer();
    (await createUsers(userData)).forEach((x, i) => userData[i]._id = x._id.toString());
    jwtData = (await createJwts([{
      payload: {uid: userData[0]._id, role: userData[0].roles},
      options: {expiresIn: '1d'}
    }]))[0];
  });
  after(async () => {
    await stopServer();
  });

  describe('create assignment test', () => {
    it('should return 400 when task is not at PUBLISHED status', async () => {
      const id = (await request
        .post('/api/task')
        .set('Authorization', 'Bearer ' + jwtData)
        .send({
          'name': '12345',
          'description': 'abcdefgh',
          'excerption': 'abcdefgh'
        })
        .expect(200)).body.data;
      return request
        .post('/api/assignment')
        .set('Authorization', 'Bearer ' + jwtData)
        .send({
          task: id
        })
        .expect(400)
        .then(req =>
          assert.strictEqual(req.body.message, 'Task is not at PUBLISHED status')
        );
    });
  });

  describe('delete assignment test', () => {
    it('should return 200 when everything is okay', async () => {
      // 文档里啥也没说，一会儿看代码
    });
  });

  describe('get assignment test', () => {
    it('should return 200 when everything is okay', async () => {
      const id = (await request
        .post('/api/task')
        .set('Authorization', 'Bearer ' + jwtData)
        .send({
          'name': '12345',
          'description': 'abcdefgh',
          'excerption': 'abcdefgh'
        })
        .expect(200)).body.data;
      await request
        .post('/api/assignment')
        .set('Authorization', 'Bearer ' + jwtData)
        .send({
          task: id
        })
        .expect(400)
        .then(req =>
          assert.strictEqual(req.body.message, 'Task is not at PUBLISHED status')
        );
    });
  });
});
