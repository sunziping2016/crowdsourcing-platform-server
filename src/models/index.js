const Users = require('./users');

module.exports = async function (global) {
  return {
    users: Users(global)
  };
};
