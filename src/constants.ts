export const batchSize = 2
export const isDeepCheckEnabled = false
export const gracePeriod = {enabled: false, eras: 0}
export const runAttempts = 3
export const claimAttempts = 3
export const storeDir = "./store"
export enum MonitoringConfigVersion {
  V1 = "v1",
  V2 = "v2"
}