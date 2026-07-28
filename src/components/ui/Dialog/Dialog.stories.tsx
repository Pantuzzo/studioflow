import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../Button'
import { Field } from '../Field'
import { Input } from '../Input'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from './Dialog'

const meta = {
  title: 'UI/Dialog',
  component: DialogContent,
  tags: ['autodocs'],
  // Required by DialogContent's type; the story's `render` supplies the real tree.
  args: { title: 'Edit client', children: null },
} satisfies Meta<typeof DialogContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Edit client</Button>
      </DialogTrigger>
      <DialogContent
        title="Edit client"
        description="Update the client's details."
      >
        <Field label="Name">
          <Input defaultValue="Ava Thompson" />
        </Field>
        <Field label="Email">
          <Input type="email" defaultValue="ava@northwind.studio" />
        </Field>
        <div
          style={{
            display: 'flex',
            gap: 'var(--sf-space-2)',
            justifyContent: 'flex-end',
          }}
        >
          <DialogClose asChild>
            <Button variant="soft">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Save</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  ),
}
