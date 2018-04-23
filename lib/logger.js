'use strict';

const Logger = new (require('uuid-logger'))();
const LibUtils = require('./utils').getInstance();

Logger.addTransport({
    console: {
        name: 'Console Logger' + '-' + LibUtils.generateUuid(),
        level: 'debug',
        colorize: true
    }
});

module.exports = Logger.getLogger();
