// Server-side only — never import from client components

const BASE_ID = process.env.AIRTABLE_BASE_ID!
const API_KEY = process.env.AIRTABLE_API_KEY!
const ATTENDANCE_TABLE = process.env.AIRTABLE_TABLE_NAME || 'Attendance'

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Escape a string for safe interpolation inside an Airtable formula string literal */
function escapeAirtableString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/[{}()]/g, (c) => `\\${c}`)
}

type AirtableRecord = { id: string; fields: Record<string, unknown> }

async function airtableGet(
  table: string,
  params: URLSearchParams,
): Promise<{ records: AirtableRecord[]; offset?: string }> {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}?${params}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Airtable [${table}] ${res.status}: ${body}`)
  }
  return res.json()
}

async function paginate(table: string, base: URLSearchParams): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = []
  let offset: string | undefined
  do {
    const p = new URLSearchParams(base)
    if (offset) p.set('offset', offset)
    const data = await airtableGet(table, p)
    all.push(...(data.records ?? []))
    offset = data.offset
  } while (offset)
  return all
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type AttendanceRecord = {
  id: string
  date: string | null
  blockA: string | null
  blockB: string | null
  blockC: string | null
  blockD: string | null
}

export type StudentProfile = {
  preferredName: string
  currentCourse: string | null
  enrolledCourseIds: string[] // IDs of current + all previous courses
}

export type ClassStudent = {
  preferredName: string
  absences: number
  tardies: number
  totalBlocks: number
  percentMissed: number | null
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchStudentAttendance(preferredName: string, since?: string, until?: string, courseName?: string): Promise<AttendanceRecord[]> {
  const safeName = escapeAirtableString(preferredName)

  // If a course name is provided, verify this student is enrolled in that specific
  // Airtable course before fetching attendance — prevents mixing up students with the
  // same preferred name who are in different concurrent courses.
  if (courseName) {
    const safeCourseName = escapeAirtableString(courseName)
    const sp = new URLSearchParams()
    sp.set(
      'filterByFormula',
      `AND(LOWER({Preferred Name})='${safeName.toLowerCase()}', OR(FIND('${safeCourseName}', ARRAYJOIN({Current Course})), FIND('${safeCourseName}', ARRAYJOIN({Past Courses}))))`,
    )
    const enrolled = await paginate('Students', sp)
    if (!enrolled.length) return []
  }

  const dateFilter = since && until
    ? `AND(NOT(IS_BEFORE({Date}, '${since}')), NOT(IS_AFTER({Date}, '${until}')))`
    : since
      ? `NOT(IS_BEFORE({Date}, '${since}'))`
      : ''
  const nameFilter = `{PreferredNameText}='${safeName}'`
  const formula = dateFilter ? `AND(${nameFilter}, ${dateFilter})` : nameFilter

  const p = new URLSearchParams()
  p.set('filterByFormula', formula)
  p.set('sort[0][field]', 'Date')
  p.set('sort[0][direction]', 'desc')

  const records = await paginate(ATTENDANCE_TABLE, p)

  return records.map(r => ({
    id: r.id,
    date: (r.fields.Date as string) ?? null,
    blockA: (r.fields['Block A'] as string) ?? null,
    blockB: (r.fields['Block B'] as string) ?? null,
    blockC: (r.fields['Block C'] as string) ?? null,
    blockD: (r.fields['Block D'] as string) ?? null,
  }))
}

export async function fetchStudentProfile(preferredName: string): Promise<StudentProfile | null> {
  const safeName = escapeAirtableString(preferredName)
  const p = new URLSearchParams()
  p.set('filterByFormula', `LOWER({Preferred Name})='${safeName.toLowerCase()}'`)

  const records = await paginate('Students', p)
  if (!records.length) return null

  const fields = records[0].fields
  const courseIds = fields['Current Course'] as string[] | undefined
  let currentCourse: string | null = null

  if (courseIds?.length) {
    try {
      const res = await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/Courses/${courseIds[0]}`,
        {
          headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
          cache: 'no-store',
        },
      )
      if (res.ok) currentCourse = ((await res.json()).fields?.Name as string) ?? null
    } catch {}
  }

  const previousCourseIds = (fields['Past Courses'] as string[] | undefined) ?? []

  return {
    preferredName: fields['Preferred Name'] as string,
    currentCourse,
    enrolledCourseIds: [...(courseIds ?? []), ...previousCourseIds],
  }
}

export type AttendanceCourse = {
  id: string
  name: string
  startDate: string
  endDate: string | null
}

// Fetch all TCF/ITP/Frontend/Backend courses (any year) for the student course selector
export async function fetchAttendanceCourses(): Promise<AttendanceCourse[]> {
  const p = new URLSearchParams()
  p.set(
    'filterByFormula',
    `OR(FIND('TCF', {Name}), FIND('ITP', {Name}), FIND('Frontend', {Name}), FIND('Backend', {Name}))`,
  )
  p.set('sort[0][field]', 'Start Date')
  p.set('sort[0][direction]', 'desc')

  const records = await paginate('Courses', p)

  return records
    .filter(r => r.fields['Start Date'] && r.fields['Name'])
    .map(r => ({
      id: r.id,
      name: r.fields['Name'] as string,
      startDate: r.fields['Start Date'] as string,
      endDate: (r.fields['End Date'] as string) ?? null,
    }))
}

export async function fetchActiveClasses(): Promise<string[]> {
  const p = new URLSearchParams()
  p.set(
    'filterByFormula',
    `AND(NOT(FIND('Practicum', {Name})), IS_BEFORE({Start Date}, TODAY()))`,
  )
  p.set('sort[0][field]', 'Start Date')
  p.set('sort[0][direction]', 'desc')

  const records = await paginate('Courses', p)

  return records
    .filter(r => r.fields['Start Date'] && r.fields['Name'])
    .map(r => r.fields.Name as string)
}

export async function fetchClassAttendance(className: string): Promise<ClassStudent[]> {
  // Resolve course record
  const cp = new URLSearchParams()
  cp.set('filterByFormula', `{Name}='${escapeAirtableString(className)}'`)
  const courseRecords = await paginate('Courses', cp)
  if (!courseRecords.length) throw new Error('Course not found')

  const startDateStr = courseRecords[0].fields['Start Date'] as string | undefined
  if (!startDateStr) throw new Error('Course start date not set')
  const endDateStr = courseRecords[0].fields['End Date'] as string | undefined
  const since = new Date(startDateStr)
  const until = endDateStr ? new Date(endDateStr) : new Date()
  until.setHours(23, 59, 59, 999)

  // ARRAYJOIN on linked fields returns display names (not record IDs), so filter by course name
  const safeClassName = escapeAirtableString(className)
  const sp = new URLSearchParams()
  sp.set(
    'filterByFormula',
    `OR(FIND('${safeClassName}', ARRAYJOIN({Current Course})), FIND('${safeClassName}', ARRAYJOIN({Past Courses})))`,
  )
  const enrolledStudents = await paginate('Students', sp)
  if (!enrolledStudents.length) return []

  const enrolledNames = new Set(
    enrolledStudents.map(s => s.fields['Preferred Name'] as string).filter(Boolean),
  )

  // Fetch attendance records within the course date range
  const ap = new URLSearchParams()
  ap.set(
    'filterByFormula',
    endDateStr
      ? `AND(NOT(IS_BEFORE({Date}, '${startDateStr}')), NOT(IS_AFTER({Date}, '${endDateStr}')))`
      : `NOT(IS_BEFORE({Date}, '${startDateStr}'))`,
  )
  const attendanceRecords = await paginate(ATTENDANCE_TABLE, ap)

  // Aggregate by student, only for enrolled students
  const map: Record<string, { preferredName: string; absences: number; tardies: number; totalBlocks: number }> = {}

  for (const r of attendanceRecords) {
    const date = r.fields.Date as string | undefined
    if (!date) continue
    const d = new Date(date)
    if (d < since || d > until) continue

    let name = r.fields.PreferredNameText as string | string[] | undefined
    if (Array.isArray(name)) name = name[0]
    if (!name || !enrolledNames.has(name)) continue

    if (!map[name]) map[name] = { preferredName: name, absences: 0, tardies: 0, totalBlocks: 0 }

    for (const block of ['Block A', 'Block B', 'Block C', 'Block D']) {
      const s = r.fields[block] as string | undefined
      if (!s) continue
      map[name].totalBlocks++
      if (s.includes('Absent')) map[name].absences++
      else if (s.includes('Tardy')) map[name].tardies++
    }
  }

  const names = Object.keys(map)
  if (!names.length) return []

  return names
    .map(name => ({
      ...map[name],
      percentMissed: map[name].totalBlocks > 0
        ? (map[name].absences / map[name].totalBlocks) * 100
        : null,
    }))
    .sort((a, b) => a.preferredName.localeCompare(b.preferredName))
}

export type ClassStudentWeekly = {
  preferredName: string
  absencesThisWeek: number
  blocksThisWeek: number
  absencesLastWeek: number
  totalAbsences: number
  totalTardies: number
  totalBlocks: number
  percentMissed: number | null
}

export type WeekRange = { start: string; end: string } // 'YYYY-MM-DD', inclusive

export async function fetchClassAttendanceWeekly(
  className: string,
  thisWeek: WeekRange,
  lastWeek: WeekRange,
): Promise<ClassStudentWeekly[]> {
  // Resolve course record
  const cp = new URLSearchParams()
  cp.set('filterByFormula', `{Name}='${escapeAirtableString(className)}'`)
  const courseRecords = await paginate('Courses', cp)
  if (!courseRecords.length) throw new Error('Course not found')

  const startDateStr = courseRecords[0].fields['Start Date'] as string | undefined
  if (!startDateStr) throw new Error('Course start date not set')
  const endDateStr = courseRecords[0].fields['End Date'] as string | undefined
  const since = new Date(startDateStr)
  const until = endDateStr ? new Date(endDateStr) : new Date()
  until.setHours(23, 59, 59, 999)

  // ARRAYJOIN on linked fields returns display names (not record IDs), so filter by course name
  const safeClassName = escapeAirtableString(className)
  const sp = new URLSearchParams()
  sp.set(
    'filterByFormula',
    `OR(FIND('${safeClassName}', ARRAYJOIN({Current Course})), FIND('${safeClassName}', ARRAYJOIN({Past Courses})))`,
  )
  const enrolledStudents = await paginate('Students', sp)
  if (!enrolledStudents.length) return []

  const enrolledNames = new Set(
    enrolledStudents.map(s => s.fields['Preferred Name'] as string).filter(Boolean),
  )

  // Fetch attendance records within the course date range
  const ap = new URLSearchParams()
  ap.set(
    'filterByFormula',
    endDateStr
      ? `AND(NOT(IS_BEFORE({Date}, '${startDateStr}')), NOT(IS_AFTER({Date}, '${endDateStr}')))`
      : `NOT(IS_BEFORE({Date}, '${startDateStr}'))`,
  )
  const attendanceRecords = await paginate(ATTENDANCE_TABLE, ap)

  const map: Record<string, {
    preferredName: string
    absencesThisWeek: number
    blocksThisWeek: number
    absencesLastWeek: number
    totalAbsences: number
    totalTardies: number
    totalBlocks: number
  }> = {}

  for (const r of attendanceRecords) {
    const date = r.fields.Date as string | undefined
    if (!date) continue
    const d = new Date(date)
    if (d < since || d > until) continue

    let name = r.fields.PreferredNameText as string | string[] | undefined
    if (Array.isArray(name)) name = name[0]
    if (!name || !enrolledNames.has(name)) continue

    if (!map[name]) {
      map[name] = {
        preferredName: name,
        absencesThisWeek: 0,
        blocksThisWeek: 0,
        absencesLastWeek: 0,
        totalAbsences: 0,
        totalTardies: 0,
        totalBlocks: 0,
      }
    }

    const dateOnly = date.slice(0, 10)
    const inThisWeek = dateOnly >= thisWeek.start && dateOnly <= thisWeek.end
    const inLastWeek = dateOnly >= lastWeek.start && dateOnly <= lastWeek.end

    for (const block of ['Block A', 'Block B', 'Block C', 'Block D']) {
      const s = r.fields[block] as string | undefined
      if (!s) continue
      map[name].totalBlocks++
      if (inThisWeek) map[name].blocksThisWeek++

      if (s.includes('Absent')) {
        map[name].totalAbsences++
        if (inThisWeek) map[name].absencesThisWeek++
        if (inLastWeek) map[name].absencesLastWeek++
      } else if (s.includes('Tardy')) {
        map[name].totalTardies++
      }
    }
  }

  const names = Object.keys(map)
  if (!names.length) return []

  return names
    .map(name => ({
      ...map[name],
      percentMissed: map[name].totalBlocks > 0
        ? (map[name].totalAbsences / map[name].totalBlocks) * 100
        : null,
    }))
    .sort((a, b) => a.preferredName.localeCompare(b.preferredName))
}

// ─── Name sync helpers (used by scripts/check-name-sync.ts) ──────────────────

export async function fetchAllAirtableStudentNames(): Promise<string[]> {
  const records = await paginate('Students', new URLSearchParams())
  return records
    .map(r => r.fields['Preferred Name'] as string)
    .filter(Boolean)
}
