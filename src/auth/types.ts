export type Permission = string

export type Viewer = Readonly<{
  id: string
  displayName: string
  permissions: readonly Permission[]
}>

export interface AuthPort {
  getCurrentViewer(): Promise<Viewer | null>
}
