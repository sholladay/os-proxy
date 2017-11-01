// Modify your operating system's proxy settings.

'use strict';

const Signal = require('adverb-signals');
const yaml = require('yamljs');
const chokidar = require('chokidar');
const joi = require('joi');
const isOn = require('./lib/is-on');
const manage = require('./lib/manage');

const { platform } = process;

// Inspiration for Windows support:
// http://www.ehow.com/how_6887864_do-proxy-settings-command-prompt_.html
// https://github.com/helloyou2012/system-proxy
if (platform !== 'darwin') {
    throw new Error(`Support for ${platform} is not ready yet. Pull requests welcome!`);
}

// In these examples, "Wi-Fi" could be other devices like "Built-In Ethernet".

// Determine whether a device is on.
// networksetup -getnetworkserviceenabled Wi-Fi

// Get a newline seperated list of devices.
// networksetup -listallnetworkservices

// Get the user's preferred network device
const getDevice = async () => {
    const output = await manage.device();
    return output.match(/: .+/)[0].substring(': '.length);
};

// Turn on the currently configured proxy.
const enable = async () => {
    return manage.enable(await getDevice(), 'on');
};

// Turn off the currently configured proxy, but keep it in the
// operating system's database.
const disable = async () => {
    return manage.disable(await getDevice(), 'off');
};

// Retrieve the currently configured proxy.
const get = async (input) => {
    const option = Object.assign({}, input);
    option.device = option.device || await getDevice();
    const config = joi.attempt(option, joi.object({
        device   : joi.string().required()
    }).required());

    const output = await manage.get(config.device);

    if (!output) {
        throw new TypeError(`Unable to get proxy configuration. No output to parse.`);
    }

    const parsed = yaml.parse(output);

    // OS X answers with less than ideal property names.
    // We normalize them here before anyone sees it.
    return {
        hostname : parsed.Server,
        port     : parsed.Port,
        enabled  : isOn(parsed.Enabled)
    };
};

// Set and optionally turn on a new proxy configuration.
const set = async (input) => {
    const option = Object.assign({}, input);
    option.device = option.device || await getDevice();
    const config = joi.attempt(option, joi.object({
        device   : joi.string().required(),
        hostname : joi.string().required().hostname(),
        port     : joi.number().required().positive().integer().min(0).max(65535),
        enabled  : joi.boolean().optional().default(true)
    }).required());

    await manage.set(config.device, config.hostname, config.port);

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
// from the operating system's database.
const clear = () => {
    return set({
        hostname : '',
        port     : '',
        enabled  : false
    });
};

// File system watching helpers.

// Database for proxy configuration. These may get modified by any program at any time,
// and so need to be watched to stay fully up to date.
const configPath = {
    darwin : '/Library/Preferences/SystemConfiguration/preferences.plist',
    win32  : ''
}[platform];

const changed = new Signal();

// File system watcher that is aware of changes to the system proxy settings
// caused by any application.
let watcher;

// Activate a file system watcher, which will be notified about changes to the
// OS preferences, regardless of who makes the change.
const watch = (fp, ...rest) => {
    const filePath = typeof fp === 'undefined' ? configPath : fp;

    // If we are already watching, just add to the current set.
    if (watcher) {
        watcher.add(filePath, ...rest);
    }
    else {
        watcher = chokidar
            .watch(filePath, ...rest)
            .on('change', (pathStr) => {
                changed.emit({ path : pathStr });
            });
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
    get,
    set,
    enable,
    disable,
    toggle,
    clear,
    changed,
    watch,
    unwatch
};
