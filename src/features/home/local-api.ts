import { hasUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import type { BackofficeStateUpdater } from "@/application/api/local-state"
import type { BackofficeState } from "@/application/state/model"
import { uiResourceKeys } from "@/config/menu-registry"
import { entityIdSchema } from "@/domain/common"
import type { HomeApi } from "@/features/home/api"

export function createLocalHomeApi(
  state: BackofficeState,
  updateState: BackofficeStateUpdater,
): HomeApi {
  return {
    markNotificationRead: async (notificationId, requesterId) => {
      await Promise.resolve()
      if (
        !entityIdSchema.safeParse(notificationId).success ||
        !entityIdSchema.safeParse(requesterId).success
      ) {
        return { ok: false, error: "invalid-input" }
      }
      const notification = state.notifications.find(
        (item) => item.id === notificationId,
      )
      if (!notification) {
        return { ok: false, error: "notification-not-found" }
      }
      if (
        notification.userId !== requesterId ||
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.home.overview.actions.markNotificationRead,
        )
      ) {
        return { ok: false, error: "notification-operation-forbidden" }
      }
      if (notification.readAt) return { ok: true, value: notification }

      const updated = { ...notification, readAt: new Date().toISOString() }
      updateState((current) => ({
        ...current,
        notifications: current.notifications.map((item) =>
          item.id === notificationId ? updated : item,
        ),
      }))
      return { ok: true, value: updated }
    },
  }
}
