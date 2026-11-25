export const SHOP_DEMO_ACCOUNT = {
  email: "alex@example.com",
  password: "Password1",
} as const;

export const TEST_CARDS = {
  success: "4111 1111 1111 1111",
  declined: "4000 0000 0000 0002",
  insufficientFunds: "4000 0000 0000 9995",
  expired: "4000 0000 0000 0069",
  threeDS: "4000 0000 0000 3220",
  providerTimeout: "4000 0000 0000 0119",
  invalid: "123",
  unlisted: "4111 1111 1111 1112",
} as const;

export const ORDER_DELIVERY_OPTIONS = [
  "standard",
  "express",
  "pickup",
] as const;

export const ORDER_ADDRESS = {
  fullName: "QA Automation",
  street: "1 Test Lane",
  city: "Warsaw",
  postcode: "00-001",
  country: "Poland",
} as const;

export const TEST_CARD_DETAILS = {
  expiry: "12/30",
  cvc: "123",
  name: "QA Automation",
} as const;
