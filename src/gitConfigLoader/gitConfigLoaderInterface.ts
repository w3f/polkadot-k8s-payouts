import { Target } from "../types";

export interface GitConfigLoader {
  downloadAndLoad(): Promise<Array<Target>>;
}