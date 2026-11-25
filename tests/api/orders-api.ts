import type { APIRequestContext, APIResponse } from "@playwright/test";
import type { OrderPayload } from "./order-payload";

type RequestHeaders = Record<string, string>;

export class OrdersApi {
  constructor(private readonly api: APIRequestContext) {}

  create(headers: RequestHeaders, payload: OrderPayload): Promise<APIResponse> {
    return this.api.post("/api/shop/orders", { headers, data: payload });
  }

  list(headers?: RequestHeaders): Promise<APIResponse> {
    return this.api.get("/api/shop/orders", { headers });
  }

  get(orderId: string, headers?: RequestHeaders): Promise<APIResponse> {
    return this.api.get(`/api/shop/orders/${encodeURIComponent(orderId)}`, {
      headers,
    });
  }

  cancel(orderId: string, headers?: RequestHeaders): Promise<APIResponse> {
    return this.api.post(
      `/api/shop/orders/${encodeURIComponent(orderId)}/cancel`,
      { headers },
    );
  }
}
