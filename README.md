# os-proxy

Manage system-wide proxy settings at the OS level.

 - Clean, asynchronous API with events and promises.
 - Uses native tools for managing config.
 - Can monitor changes from the outside.

**Documentation**: [sholladay.github.io/os-proxy](https://sholladay.github.io/os-proxy "Project documentation for os-proxy and its API.")

**Version**: `0.1.0`

## Installation
````sh
npm install os-proxy --save
````

## Usage

Get it into your program.
````javascript
var osProxy = require('os-proxy');
````

Set the system proxy.
````javascript
// This is a shortcut to osProxy.set(...);
osProxy(
    {  // proxy configuration
        hostname : 'example.com'.
        port     : 1234
    }
);
````

**Tip**: This is a [`url.format()`](https://nodejs.org/api/url.html#url_url_format_urlobj "API documentation for the url.format method.") compatible object.

The main `osProxy` methods use [Promises/A+](https://promisesaplus.com/ "Specification for the Promises/A+ standard.") for clean, asynchronous behavior.
````javascript
osProxy(
    {host: 'example.com:1234'}
)
.then(
    function () {
        console.log('Proxy onfiguration has finished saving.');
    }
);
````

Because proxies can also be set through system menus, `osProxy` has been made aware of the platform-specific configuration store and knows how to monitor its changes at the file system level. All of that is abstracted away into opt-in [events](https://nodejs.org/api/events.html "Documentation for EventEmitter.").

````javascript
osProxy.watch();  // begin monitoring the config store
osProxy.on(
    'change',
    function (path) {
        console.log(
            'Someone changed the proxy settings at:', path,
            'That is where', process.platform, 'keeps them.'
        );
    }
)
````

It's just as easy to stop monitoring the config store.
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
See our [contribution guidelines](https://github.com/sholladay/os-proxy/blob/master/CONTRIBUTING.md "The guidelines for being involved in this project.") for mode details.

1. [Fork it](https://github.com/sholladay/os-proxy/fork).
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. [Submit a pull request](https://github.com/sholladay/os-proxy/compare "Submit code to this repo now for review.").

## License
[MPL-2.0](https://github.com/sholladay/os-proxy/blob/master/LICENSE "The license for os-proxy.")

Go make something, dang it.
