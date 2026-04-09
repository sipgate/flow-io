import { redirect } from 'next/navigation'

export default async function PhoneNumbersRedirectPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  redirect(`/${orgSlug}/connect`)
}
