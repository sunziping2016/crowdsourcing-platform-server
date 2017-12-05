/**
 * 一些常用的Mongoose钩子（中间件）函数。具体可以参见[Mongoose Middleware](http://mongoosejs.com/docs/middleware.html)。
 *
 * @module models/hook
 */
const fs = require('fs');
const path = require('path');
const logger = require('winston');

/**
 * 向schema对象添加一个自动初始化新文档对象某字段为当前时间的钩子。这个钩子对于`save`、`update`
 * 和`findOneAndUpdate`操作有效。注意：该钩子对`insertMany`无效。
 *
 * @param schema {mongoose.Schema} schema对象
 * @param field {string} 可选，字段名称，默认为`createdAt`
 */
function addCreatedAt(schema, field) {
  if (!field)
    field = 'createdAt';
  schema.pre('save', function (next) {
    if (this.isNew)
      this[field] = new Date();
    next();
  });
  schema.pre('findOneAndUpdate', function () {
    const update = this.getUpdate();
    update['$setOnInsert'] = update['$setOnInsert'] || {};
    update['$setOnInsert'][field] = new Date();
  });
  schema.pre('update', function () {
    const update = this.getUpdate();
    update[field] = new Date();
    update['$setOnInsert'] = update['$setOnInsert'] || {};
    update['$setOnInsert'][field] = new Date();
  });
}

/**
 * 向schema对象添加一个在文档更新时，把某字段设为当前时间的钩子。这个钩子对于`save`、`update`
 * 和`findOneAndUpdate`操作有效。注意：该钩子对`insertMany`无效。
 *
 * @param schema {mongoose.Schema} schema对象
 * @param field {string} 可选，字段名称，默认为`updatedAt`
 */
function addUpdatedAt(schema, field) {
  if (!field)
    field = 'updatedAt';
  schema.pre('save', function (next) {
    if (this.isModified())
      this[field] = new Date();
    next();
  });
  schema.pre('findOneAndUpdate', function () {
    const update = this.getUpdate();
    update[field] = new Date();
  });
  schema.pre('update', function () {
    const update = this.getUpdate();
    update[field] = new Date();
  });
}

/**
 * 向schema对象添加一个软删除的钩子。这个钩子对于`save`、`update`和`findOneAndUpdate`操作有效。
 * 注意：该钩子对`insertMany`无效。此外添加了`deleted`和`notDeleted`的query helper，并添加了
 * delete方法。
 *
 * @param schema {mongoose.Schema} schema对象
 * @param field {string} 可选，字段名称，默认为`deleted`
 */
function addDeleted(schema, field) {
  if (!field)
    field = 'deleted';
  schema.pre('save', function (next) {
    if (this.isNew && !this[field])
      this[field] = false;
    next();
  });
  schema.pre('findOneAndUpdate', function () {
    const update = this.getUpdate();
    update['$setOnInsert'] = update['$setOnInsert'] || {};
    if (!update['$setOnInsert'][field])
      update['$setOnInsert'][field] = false;
  });
  schema.pre('update', function () {
    const update = this.getUpdate();
    update['$setOnInsert'] = update['$setOnInsert'] || {};
    if (!update['$setOnInsert'][field])
      update['$setOnInsert'][field] = false;
  });
  schema.query.deleted = function (deleted) {
    return this.where(field).eq(true);
  };
  schema.query.notDeleted = function () {
    return this.where(field).ne(true);
  };
  schema.methods.delete = function () {
    this[field] = true;
    return this.save();
  };
}

/**
 * 向schema对象添加一个在文档某些对应于文件的字段发生变化时，自动删除旧文件的钩子。该钩子仅对于
 * `save`和`remove`操作有效。
 *
 * @param schema {mongoose.Schema} schema对象
 * @param fields {Array<string>} 字段集合
 * @param uploadDir {string} 可选，上传的目录，默认为当前目录
 */
function addFileFields(schema, fields, uploadDir) {
  if (fields.length === 0)
    return;
  if (uploadDir === undefined)
    uploadDir = '';
  function errLogger(filename) {
    return err => {
      if (err) {
        logger.error(`Failed to delete file "${filename}".`);
        logger.error(err);
      }
    };
  }
  schema.post('init', doc => {
    for (let field of fields)
      doc['_' + field] = doc[field];
  });
  schema.post('save', doc => {
    for (let field of fields) {
      const oldFilename = doc['_' + field];
      if (oldFilename && oldFilename !== doc[field])
        fs.unlink(path.join(uploadDir, oldFilename), errLogger(oldFilename));
    }
  });

  schema.post('remove', doc => {
    for (let field of fields) {
      const oldFilename = doc['_' + field];
      if (oldFilename)
        fs.unlink(path.join(uploadDir, oldFilename), errLogger(oldFilename));
    }
  });
}

module.exports = {
  addCreatedAt,
  addUpdatedAt,
  addDeleted,
  addFileFields
};
