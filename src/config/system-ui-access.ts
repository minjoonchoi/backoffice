import { getMenuUiResourceKeys, uiResourceKeys } from "@/config/menu-registry"

export const uiResourceManagerUiResourceKeys = [
  ...getMenuUiResourceKeys([uiResourceKeys.uiResources.key]),
  uiResourceKeys.uiResources.list.actions.importUiResources,
  uiResourceKeys.uiResources.list.actions.changeUiResourceStatus,
  uiResourceKeys.uiResources.list.actions.deleteUiResources,
  uiResourceKeys.uiResources.list.actions.compareUiResourceSyncs,
  uiResourceKeys.uiResources.list.actions.restoreUiResourceSync,
]
