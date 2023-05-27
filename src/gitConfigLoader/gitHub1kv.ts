import { GitConfigLoader } from "./gitConfigLoaderInterface";
import fetch from 'node-fetch';
import { Target } from "../types";
import { TargetFromGit1kv } from "./types";

export class GitHub1kv implements GitConfigLoader {

  constructor(
    protected readonly url: string
    ) { }

  async downloadAndLoad(): Promise<Array<Target>> {
    const response = await fetch(this.url);
    const data = await response.json();
    // based on the shape of https://github.com/w3f/1k-validators-be/blob/master/helmfile.d/config/kusama/otv-backend-prod.yaml.gotmpl
    const candidates: Array<TargetFromGit1kv> = data.candidates

    return candidates.map(c=>{
      const target: Target = {
        alias: c.name,
        validatorAddress: c.stash
      } 
      return target
    })
  }
}