// This module is designed to modify your operating system's proxy settings.

// Similar to: https://github.com/helloyou2012/system-proxy

'use strict';

var pkg        = require('../package.json'),
    shell      = require('shelljs'),
    splitLines = require('split-lines'),
    APP_NAME   = pkg.name,
    toggleMap,
    device,
    osxApi;

// TODO: Support Windows.
//       http://www.ehow.com/how_6887864_do-proxy-settings-command-prompt_.html

// Map state to the necessary config flag for networksetup on OSX.
toggleMap = {
    'false' : 'off',
    'true'  : 'on'
};

// In the following examples, "Wi-Fi" could be other interface names like "Built-In Ethernet".

// TODO: Figure out how to get list of network interfaces to enumerate.

// Determine whether an interface is on.
// networksetup -getnetworkserviceenabled Wi-Fi

// Determine whether a proxy is on.
// networksetup -getwebproxy Wi-Fi

// Set a proxy (also turns it on).
// networksetup -setwebproxy Wi-Fi localhost 8000

// Turn a proxy on or off.
// networksetup -setwebproxystate Wi-Fi off

// Get a newline seperated list of interfaces.
// networksetup -listallnetworkservices

// TODO: Support Ethernet, etc.
device = 'Wi-Fi';

api = {
    // OS X.
    darwin : 'networksetup',
    // Windows (32-bit or 64-bit)
    win32  : 'reg'
};

function getPlatform() {
    return process.platform;
}

function getApi(platform) {

    if (!platform || typeof platform !== 'string') {
        platform = getPlatform();
    }

    return api[platform];
}

function onGetInterfaces(code, output) {
    if (code !== 0) {
        console.error('Unable to get network interfaces.');
    }
    console.log('Interface:', output);
}

function onGetProxy(code, output) {

    var status = 'off';

    if (code !== 0) {
        console.error('Unable to get proxy configuration.');
    }
    else {
        // Grab the OS X log message about whether a proxy is enabled.
        // TODO: Use dangit.getPolarity() to be more robust.
        if (splitLines(output)[0].match(/^Enabled:\s*?(\w+)/i)[1].toLowerCase() === 'yes') {
            status = 'on';
        }
        console.log(
            'Proxy status:', status
        );
    }
}

function onSetProxy(code, output) {
    if (code !== 0) {
        console.error('Unable to set proxy configuration.');
    }
    else {
        console.log('Proxy configuration set.');
    }
}

function get() {

    // This function retrieves the currently configured proxy.

    // OS X.
    if (process.platform === 'darwin') {
        shell.exec(
            [osxApi, '-getwebproxy', device].join(' '),
            {
                silent : false
            },
            onGetProxy
        );
    }

    // Windows (32 or 64-bit).
    if (process.platform === 'win32') {

    }

    // We could also detect: freebsd, linux, sunos
    else {

    }
}

function set(state) {

    // This function sets and turns on a new proxy configuration.

    if ((state && typeof state !== 'string') || typeof state === 'undefined') {
        state = 'on';
    }
    else if (!state) {
        state = 'off';
    }

    // OS X.
    if (process.platform === 'darwin') {
        shell.exec(
            [osxApi, '-setwebproxystate', device, state].join(' '),
            onSetProxy
        );
    }

    // Windows (32 or 64-bit).
    if (process.platform === 'win32') {

    }

    // We could also detect: freebsd, linux, sunos
    else {

    }
}

function enable(proxy) {

    // This function optionally sets and then turns on a new proxy configuration.

    var result;

    return result;
}

function disable() {

    // This function turns off the currently configured proxy.

    // Windows (32 or 64-bit).
    if (process.platform === 'win32') {
        shell.exec(
            'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f',
            onDisableProxy
        );
    }
}

function toggle() {

    // This function toggles the currently configured proxy between on and off.

    var result;

    return result;
}

function remove() {

    // This function turns off and wipes out the currently configured proxy.

    var result;

    return result;
}

// TODO: Support secure HTTPS proxy configuration.

module.exports = {
    name          : name,
    version       : version,
    get           : get,
    set           : set,
    enable        : enable,
    disable       : disable,
    toggle        : toggle,
    remove        : remove
};
