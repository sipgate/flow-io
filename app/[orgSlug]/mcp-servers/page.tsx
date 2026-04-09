import { redirect } from 'next/navigation'

export default async function MCPServersPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  redirect(`/${orgSlug}/knowledge?tab=mcp`)
}
