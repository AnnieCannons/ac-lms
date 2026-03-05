'use server'
import { revalidatePath } from 'next/cache'

export async function revalidateAssignmentsPage(courseId: string) {
  revalidatePath(`/student/courses/${courseId}/assignments`)
  revalidatePath(`/student/courses/${courseId}`)
}
