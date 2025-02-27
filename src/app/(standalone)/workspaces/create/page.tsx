import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";
import CreateWorkspaceForm from "@/features/workspaces/components/create-workspace-form";

export const dynamic = "force-dynamic";

export default async function CreateWorkspacePage() {
  const user = await getCurrent()
  if (!user) redirect('/sign-in')

  return (
    <div className="w-full lg:max-w-xl">
      <CreateWorkspaceForm />
    </div>
  )
}
