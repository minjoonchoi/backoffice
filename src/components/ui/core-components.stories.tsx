import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { LoaderCircleIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { expect, userEvent, within } from "storybook/test"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const meta = {
  title: "Components/Core",
} satisfies Meta

export default meta
type Story = StoryObj

export const ButtonVariants: Story = {
  render: () => (
    <section aria-label="Button variants" className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">
          <Trash2Icon /> Delete
        </Button>
        <Button variant="link">Link</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm">Small</Button>
        <Button size="default">Default size</Button>
        <Button size="lg">Large</Button>
        <Button size="icon-sm" aria-label="Add small">
          <PlusIcon />
        </Button>
        <Button size="icon" aria-label="Add">
          <PlusIcon />
        </Button>
        <Button size="icon-lg" aria-label="Add large">
          <PlusIcon />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled>Disabled</Button>
        <Button disabled aria-busy="true">
          <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          Loading
        </Button>
        <Button aria-invalid="true">Invalid action</Button>
      </div>
    </section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await expect(canvas.getByRole("button", { name: "Default" })).toHaveFocus()
  },
}

export const BadgeVariants: Story = {
  render: () => (
    <section aria-label="Badge variants" className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="destructive">Destructive</Badge>
    </section>
  ),
}

export const InputStates: Story = {
  render: () => (
    <section aria-label="Input states" className="grid max-w-md gap-5">
      <div className="grid gap-1.5">
        <Label htmlFor="input-default">Default</Label>
        <Input id="input-default" placeholder="Search operators" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="input-readonly">Read-only</Label>
        <Input id="input-readonly" value="operator@example.com" readOnly />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="input-disabled">Disabled</Label>
        <Input id="input-disabled" value="Unavailable" disabled readOnly />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="input-invalid">Invalid</Label>
        <Input
          id="input-invalid"
          defaultValue="invalid"
          aria-invalid="true"
          aria-describedby="input-invalid-message"
        />
        <p
          id="input-invalid-message"
          role="alert"
          className="text-sm text-destructive-foreground"
        >
          Use a valid operator ID.
        </p>
      </div>
    </section>
  ),
}

export const CardAndSkeleton: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Pending approvals</CardTitle>
          <CardDescription>
            Items waiting for an operator decision.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">28</p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="outline">Review</Button>
        </CardFooter>
      </Card>
      <Card aria-busy="true" aria-label="Loading approval summary">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="grid gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-28" />
        </CardContent>
      </Card>
    </div>
  ),
}

export const CompactTable: Story = {
  render: () => (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>Recent requests</CardTitle>
        <CardDescription>
          Compact 40px rows for operational scanning.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption>Three most recent access requests</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>REQ-1048</TableCell>
              <TableCell>김민준</TableCell>
              <TableCell>
                <Badge variant="warning">Pending</Badge>
              </TableCell>
              <TableCell className="text-right">12m</TableCell>
            </TableRow>
            <TableRow aria-selected="true">
              <TableCell>REQ-1047</TableCell>
              <TableCell>Alex Johnson</TableCell>
              <TableCell>
                <Badge variant="success">Approved</Badge>
              </TableCell>
              <TableCell className="text-right">24m</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>REQ-1046</TableCell>
              <TableCell>박서연</TableCell>
              <TableCell>
                <Badge variant="destructive">Rejected</Badge>
              </TableCell>
              <TableCell className="text-right">31m</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  ),
}
