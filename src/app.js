const http = require('http');
const server = http.createServer((request, response) => {
  console.log(request.url);
  response.end('hello, world!');
});

module.exports = server;
