import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend'
import DigestEmail from '@/emails/DigestEmail'
import React from 'react'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceSupabaseClient()

  // Fetch all unemailed student notifications
  const { data: notifications, error: notifError } = await admin
    .from('notifications')
    .select('id, user_id, type, course_id, assignment_id, message')
    .in('type', ['grade_posted', 'submission_comment'])
    .is('emailed_at', null)

  if (notifError) {
    console.error('digest: failed to fetch notifications', notifError)
    return NextResponse.json({ error: notifError.message }, { status: 500 })
  }

  if (!notifications || notifications.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No pending notifications' })
  }

  // Fetch student profiles (only send to students, not instructors/admins)
  const userIds = [...new Set(notifications.map(n => n.user_id))]
  const { data: students } = await admin
    .from('users')
    .select('id, name, email, role')
    .in('id', userIds)
    .eq('role', 'student')

  if (!students || students.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No student recipients' })
  }

  const studentMap = new Map(students.map(s => [s.id, s]))

  // Group notifications by student
  const byStudent = new Map<string, typeof notifications>()
  for (const n of notifications) {
    if (!studentMap.has(n.user_id)) continue
    byStudent.set(n.user_id, [...(byStudent.get(n.user_id) ?? []), n])
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.anniecannons.com'
  const from = process.env.RESEND_FROM_EMAIL ?? 'AnnieCannons LMS <noreply@mail.anniecannons.com>'
  const sentIds: string[] = []
  let sent = 0

  for (const [userId, notifs] of byStudent) {
    const student = studentMap.get(userId)!

    const grades = notifs
      .filter(n => n.type === 'grade_posted')
      .map(n => ({ message: n.message, assignmentId: n.assignment_id, courseId: n.course_id }))

    const comments = notifs
      .filter(n => n.type === 'submission_comment')
      .map(n => ({ message: n.message, assignmentId: n.assignment_id, courseId: n.course_id }))

    try {
      const { error: sendError } = await getResend().emails.send({
        from,
        to: student.email,
        subject: `Your AnnieCannons updates — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
        react: React.createElement(DigestEmail, { studentName: student.name, grades, comments, appUrl }),
      })

      if (sendError) {
        console.error(`digest: failed to send to ${student.email}:`, sendError)
        continue
      }

      sentIds.push(...notifs.map(n => n.id))
      sent++
    } catch (err) {
      console.error(`digest: unexpected error for ${student.email}:`, err)
    }
  }

  // Mark sent
  if (sentIds.length > 0) {
    await admin
      .from('notifications')
      .update({ emailed_at: new Date().toISOString() })
      .in('id', sentIds)
  }

  return NextResponse.json({ sent, notificationsMarked: sentIds.length })
}
