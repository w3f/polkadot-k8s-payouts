import { ApiPromise, Keyring } from "@polkadot/api"
import fs from 'fs'
import { KeyringPair, KeyringPair$Json } from '@polkadot/keyring/types';
import { LoggerSingleton } from './logger';

const logger = LoggerSingleton.getInstance()

export const getErrorMessage = (error: unknown): string => {
  let errorString: string
  if (typeof error === "string") {
    errorString = error
  } else if (error instanceof Error) {
    errorString = error.message 
  }
  return errorString
}

export const delay = (ms: number): Promise<void> =>{
  return new Promise( resolve => setTimeout(resolve, ms) );
}

export const getActiveEraIndex = async (api: ApiPromise): Promise<number> => {
  return (await api.query.staking.activeEra()).toJSON()['index']; 
}

export const initKey = (keystoreFilePath: string, passwordFilePath): any =>{ //should be KeyringPair but it is not compiling
  const keyring = new Keyring({ type: 'sr25519' });
  const keyJson = JSON.parse(fs.readFileSync(keystoreFilePath, { encoding: 'utf-8' })) as KeyringPair$Json;
  const passwordContent = fs.readFileSync(passwordFilePath, { encoding: 'utf-8' });
  const keyPair = keyring.addFromJson(keyJson);
  keyPair.decodePkcs8(passwordContent)

  logger.debug(`read account with address: ${keyring.pairs[0].toJson().address}`)
  logger.debug(`is locked: ${keyPair.isLocked}`)

  if(keyPair.isLocked){
    logger.error(`problem unlocking the wallet, exiting ...`)
    process.exit(1)
  } else return keyPair
}

export const setDifference = <T>(setA: Set<T>, setB: Set<T>): Set<T> => {
  return new Set([...setA].filter(x=>!setB.has(x)))
}