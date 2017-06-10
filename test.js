import test from 'ava';
import osProxy from '.';

test('get()', async (t) => {
    const proxy = await osProxy.get();
    t.is(typeof proxy, 'object');
    t.is(typeof proxy.hostname, 'string');
    t.is(typeof proxy.port, 'number');
    t.is(typeof proxy.enabled, 'boolean');
    t.deepEqual(Object.keys(proxy), ['hostname', 'port', 'enabled']);
});

// Setting requires a password, which makes the tests fail in CI.

// test('set()', async (t) => {
//     const previous = await osProxy.get();

//     await osProxy.set({
//         hostname : 'example.com',
//         port     : 1234
//     });

//     t.deepEqual(await osProxy.get(), {
//         hostname : 'example.com',
//         port     : 1234,
//         enabled  : true
//     });

//     await osProxy.set(previous);
// });

// test('enable()', async (t) => {

// });

// test('disable()', async (t) => {

// });

// test('toggle()', async (t) => {

// });

// test('clear()', async (t) => {

// });

// test('changed', async (t) => {

// });

// test('watch()', async (t) => {

// });

// test('unwatch()', async (t) => {

// });
