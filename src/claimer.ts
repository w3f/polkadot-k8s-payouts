import { ClaimerInputConfig, Target, GracePeriod, ValidatorInfo, ValidatorsMap, ClaimPool } from './types';
import { getActiveEraIndex, initKey } from './utils';
import { Logger, LoggerSingleton } from './logger';
import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import waitUntil from 'async-wait-until';
import { BN } from 'bn.js';
import { batchSize, gracePeriod, isDeepCheckEnabled } from './constants';

export class Claimer {
    private isDeepCheckEnabled = isDeepCheckEnabled
    private gracePeriod: GracePeriod = gracePeriod;
    private batchSize: number = batchSize;
    private targets: Set<Target> = new Set<Target>();
    private readonly logger: Logger = LoggerSingleton.getInstance()
    private currentEraIndex: number;
    private lastRewardMax: number;

    constructor(
        private readonly cfg: ClaimerInputConfig,
        private readonly api: ApiPromise) {
        cfg.targets.forEach(target=>this.targets.add(target))
        this.isDeepCheckEnabled = cfg.deepCheck.enabled
        this.gracePeriod = cfg.claim.gracePeriod
        this.batchSize = cfg.claim.batchSize
    }

    async run(): Promise<void> {
        await this.initInstanceVariables()

        //gather info
        console.time('build validators map');
        this.logger.info("gathering chain data...")
        const validatorsMap = await this.gatherValidatorsMap(Array.from(this.targets))
        console.timeEnd('build validators map');

        //claim
        console.time('claim');
        if(this.cfg.claim.enabled) {
          this.logger.info(`Processing claims...`)
          const keyPair = initKey(this.cfg.claim.claimerKeystore.filePath,this.cfg.claim.claimerKeystore.passwordPath);

          const claimPool = await this.buildClaimPool(validatorsMap)
          await this.claim(keyPair,claimPool,validatorsMap)
        }
        console.timeEnd('claim');

        //recap
        this.logger.info(`***** RECAP *****`)
        for (const [address, validatorInfo] of validatorsMap) {
          this.logger.info(`${validatorInfo.alias}|${address}`)
          validatorInfo.unclaimedPayouts.length>0 ? this.logger.info(`To be claimed Payouts: ${validatorInfo.unclaimedPayouts.toString()}`) : {}
          validatorInfo.claimedPayouts.length>0 ? this.logger.info(`Claimed Payouts: ${validatorInfo.claimedPayouts.toString()}`) : {}
          this.logger.info(`**********`)
        }
    }

    private async initInstanceVariables(): Promise<void>{
      this.currentEraIndex = await getActiveEraIndex(this.api);
      this.lastRewardMax = Number(this.api.consts.staking.historyDepth?.toString())
      if(!this.lastRewardMax) this.lastRewardMax = 84 //Polkadot runtime is not ready for this call
    }
    
    private async gatherValidatorsMap(accounts: Target[]): Promise<ValidatorsMap> {

      const validatorsMap: ValidatorsMap = new Map<string,ValidatorInfo>()
      accounts.forEach(account=>{
        validatorsMap.set(account.validatorAddress,{lastReward:null,alias:account.alias,unclaimedPayouts:[],claimedPayouts:[]})
      })
  
      const validators = (await this.api.derive.staking.accounts(accounts.map(account=>account.validatorAddress),{withLedger:true})).filter(validator=>validatorsMap.has(validator.accountId.toHuman()))

      for (const validator of validators) {
        const key = validator.accountId.toHuman()
        const ledger = validator.stakingLedger
        if (!ledger) {
          throw new Error(`Could not get ledger for ${key}`);
        }      
        const lastReward: number = await this.getLastReward(key)
        validatorsMap.set(key,{...validatorsMap.get(key),lastReward})
        
      }
  
      for (const [address, validatorInfo] of validatorsMap) {
        await this.gatherUnclaimedInfo(address,validatorInfo)
      }
  
      return validatorsMap
    }


    private async getLastReward(validatorAddress: string): Promise<number> {

      if(this.isDeepCheckEnabled) return this.lastRewardMax

      const ledger = (await this.api.derive.staking.account(validatorAddress)).stakingLedger
      if (!ledger) {
          throw new Error(`Could not get ledger for ${validatorAddress}`);
      }
      let lastReward: number;
      if ( ledger.claimedRewards.length == 0 ) {
          lastReward = this.lastRewardMax
      } else {
          lastReward = ledger.claimedRewards.pop().toNumber();
      }
  
      return lastReward
    }


    private async gatherUnclaimedInfo(validatorAddress: string, validatorInfo: ValidatorInfo): Promise<number[]> {

      const lastReward = validatorInfo.lastReward
  
      const numOfPotentialUnclaimedPayouts = this.currentEraIndex - lastReward - 1;
      const unclaimedPayouts: number[] = []
      for ( let i = 1; i <= numOfPotentialUnclaimedPayouts; i++) {
        const idx = lastReward + i;
        const exposure = await this.api.query.staking.erasStakers(idx, validatorAddress);
        if (exposure.total.toBn().gt(new BN(0))) {
          unclaimedPayouts.push(idx)
        }
      }
      validatorInfo.unclaimedPayouts=unclaimedPayouts
  
      return unclaimedPayouts    
    }

    private async buildClaimPool(validatorsMap: ValidatorsMap): Promise<ClaimPool[]> {

      const claimPool: {address: string; eraIndex: number}[] = []
      for (const [address, validatorInfo] of validatorsMap) {
        if(validatorInfo.unclaimedPayouts.length>0){
          const todo = validatorInfo.unclaimedPayouts.map(eraIndex=>{return {address:address,eraIndex:eraIndex}}).filter(p=>!this.gracePeriod.enabled || (  this.currentEraIndex - p.eraIndex > this.gracePeriod.eras))
          claimPool.push(...todo)
        }
      }

      return claimPool
    }

    private async claim(keyPair: KeyringPair, claimPool: ClaimPool[], validatorsMap: ValidatorsMap): Promise<void> {

      this.logger.info(`${claimPool.length} claims to be processed`)

      let currentTxDone = true
      let totClaimed = 0
      while (claimPool.length > 0) {
          
          const payoutCalls = [];
          const candidates = claimPool.slice(0,this.batchSize) //end not included

          for (const candidate of candidates) {
            this.logger.info(`Adding claim for ${validatorsMap.get(candidate.address).alias}|${candidate.address}, era ${candidate.eraIndex}`);
            payoutCalls.push(this.api.tx.staking.payoutStakers(candidate.address, candidate.eraIndex));
          }

          currentTxDone = false;
          try {
              if (payoutCalls.length > 0) {
                const unsub = await this.api.tx.utility
                    .batchAll(payoutCalls)
                    .signAndSend(keyPair, result => {
                      // console.log(`Current status is ${result.status}`);
                      if (result.status.isInBlock) {
                        // console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
                      } else if (result.status.isFinalized) {
                        // console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
                        currentTxDone = true
                        unsub();
                      }
                    });
              }
              else{
                currentTxDone = true
              }
          } catch (e) {
              this.logger.error(`Could not perform one of the claims: ${e}`);
          }
          try {
              await waitUntil(() => currentTxDone, 60000, 500);
              claimPool.splice(0,candidates.length)
              for (const candidate of candidates) {
                validatorsMap.get(candidate.address).claimedPayouts.push(candidate.eraIndex)
              }
              totClaimed += candidates.length
              this.logger.info(`Claimed...`);
          } catch (error) {
              this.logger.info(`tx failed: ${error}`);
          }
      }
      this.logger.info(`Claimed ${totClaimed} payouts`);
    }

}
