'use strict';

const
    childExec = require('child_process').exec,
    space = require('dangit').space,
    // Binaries that manage network devices / services.
    apis = {
        // OS X.
        darwin : 'networksetup',
        // Windows (32-bit or 64-bit)
        win32  : 'reg'
        // NOTE: We could also detect: freebsd, linux, sunos
    },
    api = apis[process.platform];

function exec() {
    return new Promise((resolve) => {
        childExec(space(api, ...arguments), (err, stdout) => {
            if (err) {
                throw err;
            }
            resolve(stdout);
        });
    });
};

module.exports = exec;
