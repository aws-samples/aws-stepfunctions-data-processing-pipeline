# Below code adapted from
# https://amazon-mwaa-for-analytics.workshop.aws/en/

import airflow
import boto3
from datetime import timedelta
from airflow import DAG
from airflow.providers.amazon.aws.sensors.s3_prefix import S3PrefixSensor

# Custom Operators deployed as Airflow plugins
from awsairflowlib.operators.aws_glue_job_operator import AWSGlueJobOperator
from awsairflowlib.operators.aws_glue_crawler_operator import AWSGlueCrawlerOperator
from awsairflowlib.operators.aws_copy_s3_to_redshift import CopyS3ToRedshiftOperator

S3_BUCKET_PREFIX = "nf1-datazone-databucket"
S3_LAB_DIR = "airflow/lab"

bucketName = ""

s3 = boto3.client('s3')
response = s3.list_buckets()
for bucket in response['Buckets']:
    if bucket["Name"].startswith(S3_BUCKET_PREFIX):
        bucketName = bucket["Name"]

glueRoleName = ""
redshiftRoleArn = ""

iam = boto3.client('iam')

response = iam.list_roles()
for role in response["Roles"]:
    if role["RoleName"].startswith("NF1-DataZone-GlueRole"):
        glueRoleName = role["RoleName"]
    elif role["RoleName"].startswith("NF1-Redshift-ServiceRole"):
        redshiftRoleArn = role["Arn"]

while response["IsTruncated"] == True:
    marker = response["Marker"]
    response = iam.list_roles(Marker=marker)
    for role in response["Roles"]:
        if role["RoleName"].startswith("NF1-DataZone-GlueRole"):
            glueRoleName = role["RoleName"]
        elif role["RoleName"].startswith("NF1-Redshift-ServiceRole"):
            redshiftRoleArn = role["Arn"]

glue = boto3.client('glue')
response = glue.list_crawlers(Tags={'Name': 'NF1-Airflow-Lab-RawGreenCrawler'})
crawlerName = response["CrawlerNames"][0]

response = glue.list_jobs(Tags={'Name': 'NF1-Airflow-Lab-NycRawToTransformJob'})
jobTransform = response["JobNames"][0]

response = glue.list_jobs(Tags={'Name': 'NF1-Airflow-Lab-NycAggregationsJob'})
jobAggregate = response["JobNames"][0]

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'start_date': airflow.utils.dates.days_ago(1),
    'retries': 0,
    'retry_delay': timedelta(minutes=2),
    'provide_context': True,
    'email': ['clementy@amazon.com'],
    'email_on_failure': False,
    'email_on_retry': False
}

dag = DAG(
    'data_pipeline',
    default_args=default_args,
    dagrun_timeout=timedelta(hours=2),
    schedule_interval='0 0 1 1 *' # at each January 1am
)

s3_sensor = S3PrefixSensor(
    task_id='s3_sensor',
    bucket_name=bucketName,
    prefix=S3_LAB_DIR + '/data/raw/green',
    dag=dag
)

glue_crawler = AWSGlueCrawlerOperator(
    task_id="glue_crawler",
    crawler_name=crawlerName,
    iam_role_name=glueRoleName,
    dag=dag
)

glue_task_transform = AWSGlueJobOperator(
    task_id="glue_task_transform",
    job_name=jobTransform,
    iam_role_name=glueRoleName,
    dag=dag
)

glue_task_aggregate = AWSGlueJobOperator(
    task_id="glue_task_aggregate",
    job_name=jobAggregate,
    iam_role_name=glueRoleName,
    dag=dag
)

copy_agg_to_redshift = CopyS3ToRedshiftOperator(
    task_id='copy_to_redshift',
    schema='nyc',
    table='green',
    s3_bucket=bucketName,
    s3_key=S3_LAB_DIR + '/data/aggregated',
    iam_role_arn=redshiftRoleArn,
    copy_options=["FORMAT AS PARQUET"],
    dag=dag,
)

s3_sensor >> glue_crawler >> glue_task_transform >> glue_task_aggregate >> copy_agg_to_redshift
