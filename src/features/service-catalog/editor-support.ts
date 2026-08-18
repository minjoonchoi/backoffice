import {
  endpointFieldLocationValues,
  type ServiceEndpointField,
  type ServiceEndpointFieldInput,
} from "@/features/service-catalog/model"

function parseJsonArray(value: string): unknown[] | null {
  const source = value.trim()
  if (!source) return []
  try {
    const parsed: unknown = JSON.parse(source)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function setBodyFieldLocation(
  field: unknown,
  location:
    | typeof endpointFieldLocationValues.requestBody
    | typeof endpointFieldLocationValues.responseBody,
): unknown {
  if (typeof field !== "object" || field === null || Array.isArray(field)) {
    return field
  }
  return { ...field, location }
}

export function parseEndpointFields(
  requestParametersSource: string,
  requestBodySource: string,
  responseBodySource: string,
): unknown {
  const parameters = parseJsonArray(requestParametersSource)
  const requestBody = parseJsonArray(requestBodySource)
  const responseBody = parseJsonArray(responseBodySource)
  if (!parameters || !requestBody || !responseBody) return null
  return [
    ...parameters,
    ...requestBody.map((field) =>
      setBodyFieldLocation(field, endpointFieldLocationValues.requestBody),
    ),
    ...responseBody.map((field) =>
      setBodyFieldLocation(field, endpointFieldLocationValues.responseBody),
    ),
  ]
}

export function toEndpointFieldInput(
  field: ServiceEndpointField,
): ServiceEndpointFieldInput {
  return {
    location: field.location,
    fieldPath: field.fieldPath,
    valueType: field.valueType,
    required: field.required,
    description: field.description,
  }
}
