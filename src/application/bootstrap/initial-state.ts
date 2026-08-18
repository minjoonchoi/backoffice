import type { BackofficeBootstrapClient } from "@/application/api/api-client"
import { createBackofficeBootstrapClient } from "@/application/api/client-factory"

export const localBackofficeDataSource = "local-mock"

export async function createBackofficeQueryClient(
  environment: string | undefined,
  dataSource: string | undefined,
): Promise<BackofficeBootstrapClient> {
  if (dataSource !== undefined && dataSource !== localBackofficeDataSource) {
    throw new Error(`Unsupported backoffice data source: ${dataSource}`)
  }
  if (dataSource !== undefined && environment !== "development") {
    throw new Error("Local backoffice mock data is restricted to development.")
  }
  return createBackofficeBootstrapClient(dataSource !== undefined)
}
