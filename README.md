# os-proxy

Manage system-wide proxy settings at the OS level.

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
osProxy(
    'http://proxy.foo.com:8000'  // location of the proxy to use
)
````

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
