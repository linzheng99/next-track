"use client"

import { useQuery } from "@tanstack/react-query"
import { type InferResponseType } from "hono"

import { client } from "@/lib/rpc"

interface UseGetWorkspaceAnalyticsProps {
  workspaceId: string
}

export type WorkspaceAnalyticsResponseType = InferResponseType<typeof client.api.workspaces[':workspaceId']['analytics']['$get'], 200>

export const useGetWorkspaceAnalytics = ({ workspaceId }: UseGetWorkspaceAnalyticsProps) => {
  const query = useQuery({
    queryKey: ['workspaces-analytics', workspaceId],
    queryFn: async () => {
      const response = await client.api.workspaces[':workspaceId']['analytics'].$get({ param: { workspaceId } })

      if (!response.ok) {
        throw new Error('获取工作区分析失败...')
      }

      const { data } = await response.json()

      return data
    }
  })
  return query
}
