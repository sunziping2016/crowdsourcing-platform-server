const assert = require('assert');
const {startServer, stopServer, server, clearRedis, clearDBs,
  createUsers, createJwts, assertThrowsAsync} = require('../helper');

const userData = [
  {username: 'foo', password: '12345678', roles: 0b11},
  {username: 'foobar', email: 'foobar@example.com', password: '23456789', roles: 0b11100}
];

//
let jwtData;

describe('Auth API test', () => {
  let request, jwt;

  before(async () => {
    await clearRedis();
    await clearDBs();
    request = await startServer();
    (await createUsers(userData)).forEach((x, i) => userData[i]._id = x._id.toString());
    jwtData = await createJwts(Array(2).fill(undefined).map(() => {
      return {
        payload: {uid: userData[0]._id, role: userData[0].roles},
        options: {expiresIn: '1d'}
      };
    }));
    jwt = server.app.context.global.jwt;
  });
  after(async () => {
    await stopServer();
  });

  describe('auth by username', () => {
    it('should return 200 when username and password are right', async () => {
      const token = (await request
        .post('/api/auth')
        .send({
          strategy: 'username',
          payload: {
            username: 'foo',
            password: '12345678'
          }
        })
        .expect(200)).body.data;
      const data = await jwt.verify(token);
      assert.strictEqual(data.uid, userData[0]._id);
      assert.strictEqual(data.role, userData[0].roles);
    });

    it('should return 400 when username is wrong', () =>
      request
        .post('/api/auth')
        .send({
          strategy: 'username',
          payload: {
            username: 'bar',
            password: '12345678'
          }
        })
        .expect(400)
        .then(res => assert.strictEqual(res.body.message, 'User does not exist'))
    );

    it('should return 400 when password is wrong', () =>
      request
        .post('/api/auth')
        .send({
          strategy: 'username',
          payload: {
            username: 'foo',
            password: '23456789'
          }
        })
        .expect(400)
        .then(res => assert.strictEqual(res.body.message, 'Wrong password'))
    );
  });

  describe('auth by email', () => {
    it('should return 200 when email and password are right', async () => {
      const token = (await request
        .post('/api/auth')
        .send({
          strategy: 'email',
          payload: {
            email: 'foobar@example.com',
            password: '23456789'
          }
        })
        .expect(200)).body.data;
      const data = await jwt.verify(token);
      assert.strictEqual(data.uid, userData[1]._id);
      assert.strictEqual(data.role, userData[1].roles);
    });

    it('should return 400 when email is wrong', () =>
      request
        .post('/api/auth')
        .send({
          strategy: 'email',
          payload: {
            email: 'foo@example.com',
            password: '23456789'
          }
        })
        .expect(400)
        .then(res => assert.strictEqual(res.body.message, 'User does not exist'))
    );

    it('should return 400 when password is wrong', () =>
      request
        .post('/api/auth')
        .send({
          strategy: 'email',
          payload: {
            email: 'foobar@example.com',
            password: '12345678'
          }
        })
        .expect(400)
        .then(res => assert.strictEqual(res.body.message, 'Wrong password'))
    );
  });

  describe('auth by jwt', () => {
    it('should return 200 and invalidate old JWT', async () => {
      const token = (await request
        .post('/api/auth')
        .send({
          strategy: 'jwt',
          payload: {
            jwt: jwtData[0]
          }
        })
        .expect(200)).body.data;
      assertThrowsAsync(jwt.verify(jwtData[0]), jwt.RevokedError);
      const data = await jwt.verify(token);
      assert.strictEqual(data.uid, userData[0]._id);
      assert.strictEqual(data.role, userData[0].roles);
      const anotherData = await jwt.verify(jwtData[1]);
      assert.strictEqual(anotherData.uid, userData[0]._id);
      assert.strictEqual(anotherData.role, userData[0].roles);
    });
  });
});
