import type { CommandResult } from "@/domain/common"
import type {
  ApiKey,
  ApiKeyEmergencyRevokeInput,
  ApiKeyRegistration,
  ApiKeyRegistrationInput,
  CredentialLifecycleSettings,
  CredentialLifecycleSettingsInput,
} from "@/features/credentials/model"

export interface CredentialApi {
  registerApiKey: (
    input: ApiKeyRegistrationInput,
  ) => Promise<CommandResult<ApiKeyRegistration>>
  updateCredentialLifecycleSettings: (
    input: CredentialLifecycleSettingsInput,
    requesterId: string,
  ) => Promise<CommandResult<CredentialLifecycleSettings>>
  emergencyRevokeApiKey: (
    input: ApiKeyEmergencyRevokeInput,
  ) => Promise<CommandResult<ApiKey>>
}

export interface CredentialApiClient {
  registerApiKey: (request: {
    body: ApiKeyRegistrationInput
  }) => Promise<CommandResult<ApiKeyRegistration>>
  updateCredentialLifecycleSettings: (request: {
    body: CredentialLifecycleSettingsInput
    requesterId: string
  }) => Promise<CommandResult<CredentialLifecycleSettings>>
  emergencyRevokeApiKey: (request: {
    body: ApiKeyEmergencyRevokeInput
  }) => Promise<CommandResult<ApiKey>>
}
