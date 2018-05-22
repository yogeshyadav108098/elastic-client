# elastic-client
Elastic client that works on different protocol and strategies

## Install

```
npm install --save elastic-client-advanced
```

## Usage


```js

const Q = require('q');
const ElasticClient = require('elastic-client-advanced');
const Elasticsearch = require('elasticsearch');
let client = new Elasticsearch.Client({
    host: {
        host: '127.0.0.1',
        port: 9200
    }
    // log: 'trace'
});

// 2nd Param is optional but its better if you provide
let elasticClient = new ElasticClient(client, {
    logger: console.log
});

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
```