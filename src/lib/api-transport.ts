import type { z } from "zod"

export interface ApiTransport {
  request<TSchema extends z.ZodType>(
    request: {
      path: string
      init?: RequestInit
    },
    responseSchema: TSchema,
  ): Promise<z.output<TSchema>>
}

export class HttpResponseError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
  ) {
    super(`HTTP ${String(status)}: ${statusText || "Request failed"}`)
    this.name = "HttpResponseError"
  }
}

export class InvalidJsonError extends Error {
  constructor(cause: unknown) {
    super("The API response was not valid JSON.", { cause })
    this.name = "InvalidJsonError"
  }
}

export class InvalidResponseError extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    super("The API response did not match the expected schema.")
    this.name = "InvalidResponseError"
  }
}

export class FetchApiTransport implements ApiTransport {
  constructor(
    private readonly baseUrl = "",
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async request<TSchema extends z.ZodType>(
    request: { path: string; init?: RequestInit },
    responseSchema: TSchema,
  ): Promise<z.output<TSchema>> {
    const url = this.baseUrl
      ? new URL(request.path, this.baseUrl)
      : request.path
    const response = await this.fetcher.call(globalThis, url, request.init)

    if (!response.ok) {
      throw new HttpResponseError(response.status, response.statusText)
    }

    let body: unknown
    try {
      body = await response.json()
    } catch (error) {
      throw new InvalidJsonError(error)
    }

    const result = responseSchema.safeParse(body)
    if (!result.success) {
      throw new InvalidResponseError(result.error.issues)
    }

    return result.data
  }
}
