const alnumChars = '0123456789' +
  'abcdefghijklmnopqrstuvwxyz' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomAlnumString(length) {
  let result = '';
  for (let i = 0; i < length; ++i)
    result += alnumChars[Math.floor(Math.random() * alnumChars.length)];
  return result;
}

function redisify(object) {
  let result = [];
  for (let key in object) {
    if (!object.hasOwnProperty(key))
      continue;
    result.push(key);
    if (typeof object[key] === 'object')
      result.push(JSON.stringify(object[key]));
    else
      result.push(object[key]);
  }
  return result;
}

module.exports = {
  randomAlnumString,
  redisify
};
