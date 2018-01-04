const assert = require('assert');
const {startServer, stopServer, clearRedis, clearDBs,
  createUsers, createJwts, filterObjectField} = require('../helper');

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

  describe('create task test', () => {
    it('should return 200 when everything is okay', async () => {
      return request
        .post('/api/task')
        .set('Authorization', 'Bearer ' + jwtData)
        .send({
          'name': '12345',
          'description': 'abcdefgh',
          'excerption': 'abcdefgh'
        })
        .expect(200);
    });
  });

  describe('delete task test', () => {
    it('should return 200 when delete a existing task', async () => {
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
        .delete('/api/task/' + id)
        .set('Authorization', 'Bearer ' + jwtData)
        .send({
        })
        .expect(200);
    });

    it('should return 404 when delete a not existing task', async () => {
      return request
        .delete('/api/task/5a4d0ad5baefdf2b06ad3726')
        .set('Authorization', 'Bearer ' + jwtData)
        .send({
        })
        .expect(404)
        .then(req =>
          assert.strictEqual(req.body.message, 'Task does not exist')
        );
    });
  });

  describe('find task test', () => {
    it('should return 200 when everything is okay', async () => {
      // 文档里啥也没说，一会儿看代码
    });
  });

  describe('get task test', () => {
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
      return request
        .get('/api/task/' + id)
        .set('Authorization', 'Bearer ' + jwtData)
        .send({
        })
        .expect(200)
        .then(req =>
          assert.deepStrictEqual(filterObjectField(req.body.data, ['name', 'description', 'excerption']), {
            'name': '12345',
            'description': 'abcdefgh',
            'excerption': 'abcdefgh'
          })

        );
    });
  });

  describe('patch task test', () => {
    it('should return 400 when updating invalid status', async () => {
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
        .patch('/api/task/' + id)
        .set('Authorization', 'Bearer ' + jwtData)
        .send({
          name: '1234',
          status: 'SUBMITTED'
        })
        .expect(400)
        .then(req =>
          assert.strictEqual(req.body.message, 'Invalid status')
        );
    });
  });
});
