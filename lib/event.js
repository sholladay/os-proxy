'use strict';

class Change {
    constructor(options) {
        if (typeof options.path !== 'string') {
            throw new Error('Path must be a string.');
        }
        this.path = options.path;
    }
}

module.exports = {
    Change
};
