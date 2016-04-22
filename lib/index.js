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
    YAML     = require('yamljs'),          // parse output from OS X networksetup
    chokidar = require('chokidar'),        // watch the file system
    assert   = require('chai').assert,
    dangit   = require('dangit'),          // misc. helpers
    space    = dangit.space,
    quote    = dangit.quote,
    event    = require('./event'),
    isOn     = require('./is-on'),
    exec     = require('./exec'),
    platform = process.platform,
    // TODO: Get the current device at runtime to support Ethernet, etc.
    device = 'Wi-Fi';  // the network interface to use as the context for configuration

// TODO: Support Windows.
//       http://www.ehow.com/how_6887864_do-proxy-settings-command-prompt_.html

if (platform !== 'darwin') {
    throw new Error(
        `Support for ${process.platform} is not ready yet. Pull requests welcome!`
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
const
    file = {
        // OS X.
        darwin : '/Library/Preferences/SystemConfiguration/preferences.plist',
        // Windows (32-bit or 64-bit)
        win32  : ''
    }[platform];

const
    apiArg = {
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
    }[platform];

// Promise helpers.

// Helper for screening the output of a shell command. Useful when we need to
// parse some output.
function assertOutput(output) {
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
function handleError(action) {
    return function onError(err) {
        // Exit code of the shell command.
        const code = Number(err.message);

        const reason = code ? `Exit code ${code}.` : 'No output to parse.';

        throw new Error(
            `Unable to ${action} proxy configuration. ${reason}`
        );
    }
}

// Post shell command actions.


// Handler for parsing the shell output when we ask the OS for the
// current proxy config.
function onGet(output) {

    const parsed = YAML.parse(output);

    // OS X answers with less than ideal property names.
    // We normalize them here before anyone sees it.
    return {
        hostname : parsed.Server,
        port     : parsed.Port,
        enabled  : isOn(parsed.Enabled)
    };
}


// Public APIs.

// API for retrieving the currently configured proxy.
function get(option) {

    assert.isObject(option);

    if (!option.device || typeof option.device !== 'string') {
        option.device = device;
    }

    return exec(
            apiArg.get,
            option.device
        )
        .then(assertOutput)  // demand output to parse
        .catch(handleError(get.name))
        .then(onGet);        // parse and format the result
}

// API for setting and optionally turning on a new proxy configuration.
function set(option) {

    // Example:
    // {
    //     protocol : 'https',
    //     hostname : 'localhost',
    //     port     : 8000,
    //     enabled  : true
    // }

    assert(
        dangit.isExtendableType(option),
        'option must be object-like.'
    );

    assert.isDefined(
        option.hostname,
        `option.hostname must be provided.`
    );

    assert.isDefined(
        option.port,
        `option.port must be provided.`
    );

    option = Object.create(option);

    // Setting a proxy generally means you want to use it and therefor we
    // enable it by default.
    if (typeof option.enabled === 'undefined') {
        option.enabled = true;
    }
    if (!option.device || typeof option.device !== 'string') {
        option.device = device;
    }

    let promise = exec(
            apiArg.set,
            quote(option.device),
            quote(option.hostname),
            option.port
        )
        .catch(handleError(set.name));

    // Deal with the case where OS X turns on the proxy,
    // but the user passes enabled:false
    if (!option.enabled && typeof option.enabled !== 'undefined') {
        promise = promise.then(disable);
    }

    return promise;
}

// API for turning on the currently configured proxy.
function enable() {

    return exec(
            apiArg.enable,
            device,
            'on'
        )
        .catch(handleError(enable.name));
}

// API for turning off the currently configured proxy, but keeps
// it in the operating system's data store.
function disable() {

    return exec(
            apiArg.disable,
            device,
            'off'
        )
        .catch(handleError(disable.name));
}

// API for toggling the currently configured proxy between on and off.
function toggle() {

    // Based on whether the currently configured proxy is enabled,
    // return a promise to set it to the opposite state.
    function choose(proxy) {
        return proxy.enabled ? disable() : enable();
    }

    return get()
        .then(choose)
        .catch(handleError(toggle.name));
}

// API for turning off and wiping out the currently configured proxy
// from the operating system's data store.
function remove() {

    return set({
            hostname : '',
            port     : '',
            enabled  : false
        })
        .catch(handleError(remove.name));
}


// File system watching helpers.

// Handler for file system changes related to proxy configuration.
function onChange(path) {

    // Inform our users that the content of the watched file has changed.
    // TODO: Consider parsing and delivering the config store data when
    //       emitting the 'change' event. For example, on OS X the
    //       'plist' npm module could do this.
    osProxy.changed.emit(
        new event.Change({
            path
        })
    );
}

// File system watcher that is aware of changes to the system proxy settings
// caused by any application.
let watcher;

// API for activating a file system watcher, which will be notified about
// changes to the OS preferences, regardless of who makes the change.
function watch() {

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

// API for deactivating an existing file system watcher.
function unwatch() {

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

const osProxy = {
    changed : new Signal(),
    get : get,  // retrieve proxy config
    set : set,  // change proxy config
    enable,     // activate existing proxy config
    disable,    // deactivate existing proxy config
    toggle,     // flip activation state of existing proxy config
    remove,     // delete proxy config from storage
    watch,      // begin emitting events about config store changes
    unwatch     // stop emitting events about config store changes
};

// The public API.

module.exports = osProxy;
