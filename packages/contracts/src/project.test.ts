import { describe, expect, it } from 'vitest'
import {
  createProjectSchema,
  projectSchema,
  updateProjectSchema,
} from './index'

const PROJECT = {
  id: 'pr_001',
  name: 'Website relaunch',
  status: 'active',
  clientId: 'cl_001',
  clientName: 'Northwind Studio',
  createdAt: '2026-05-04T10:00:00.000Z',
}

describe('projectSchema', () => {
  it('accepts a project as the API returns it', () => {
    expect(projectSchema.safeParse(PROJECT).success).toBe(true)
  })

  it('rejects a status outside the set the app owns', () => {
    // Unlike a client's currency, this is not a value the database might hold
    // from some earlier era — reads are as strict as writes.
    expect(
      projectSchema.safeParse({ ...PROJECT, status: 'archived' }).success,
    ).toBe(false)
  })
})

describe('createProjectSchema', () => {
  const input = {
    name: 'Website relaunch',
    clientId: 'cl_001',
    status: 'active',
  }

  it('drops the derived and server-owned fields', () => {
    const parsed = createProjectSchema.parse({
      ...input,
      id: 'pr_forged',
      clientName: 'Someone Else',
      createdAt: '1999-01-01T00:00:00.000Z',
    })
    // clientName is derived from clientId; accepting both invites disagreement.
    expect(parsed).toEqual(input)
  })

  it('requires a client', () => {
    const result = createProjectSchema.safeParse({ ...input, clientId: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'Choose a client for this project',
    )
  })

  it('trims the name and treats whitespace as empty', () => {
    expect(
      createProjectSchema.parse({ ...input, name: '  Rebrand ' }).name,
    ).toBe('Rebrand')
    const result = createProjectSchema.safeParse({ ...input, name: '  ' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Enter a name')
  })
})

describe('updateProjectSchema', () => {
  it('accepts a single-field patch', () => {
    expect(updateProjectSchema.safeParse({ status: 'paused' }).success).toBe(
      true,
    )
  })

  it('rejects an empty patch', () => {
    const result = updateProjectSchema.safeParse({})
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'Provide at least one field to update',
    )
  })
})
