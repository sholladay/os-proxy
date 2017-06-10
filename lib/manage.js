'use strict';

const exec = require('./exec');

// CLI that manages network devices / services.
const cli = {
    // OS X.
    darwin : 'networksetup',
    // Windows (32-bit or 64-bit)
    win32  : 'reg'
    // NOTE: We could also detect: freebsd, linux, sunos
}[process.platform];

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
        disable : [
            'add',
            '"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"',
            '/v ProxyEnable',
            '/t REG_DWORD',
            '/d 0',
            '/f'
        ].join(' ')
    }
}[process.platform];

const manage = (...args) => {
    return exec(cli, args);
};

manage.get = manage.bind(null, cliArg.get);
manage.set = manage.bind(null, cliArg.set);
manage.enable = manage.bind(null, cliArg.enable);
manage.disable = manage.bind(null, cliArg.disable);

module.exports = manage;
