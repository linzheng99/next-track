"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ImageIcon } from "lucide-react"
import Image from "next/image"
import React, { useRef } from "react"
import { useForm } from "react-hook-form"
import { type z } from "zod"

import DottedSeparator from "@/components/dotted-separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id"
import { cn } from "@/lib/utils"

import { useCreateProject } from "../api/use-create-project"
import { createProjectSchema } from "../schemas"

interface CreateProjectFormProps {
  onCancel?: () => void
}

export default function CreateProjectForm({
  onCancel
}: CreateProjectFormProps) {
  const workspaceId = useWorkspaceId()

  const { mutate, isPending } = useCreateProject()

  const inputRef = useRef<HTMLInputElement>(null)
  const form = useForm<z.infer<typeof createProjectSchema>>({
    resolver: zodResolver(createProjectSchema.omit({ workspaceId: true })),
    defaultValues: {
      name: "",
    },
  })

  function onSubmit(values: z.infer<typeof createProjectSchema>) {
    const finalValues = {
      ...values,
      workspaceId,
      image: values.image instanceof File ? values.image : ''
    }

    mutate(
      { form: finalValues },
      {
        onSuccess: () => {
          form.reset()
        }
      })
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      form.setValue('image', file)
    }
  }

  return (
    <Card className="border-none">
      <CardHeader>
        <CardTitle>创建该工作空间下的项目</CardTitle>
      </CardHeader>
      <CardContent>
        <DottedSeparator className="mb-4" />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名称</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入项目名称" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">图标</FormLabel>
                  <div className="flex items-center gap-4">
                    {
                      field.value ? (
                        <div className="relative size-[72px] rounded-md overflow-hidden">
                          <Image src={field.value instanceof File ? URL.createObjectURL(field.value) : field.value} alt="picture" fill className="object-cover" />
                        </div>
                      ) : (
                        <Avatar className="size-[72px]">
                          <AvatarFallback>
                            <ImageIcon className="size-[36px] text-neutral-400" />
                          </AvatarFallback>
                        </Avatar>
                      )
                    }
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-neutral-400"> .jpg,.svg,.png,.jpeg, 小于 1 M</p>
                      <input
                        ref={inputRef}
                        type="file"
                        accept=".jpg,.svg,.png,.jpeg"
                        className="hidden"
                        onChange={handleImageChange}
                        disabled={isPending}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="w-fit"
                        onClick={() => inputRef.current?.click()}
                      >
                        Upload
                      </Button>
                    </div>
                  </div>
                </FormItem>
              )}
            />
            <DottedSeparator className="mb-4" />
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => onCancel?.()} className={cn(!onCancel && 'invisible')}>Cancel</Button>
              <Button type="submit" disabled={isPending}>Submit</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
