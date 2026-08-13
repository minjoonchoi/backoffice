import type { CommandResult } from "@/domain/common"
import type {
  ApiKeyRegistration,
  ApiKeyRegistrationInput,
} from "@/features/credentials/model"

export interface CredentialApi {
  registerApiKey: (
    input: ApiKeyRegistrationInput,
  ) => Promise<CommandResult<ApiKeyRegistration>>
}

export interface CredentialApiClient {
  registerApiKey: (request: {
    body: ApiKeyRegistrationInput
  }) => Promise<CommandResult<ApiKeyRegistration>>
}
