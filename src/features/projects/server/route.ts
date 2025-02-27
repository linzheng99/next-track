import { zValidator } from "@hono/zod-validator"
import { endOfMonth, startOfMonth, subMonths } from 'date-fns'
import { Hono } from "hono"
import { ID, Query } from "node-appwrite"
import { z } from "zod"

import { DATABASES_ID, IMAGES_BUCKET_ID, PROJECTS_ID, TASKS_ID } from "@/config"
import { getMember } from "@/features/members/utils"
import { TaskStatus } from "@/features/tasks/types"
import { createSessionClient } from "@/lib/appwrite"
import { sessionMiddleware } from "@/lib/session-middleware"

import { createProjectSchema, updateProjectSchema } from "../schemas"
import { type Project } from "../types"

const app = new Hono()
  .post('/',
    sessionMiddleware,
    zValidator('form', createProjectSchema),
    async (c) => {
      const databases = c.get('databases')
      const user = c.get('user')
      const sotrage = c.get('storage')

      const { name, image, workspaceId } = c.req.valid('form')

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id
      })

      if (!member) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      let uploadedImageUrl: string = ''

      if (image instanceof File) {
        const file = await sotrage.createFile(
          IMAGES_BUCKET_ID,
          ID.unique(),
          image
        )
        const arrayBuffer = await sotrage.getFilePreview(
          IMAGES_BUCKET_ID,
          file.$id
        )
        const mimeType = image.type || 'image/png'
        uploadedImageUrl = `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString('base64')}`
      }

      const project = await databases.createDocument(
        DATABASES_ID,
        PROJECTS_ID,
        ID.unique(),
        {
          name,
          image: uploadedImageUrl,
          workspaceId
        }
      );

      return c.json({ data: project })
    }
  )
  .get(
    '/',
    sessionMiddleware,
    zValidator('query', z.object({ workspaceId: z.string() })),
    async (c) => {
      const databases = c.get('databases')
      const user = c.get('user')
      const { workspaceId } = c.req.valid('query')

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id
      })

      if (!member) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const projects = await databases.listDocuments<Project>(
        DATABASES_ID,
        PROJECTS_ID,
        [
          Query.equal('workspaceId', workspaceId),
          Query.orderDesc('$createdAt')
        ]
      )

      return c.json({ data: projects })

    }
  )
  .get(
    '/:projectId',
    sessionMiddleware,
    async (c) => {
      const databases = c.get('databases')
      const user = c.get('user')
      const { projectId } = c.req.param()

      const project = await databases.getDocument<Project>(
        DATABASES_ID,
        PROJECTS_ID,
        projectId
      )

      const member = await getMember({
        databases,
        workspaceId: project.workspaceId,
        userId: user.$id
      })

      if (!member) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      return c.json({ data: project })
    }
  )
  .patch(
    '/:projectId',
    sessionMiddleware,
    zValidator('form', updateProjectSchema),
    async (c) => {
      const databases = c.get('databases')
      const sotrage = c.get('storage')
      const user = c.get('user')

      const { projectId } = c.req.param()
      const { name, image } = c.req.valid('form')

      const existingProject = await databases.getDocument(
        DATABASES_ID,
        PROJECTS_ID,
        projectId
      )

      const member = await getMember({
        databases,
        workspaceId: existingProject.workspaceId,
        userId: user.$id
      })

      if (!member) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      let uploadedImageUrl: string = ''
      if (image instanceof File) {
        const file = await sotrage.createFile(
          IMAGES_BUCKET_ID,
          ID.unique(),
          image
        )
        const arrayBuffer = await sotrage.getFilePreview(
          IMAGES_BUCKET_ID,
          file.$id
        )
        const mimeType = image.type || 'image/png'
        uploadedImageUrl = `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString('base64')}`
      } else {
        uploadedImageUrl = image || ''
      }

      const project = await databases.updateDocument(
        DATABASES_ID,
        PROJECTS_ID,
        projectId,
        {
          name,
          image: uploadedImageUrl,
          workspaceId: existingProject.workspaceId
        }
      );

      return c.json({ data: project })
    }
  )
  .delete(
    '/:projectId',
    sessionMiddleware,
    async (c) => {
      const { databases, account } = await createSessionClient()
      const user = await account.get()

      const { projectId } = c.req.param()

      const existingProject = await databases.getDocument(
        DATABASES_ID,
        PROJECTS_ID,
        projectId
      )

      const member = await getMember({
        databases,
        workspaceId: existingProject.workspaceId,
        userId: user.$id
      })

      if (!member) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      await databases.deleteDocument(DATABASES_ID, PROJECTS_ID, projectId)

      return c.json({ data: { $id: existingProject.$id } })
    }
  )
  .get(
    '/:projectId/analytics',
    sessionMiddleware,
    async (c) => {
      const databases = c.get('databases')
      const user = c.get('user')
      const { projectId } = c.req.param()

      const project = await databases.getDocument<Project>(
        DATABASES_ID,
        PROJECTS_ID,
        projectId
      )

      const member = await getMember({
        databases,
        workspaceId: project.workspaceId,
        userId: user.$id
      })

      if (!member) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const now = new Date()
      const thisMonthStart = startOfMonth(now)
      const thisMonthEnd = endOfMonth(now)
      const lastMonthStart = startOfMonth(subMonths(now, 1))
      const lastMonthEnd = endOfMonth(subMonths(now, 1))

      // This Month Tasks 当前月任务
      const thisMonthTasks = await databases.listDocuments(
        DATABASES_ID,
        TASKS_ID,
        [
          Query.equal('projectId', projectId),
          Query.greaterThanEqual('$createdAt', thisMonthStart.toISOString()),
          Query.lessThanEqual('$createdAt', thisMonthEnd.toISOString()),
        ]
      )

      // Last Month Tasks 上个月任务
      const lastMonthTasks = await databases.listDocuments(
        DATABASES_ID,
        TASKS_ID,
        [
          Query.equal('projectId', projectId),
          Query.greaterThanEqual('$createdAt', lastMonthStart.toISOString()),
          Query.lessThanEqual('$createdAt', lastMonthEnd.toISOString()),
        ]
      )

      const taskCount = thisMonthTasks.total
      const taskDifference = taskCount - lastMonthTasks.total

      // Assigned Tasks 这个月分配的任务
      const thisMonthAssignedTasks = await databases.listDocuments(
        DATABASES_ID,
        TASKS_ID,
        [
          Query.equal('projectId', projectId),
          Query.equal('assigneeId', member.$id),
          Query.greaterThanEqual('$createdAt', thisMonthStart.toISOString()),
          Query.lessThanEqual('$createdAt', thisMonthEnd.toISOString()),
        ]
      )
      // Last Month Assigned Tasks 上个月分配的任务
      const lastMonthAssignedTasks = await databases.listDocuments(
        DATABASES_ID,
        TASKS_ID,
        [
          Query.equal('projectId', projectId),
          Query.equal('assigneeId', member.$id),
          Query.greaterThanEqual('$createdAt', lastMonthStart.toISOString()),
          Query.lessThanEqual('$createdAt', lastMonthEnd.toISOString()),
        ]
      )

      const assignedTaskCount = thisMonthAssignedTasks.total
      const assignedTaskDifference = assignedTaskCount - lastMonthAssignedTasks.total

      // Incompleted Tasks 未完成
      const thisMonthInCompletedTasks = await databases.listDocuments(
        DATABASES_ID,
        TASKS_ID,
        [
          Query.equal('projectId', projectId),
          Query.equal('assigneeId', member.$id),
          Query.notEqual('status', TaskStatus.DONE),
          Query.greaterThanEqual('$createdAt', thisMonthStart.toISOString()),
          Query.lessThanEqual('$createdAt', thisMonthEnd.toISOString()),
        ]
      )

      // Last Month Incompleted Tasks 未完成
      const lastMonthInCompletedTasks = await databases.listDocuments(
        DATABASES_ID,
        TASKS_ID,
        [
          Query.equal('projectId', projectId),
          Query.equal('assigneeId', member.$id),
          Query.notEqual('status', TaskStatus.DONE),
          Query.greaterThanEqual('$createdAt', lastMonthStart.toISOString()),
          Query.lessThanEqual('$createdAt', lastMonthEnd.toISOString()),
        ]
      )

      const inCompletedTaskCount = thisMonthInCompletedTasks.total
      const inCompletedTaskDifference = inCompletedTaskCount - lastMonthInCompletedTasks.total

      // Completed Tasks 完成
      const thisMonthCompletedTasks = await databases.listDocuments(
        DATABASES_ID,
        TASKS_ID,
        [
          Query.equal('projectId', projectId),
          Query.equal('status', TaskStatus.DONE),
          Query.greaterThanEqual('$createdAt', thisMonthStart.toISOString()),
          Query.lessThanEqual('$createdAt', thisMonthEnd.toISOString()),
        ]
      )

      // Last Month Completed Tasks 完成
      const lastMonthCompletedTasks = await databases.listDocuments(
        DATABASES_ID,
        TASKS_ID,
        [
          Query.equal('projectId', projectId),
          Query.equal('status', TaskStatus.DONE),
          Query.greaterThanEqual('$createdAt', lastMonthStart.toISOString()),
          Query.lessThanEqual('$createdAt', lastMonthEnd.toISOString()),
        ]
      )

      const completedTaskCount = thisMonthCompletedTasks.total
      const completedTaskDifference = completedTaskCount - lastMonthCompletedTasks.total

      // This Month Overdue Tasks 当前月逾期任务
      const thisMonthOverdueTasks = await databases.listDocuments(
        DATABASES_ID,
        TASKS_ID,
        [
          Query.equal('projectId', projectId),
          Query.notEqual('status', TaskStatus.DONE),
          Query.lessThan('dueDate', now.toISOString()),
          Query.greaterThanEqual('$createdAt', thisMonthStart.toISOString()),
          Query.lessThanEqual('$createdAt', thisMonthEnd.toISOString()),
        ]
      )

      // Last Month Overdue Tasks 上个月月逾期任务
      const lastMonthOverdueTasks = await databases.listDocuments(
        DATABASES_ID,
        TASKS_ID,
        [
          Query.equal('projectId', projectId),
          Query.notEqual('status', TaskStatus.DONE),
          Query.lessThan('dueDate', now.toISOString()),
          Query.greaterThanEqual('$createdAt', lastMonthStart.toISOString()),
          Query.lessThanEqual('$createdAt', lastMonthEnd.toISOString()),
        ]
      )

      const overdueTaskCount = thisMonthOverdueTasks.total
      const overdueTaskDifference = overdueTaskCount - lastMonthOverdueTasks.total

      return c.json({
        data: {
          taskCount,
          taskDifference,
          assignedTaskCount,
          assignedTaskDifference,
          inCompletedTaskCount,
          inCompletedTaskDifference,
          completedTaskCount,
          completedTaskDifference,
          overdueTaskCount,
          overdueTaskDifference,
        }
      })
    }
  )

export default app
