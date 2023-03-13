import { Client } from '../client';
import { Config } from '@w3f/config';

import { InputConfig, Target } from '../types';
import { LoggerSingleton } from '../logger';
import { Claimer } from '../claimer';
import { GitConfigLoaderFactory } from '../gitConfigLoader/gitConfigLoaderFactory';

const _loadConfig = async (config: any): Promise<InputConfig> =>{
    const cfg = new Config<InputConfig>().parse(config);
    const gitLoaders = new GitConfigLoaderFactory(cfg).makeGitConfigLoaders()

    const gitTargets: Array<Target> = []
    for (const l of gitLoaders) {
        const t = await l.downloadAndLoad()
        gitTargets.push(...t)
    }

    const seen = new Set();
    if(!cfg.targets) cfg.targets = []
    const filteredArr = [...cfg.targets,...gitTargets].filter(el=>{ //priority given to locals over downloaded ones
        const isDuplicate = seen.has(el.alias);
        seen.add(el.alias)
        return !isDuplicate
    })
    cfg.targets = filteredArr
    return cfg
}

export async function startAction(cmd): Promise<void> {
    const cfg = await _loadConfig(cmd.config)

    const logger = LoggerSingleton.getInstance(cfg.logLevel)
    logger.info(`loaded ${cfg.targets.length} targets`)

    const api = await new Client(cfg).connect()

    const claimer = new Claimer(cfg, api);

    try {
        await claimer.run();
        process.exit(0);
    } catch (e) {
        logger.error(`During claimer run: ${e.toString()}`);
        process.exit(-1);
    }
}
