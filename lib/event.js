'use strict';

class Change {
    constructor(option) {
        if (typeof option.path !== 'string') {
            throw new Error('Path must be a string.');
        }
        this.path = option.path;
    }
}

module.exports = {
    Change
};
