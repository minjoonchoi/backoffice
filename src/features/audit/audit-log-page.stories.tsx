import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { BackofficeProvider } from "@/application/state/provider"
import { SessionAccessProvider } from "@/auth/session-access-provider"
import { AuditLogPage } from "@/features/audit/audit-log-page"
import type { AuditEvent } from "@/features/audit/model"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"

const policy = localFixture.accessPolicies[0]
if (!policy) throw new Error("Audit story policy fixture is missing")

const auditEvent: AuditEvent = {
  id: "a1000000-0000-4000-8000-000000000001",
  actorUserId: localDefaultUserId,
  resourceType: "access-policy",
  action: "updated",
  targetId: policy.id,
  targetName: policy.name,
  changes: [
    {
      field: "resources",
      before: "endpoint:previous",
      after: "endpoint:current",
    },
  ],
  impact: {
    permissionChangedUserIds: [localDefaultUserId],
    gainedPermissionCount: 1,
    lostPermissionCount: 1,
    relatedPolicyIds: [policy.id],
  },
  createdAt: "2026-08-15T02:00:00.000Z",
}

const meta = {
  title: "Pages/Audit",
  component: AuditLogPage,
  decorators: [
    (Story) => (
      <BackofficeProvider
        initialState={{ ...localFixture, auditEvents: [auditEvent] }}
      >
        <SessionAccessProvider
          localSwitchingEnabled
          initialUserId={localDefaultUserId}
        >
          <Story />
        </SessionAccessProvider>
      </BackofficeProvider>
    ),
  ],
} satisfies Meta<typeof AuditLogPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
