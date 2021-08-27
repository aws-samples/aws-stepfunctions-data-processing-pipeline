// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const core = require('@aws-cdk/core');
const iam = require('@aws-cdk/aws-iam');
const s3 = require('@aws-cdk/aws-s3');
const ssm = require('@aws-cdk/aws-ssm');
const glue = require('@aws-cdk/aws-glue');
const { RedshiftStack } = require('../lib/redshift-stack');

class DataZoneStack extends core.Stack {
    bucket;
    glueRole;
    redshiftConnection;

    constructor(scope, landingZone, redshift) {
        super(scope, "NF1-DataZone");
        this.bucket = this.createDataBucket();
        this.glueRole = this.createGlueRole();
        this.redshiftConnection = this.createRedshiftConnection(landingZone, redshift.cluster);
        this.parameter(this.bucket);
    }

    createGlueRole() {
        return new iam.Role(this, "GlueRole", {
            path: "/nf1/",
            assumedBy: new iam.ServicePrincipal("glue.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSGlueServiceRole"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchLogsFullAccess"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonRedshiftFullAccess")
            ]
        });
    }

    createRedshiftConnection(landingZone, cluster) {
        return new glue.Connection(this, "NF1-RedshiftConnection", {
            type: glue.ConnectionType.JDBC,
            securityGroups: [landingZone.securityGroup],
            subnet: landingZone.vpc.isolatedSubnets[0],
            properties: {
                JDBC_CONNECTION_URL: `jdbc:redshift:\/\/${cluster.clusterEndpoint.hostname}:${RedshiftStack.DB_PORT}/${RedshiftStack.DB_NAME}`,
                USERNAME: cluster.secret.secretValueFromJson("username").toString(),
                PASSWORD: cluster.secret.secretValueFromJson("password").toString()
            }
        });
    }

    createDataBucket() {
        return new s3.Bucket(this, "DataBucket", {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: true,
            autoDeleteObjects: true,
            removalPolicy: core.RemovalPolicy.DESTROY,
        });
    }

    parameter(bucket) {
        new ssm.StringParameter(this, "BucketName", {
            parameterName: "/nf1/bucket/data",
            stringValue: bucket.bucketName,
            description: "The data zone bucket name"
        });
    }
}

module.exports = { DataZoneStack }
