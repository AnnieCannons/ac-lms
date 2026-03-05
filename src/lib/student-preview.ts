import { cookies } from 'next/headers'

export async function isStudentPreview(courseId: string): Promise<boolean> {
  const store = await cookies()
  return store.get('student-view')?.value === courseId
}
