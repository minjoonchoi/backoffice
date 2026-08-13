export type MenuSection =
  "common" | "directory" | "serviceCatalog" | "uiCatalog" | "systemManagement"

export type MenuView = "overview" | "list" | "detail" | "requestDetail"

type UiResourceRegistryShape = Record<
  string,
  {
    href: "/" | `/${string}`
    defaultView: MenuView
    section: MenuSection
    name: string
    views: Partial<
      Record<
        MenuView,
        {
          actions: Record<string, string>
        }
      >
    >
  }
>

/**
 * Backoffice UI 리소스의 단일 코드 원천입니다.
 *
 * 객체의 lowerCamelCase 프로퍼티 경로가 UI 리소스 key가 되고, href는 URL
 * 규칙과 독립적으로 유지됩니다. 메뉴·화면·액션 목록과 manifest는 모두 이
 * 레지스트리에서 파생합니다.
 */
export const uiResourceRegistry = {
  home: {
    href: "/",
    defaultView: "overview",
    section: "common",
    name: "홈",
    views: {
      overview: { actions: { markNotificationRead: "알림 읽음 처리" } },
    },
  },
  users: {
    href: "/users",
    defaultView: "list",
    section: "directory",
    name: "사용자",
    views: {
      list: { actions: { createUser: "사용자 등록" } },
      detail: {
        actions: {
          assignUserOrganization: "사용자 조직 연결",
          assignUserRole: "사용자 역할 부여",
          assignUserGroup: "사용자 그룹 연결",
          changeEmploymentStatus: "재직 상태 변경",
        },
      },
    },
  },
  organizations: {
    href: "/organizations",
    defaultView: "list",
    section: "directory",
    name: "조직",
    views: {
      list: { actions: { createOrganization: "조직 생성" } },
      detail: {
        actions: {
          updateOrganization: "조직 수정",
          addOrganizationUser: "조직 사용자 추가",
          assignOrganizationRole: "조직 역할 부여",
        },
      },
    },
  },
  roles: {
    href: "/roles",
    defaultView: "list",
    section: "directory",
    name: "역할",
    views: {
      list: { actions: { createRole: "역할 생성" } },
      detail: {
        actions: {
          assignRoleUser: "역할 사용자 추가",
          assignRoleOrganization: "역할 조직 추가",
          assignRolePolicy: "역할 정책 부여",
          updateRole: "역할 수정",
          deleteRole: "역할 삭제",
        },
      },
    },
  },
  groups: {
    href: "/groups",
    defaultView: "list",
    section: "directory",
    name: "그룹",
    views: {
      list: { actions: { createGroup: "그룹 생성" } },
      detail: {
        actions: {
          assignGroupUser: "그룹 사용자 추가",
          assignGroupPolicy: "그룹 정책 부여",
          updateGroup: "그룹 수정",
          deleteGroup: "그룹 삭제",
        },
      },
    },
  },
  approvalLines: {
    href: "/approval-lines",
    defaultView: "list",
    section: "systemManagement",
    name: "요청 템플릿",
    views: {
      list: {
        actions: {
          createRequestTemplate: "요청 템플릿 생성",
          changeRequestTemplateStatus: "요청 템플릿 상태 변경",
        },
      },
      detail: {
        actions: { updateRequestTemplate: "요청 템플릿 수정" },
      },
    },
  },
  approvalDocuments: {
    href: "/approval-documents",
    defaultView: "list",
    section: "common",
    name: "정책",
    views: {
      list: {
        actions: {
          createPolicy: "정책 생성",
          approveAccessRequest: "정책 부여 요청 승인",
        },
      },
      requestDetail: { actions: {} },
      detail: {
        actions: {
          updatePolicy: "정책 수정",
          deletePolicy: "정책 삭제",
        },
      },
    },
  },
  services: {
    href: "/services",
    defaultView: "list",
    section: "serviceCatalog",
    name: "서비스",
    views: {
      list: { actions: { createService: "서비스 등록" } },
      detail: {
        actions: {
          updateService: "서비스 수정",
          deleteService: "서비스 삭제",
        },
      },
    },
  },
  serviceEndpoints: {
    href: "/service-endpoints",
    defaultView: "list",
    section: "serviceCatalog",
    name: "엔드포인트",
    views: {
      list: { actions: { createEndpoint: "엔드포인트 등록" } },
      detail: {
        actions: {
          updateEndpoint: "엔드포인트 수정",
          deleteEndpoint: "엔드포인트 삭제",
        },
      },
    },
  },
  namespaces: {
    href: "/namespaces",
    defaultView: "list",
    section: "uiCatalog",
    name: "네임스페이스",
    views: {
      list: {
        actions: { createNamespace: "네임스페이스 생성" },
      },
    },
  },
  apiKeys: {
    href: "/api-keys",
    defaultView: "list",
    section: "common",
    name: "자격증명",
    views: {
      list: {
        actions: {
          approveCredentialRequest: "자격증명 요청 승인",
          registerCredential: "자격증명 등록",
        },
      },
      detail: { actions: {} },
    },
  },
  uiResources: {
    href: "/ui-resources",
    defaultView: "list",
    section: "uiCatalog",
    name: "UI 리소스",
    views: {
      list: {
        actions: {
          importUiResources: "UI 리소스 동기화",
          changeUiResourceStatus: "UI 리소스 상태 변경",
          deleteUiResources: "고아 UI 리소스 삭제",
        },
      },
    },
  },
} as const satisfies UiResourceRegistryShape

type UiResourceRegistry = typeof uiResourceRegistry

export type MenuKey = keyof UiResourceRegistry

type ViewForMenu<M extends MenuKey> = keyof UiResourceRegistry[M]["views"] &
  MenuView

type ActionForView<
  M extends MenuKey,
  V extends ViewForMenu<M>,
> = UiResourceRegistry[M]["views"][V] extends {
  actions: infer Actions
}
  ? keyof Actions & string
  : never

export type MenuDefinition = {
  id: MenuKey
  href: UiResourceRegistry[MenuKey]["href"]
  defaultView: UiResourceRegistry[MenuKey]["defaultView"]
  section: UiResourceRegistry[MenuKey]["section"]
}

export type MenuViewDefinition = {
  menuId: MenuKey
  view: MenuView
}

type ViewResourceKey = {
  [M in MenuKey]: `${M}:${ViewForMenu<M>}`
}[MenuKey]

type FeatureResourceKey = {
  [M in MenuKey]: {
    [V in ViewForMenu<M>]: `${M}:${V}:${ActionForView<M, V>}`
  }[ViewForMenu<M>]
}[MenuKey]

export type BackofficeUiResourceKey =
  MenuKey | ViewResourceKey | FeatureResourceKey

type UiResourceKeyTree = {
  [M in MenuKey]: {
    key: M
  } & {
    [V in ViewForMenu<M>]: {
      key: `${M}:${V}`
      actions: {
        [A in ActionForView<M, V>]: `${M}:${V}:${A}`
      }
    }
  }
}

type ObjectEntry<T extends object> = T extends object
  ? {
      [K in keyof T]: [K, T[K]]
    }[keyof T]
  : never

function entries<const T extends object>(value: T): ObjectEntry<T>[] {
  return Object.entries(value) as ObjectEntry<T>[]
}

export const menuDefinitions: MenuDefinition[] = entries(
  uiResourceRegistry,
).map(([id, definition]) => ({
  id,
  href: definition.href,
  defaultView: definition.defaultView,
  section: definition.section,
}))

export const menuViewDefinitions: MenuViewDefinition[] = entries(
  uiResourceRegistry,
).flatMap(([menuId, menu]) =>
  entries(menu.views).map(([viewId]) => ({ menuId, view: viewId })),
)

function createUiResourceKeys(): UiResourceKeyTree {
  const result: Record<string, unknown> = {}

  for (const [menuId, menu] of entries(uiResourceRegistry)) {
    const menuBranch: Record<string, unknown> = { key: menuId }
    for (const [viewId, view] of entries(menu.views)) {
      const viewKey = `${menuId}:${viewId}`
      const actions: Record<string, string> = {}
      for (const [action] of entries(view.actions)) {
        actions[action] = `${viewKey}:${action}`
      }
      menuBranch[viewId] = { key: viewKey, actions }
    }
    result[menuId] = menuBranch
  }

  return result as UiResourceKeyTree
}

export const uiResourceKeys = createUiResourceKeys()

export type UiResourceRegistryEntry = {
  key: string
  parentKey: string | null
  type: "menu" | "view" | "action" | "component"
  name: string
  description: string
}

const uiResourceViewNames: Record<MenuView, string> = {
  overview: "개요",
  list: "목록",
  detail: "상세",
  requestDetail: "요청 상세",
}

export const uiResourceManifest = {
  version: 1,
  namespaceKey: "backoffice",
  resources: [
    ...entries(uiResourceRegistry).map(
      ([menuId, menu]): UiResourceRegistryEntry => ({
        key: menuId,
        parentKey: null,
        type: "menu",
        name: menu.name,
        description: `${menu.name} 메뉴의 최상위 UI 리소스입니다.`,
      }),
    ),
    ...entries(uiResourceRegistry).flatMap(([menuId, menu]) =>
      entries(menu.views).map(([viewId]): UiResourceRegistryEntry => ({
        key: `${menuId}:${viewId}`,
        parentKey: menuId,
        type: "view",
        name: `${menu.name} ${uiResourceViewNames[viewId]}`,
        description: `${menu.name} 메뉴의 ${uiResourceViewNames[viewId]} 화면입니다.`,
      })),
    ),
    ...entries(uiResourceRegistry).flatMap(([menuId, menu]) =>
      entries(menu.views).flatMap(([viewId, view]) =>
        entries(view.actions).map(
          ([action, actionName]): UiResourceRegistryEntry => ({
            key: `${menuId}:${viewId}:${action}`,
            parentKey: `${menuId}:${viewId}`,
            type: "action",
            name: actionName,
            description: `${menu.name} 메뉴의 ${actionName} UI 기능입니다.`,
          }),
        ),
      ),
    ),
  ],
} satisfies {
  version: 1
  namespaceKey: string
  resources: UiResourceRegistryEntry[]
}

export function getMenuDefinition(menuId: MenuKey): MenuDefinition {
  const definition = menuDefinitions.find((item) => item.id === menuId)
  if (!definition) throw new Error(`Menu definition not found: ${menuId}`)
  return definition
}

export function getMenuViewResourceKey(
  menuId: MenuKey,
  viewId: MenuView,
): string {
  return `${menuId}:${viewId}`
}

export function getMenuUiResourceKeys(menuIds: readonly MenuKey[]): string[] {
  const menuIdSet = new Set(menuIds)
  return [
    ...menuDefinitions
      .filter((menu) => menuIdSet.has(menu.id))
      .map((menu) => menu.id),
    ...menuViewDefinitions
      .filter((view) => menuIdSet.has(view.menuId))
      .map((view) => getMenuViewResourceKey(view.menuId, view.view)),
  ]
}
