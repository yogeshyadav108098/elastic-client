# elastic-client
Elastic client that works on different protocol and strategies

## Install

```
npm install --save elastic-client
```

## Usage


```js

const Q = require('q');
const ElasticClient = require('elastic-client');
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
    logger: 'customLogger'
});

new Q(undefined)
    .then(function(result) {
        return elasticClient.init();
    })
    .then(function() {
        return elasticClient.setProtocol({
            name: 'temp',
            protocol: 'COUNT',
            protocolField: 'customerId',
            protocolMax: 2
        });
    })
    .then(function() {
        return elasticClient.insert({
            index: 'test',
            type: 'test2',
            customerId: 1,
            body: {
                c: 1,
                b: 1
            }
        });
    })
    .then(function() {
        return elasticClient.insert({
            index: 'test',
            type: 'test2',
            customerId: 1,
            body: {
                c: 1,
                b: 2
            }
        });
    })
    .fail(function(error) {
        console.log(error);
    });
```