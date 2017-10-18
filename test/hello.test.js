const server = new (require('../src/server'))();
const assert = require('assert');

describe('A hello world test', () => {
  let request;

  before(async () => {
    await server.start(require('../config.json'));
    request = require('supertest')(server.app.context.global.server);
  });
  before(() => server.stop());

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
