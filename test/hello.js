const server = require('../src/app');
const request = require('supertest').agent(server);
const assert = require('assert');

describe('A hello world test', () => {
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
