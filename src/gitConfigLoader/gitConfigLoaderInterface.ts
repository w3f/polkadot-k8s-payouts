import { MonitoringConfigVersion } from "../constants";
import { Target } from "../types";

export interface GitConfigLoader {
  downloadAndLoad(configVersion?: MonitoringConfigVersion): Promise<Array<Target>>;
}