#!/bin/bash

echo "NOTE: Make sure the validator list is up to date (did you run the candidate fetcher?). Starting soon..."
sleep 10

date=$(date '+%Y-%m-%d_%H-%M-%S')
SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

# Merge config files
cat ${SCRIPTPATH}/.config/ksm_header.yaml validators_1kv_kusama.yaml > ${SCRIPTPATH}/.config/ksm_1kv.yaml
cat ${SCRIPTPATH}/.config/dot_header.yaml validators_1kv_polkadot.yaml > ${SCRIPTPATH}/.config/dot_1kv.yaml

echo "### STARTING 1KV POLKADOT PAYOUTS"
yarn --cwd ${SCRIPTPATH}/.polkadot-k8s-payouts/ start -c ${SCRIPTPATH}/.config/dot_1kv.yaml 2>&1 | tee ${SCRIPTPATH}/output/${date}_dot_1kv.txt

echo "### STARTING 1KV KUSAMA PAYOUTS"
yarn --cwd ${SCRIPTPATH}/.polkadot-k8s-payouts/ start -c ${SCRIPTPATH}/.config/ksm_1kv.yaml 2>&1 | tee ${SCRIPTPATH}/output/${date}_ksm_1kv.txt

echo "### 1KV PAYOUTS COMPLETED, you can exit now..."

sleep infinity
