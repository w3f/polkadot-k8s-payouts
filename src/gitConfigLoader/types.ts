//https://raw.githubusercontent.com/w3f/1k-validators-be/master/helmfile.d/config/kusama/otv-backend-prod.yaml.gotmpl
export interface TargetFromGit1kv {
  name: string;
  stash: string;
}

/*********************/

export interface GitLabTarget {
  name: string;
  address: string;
}

export interface InputConfigFromGitLabPrivate {
  Kusama: Array<GitLabTarget>;
  Polkadot: Array<GitLabTarget>;
}

/*********************/