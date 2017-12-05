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

function getExtension(filename) {
  const index = filename.lastIndexOf('.');
  return index === -1 ? '' : filename.substring(index + 1);
}

const matchHtmlRegExp = /["'&<>]/;

/*
 * 从[`component/escape-html`](https://github.com/component/escape-html)借鉴代码。
 */
function escapeHtml(str) {
  const match = matchHtmlRegExp.exec(str);

  if (!match)
    return str;

  let html = '';
  let index = 0;
  let lastIndex = 0;

  for (index = match.index; index < str.length; index++) {
    let escape;
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;';
        break;
      case 38: // &
        escape = '&amp;';
        break;
      case 39: // '
        escape = '&#39;';
        break;
      case 60: // <
        escape = '&lt;';
        break;
      case 62: // >
        escape = '&gt;';
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      html += str.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index
    ? html + str.substring(lastIndex, index)
    : html;
}

module.exports = {
  randomAlnumString,
  promisify,
  getExtension,
  escapeHtml
};
