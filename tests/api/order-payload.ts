import { ORDER_ADDRESS, TEST_CARDS, TEST_CARD_DETAILS } from "../constants";

export type OrderPayload = {
  email: string;
  address: {
    fullName: string;
    street: string;
    city: string;
    postcode: string;
    country: string;
  };
  delivery: string;
  card: {
    number: string;
    expiry: string;
    cvc: string;
    name: string;
  };
  threeDS?: "approved" | "rejected";
};

type OrderPayloadOptions = {
  cardNumber?: string;
  delivery?: string;
  threeDS?: "approved" | "rejected";
};

export function buildOrderPayload(
  email: string,
  options: OrderPayloadOptions = {},
): OrderPayload {
  const payload: OrderPayload = {
    email,
    address: { ...ORDER_ADDRESS },
    delivery: options.delivery ?? "standard",
    card: {
      number: options.cardNumber ?? TEST_CARDS.success,
      ...TEST_CARD_DETAILS,
    },
  };
  if (options.threeDS !== undefined) {
    payload.threeDS = options.threeDS;
  }
  return payload;
}
