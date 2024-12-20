import { GitConfigLoader } from "./gitConfigLoaderInterface";
import fetch from 'node-fetch';
import fs from 'fs';
import { Config } from '@w3f/config';
import { Target } from "../types";
import { GitLabTarget, InputConfigFromGitLabPrivate } from "./types";
import { MonitoringConfigVersion } from "../constants";
import { ConfigAccountSettings, MonitoringGroup, Chain, MonitorType, ValidatorSettings, MonitorSettings } from "@w3f/monitoring-types";
import { ConfigProcessor } from "@w3f/monitoring-config";

export class GitLabPrivate implements GitConfigLoader {

  constructor(
    protected readonly url: string, 
    protected readonly apiToken: string, 
    protected readonly network: string
    ) { }

  async downloadAndLoad(configVersion?: MonitoringConfigVersion): Promise<Array<Target>> {
    const response = await fetch(this.url, {
    headers: {
        'PRIVATE-TOKEN': this.apiToken
    }
    });
    const data = await response.text();
    if(!response.ok) throw new Error("git config download problem: " + data)
    
    let configV1;
    fs.writeFileSync("./tmp.yaml", data);
    switch (configVersion) {
      case MonitoringConfigVersion.V2: {
        const configV2 = ConfigProcessor.processConfigs(["./tmp.yaml"]);
        configV1 = this.configV2toV1(configV2);
        break;
      }
      case MonitoringConfigVersion.V1:
      default: {
        configV1 = new Config<InputConfigFromGitLabPrivate>().parse("./tmp.yaml");
        break;
      }
    }
    fs.rmSync("./tmp.yaml");    
      
    let tmp: Array<GitLabTarget> = [];
    switch (this.network.toLowerCase()) {
      case "kusama":
        tmp = configV1.Kusama
        break;
      case "polkadot":
        tmp = configV1.Polkadot
        break;
      default:
        throw new Error("unexpected configuration")
    }
    return tmp.map(t=>{
      const target: Target = {
        alias: t.name,
        validatorAddress: t.address
      } 
      return target
    })
  }

  configV2toV1(groups: MonitoringGroup[]): InputConfigFromGitLabPrivate {
    const result: InputConfigFromGitLabPrivate = {
      Kusama: [],
      Polkadot: [],
    };
    for (const group of groups) {
      if (group.chain !== Chain.Kusama && group.chain !== Chain.Polkadot) {
        continue;
      }
      const hasValidatorMonitor = group.monitors.some(
        monitor => monitor.name === MonitorType.Validator
      );
      if (!hasValidatorMonitor) {
        continue;
      }
  
      const targets = group.accounts
        .filter((account: ConfigAccountSettings) => {
          const validatorSettings = account[MonitorType.Validator] as MonitorSettings<MonitorType.Validator>;
          return validatorSettings?.enablePayout === true;
        })
        .map((account: ConfigAccountSettings) => ({
          name: account.name,
          address: account.ss58,
        }));
      result[group.chain].push(...targets);
    }
    return result;
  }
}