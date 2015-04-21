// This module exists to help determine the
// status of a network device / service.

function isOn() {

    // This function is designed to return true if all
    // given arguments indicate the intention is for
    // something to be enabled / on / true, etc.

    var i, arg, choices, result = true,
        len = arguments.length;

    choices = [
        true,
        'true',
        'yes',
        'on',
        'enabled'
    ];

    for (i = 0; i < len; i = i + 1) {
        arg = arguments[i];
        if (arg && typeof arg.toLowerCase === 'function') {
            arg = arg.toLowerCase();
        }
        if (choices.indexOf(arg) < 0) {
            return false;
        }
    }

    return result;
}

module.exports = isOn;
