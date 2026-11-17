// Un JPEG empieza con FF D8 FF y termina con FF D9.
function isJpeg(buf) {
  return Buffer.isBuffer(buf) && buf.length > 4 &&
    buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff &&
    buf[buf.length - 2] === 0xff && buf[buf.length - 1] === 0xd9;
}

module.exports = { isJpeg };
