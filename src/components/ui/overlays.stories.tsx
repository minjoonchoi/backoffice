import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const meta = {
  title: "Components/Overlays",
} satisfies Meta

export default meta
type Story = StoryObj

export const DropdownStates: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Open operator menu
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Operator</DropdownMenuLabel>
          <DropdownMenuItem>View profile</DropdownMenuItem>
          <DropdownMenuItem>Reset session</DropdownMenuItem>
          <DropdownMenuItem disabled>Transfer ownership</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive-foreground">
          Revoke access
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

export const DialogInteraction: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>Edit operator</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit operator</DialogTitle>
          <DialogDescription>
            Update the display name. Focus stays inside this dialog until it
            closes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="dialog-name">Display name</Label>
          <Input id="dialog-name" defaultValue="Alex Johnson" />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <DialogClose render={<Button />}>Save</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Edit operator" })
    trigger.focus()
    await userEvent.keyboard("{Enter}")

    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog")
    await waitFor(async () => {
      await expect(dialog).toBeVisible()
    })
    await expect(dialog.contains(dialog.ownerDocument.activeElement)).toBe(true)

    await userEvent.tab()
    await expect(dialog.contains(dialog.ownerDocument.activeElement)).toBe(true)
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(body.queryByRole("dialog")).not.toBeInTheDocument()
    })
    await expect(trigger).toHaveFocus()
  },
}

export const AlertDialogState: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        Revoke access
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke operator access?</AlertDialogTitle>
          <AlertDialogDescription>
            The operator will be signed out and unable to access backoffice
            tools.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Revoke</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
}

export const DialogOverflow: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>Open long dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review policy changes</DialogTitle>
          <DialogDescription>
            This fixture verifies that long content remains within a small
            viewport.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {Array.from({ length: 8 }, (_, index) => (
            <section key={index} className="grid gap-1">
              <h3 className="font-medium">Policy section {index + 1}</h3>
              <p className="leading-6 text-muted-foreground">
                Operators must review the requested change, its audit context,
                and all affected accounts before approval.
              </p>
            </section>
          ))}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          <Button>Confirm review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

export const DialogKeyboardFixture: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard dialog</DialogTitle>
          <DialogDescription>
            Use Tab to move focus and Escape to return it to the trigger.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="keyboard-dialog-input">Operator note</Label>
          <Input id="keyboard-dialog-input" />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
