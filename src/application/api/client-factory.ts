import type {
  BackofficeApiClientFactory,
  BackofficeBootstrapClient,
} from "@/application/api/api-client"
import { createMockBackofficeApiClient } from "@/application/api/mock-api-client"

/** 실제 API 도입 시 교체하는 애플리케이션 조합 지점이다. */
export const createBackofficeApiClient: BackofficeApiClientFactory = (
  options,
) => createMockBackofficeApiClient(options)

export async function createBackofficeBootstrapClient(
  includeLocalFixture: boolean,
): Promise<BackofficeBootstrapClient> {
  const { createLocalFixtureApiClient, createSystemFixtureApiClient } =
    await import("@/application/api/mock-fixture-api-client")
  return includeLocalFixture
    ? createLocalFixtureApiClient()
    : createSystemFixtureApiClient()
}
