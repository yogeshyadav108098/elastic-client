# Elastic Client Advanced
> Node library to save data on ES based on some protocols.

<img src="assets/elasticClient.png"
    alt="Elastic Client Advanced"
    width="200"
    align="right"
    style="max-width: 50%"/>

This library works on some protocols to save data in ES. Currently supporting only 2 protocols. Will be adding many more in future

## Protocols Supported ##
> 1. COUNT: Want to limit enteries in ES on basis of some key count
> 2. DEFAULT: Behaves same as normal ES Client


<table>
    <thead>
        <tr>
            <th>Linux</th>
            <th>OS X</th>
            <th>Windows</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td colspan="3" align="center">Passed</td>
        </tr>
    </tbody>
</table>

## Have a problem? Come chat with us! ##

[LinkedIn](https://www.linkedin.com/in/yogeshyadav108098)<br />
[Twitter](https://twitter.com/Yogeshyadav098)<br />
[Github](https://github.com/yogeshyadav108098)<br />
[Gmail](<mailto:yogeshyadav108098@gmail.com>)

## Maintained by ##
[Yogesh Yadav](https://www.linkedin.com/in/yogeshyadav108098/)

## Getting started. ##

Elastic Client Advanced will work on all systems.

```bash
npm install --save elastic-client-advanced
```

## Usage


1. Create a ES client and provide to lib, intentionally not taking es config as its redundant to have more than one client

```javascript
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
```

2. Create a object of advanced ES Client

```javascript
// 2nd Param is optional but its better if you provide
let elasticClient = new ElasticClient(client, {
    logger: console.log
});
```

3. Doing following steps<br />
    a. Init the client<br />
    b. Set protocol, here setting count protocol for column customerId<br />
    c. Set Fields for given type, other fields will be ingored<br />
    d. Insert in ES

```javascript
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