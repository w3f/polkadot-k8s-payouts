import { GitConfigLoader } from "./gitConfigLoaderInterface";
import fetch from 'node-fetch';
import { Target } from "../types";
import { TargetFromGit1kv } from "./types";
import { parse } from 'yaml'

export class GitHub1kv implements GitConfigLoader {

  constructor(
    protected readonly url: string
    ) { }

  async downloadAndLoad(): Promise<Array<Target>> {
    const response = await fetch(this.url);
    let data = await response.text();
    // based on the shape of https://github.com/w3f/1k-validators-be/blob/master/helmfile.d/config/kusama/otv-backend-prod.yaml.gotmpl
    data = data.replace(/{{.*}}/gm, '')
    const candidates: Array<TargetFromGit1kv> = JSON.parse(parse(data)["config"])["scorekeeper"]["candidates"]

    return candidates.map(c=>{
      const target: Target = {
        alias: c.name,
        validatorAddress: c.stash
      } 
      return target
    })
  }
}