'use strict';

const childExec = require('child_process').exec;
const { space } = require('dangit');
// CLI that manages network devices / services.
const cli = {
    // OS X.
    darwin : 'networksetup',
    // Windows (32-bit or 64-bit)
    win32  : 'reg'
    // NOTE: We could also detect: freebsd, linux, sunos
}[process.platform];

const exec = (...args) => {
    return new Promise((resolve, reject) => {
        childExec(space(cli, ...args), (err, stdout) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(stdout);
        });
    });
};

module.exports = exec;
