#!/bin/bash

echo "NOTE: Make sure the validator list is up to date! Starting soon..."
sleep 10

date=$(date '+%Y-%m-%d_%H-%M-%S')
SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

# Merge config files
cat ${SCRIPTPATH}/.config/ksm_header.yaml validators_company_kusama.yaml > ${SCRIPTPATH}/.config/ksm_company.yaml
cat ${SCRIPTPATH}/.config/dot_header.yaml validators_company_polkadot.yaml > ${SCRIPTPATH}/.config/dot_company.yaml

echo "### STARTING COMPANY POLKADOT PAYOUTS"
yarn --cwd ${SCRIPTPATH}/.polkadot-k8s-payouts/ start -c ${SCRIPTPATH}/.config/dot_company.yaml 2>&1 | tee ${SCRIPTPATH}/output/${date}_dot_company.txt

echo "### STARTING COMPANY KUSAMA PAYOUTS"
yarn --cwd ${SCRIPTPATH}/.polkadot-k8s-payouts/ start -c ${SCRIPTPATH}/.config/ksm_company.yaml 2>&1 | tee ${SCRIPTPATH}/output/${date}_ksm_company.txt

echo "### COMPANY PAYOUTS COMPLETED, you can exit now..."

sleep infinity
