# os-proxy

> Manage system-wide proxy settings.

## Why?

 - Cross-platform behavior.
 - Uses native APIs for managing config.
 - Can monitor external changes via events.

## Install

````sh
npm install os-proxy --save
````

## Usage

Get it into your program.
````javascript
const osProxy = require('os-proxy');
````

Set the system proxy.

**Tip**: This is a [`url.format()`](https://nodejs.org/api/url.html#url_url_format_urlobj "API documentation for the url.format method.") compatible object.

````javascript
osProxy.set({
    // Proxy configuration.
    hostname : 'example.com'.
    port     : 1234
})
.then(() => {
    console.log('Proxy onfiguration has finished saving.');
});
````

At any time, you may retrieve the current proxy configuration.
````javascript
osProxy.get({
    device : 'Wi-Fi'
})
.then((config) => {
    console.log('Proxy config:', config);
})
````

Because proxies can also be set through system menus, `osProxy` has been made aware of the platform-specific configuration store and knows how to monitor its changes at the file system level. All of that is abstracted away into opt-in [signals](https://github.com/millermedeiros/js-signals/wiki/Comparison-between-different-Observer-Pattern-implementations "Documentation for signals.").

````javascript
// Register a listener for config store changes.
osProxy.changed.always((event) => {
    console.log(
        'Someone changed the proxy settings at:', event.path,
        'That is where', process.platform, 'keeps them.'
    );
});
// Begin monitoring the config store.
osProxy.watch();
````

It is just as easy to stop monitoring the config store.
````javascript
osProxy.unwatch();
````

## API
| Method  | Arguments             | Returns                | Description                                      |
|---------|-----------------------|------------------------|--------------------------------------------------|
| `get`     | Proxy Config (device) | Promise (Proxy Config) | Retrieve the currently set proxy.                |
| `set`     | Proxy Config          | Promise                | Update the currently set proxy.                  |
| `enable`  |                       | Promise                | Turn on the currently set proxy.                 |
| `disable` |                       | Promise                | Turn off the currently set proxy.                |
| `toggle`  |                       | Promise                | Reverse on/off state of the currently set proxy. |
| `remove`  |                       | Promise                | Erase the currently set proxy.                   |
| `watch`   | Watch Config          | Watcher (singleton)    | Start monitoring the proxy config store.         |
| `unwatch` | Path(s)               | Watcher (singleton)    | Stop monitoring the proxy config store.          |

## Contributing

See our [contributing guidelines](https://github.com/sholladay/os-proxy/blob/master/CONTRIBUTING.md "The guidelines for participating in this project.") for more details.

1. [Fork it](https://github.com/sholladay/os-proxy/fork).
2. Make a feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. [Submit a pull request](https://github.com/sholladay/os-proxy/compare "Submit code to this project for review.").

## License
[MPL-2.0](https://github.com/sholladay/os-proxy/blob/master/LICENSE "The license for os-proxy.") © [Seth Holladay](http://seth-holladay.com "Author of os-proxy.")

Go make something, dang it.
