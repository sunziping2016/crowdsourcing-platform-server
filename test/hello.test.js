const {startServer, stopServer} = require('./helper');
const assert = require('assert');

describe('A hello world test', () => {
  // eslint-disable-next-line no-unused-vars
  let request, server;

  before(async () => {
    [request, server] = await startServer();
  });
  before(async () => {
    await stopServer();
  });

  describe('when GET /', () => {
    it('should return hello', () =>
      request
        .get('/')
        .expect(200)
        .then(res => {
          assert.strictEqual(res.text, 'hello, world!');
        })
    );
  });
});
