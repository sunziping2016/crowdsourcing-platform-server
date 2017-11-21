const alnumChars = '0123456789' +
  'abcdefghijklmnopqrstuvwxyz' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomAlnumString(length) {
  let result = '';
  for (let i = 0; i < length; ++i)
    result += alnumChars[Math.floor(Math.random() * alnumChars.length)];
  return result;
}

function promisify(func, settings) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      args.push((err, ...values) => {
        if (err)
          reject(err);
        else if (settings && settings.multiArgs)
          resolve(values);
        else
          resolve(values[0]);
      });
      func.apply((settings && settings.thisArg) || settings || this, args);
    });
  };
}

module.exports = {
  randomAlnumString,
  promisify
};
