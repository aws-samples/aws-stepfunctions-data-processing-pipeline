// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

class AirflowLabPolicy {

    get(envName, bucket) {
        return {
        "Version": "2012-10-17",
        "Statement": [
           {
               "Effect": "Allow",
               "Action": "airflow:PublishMetrics",
               "Resource": `arn:aws:airflow:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:environment/${envName}`
           },
           {
               "Effect": "Deny",
               "Action": "s3:ListAllMyBuckets",
               "Resource": [
                   `arn:aws:s3:::${bucket.bucketName}`,
                   `arn:aws:s3:::${bucket.bucketName}/\*`
               ]
           },
           {
               "Effect": "Allow",
               "Action": [
                   "s3:GetObject*",
                   "s3:GetBucket*",
                   "s3:List*"
               ],
               "Resource": [
                   `arn:aws:s3:::${bucket.bucketName}`,
                   `arn:aws:s3:::${bucket.bucketName}/\*`
               ]
           },
           {
               "Effect": "Allow",
               "Action": [
                   "logs:CreateLogStream",
                   "logs:CreateLogGroup",
                   "logs:PutLogEvents",
                   "logs:GetLogEvents",
                   "logs:GetLogRecord",
                   "logs:GetLogGroupFields",
                   "logs:GetQueryResults"
               ],
               "Resource": [
                   `arn:aws:logs:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:log-group:airflow-${envName}-*`
               ]
           },
           {
               "Effect": "Allow",
               "Action": [ "logs:DescribeLogGroups" ],
               "Resource": [ "*" ]
           },
           {
               "Effect": "Allow",
               "Action": "cloudwatch:PutMetricData",
               "Resource": "*"
           },
           {
               "Effect": "Allow",
               "Action": [
                   "sqs:ChangeMessageVisibility",
                   "sqs:DeleteMessage",
                   "sqs:GetQueueAttributes",
                   "sqs:GetQueueUrl",
                   "sqs:ReceiveMessage",
                   "sqs:SendMessage"
               ],
               "Resource": `arn:aws:sqs:${process.env.CDK_DEFAULT_REGION}:*:airflow-celery-*`
           },
           {
               "Effect": "Allow",
               "Action": [
                   "kms:Decrypt",
                   "kms:DescribeKey",
                   "kms:GenerateDataKey*",
                   "kms:Encrypt"
               ],
               "NotResource": `arn:aws:kms:*:${process.env.CDK_DEFAULT_ACCOUNT}:key/\*`,
               "Condition": {
                   "StringLike": {
                       "kms:ViaService": [
                           `sqs.${process.env.CDK_DEFAULT_REGION}.amazonaws.com`,
                           `s3.${process.env.CDK_DEFAULT_REGION}.amazonaws.com`
                       ]
                   }
               }
           }
        ]
        };
    }
}

module.exports = { AirflowLabPolicy }

