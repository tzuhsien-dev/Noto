import { z } from 'zod'
import { PRIORITIES } from './types'

const isoDate = z.iso.datetime({ offset: true })

export const prioritySchema = z.enum(PRIORITIES)

export const taskSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(20_000).nullable(),
  completed: z.boolean(),
  priority: prioritySchema,
  dueAt: isoDate.nullable(),
  startAt: isoDate.nullable(),
  projectId: z.uuid().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
  completedAt: isoDate.nullable(),
  deletedAt: isoDate.nullable(),
  version: z.number().int().min(1),
})

export const noteSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  title: z.string().max(500),
  content: z.string().max(200_000),
  pinned: z.boolean(),
  archived: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate,
  deletedAt: isoDate.nullable(),
  version: z.number().int().min(1),
})

export const checklistItemSchema = z.object({
  id: z.uuid(),
  noteId: z.uuid(),
  userId: z.uuid(),
  content: z.string().max(2_000),
  completed: z.boolean(),
  position: z.number(),
  createdAt: isoDate,
  updatedAt: isoDate,
  version: z.number().int().min(1),
})

export const projectSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string().min(1).max(200),
  icon: z.string().max(50).nullable(),
  position: z.number(),
  archived: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate,
  version: z.number().int().min(1),
})

export const tagSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string().min(1).max(100),
  createdAt: isoDate,
  updatedAt: isoDate,
  version: z.number().int().min(1),
})

export const taskTagSchema = z.object({
  taskId: z.uuid(),
  tagId: z.uuid(),
  userId: z.uuid(),
})

export const noteTagSchema = z.object({
  noteId: z.uuid(),
  tagId: z.uuid(),
  userId: z.uuid(),
})

/** Form inputs (user-editable subset). */
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  description: z.string().max(20_000),
  priority: prioritySchema,
  dueAt: z.string().nullable(),
  projectId: z.string().nullable(),
})

export const loginFormSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
