import { InputConfig } from "../types";
import { Notifier } from "./INotifier";
import { Disabled } from "./disabled";
import { Matrix } from "./matrix";

export class NotifierFactory {
  constructor(private readonly cfg: InputConfig){}
  makeNotifier = async (): Promise<Notifier> => {

    if(!this.cfg.matrix?.enabled)
      return new Disabled()

    const matrix = new Matrix(this.cfg)
    await matrix.start()
    return matrix  
  }
}