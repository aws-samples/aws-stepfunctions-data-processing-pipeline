// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const glue = new AWS.Glue();

exports.handler = async event => {
    response = await glue.getCrawler({Name: event.crawlerName}).promise();
    const state = response.Crawler.State;
    return state == "READY";
}
