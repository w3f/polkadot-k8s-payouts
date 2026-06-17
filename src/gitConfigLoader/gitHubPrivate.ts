import { GitLabPrivate } from "./gitLabPrivate";

export class GitHubPrivate extends GitLabPrivate {
  protected authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiToken}` };
  }
}
