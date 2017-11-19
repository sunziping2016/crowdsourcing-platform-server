const assert = require('assert');
const {startServer, stopServer, server, clearRedis, createJwts,
  setTimeoutAsync, assertThrowsAsync} = require('../helper');

const data = [
  {payload: {uid: 'foobar'}, options: {expiresIn: '1s'}},
  {payload: {uid: 'foo'}, options: {expiresIn: '2s'}},
  {payload: {uid: 'foo'}, options: {expiresIn: '2s'}},
  {payload: {uid: 'bar'}, options: {expiresIn: '2s'}},
  {payload: {uid: 'bar'}, options: {expiresIn: '2s'}}
];

describe('JWT model test', () => {
  let jwt;

  before(async () => {
    await clearRedis();
    await startServer();
    (await createJwts(data)).map((x, i) => data[i].jwt = x);
    jwt = server.app.context.global.jwt;
  });
  after(async () => {
    await stopServer();
  });

  describe('secret key creation test', () => {
    it('should has secret key', async () => {
      assert.notStrictEqual(await jwt.getSecretKey(), null);
    });
  });

  describe('JWT verify test', async () => {
    it('every JWT can be verified equal to payload', async () => {
      assert.deepStrictEqual(await Promise.all(data.map(x => jwt.verify(x.jwt))),
        data.map(x => x.payload));
    });
  });
  describe('JWT revoke test', () => {
    it('revoke foo\'s all jwts', async () => {
      await jwt.revoke('foo');
      await Promise.all(data
        .filter(item => item.payload.uid === 'foo')
        .map(item => assertThrowsAsync(jwt.verify(item.jwt), jwt.RevokedError))
      );
    });

    it('revoke bar\'s certain jwt', async () => {
      await jwt.revoke('bar', data[3].payload.jti);
      await assertThrowsAsync(jwt.verify(data[3].jwt), jwt.RevokedError);
      assert.deepStrictEqual(await jwt.verify(data[4].jwt), data[4].payload);
    });
  });

  describe('JWT expires test', () => {
    it('foobar\'s jwt should expires after 1s', async () => {
      await setTimeoutAsync(1000);
      await assertThrowsAsync(jwt.verify(data[0].jwt), jwt.TokenExpiredError);
    });
  });
});
