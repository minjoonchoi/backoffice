"use client"

import { requestTemplateFieldBindingValues } from "@/features/request-templates/model"
import {
  accessPolicyEffects,
  accessPolicyInputSchema,
  accessPolicyResourceTypeSchema,
  accessPolicyResourceTypes,
  type AccessPolicy,
  type AccessPolicyEffect,
  type AccessPolicyResource,
  type AccessPolicyResourceType,
  type AccessPolicyValue,
} from "@/features/access-policies/model"
import { serviceTypeValues } from "@/features/service-catalog/model"
import { entityStatuses } from "@/domain/common"
import { X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  useId,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useTranslations } from "next-intl"

import { useSessionAccess } from "@/auth/session-access-provider"
import { PageHeader } from "@/components/patterns/page-header"
import { EmptyState } from "@/components/patterns/content-state"
import { DataTable } from "@/components/patterns/data-table"
import {
  FieldValidationMessage,
  useDynamicFormValidation,
} from "@/components/patterns/dynamic-form-validation"
import {
  ReviewWorkflowProgress,
  type ReviewWorkflowStep,
} from "@/components/patterns/review-workflow-progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  RequestMultiTargetSelector,
  RequestTargetSelector,
} from "@/features/credentials/request-target-selector"
import { accessPolicyApprovalLines } from "@/features/access-policies/access-policy-template"
import { FormSelect } from "@/components/patterns/form-select"
import type { BackofficeUser } from "@/features/iam/model"
import {
  resolveAccessPolicyResourceDisplay,
  type AccessPolicyResourceDisplay,
} from "@/features/access-policies/access-policy-resources"
import {
  resolveAccessPolicyUpdateImpact,
  type AccessPolicyUpdateImpact,
} from "@/features/access-policies/access-policy-assignment"
import type { BackofficeErrorCode } from "@/domain/common"
import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  CommandErrorMessage,
} from "@/application/ui/backoffice-ui"
import type { ColumnDef } from "@tanstack/react-table"

const policyEditorModes = {
  create: "create",
  update: "update",
} as const
const policyConfigurationModes = {
  uiFeature: "ui-feature",
  endpoint: accessPolicyResourceTypes.endpoint,
  custom: requestTemplateFieldBindingValues.custom,
} as const

type PolicyConfigurationMode =
  (typeof policyConfigurationModes)[keyof typeof policyConfigurationModes]

function isPolicyConfigurationMode(
  value: string,
): value is PolicyConfigurationMode {
  return Object.values(policyConfigurationModes).some((mode) => mode === value)
}

type SelectedResourceRow = {
  id: string
  type: AccessPolicyResourceType
  scope: string
  identifier: string
  name: string
}

const policyResourceImpactOutcomeValues = {
  available: "available",
  unavailable: "unavailable",
} as const

type PolicyResourceImpactOutcome =
  (typeof policyResourceImpactOutcomeValues)[keyof typeof policyResourceImpactOutcomeValues]

type PolicyResourceImpactRow = {
  id: string
  resource: AccessPolicyResourceDisplay
  outcome: PolicyResourceImpactOutcome
  affectedUsers: BackofficeUser[]
}

function impactResourceLabel(resource: AccessPolicyResourceDisplay) {
  return [resource.scope, resource.identifier, resource.name]
    .filter((value) => value !== null)
    .join(" · ")
}

function PolicyImpactUsersSummary({
  users,
  moreLabel,
  ariaLabel,
}: {
  users: readonly BackofficeUser[]
  moreLabel: string
  ariaLabel: string
}) {
  const primaryUser = users[0]
  if (!primaryUser) return null
  const summary =
    users.length > 1
      ? `${primaryUser.nickname} · ${moreLabel}`
      : primaryUser.nickname

  return users.length > 1 ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            className="cursor-help text-left text-sm font-medium underline decoration-border underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        {summary}
      </TooltipTrigger>
      <TooltipContent align="end" className="max-w-80 px-3 py-2">
        <ul className="grid gap-1.5">
          {users.map((user) => (
            <li key={user.id} className="grid gap-0.5">
              <span className="font-medium">{user.nickname}</span>
              <span className="opacity-80">{user.email}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  ) : (
    <span className="grid min-w-0 gap-0.5">
      <span className="truncate font-medium">{primaryUser.nickname}</span>
      <span className="truncate text-xs text-muted-foreground">
        {primaryUser.email}
      </span>
    </span>
  )
}

const uiFeatureResourceTypes = new Set<AccessPolicyResourceType>([
  accessPolicyResourceTypes.uiResource,
  accessPolicyResourceTypes.endpoint,
])

function inferConfigurationMode(
  policy: AccessPolicy | undefined,
): PolicyConfigurationMode {
  if (!policy) return policyConfigurationModes.uiFeature
  const types = new Set(policy.resources.map((resource) => resource.type))
  if (
    types.size === uiFeatureResourceTypes.size &&
    [...uiFeatureResourceTypes].every((type) => types.has(type))
  ) {
    return policyConfigurationModes.uiFeature
  }
  if (types.size === 1 && types.has(accessPolicyResourceTypes.endpoint)) {
    return policyConfigurationModes.endpoint
  }
  return policyConfigurationModes.custom
}

export function AccessPolicyEditorPage({
  policyId,
  sourcePolicyId,
}: {
  policyId?: string
  sourcePolicyId?: string
}) {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.approvalDocuments")
  const common = useTranslations("backoffice.common")
  const resolvedPolicy = policyId
    ? backoffice.accessPolicies.find((item) => item.id === policyId)
    : undefined
  const sourcePolicy = sourcePolicyId
    ? backoffice.accessPolicies.find((item) => item.id === sourcePolicyId)
    : undefined

  if ((policyId && !resolvedPolicy) || (sourcePolicyId && !sourcePolicy)) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          <Button
            nativeButton={false}
            render={<Link href="/approval-documents" />}
          >
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  return resolvedPolicy ? (
    <AccessPolicyEditorForm
      mode={policyEditorModes.update}
      initialPolicy={resolvedPolicy}
    />
  ) : (
    <AccessPolicyEditorForm
      mode={policyEditorModes.create}
      {...(sourcePolicy ? { initialPolicy: sourcePolicy } : {})}
    />
  )
}

type AccessPolicyEditorFormProps =
  | { mode: typeof policyEditorModes.create; initialPolicy?: AccessPolicy }
  | { mode: typeof policyEditorModes.update; initialPolicy: AccessPolicy }

function AccessPolicyEditorForm({
  mode,
  initialPolicy,
}: AccessPolicyEditorFormProps) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const t = useTranslations("backoffice.approvalDocuments")
  const common = useTranslations("backoffice.common")
  const validationMessages = useTranslations("backoffice.validation")
  const formId = useId()
  const policy = mode === policyEditorModes.update ? initialPolicy : undefined
  const draftSource = initialPolicy
  const [step, setStep] = useState<ReviewWorkflowStep>(1)
  const [reviewedImpact, setReviewedImpact] =
    useState<AccessPolicyUpdateImpact | null>(null)
  const policyType = draftSource?.type ?? "access-grant"
  const initialConfigurationMode = inferConfigurationMode(draftSource)
  const initialResourceTypes = new Set<AccessPolicyResourceType>(
    draftSource?.resources.map((resource) => resource.type) ??
      uiFeatureResourceTypes,
  )
  const [configurationMode, setConfigurationMode] =
    useState<PolicyConfigurationMode>(initialConfigurationMode)
  const initialUiResourceNamespaceId = backoffice.uiResources.find(
    (resource) =>
      resource.id ===
      draftSource?.resources.find(
        (reference) => reference.type === accessPolicyResourceTypes.uiResource,
      )?.id,
  )?.namespaceId
  const initialEndpointServiceId = backoffice.serviceEndpoints.find(
    (endpoint) =>
      endpoint.id ===
      draftSource?.resources.find(
        (reference) => reference.type === accessPolicyResourceTypes.endpoint,
      )?.id,
  )?.serviceId
  const [resourceTypes, setResourceTypes] =
    useState<Set<AccessPolicyResourceType>>(initialResourceTypes)
  const [activeResourceType, setActiveResourceType] =
    useState<AccessPolicyResourceType | null>(
      draftSource?.resources[0]?.type ?? accessPolicyResourceTypes.uiResource,
    )
  const [name, setName] = useState(
    mode === policyEditorModes.create && draftSource
      ? `${draftSource.name} ${t("copySuffix")}`
      : (draftSource?.name ?? ""),
  )
  const [description, setDescription] = useState(draftSource?.description ?? "")
  const [resourceEffect, setResourceEffect] = useState<AccessPolicyEffect>(
    policy?.effect ?? accessPolicyEffects.allow,
  )
  const [endpointIds, setEndpointIds] = useState<Set<string>>(
    new Set(
      draftSource?.resources
        .filter(
          (resource) => resource.type === accessPolicyResourceTypes.endpoint,
        )
        .map((resource) => resource.id) ?? [],
    ),
  )
  const [uiResourceIds, setUiResourceIds] = useState<Set<string>>(
    new Set(
      draftSource?.resources
        .filter(
          (resource) => resource.type === accessPolicyResourceTypes.uiResource,
        )
        .map((resource) => resource.id) ?? [],
    ),
  )
  const [uiResourceNamespaceId, setUiResourceNamespaceId] = useState<
    string | null
  >(initialUiResourceNamespaceId ?? null)
  const [endpointServiceId, setEndpointServiceId] = useState<string | null>(
    initialEndpointServiceId ?? null,
  )
  const [selectedResourceTableType, setSelectedResourceTableType] =
    useState<AccessPolicyResourceType>(
      draftSource?.resources[0]?.type ?? accessPolicyResourceTypes.uiResource,
    )
  const [error, setError] = useState<BackofficeErrorCode>()

  const approvalLines = accessPolicyApprovalLines(backoffice, policyType)
  const endpointOptions = useMemo(
    () =>
      backoffice.serviceEndpoints.flatMap((endpoint) => {
        const service = backoffice.services.find(
          (item) => item.id === endpoint.serviceId,
        )
        if (!service) {
          throw new Error(`Endpoint service not found: ${endpoint.id}`)
        }
        return service.status === entityStatuses.active &&
          service.type === serviceTypeValues.internal
          ? [{ endpoint, service }]
          : []
      }),
    [backoffice.serviceEndpoints, backoffice.services],
  )
  const activeEndpointServices = useMemo(
    () => [
      ...new Map(
        endpointOptions.map(({ service }) => [service.id, service]),
      ).values(),
    ],
    [endpointOptions],
  )
  const visibleEndpointOptions = endpointOptions.filter(
    ({ service }) => service.id === endpointServiceId,
  )
  const selectedEndpoints = endpointOptions.filter(({ endpoint }) =>
    endpointIds.has(endpoint.id),
  )
  const activeNamespaces = useMemo(
    () =>
      backoffice.namespaces.filter(
        (namespace) => namespace.status === entityStatuses.active,
      ),
    [backoffice.namespaces],
  )
  const activeNamespaceIds = useMemo(
    () => new Set(activeNamespaces.map((namespace) => namespace.id)),
    [activeNamespaces],
  )
  const availableUiResources = useMemo(
    () =>
      backoffice.uiResources.filter(
        (resource) =>
          resource.orphanedAt === null &&
          activeNamespaceIds.has(resource.namespaceId),
      ),
    [activeNamespaceIds, backoffice.uiResources],
  )
  const visibleUiResourceOptions = availableUiResources
    .filter((resource) => resource.namespaceId === uiResourceNamespaceId)
    .map((resource) => {
      const namespace = activeNamespaces.find(
        (item) => item.id === resource.namespaceId,
      )
      if (!namespace) {
        throw new Error(`UI Resource namespace not found: ${resource.id}`)
      }
      return { namespace, resource }
    })
  const selectedUiResources = availableUiResources.filter((resource) =>
    uiResourceIds.has(resource.id),
  )
  const selectedUiResourceOptions = selectedUiResources.map((resource) => {
    const namespace = activeNamespaces.find(
      (item) => item.id === resource.namespaceId,
    )
    if (!namespace) {
      throw new Error(`UI Resource namespace not found: ${resource.id}`)
    }
    return { namespace, resource }
  })
  const selectedResourceRows: SelectedResourceRow[] = [
    ...selectedEndpoints.map(({ endpoint, service }) => ({
      id: endpoint.id,
      type: accessPolicyResourceTypes.endpoint,
      scope: service.name,
      identifier: `${endpoint.method} ${endpoint.path}`,
      name: endpoint.name,
    })),
    ...selectedUiResourceOptions.map(({ namespace, resource }) => ({
      id: resource.id,
      type: accessPolicyResourceTypes.uiResource,
      scope: namespace.name,
      identifier: resource.key,
      name: resource.name,
    })),
  ]
  const selectedResourceTypes = accessPolicyResourceTypeSchema.options.filter(
    (type) => selectedResourceRows.some((resource) => resource.type === type),
  )
  const visibleSelectedResourceType = selectedResourceTypes.includes(
    selectedResourceTableType,
  )
    ? selectedResourceTableType
    : selectedResourceTypes[0]
  const resourceCount = endpointIds.size + uiResourceIds.size
  const selectedResources: AccessPolicyResource[] = [
    ...[...endpointIds].map((id) => ({
      type: accessPolicyResourceTypes.endpoint,
      id,
    })),
    ...[...uiResourceIds].map((id) => ({
      type: accessPolicyResourceTypes.uiResource,
      id,
    })),
  ]
  const draftInput: AccessPolicyValue = {
    name,
    description,
    type: policyType,
    effect: resourceEffect,
    resources: selectedResources,
  }
  const draftResult = accessPolicyInputSchema.safeParse(draftInput)
  const validation = useDynamicFormValidation(
    draftResult.success ? undefined : draftResult.error,
  )
  const nameValidation = validation.getFieldValidation(
    "name",
    `${formId}-name-error`,
  )
  const descriptionValidation = validation.getFieldValidation(
    "description",
    `${formId}-description-error`,
  )
  const effectValidation = validation.getFieldValidation(
    "effect",
    `${formId}-effect-error`,
  )
  const draftImpact = policy
    ? resolveAccessPolicyUpdateImpact(backoffice, policy, draftInput)
    : null
  const policyChanged = Boolean(
    draftImpact &&
    (draftImpact.nameChanged ||
      draftImpact.descriptionChanged ||
      draftImpact.effectChanged ||
      draftImpact.addedResources.length > 0 ||
      draftImpact.removedResources.length > 0),
  )
  const resourceSelectionValid =
    resourceTypes.size > 0 &&
    resourceCount > 0 &&
    [...resourceTypes].every((type) =>
      type === accessPolicyResourceTypes.endpoint
        ? endpointIds.size > 0
        : uiResourceNamespaceId !== null && uiResourceIds.size > 0,
    )
  const inputComplete =
    draftResult.success && approvalLines.length === 1 && resourceSelectionValid
  const resourcesValidation = validation.getFieldValidation(
    "resources",
    `${formId}-resources-error`,
  )
  const resourceSelectionError =
    validation.shouldShowError("resources") && !resourceSelectionValid
      ? (resourcesValidation.error ?? validationMessages("required"))
      : resourcesValidation.error

  async function submit() {
    if (!inputComplete) {
      validation.revealAll()
      setStep(1)
      return
    }
    if (!sessionAccess.currentUser) {
      setError("policy-operation-forbidden")
      return
    }
    if (policy) {
      const result = await backoffice.updateAccessPolicy(
        policy.id,
        draftInput,
        sessionAccess.currentUser.id,
      )
      if (!result.ok) {
        setError(result.error)
        return
      }
      snackbar.success(t("policyUpdated"))
      router.replace(`/approval-documents/${result.value.id}`)
    } else {
      const result = await backoffice.createAccessPolicy(
        draftInput,
        sessionAccess.currentUser.id,
      )
      if (!result.ok) {
        setError(result.error)
        return
      }
      snackbar.success(t("policyCreated"))
      router.replace(`/approval-documents/${result.value.id}`)
    }
  }

  async function reviewUpdateImpact() {
    if (!inputComplete) {
      validation.revealAll()
      setStep(1)
      return
    }
    if (!policy || !sessionAccess.currentUser) {
      setError("policy-operation-forbidden")
      return
    }
    const result = await backoffice.analyzeAccessPolicyUpdate(
      policy.id,
      draftInput,
      sessionAccess.currentUser.id,
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    setReviewedImpact(result.value)
    setStep(2)
    setError(undefined)
  }

  function updateSelection(
    setter: Dispatch<SetStateAction<Set<string>>>,
    resourceId: string,
    checked: boolean,
  ) {
    validation.touch("resources")
    setter((current) => {
      const next = new Set(current)
      if (checked) next.add(resourceId)
      else next.delete(resourceId)
      return next
    })
  }

  function getResourceTypeLabel(type: AccessPolicyResourceType) {
    if (type === accessPolicyResourceTypes.endpoint)
      return t("resourceTypeLabels.endpoint")
    return t("resourceTypeLabels.ui-resource")
  }

  function changeActiveResourceType(value: string) {
    const parsed = accessPolicyResourceTypeSchema.safeParse(value)
    if (parsed.success && resourceTypes.has(parsed.data)) {
      setActiveResourceType(parsed.data)
    }
  }

  function toggleResourceType(
    type: AccessPolicyResourceType,
    checked: boolean,
  ) {
    validation.touch("resources")
    const next = new Set(resourceTypes)
    if (checked) next.add(type)
    else next.delete(type)
    setResourceTypes(next)
    setActiveResourceType((active) => {
      if (checked && active === null) return type
      if (!checked && active === type) return [...next][0] ?? null
      return active
    })
    if (checked) return
    if (type === accessPolicyResourceTypes.endpoint) {
      setEndpointIds(new Set())
      setEndpointServiceId(null)
    } else {
      setUiResourceIds(new Set())
      setUiResourceNamespaceId(null)
    }
  }

  function changeConfigurationMode(value: string) {
    if (!isPolicyConfigurationMode(value)) {
      return
    }
    validation.touch("resources")
    setConfigurationMode(value)
    if (value === requestTemplateFieldBindingValues.custom) return
    const nextTypes =
      value === policyConfigurationModes.uiFeature
        ? new Set<AccessPolicyResourceType>(uiFeatureResourceTypes)
        : new Set<AccessPolicyResourceType>([
            accessPolicyResourceTypes.endpoint,
          ])
    setResourceTypes(nextTypes)
    setActiveResourceType(
      value === policyConfigurationModes.uiFeature
        ? accessPolicyResourceTypes.uiResource
        : accessPolicyResourceTypes.endpoint,
    )
    if (value === accessPolicyResourceTypes.endpoint) {
      setUiResourceIds(new Set())
      setUiResourceNamespaceId(null)
    }
  }

  function selectUiResourceNamespace(value: string) {
    validation.touch("resources")
    if (value === uiResourceNamespaceId) return
    setUiResourceNamespaceId(value)
    setUiResourceIds(new Set())
  }

  function renderResourceConfiguration() {
    const availableResourceTypes = accessPolicyResourceTypeSchema.options
    const configurations: {
      value: PolicyConfigurationMode
      title: string
      description: string
      types: AccessPolicyResourceType[]
    }[] = [
      {
        value: policyConfigurationModes.uiFeature,
        title: t("configurationModes.uiFeature.title"),
        description: t("configurationModes.uiFeature.description"),
        types: [
          accessPolicyResourceTypes.uiResource,
          accessPolicyResourceTypes.endpoint,
        ],
      },
      {
        value: policyConfigurationModes.endpoint,
        title: t("configurationModes.endpoint.title"),
        description: t("configurationModes.endpoint.description"),
        types: [accessPolicyResourceTypes.endpoint],
      },
      {
        value: policyConfigurationModes.custom,
        title: t("configurationModes.custom.title"),
        description: t("configurationModes.custom.description"),
        types: [],
      },
    ]
    return (
      <section
        className="grid gap-4"
        aria-labelledby={`${formId}-resource-configuration`}
      >
        <div className="grid gap-1">
          <h3
            id={`${formId}-resource-configuration`}
            className="text-base font-semibold"
          >
            {t("resourceConfigurationTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("resourceConfigurationDescription")}
          </p>
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">
            {t("configurationMode")}
          </legend>
          <RadioGroup
            value={configurationMode}
            onValueChange={changeConfigurationMode}
            className="grid gap-2 lg:grid-cols-3"
          >
            {configurations.map((configuration) => {
              const id = `${formId}-configuration-${configuration.value}`
              return (
                <label
                  key={configuration.value}
                  htmlFor={id}
                  className={`grid cursor-pointer content-start gap-2 rounded-card border p-3 transition-colors hover:bg-control-hover ${
                    configurationMode === configuration.value
                      ? "border-primary bg-brand-weak"
                      : "border-border-subtle bg-surface"
                  }`}
                >
                  <span className="flex items-start gap-2">
                    <RadioGroupItem
                      id={id}
                      value={configuration.value}
                      className="mt-0.5"
                    />
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {configuration.title}
                        {configuration.value ===
                        policyConfigurationModes.uiFeature ? (
                          <Badge variant="info">{t("recommended")}</Badge>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {configuration.description}
                      </span>
                    </span>
                  </span>
                  {configuration.types.length > 0 ? (
                    <span className="flex flex-wrap gap-1 pl-6">
                      {configuration.types.map((type) => (
                        <Badge key={type} variant="outline">
                          {getResourceTypeLabel(type)}
                        </Badge>
                      ))}
                    </span>
                  ) : null}
                </label>
              )
            })}
          </RadioGroup>
        </fieldset>
        {configurationMode === requestTemplateFieldBindingValues.custom ? (
          <fieldset className="grid gap-2 rounded-card border border-border-subtle bg-surface-subtle p-3">
            <legend className="px-1 text-sm font-medium">
              {t("resourceTypes")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {availableResourceTypes.map((type) => (
                <label
                  key={type}
                  className="flex min-h-control cursor-pointer items-center gap-2 rounded-control border border-border-subtle bg-surface px-3 py-2 hover:bg-control-hover"
                >
                  <Checkbox
                    checked={resourceTypes.has(type)}
                    onCheckedChange={(checked) => {
                      toggleResourceType(type, checked)
                    }}
                  />
                  <span className="font-medium">
                    {getResourceTypeLabel(type)}
                  </span>
                </label>
              ))}
            </div>
            <FieldDescription>{t("resourceTypesDescription")}</FieldDescription>
          </fieldset>
        ) : null}
        <FormSelect
          label={t("resourceEffect")}
          value={resourceEffect}
          onValueChange={(value) => {
            if (value) setResourceEffect(value)
          }}
          error={effectValidation.error}
          onInteract={() => {
            validation.touch("effect")
          }}
          options={[
            {
              value: accessPolicyEffects.allow,
              label: t(accessPolicyEffects.allow),
            },
            {
              value: accessPolicyEffects.deny,
              label: t(accessPolicyEffects.deny),
            },
          ]}
        />
      </section>
    )
  }

  function renderMetadata() {
    return (
      <section
        className="grid gap-4"
        aria-labelledby={`${formId}-metadata-title`}
      >
        <div className={policy ? "sr-only" : "grid gap-1"}>
          <h3
            id={`${formId}-metadata-title`}
            className="text-base font-semibold"
          >
            {t("policyMetadataTitle")}
          </h3>
          {!policy ? (
            <p className="text-sm text-muted-foreground">
              {t("policyMetadataDescription")}
            </p>
          ) : null}
        </div>
        {approvalLines.length !== 1 ? (
          <p className="rounded-lg border border-destructive-foreground/20 bg-destructive p-3 text-sm text-destructive-foreground">
            {approvalLines.length === 0
              ? t("policyTemplateEmpty")
              : t("policyTemplateAmbiguous")}
          </p>
        ) : null}
        <Field invalid={nameValidation.invalid}>
          <FieldLabel htmlFor={`${formId}-name`}>{t("policyName")}</FieldLabel>
          <Input
            id={`${formId}-name`}
            name="name"
            value={name}
            aria-invalid={nameValidation.invalid}
            aria-describedby={nameValidation.errorId}
            onChange={(event) => {
              validation.touch("name")
              setName(event.target.value)
            }}
            required
            minLength={2}
            maxLength={100}
          />
          <FieldValidationMessage validation={nameValidation} />
        </Field>
        <Field invalid={descriptionValidation.invalid}>
          <FieldLabel htmlFor={`${formId}-description`}>
            {t("policyDescription")}
          </FieldLabel>
          <Textarea
            id={`${formId}-description`}
            name="description"
            value={description}
            aria-invalid={descriptionValidation.invalid}
            aria-describedby={descriptionValidation.errorId}
            onChange={(event) => {
              validation.touch("description")
              setDescription(event.target.value)
            }}
            required
            minLength={2}
            maxLength={500}
            rows={4}
          />
          <FieldValidationMessage validation={descriptionValidation} />
        </Field>
      </section>
    )
  }

  function renderSelectedResources(removable: boolean) {
    const visibleRows = visibleSelectedResourceType
      ? selectedResourceRows.filter(
          (resource) => resource.type === visibleSelectedResourceType,
        )
      : []
    const columns: ColumnDef<SelectedResourceRow>[] = [
      {
        accessorKey: "scope",
        header:
          visibleSelectedResourceType === accessPolicyResourceTypes.endpoint
            ? t("selectedResourceColumns.service")
            : t("selectedResourceColumns.namespace"),
        size: 180,
        cell: ({ row }) => (
          <span className="block truncate font-medium">
            {row.original.scope}
          </span>
        ),
      },
      {
        accessorKey: "identifier",
        header:
          visibleSelectedResourceType === accessPolicyResourceTypes.endpoint
            ? t("selectedResourceColumns.endpoint")
            : t("selectedResourceColumns.identifier"),
        size: 280,
        cell: ({ row }) => (
          <code className="block truncate text-xs text-text-subtle">
            {row.original.identifier}
          </code>
        ),
      },
      {
        accessorKey: "name",
        header: t("selectedResourceColumns.name"),
        size: 220,
        cell: ({ row }) => (
          <span className="block truncate">{row.original.name}</span>
        ),
      },
      ...(removable
        ? [
            {
              id: "actions",
              header: common("actions"),
              size: 80,
              cell: ({ row }: { row: { original: SelectedResourceRow } }) => (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={t("removeSelectedResource", {
                    name: row.original.name,
                  })}
                  onClick={() => {
                    if (
                      row.original.type === accessPolicyResourceTypes.endpoint
                    ) {
                      updateSelection(setEndpointIds, row.original.id, false)
                    } else {
                      updateSelection(setUiResourceIds, row.original.id, false)
                    }
                  }}
                >
                  <X />
                  <span className="sr-only">{common("remove")}</span>
                </Button>
              ),
            } satisfies ColumnDef<SelectedResourceRow>,
          ]
        : []),
    ]

    return (
      <aside
        className="grid min-h-0 min-w-0 gap-3 rounded-lg border bg-surface-subtle p-3"
        aria-label={t("selectedResources")}
      >
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-medium">{t("selectedResources")}</h4>
          <Badge variant="secondary">
            {t("resourceCount", { count: resourceCount })}
          </Badge>
        </div>
        {resourceCount > 0 && visibleSelectedResourceType ? (
          <Tabs
            value={visibleSelectedResourceType}
            onValueChange={(value) => {
              const parsed = accessPolicyResourceTypeSchema.safeParse(value)
              if (parsed.success) setSelectedResourceTableType(parsed.data)
            }}
          >
            <TabsList aria-label={t("selectedResourceTypes")}>
              {selectedResourceTypes.map((type) => (
                <TabsTrigger key={type} value={type}>
                  {getResourceTypeLabel(type)}
                  <Badge variant="secondary">
                    {
                      selectedResourceRows.filter(
                        (resource) => resource.type === type,
                      ).length
                    }
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            {selectedResourceTypes.map((type) => (
              <TabsContent key={type} value={type}>
                <DataTable
                  caption={t("selectedResourceTableCaption", {
                    type: getResourceTypeLabel(type),
                  })}
                  columns={columns}
                  data={visibleRows}
                  getRowId={(row) => `${row.type}:${row.id}`}
                  filters={[
                    {
                      id: "resource",
                      label: t("selectedResourceSearch"),
                      getValue: (row) =>
                        `${row.scope} ${row.identifier} ${row.name}`,
                    },
                  ]}
                  filterLabel={t("selectedResourceSearch")}
                  empty={t("selectedResourcesEmpty")}
                  noResults={common("noResults")}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("selectedResourcesEmpty")}
          </p>
        )}
      </aside>
    )
  }

  function renderResources() {
    if (activeResourceType === null || resourceTypes.size === 0) return null
    const guidedUiFeature =
      configurationMode === policyConfigurationModes.uiFeature
    const selectableResourceTypes = [...resourceTypes]

    return (
      <section className="grid gap-3" aria-labelledby={`${formId}-resources`}>
        <div className="grid gap-1">
          <h3 id={`${formId}-resources`} className="text-base font-semibold">
            {t("resourceSelection")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("multiResourceSelectionDescription")}
          </p>
        </div>
        {guidedUiFeature ? (
          <div className="grid gap-3 rounded-card border border-info-foreground/20 bg-info p-3">
            <div className="grid gap-1">
              <h4 className="font-medium">{t("uiFeatureGuideTitle")}</h4>
              <p className="text-sm text-info-foreground">
                {t("uiFeatureGuideDescription")}
              </p>
            </div>
            <ol
              className="grid gap-2 sm:grid-cols-3"
              aria-label={t("resourceSetupProgress")}
            >
              <li className="rounded-control border border-info-foreground/20 bg-surface px-3 py-2">
                <span className="block text-xs text-muted-foreground">
                  {t("resourceSetupSteps.namespace")}
                </span>
                <span className="font-medium">
                  {uiResourceNamespaceId
                    ? t("selectionComplete")
                    : t("selectionRequired")}
                </span>
              </li>
              <li className="rounded-control border border-info-foreground/20 bg-surface px-3 py-2">
                <span className="block text-xs text-muted-foreground">
                  {t("resourceSetupSteps.uiResource")}
                </span>
                <span className="font-medium">
                  {t("selectedCount", { count: uiResourceIds.size })}
                </span>
              </li>
              <li className="rounded-control border border-info-foreground/20 bg-surface px-3 py-2">
                <span className="block text-xs text-muted-foreground">
                  {t("resourceSetupSteps.endpoint")}
                </span>
                <span className="font-medium">
                  {t("selectedCount", { count: endpointIds.size })}
                </span>
              </li>
            </ol>
          </div>
        ) : null}
        <div className="grid gap-4">
          <Tabs
            value={activeResourceType}
            onValueChange={changeActiveResourceType}
            className="min-h-0 min-w-0"
          >
            <TabsList aria-label={t("resourceTypes")}>
              {selectableResourceTypes.map((type) => (
                <TabsTrigger key={type} value={type}>
                  {getResourceTypeLabel(type)}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent
              value={accessPolicyResourceTypes.endpoint}
              className="grid min-h-0 gap-4"
            >
              {resourceTypes.has(accessPolicyResourceTypes.endpoint) ? (
                <div className="grid min-h-0 items-start gap-4 md:grid-cols-2">
                  <RequestTargetSelector
                    label={t("endpointServiceSelection")}
                    description={t("endpointServiceSelectionDescription")}
                    searchLabel={t("endpointServiceSearch")}
                    empty={t("endpointServiceEmpty")}
                    options={activeEndpointServices.map((service) => ({
                      id: service.id,
                      title: service.name,
                      description: service.host,
                      searchText: service.serviceKey,
                    }))}
                    value={endpointServiceId}
                    onValueChange={(value) => {
                      validation.touch("resources")
                      setEndpointServiceId(value)
                    }}
                    listClassName="h-[min(38svh,20rem)] max-h-none"
                  />
                  <RequestMultiTargetSelector
                    key={endpointServiceId ?? "unselected-endpoint-service"}
                    label={t("endpointSelection")}
                    description={t("endpointSearchDescription")}
                    searchLabel={t("endpointSearch")}
                    empty={
                      endpointServiceId
                        ? t("endpointServiceResourceEmpty")
                        : t("selectEndpointServiceFirst")
                    }
                    selectedCountLabel={t("selectedCount", {
                      count: endpointIds.size,
                    })}
                    options={
                      endpointServiceId
                        ? visibleEndpointOptions.map(({ endpoint }) => ({
                            id: endpoint.id,
                            title: `${endpoint.method} ${endpoint.path}`,
                            description: endpoint.name,
                            searchText: `${endpoint.method} ${endpoint.path} ${endpoint.name}`,
                          }))
                        : []
                    }
                    value={[...endpointIds]}
                    onValueChange={(values) => {
                      validation.touch("resources")
                      setEndpointIds(new Set(values))
                    }}
                    disabled={!endpointServiceId}
                    listClassName="h-[min(38svh,20rem)] max-h-none"
                  />
                </div>
              ) : null}
            </TabsContent>
            <TabsContent
              value={accessPolicyResourceTypes.uiResource}
              className="grid min-h-0 gap-4"
            >
              {resourceTypes.has(accessPolicyResourceTypes.uiResource) ? (
                <div className="grid min-h-0 items-start gap-4 md:grid-cols-2">
                  <RequestTargetSelector
                    label={t("uiResourceNamespace")}
                    description={t("uiResourceNamespaceDescription")}
                    searchLabel={t("namespaceSearch")}
                    empty={t("namespaceSelectionEmpty")}
                    options={activeNamespaces.map((namespace) => ({
                      id: namespace.id,
                      title: namespace.name,
                      description: namespace.key,
                    }))}
                    value={uiResourceNamespaceId}
                    onValueChange={selectUiResourceNamespace}
                    listClassName="h-[min(38svh,20rem)] max-h-none"
                  />
                  <RequestMultiTargetSelector
                    key={uiResourceNamespaceId ?? "unselected-namespace"}
                    label={t("uiResourceSelection")}
                    description={t("uiResourceSearchDescription")}
                    searchLabel={t("uiResourceSearch")}
                    empty={
                      uiResourceNamespaceId
                        ? t("uiResourceSelectionEmpty")
                        : t("selectUiResourceNamespace")
                    }
                    selectedCountLabel={t("selectedCount", {
                      count: uiResourceIds.size,
                    })}
                    options={
                      uiResourceNamespaceId
                        ? visibleUiResourceOptions.map(({ resource }) => ({
                            id: resource.id,
                            title: resource.name,
                            description: resource.key,
                            searchText: resource.type,
                          }))
                        : []
                    }
                    value={[...uiResourceIds]}
                    onValueChange={(values) => {
                      validation.touch("resources")
                      setUiResourceIds(new Set(values))
                    }}
                    disabled={!uiResourceNamespaceId}
                    listClassName="h-[min(38svh,20rem)] max-h-none"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
          {renderSelectedResources(true)}
          {resourceSelectionError ? (
            <FieldError id={`${formId}-resources-error`}>
              {resourceSelectionError}
            </FieldError>
          ) : null}
        </div>
      </section>
    )
  }

  function renderReview() {
    if (resourceTypes.size === 0) return null

    return (
      <section className="grid gap-3" aria-labelledby={`${formId}-review`}>
        <h3 id={`${formId}-review`} className="sr-only">
          {t("policyReviewTitle")}
        </h3>
        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,0.86fr)_minmax(20rem,1.14fr)]">
          <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
            <div className="border-b border-border-subtle bg-surface-subtle px-4 py-3">
              <p className="font-semibold">{t("policyReviewTitle")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(
                  policy
                    ? "policyUpdateReviewDescription"
                    : "policyReviewDescription",
                )}
              </p>
            </div>
            <dl className="grid">
              <div className="grid gap-1 border-b border-border-subtle p-4">
                <dt className="text-xs text-muted-foreground">
                  {t("policyName")}
                </dt>
                <dd className="font-medium">{name}</dd>
              </div>
              <div className="grid gap-1 border-b border-border-subtle p-4">
                <dt className="text-xs text-muted-foreground">
                  {t("policyDescription")}
                </dt>
                <dd
                  className="max-h-28 overflow-y-auto text-sm whitespace-pre-wrap"
                  tabIndex={0}
                >
                  {description}
                </dd>
              </div>
              <div className="grid content-start gap-1 border-b border-border-subtle p-4">
                <dt className="text-xs text-muted-foreground">{t("effect")}</dt>
                <dd>
                  <AccessPolicyEffectBadge effect={resourceEffect} />
                </dd>
              </div>
              <div className="grid content-start gap-1 p-4">
                <dt className="text-xs text-muted-foreground">
                  {t("resourceType")}
                </dt>
                <dd>
                  <span className="flex flex-wrap gap-1.5">
                    {[...resourceTypes].map((type) => (
                      <Badge key={type} variant="secondary">
                        {getResourceTypeLabel(type)}
                      </Badge>
                    ))}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
          {renderSelectedResources(false)}
        </div>
      </section>
    )
  }

  function renderUpdateImpact() {
    if (!policy || !reviewedImpact) return null
    const updateImpact = reviewedImpact
    const notificationRecipientUsers =
      updateImpact.notificationRecipientUserIds.map((userId) => {
        const user = backoffice.users.find(
          (candidate) => candidate.id === userId,
        )
        if (!user) {
          throw new Error(`Affected policy user not found: ${userId}`)
        }
        return user
      })
    const notificationRecipientsById = new Map(
      notificationRecipientUsers.map((user) => [user.id, user]),
    )
    const resourceImpactsById = new Map<string, PolicyResourceImpactRow>()

    function addResourceImpact(
      reference: AccessPolicyResource,
      user: BackofficeUser,
      outcome: PolicyResourceImpactOutcome,
    ) {
      const id = `${outcome}:${reference.type}:${reference.id}`
      const existing = resourceImpactsById.get(id)
      if (existing) {
        if (
          !existing.affectedUsers.some((candidate) => candidate.id === user.id)
        ) {
          existing.affectedUsers.push(user)
        }
        return
      }
      resourceImpactsById.set(id, {
        id,
        resource: resolveAccessPolicyResourceDisplay(backoffice, reference),
        outcome,
        affectedUsers: [user],
      })
    }

    for (const permissionChange of updateImpact.permissionChanges) {
      const user = notificationRecipientsById.get(permissionChange.userId)
      if (!user) {
        throw new Error(
          `Policy permission change user not found: ${permissionChange.userId}`,
        )
      }
      for (const resource of permissionChange.gainedResources) {
        addResourceImpact(
          resource,
          user,
          policyResourceImpactOutcomeValues.available,
        )
      }
      for (const resource of permissionChange.lostResources) {
        addResourceImpact(
          resource,
          user,
          policyResourceImpactOutcomeValues.unavailable,
        )
      }
    }
    const resourceImpacts = [...resourceImpactsById.values()].sort(
      (left, right) => {
        if (left.outcome !== right.outcome) {
          return left.outcome === policyResourceImpactOutcomeValues.unavailable
            ? -1
            : 1
        }
        return impactResourceLabel(left.resource).localeCompare(
          impactResourceLabel(right.resource),
        )
      },
    )
    const resourceImpactColumns: ColumnDef<PolicyResourceImpactRow>[] = [
      {
        id: "resource",
        header: t("impactedResource"),
        cell: ({ row }) => (
          <span className="grid min-w-0 gap-0.5">
            <span className="truncate text-xs text-muted-foreground">
              {row.original.resource.scope}
            </span>
            <span className="font-medium">{row.original.resource.name}</span>
            <code className="truncate text-xs text-text-subtle">
              {row.original.resource.identifier}
            </code>
          </span>
        ),
        size: 360,
      },
      {
        id: "outcome",
        header: t("actualAccessResult"),
        cell: ({ row }) => {
          const unavailable =
            row.original.outcome ===
            policyResourceImpactOutcomeValues.unavailable
          return (
            <Badge variant={unavailable ? "destructive" : "success"}>
              {t(
                unavailable
                  ? "accessBecomesUnavailable"
                  : "accessBecomesAvailable",
              )}
            </Badge>
          )
        },
        size: 220,
      },
      {
        id: "affectedUsers",
        header: t("affectedTargets"),
        cell: ({ row }) => (
          <span className="grid gap-1.5">
            <Badge
              variant={
                row.original.outcome ===
                policyResourceImpactOutcomeValues.unavailable
                  ? "warning"
                  : "secondary"
              }
            >
              {t("affectedUserCount", {
                count: row.original.affectedUsers.length,
              })}
            </Badge>
            <PolicyImpactUsersSummary
              users={row.original.affectedUsers}
              moreLabel={t("additionalAffectedUsers", {
                count: Math.max(0, row.original.affectedUsers.length - 1),
              })}
              ariaLabel={t("affectedUserListLabel", {
                count: row.original.affectedUsers.length,
                names: row.original.affectedUsers
                  .map((user) => user.nickname)
                  .join(", "),
              })}
            />
          </span>
        ),
        size: 300,
      },
    ]
    const hasActualResourceImpact = resourceImpacts.length > 0

    return (
      <div className="grid gap-4">
        {renderReview()}
        <section
          className="grid gap-4 rounded-card border border-border-subtle bg-surface-subtle p-4"
          aria-labelledby={`${formId}-update-impact`}
        >
          <div className="grid gap-1">
            <h3 id={`${formId}-update-impact`} className="font-semibold">
              {t("updateImpactTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t(
                hasActualResourceImpact
                  ? "updateImpactDescriptionWithChanges"
                  : "updateImpactDescriptionWithoutChanges",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label={t("changeSummary")}>
            {updateImpact.nameChanged ? (
              <Badge variant="outline">{t("changedFields.name")}</Badge>
            ) : null}
            {updateImpact.descriptionChanged ? (
              <Badge variant="outline">{t("changedFields.description")}</Badge>
            ) : null}
            {updateImpact.effectChanged ? (
              <Badge variant="warning">
                {t("effectChange", {
                  before: t(policy.effect),
                  after: t(resourceEffect),
                })}
              </Badge>
            ) : null}
            {updateImpact.addedResources.length > 0 ? (
              <Badge variant="success">
                {t("addedResourceCount", {
                  count: updateImpact.addedResources.length,
                })}
              </Badge>
            ) : null}
            {updateImpact.removedResources.length > 0 ? (
              <Badge variant="destructive">
                {t("removedResourceCount", {
                  count: updateImpact.removedResources.length,
                })}
              </Badge>
            ) : null}
          </div>
          {hasActualResourceImpact ? (
            <div className="overflow-hidden rounded-card border border-border-subtle bg-surface p-3">
              <TooltipProvider>
                <DataTable
                  caption={t("actualResourceImpactCaption")}
                  columns={resourceImpactColumns}
                  data={resourceImpacts}
                  getRowId={(row) => row.id}
                  empty={common("noResults")}
                  filterLabel={common("search")}
                  noResults={common("noResults")}
                  filters={[
                    {
                      id: "resource",
                      label: t("impactedResource"),
                      getValue: (row) => impactResourceLabel(row.resource),
                    },
                    {
                      id: "outcome",
                      label: t("actualAccessResult"),
                      getValue: (row) =>
                        t(
                          row.outcome ===
                            policyResourceImpactOutcomeValues.unavailable
                            ? "accessBecomesUnavailable"
                            : "accessBecomesAvailable",
                        ),
                    },
                    {
                      id: "affectedUsers",
                      label: t("affectedTargets"),
                      getValue: (row) =>
                        row.affectedUsers
                          .map((user) => `${user.nickname} ${user.email}`)
                          .join(" "),
                    },
                  ]}
                />
              </TooltipProvider>
            </div>
          ) : null}
          {notificationRecipientUsers.length > 0 ? (
            <section
              className="grid gap-0.5 rounded-card border border-border-subtle bg-surface px-3 py-2.5"
              aria-labelledby={`${formId}-notification-delivery`}
            >
              <h4
                id={`${formId}-notification-delivery`}
                className="text-sm font-semibold"
              >
                {t("notificationDeliveryTitle")}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t("notificationDeliveryDescription", {
                  count: notificationRecipientUsers.length,
                })}
              </p>
            </section>
          ) : null}
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <PageHeader
        title={t(policy ? "updatePolicy" : "createPolicy")}
        description={t(
          policy ? "updatePolicyDescription" : "createPolicyDescription",
        )}
      />
      <Card>
        <CardContent className="grid gap-4">
          <ReviewWorkflowProgress step={step} label={t("creationProgress")} />
          <form
            id={formId}
            noValidate
            className="grid gap-4"
            aria-label={t(policy ? "updatePolicy" : "createPolicy")}
            onSubmit={(event) => {
              event.preventDefault()
              if (step === 1 && !inputComplete) {
                validation.revealAll()
                return
              }
              if (step === 1 && policy) {
                void reviewUpdateImpact()
                return
              }
              if (step === 1) {
                setError(undefined)
                setStep(2)
                return
              }
              void submit()
            }}
          >
            {step === 1 ? (
              <>
                {renderMetadata()}
                {renderResourceConfiguration()}
                {renderResources()}
              </>
            ) : policy ? (
              renderUpdateImpact()
            ) : (
              renderReview()
            )}
            <CommandErrorMessage error={error} />
          </form>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={
              <Link
                href={
                  policy
                    ? `/approval-documents/${policy.id}`
                    : "/approval-documents"
                }
              />
            }
          >
            {common("cancel")}
          </Button>
          {step === 2 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep(1)
                setReviewedImpact(null)
                setError(undefined)
              }}
            >
              {common("previous")}
            </Button>
          ) : null}
          {step === 1 ? (
            <Button
              key="review-policy"
              type="submit"
              form={formId}
              disabled={Boolean(policy) && !policyChanged}
            >
              {policy ? t("reviewUpdateImpact") : common("next")}
            </Button>
          ) : (
            <Button
              key="submit-policy"
              type="submit"
              form={formId}
              disabled={!inputComplete}
            >
              {common(policy ? "save" : "create")}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
