import type { BackofficeState } from "@/application/state/model"
import type {
  AccessPolicyApi,
  AccessPolicyApiClient,
  ApprovalDocumentApi,
  ApprovalDocumentApiClient,
} from "@/features/access-policies/api"
import type {
  CredentialApi,
  CredentialApiClient,
} from "@/features/credentials/api"
import type { IamApi, IamApiClient } from "@/features/iam/api"
import type { HomeApi, HomeApiClient } from "@/features/home/api"
import type {
  RequestTemplateApi,
  RequestTemplateApiClient,
} from "@/features/request-templates/api"
import type {
  ServiceCatalogApi,
  ServiceCatalogApiClient,
} from "@/features/service-catalog/api"
import type {
  UiResourceApi,
  UiResourceApiClient,
} from "@/features/ui-resources/api"

/** 화면이 사용하는 feature command facade의 조합이다. */
export type BackofficeCommands = HomeApi &
  IamApi &
  RequestTemplateApi &
  AccessPolicyApi &
  ApprovalDocumentApi &
  CredentialApi &
  ServiceCatalogApi &
  UiResourceApi

export type GetBackofficeSnapshotRequest = Record<string, never>

export type GetBackofficeSnapshotResponse = {
  data: BackofficeState
}

/**
 * 백오피스 데이터 접근의 교체 경계다. 각 feature가 소유한 API 계약을 조합하고
 * mock과 실제 HTTP 구현체의 세부사항을 React 컴포넌트에 노출하지 않는다.
 */
export interface BackofficeApiClient {
  getSnapshot: (
    request: GetBackofficeSnapshotRequest,
  ) => Promise<GetBackofficeSnapshotResponse>
  home: HomeApiClient
  iam: IamApiClient
  requestTemplates: RequestTemplateApiClient
  accessPolicies: AccessPolicyApiClient
  approvalDocuments: ApprovalDocumentApiClient
  credentials: CredentialApiClient
  serviceCatalog: ServiceCatalogApiClient
  uiResources: UiResourceApiClient
}

export type BackofficeApiClientFactory = (options: {
  initialState: BackofficeState
  getActorUserId?: () => string | null
}) => BackofficeApiClient

export type BackofficeSnapshotClient = Pick<BackofficeApiClient, "getSnapshot">

export type LocalSessionSeed = Readonly<{
  defaultUserId: string
}>

/** 서버 bootstrap에서만 사용하는 조회 경계다. 로컬 session seed도 fixture 대신 client가 제공한다. */
export interface BackofficeBootstrapClient extends BackofficeSnapshotClient {
  getLocalSessionSeed: () => Promise<LocalSessionSeed | null>
}
