// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const path = require('path');
const core = require('@aws-cdk/core');
const asset = require('@aws-cdk/aws-s3-assets');
const glue = require('@aws-cdk/aws-glue');

class GlueLabStack extends core.Stack {
    transformJob;
    aggregateJob;

    constructor(scope, landingZone, dataZone) {
        super(scope, "NF1-Glue-Lab");

        this.createCrawler(dataZone.glueRole, dataZone.bucket);
        this.transformJob = this.createJobTransform(dataZone.glueRole, dataZone.bucket);
        this.aggregateJob = this.createJobAggregate(dataZone.glueRole, dataZone.bucket);
    }

    createDatabase() {
        const database = new glue.Database(this, "AirflowLabDatabase", {
            databaseName: "airflow-lab"
        });
        database.applyRemovalPolicy(core.RemovalPolicy.DELETE);
        return database;
    }

    createCrawler(role, bucket) {
        const database = this.createDatabase();
        return new glue.CfnCrawler(this, "NF1-Airflow-Lab-RawGreenCrawler", {
            databaseName: database.databaseName,
            role: role.roleArn,
            targets: {
                s3Targets: [{ path: bucket.s3UrlForObject("airflow/lab/data/raw/green")}]
            },
            tags: {Name: "NF1-Airflow-Lab-RawGreenCrawler"}
        });
    }

    createJobTransform(role, bucket) {
        const scriptAsset = new asset.Asset(this, "NycRawToTransformAsset", {
            path: path.join(__dirname, "../../scripts/airflow/lab/nyc_raw_to_transform.py")
        });
        return new glue.CfnJob(this, "NF1-Airflow-Lab-NycRawToTransformJob", {
            role: role.roleArn,
            glueVersion: "2.0",
            workerType: "G.1X",
            numberOfWorkers: 2,
            timeout: 10, // in minutes
            maxRetries: 1,
            executionProperty: { maxConcurrentRuns: 1 },
            notificationProperty: { notifyDelayAfter: 10 },
            command: {
                name: "glueetl",
                scriptLocation: scriptAsset.s3ObjectUrl
            },
            defaultArguments: {
                "--enable-metrics": true,
                "--enable-spark-ui": true,
                "--enable-glue-datacatalog": true,
                "--spark-event-logs-path": bucket.s3UrlForObject("airflow/lab/logs/spark/"),
                "--TempDir": bucket.s3UrlForObject("airflow/lab/temp/")
            },
            tags: {Name: "NF1-Airflow-Lab-NycRawToTransformJob"}
        });
    }

    createJobAggregate(role, bucket) {
        const scriptAsset = new asset.Asset(this, "NycAggregationsAsset", {
            path: path.join(__dirname, "../../scripts/airflow/lab/nyc_aggregations.py")
        });
        return new glue.CfnJob(this, "NF1-Airflow-Lab-NycAggregationsJob", {
            role: role.roleArn,
            glueVersion: "2.0",
            workerType: "G.1X",
            numberOfWorkers: 2,
            timeout: 10, // in minutes
            maxRetries: 1,
            executionProperty: { maxConcurrentRuns: 1 },
            notificationProperty: { notifyDelayAfter: 10 },
            command: {
                name: "glueetl",
                scriptLocation: scriptAsset.s3ObjectUrl
            },
            defaultArguments: {
                "--enable-metrics": true,
                "--enable-spark-ui": true,
                "--enable-glue-datacatalog": true,
                "--spark-event-logs-path": bucket.s3UrlForObject("airflow/lab/logs/spark/"),
                "--TempDir": bucket.s3UrlForObject("airflow/lab/temp/")
            },
            tags: {Name: "NF1-Airflow-Lab-NycAggregationsJob"}
        });
    }
}

module.exports = { GlueLabStack }
