export interface Keystore {
    filePath: string;
    passwordPath: string;
}

export interface Target {
  alias: string;
  validatorAddress: string;
}

export interface ClaimerInputConfig {
    targets?: Array<Target>;
    deepCheck: {
      enabled: boolean;
    };
    claim: {
      enabled: boolean;
      gracePeriod: GracePeriod;
      batchSize: number;
      claimerKeystore: Keystore;
    };
    targetsFromGit?: {
      enabled: boolean;
      targets: Array<{
        platform: string;
        private: {
            enabled: boolean;
            apiToken: string;
        };
        network?: string;
        url: string;
      }>;
    };
}

export interface InputConfig extends ClaimerInputConfig {
  wsEndpoint: string;
  logLevel: string;
}

export interface GracePeriod {
  enabled: boolean;
  eras: number;
}

export type ValidatorsMap = Map<string,ValidatorInfo>

export interface ValidatorInfo {
  lastReward: number;
  alias: string;
  unclaimedPayouts?: number[];
  claimedPayouts?: number[];
}

export interface ClaimPool {
  address: string; 
  eraIndex: number;
}

