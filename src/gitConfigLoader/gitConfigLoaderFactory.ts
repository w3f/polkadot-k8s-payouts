import { InputConfig } from "../types"
import { Disabled } from "./disabled"
import { GitConfigLoader } from "./gitConfigLoaderInterface"
import { GitHub1kv } from "./gitHub1kv"
import { GitLabPrivate } from "./gitLabPrivate"

export class GitConfigLoaderFactory {
  constructor(private readonly cfg: InputConfig){}
  makeGitConfigLoaders = (): Array<GitConfigLoader> => {

    const gitConfig = this.cfg.targetsFromGit

    if(!gitConfig?.enabled)
      return [new Disabled()]

    const result: Array<GitConfigLoader> = []
    for (const target of gitConfig.targets) {
      switch (target.platform.toLowerCase()) {
        
        case "github1kv":
          result.push(new GitHub1kv(target.url))
          break;
        case "gitlab":
          result.push(new GitLabPrivate(target.url,target.private.apiToken,target.network))
          break;
        default:
          result.push(new Disabled())
      }
    }
    return result 
  }
}