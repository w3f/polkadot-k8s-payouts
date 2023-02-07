# Setup k8s Payout Tool

```bash
git clone github.com/w3f/polkadot-k8s-payouts .polkadot-k8s-payouts
cd .polkadot-k8s-payouts
yarn build
cd ..
```

# Configuration

The configuration is _similar_ to the k8s payout tool:

* `.config/(dot|ksm)_header.yaml` contains the header information (RPC endpoint, tool config, etc).
* `.config/keys` contains the account key information that submits the claims.

Additionally:

* `validators_1kv_(kusama|polkadot).yaml` contains the 1kv validators.
	* _Run the `run_1kv_candidate_fetcher.py` script to fetch the latest
	candidates from the 1kv-backend API_.
* `validators_company_(kusama|polkadot).yaml` contains the company validators.
	* _Needs to be specified and maintained by hand_.

When you run `run_(1kv|company)_payouts.sh`, the script will merge the header
information in `.config` with the validator list and will save it in `.config`.

# Execution

## Company Payout Claims

```bash
./run_company_payouts.sh
```

## 1kv Payout Claims

```bash
./run_1kv_candidate_fetcher.py
./run_1kv_payouts.py
```
