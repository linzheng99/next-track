"use client"

import { useRouter } from "next/navigation"

import DottedSeparator from "@/components/dotted-separator"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { useJoinWorkspace } from "../api/use-join-workspace"
import { useInviteCode } from "../hooks/use-invite-code"
import { useWorkspaceId } from "../hooks/use-workspace-id"
import WorkspaceAvatar from './workspace-avatar';

interface JoinWorkspaceFormProps {
  initialValues: {
    $id: string
    name: string
    image: string
  }
}

export default function JoinWorkspaceForm({ initialValues }: JoinWorkspaceFormProps) {
  const router = useRouter()
  const workspaceId = useWorkspaceId()
  const inviteCode = useInviteCode()
  const { mutate, isPending } = useJoinWorkspace()

  function handleCancel() {
    router.push('/')
  }
  function handleJoin() {
    mutate({
      param: { workspaceId },
      json: { code: inviteCode }
    }, {
      onSuccess: () => {
        router.push(`/workspaces/${workspaceId}`)
      }
    })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>加入工作空间</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span>您已被邀请加入</span>
          <WorkspaceAvatar
            image={initialValues.image}
            name={initialValues.name}
            className="size-6"
          />
          <strong>{initialValues.name}</strong>
          <span>工作空间</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DottedSeparator />
      </CardContent>
      <CardFooter className="w-full flex flex-col lg:flex-row justify-center gap-2">
        <Button variant="outline" onClick={handleCancel} className="w-full lg:w-auto">取消</Button>
        <Button onClick={handleJoin} disabled={isPending} type="submit" className="w-full lg:w-auto">加入</Button>
      </CardFooter>
    </Card>
  )
}
