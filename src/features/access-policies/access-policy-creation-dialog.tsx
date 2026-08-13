"use client"

import { Pencil, Plus, X } from "lucide-react"
import {
  useId,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useTranslations } from "next-intl"

import { useSessionAccess } from "@/auth/session-access-provider"
import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { accessPolicyApprovalLines } from "@/features/access-policies/access-policy-template"
import { FormSelect } from "@/components/patterns/form-select"
import type {
  AccessPolicy,
  AccessPolicyEffect,
  AccessPolicyInput,
  AccessPolicyResource,
  AccessPolicyResourceType,
} from "@/features/access-policies/model"
import { accessPolicyResourceTypeSchema } from "@/features/access-policies/model"
import { resolveAccessPolicyUpdateImpact } from "@/features/access-policies/access-policy-assignment"
import type { BackofficeErrorCode } from "@/domain/common"
import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  CommandErrorMessage,
} from "@/application/ui/backoffice-ui"

type CreationStep = 1 | 2 | 3 | 4
type PolicyConfigurationMode = "ui-feature" | "endpoint" | "custom"

const creationSteps: CreationStep[] = [1, 2, 3, 4]

const uiFeatureResourceTypes = new Set<AccessPolicyResourceType>([
  "ui-namespace",
  "ui-resource",
  "endpoint",
])

function inferConfigurationMode(
  policy: AccessPolicy | undefined,
): PolicyConfigurationMode {
  if (!policy) return "ui-feature"
  const types = new Set(policy.resources.map((resource) => resource.type))
  if (
    types.size === uiFeatureResourceTypes.size &&
    [...uiFeatureResourceTypes].every((type) => types.has(type))
  ) {
    return "ui-feature"
  }
  if (types.size === 1 && types.has("endpoint")) return "endpoint"
  return "custom"
}

function AccessPolicyEditorDialog({ policy }: { policy?: AccessPolicy }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.approvalDocuments")
  const common = useTranslations("backoffice.common")
  const formId = useId()
  const endpointSearchId = useId()
  const uiNamespaceSearchId = useId()
  const uiResourceSearchId = useId()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<CreationStep>(1)
  const [reviewingUpdate, setReviewingUpdate] = useState(false)
  const policyType = policy?.type ?? "access-grant"
  const initialConfigurationMode = inferConfigurationMode(policy)
  const initialResourceTypes = new Set<AccessPolicyResourceType>(
    policy?.resources.map((resource) => resource.type) ??
      uiFeatureResourceTypes,
  )
  const [configurationMode, setConfigurationMode] =
    useState<PolicyConfigurationMode>(initialConfigurationMode)
  const initialUiResourceNamespaceId = backoffice.uiResources.find(
    (resource) =>
      resource.id ===
      policy?.resources.find((reference) => reference.type === "ui-resource")
        ?.id,
  )?.namespaceId
  const [resourceTypes, setResourceTypes] =
    useState<Set<AccessPolicyResourceType>>(initialResourceTypes)
  const [activeResourceType, setActiveResourceType] =
    useState<AccessPolicyResourceType | null>(
      policy?.resources[0]?.type ?? "ui-resource",
    )
  const [name, setName] = useState(policy?.name ?? "")
  const [description, setDescription] = useState(policy?.description ?? "")
  const [resourceEffect, setResourceEffect] = useState<AccessPolicyEffect>(
    policy?.effect ?? "allow",
  )
  const [endpointIds, setEndpointIds] = useState<Set<string>>(
    new Set(
      policy?.resources
        .filter((resource) => resource.type === "endpoint")
        .map((resource) => resource.id) ?? [],
    ),
  )
  const [uiNamespaceIds, setUiNamespaceIds] = useState<Set<string>>(
    new Set(
      policy?.resources
        .filter((resource) => resource.type === "ui-namespace")
        .map((resource) => resource.id) ?? [],
    ),
  )
  const [uiResourceIds, setUiResourceIds] = useState<Set<string>>(
    new Set(
      policy?.resources
        .filter((resource) => resource.type === "ui-resource")
        .map((resource) => resource.id) ?? [],
    ),
  )
  const [uiResourceNamespaceId, setUiResourceNamespaceId] = useState<
    string | null
  >(initialUiResourceNamespaceId ?? null)
  const [endpointQuery, setEndpointQuery] = useState("")
  const [uiNamespaceQuery, setUiNamespaceQuery] = useState("")
  const [uiResourceQuery, setUiResourceQuery] = useState("")
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
        return service.status === "active" && service.type === "internal"
          ? [{ endpoint, service }]
          : []
      }),
    [backoffice.serviceEndpoints, backoffice.services],
  )
  const normalizedQuery = endpointQuery.trim().toLocaleLowerCase()
  const visibleEndpoints = endpointOptions.filter(({ endpoint, service }) =>
    `${service.name} ${endpoint.name} ${endpoint.method} ${endpoint.path}`
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  )
  const selectedEndpoints = endpointOptions.filter(({ endpoint }) =>
    endpointIds.has(endpoint.id),
  )
  const activeUiNamespaces = useMemo(
    () =>
      backoffice.uiNamespaces.filter(
        (namespace) => namespace.status === "active",
      ),
    [backoffice.uiNamespaces],
  )
  const activeUiNamespaceIds = useMemo(
    () => new Set(activeUiNamespaces.map((namespace) => namespace.id)),
    [activeUiNamespaces],
  )
  const normalizedUiNamespaceQuery = uiNamespaceQuery.trim().toLocaleLowerCase()
  const visibleUiNamespaces = activeUiNamespaces.filter((namespace) =>
    `${namespace.name} ${namespace.key}`
      .toLocaleLowerCase()
      .includes(normalizedUiNamespaceQuery),
  )
  const selectedUiNamespaces = activeUiNamespaces.filter((namespace) =>
    uiNamespaceIds.has(namespace.id),
  )
  const availableUiResources = useMemo(
    () =>
      backoffice.uiResources.filter(
        (resource) =>
          resource.orphanedAt === null &&
          activeUiNamespaceIds.has(resource.namespaceId),
      ),
    [activeUiNamespaceIds, backoffice.uiResources],
  )
  const normalizedUiResourceQuery = uiResourceQuery.trim().toLocaleLowerCase()
  const visibleUiResources = availableUiResources.filter((resource) => {
    if (resource.namespaceId !== uiResourceNamespaceId) return false
    const namespace = activeUiNamespaces.find(
      (item) => item.id === resource.namespaceId,
    )
    return `${namespace?.name ?? ""} ${namespace?.key ?? ""} ${resource.name} ${resource.key}`
      .toLocaleLowerCase()
      .includes(normalizedUiResourceQuery)
  })
  const visibleUiResourceOptions = visibleUiResources.map((resource) => {
    const namespace = activeUiNamespaces.find(
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
    const namespace = activeUiNamespaces.find(
      (item) => item.id === resource.namespaceId,
    )
    if (!namespace) {
      throw new Error(`UI Resource namespace not found: ${resource.id}`)
    }
    return { namespace, resource }
  })
  const resourceCount =
    endpointIds.size + uiNamespaceIds.size + uiResourceIds.size
  const selectedResources: AccessPolicyResource[] = [
    ...[...endpointIds].map((id) => ({ type: "endpoint" as const, id })),
    ...[...uiNamespaceIds].map((id) => ({
      type: "ui-namespace" as const,
      id,
    })),
    ...[...uiResourceIds].map((id) => ({
      type: "ui-resource" as const,
      id,
    })),
  ]
  const draftInput: AccessPolicyInput = {
    name,
    description,
    type: policyType,
    effect: resourceEffect,
    resources: selectedResources,
  }
  const updateImpact = policy
    ? resolveAccessPolicyUpdateImpact(backoffice, policy, draftInput)
    : null
  const policyChanged = Boolean(
    updateImpact &&
    (updateImpact.nameChanged ||
      updateImpact.descriptionChanged ||
      updateImpact.effectChanged ||
      updateImpact.addedResources.length > 0 ||
      updateImpact.removedResources.length > 0),
  )
  const metadataValid =
    name.trim().length >= 2 &&
    name.trim().length <= 100 &&
    description.trim().length >= 2 &&
    description.trim().length <= 500
  const canAdvance =
    step === 1
      ? metadataValid && approvalLines.length === 1
      : step === 2
        ? resourceTypes.size > 0
        : step === 3
          ? resourceCount > 0 &&
            [...resourceTypes].every((type) =>
              type === "endpoint"
                ? endpointIds.size > 0
                : type === "ui-namespace"
                  ? uiNamespaceIds.size > 0
                  : uiResourceNamespaceId !== null && uiResourceIds.size > 0,
            )
          : false
  const stepLabels = {
    1: t("creationSteps.metadata"),
    2: t("creationSteps.resourceType"),
    3: t("creationSteps.resources"),
    4: t("creationSteps.review"),
  }

  function reset() {
    setStep(1)
    setReviewingUpdate(false)
    setConfigurationMode(initialConfigurationMode)
    setResourceTypes(
      new Set<AccessPolicyResourceType>(
        policy?.resources.map((resource) => resource.type) ??
          uiFeatureResourceTypes,
      ),
    )
    setActiveResourceType(policy?.resources[0]?.type ?? "ui-resource")
    setName(policy?.name ?? "")
    setDescription(policy?.description ?? "")
    setResourceEffect(policy?.effect ?? "allow")
    setEndpointIds(
      new Set(
        policy?.resources
          .filter((resource) => resource.type === "endpoint")
          .map((resource) => resource.id) ?? [],
      ),
    )
    setUiNamespaceIds(
      new Set(
        policy?.resources
          .filter((resource) => resource.type === "ui-namespace")
          .map((resource) => resource.id) ?? [],
      ),
    )
    setUiResourceIds(
      new Set(
        policy?.resources
          .filter((resource) => resource.type === "ui-resource")
          .map((resource) => resource.id) ?? [],
      ),
    )
    setUiResourceNamespaceId(initialUiResourceNamespaceId ?? null)
    setEndpointQuery("")
    setUiNamespaceQuery("")
    setUiResourceQuery("")
    setError(undefined)
  }

  async function submit() {
    if (!sessionAccess.currentUser || resourceTypes.size === 0) {
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
    }
    setOpen(false)
    reset()
  }

  function goNext() {
    if (!canAdvance || step === 4) return
    setError(undefined)
    if (step === 1) setStep(2)
    else if (step === 2) setStep(3)
    else setStep(4)
  }

  function goPrevious() {
    if (step === 1) return
    setError(undefined)
    if (step === 4) setStep(3)
    else if (step === 3) setStep(2)
    else setStep(1)
  }

  function updateSelection(
    setter: Dispatch<SetStateAction<Set<string>>>,
    resourceId: string,
    checked: boolean,
  ) {
    setter((current) => {
      const next = new Set(current)
      if (checked) next.add(resourceId)
      else next.delete(resourceId)
      return next
    })
  }

  function getResourceTypeLabel(type: AccessPolicyResourceType) {
    if (type === "endpoint") return t("resourceTypeLabels.endpoint")
    if (type === "ui-namespace") {
      return t("resourceTypeLabels.ui-namespace")
    }
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
    if (type === "endpoint") {
      setEndpointIds(new Set())
      setEndpointQuery("")
    } else if (type === "ui-namespace") {
      setUiNamespaceIds(new Set())
      setUiNamespaceQuery("")
    } else {
      setUiResourceIds(new Set())
      setUiResourceNamespaceId(null)
      setUiResourceQuery("")
    }
  }

  function changeConfigurationMode(value: string) {
    if (value !== "ui-feature" && value !== "endpoint" && value !== "custom") {
      return
    }
    setConfigurationMode(value)
    if (value === "custom") return
    const nextTypes =
      value === "ui-feature"
        ? new Set<AccessPolicyResourceType>(uiFeatureResourceTypes)
        : new Set<AccessPolicyResourceType>(["endpoint"])
    setResourceTypes(nextTypes)
    setActiveResourceType(value === "ui-feature" ? "ui-resource" : "endpoint")
    if (value === "endpoint") {
      setUiNamespaceIds(new Set())
      setUiResourceIds(new Set())
      setUiResourceNamespaceId(null)
      setUiNamespaceQuery("")
      setUiResourceQuery("")
    }
  }

  function selectUiFeatureNamespace(value: string | null) {
    if (value === uiResourceNamespaceId) return
    setUiResourceNamespaceId(value)
    setUiNamespaceIds(value ? new Set([value]) : new Set())
    setUiResourceIds(new Set())
    setUiNamespaceQuery("")
    setUiResourceQuery("")
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
        value: "ui-feature",
        title: t("configurationModes.uiFeature.title"),
        description: t("configurationModes.uiFeature.description"),
        types: ["ui-namespace", "ui-resource", "endpoint"],
      },
      {
        value: "endpoint",
        title: t("configurationModes.endpoint.title"),
        description: t("configurationModes.endpoint.description"),
        types: ["endpoint"],
      },
      {
        value: "custom",
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
                        {configuration.value === "ui-feature" ? (
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
        {configurationMode === "custom" ? (
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
          options={[
            { value: "allow", label: t("allow") },
            { value: "deny", label: t("deny") },
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
        <Field>
          <FieldLabel htmlFor={`${formId}-name`}>{t("policyName")}</FieldLabel>
          <Input
            id={`${formId}-name`}
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
            }}
            required
            minLength={2}
            maxLength={100}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${formId}-description`}>
            {t("policyDescription")}
          </FieldLabel>
          <Textarea
            id={`${formId}-description`}
            name="description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value)
            }}
            required
            minLength={2}
            maxLength={500}
            rows={4}
          />
        </Field>
      </section>
    )
  }

  function renderSelectedResources(removable: boolean) {
    return (
      <aside
        className="flex min-h-0 min-w-0 flex-col gap-3 rounded-lg border bg-surface-subtle p-3"
        aria-label={t("selectedResources")}
      >
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-medium">{t("selectedResources")}</h4>
          <Badge variant="secondary">
            {t("resourceCount", { count: resourceCount })}
          </Badge>
        </div>
        {resourceCount > 0 ? (
          <ul
            className={
              removable
                ? "grid min-h-0 auto-rows-max content-start gap-2 overflow-y-auto sm:max-h-[min(50svh,32rem)] lg:max-h-none lg:flex-1"
                : "grid max-h-[min(50svh,28rem)] auto-rows-max content-start gap-2 overflow-y-auto"
            }
          >
            {selectedEndpoints.map(({ endpoint, service }) => (
              <li
                key={endpoint.id}
                className="flex min-w-0 items-start gap-2 rounded-md border bg-surface p-2"
              >
                <Badge variant="secondary" className="mt-0.5">
                  {t("resourceTypeLabels.endpoint")}
                </Badge>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {service.name}
                  </span>
                  <code className="truncate text-xs text-text-subtle">
                    {endpoint.method} {endpoint.path}
                  </code>
                  <span className="truncate text-xs text-muted-foreground">
                    {endpoint.name}
                  </span>
                </span>
                {removable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t("removeSelectedResource", {
                      name: `${service.name} ${endpoint.path}`,
                    })}
                    onClick={() => {
                      updateSelection(setEndpointIds, endpoint.id, false)
                    }}
                  >
                    <X />
                  </Button>
                ) : null}
              </li>
            ))}
            {selectedUiNamespaces.map((namespace) => (
              <li
                key={namespace.id}
                className="flex min-w-0 items-start gap-2 rounded-md border bg-surface p-2"
              >
                <Badge variant="secondary" className="mt-0.5">
                  {t("resourceTypeLabels.ui-namespace")}
                </Badge>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {namespace.name}
                  </span>
                  <code className="truncate text-xs text-text-subtle">
                    {namespace.key}
                  </code>
                </span>
                {removable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t("removeSelectedResource", {
                      name: namespace.name,
                    })}
                    onClick={() => {
                      updateSelection(setUiNamespaceIds, namespace.id, false)
                    }}
                  >
                    <X />
                  </Button>
                ) : null}
              </li>
            ))}
            {selectedUiResourceOptions.map(({ namespace, resource }) => (
              <li
                key={resource.id}
                className="flex min-w-0 items-start gap-2 rounded-md border bg-surface p-2"
              >
                <Badge variant="secondary" className="mt-0.5">
                  {t("resourceTypeLabels.ui-resource")}
                </Badge>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {namespace.name}
                  </span>
                  <code className="truncate text-xs text-text-subtle">
                    {resource.key}
                  </code>
                  <span className="truncate text-xs text-muted-foreground">
                    {resource.name}
                  </span>
                </span>
                {removable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t("removeSelectedResource", {
                      name: resource.name,
                    })}
                    onClick={() => {
                      updateSelection(setUiResourceIds, resource.id, false)
                    }}
                  >
                    <X />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
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
    const guidedUiFeature = configurationMode === "ui-feature"
    const selectableResourceTypes = [...resourceTypes].filter(
      (type) => !(guidedUiFeature && type === "ui-namespace"),
    )

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
            <FormSelect
              label={t("uiFeatureNamespace")}
              value={uiResourceNamespaceId}
              onValueChange={selectUiFeatureNamespace}
              options={activeUiNamespaces.map((namespace) => ({
                value: namespace.id,
                label: `${namespace.name} (${namespace.key})`,
              }))}
            />
            <ol
              className="grid gap-2 sm:grid-cols-3"
              aria-label={t("resourceSetupProgress")}
            >
              <li className="rounded-control border border-info-foreground/20 bg-surface px-3 py-2">
                <span className="block text-xs text-muted-foreground">
                  {t("resourceSetupSteps.namespace")}
                </span>
                <span className="font-medium">
                  {uiNamespaceIds.size > 0
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
          <Tabs
            value={
              guidedUiFeature && activeResourceType === "ui-namespace"
                ? "ui-resource"
                : activeResourceType
            }
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
            <TabsContent value="endpoint" className="grid min-h-0 gap-4">
              {resourceTypes.has("endpoint") ? (
                <>
                  <Field>
                    <FieldLabel htmlFor={endpointSearchId}>
                      {t("endpointSearch")}
                    </FieldLabel>
                    <Input
                      id={endpointSearchId}
                      type="search"
                      value={endpointQuery}
                      onChange={(event) => {
                        setEndpointQuery(event.target.value)
                      }}
                    />
                    <FieldDescription>
                      {t("endpointSearchDescription")}
                    </FieldDescription>
                  </Field>
                  <fieldset className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border p-2">
                    <legend className="sr-only">
                      {t("endpointSelection")}
                    </legend>
                    {visibleEndpoints.length > 0 ? (
                      visibleEndpoints.map(({ endpoint, service }) => (
                        <label
                          key={endpoint.id}
                          className="flex min-h-16 cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
                        >
                          <Checkbox
                            checked={endpointIds.has(endpoint.id)}
                            onCheckedChange={(checked) => {
                              updateSelection(
                                setEndpointIds,
                                endpoint.id,
                                checked,
                              )
                            }}
                          />
                          <span className="grid min-w-0 flex-1 gap-1">
                            <span className="font-medium">{service.name}</span>
                            <span className="flex min-w-0 items-center gap-2">
                              <Badge variant="outline">{endpoint.method}</Badge>
                              <code className="truncate text-xs">
                                {endpoint.path}
                              </code>
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {endpoint.name}
                            </span>
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                        {common("noResults")}
                      </p>
                    )}
                  </fieldset>
                </>
              ) : null}
            </TabsContent>
            <TabsContent value="ui-namespace" className="grid min-h-0 gap-4">
              {resourceTypes.has("ui-namespace") ? (
                <>
                  <Field>
                    <FieldLabel htmlFor={uiNamespaceSearchId}>
                      {t("uiNamespaceSearch")}
                    </FieldLabel>
                    <Input
                      id={uiNamespaceSearchId}
                      type="search"
                      value={uiNamespaceQuery}
                      onChange={(event) => {
                        setUiNamespaceQuery(event.target.value)
                      }}
                    />
                    <FieldDescription>
                      {t("uiNamespaceSearchDescription")}
                    </FieldDescription>
                  </Field>
                  <fieldset className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border p-2">
                    <legend className="sr-only">
                      {t("uiNamespaceSelection")}
                    </legend>
                    {visibleUiNamespaces.length > 0 ? (
                      visibleUiNamespaces.map((namespace) => (
                        <label
                          key={namespace.id}
                          className="flex min-h-14 cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
                        >
                          <Checkbox
                            checked={uiNamespaceIds.has(namespace.id)}
                            onCheckedChange={(checked) => {
                              updateSelection(
                                setUiNamespaceIds,
                                namespace.id,
                                checked,
                              )
                            }}
                          />
                          <span className="grid min-w-0 flex-1 gap-1">
                            <span className="font-medium">
                              {namespace.name}
                            </span>
                            <code className="truncate text-xs text-text-subtle">
                              {namespace.key}
                            </code>
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                        {common("noResults")}
                      </p>
                    )}
                  </fieldset>
                </>
              ) : null}
            </TabsContent>
            <TabsContent value="ui-resource" className="grid min-h-0 gap-4">
              {resourceTypes.has("ui-resource") ? (
                <>
                  <div className="grid gap-1.5">
                    <FormSelect
                      label={t("uiResourceNamespace")}
                      value={uiResourceNamespaceId}
                      onValueChange={(value) => {
                        if (value === uiResourceNamespaceId) return
                        setUiResourceNamespaceId(value)
                        setUiResourceIds(new Set())
                        setUiResourceQuery("")
                      }}
                      options={activeUiNamespaces.map((namespace) => ({
                        value: namespace.id,
                        label: `${namespace.name} (${namespace.key})`,
                      }))}
                    />
                    <FieldDescription>
                      {t("uiResourceNamespaceDescription")}
                    </FieldDescription>
                  </div>
                  <Field>
                    <FieldLabel htmlFor={uiResourceSearchId}>
                      {t("uiResourceSearch")}
                    </FieldLabel>
                    <Input
                      id={uiResourceSearchId}
                      type="search"
                      value={uiResourceQuery}
                      onChange={(event) => {
                        setUiResourceQuery(event.target.value)
                      }}
                    />
                    <FieldDescription>
                      {t("uiResourceSearchDescription")}
                    </FieldDescription>
                  </Field>
                  <fieldset className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border p-2">
                    <legend className="sr-only">
                      {t("uiResourceSelection")}
                    </legend>
                    {uiResourceNamespaceId === null ? (
                      <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                        {t("selectUiResourceNamespace")}
                      </p>
                    ) : visibleUiResourceOptions.length > 0 ? (
                      visibleUiResourceOptions.map(
                        ({ namespace, resource }) => (
                          <label
                            key={resource.id}
                            className="flex min-h-16 cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
                          >
                            <Checkbox
                              checked={uiResourceIds.has(resource.id)}
                              onCheckedChange={(checked) => {
                                updateSelection(
                                  setUiResourceIds,
                                  resource.id,
                                  checked,
                                )
                              }}
                            />
                            <span className="grid min-w-0 flex-1 gap-1">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate font-medium">
                                  {namespace.name}
                                </span>
                                <Badge variant="outline">{resource.type}</Badge>
                              </span>
                              <code className="truncate text-xs text-text-subtle">
                                {resource.key}
                              </code>
                              <span className="truncate text-xs text-muted-foreground">
                                {resource.name}
                              </span>
                            </span>
                          </label>
                        ),
                      )
                    ) : (
                      <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                        {common("noResults")}
                      </p>
                    )}
                  </fieldset>
                </>
              ) : null}
            </TabsContent>
          </Tabs>
          {renderSelectedResources(true)}
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
    if (!policy || !updateImpact) return null
    const affectedUsers = updateImpact.affectedUserIds.map((userId) => {
      const user = backoffice.users.find((candidate) => candidate.id === userId)
      if (!user) throw new Error(`Affected policy user not found: ${userId}`)
      return user
    })
    const assignmentTypes = ["user", "organization", "role", "group"] as const

    return (
      <div className="grid gap-4">
        {renderReview()}
        <section
          className="grid gap-4 rounded-card border border-warning-foreground/30 bg-warning p-4"
          aria-labelledby={`${formId}-update-impact`}
        >
          <div className="grid gap-1">
            <h3 id={`${formId}-update-impact`} className="font-semibold">
              {t("updateImpactTitle")}
            </h3>
            <p className="text-sm text-warning-foreground">
              {t("updateImpactDescription")}
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="grid content-start gap-3 rounded-card border border-warning-foreground/20 bg-surface p-3">
              <h4 className="text-sm font-semibold">{t("changeSummary")}</h4>
              <div className="flex flex-wrap gap-2">
                {updateImpact.nameChanged ? (
                  <Badge variant="outline">{t("changedFields.name")}</Badge>
                ) : null}
                {updateImpact.descriptionChanged ? (
                  <Badge variant="outline">
                    {t("changedFields.description")}
                  </Badge>
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
                {!policyChanged ? (
                  <span className="text-sm text-muted-foreground">
                    {t("noPolicyChanges")}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid content-start gap-3 rounded-card border border-warning-foreground/20 bg-surface p-3">
              <h4 className="text-sm font-semibold">
                {t("assignmentImpactTitle")}
              </h4>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {assignmentTypes.map((targetType) => (
                  <div key={targetType} className="grid gap-0.5">
                    <dt className="text-xs text-muted-foreground">
                      {t(`assignmentTargetTypes.${targetType}`)}
                    </dt>
                    <dd className="font-semibold">
                      {updateImpact.assignmentCounts[targetType]}
                    </dd>
                  </div>
                ))}
                <div className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">
                    {t("affectedUsers")}
                  </dt>
                  <dd className="font-semibold">{affectedUsers.length}</dd>
                </div>
              </dl>
            </div>
          </div>
          {affectedUsers.length > 0 ? (
            <div className="grid gap-2">
              <h4 className="text-sm font-semibold">
                {t("notificationRecipients")}
              </h4>
              <ul className="grid max-h-36 auto-rows-max grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {affectedUsers.map((user) => (
                  <li
                    key={user.id}
                    className="grid gap-0.5 rounded-control border border-warning-foreground/20 bg-surface px-3 py-2"
                  >
                    <span className="font-medium">{user.nickname}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-warning-foreground">
                {t("notificationRecipientsDescription")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-warning-foreground">
              {t("noAffectedUsers")}
            </p>
          )}
        </section>
      </div>
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      <DialogTrigger render={<Button />}>
        {policy ? <Pencil /> : <Plus />}
        {t(policy ? "updatePolicy" : "createPolicy")}
      </DialogTrigger>
      <FormDialogContent className="max-h-[min(90svh,56rem)] max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {t(policy ? "updatePolicy" : "createPolicy")}
          </DialogTitle>
          <DialogDescription>
            {t(policy ? "updatePolicyDescription" : "createPolicyDescription")}
          </DialogDescription>
        </DialogHeader>
        {!policy ? (
          <div aria-label={t("creationProgress")}>
            <ol className="grid grid-cols-4 gap-1 rounded-card bg-surface-subtle p-1.5">
              {creationSteps.map((item) => (
                <li
                  key={item}
                  aria-current={item === step ? "step" : undefined}
                  className="flex min-w-0 items-center justify-center gap-2 rounded-control px-2 py-1.5 text-center"
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                      item <= step
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-text-subtle"
                    }`}
                  >
                    {item}
                  </span>
                  <span className="hidden truncate text-xs font-medium md:block">
                    {stepLabels[item]}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <form
          id={formId}
          className="grid min-h-0 gap-4 overflow-y-auto pr-1"
          tabIndex={0}
          aria-label={t(policy ? "updatePolicy" : "createPolicy")}
          onSubmit={(event) => {
            event.preventDefault()
            if (!policy && step < 4) {
              goNext()
              return
            }
            if (policy && !reviewingUpdate) {
              setReviewingUpdate(true)
              setError(undefined)
              return
            }
            void submit()
          }}
        >
          {policy && reviewingUpdate ? (
            renderUpdateImpact()
          ) : policy ? (
            <>
              {renderMetadata()}
              {renderResourceConfiguration()}
              {renderResources()}
            </>
          ) : step === 1 ? (
            renderMetadata()
          ) : step === 2 ? (
            renderResourceConfiguration()
          ) : step === 3 ? (
            renderResources()
          ) : (
            renderReview()
          )}
          <CommandErrorMessage error={error} />
        </form>
        <DialogFooter className="border-t border-border-subtle pt-3">
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          {!policy && step > 1 ? (
            <Button type="button" variant="outline" onClick={goPrevious}>
              {common("previous")}
            </Button>
          ) : null}
          {policy && reviewingUpdate ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReviewingUpdate(false)
                setError(undefined)
              }}
            >
              {common("previous")}
            </Button>
          ) : null}
          {!policy && step < 4 ? (
            <Button
              key="next-step"
              type="button"
              disabled={!canAdvance}
              onClick={goNext}
            >
              {common("next")}
            </Button>
          ) : policy && !reviewingUpdate ? (
            <Button
              key="review-policy-impact"
              type="submit"
              form={formId}
              disabled={
                approvalLines.length !== 1 ||
                !metadataValid ||
                resourceTypes.size === 0 ||
                resourceCount === 0 ||
                !policyChanged
              }
            >
              {t("reviewUpdateImpact")}
            </Button>
          ) : (
            <Button
              key="submit-policy"
              type="submit"
              form={formId}
              disabled={
                approvalLines.length !== 1 ||
                !metadataValid ||
                resourceTypes.size === 0 ||
                resourceCount === 0
              }
            >
              {common(policy ? "save" : "create")}
            </Button>
          )}
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

export function AccessPolicyCreationDialog() {
  return <AccessPolicyEditorDialog />
}

export function AccessPolicyUpdateDialog({ policy }: { policy: AccessPolicy }) {
  return <AccessPolicyEditorDialog policy={policy} />
}
