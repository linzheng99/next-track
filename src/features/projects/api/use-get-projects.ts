"use client"

import { useQuery } from "@tanstack/react-query"

import { client } from "@/lib/rpc"

interface UseGetProjectsProps {
  workspaceId: string
}

export const useGetProjects = ({ workspaceId }: UseGetProjectsProps) => {
  const query = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null

      const response = await client.api.projects.$get({
        query: {
          workspaceId
        }
      })

      if (!response.ok) {
        throw new Error('获取项目失败...')
      }

      const { data } = await response.json()

      return data
    }
  })
  return query
}
