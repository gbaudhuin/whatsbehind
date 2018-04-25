const assert = require('assert');
const describe = require('mocha').describe;
const it = require('mocha').it;
const fs = require('fs');
const proxyquire = require('proxyquire');

const stringHelper = require('../src/stringHelper');

describe('stringHelper', () => {
  describe('crlf2lf', () => {
    it('convert crlf to lf', function () {
      const crlf = fs.readFileSync('./test/data/github_crlf.html');
      const lf = fs.readFileSync('./test/data/github_lf.html');
      const converted = stringHelper.crlf2lf(crlf);

      assert.equal(converted.length, lf.length);
      var same = true;
      for (var i = 0; i < lf.length; i++) {
        if (lf[i] !== converted[i]) {
          same = false;
          break;
        }
      }
      assert.ok(same);
    });
  })

  describe('md5', () => {
    const MD5_RESULT = 'md5 result';
    const HASH = {
      update: () => {},
      digest: () => MD5_RESULT
    }

    const getMockStringHelper = (hash) => {
      const stringHelper = proxyquire('../src/stringHelper.js', {
        crypto: {
          createHash: (type) => {
            assert.equal(type, 'md5');
            return hash;
          }
        }
      })
      return stringHelper;
    }

    it('calls createHash on crypto', () => {
      let createHashCalled = false;
      const stringHelper = proxyquire('../src/stringHelper.js', {
        crypto: {
          createHash: (type) => {
            assert.equal(type, 'md5');
            createHashCalled = true;
            return HASH;
          }
        }
      })

      stringHelper.md5('test');
      assert(createHashCalled);
    });

    it('calls update on hash', () => {
      let updateCalled = false;
      const HASH = {
        update: (string) => {
          assert.equal(string, 'test');
          updateCalled = true;
        },
        digest: () => MD5_RESULT
      }
      const stringHelper = getMockStringHelper(HASH);
      stringHelper.md5('test');
      assert(updateCalled);
    });

    it('calls digest on hash', () => {
      let digestCalled = false;
      const HASH = {
        update: () => {},
        digest: () => {
          digestCalled = true;
          return MD5_RESULT;
        }
      }
      const stringHelper = getMockStringHelper(HASH);
      stringHelper.md5('test');
      assert(digestCalled);
    });

    it('returns the md5 value', () => {
      const stringHelper = getMockStringHelper(HASH);
      const result = stringHelper.md5('test');
      assert.equal(result, MD5_RESULT);
    })
  })

  describe('trimChar', () => {
    it('removes the char at the beginning of the string', () => {
      const result = stringHelper.trimChar('aaaabcd', 'a');
      assert.equal(result, 'bcd');
    });

    it('removes the char at the end of the string', () => {
      const result = stringHelper.trimChar('abcddddddd', 'd');
      assert.equal(result, 'abc');
    });

    it('does not remove the char if not at the beginning and not at the end of the string', () => {
      const result = stringHelper.trimChar('aaaabcd', 'b');
      assert.equal(result, 'aaaabcd');
    });
  })
})