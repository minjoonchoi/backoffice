import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { backofficeErrorCodes, entityStatuses } from "@/domain/common"
import {
  accessPolicyAssignmentTargets,
  accessPolicyEffects,
  accessPolicyManagementTypes,
  accessPolicyResourceTypes,
  approvalDecisions,
  approvalDocumentKinds,
  approvalDocumentStatuses,
  approvalStepStatuses,
  grooApprovalResultValues,
} from "@/features/access-policies/model"
import {
  auditActionValues,
  auditResourceTypeValues,
  auditTypeFilterValues,
} from "@/features/audit/model"
import { employmentStatusValues } from "@/features/iam/model"
import {
  approvalAssigneeModeValues,
  approvalExecutionTypeValues,
  approvalStepKindValues,
  approvalTypeValues,
  requestCategoryValues,
  requestTemplateFieldBindingValues,
  requestTemplateFieldControlValues,
} from "@/features/request-templates/model"
import {
  endpointFieldLocationValues,
  endpointLifecycleValues,
  httpMethodValues,
  serviceTypeValues,
} from "@/features/service-catalog/model"
import { endpointSyncKinds } from "@/features/service-catalog/endpoint-sync"
import { uiResourceTypeValues } from "@/features/ui-resources/ui-resource-manifest"
import { uiResourceVisibilityValues } from "@/features/ui-resources/ui-resource-visibility"
import { uiResourceManifest } from "@/config/menu-registry"

const sourceRoot = join(process.cwd(), "src")
const domainValueGroups: readonly Readonly<Record<string, string>>[] = [
  entityStatuses,
  backofficeErrorCodes,
  employmentStatusValues,
  serviceTypeValues,
  httpMethodValues,
  endpointLifecycleValues,
  endpointFieldLocationValues,
  endpointSyncKinds,
  accessPolicyAssignmentTargets,
  accessPolicyEffects,
  accessPolicyManagementTypes,
  accessPolicyResourceTypes,
  approvalDecisions,
  approvalDocumentKinds,
  approvalDocumentStatuses,
  approvalStepStatuses,
  grooApprovalResultValues,
  approvalAssigneeModeValues,
  approvalExecutionTypeValues,
  approvalStepKindValues,
  approvalTypeValues,
  requestCategoryValues,
  requestTemplateFieldBindingValues,
  requestTemplateFieldControlValues,
  auditActionValues,
  auditResourceTypeValues,
  auditTypeFilterValues,
  uiResourceTypeValues,
  uiResourceVisibilityValues,
]
const domainValues = new Set<string>(
  domainValueGroups.flatMap((values) => Object.values(values)),
)

for (const resource of uiResourceManifest.resources) {
  domainValues.add(resource.key)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

describe("domain value constants", () => {
  it("uses general and system policy classifications", () => {
    expect(Object.values(accessPolicyManagementTypes)).toEqual([
      "general",
      "system",
    ])
  })

  it("does not use raw domain values in production conditions or discriminators", () => {
    const sourceFiles = readdirSync(sourceRoot, { recursive: true })
      .filter(
        (path): path is string =>
          typeof path === "string" &&
          /\.(?:ts|tsx)$/.test(path) &&
          !/\.(?:test|stories)\.(?:ts|tsx)$/.test(path),
      )
      .map((path) => join(sourceRoot, path))
    const violations = sourceFiles.flatMap((path) => {
      const source = readFileSync(path, "utf8")
      return [...domainValues].flatMap((value) => {
        const literal = escapeRegExp(value)
        const comparison = new RegExp(
          `(?:===|!==)\\s*["']${literal}["']|case\\s+["']${literal}["']|\\.(?:has|includes)\\(\\s*["']${literal}["']|(?:type|status|effect|targetType|resourceType|documentKind|submission|decision|kind)\\s*:\\s*["']${literal}["']`,
        )
        return comparison.test(source)
          ? [`${path.slice(process.cwd().length + 1)}: ${value}`]
          : []
      })
    })

    expect(violations).toEqual([])
  })
})
