// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const path = require('path');
const core = require('@aws-cdk/core');
const iam = require('@aws-cdk/aws-iam');
const deploy = require('@aws-cdk/aws-s3-deployment');
const airflow = require('@aws-cdk/aws-mwaa');
const { AirflowLabPolicy } = require('../lib/airflow-lab-policy');

class AirflowLabStack extends core.Stack {
    constructor(scope, landingZone, dataZone) {
        super(scope, "NF1-Airflow-Lab");

        const envName = "airflow-lab-instance2";
        const role = this.createRole(envName, dataZone.bucket);
        this.uploadConfigFiles(dataZone.bucket);
        this.createEnvironment(envName, role, landingZone, dataZone.bucket);
        this.uploadDagFile(dataZone.bucket);
    }

    createRole(envName, bucket) {
        const policy = new AirflowLabPolicy();
        return new iam.Role(this, "ExecutionRole", {
            path: "/nf1/",
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal("airflow.amazonaws.com"),
                new iam.ServicePrincipal("airflow-env.amazonaws.com")),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonElasticMapReduceFullAccess"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("AWSGlueConsoleFullAccess"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
            ],
            inlinePolicies: {
                ["AirflowLab-Execution-Policy"]: iam.PolicyDocument.fromJson(policy.get(envName, bucket))
            }
        });
    }

    createEnvironment(envName, role, landingZone, bucket) {
        return new airflow.CfnEnvironment(this, "Lab", {
            name: envName,
            airflowVersion: "2.0.2",
            schedulers: 2,
            maxWorkers: 4,
            minWorkers: 2,
            environmentClass: "mw1.small",
            executionRoleArn: role.roleArn,
            sourceBucketArn: bucket.bucketArn,
            webserverAccessMode: "PUBLIC_ONLY",
            dagS3Path:          "airflow/lab/dags",
            pluginsS3Path:      "airflow/lab/plugins/awsairflowlib_202.zip",
            requirementsS3Path: "airflow/lab/requirements/requirements.txt",
            networkConfiguration: {
                securityGroupIds: [landingZone.securityGroup.securityGroupId],
                subnetIds: landingZone.vpc.privateSubnets.map(subnet => subnet.subnetId)
            },
            loggingConfiguration: {
                taskLogs:           { enabled: true, logLevel: "INFO" },
                dagProcessingLogs:  { enabled: true, logLevel: "WARNING" },
                schedulerLogs:      { enabled: true, logLevel: "WARNING" },
                webserverLogs:      { enabled: true, logLevel: "WARNING" },
                workerLogs:         { enabled: true, logLevel: "WARNING" }
            },
            airflowConfigurationOptions: {
                "core.enable_xcom_pickling": true
            }
        });
    }

    uploadDagFile(bucket) {
        new deploy.BucketDeployment(this, "DagScript", {
            sources: [deploy.Source.asset(path.join(__dirname, '../../scripts/airflow/lab/dags/'))],
            destinationBucket: bucket,
            destinationKeyPrefix: 'airflow/lab/dags/'
        });
    }

    uploadConfigFiles(bucket) {
        new deploy.BucketDeployment(this, "Plugins", {
            sources: [deploy.Source.asset(path.join(__dirname, '../../lib/airflow/plugins/'))],
            destinationBucket: bucket,
            destinationKeyPrefix: 'airflow/lab/plugins/'
        });
        new deploy.BucketDeployment(this, "Requirements", {
            sources: [deploy.Source.asset(path.join(__dirname, '../../lib/airflow/requirements/'))],
            destinationBucket: bucket,
            destinationKeyPrefix: 'airflow/lab/requirements/'
        });
    }
}

module.exports = { AirflowLabStack }

