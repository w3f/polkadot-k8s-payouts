import { Logger, LoggerSingleton } from '../logger';

import {
    NewPayoutData,
} from '../types';
import { Notifier } from './INotifier';


export class Disabled implements Notifier {
    private readonly logger: Logger = LoggerSingleton.getInstance()
    newPayout = async (_data: NewPayoutData): Promise<boolean> =>{
        this.logger.info("Notifier disabled...")
        return true
    }
}
