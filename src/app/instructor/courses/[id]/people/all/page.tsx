import { redirect } from 'next/navigation'

export default async function PeopleAllRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/instructor/courses/${id}/users/all`)
}
