import { GitConfigVersion } from "./constants";

export interface Keystore {
    filePath: string;
    passwordPath: string;
}

export interface Target {
  alias: string;
  validatorAddress: string;
  tag?: string;
}

export interface ClaimerInputConfig {
    targets?: Array<Target>;
    filterByTag?: {
      enabled: boolean;
      tag?: string;
    };
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
      configVersion?: GitConfigVersion;
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
  matrix?: MatrixConfig;
}

export interface MatrixConfig {
  enabled: boolean;
  strategy?: "default";
  baseUrl: string;
  password: string;
  userId: string;
  room: string;
  notifyRestarts?: boolean;
}

export interface NewPayoutData {
  claimer: string;
  alias: string;
  networkId: string;
  address: string;
  eras: string;
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

