// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const core = require('@aws-cdk/core');
const iam = require('@aws-cdk/aws-iam');
const ec2 = require('@aws-cdk/aws-ec2');
const redshift = require('@aws-cdk/aws-redshift');

class RedshiftStack extends core.Stack {
    static DB_NAME = "main_db";
    static DB_PORT = 5439;
    cluster;
    role;

    constructor(scope, landingZone) {
        super(scope, "NF1-Redshift");
        const publicSubnetGroup = this.createSubnetGroup(landingZone.vpc, ec2.SubnetType.PUBLIC);
        const isolatedSubnetGroup = this.createSubnetGroup(landingZone.vpc, ec2.SubnetType.ISOLATED);
        this.role = this.createRole();
        this.cluster = this.createCluster(landingZone, isolatedSubnetGroup);
    }

    createRole() {
        // cannot set path, otherwise exception
        return new iam.Role(this, "ServiceRole", {
            assumedBy: new iam.ServicePrincipal("redshift.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("AWSGlueConsoleFullAccess")
            ]
        });
    }

    createSubnetGroup(vpc, subnetType) {
        return new redshift.ClusterSubnetGroup(this, subnetType + "SubnetGroup", {
            vpc: vpc,
            description: subnetType + " subnet group",
            removalPolicy: core.RemovalPolicy.DESTROY,
            vpcSubnets: { subnetType: subnetType }
        });
    }

    createCluster(landingZone, subnetGroup) {
        return new redshift.Cluster(this, "MainCluster", {
            masterUser: {
                masterUsername: "admin"
            },
            vpc: landingZone.vpc,
            port: RedshiftStack.DB_PORT,
            numberOfNodes: 2,
            publiclyAccessible: false,
            defaultDatabaseName: RedshiftStack.DB_NAME,
            securityGroups: [landingZone.securityGroup],
            removalPolicy: core.RemovalPolicy.DESTROY,
            nodeType: redshift.NodeType.DC2_LARGE,
            roles: [this.role],
            subnetGroup: subnetGroup
        })
    }
}

module.exports = { RedshiftStack }
