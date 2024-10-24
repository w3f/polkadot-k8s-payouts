import { start, verifyRoom } from "./matrix-utils.js";
import { Logger, LoggerSingleton } from '../logger';
import {
    NewPayoutData,
    MatrixConfig,
    InputConfig
} from '../types';
import { Notifier } from './INotifier';
import { logger as mxLogger } from 'matrix-js-sdk/lib/logger';
import { RoomEvent, EventType, MatrixClient, ContentHelpers } from "matrix-js-sdk"

export class Matrix implements Notifier {

  private readonly logger: Logger = LoggerSingleton.getInstance()
  private room: string;
  private configMatrix: MatrixConfig;
  private credentials
  private client: MatrixClient | undefined;

  constructor(readonly config: InputConfig) {
    this.configMatrix = config.matrix
    this.room = this.configMatrix.room
    this.credentials = {
      "userId": this.configMatrix.userId,
      "password": this.configMatrix.password,
      "baseUrl": this.configMatrix.baseUrl
    }
    mxLogger.setDefaultLevel(mxLogger.levels.SILENT)
  }

  async start(): Promise<void> {
    this.client = await start(this.credentials);
    const client = this.client

    client.on(RoomEvent.Timeline, async(event, room) => {
      const type = event.getType() as EventType;

      if (![EventType.RoomMessage, EventType.RoomMessageEncrypted].includes(type)) {
        return;
      }

      if (room == null) {
        return;
      }

      if ([this.room].indexOf(room.roomId) === -1) {
        return;
      }

      if (!event.sender) {
        return;
      }

      await client.decryptEventIfNeeded(event);

      if (event.getType() === EventType.RoomMessage) {
        const content = event.getContent().body;
        this.logger.debug(content)
      }
    });

    for (const room of [this.room]) {
      await verifyRoom(client, room);
      await client.roomInitialSync(room, 20);
    }

    client.setGlobalErrorOnUnknownDevices(false)
    this.logger.info("Observer Bot (re)started");
    if (this.config.matrix.notifyRestarts ?? true) {
      await this.sendMessage("Observer Bot (re)started")
    }
  }

  newPayout = async (data: NewPayoutData): Promise<boolean> =>{ //TODO add referenda class
    const message = `(INFO): New Payout submitted.<br/>`
      + `- Account: ${data.alias} <br/>`
      + `- Address: ${data.address} <br/>`
      + `- Claimed eras: ${data.eras} <br/>`
      + `- Check <a href="https://${data.networkId}.subscan.io/account/${data.claimer}">Subscan</a> for details.`

    return await this.sendMessage(message);
  }

  sendMessage(msg: string): Promise<boolean> {
    const content = ContentHelpers.makeHtmlMessage(msg,msg)

    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        await this.client?.sendEvent(
          this.room,
          "m.room.message",
          content,
        );
        resolve(true)
      } catch (e) {
        this.logger.info(`{Matrix::error}`);
        this.logger.warn(String(e));
        reject(false)
      }
    });
  }
  
}
