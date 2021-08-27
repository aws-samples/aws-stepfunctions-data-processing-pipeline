// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const path = require('path');
const core = require('@aws-cdk/core');
const iam = require('@aws-cdk/aws-iam');
const ec2 = require('@aws-cdk/aws-ec2');
const logs = require('@aws-cdk/aws-logs');
const asset = require('@aws-cdk/aws-s3-assets');
const glue = require('@aws-cdk/aws-glue');
const logGroupName = "/aws/glue/legislators"

class GlueLegislatorsStack extends core.Stack {
    constructor(scope, landingZone, dataZone) {
        super(scope, "NF1-Glue-Legislators");

        this.createLogGroup();
        this.createCrawler(dataZone.glueRole, dataZone.bucket);
        const devEndpoint = this.createDevEndpoint(dataZone.glueRole, landingZone);
        const address = this.createEip(devEndpoint);
        const job = this.createJob(dataZone.glueRole, dataZone.bucket, dataZone.redshiftConnection);
        this.createTrigger(job);
        this.createAssociateResource(address, devEndpoint);
    }

    createLogGroup() {
        // due to bug in Glue 2.0, log group has to be created first
        return new logs.LogGroup(this, "LogGroup", {
            logGroupName: logGroupName,
            removalPolicy: core.RemovalPolicy.DELETE,
            retention: logs.RetentionDays.ONE_MONTH
        });
    }

    createDatabase() {
        const database = new glue.Database(this, "LegislatorsDatabase", {
            databaseName: "glue_legislators"
        });
        database.applyRemovalPolicy(core.RemovalPolicy.DELETE);
        return database;
    }

    createCrawler(role, bucket) {
        const database = this.createDatabase();
        return new glue.CfnCrawler(this, "NF1-Glue-LegislatorsCrawler", {
            databaseName: database.databaseName,
            role: role.roleArn,
            targets: {
                s3Targets: [{ path: bucket.s3UrlForObject("glue/legislators/data")}]
            },
            tags: {Name: "NF1-Glue-LegislatorsCrawler"}
        });
    }

    createDevEndpoint(role, landingZone) {
        return new glue.CfnDevEndpoint(this, "NF1-Glue-Endpoint", {
            glueVersion: "1.0",
            roleArn: role.roleArn,
            publicKey: process.env.PUB_KEY,
            subnetId: landingZone.vpc.publicSubnets[0].subnetId,
            securityGroupIds: [landingZone.securityGroup.securityGroupId],
            extraJarsS3Path: "s3://crawler-public/json/serde/json-serde.jar",
            arguments: {
                "--enable-glue-datacatalog": true,
                "GLUE_PYTHON_VERSION": "3"
            }
        });
    }

    createEip() {
        const eip = new ec2.CfnEIP(this, "EndpointIp", {
            domain: "vpc",
            tags: [{ key: "Name", value: "NF1-Glue-Legislators-DevEndpoint" }]
        });
        eip.applyRemovalPolicy(core.RemovalPolicy.DELETE);
        return eip;
    }

    createJob(role, bucket, connection) {
        const scriptAsset = new asset.Asset(this, "ScriptAsset", {
            path: path.join(__dirname, "../../scripts/glue/legislators.py")
        });
        return new glue.CfnJob(this, "NF1-Glue-LegislatorsJob", {
            role: role.roleArn,
            glueVersion: "2.0",
            workerType: "G.1X",
            numberOfWorkers: 2,
            timeout: 10, // in minutes
            maxRetries: 1,
            executionProperty: { maxConcurrentRuns: 1 },
            notificationProperty: { notifyDelayAfter: 10 },
            connections: {connections: [connection.connectionName]},
            command: {
                name: "glueetl",
                scriptLocation: scriptAsset.s3ObjectUrl
            },
            defaultArguments: {
                "--enable-metrics": true,
                "--enable-spark-ui": true,
                "--enable-glue-datacatalog": true,
                '--enable-continuous-cloudwatch-log': true,
                '--continuous-log-logGroup': logGroupName,
                "--spark-event-logs-path": bucket.s3UrlForObject("glue/legislators/spark-log"),
                "--TempDir": bucket.s3UrlForObject("glue/legislators/temp"),
                "--nf1_redshift_connection": connection.connectionName
            },
            tags: {Name: "NF1-Glue-LegislatorsJob"}
        });
    }

    createTrigger(job) {
        return new glue.CfnTrigger(this, "NF1-Glue-LegislatorsTrigger", {
            type: "ON_DEMAND",
            actions: [{ jobName: job.ref }],
            tags: {Name: "NF1-Glue-LegislatorsTrigger"}
        });
    }

    createAssociateResource(address, endpoint) {
        const serviceToken = core.CustomResourceProvider.getOrCreate(this, "Custom::GlueAssociate", {
            timeout: core.Duration.minutes(5),
            runtime: core.CustomResourceProviderRuntime.NODEJS_14_X,
            description: "Associate Elastic IP with Glue DevEndpoint",
            codeDirectory: path.join(__dirname, "../../lambda/glue/associate-eip"),
            policyStatements: [
                {
                    Action: "ec2:*",
                    Effect: "Allow",
                    Resource: "*"
                },
                {
                    Action: "glue:GetDevEndpoint",
                    Effect: "Allow",
                    Resource: `arn:aws:glue:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:devEndpoint/\*`
                }
            ]
        });

        new core.CustomResource(this, 'AssociateResource', {
            resourceType: "Custom::GlueAssociate",
            serviceToken: serviceToken,
            properties: {
                AddressId: address.attrAllocationId,
                EndpointName: endpoint.ref
            }
        });
    }
}

module.exports = { GlueLegislatorsStack }
