const Users = require('./users');
const Jwt = require('./jwt');

module.exports = async function (global) {
  return {
    users: Users(global),
    jwt: await Jwt(global)
  };
};
