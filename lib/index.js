//
// Copyright (C) 2015 Seth Holladay.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//

// This module is designed to modify your operating system's proxy settings.

// Similar to: https://github.com/helloyou2012/system-proxy

'use strict';

const
    Signal   = require('adverb-signals'),  // emit and listen to events
    Promise  = require('bluebird'),        // full-featured Promise library
    child    = require('child_process'),   // run shell commands, etc.
    YAML     = require('yamljs'),          // parse output from OS X networksetup
    chokidar = require('chokidar'),        // watch the file system
    assert   = require('chai').assert,
    dangit   = require('dangit'),          // misc. helpers
    space    = dangit.space,
    quote    = dangit.quote,
    event    = require('./event'),
    isOn     = require('./is-on'),
    exec     = Promise.promisify(child.exec, child),
    platform = process.platform,
    // TODO: Get the current device at runtime to support Ethernet, etc.
    device = 'Wi-Fi';  // the network interface to use as the context for configuration

let watcher;  // file system watcher (for proxy changes from other apps)

// TODO: Support Windows.
//       http://www.ehow.com/how_6887864_do-proxy-settings-command-prompt_.html

if (platform !== 'darwin') {
    throw new Error(
        'Support for ' + process.platform + ' is not ready yet. Pull requests welcome!'
    );
}

// TODO: Support secure HTTPS proxy configuration.

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

// These data stores contain metadata about configured proxies.
// They may get modified by other tools outside of our API
// and so need to be watched to stay fully up to date.
const files = {
        // OS X.
        darwin : '/Library/Preferences/SystemConfiguration/preferences.plist',
        // Windows (32-bit or 64-bit)
        win32  : ''
    },
    file = files[platform];

// Binaries that manage network devices / services.
const apis = {
        // OS X.
        darwin : 'networksetup',
        // Windows (32-bit or 64-bit)
        win32  : 'reg'
        // NOTE: We could also detect: freebsd, linux, sunos
    },
    api = apis[platform];

const apiArgs = {
        darwin : {
            get     : '-getwebproxy',
            set     : '-setwebproxy',
            enable  : '-setwebproxystate',
            disable : '-setwebproxystate'
        },
        win32 : {  // NOTE: Windows support is not ready yet. Pull requests welcome!
            get     : '',
            set     : '',
            enable  : '',
            disable : space(
                'add',
                quote('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'),
                '/v',
                'ProxyEnable',
                '/t',
                'REG_DWORD',
                '/d',
                '0',
                '/f'
            )
        }
    },
    apiArg = apiArgs[platform];

// When asking OS X about proxy config, it answers with less than ideal
// property names. This map is used to fix that before anyone sees it.
const keyMap = {
    Server  : 'hostname',
    Port    : 'port',
    Enabled : 'enabled'
};

function mapFilteredKeys(source, map) {
    const result = {};
    for (let key in map) {
        if (Object.prototype.hasOwnProperty.call(map, key) &&
            Object.prototype.hasOwnProperty.call(source, key)) {

            result[map[key]] = source[key];
        }
    }

    return result;
}

// Promise helpers.

function requireOutput(output) {

    // This function is designed to screen the output of a shell command
    // by passing it through only if it is truthy, otherwise throwing,
    // in order to reject a promise.

    if (!output) {
        // We reject the promise with the exit code of the
        // shell command, in order to catch and re-throw a
        // nicer error later on. We know it is 0 because
        // shell errors take a different code path.
        throw new Error(0);
    }

    return output;
}

// Shell command error handlers.

function onError(err, action) {

    // This function is designed to format errors from our APIs.

    // Exit code of the shell command.
    const code = Number(err.message);

    let reason;

    if (code) {
        reason = 'Exit code ' + code + '.';
    }
    else {
        reason = 'No output to parse.';
    }

    throw new Error(
        'Unable to ' + action + ' proxy configuration. ' + reason
    );
}

function onGetError(err) {

    // This function is designed to handle errors in the get() API.

    return onError(err, 'get');
}

function onSetError(err) {

    // This function is designed to handle errors in the set() API.

    return onError(err, 'set');
}

function onEnableError(err) {

    // This function is designed to handle errors in the enable() API.

    return onError(err, 'enable');
}

function onDisableError(err) {

    // This function is designed to handle errors in the disable() API.

    return onError(err, 'disable');
}

function onToggleError(err) {

    // This function is designed to handle errors in the toggle() API.

    return onError(err, 'toggle');
}

function onRemoveError(err) {

    // This function is designed to handle errors in the remove() API.

    return onError(err, 'remove');
}


// Post shell command actions.

function onGet(output) {

    // This function is designed to parse the shell output
    // when we ask the OS about the current proxy config.

    const
        result = mapFilteredKeys(
            YAML.parse(output),
            keyMap
        );

    result.enabled = isOn(result.enabled);

    return result;
}


// Public APIs.

function get(options) {

    // This function retrieves the currently configured proxy.

    assert.isObject(options);

    if (!options.interface || typeof options.device !== 'string') {
        options.device = device;
    }

    return exec(
            space(
                api,
                apiArg.get,
                options.device
            )
        )
        .then(
            requireOutput  // throw a custom error if no output
        )
        .catch(
            onGetError     // handle any past errors
        )
        .then(
            onGet          // parse and format the result for our users
        );
}

function set(options) {

    // This function sets and optionally turns on a new proxy configuration.

    // Example:
    // {
    //     protocol : 'https',
    //     hostname : 'localhost',
    //     port     : 8000,
    //     enabled  : true
    // }

    assert(
        dangit.isExtendableType(options),
        'options must be object-like.'
    );

    assert.isDefined(
        options.hostname,
        `options.hostname must be provided.`
    );

    assert.isDefined(
        options.port,
        `options.port must be provided.`
    );

    options = Object.create(options);

    // Setting a proxy generally means you want to use it and therefor we
    // enable it by default.
    if (typeof options.enabled === 'undefined') {
        options.enabled = true;
    }
    if (!options.device || typeof options.device !== 'string') {
        options.device = device;
    }

    let promise = exec(
            space(
                api,
                apiArg.set,
                quote(options.device),
                quote(options.hostname),
                options.port
            )
        )
        .catch(
            onSetError
        );

    // Deal with the case where OS X turns on the proxy,
    // but the user passes enabled:false
    if (!options.enabled) {
        promise = promise.then(disable);
    }

    return promise;
}

function enable() {

    // This function turns on the currently configured proxy.

    return exec(
            space(
                api,
                apiArg.enable,
                device,
                'on'
            )
        )
        .catch(
            onEnableError  // handle any past errors
        );

}

function disable() {

    // This function turns off the currently configured proxy, but keeps
    // it in the operating system's data store.

    return exec(
            space(
                api,
                apiArg.disable,
                device,
                'off'
            )
        )
        .catch(
            onDisableError  // handle any past errors
        );
}

function toggle() {

    // This function toggles the currently configured proxy between on and off.

    function choose(proxy) {
        // Based on whether the currently configured proxy is enabled,
        // return a promise to set to the opposite state.
        return proxy.enabled ? disable() : enable();
    }

    return get()
        .then(choose)
        .catch(onToggleError);
}

function remove() {

    // This function turns off and wipes out the currently configured proxy
    // from the operating system's data store.

    return set(
            {
                hostname : '',
                port     : '',
                enabled  : false
            }
        )
        .catch(
            onRemoveError
        );
}


// File system watching helpers.

function onChange(path) {

    // This function is designed to run every time the file system
    // watcher detects changes to the config store.

    // Inform our users that the content of the watched file has changed.
    // TODO: Consider parsing and delivering the config store data when
    //       emitting the 'change' event. For example, on OS X the
    //       'plist' npm module could do this.
    osProxy.changed.emit(
        new event.Change(
            {
                path : path
            }
        )
    );
}

function watch() {

    // This function is designed to activate a file system watcher,
    // which will be notified about changes to the OS preferences,
    // regardless of who makes the change or how.

    // TODO: When rest parameters become available in Node, use it
    // instead of this.
    const args = [...arguments];

    // By default, watch the platform-specific config store we have computed.
    if (typeof args[0] === 'undefined') {
        args[0] = file;
    }

    // If we are already watching, just add to the current set.
    if (watcher) {
        watcher.add(...args);
    }
    else {
        watcher = chokidar.watch(...args).on(
            'change',
            onChange
        );
    }

    return watcher;
}

function unwatch() {

    // This function is designed to deactivate an existing file system watcher.

    // If we are not currently watching, there is nothing to do.
    if (!watcher) {
        return;
    }

    const args = [...arguments];

    // By default, watch the platform-specific config store we have computed.
    if (typeof args[0] === 'undefined') {
        args[0] = file;
    }

    return watcher.unwatch(...args);
}

function osProxy() {
    return set(...arguments);
}

// Endow osProxy with event signals.
osProxy.changed = new Signal();

osProxy.get     = get;      // retrieve proxy config
osProxy.set     = set;      // change proxy config
osProxy.enable  = enable;   // activate existing proxy config
osProxy.disable = disable;  // deactivate existing proxy config
osProxy.toggle  = toggle;   // flip activation state of existing proxy config
osProxy.remove  = remove;   // delete proxy config from storage
osProxy.watch   = watch;    // begin emitting events about config store changes
osProxy.unwatch = unwatch;  // stop emitting events about config store changes

// Expose the public API.

module.exports = osProxy;
