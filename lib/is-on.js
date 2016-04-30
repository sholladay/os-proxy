// This module exists to help determine the status of a
// network device / service.

'use strict';

function isOn(input) {

    const onValues = [
        true,
        'true',
        'yes',
        'on',
        'enabled'
    ];

    if (input && typeof input.toLowerCase === 'function') {
        input = input.toLowerCase();
    }

    return onValues.includes(input);
}

module.exports = isOn;
