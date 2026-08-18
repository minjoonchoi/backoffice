import {
  endpointFieldLocationValues,
  type ServiceEndpointField,
  type ServiceEndpointFieldInput,
} from "@/features/service-catalog/model"

export function parseEndpointFieldSection(
  value: string,
  location?:
    | typeof endpointFieldLocationValues.requestBody
    | typeof endpointFieldLocationValues.responseBody,
): unknown[] | null {
  const source = value.trim()
  if (!source) return []
  try {
    const parsed: unknown = JSON.parse(source)
    if (!Array.isArray(parsed)) return null
    return parsed.map((field: unknown) =>
      location ? setBodyFieldLocation(field, location) : field,
    )
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
  const parameters = parseEndpointFieldSection(requestParametersSource)
  const requestBody = parseEndpointFieldSection(
    requestBodySource,
    endpointFieldLocationValues.requestBody,
  )
  const responseBody = parseEndpointFieldSection(
    responseBodySource,
    endpointFieldLocationValues.responseBody,
  )
  if (!parameters || !requestBody || !responseBody) return null
  return [...parameters, ...requestBody, ...responseBody]
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
