# aws-stepfunctions-data-processing-pipeline

## Introduction
Public cloud is one of the most suitable platforms for data analysis and big data processing.
In recent years, many excellent workflow orchestration tools have proliferated in cloud services and open source communities
to facilitate orchestration of complex ETL jobs in data analysis.
AWS Step Functions and Airflow from open source community are two typical examples.
To run the data analysis pipelines successfully, at least two steps are necessary.
Firstly, to build the infrastructure to support running the data pipelines, such as the deployment of Airflow's schedulers and executors.
Secondly, to orchestrate the ETL tasks in the data pipelines, such as the JSON definition of the state machine or Airflow's directed acyclic graph definition.
The former involves dev-ops, while the latter is related to application.
From the perspective of data analysis, it is ideal that the difficulty of dev-ops is minimized, and the user-friendliness of application is maximized.
This article analyzes how well Airflow and Step Functions support data analysis pipelines from the above two points of view,
and preliminarily discusses the methodology and significance of cloud-native services for orchestrating data pipelines.

## AWS Blog
An article is published in AWS Blog China to introduce the solution in detail.
- https://aws.amazon.com/cn/blogs/china/preliminary-study-on-cloud-native-data-analysis-pipeline-orchestration

## Deployment
AWS CDK 1.0 is used as the infrastructure as code solution.
To deploy, run the following command:
```bash
export AWS_ACCOUNT=
export AWS_DEFAULT_REGION=cn-north-1
export AWS_PROFILE=

cdk deploy NF1-LandingZone        --require-approval never
cdk deploy NF1-Redshift           --require-approval never
cdk deploy NF1-DataZone           --require-approval never
cdk deploy NF1-Airflow-Lab        --require-approval never
cdk deploy NF1-Glue-Lab           --require-approval never
cdk deploy NF1-StepFunctions-Lab  --require-approval never
```

## Security
See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License
This library is licensed under the MIT-0 License. See the LICENSE file.
