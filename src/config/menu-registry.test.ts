import { describe, expect, it } from "vitest"

import * as menuRegistryModule from "@/config/menu-registry"
import {
  menuDefinitions,
  menuViewDefinitions,
  uiResourceKeys,
  uiResourceManifest,
  uiResourceRegistry,
} from "@/config/menu-registry"

const viewNames: Record<string, string> = {
  overview: "개요",
  list: "목록",
  detail: "상세",
  requestDetail: "요청 상세",
  create: "생성",
  update: "수정",
  request: "요청",
  replaceRequest: "교체 요청",
  disposeRequest: "폐기 요청",
  lifecycleSettings: "수명 주기 설정",
  sync: "동기화",
  import: "가져오기",
}

describe("UI resource registry SSOT", () => {
  it("derives menu and view definitions from the registry", () => {
    const registryEntries = Object.entries(uiResourceRegistry)

    expect(menuDefinitions).toEqual(
      registryEntries.map(([id, menu]) => ({
        id,
        href: menu.href,
        defaultView: menu.defaultView,
        section: menu.section,
      })),
    )
    expect(menuViewDefinitions).toEqual(
      registryEntries.flatMap(([menuId, menu]) =>
        Object.keys(menu.views).map((view) => ({ menuId, view })),
      ),
    )
    expect(menuRegistryModule).not.toHaveProperty("menuFeatureDefinitions")
    expect(menuRegistryModule).not.toHaveProperty("getMenuFeatureResourceKey")
  })

  it("derives the complete typed key tree from registry property names", () => {
    const expectedKeys = Object.fromEntries(
      Object.entries(uiResourceRegistry).map(([menuId, menu]) => [
        menuId,
        {
          key: menuId,
          ...Object.fromEntries(
            Object.entries(menu.views).map(([viewId, view]) => {
              const viewKey = `${menuId}:${viewId}`
              return [
                viewId,
                {
                  key: viewKey,
                  actions: Object.fromEntries(
                    Object.keys(view.actions).map((action) => [
                      action,
                      `${viewKey}:${action}`,
                    ]),
                  ),
                },
              ]
            }),
          ),
        },
      ]),
    )

    expect(uiResourceKeys).toEqual(expectedKeys)
  })

  it("derives every manifest resource and its parent from the registry", () => {
    const registryEntries = Object.entries(uiResourceRegistry)
    const expectedMenus = registryEntries.map(([menuId, menu]) => ({
      key: menuId,
      parentKey: null,
      type: "menu",
      name: menu.name,
      description: `${menu.name} 메뉴의 최상위 UI 리소스입니다.`,
    }))
    const expectedViews = registryEntries.flatMap(([menuId, menu]) =>
      Object.keys(menu.views).map((viewId) => {
        const viewName = viewNames[viewId]
        if (!viewName) throw new Error(`Unknown menu view: ${viewId}`)
        return {
          key: `${menuId}:${viewId}`,
          parentKey: menuId,
          type: "view",
          name: `${menu.name} ${viewName}`,
          description: `${menu.name} 메뉴의 ${viewName} 화면입니다.`,
        }
      }),
    )
    const expectedActions = registryEntries.flatMap(([menuId, menu]) =>
      Object.entries(menu.views).flatMap(([viewId, view]) => {
        const viewKey = `${menuId}:${viewId}`
        return Object.entries(view.actions).map(([action, actionName]) => ({
          key: `${viewKey}:${action}`,
          parentKey: viewKey,
          type: "action",
          name: String(actionName),
          description: `${menu.name} 메뉴의 ${String(actionName)} UI 기능입니다.`,
        }))
      }),
    )

    expect(uiResourceManifest.resources).toEqual([
      ...expectedMenus,
      ...expectedViews,
      ...expectedActions,
    ])
  })

  it("keeps URL paths kebab-case and resource depths lowerCamelCase", () => {
    const urlPathPattern =
      /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/
    const resourceKeyPattern =
      /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*(?::[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*)*$/

    for (const menu of Object.values(uiResourceRegistry)) {
      expect(menu.href === "/" || urlPathPattern.test(menu.href)).toBe(true)
    }
    for (const resource of uiResourceManifest.resources) {
      expect(resourceKeyPattern.test(resource.key)).toBe(true)
      if (resource.parentKey !== null) {
        expect(resourceKeyPattern.test(resource.parentKey)).toBe(true)
      }
    }
  })
})
