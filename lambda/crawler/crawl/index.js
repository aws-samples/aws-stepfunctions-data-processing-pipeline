// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const glue = new AWS.Glue();

exports.handler = async event => {
    var response = await glue.listCrawlers({Tags: { Name: event.crawlerTagName}}).promise();
    const crawlerName = response.CrawlerNames[0];
    console.log(`Obtained crawler: ${crawlerName}`);

    response = await glue.getCrawler({Name: crawlerName}).promise();
    const state = response.Crawler.State;
    if (state != "READY") {
        throw new Error(`Crawler state [${state}] is not READY.`);
    }

    await glue.startCrawler({Name: crawlerName}).promise();
    console.log(`Started crawler: ${crawlerName}`);
    return crawlerName;
}
