// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const ec2 = new AWS.EC2();
const glue = new AWS.Glue();

async function onCreate(eni, address) {
    if (eni.AssociationId == address.AllocationId) {
        console.log("Already associated, abort.")
        return;
    } else if (eni.AssociationId != null) {
        await ec2.disassociateAddress({AssociationId: eni.AssociationId}).promise();
        console.log("Disassociated the address.");
    }

    await ec2.associateAddress({
        NetworkInterfaceId: eni.NetworkInterfaceId,
        AllocationId: address.AllocationId
    }).promise();
    console.log("Associated the address with obtained ENI.")
}

async function onDelete(eni) {
    if (eni.AssociationId == null) {
        console.log("Already disassociated, abort.")
        return;
    } else {
        await ec2.disassociateAddress({AssociationId: eni.AssociationId}).promise();
        console.log("Disassociated the address.");
    }
}

function extractIp(address) {
    const regex = /.+-([0-9]+)-([0-9]+)-([0-9]+)-([0-9]+)\..+/;
    const match = address.match(regex);
    return `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
}

exports.handler = async event => {
    const properties = event.ResourceProperties;

    const addresses = await ec2.describeAddresses({
        Filters: [{Name: "allocation-id", Values: [properties.AddressId]}]
    }).promise();
    const address = addresses.Addresses[0];
    console.log("Obtained EIP: " + address.PublicIp);

    const endpoint = await glue.getDevEndpoint({EndpointName: properties.EndpointName}).promise();
    const endpointIp = extractIp(endpoint.DevEndpoint.PrivateAddress);
    console.log("Obtained endpoint address: " + endpointIp);

    const enis = await ec2.describeNetworkInterfaces({
        Filters: [{Name: "private-ip-address", Values: [endpointIp]}]
    }).promise();
    const eni = enis.NetworkInterfaces[0];
    console.log("Obtained ENI: " + eni.NetworkInterfaceId);

    switch (event.RequestType) {
        case "Create":
        case "Update":
            await onCreate(eni, address);
            break;

        case "Delete":
            await onDelete(eni);
            break;
    }
};
