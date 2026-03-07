import { redirect } from 'next/navigation'

export default async function PeopleUserRedirect({
  params,
}: {
  params: Promise<{ id: string; userId: string }>
}) {
  const { id, userId } = await params
  redirect(`/instructor/courses/${id}/roster/${userId}`)
}
