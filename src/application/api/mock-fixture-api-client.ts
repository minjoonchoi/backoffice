import type { BackofficeBootstrapClient } from "@/application/api/api-client"
import { createMockBackofficeApiClient } from "@/application/api/mock-api-client"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { initialBackofficeState } from "@/mocks/system-fixture"

export function createSystemFixtureApiClient(): BackofficeBootstrapClient {
  const client = createMockBackofficeApiClient({
    initialState: initialBackofficeState,
  })
  return {
    getSnapshot: client.getSnapshot,
    getLocalSessionSeed: () => Promise.resolve(null),
  }
}

/** 로컬 fixture와 그 session seed를 애플리케이션 밖에 노출하지 않는다. */
export function createLocalFixtureApiClient(): BackofficeBootstrapClient {
  const client = createMockBackofficeApiClient({ initialState: localFixture })
  return {
    getSnapshot: client.getSnapshot,
    getLocalSessionSeed: () =>
      Promise.resolve({ defaultUserId: localDefaultUserId }),
  }
}
