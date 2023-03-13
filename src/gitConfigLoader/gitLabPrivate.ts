import { GitConfigLoader } from "./gitConfigLoaderInterface";
import fetch from 'node-fetch';
import fs from 'fs';
import { Config } from '@w3f/config';
import { Target } from "../types";
import { GitLabTarget, InputConfigFromGitLabPrivate } from "./types";

export class GitLabPrivate implements GitConfigLoader {

  constructor(
    protected readonly url: string, 
    protected readonly apiToken: string, 
    protected readonly network: string
    ) { }

  async downloadAndLoad(): Promise<Array<Target>> {
    const response = await fetch(this.url, {
    headers: {
        'PRIVATE-TOKEN': this.apiToken
    }
    });
    const data = await response.text();
    if(!response.ok) throw new Error("git config download probelm: " + data)

    fs.writeFileSync("./tmp.yaml",data)
    const cfg = new Config<InputConfigFromGitLabPrivate>().parse("./tmp.yaml");
    fs.rmSync("./tmp.yaml")
    
    let tmp: Array<GitLabTarget> = [];
    switch (this.network.toLowerCase()) {
      case "kusama":
        tmp = cfg.Kusama
        break;
      case "polkadot":
        tmp = cfg.Polkadot
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
}