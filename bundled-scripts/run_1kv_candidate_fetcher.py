#! /usr/bin/env python3

import json
import urllib.request
import time

print ("Fetching 1kv candidates...")

targets = [
    (
        "kusama",
        "https://kusama.w3f.community/candidates"
    ),
    (
        "polkadot",
        "https://polkadot.w3f.community/candidates"
    )
]

for target in targets:
    # Fetch online resource
    data = urllib.request.urlopen(target[1]).read()

    # Parse JSON
    candidates = json.loads(data)

    # Create the output content
    result = ""
    for c in candidates:
        result += "- alias: 1kv-{}\n  validatorAddress: {}\n".format(c["name"], c["stash"])

    # Write output to file
    with open("validators_1kv_{}.yaml".format(target[0]), "w+") as file:
        file.write(result)

print ("COMPLETED! You can exit now...")

while True:
	time.sleep(10000)
