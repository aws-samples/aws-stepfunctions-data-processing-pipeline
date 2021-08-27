// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const data = new AWS.RedshiftData();

exports.handler = async event => {
    console.log(`Execute SQL [${event.Sql}] on database [${event.Database}] in cluster [${event.ClusterIdentifier}]`);
    await data.executeStatement({
        ClusterIdentifier: event.ClusterIdentifier,
        Database: event.Database,
        SecretArn: event.SecretArn,
        Sql: event.Sql
    }).promise();
}
