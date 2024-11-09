import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ID, Query } from "node-appwrite";
import { z } from "zod";

import { DATABASES_ID, MEMBERS_ID, PROJECTS_ID, TASKS_ID } from "@/config";
import { getMember } from "@/features/members/utils";
import { createAdminClient } from "@/lib/appwrite";
import { sessionMiddleware } from "@/lib/session-middleware";

import { createTaskSchema } from "../schemas";
import { TaskStatus } from "../types";

const app = new Hono()
  .get(
    '/',
    sessionMiddleware,
    zValidator('query', z.object({
      search: z.string().nullish(),
      workspaceId: z.string(),
      projectId: z.string().nullish(),
      assigneeId: z.string().nullish(),
      dueDate: z.string().nullish(),
      status: z.nativeEnum(TaskStatus).nullish(),
    })),
    async (c) => {
      const { users } = await createAdminClient()
      const user = c.get('user')
      const databases = c.get('databases')
      const { search, workspaceId, projectId, assigneeId, dueDate, status } = c.req.valid('query')

      const member = await getMember({ databases, workspaceId, userId: user.$id })
      if (!member) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const query = [
        Query.equal('workspaceId', workspaceId),
      ]
      if (projectId) {
        query.push(Query.equal('projectId', projectId))
      }
      if (assigneeId) {
        query.push(Query.equal('assigneeId', assigneeId))
      }
      if (dueDate) {
        query.push(Query.equal('dueDate', dueDate))
      }
      if (status) {
        query.push(Query.equal('status', status))
      }
      if (search) {
        query.push(Query.search('name', search))
      }
      // 获取任务
      const tasks = await databases.listDocuments(DATABASES_ID, TASKS_ID, query)
      // 提取所有任务相关的项目ID和负责人ID
      const projectIds = tasks.documents.map((task) => task.projectId as string)
      const assigneeIds = tasks.documents.map((task) => task.assigneeId as string)
      // 获取相关项目信息
      const projects = await databases.listDocuments(DATABASES_ID, PROJECTS_ID, projectIds.length > 0 ? [
        Query.contains('$id', projectIds)
      ] : [])
      // 获取相关成员信息
      const members = await databases.listDocuments(DATABASES_ID, MEMBERS_ID, assigneeIds.length > 0 ? [
        Query.contains('$id', assigneeIds)
      ] : [])
      // 获取任务负责人的详细信息（包括姓名和邮箱）
      const assignees = await Promise.all(
        members.documents.map(async (member) => {
          const user = await users.get(member.userId as string)
          return {
            ...member,
            name: user.name,
            email: user.email,
          }
        })
      )
      // 组装完整的任务数据，包含项目和负责人信息
      const populatedTasks = tasks.documents.map((task) => {
        const project = projects.documents.find((project) => project.id === task.projectId)
        const assignee = assignees.find((assignee) => assignee.$id === task.assigneeId)

        return {
          ...task,
          project,
          assignee,
        }
      })
      // 返回组装好的任务数据 以及 任务总数等信息
      return c.json({
        data: {
          ...tasks,
          documents: populatedTasks,
        },
      })
    }
  )
  .post('/', sessionMiddleware, zValidator('json', createTaskSchema), async (c) => {
    const databases = c.get('databases')
    const user = c.get('user')
    const { name, status, workspaceId, projectId, dueDate, assigneeId, description } = c.req.valid('json')

    const member = await getMember({ databases, workspaceId, userId: user.$id })
    if (!member) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // 任务排序策略: 获取当前项目下，状态相同的任务中，position 最大的任务
    const highestPositionTask = await databases.listDocuments(
      DATABASES_ID,
      TASKS_ID,
      [
        Query.equal('status', status),
        Query.equal('workspaceId', workspaceId),
        Query.equal('projectId', projectId),
        Query.orderDesc('position'),
        Query.limit(1)
      ])

    const newPosition = highestPositionTask.documents.length > 0 ? highestPositionTask.documents[0].position + 1000 : 1000

    const task = await databases.createDocument(DATABASES_ID, TASKS_ID, ID.unique(), {
      name,
      status,
      workspaceId,
      projectId,
      dueDate,
      assigneeId,
      description,
      position: newPosition,
    })

    return c.json({ data: task })
  })

export default app