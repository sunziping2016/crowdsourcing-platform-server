// const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

module.exports = function (global) {
  const {db} = global;
  const userSchema = new mongoose.Schema({
    username: {type: String, required: true},
    password: {type: String, default: null},
    email: {type: String},
    nickname: {type: String},
    avatar: {type: String},
    avatarThumbnail: {type: String},
    createdAt: {type: Date},
    updatedAt: {type: Date},
    secureUpdatedAt: {type: Date, required: true},
    roles: {type: [
      {
        type: String,
        enum: [
          'subscriber',
          'publisher',
          'taskAdmin',
          'userAdmin',
          'siteAdmin'
        ]
      }
    ]}
  });

  return db.model('users', userSchema);
};
