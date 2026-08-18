import type { CommandResult } from "@/domain/common"
import type { UserNotification } from "@/application/state/model"

export interface HomeApi {
  markNotificationRead: (
    notificationId: string,
    requesterId: string,
  ) => Promise<CommandResult<UserNotification>>
}

export interface HomeApiClient {
  markNotificationRead: (request: {
    notificationId: string
    requesterId: string
  }) => Promise<CommandResult<UserNotification>>
}
