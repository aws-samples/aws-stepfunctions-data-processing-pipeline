#!/usr/bin/env node

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const cdk = require('@aws-cdk/core');
const { LandingZoneStack } = require('../lib/landing-zone-stack');
const { DataZoneStack } = require('../lib/data-zone-stack');
const { RedshiftStack } = require('../lib/redshift-stack');
const { GlueLabStack } = require('../lib/glue-lab-stack');
const { GlueLegislatorsStack } = require('../lib/glue-legislators-stack');
const { AirflowLabStack } = require('../lib/airflow-lab-stack');
const { StreamSetsStack } = require('../lib/stream-sets-stack');
const { StepFunctionsLabStack } = require('../lib/stepfunctions-lab-stack');

const app = new cdk.App();
const landingZone = new LandingZoneStack(app);
const redshift = new RedshiftStack(app, landingZone);
const dataZone = new DataZoneStack(app, landingZone, redshift);
const glueLab = new GlueLabStack(app, landingZone, dataZone);
new GlueLegislatorsStack(app, landingZone, dataZone);
new AirflowLabStack(app, landingZone, dataZone);
new StreamSetsStack(app);
new StepFunctionsLabStack(app, landingZone, dataZone, redshift, glueLab);
