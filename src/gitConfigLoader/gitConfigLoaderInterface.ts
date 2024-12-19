import { ConfigVersion } from "../constants";
import { Target } from "../types";

export interface GitConfigLoader {
  downloadAndLoad(configVersion?: ConfigVersion): Promise<Array<Target>>;
}