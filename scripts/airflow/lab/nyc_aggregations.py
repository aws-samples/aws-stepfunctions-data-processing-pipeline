# Below code adapted from
# https://amazon-mwaa-for-analytics.workshop.aws/en/

import boto3
from pyspark.sql import SparkSession
from pyspark.sql.functions import sum

S3_BUCKET_PREFIX = "nf1-datazone-databucket"
S3_LAB_DIR = "airflow/lab"

bucketName = ""

s3 = boto3.client('s3')
response = s3.list_buckets()
for bucket in response['Buckets']:
    if bucket["Name"].startswith(S3_BUCKET_PREFIX):
        bucketName = bucket["Name"]

input_path = 's3://{}/{}/data/transformed/green'.format(bucketName, S3_LAB_DIR)
output_path = 's3://{}/{}/data/aggregated/green'.format(bucketName, S3_LAB_DIR)

spark = SparkSession.builder.appName("NYC Aggregations").getOrCreate()

sc = spark.sparkContext

df = spark.read.parquet(input_path)
df.printSchema
df_out = df.groupBy('pulocationid', 'trip_type', 'payment_type').agg(sum('fare_amount').alias('total_fare_amount'))

df_out.write.mode('overwrite').parquet(output_path)

spark.stop()

