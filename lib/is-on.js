// This module exists to help determine the status of a
// network device / service.

'use strict';

const isOn = (input) => {
    const onValues = [
        true,
        'true',
        'yes',
        'on',
        'enabled'
    ];

    return onValues.includes((input && typeof input === 'string') ? input.toLowerCase() : input);
};

module.exports = isOn;
