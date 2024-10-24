import { NewPayoutData } from "../types";

export interface Notifier {
  newPayout(data: NewPayoutData): Promise<boolean>;
}