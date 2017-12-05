/**
 * `core`模块的一些辅助函数
 * @module core/utils
 */
const path = require('path');
const sharp = require('sharp');
const {randomAlnumString, getExtension} = require('../utils');

/**
 *
 * @param source {string} 源文件路径
 * @param options {object}
 *   size {number[]} 新的大小
 *   destination {string} 可选，上传路径，默认为空串
 *   filenameLength {number} 可选，默认为40
 * @return {Promise<{filename:string,path:string,destination:string}>} 保存的文件
 */
function makeThumbnail(source, options) {
  options = options || {};
  if (options.destination === undefined)
    options.destination = '';
  if (options.filenameLength === undefined)
    options.filenameLength = 40;
  const ext = getExtension(source);
  const filename = randomAlnumString(options.filenameLength) +
    (ext ? '.' + ext : '');
  const _path = path.join(options.destination, filename);
  return sharp(source)
    .resize(options.size[0], options.size[1])
    .toFile(_path)
    .then(() => {
      return {
        filename,
        destination: options.destination,
        path: _path
      };
    });
}

module.exports = {
  makeThumbnail
};
