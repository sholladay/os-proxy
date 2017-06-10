'use strict';

const { execFile } = require('child_process');

const exec = (...args) => {
    return new Promise((resolve, reject) => {
        execFile(...args, (err, stdout) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(stdout);
        });
    });
};

module.exports = exec;
