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

const Signal = require('adverb-signals');
const YAML = require('yamljs');
const chokidar = require('chokidar');
const { assert } = require('chai');
const dangit = require('dangit');
const event = require('./event');
const isOn = require('./is-on');
const exec = require('./exec');

const { space, quote } = dangit;
const { platform } = process;
// The network interface to use as the context for configuration.
// TODO: Get the current device at runtime.
const device = 'Wi-Fi';

// TODO: Support Windows.
//       http://www.ehow.com/how_6887864_do-proxy-settings-command-prompt_.html

if (platform !== 'darwin') {
    throw new Error(
        `Support for ${platform} is not ready yet. Pull requests welcome!`
    );
}

// TODO: Support secure HTTPS proxy configuration.

// In these examples, "Wi-Fi" could be other interfaces like "Built-In Ethernet".

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
const file = {
    // OS X.
    darwin : '/Library/Preferences/SystemConfiguration/preferences.plist',
    // Windows (32-bit or 64-bit)
    win32  : ''
}[platform];

const cliArg = {
    darwin : {
        get     : '-getwebproxy',
        set     : '-setwebproxy',
        enable  : '-setwebproxystate',
        disable : '-setwebproxystate'
    },
    // NOTE: No Windows support yet. Pull requests welcome!
    win32 : {
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
const assertOutput = (output) => {
    if (output) {
        return output;
    }

    // Error with the exit code of the shell command. We know it is 0 because
    // shell errors take a different code path. We will catch and re-throw
    // a more friendly error later on.
    throw new Error(0);
};

// Create shell command error handlers.
const handleError = (api) => {
    const onError = (err) => {
        const code = Number(err.message);
        const reason = code ? `Exit code ${code}.` : 'No output to parse.';

        throw new Error(
            `Unable to ${api.name} proxy configuration. ${reason}`
        );
    };

    return onError;
};

// Post shell command actions.

// Handler for parsing the shell output when we ask the OS for the
// current proxy config.
const onGet = (output) => {
    const parsed = YAML.parse(output);

    // OS X answers with less than ideal property names.
    // We normalize them here before anyone sees it.
    return {
        hostname : parsed.Server,
        port     : parsed.Port,
        enabled  : isOn(parsed.Enabled)
    };
};

// Public APIs.

// API for retrieving the currently configured proxy.
const get = (option) => {
    assert.isObject(option);

    if (!option.device || typeof option.device !== 'string') {
        option.device = device;
    }

    return exec(
            cliArg.get,
            option.device
        )
        .then(assertOutput)
        .catch(handleError(get))
        .then(onGet);
};

// API for setting and optionally turning on a new proxy configuration.
const set = (option) => {
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
            cliArg.set,
            quote(option.device),
            quote(option.hostname),
            option.port
        )
        .catch(handleError(set));

    // Deal with the case where OS X turns on the proxy,
    // but the user passes enabled:false
    if (!option.enabled && typeof option.enabled !== 'undefined') {
        return promise.then(disable);
    }

    return promise;
};

// API for turning on the currently configured proxy.
const enable = () => {
    return exec(
        cliArg.enable,
        device,
        'on'
    )
        .catch(handleError(enable));
};

// API for turning off the currently configured proxy, but keeps
// it in the operating system's data store.
const disable = () => {
    return exec(
        cliArg.disable,
        device,
        'off'
    )
        .catch(handleError(disable));
};

// API for toggling the currently configured proxy between on and off.
const toggle = () => {
    // Based on whether the currently configured proxy is enabled,
    // return a promise to set it to the opposite state.
    const choose = (proxy) => {
        return proxy.enabled ? disable() : enable();
    };

    return get()
        .then(choose)
        .catch(handleError(toggle));
};

// API for turning off and wiping out the currently configured proxy
// from the operating system's data store.
const clear = () => {
    return set({
        hostname : '',
        port     : '',
        enabled  : false
    })
        .catch(handleError(clear));
};

// File system watching helpers.

// Handler for file system changes related to proxy configuration.
const onChange = (path) => {
    // Inform our users that the content of the watched file has changed.
    // TODO: Consider parsing and delivering the config store data when
    //       emitting the 'change' event. For example, on OS X the
    //       'plist' npm module could do this.
    osProxy.changed.emit(
        new event.Change({
            path
        })
    );
};

// File system watcher that is aware of changes to the system proxy settings
// caused by any application.
let watcher;

// API for activating a file system watcher, which will be notified about
// changes to the OS preferences, regardless of who makes the change.
const watch = (...args) => {
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
};

// API for deactivating an existing file system watcher.
const unwatch = (...args) => {
    // If we are not currently watching, there is nothing to do.
    if (!watcher) {
        return;
    }

    // By default, watch the platform-specific config store we have computed.
    if (typeof args[0] === 'undefined') {
        args[0] = file;
    }

    return watcher.unwatch(...args);
};

const osProxy = {
    changed : new Signal(),
    get,
    set,
    enable,
    disable,
    toggle,
    clear,
    watch,
    unwatch
};

// The public API.

module.exports = osProxy;
