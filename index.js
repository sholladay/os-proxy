// API to modify your operating system's proxy settings.

// Similar to: https://github.com/helloyou2012/system-proxy

'use strict';

const Signal = require('adverb-signals');
const YAML = require('yamljs');
const chokidar = require('chokidar');
const { assert } = require('chai');
const dangit = require('dangit');
const event = require('./lib/event');
const isOn = require('./lib/is-on');
const exec = require('./lib/exec');

const { space, quote } = dangit;
const { platform } = process;
// The network interface to use as the context for configuration.
const device = 'Wi-Fi';

// NOTE: No Windows support yet. Pull requests welcome!

// Inspiration fo Windows support:
// http://www.ehow.com/how_6887864_do-proxy-settings-command-prompt_.html
if (platform !== 'darwin') {
    throw new Error(
        `Support for ${platform} is not ready yet. Pull requests welcome!`
    );
}

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

// Database for proxy configuration. These may get modified by any program at any time,
// and so need to be watched to stay fully up to date.
const configPath = {
    darwin : '/Library/Preferences/SystemConfiguration/preferences.plist',
    win32  : ''
}[platform];

const cliArg = {
    darwin : {
        get     : '-getwebproxy',
        set     : '-setwebproxy',
        enable  : '-setwebproxystate',
        disable : '-setwebproxystate'
    },
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

// Turn on the currently configured proxy.
const enable = () => {
    return exec(
        cliArg.enable,
        device,
        'on'
    );
};

// Turn off the currently configured proxy, but keep it in the
// operating system's data store.
const disable = () => {
    return exec(
        cliArg.disable,
        device,
        'off'
    );
};

// Retrieve the currently configured proxy.
const get = async (option) => {
    const config = Object.assign({}, option);

    if (!config.device || typeof config.device !== 'string') {
        config.device = device;
    }

    const output = await exec(
        cliArg.get,
        config.device
    );

    if (!output) {
        throw new TypeError(`Unable to get proxy configuration. No output to parse.`);
    }

    const parsed = YAML.parse(output);

    // OS X answers with less than ideal property names.
    // We normalize them here before anyone sees it.
    return {
        hostname : parsed.Server,
        port     : parsed.Port,
        enabled  : isOn(parsed.Enabled)
    };
};

// Set and optionally turn on a new proxy configuration.
// Example config:
// {
//     protocol : 'https',
//     hostname : 'localhost',
//     port     : 8000,
//     enabled  : true
// }
const set = async (option) => {
    const config = Object.assign(
        {
            enabled : true,
            device
        },
        option
    );

    assert.isDefined(
        config.hostname,
        `config.hostname must be provided.`
    );

    assert.isDefined(
        config.port,
        `config.port must be provided.`
    );

    await exec(
        cliArg.set,
        quote(config.device),
        quote(config.hostname),
        config.port
    );

    // OS X turns on the proxy by default. But users may want to
    // do this at a later time or not at all.
    if (!config.enabled && typeof config.enabled !== 'undefined') {
        return disable();
    }
};

// Toggle the currently configured proxy between on and off.
const toggle = async () => {
    const proxy = await get();
    return proxy.enabled ? disable() : enable();
};

// Turn off and wipeout the currently configured proxy
// from the operating system's data store.
const clear = () => {
    return set({
        hostname : '',
        port     : '',
        enabled  : false
    });
};

// File system watching helpers.

const changed = new Signal();

// Handler for file system changes related to proxy configuration.
const onChange = (path) => {
    changed.emit(
        new event.Change({
            path
        })
    );
};

// File system watcher that is aware of changes to the system proxy settings
// caused by any application.
let watcher;

// Activate a file system watcher, which will be notified about changes to the
// OS preferences, regardless of who makes the change.
const watch = (fp, ...rest) => {
    // By default, watch the platform-specific config store.
    const filePath = typeof fp === 'undefined' ? configPath : fp;

    // If we are already watching, just add to the current set.
    if (watcher) {
        watcher.add(filePath, ...rest);
    }
    else {
        watcher = chokidar.watch(filePath, ...rest).on(
            'change',
            onChange
        );
    }

    return watcher;
};

// Deactivate an existing file system watcher.
const unwatch = (fp, ...rest) => {
    if (watcher) {
        const filePath = typeof fp === 'undefined' ? configPath : fp;

        return watcher.unwatch(filePath, ...rest);
    }
};

module.exports = {
    changed,
    get,
    set,
    enable,
    disable,
    toggle,
    clear,
    watch,
    unwatch
};
