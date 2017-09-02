# os-proxy [![Build status for os-proxy](https://img.shields.io/circleci/project/sholladay/os-proxy/master.svg "Build Status")](https://circleci.com/gh/sholladay/os-proxy "Builds")

> Manage system-wide proxy settings

## Why?

 - Cross-platform behavior.
 - Uses native APIs for managing config.
 - Can monitor external changes via events.

## Install

```sh
npm install os-proxy --save
```

## Usage

Get it into your program.

```js
const osProxy = require('os-proxy');
```

Set the system proxy.

**Tip**: This is a [`url.format()`](https://nodejs.org/api/url.html#url_url_format_urlobj "API documentation for the url.format method.") compatible object.

```js
osProxy.set({
    // Proxy configuration.
    hostname : 'example.com'.
    port     : 1234
})
.then(() => {
    console.log('Proxy onfiguration has finished saving.');
});
```

At any time, you may retrieve the current proxy configuration.

```js
osProxy.get({
    device : 'Wi-Fi'
})
.then((config) => {
    console.log('Proxy config:', config);
})
```

Because proxies can also be set through system menus, `osProxy` has been made aware of the platform-specific configuration store and knows how to monitor its changes at the file system level. All of that is abstracted away into opt-in [signals](https://github.com/millermedeiros/js-signals/wiki/Comparison-between-different-Observer-Pattern-implementations "Documentation for signals.").

```js
// Register a listener for config store changes.
osProxy.changed.always((event) => {
    console.log(
        'Someone changed the proxy settings at:', event.path,
        'That is where', process.platform, 'keeps them.'
    );
});
// Begin monitoring the config store.
osProxy.watch();
```

It is just as easy to stop monitoring the config store.

```js
osProxy.unwatch();
```

## API

### get(option)

Returns a promise for the current system configuration.

#### option

Type: `object`

##### device

Type: `string`<br>
Default: `Wi-Fi`

The device whose proxy configuration should be returned.

### set(option)

Returns a promise for modifying the system configuration.

#### option

Type: `object`

##### hostname

Type: `string`

The hostname of the proxy to use.

##### port

Type: `number`

The port number of the proxy to use.

##### device

Type: `string`<br>
Default: `Wi-Fi`

The device that should use the proxy.

##### enabled

Type: `boolean`<br>
Default: `true`

Whether the proxy should be enabled or disabled after the configuration is saved.

### enable()

Returns a promise for turning on proxy mode.

### disable()

Returns a promise for turning off proxy mode.

### toggle()

Returns a promise for reversing the on/off state of proxy mode.

### clear()

Returns a promise for erasing the configuration data and disabling proxy mode.

### changed

Type: [`Signal`](https://github.com/sholladay/adverb-signals)

An event emitter with methods like `.always()` and `.never()` for adding and removing listeners that are called when changes to the system configuration are detected, either via this library or by other means. You must call `watch()` in order to begin receiving events.

### watch(path, option)

Start monitoring for changes to the system configuration. Events will be emitted as a `changed` signal.

Similar to [`chokidar.watch()`](https://github.com/paulmillr/chokidar#api), except `path` defaults to the operating system's proxy configuration file.

### unwatch(path)

Stop monitoring for changes to the system configuration. Events will no longer be emitted.

Similar to [`chokidar.unwatch()`](https://github.com/paulmillr/chokidar#api), except `path` defaults to the operating system's proxy configuration file.

## CLI

See [os-proxy-cli](https://github.com/sholladay/os-proxy-cli) to use this on the command line.

## Contributing

See our [contributing guidelines](https://github.com/sholladay/os-proxy/blob/master/CONTRIBUTING.md "Guidelines for participating in this project") for more details.

1. [Fork it](https://github.com/sholladay/os-proxy/fork).
2. Make a feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. [Submit a pull request](https://github.com/sholladay/os-proxy/compare "Submit code to this project for review.").

## License

[MPL-2.0](https://github.com/sholladay/os-proxy/blob/master/LICENSE "License for os-proxy") © [Seth Holladay](http://seth-holladay.com "Author of os-proxy")

Go make something, dang it.
