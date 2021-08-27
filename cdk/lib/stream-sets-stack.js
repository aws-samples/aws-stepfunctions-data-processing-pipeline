// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const core = require('@aws-cdk/core');
const iam = require('@aws-cdk/aws-iam');

class StreamSetsStack extends core.Stack {
    constructor(scope) {
        super(scope, "NF1-StreamSets");

        const instanceRole = this.createInstanceRole();
        this.createInstanceProfile(instanceRole);
        this.createCredentialRole(instanceRole);
    }

    getInstancePolicy() {
        return {
        "Version": "2012-10-17",
        "Statement": [
           {
               "Effect": "Allow",
               "Action": "ssm:GetParameter",
               "Resource": `arn:aws:ssm:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:parameter/StreamSets-Deployment-Token-*`
           }
        ]}
    }

    createInstanceRole() {
        return new iam.Role(this, "InstanceRole", {
            path: "/nf1/",
            assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
            ],
            inlinePolicies: {
                ["Instance-Policy"]: iam.PolicyDocument.fromJson(this.getInstancePolicy())
            }
        });
    }

    createInstanceProfile(instanceRole) {
        return new iam.CfnInstanceProfile(this, "Profile", {
            path: "/nf1/",
            roles: [instanceRole.roleName]
        });
    }

    createCredentialRole(instanceRole) {
        // path uses / because the Paslisade does not recognize role with non-root path
        return new iam.Role(this, "CredentialRole", {
            path: "/",
            assumedBy: new iam.AccountPrincipal("632637830840"),
            externalIds: [process.env.EXTERNAL_ID],
            inlinePolicies: {
                ["Credential-Policy"]: iam.PolicyDocument.fromJson(this.getCredentialPolicy(instanceRole))
            }
        });
    }

    getCredentialPolicy(instanceRole) {
        return {
        "Version": "2012-10-17",
        "Statement": [
           {
               "Sid": "0",
               "Effect": "Allow",
               "Action": [
                   "ec2:DescribeImages",
                   "autoscaling:DescribeScalingActivities",
                   "ec2:DescribeVpcs",
                   "autoscaling:DescribeAutoScalingGroups",
                   "ec2:DescribeRegions",
                   "autoscaling:DescribeLaunchConfigurations",
                   "ec2:DescribeInstanceTypes",
                   "ec2:DescribeInstanceTypeOfferings",
                   "ec2:DescribeSubnets",
                   "ec2:DescribeKeyPairs",
                   "ec2:DescribeSecurityGroups",
                   "ec2:DescribeInstances",
                   "autoscaling:DescribeScheduledActions"
               ],
               "Resource": "*"
           },
           {
               "Sid": "1",
               "Effect": "Allow",
               "Action": [
                   "cloudformation:DescribeStacks",
                   "cloudformation:CreateStack",
                   "cloudformation:DeleteStack",
                   "cloudformation:UpdateStack",
                   "cloudformation:DescribeStackEvents"
               ],
               "Resource": `arn:aws:cloudformation:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:stack/StreamSets-*/\*`
           },
           {
               "Sid": "2",
               "Effect": "Allow",
               "Action": [
                   "ssm:GetParameters",
                   "ssm:GetParameter",
                   "ssm:PutParameter",
                   "ssm:DeleteParameter",
                   "ssm:ListTagsForResource",
                   "ssm:AddTagsToResource",
                   "ssm:RemoveTagsFromResource"
               ],
               "Resource": `arn:aws:ssm:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:parameter/\*`
           },
           {
               "Sid": "3",
               "Effect": "Allow",
               "Action": [
                   "autoscaling:CreateLaunchConfiguration",
                   "autoscaling:DeleteLaunchConfiguration",
                   "autoscaling:UpdateAutoScalingGroup",
                   "autoscaling:DeleteAutoScalingGroup",
                   "autoscaling:TerminateInstanceInAutoScalingGroup",
                   "autoscaling:CreateAutoScalingGroup",
                   "autoscaling:CreateOrUpdateTags",
                   "autoscaling:DescribeTags",
                   "autoscaling:DeleteTags",
                   "autoscaling:SetDesiredCapacity"
               ],
               "Resource": [
                   `arn:aws:autoscaling:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:autoScalingGroup:*:autoScalingGroupName/StreamSets-*`,
                   `arn:aws:autoscaling:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:launchConfiguration:*:launchConfigurationName/StreamSets-*`
               ]
           },
           {
               "Sid": "4",
               "Effect": "Allow",
               "Action": "iam:PassRole",
               "Resource": `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:role/nf1/${instanceRole.roleName}`
           },
           {
               "Sid": "5",
               "Effect": "Allow",
               "Action": "iam:CreateServiceLinkedRole",
               "Resource": `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:role/aws-service-role/autoscaling.amazonaws.com/AWSServiceRoleForAutoScaling`
           }
        ]};
   }
}

module.exports = { StreamSetsStack }
