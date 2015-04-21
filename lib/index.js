// This module is designed to modify your operating system's proxy settings.

// Similar to: https://github.com/helloyou2012/system-proxy

'use strict';

var EventEmitter = require('events').EventEmitter,  // emit and listen to events
    Promise      = require("bluebird"),  // full-featured Promise library
    shell        = require('shelljs'),   // run unix-style shell commands cross-platform
    YAML         = require('yamljs'),    // parse output from OS X networksetup
    chokidar     = require('chokidar'),  // watch the file system
    //readFile     = require('fs-readfile-promise'),  // promisified graceful-fs readFile
    //plist        = require('plist'),     // parse OS X plist files
    dangit       = require('dangit'),    // random helpers
    space        = dangit.space,
    quote        = dangit.quote,
    sanitize     = require('./sanitize'),
    isOn         = require('./is-on'),
    exec         = Promise.promisify(shell.exec, shell),
    watcher,
    files,   // list of platform-specific config stores
    file,    // the config store for the current platform
    apis,    // list of platform-specific network managers
    api,     // the network manager for the current platform
    apiArgs, // list of platform-specific lists of arguments for network managers
    apiArg,  // list of method-specific arguments for the network manager on the current platform
    device,  // the network interface to use as the context for configuration
    key,     // used in the loop for copying EventEmitter.prototype properties.
    // Default config for exec() so we don't create an object on each API call.
    execOptions = {silent : true},
    platform = process.platform;


// TODO: Support Windows.
//       http://www.ehow.com/how_6887864_do-proxy-settings-command-prompt_.html

if (platform !== 'darwin') {
    throw new Error(
        'Support for ' + process.platform + ' is not ready yet. Pull requests welcome!'
    );
}

// TODO: Support secure HTTPS proxy configuration.

// In the following examples, "Wi-Fi" could be other interface names like "Built-In Ethernet".

// TODO: Consider parsing and delivering the config store data when emitting the 'change' event.
//       For example, on OS X the 'plist' npm module could do this.

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
files = {
    // OS X.
    darwin : '/Library/Preferences/SystemConfiguration/preferences.plist',
    // Windows (32-bit or 64-bit)
    win32  : ''
};
file = files[platform];

// Binaries that manage network devices.
apis = {
    // OS X.
    darwin : 'networksetup',
    // Windows (32-bit or 64-bit)
    win32  : 'reg'
};
// NOTE: We could also detect: freebsd, linux, sunos
api = apis[platform];

apiArgs = {
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
        disable : 'add \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\" /v ProxyEnable /t REG_DWORD /d 0 /f'
    }
};

apiArg = apiArgs[platform];

// TODO: Get the current device at runtime to support Ethernet, etc.
device = 'Wi-Fi';


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

function onGetError(err) {

    // This function is designed to handle errors in the get() API.

    // Exit code of the shell command.
    var code = Number(err.message),
        reason;

    if (code) {
        reason = 'Exit code ' + code + '.';
    }
    else {
        reason = 'No output to parse.';
    }
    throw new Error(
        'Unable to get proxy configuration. ' + reason
    );
}

function onSetError(err) {

    // This function is designed to handle errors in the set() API.

    // Exit code of the shell command.
    var code = Number(err.message),
        reason;

    if (code) {
        reason = 'Exit code ' + code + '.';
    }
    else {
        reason = 'No output to parse.';
    }
    throw new Error(
        'Unable to set proxy configuration. ' + reason
    );
}

function onEnableError(err) {

    // This function is designed to handle errors in the set() API.

    // Exit code of the shell command.
    var code = Number(err.message),
        reason;

    if (code) {
        reason = 'Exit code ' + code + '.';
    }
    else {
        reason = 'No output to parse.';
    }
    throw new Error(
        'Unable to enable proxy configuration. ' + reason
    );
}

function onDisableError(err) {

    // This function is designed to handle errors in the set() API.

    // Exit code of the shell command.
    var code = Number(err.message),
        reason;

    if (code) {
        reason = 'Exit code ' + code + '.';
    }
    else {
        reason = 'No output to parse.';
    }
    throw new Error(
        'Unable to disable proxy configuration. ' + reason
    );
}

function onToggleError(err) {

    // This function is designed to handle errors in the set() API.

    // Exit code of the shell command.
    var code = Number(err.message),
        reason;

    if (code) {
        reason = 'Exit code ' + code + '.';
    }
    else {
        reason = 'No output to parse.';
    }
    throw new Error(
        'Unable to toggle proxy configuration. ' + reason
    );
}

function onRemoveError(err) {

    // This function is designed to handle errors in the set() API.

    // Exit code of the shell command.
    var code = Number(err.message),
        reason;

    if (code) {
        reason = 'Exit code ' + code + '.';
    }
    else {
        reason = 'No output to parse.';
    }
    throw new Error(
        'Unable to remove proxy configuration. ' + reason
    );
}


// Post shell command actions.

function onGet(output) {

    // This function is designed to parse the shell output
    // when we ask the OS about the current proxy config.

    var result = YAML.parse(output);

    // TODO: Yuck! As soon a Lo-Dash 3.7 is released with mapKeys(), we should use it.
    result.hostname = result.Server;
    delete result.Server;
    result.port     = result.Port;
    delete result.Port;
    result.enabled = isOn(result.Enabled) ? true : false;
    delete result.Enabled;

    delete result['Authenticated Proxy Enabled'];

    return result;
}


// Public APIs.

function get() {

    // This function retrieves the currently configured proxy.

    var options;

    options = sanitize.call(osProxy, arguments);
    if (typeof options.device === 'undefined') {
        options.device = device;  // default device
    }

    return exec(
            space(
                api,
                apiArg.get,
                options.device
            ),
            execOptions
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

function set(proxy) {

    // This function sets and optionally turns on a new proxy configuration.

    // Example:
    // {
    //     protocol : 'https',
    //     hostname : 'localhost',
    //     port     : 8000,
    //     enabled  : true
    // }

    // Everything except the first argument.
    var args = Array.prototype.slice.call(arguments, 1),
        options, promise;

    if (typeof proxy === 'undefined') {
        proxy = true;
    }
    if (typeof proxy === 'boolean') {
        proxy = {
            enabled : proxy
        };
    }
    args.unshift(proxy);
    options = sanitize.apply(osProxy, args);
    // The sanitize function plays it safe and assumes proxies should
    // not be enabled. Here we override that decision, because setting
    // a proxy in the OS usually means you want to turn it on.
    if (proxy && typeof proxy === 'object' && typeof proxy.enabled === 'undefined') {
        options.enabled = true;
    }
    if (!options.device || typeof options.device !== 'string') {
        options.device = device;  // default device
    }

    promise = exec(
            space(
                api,
                apiArg.set,
                quote(options.device),
                quote(options.hostname),
                options.port
            ),
            execOptions
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
            ),
            execOptions
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
            ),
            execOptions
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
    osProxy.emit('change', path);
}

function watch() {

    // This function is designed to activate a file system watcher,
    // which will be notified about changes to a config store.

    var watchOptions;

    // If we are already watching, don't do anything.
    if (watcher) {
        return;
    }

    // Convert arguments to a true array.
    watchOptions = Array.prototype.slice.call(arguments);

    // By default, watch the platform-specific config store we have computed.
    if (typeof arguments[0] === 'undefined') {
        watchOptions[0] = file;
    }

    watcher = chokidar.watch(watchOptions).on(
        'change',
        onChange
    );

    return watcher;
}

function unwatch() {

    // This function is designed to deactivate a file system watcher.

    var watchOptions;

    // If we are not watching, don't do anything.
    if (!watcher) {
        return;
    }

    // Convert arguments to a true array.
    watchOptions = Array.prototype.slice.call(arguments);

    // By default, watch the platform-specific config store we have computed.
    if (typeof arguments[0] === 'undefined') {
        watchOptions[0] = file;
    }

    return watcher.unwatch(watchOptions);
}


function osProxy() {
    return set.apply(osProxy, arguments);
}

// Make osProxy behave like an instantiated EventEmitter singleton.

// Add the properties that would be inherited.
/*jshint -W089 */
for (key in EventEmitter.prototype) {
    osProxy[key] = EventEmitter.prototype[key];
}
/*jshint +W089 */

// Add the per-instance properties.
EventEmitter.call(osProxy);

// Attach public methods.

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
