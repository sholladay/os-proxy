var fallback = {
    hostname : 'localhost',
    port     : 8080
};
fallback.host = fallback.hostname + ':' + fallback.port;

function sanitizePort(port) {

    // This function is designed to turn user input into a port number,
    // by respecting integers and falling back to a default if it looks
    // like they wanted one (truthy). Otherwise, an empty string.

    var portType = typeof port, portInt, result;

    portInt = parseInt(port, 10);
    if (portInt || portInt === 0) {
        result = portInt;
    }
    else if (port || portType === 'undefined') {
        result = fallback.port;
    }
    else {
        result = '';
    }

    return result;
}

function sanitizeHostname(hostname) {

    // This function is designed to turn user input into a hostname,
    // by respecting strings and falling back to a default if it looks
    // like they wanted one (truthy). Otherwise, an empty string.

    var hostnameType = typeof hostname, result;

    if (hostname && hostnameType === 'string') {
        result = hostname;
    }
    else if (hostname || hostnameType === 'undefined') {
        result = fallback.hostname;
    }
    else {
        result = '';
    }

    return result;
}

function sanitizeHost(host) {

    // This function is designed to turn user input into a host, by
    // respecting strings and falling back to a default if it looks
    // like they wanted one (truthy). Otherwise, an empty string.

    var hostType = typeof host, result;

    if (host && hostType === 'string') {
        result = host;
    }
    else if (host || hostType === 'undefined') {
        result = fallback.host;
    }
    else {
        result = '';
    }

    return result;
}

function makeHost(hostname, port) {

    // This function is designed to construct a useful host.
    // Example: should be blank if we only know the port.

    var result = '';

    if (hostname) {
        result = hostname;
        // Don't allow NaN through.
        if (port || port === 0) {
            result = result + ':' + port;
        }
    }

    return result;
}

function sanitize(options, port, enabled) {

    // This function is designed to clean user-provided proxy configuration.
    // They may give an explicit options object or separate arguments for
    // hostname, port, and enabled status.

    var optionsType = typeof options,
        // Whether or not we should treat options as a hostname.
        simple      = optionsType !== 'function' && !(options && optionsType === 'object'),
        hostname,
        host,
        hostParts,
        portInt,
        portIndex = 1,  // default argument position to assume as port number
        i,
        result;

    // If explicit options are not provided, we treat the first argument as a hostname.
    if (simple) {
        // The user may have provided the port as either first or second argument.
        for (i = 0; i <= portIndex; i = i + 1) {
            portInt = typeof arguments[i] === 'number' ? arguments[i] : parseInt(arguments[i], 10);
            // Skip if it comes back as NaN.
            if (portInt || portInt === 0) {
                portIndex = i;
                break;
            }
        }
        hostname = sanitizeHostname(arguments[portIndex - 1]);
        port     = sanitizePort(arguments[portIndex]);
        enabled  = arguments[portIndex + 1] ? true : false;
        host     = hostname;
        if (host && (port || port === 0)) {
            host = host + ':' + port;
        }
        return {
            hostname : hostname,
            port     : port,
            host     : host,
            enabled  : enabled
        };
    }

    result = Object.create(options);

    if (options.host) {
        host = sanitizeHost(options.host);
        if (host.indexOf(':') > 0) {
            hostParts = host.split(':');
            hostname  = hostParts[0];
            port      = hostParts[1];
        }
        else {
            hostname = host;
            port     = '';
        }
    }
    else {
        hostname = sanitizeHostname(options.hostname);
        port     = sanitizePort(options.port);
    }
    host    = makeHost(hostname, port);
    enabled = options.enabled ? true : false;

    result.hostname = hostname;
    result.port     = port;
    result.host     = host;
    result.enabled  = enabled;

    return result;
}

module.exports = sanitize;
