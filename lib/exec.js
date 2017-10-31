'use strict';

const util = require('util');
const childProcess = require('child_process');

const execFile = util.promisify(childProcess.execFile);

const exec = async (...args) => {
    const { stdout } = await execFile(...args);
    return stdout;
};

module.exports = exec;
