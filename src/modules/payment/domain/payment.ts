export const PAYMENT_STATUS_VALUES = ["SUCCEEDED"] as const;
export const SUCCESSFUL_PAYMENT_STATUS = PAYMENT_STATUS_VALUES[0];
export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];
