import { redirect } from 'next/navigation'

export default async function PeopleRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/instructor/courses/${id}/users`)
}
