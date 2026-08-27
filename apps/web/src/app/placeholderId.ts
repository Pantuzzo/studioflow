/**
 * Ids for rows that exist on screen but not yet on the server.
 *
 * A counter rather than a uuid: it needs to be unique within one page session
 * and nothing more, and it keeps tests deterministic. Shared by every feature
 * that inserts optimistically, so the prefix has exactly one definition.
 */
let seq = 0

export const nextPlaceholderId = (): string => `temp_${(seq += 1)}`

export const isPlaceholderId = (id: string): boolean => id.startsWith('temp_')
