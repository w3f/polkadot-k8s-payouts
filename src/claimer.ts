import { ClaimerInputConfig, Target, GracePeriod, ValidatorInfo, ValidatorsMap, ClaimPool } from './types';
import { getActiveEraIndex, initKey, setDifference } from './utils';
import { Logger, LoggerSingleton } from './logger';
import { ApiPromise, Keyring } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import waitUntil from 'async-wait-until';
import { BN } from 'bn.js';
import { batchSize, claimAttempts, gracePeriod, isDeepCheckEnabled } from './constants';
import { DeriveOwnExposure } from '@polkadot/api-derive/types';

export class Claimer {
    private isDeepCheckEnabled = isDeepCheckEnabled
    private gracePeriod: GracePeriod = gracePeriod;
    private batchSize: number = batchSize;
    private targets: Set<Target> = new Set<Target>();
    private readonly logger: Logger = LoggerSingleton.getInstance()
    private currentEraIndex: number;
    private lastRewardMax: number;

    private isFullSuccess = true;

    constructor(
        private readonly cfg: ClaimerInputConfig,
        private readonly api: ApiPromise) {
        cfg.targets.forEach(target=>this.targets.add(target))
        this.isDeepCheckEnabled = cfg.deepCheck.enabled
        this.gracePeriod = cfg.claim.gracePeriod
        this.batchSize = cfg.claim.batchSize
    }

    async run(): Promise<boolean> {
        await this.initInstanceVariables()

        //filter targets
        this.logger.info("filtering targets...")
        await this.filterTargets()

        //gather info
        console.time('build validators map');
        this.logger.info(`gathering chain data for ${this.targets.size} targets...`)
        const validatorsMap = await this.gatherValidatorsMap(Array.from(this.targets))
        console.timeEnd('build validators map');

        //claim
        console.time('claim');
        if(this.cfg.claim.enabled) {
          this.logger.info(`Processing claims...`)
          const keyPair: KeyringPair = initKey(this.cfg.claim.claimerKeystore.filePath,this.cfg.claim.claimerKeystore.passwordPath);

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

        return this.isFullSuccess;
    }

    private async initInstanceVariables(): Promise<void>{
      this.currentEraIndex = await getActiveEraIndex(this.api);
      this.lastRewardMax = Number(this.api.consts.staking.historyDepth?.toString())
      if(!this.lastRewardMax) this.lastRewardMax = 84 //Polkadot runtime is not ready for this call
    }

    private async filterTargets(): Promise<void> {
      const bonded = await this.api.query.staking.bonded.multi(Array.from(this.targets).map(target=>target.validatorAddress))
      Array.from(this.targets).forEach((target,index) => {
        if(!bonded[index].isSome){
          this.logger.warn(`${target.alias} (${target.validatorAddress}) cannot be processed, it's not bonded`)
          this.targets.delete(target)
        }
      })

      const chain = (await this.api.rpc.system.chain()).toHuman()
      const keyring = new Keyring();
      chain.toLowerCase() == "kusama" ? keyring.setSS58Format(2) : keyring.setSS58Format(0) //0 Polkadot, 2 Kusama
      Array.from(this.targets).forEach((target,index) => {
        const keypair = keyring.addFromAddress(target.validatorAddress)
        target.validatorAddress = keypair.address //conversion
      })
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
      if ( ledger.legacyClaimedRewards.length == 0 ) {
          lastReward = this.lastRewardMax
      } else {
          lastReward = ledger.legacyClaimedRewards.pop().toNumber();
      }
  
      return lastReward
    }


    private async gatherUnclaimedInfo(validatorAddress: string, validatorInfo: ValidatorInfo): Promise<number[]> {
      
      const ownRewardsIdx: Set<number> = new Set<number>
      const exposure: DeriveOwnExposure[] = await this.api.derive.staking.ownExposures(validatorAddress)
      exposure.forEach(e=>{
        if(e.exposure.total.toBn().gt(new BN(0))) ownRewardsIdx.add(e.era.toNumber()) //legacy
        if(e.exposureMeta?.value.total?.toBn().gt(new BN(0))) ownRewardsIdx.add(e.era.toNumber()) //new
      })

      const claimedIdx: Set<number> = new Set<number>
      const stakingQuey = await this.api.derive.staking.query(validatorAddress,{withLedger:true, withClaimedRewardsEras: true})
      stakingQuey.stakingLedger.legacyClaimedRewards.forEach(r=>claimedIdx.add(r.toNumber()))
      stakingQuey.claimedRewardsEras.forEach(r=>claimedIdx.add(r.toNumber()))

      const unclaimed: number[] = Array.from(setDifference(ownRewardsIdx,claimedIdx))
      this.logger.debug(unclaimed.toString())

      //bugFix: https://github.com/polkadot-js/api/issues/5859
      //temporary solution
      const unclaimedFixed = unclaimed.filter(x=>x>6513)

      validatorInfo.unclaimedPayouts=unclaimedFixed
      return unclaimedFixed    
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
      let leftAttempts = claimAttempts;
      while (claimPool.length > 0 && leftAttempts > 0) {
          
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
                    .signAndSend(keyPair, ({ status, events, dispatchError }) => {
                      if (dispatchError) {
                        let error = ""
                        if (dispatchError.isModule) {
                          // for module errors, we have the section indexed, lookup
                          const decoded = this.api.registry.findMetaError(dispatchError.asModule);
                          const { docs, name, section } = decoded;
                  
                          error = `${section}.${name}: ${docs.join(' ')}`
                        } else {
                          // Other, CannotLookup, BadOrigin, no extra info
                          error = dispatchError.toString()
                        }
                        throw new Error(error);
                      } 
                      
                      if (status.isInBlock) {
                        // console.log(`Transaction included at blockHash ${status.asInBlock}`);
                      } else if (status.isFinalized) {
                        // console.log(`Transaction finalized at blockHash ${status.asFinalized}`);
                        currentTxDone = true
                        unsub();
                      }
                    });
              }
              else{
                currentTxDone = true
              }
          } catch (e) {
              this.logger.error(`Could not perform one of the claims...: ${e}`);
              this.isFullSuccess = false;
              return
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
              this.logger.error(`tx failed: ${error}`);
              this.isFullSuccess = false;   
              leftAttempts--
          }
      }
      this.logger.info(`Claimed ${totClaimed} payouts`);
    }

}
