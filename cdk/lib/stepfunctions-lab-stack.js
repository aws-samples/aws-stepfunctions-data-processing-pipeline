// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const path = require('path');
const core = require('@aws-cdk/core');
const iam = require('@aws-cdk/aws-iam');
const lambda = require('@aws-cdk/aws-lambda');
const logs = require('@aws-cdk/aws-logs');
const events = require('@aws-cdk/aws-events');
const targets = require('@aws-cdk/aws-events-targets');
const cloudtrail = require('@aws-cdk/aws-cloudtrail');
const sf = require('@aws-cdk/aws-stepfunctions');
const task = require('@aws-cdk/aws-stepfunctions-tasks');
const { RedshiftStack } = require('../lib/redshift-stack');

class StepFunctionsLabStack extends core.Stack {
    static PREFIX = "airflow/lab/data/raw";

    constructor(scope, landingZone, dataZone, redshift, glueLab) {
        super(scope, "NF1-StepFunctions-Lab");
        this.createTrail(landingZone.bucket, dataZone.bucket);
        const machine = this.createDataMachine(dataZone, redshift, glueLab);
        this.createS3Event(machine, dataZone.bucket);
    }

    createTrail(logBucket, monitorBucket) {
        const trail = new cloudtrail.Trail(this, 'CloudTrail', {
            bucket: logBucket,
            s3KeyPrefix: "data-trail",
            isMultiRegionTrail: true,
            sendToCloudWatchLogs: false,
            cloudWatchLogsRetention: logs.RetentionDays.ONE_MONTH
        });
        trail.addS3EventSelector(
            [{bucket: monitorBucket, objectPrefix: StepFunctionsLabStack.PREFIX}],
            {readWriteType: cloudtrail.ReadWriteType.WRITE_ONLY});
        return trail;
    }
    createS3Event(machine, bucket) {
        new events.Rule(this, "S3StepFunctions", {
            description: "S3 invoke StepFunctions",
            eventPattern: {
                source: [ "aws.s3" ],
                detailType: [ "AWS API Call via CloudTrail" ],
                detail: {
                    "eventSource": [ "s3.amazonaws.com" ],
                    "eventName": [ "PutObject" ],
                    "requestParameters": {
                        "bucketName": [ bucket.bucketName ],
                        "key": [{ "prefix": StepFunctionsLabStack.PREFIX }]
                    }
                }
            },
            targets: [ new targets.SfnStateMachine(machine) ]
        });
    }

    createDataMachine(dataZone, redshift, glueLab) {
        const definition = this.createCrawlerStep(
            this.createTransformJobStep(glueLab.transformJob.ref)
            .next(this.createAggregateJobStep(glueLab.aggregateJob.ref))
            .next(this.createCopyS3ToRedshift(dataZone.bucket, redshift)));
        return new sf.StateMachine(this, "DataMachine", {
            definition: definition,
            timeout: core.Duration.minutes(15)
        });
    }

    createCrawlerStep(next) {
        const role = new iam.Role(this, "CrawlRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("AWSGlueConsoleFullAccess")
            ]
        });
        const crawlTask = new task.LambdaInvoke(this, "Crawl", {
            lambdaFunction: this.lambda("CrawlLambda", role, "../../lambda/crawler/crawl"),
            payload: sf.TaskInput.fromObject({CrawlerTagName: "NF1-Airflow-Lab-RawGreenCrawler"}),
            payloadResponseOnly: true,
            resultPath: "$.crawlerName",
        });
        const checkCrawled = new task.LambdaInvoke(this, "Check if crawled", {
            lambdaFunction: this.lambda("CheckCrawledLambda", role, "../../lambda/crawler/check"),
            payloadResponseOnly: true,
            resultPath: "$.crawled",
        });
        const wait = 10;
        crawlTask
        .next(checkCrawled)
        .next(new sf.Choice(this, "Is crawled?")
            .when(sf.Condition.booleanEquals("$.crawled", true), next)
            .otherwise(new sf.Wait(this, `Wait for ${wait} Seconds`, {
                time: sf.WaitTime.duration(core.Duration.seconds(wait)),
            }).next(checkCrawled)));
        return crawlTask;
    }

    createTransformJobStep(jobName) {
        return new task.GlueStartJobRun(this, "Transform Job", {
            glueJobName: jobName,
            integrationPattern: sf.IntegrationPattern.RUN_JOB,
        });
    }

    createAggregateJobStep(jobName) {
        return new task.GlueStartJobRun(this, "Aggregate Job", {
            glueJobName: jobName,
            integrationPattern: sf.IntegrationPattern.RUN_JOB,
        });
    }

    createCopyS3ToRedshift(bucket, redshift) {
        const dir = bucket.s3UrlForObject("airflow/lab/data/aggregated");
        const sql = `copy nyc.green from '${dir}' iam_role '${redshift.role.roleArn}' format as parquet;`;

        const role = new iam.Role(this, "CopyRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonRedshiftDataFullAccess"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3ReadOnlyAccess"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("SecretsManagerReadWrite"),
            ]
        });
        return new task.LambdaInvoke(this, "Copy S3 to Redshift", {
            lambdaFunction: this.lambda("CopyToRedshiftLambda", role, "../../lambda/redshift/execute"),
            payloadResponseOnly: true,
            payload: sf.TaskInput.fromObject({
                ClusterIdentifier: redshift.cluster.clusterName,
                Database: RedshiftStack.DB_NAME,
                SecretArn: redshift.cluster.secret.secretArn,
                Sql: sql,
            })
        });
    }

    lambda(name, role, dir) {
        return new lambda.Function(this, name, {
            runtime: lambda.Runtime.NODEJS_14_X,
            handler: "index.handler",
            role: role,
            timeout: core.Duration.minutes(15),
            logRetention: logs.RetentionDays.ONE_MONTH,
            code: lambda.Code.fromAsset(path.join(__dirname, dir))
        });
    }
}

module.exports = { StepFunctionsLabStack }
