// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const core = require('@aws-cdk/core');
const ec2 = require('@aws-cdk/aws-ec2');
const s3 = require('@aws-cdk/aws-s3');
const ssm = require('@aws-cdk/aws-ssm');
const cloudtrail = require('@aws-cdk/aws-cloudtrail');
const logs = require('@aws-cdk/aws-logs');

class LandingZoneStack extends core.Stack {
    vpc;
    securityGroup;
    loggingBucket;

    constructor(scope) {
        super(scope, "NF1-LandingZone");

        this.vpc = this.createVpc();
        this.securityGroup = this.createSecurityGroup(this.vpc);
        this.loggingBucket = this.createLoggingBucket();
        this.createTrail(this.loggingBucket);
        this.parameter(this.loggingBucket);
    }

    createVpc() {
        const vpc = new ec2.Vpc(this, 'MainVpc', {
            cidr: "10.0.0.0/16",
            maxAzs: 2,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            gatewayEndpoints: {
                S3: { service: ec2.GatewayVpcEndpointAwsService.S3 }
            },
            subnetConfiguration: [{
                cidrMask: 24,
                name: 'public',
                subnetType: ec2.SubnetType.PUBLIC
            },
            {
                cidrMask: 24,
                name: 'private',
                subnetType: ec2.SubnetType.PRIVATE
            },
            {
                cidrMask: 24,
                name: 'isolated',
                subnetType: ec2.SubnetType.ISOLATED
            }]
        });
        vpc.addFlowLog("FlowLog");
        return vpc;
    }

    createSecurityGroup(vpc) {
        var myIp = "0.0.0.0/0";
        if (process.env.MY_IP != null) {
            myIp = process.env.MY_IP;
        }
        const group = new ec2.SecurityGroup(this, "DefaultGroup", {
            vpc: vpc,
            allowAllOutbound: true
        });
        group.addIngressRule(group, ec2.Port.allTcp(), "allow self-access");
        group.addIngressRule(ec2.Peer.ipv4(myIp), ec2.Port.tcp(22), "allow SSH");
        return group;
    }

    createLoggingBucket() {
        return new s3.Bucket(this, "LoggingBucket", {
           blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
           autoDeleteObjects: true,
           removalPolicy: core.RemovalPolicy.DESTROY,
       });
    }

    createTrail(bucket) {
        return new cloudtrail.Trail(this, 'CloudTrail', {
            bucket: bucket,
            s3KeyPrefix: "trail",
            isMultiRegionTrail: true,
            sendToCloudWatchLogs: false,
            cloudWatchLogsRetention: logs.RetentionDays.ONE_MONTH
        });
    }

    parameter(bucket) {
        new ssm.StringParameter(this, "BucketName", {
            parameterName: "/nf1/bucket/logging",
            stringValue: bucket.bucketName,
            description: "The landing zone bucket name"
        });
    }
}

module.exports = { LandingZoneStack }
