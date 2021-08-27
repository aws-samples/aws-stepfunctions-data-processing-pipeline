# Below code adapted from
# https://amazon-mwaa-for-analytics.workshop.aws/en/

import sys
import boto3
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.context import SparkContext

## @params: [JOB_NAME]
args = getResolvedOptions(sys.argv, ['JOB_NAME'])

glueContext = GlueContext(SparkContext.getOrCreate())
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)


S3_BUCKET_PREFIX = "nf1-datazone-databucket"
S3_LAB_DIR = "airflow/lab"

bucketName = ""

s3 = boto3.client('s3')
response = s3.list_buckets()
for bucket in response['Buckets']:
    if bucket["Name"].startswith(S3_BUCKET_PREFIX):
        bucketName = bucket["Name"]

base_dir = "s3://{}/{}/".format(bucketName, S3_LAB_DIR)

## @type: DataSource
## @args: [database = "default", table_name = "green", transformation_ctx = "datasource0"]
## @return: datasource0
## @inputs: []
datasource0 = glueContext.create_dynamic_frame.from_catalog(
    database = "airflow-lab",
    table_name = "green",
    transformation_ctx = "datasource0")

## @type: ApplyMapping
## @args: [mapping = [("vendorid", "long", "vendorid", "long"), ("lpep_pickup_datetime", "string", "lpep_pickup_datetime", "string"), ("lpep_dropoff_datetime", "string", "lpep_dropoff_datetime", "string"), ("store_and_fwd_flag", "string", "store_and_fwd_flag", "string"), ("ratecodeid", "long", "ratecodeid", "long"), ("pulocationid", "long", "pulocationid", "long"), ("dolocationid", "long", "dolocationid", "long"), ("passenger_count", "long", "passenger_count", "long"), ("trip_distance", "double", "trip_distance", "double"), ("fare_amount", "double", "fare_amount", "double"), ("extra", "double", "extra", "double"), ("mta_tax", "double", "mta_tax", "double"), ("tip_amount", "double", "tip_amount", "double"), ("tolls_amount", "double", "tolls_amount", "double"), ("ehail_fee", "string", "ehail_fee", "string"), ("improvement_surcharge", "double", "improvement_surcharge", "double"), ("total_amount", "double", "total_amount", "double"), ("payment_type", "long", "payment_type", "long"), ("trip_type", "long", "trip_type", "long")], transformation_ctx = "applymapping1"]
## @return: applymapping1
## @inputs: [frame = datasource0]
applymapping1 = ApplyMapping.apply(
    frame = datasource0,
    mappings = [
        ("vendorid", "long", "vendorid", "long"),
        ("lpep_pickup_datetime", "string", "lpep_pickup_datetime", "string"),
        ("lpep_dropoff_datetime", "string", "lpep_dropoff_datetime", "string"),
        ("store_and_fwd_flag", "string", "store_and_fwd_flag", "string"),
        ("ratecodeid", "long", "ratecodeid", "long"),
        ("pulocationid", "long", "pulocationid", "long"),
        ("dolocationid", "long", "dolocationid", "long"),
        ("passenger_count", "long", "passenger_count", "long"),
        ("trip_distance", "double", "trip_distance", "double"),
        ("fare_amount", "double", "fare_amount", "double"),
        ("extra", "double", "extra", "double"),
        ("mta_tax", "double", "mta_tax", "double"),
        ("tip_amount", "double", "tip_amount", "double"),
        ("tolls_amount", "double", "tolls_amount", "double"),
        ("ehail_fee", "string", "ehail_fee", "string"),
        ("improvement_surcharge", "double", "improvement_surcharge", "double"),
        ("total_amount", "double", "total_amount", "double"),
        ("payment_type", "long", "payment_type", "long"),
        ("trip_type", "long", "trip_type", "long")],
    transformation_ctx = "applymapping1")


## @type: ResolveChoice
## @args: [choice = "make_struct", transformation_ctx = "resolvechoice2"]
## @return: resolvechoice2
## @inputs: [frame = applymapping1]
resolvechoice2 = ResolveChoice.apply(
    frame = applymapping1,
    choice = "make_struct",
    transformation_ctx = "resolvechoice2")

## @type: DropNullFields
## @args: [transformation_ctx = "dropnullfields3"]
## @return: dropnullfields3
## @inputs: [frame = resolvechoice2]
dropnullfields3 = DropNullFields.apply(
    frame = resolvechoice2,
    transformation_ctx = "dropnullfields3")

## @type: DataSink
## @args: [connection_type = "s3", connection_options = {"path": "s3://airflow-yourname-bucket/data/transformed/green"}, format = "parquet", transformation_ctx = "datasink4"]
## @return: datasink4
## @inputs: [frame = dropnullfields3]
datasink4 = glueContext.write_dynamic_frame.from_options(
    frame = dropnullfields3,
    connection_type = "s3",
    connection_options = {"path": base_dir + "data/transformed/green"},
    format = "parquet",
    transformation_ctx = "datasink4")

job.commit()
