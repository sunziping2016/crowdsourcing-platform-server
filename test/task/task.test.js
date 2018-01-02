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
    it('should return 200 when everything is okay', async () => {
      // 文档里啥也没说，一会儿看代码
    });
  });
});
