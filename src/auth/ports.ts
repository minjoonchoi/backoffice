import type { AuthPort, Viewer } from "@/auth/types"

const developmentViewer: Viewer = Object.freeze({
  id: "development-viewer",
  displayName: "Backoffice",
  permissions: Object.freeze([]),
})

export const developmentAuthPort: AuthPort = {
  getCurrentViewer() {
    return Promise.resolve(developmentViewer)
  },
}

export const unauthenticatedAuthPort: AuthPort = {
  getCurrentViewer() {
    return Promise.resolve(null)
  },
}

export function getAuthPort(environment = process.env.NODE_ENV): AuthPort {
  return environment === "production"
    ? unauthenticatedAuthPort
    : developmentAuthPort
}
