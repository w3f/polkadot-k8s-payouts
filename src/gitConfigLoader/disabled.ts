import { GitConfigLoader } from "./gitConfigLoaderInterface";
import { Target } from "../types";

export class Disabled implements GitConfigLoader {
  async downloadAndLoad(): Promise<Array<Target>> {    
    return []
  }
}