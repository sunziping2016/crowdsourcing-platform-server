const {startServer, stopServer} = require('./helper');

describe('Basic API test', () => {
  let request;

  before(async () => {
    request = await startServer();
  });
  after(async () => {
    await stopServer();
  });

  describe('when POST /api/user with ill formed body', () => {
    it('should return 422', () =>
      request
        .post('/api/user')
        .send('{')
        .set('Content-Type', 'application/json')
        .expect(422)
        .expect('Content-Type', /json/)
    );
  });

  describe('when GET /api/foobar', () => {
    it('should return 404', () =>
      request
        .get('/')
        .expect(404)
        .expect('Content-Type', /text/)
    );
  });
});
