'use strict';

// 3rd Party
const Q = require('q');
const _ = require('lodash');
const EsKeyValue = require('es-key-value');

// Internal
const LibUtils = require('./lib/utils').getInstance();
const ResponseCodes = require('./helpers/responseCode');

const AvailableProtocols = ['COUNT'];
const protocolToProtocolRequirementMap = {
    COUNT: ['protocolMax']
};

let logger;

class ElasticClient {
    constructor(client, options) {
        if (!client) {
            throw LibUtils.genError(
                'Client not provided for connecting es',
                ResponseCodes.PRECONDITION_FAILED.status,
                ResponseCodes.PRECONDITION_FAILED.code
            );
        }

        logger = _.get(options, 'logger') || require('./lib/logger');
        let self = this;
        self.esClient = client;
        self.esKeyValueClient = new EsKeyValue(client, {
            logger: logger
        });
        logger.debug('Client assigned for protocols and strategies');
    }

    init() {
        let self = this;
        let deferred = Q.defer();

        new Q()
            .then(function() {
                logger.debug('Pinging client');
                return pingClient(self);
            })
            .then(function() {
                logger.debug('Initiating Key Value client');
                return self.esKeyValueClient.init();
            })
            .then(function() {
                return deferred.resolve();
            })
            .fail(function(error) {
                logger.error(error);
                return deferred.reject(error);
            });
        return deferred.promise;
    }

    setProtocol(options) {
        let self = this;
        if (!self.isInitiated) {
            return Q.reject('First please initate the client');
        }

        if (!options.name || !options.protocol || !options.protocolField) {
            logger.error(
                'Can not initialize ES Client, Parameters missing (name, protocol, protocolField)'
            );
            throw LibUtils.genError(
                'Can not initialize ES Client, Parameters missing (name, protocol, protocolField)',
                ResponseCodes.PRECONDITION_FAILED.status,
                ResponseCodes.PRECONDITION_FAILED.code
            );
        }

        options.protocol = options.protocol.toString().toUpperCase();
        if (AvailableProtocols.indexOf(options.protocol) < 0) {
            logger.error('Can not initialize ES Client, Protocol is not supported');
            throw LibUtils.genError(
                'Can not initialize ES Client, Protocol is not supported',
                ResponseCodes.UNABLE_TO_PROCESS.status,
                ResponseCodes.UNABLE_TO_PROCESS.code
            );
        }

        self.serviceInfo = {
            name: options.name,
            protocol: options.protocol,
            protocolField: options.protocolField
        };

        let genError = false;
        let protocolRequirements = protocolToProtocolRequirementMap[options.protocol];
        protocolRequirements.forEach(function(requirement) {
            if (options[requirement] === undefined) {
                genError = true;
                return;
            }
            self.serviceInfo[requirement] = options[requirement];
        });

        if (genError) {
            logger.error('Can not initialize ES Client, Protocol requirements are not fulfilled');
            throw LibUtils.genError(
                'Can not initialize ES Client, Protocol requirements are not fulfilled',
                ResponseCodes.PRECONDITION_FAILED.status,
                ResponseCodes.PRECONDITION_FAILED.code
            );
        }

        self.isProtocolSet = true;
        self.indexTypeFields = {};
        logger.warn('Protocol is set for given client');
        return Q.resolve();
    }

    list(options) {
        let self = this;
        if (!self.isProtocolSet) {
            return Q.reject('First please set protocol before using client');
        }

        let deferred = Q.defer();
        try {
            logger.debug('Listing for options: ', JSON.stringify(options));
            self.esClient.search(options).then(function(response) {
                let result = {};
                if (response.hits.total > 0 && !_.isEmpty(response.hits.hits)) {
                    result.hasNext = (opts.body.size === response.hits.hits.length);
                    result.transactions = _.map(response.hits.hits, function(doc) {
                        return doc._source;
                    });
                }
                return deferred.resolve(result);
            }, function(error) {
                logger.error(error);
                return deferred.reject(error);
            });
        } catch (error) {
            logger.error(error);
            return deferred.reject(error);
        }
        return deferred.promise;
    }

    setFieldsForIndexNType(index, type, fields) {
        let self = this;
        if (!index || !type || !fields || !fields.length) {
            return Q.reject('Index, Type, Fields not provided for setting fields');
        }

        if (!self.indexTypeFields[index]) {
            self.indexTypeFields[index] = {};
        }

        if (!self.indexTypeFields[index][type]) {
            self.indexTypeFields[index][type] = fields;
        }

        return Q.resolve();
    }

    insert(options) {
        let self = this;
        if (!self.isProtocolSet) {
            return Q.reject('First please set protocol before using client');
        }

        let deferred = Q.defer();
        let error;

        let index = options.index;
        let type = options.type;
        let body = options.body;
        let sequenceId;
        let serviceInfo = self.serviceInfo;

        // ex: customerId
        let protocolFieldValue = options[serviceInfo.protocolField];

        if (!body || !index || !type || !protocolFieldValue) {
            error = LibUtils.genError(
                'Invalid insert parameters',
                ResponseCodes.UNABLE_TO_PROCESS.status,
                ResponseCodes.UNABLE_TO_PROCESS.code
            );
            logger.error(error, JSON.stringify(options));
            return Q.reject(error);
        }

        // Start transaction For Redis
        let sequenceName = serviceInfo.name.toLowerCase() +
            '_' + serviceInfo.protocol.toLowerCase() +
            '_' + serviceInfo.protocolField.toLowerCase() +
            '_' + protocolFieldValue.toString();

        // TODO : Locking sequence
        new Q(undefined)
            .then(function() {
                return self.esKeyValueClient.get(sequenceName);
            })
            .then(function(response) {
                sequenceId = Number(response);
                sequenceId = generateSequenceId(serviceInfo, sequenceId);
                logger.debug('Setting sequence value as', sequenceId);
                return self.esKeyValueClient.set(sequenceName, sequenceId);
            })
            .then(function() {
                logger.debug('Converting to ES object compatible to client app');
                return convertToESCreateObject({
                    self,
                    index,
                    type,
                    body
                });
            })
            .then(function(esObject) {
                let body = JSON.stringify({doc: esObject, doc_as_upsert: true});
                let id = sequenceId;
                logger.debug('Updating ES (index, type, id, body)', index, type, id, body);
                return self.update({
                    index,

                    type,
                    id,
                    body
                });
            })
            .then(function() {
                return deferred.resolve();
            })
            .fail(function(error) {
                logger.error(error);
                return deferred.reject(error);
            });

        return deferred.promise;
    }

    update(options) {
        let self = this;
        let deferred = Q.defer();
        if (!self.isProtocolSet) {
            return Q.reject('First please set protocol before using client');
        }

        let error;

        let index = options.index;
        let type = options.type;
        let id = options.id;
        let body = options.body;

        if (!body || !index || !type || !id) {
            logger.error('Invalid update parameters', JSON.stringify(options));
            error = LibUtils.genError(
                'Invalid update parameters',
                ResponseCodes.UNABLE_TO_PROCESS.status,
                ResponseCodes.UNABLE_TO_PROCESS.code
            );
            return Q.reject(error);
        }

        logger.debug(JSON.stringify(options));
        self.esClient.update({
            index: index,
            type: type,
            id: id,
            body: body
        }, function(error, response) {
            if (error) {
                logger.error(error);
                return deferred.reject(error);
            }

            logger.debug('Update success for ID:', response._id);
            return deferred.resolve(response._id);
        });

        return deferred.promise;
    }

    delete(options) {
        let self = this;
        let deferred = Q.defer();
        if (!self.isProtocolSet) {
            return Q.reject('First please set protocol before using client');
        }

        let error;

        let index = options.index;
        let type = options.type;
        let id = options.id;

        if (!index || !type || !id) {
            logger.error('Invalid delete parameters', JSON.stringify(options));
            error = LibUtils.genError(
                'Invalid delete parameters',
                ResponseCodes.UNABLE_TO_PROCESS.status,
                ResponseCodes.UNABLE_TO_PROCESS.code
            );
            return Q.reject(error);
        }

        self.esClient.delete({
            index,
            type,
            id
        }, function(error, response) {
            if (error) {
                logger.error(error);
                logger.debug('Setting success for ID:', response._id);
                return deferred.resolve(id);
            }

            logger.debug('Delete success for ID:', response._id);
            return deferred.resolve(id);
        });

        return deferred.promise;
    }
}

function pingClient(self) {
    let deferred = Q.defer();
    // Try to ping client
    self.esClient.ping({
        requestTimeout: 30000
    }, function(error) {
        if (error) {
            logger.error(error);
            return deferred.reject(error);
        }
        logger.warn('ES connection established');
        self.isInitiated = true;
        return deferred.resolve();
    });
    return deferred.promise;
}

function generateSequenceId(serviceInfo, sequenceId) {
    if (serviceInfo.protocol.toUpperCase() === 'COUNT') {
        return generateCountProtocolSequenceId(serviceInfo, sequenceId);
    }
    return undefined;
}

function generateCountProtocolSequenceId(serviceInfo, sequenceId) {
    if (!sequenceId) {
        sequenceId = 1;
    } else if (sequenceId < Number(serviceInfo.protocolMax)) {
        sequenceId = sequenceId + 1;
    } else if (sequenceId = Number(serviceInfo.protocolMax)) {
        sequenceId = 1;
    } else {
        sequenceId = (sequenceId % Number(serviceInfo.protocolMax));
    }
    return sequenceId;
}

function convertToESCreateObject(options) {
    let self = options.self;
    let index = options.index;
    let type = options.type;
    let body = options.body;

    if (!index || !type || !body) {
        return Q.reject('Index, Type, Body not provided for creating ES object');
    }

    if (!self.indexTypeFields[index] || !self.indexTypeFields[index][type]) {
        return Q.reject('Index, Type not registered for creating ES object');
    }

    let fields = self.indexTypeFields[index][type];

    let esObject = {};
    fields.forEach(function(key) {
        esObject[key] = body[key] || '';
    });

    return Q.resolve(esObject);
}

module.exports = ElasticClient;


(function(options) {
    if (require.main === module) {
        const Elasticsearch = require('elasticsearch');
        let client = new Elasticsearch.Client({
            host: {
                host: '127.0.0.1',
                port: 9200
            }
            // log: 'trace'
        });

        let elasticClient = new ElasticClient(client);
        let index = 'keyvalueindex';
        let type = 'keyvaluetype';
        let columns = ['a', 'b', 'c'];
        const sleep = require('sleep');

        new Q(undefined)
            .then(function(result) {
                return elasticClient.init();
            })
            .then(function() {
                return elasticClient.setProtocol({
                    name: 'serviceName',
                    protocol: 'COUNT',
                    protocolField: 'customerId',
                    protocolMax: 10
                });
            })
            .then(function() {
                return elasticClient.setFieldsForIndexNType(index, type, columns);
            })
            .then(function() {
                return elasticClient.insert({
                    index: index,
                    type: type,
                    customerId: 1,
                    body: {
                        c: 1,
                        b: 1
                    }
                });
            })
            .then(function() {
                sleep.sleep(1);
                return Q.resolve();
            })
            .then(function() {
                return elasticClient.insert({
                    index: index,
                    type: type,
                    customerId: 1,
                    body: {
                        c: 1,
                        b: 2
                    }
                });
            })
            .then(function() {
                return Q.resolve();
            })
            .fail(function(error) {
                logger.error(error);
            });
    }
})();
