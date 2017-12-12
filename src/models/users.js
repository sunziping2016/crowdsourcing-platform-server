/**
 * 用户model，存储了所有用户（包括管理员和普通用户）的信息。
 *
 * @module models/users
 */
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const {addCreatedAt, addUpdatedAt, addDeleted, addFileFields} = require('./hooks');

/**
 * 创建`users` model。
 *
 * @param global {object} 全局对象，主要使用了以下字段：
 *   - config：读取上传目录
 *   - db：Mongoose链接
 * @return {mongoose.model} `users` model
 */
module.exports = function (global) {
  const {config, db} = global;
  const roleEnum = {
    SUBSCRIBER: 1 << 0,
    PUBLISHER: 1 << 1,
    TASK_ADMIN: 1 << 2,
    USER_ADMIN: 1 << 3,
    SITE_ADMIN: 1 << 4
  };

  const userSettingsSchema = new mongoose.Schema({
  });

  /**
   * `users` schema对象，包含以下字段：
   *  - `username`：字符串，必要，未删除用户应当唯一
   *  - `password`：密码，必要，可以为`null`（此时密码验证永远失败）
   *  - `email`：字符串，可选，未删除用户应当唯一
   *  - `wechatId`：字符串，可选，未删除用户应当唯一
   *  - `avatar`：字符串，可选，头像文件的位置（自动删除旧文件）
   *  - `avatarThumbnail64`：字符串，可选，64x64头像文件的位置（自动删除旧文件）
   *  - `createdAt`：创建时间，自动字段
   *  - `updatedAt`：更新时间，自动字段
   *  - `blocked`: 布尔，是否被禁
   *  - `roles`：数字，必要，权限，可通过静态成员`roleEnum`获得所有的权限，可通过位运算组合
   *    - SUBSCRIBER：可以领取活动
   *    - PUBLISHER：可以发布活动
   *    - TASK_ADMIN：可以管理活动
   *    - USER_ADMIN：可以管理用户
   *    - SITE_ADMIN：可以管理网站
   *  - `settings`：用户自定义的设置
   *  - `deleted`：布尔，是否被删除，索引
   *  @class User
   */
  const userSchema = new mongoose.Schema({
    username: {type: String, required: true},
    password: {type: String, required: true},
    email: {type: String},
    wechatId: {type: String},
    nickname: {type: String},
    avatar: {type: String},
    avatarThumbnail64: {type: String},
    createdAt: {type: Date},
    updatedAt: {type: Date},
    blocked: {type: Boolean, index: true},
    roles: {type: Number, index: true},
    settings: {type: userSettingsSchema},
    deleted: {type: Boolean, index: true}
  });

  userSchema.index({username: 1}, {
    unique: true,
    partialFilterExpression: {
      deleted: false
    }
  });
  userSchema.index({email: 1}, {
    unique: true,
    partialFilterExpression: {
      $and: [
        {email: {$exists: true}},
        {deleted: false}
      ]
    }
  });
  userSchema.index({wechatId: 1}, {
    unique: true,
    partialFilterExpression: {
      $and: [
        {wechatId: {$exists: true}},
        {deleted: false}
      ]
    }
  });

  /**
   * 用户的角色到编号的映射
   * @name module:models/users~User.roleEnum
   */
  userSchema.statics.roleEnum = roleEnum;

  addCreatedAt(userSchema);
  addUpdatedAt(userSchema);
  addDeleted(userSchema);
  addFileFields(userSchema, ['avatar', 'avatarThumbnail64'], config['upload-dir']);

  /**
   * 检查密码正确与否
   * @param password {string} 要检查的密码
   * @return {Promise.<boolean>} 密码是否正确
   * @function module:models/users~User#checkPassword
   */
  userSchema.methods.checkPassword = async function (password) {
    if (!this.password)
      return false;
    return bcrypt.compare(password, this.password);
  };

  /**
   * 按照请求者的权限，转换成对应的对象。
   * @param auth {object} 可选，权限信息，包含uid和role
   * 那就是权限。
   * @return {object} 对象
   * @function module:models/users~User#toPlainObject
   */
  userSchema.methods.toPlainObject = function (auth) {
    const isSelf = auth && this._id.equals(auth.uid);
    const isUserAdmin = auth && (auth.role & roleEnum.USER_ADMIN) !== 0;
    const result = {
      _id: this._id.toString(),
      username: this.username,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      roles: Object.keys(roleEnum).filter(role => this.roles & roleEnum[role])
    };
    if (this.avatar !== undefined && this.avatarThumbnail64 !== undefined) {
      result.avatar = '/uploads/' + this.avatar;
      result.avatarThumbnail64 = '/uploads/' + this.avatarThumbnail64;
    }
    if (this.blocked !== undefined)
      result.blocked = this.blocked;
    if (isSelf || isUserAdmin) {
      if (this.email !== undefined)
        result.email = this.email;
      if (this.wechatId !== undefined)
        result.wechatId = this.wechatId;
    }
    if (isSelf) {
      if (this.settings !== undefined)
        result.settings = {};
    }
    return result;
  };

  return db.model('users', userSchema);
};
