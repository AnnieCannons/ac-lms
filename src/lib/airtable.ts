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

// The Airtable student code (e.g. "S121") lives in the record's primary "Name"
// field, formatted "S121 - ZanettaR" — a stable identifier that doesn't change
// when a student edits their preferred display name, unlike Preferred Name.
const CODE_RE = /^S\d+\s*-/i

/** Resolves an Airtable Students record by its stable code, independent of preferred name. */
async function resolveStudentByCode(airtableStudentId: string): Promise<AirtableRecord | null> {
  const safeId = escapeAirtableString(airtableStudentId)
  const p = new URLSearchParams()
  p.set('filterByFormula', `OR(FIND('${safeId} - ', {Name})=1, FIND('${safeId} - ', {Preferred Name})=1)`)
  const records = await paginate('Students', p)
  return records[0] ?? null
}

const CODE_CAPTURE_RE = /^S(\d+)\s*-/i

/** Extracts the S### code from whichever field it landed in on a Students record, if any. */
function extractCode(fields: Record<string, unknown>): string | null {
  const name = ((fields['Name'] as string) ?? '').trim()
  const pref = ((fields['Preferred Name'] as string) ?? '').trim()
  const match = name.match(CODE_CAPTURE_RE) ?? pref.match(CODE_CAPTURE_RE)
  return match ? `S${match[1]}` : null
}

/**
 * Looks up a student's airtable_student_id by their "Student Email" field —
 * used at LMS account-creation time (invite acceptance) so new students get
 * linked automatically, as long as staff filled in their email in Airtable
 * beforehand. Returns null if there's no match or no code to extract.
 */
export async function resolveAirtableStudentIdByEmail(email: string): Promise<string | null> {
  const safeEmail = escapeAirtableString(email.trim().toLowerCase())
  const p = new URLSearchParams()
  p.set('filterByFormula', `LOWER({Student Email})='${safeEmail}'`)
  const records = await paginate('Students', p)
  if (!records.length) return null
  return extractCode(records[0].fields)
}

async function resolveCourseName(courseId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/Courses/${courseId}`,
      { headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' }, cache: 'no-store' },
    )
    if (res.ok) return ((await res.json()).fields?.Name as string) ?? null
  } catch {}
  return null
}

async function profileFromRecord(record: AirtableRecord): Promise<StudentProfile> {
  const fields = record.fields
  const courseIds = fields['Current Course'] as string[] | undefined
  const currentCourse = courseIds?.length ? await resolveCourseName(courseIds[0]) : null
  const previousCourseIds = (fields['Past Courses'] as string[] | undefined) ?? []
  const rawPref = (fields['Preferred Name'] as string) ?? ''
  // On a handful of records the S### code was typed into Preferred Name by mistake —
  // never surface that as a display name.
  const preferredName = CODE_RE.test(rawPref) ? ((fields['Name'] as string) ?? rawPref) : rawPref

  return {
    preferredName,
    currentCourse,
    enrolledCourseIds: [...(courseIds ?? []), ...previousCourseIds],
  }
}

function mapAttendanceRecords(records: AirtableRecord[]): AttendanceRecord[] {
  return records.map(r => ({
    id: r.id,
    date: (r.fields.Date as string) ?? null,
    blockA: (r.fields['Block A'] as string) ?? null,
    blockB: (r.fields['Block B'] as string) ?? null,
    blockC: (r.fields['Block C'] as string) ?? null,
    blockD: (r.fields['Block D'] as string) ?? null,
  }))
}

function dateRangeFormula(since?: string, until?: string): string {
  return since && until
    ? `AND(NOT(IS_BEFORE({Date}, '${since}')), NOT(IS_AFTER({Date}, '${until}')))`
    : since
      ? `NOT(IS_BEFORE({Date}, '${since}'))`
      : ''
}

export type ClassStudent = {
  preferredName: string
  airtableStudentId: string | null
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

  const dateFilter = dateRangeFormula(since, until)
  const nameFilter = `{PreferredNameText}='${safeName}'`
  const formula = dateFilter ? `AND(${nameFilter}, ${dateFilter})` : nameFilter

  const p = new URLSearchParams()
  p.set('filterByFormula', formula)
  p.set('sort[0][field]', 'Date')
  p.set('sort[0][direction]', 'desc')

  return mapAttendanceRecords(await paginate(ATTENDANCE_TABLE, p))
}

/**
 * Same as fetchStudentAttendance, but keyed by the stable airtable_student_id
 * instead of preferred name — safe to use even when the student's display name
 * collides with another student's. Prefer this whenever the LMS already knows
 * which student is being looked up.
 */
export async function fetchStudentAttendanceById(airtableStudentId: string, since?: string, until?: string): Promise<AttendanceRecord[]> {
  const student = await resolveStudentByCode(airtableStudentId)
  if (!student) return []

  const dateFilter = dateRangeFormula(since, until)
  const rawPref = (student.fields['Preferred Name'] as string) ?? ''

  // Airtable can't formula-filter Attendance by the Student link's record id (only
  // by its linked display value), so we can't push an exact filter to the server.
  // Instead, pre-filter server-side by this student's current preferred name (fast —
  // matches at most a handful of records, even if another student shares that name),
  // then disambiguate the small result set client-side by the exact linked record id.
  // Only fall back to a full unfiltered scan for the rare record with no preferred
  // name at all to filter by.
  let records: AirtableRecord[]
  if (rawPref) {
    const nameFilter = `{PreferredNameText}='${escapeAirtableString(rawPref)}'`
    const formula = dateFilter ? `AND(${nameFilter}, ${dateFilter})` : nameFilter
    const p = new URLSearchParams()
    p.set('filterByFormula', formula)
    p.set('sort[0][field]', 'Date')
    p.set('sort[0][direction]', 'desc')
    records = await paginate(ATTENDANCE_TABLE, p)
  } else {
    const p = new URLSearchParams()
    if (dateFilter) p.set('filterByFormula', dateFilter)
    p.set('sort[0][field]', 'Date')
    p.set('sort[0][direction]', 'desc')
    records = await paginate(ATTENDANCE_TABLE, p)
  }

  // The Attendance table's "Student" field is a real record link — its raw value
  // is the linked record id(s), not the (ambiguous) display name.
  const matching = records.filter(r => (r.fields['Student'] as string[] | undefined)?.includes(student.id))

  return mapAttendanceRecords(matching)
}

export async function fetchStudentProfile(preferredName: string): Promise<StudentProfile | null> {
  const safeName = escapeAirtableString(preferredName)
  const p = new URLSearchParams()
  p.set('filterByFormula', `LOWER({Preferred Name})='${safeName.toLowerCase()}'`)

  const records = await paginate('Students', p)
  if (!records.length) return null
  return profileFromRecord(records[0])
}

/** Same as fetchStudentProfile, but keyed by the stable airtable_student_id. */
export async function fetchStudentProfileById(airtableStudentId: string): Promise<StudentProfile | null> {
  const student = await resolveStudentByCode(airtableStudentId)
  if (!student) return null
  return profileFromRecord(student)
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

  // Keyed by Airtable record id (not name) — the Attendance table's "Student"
  // link field gives us record ids directly, so two students who happen to share
  // a preferred name never get merged into the same row.
  const enrolledById = new Map(
    enrolledStudents.map(s => [
      s.id,
      { preferredName: (s.fields['Preferred Name'] as string) || null, airtableStudentId: extractCode(s.fields) },
    ]),
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
  const map: Record<string, { preferredName: string; airtableStudentId: string | null; absences: number; tardies: number; totalBlocks: number }> = {}

  for (const r of attendanceRecords) {
    const date = r.fields.Date as string | undefined
    if (!date) continue
    const d = new Date(date)
    if (d < since || d > until) continue

    const studentIds = r.fields['Student'] as string[] | undefined
    const studentId = studentIds?.[0]
    const enrolled = studentId ? enrolledById.get(studentId) : undefined
    if (!studentId || !enrolled?.preferredName) continue

    if (!map[studentId]) {
      map[studentId] = { preferredName: enrolled.preferredName, airtableStudentId: enrolled.airtableStudentId, absences: 0, tardies: 0, totalBlocks: 0 }
    }

    for (const block of ['Block A', 'Block B', 'Block C', 'Block D']) {
      const s = r.fields[block] as string | undefined
      if (!s) continue
      map[studentId].totalBlocks++
      if (s.includes('Absent')) map[studentId].absences++
      else if (s.includes('Tardy')) map[studentId].tardies++
    }
  }

  const ids = Object.keys(map)
  if (!ids.length) return []

  return ids
    .map(id => ({
      ...map[id],
      percentMissed: map[id].totalBlocks > 0
        ? (map[id].absences / map[id].totalBlocks) * 100
        : null,
    }))
    .sort((a, b) => a.preferredName.localeCompare(b.preferredName))
}

export type ClassStudentWeekly = {
  preferredName: string
  airtableStudentId: string | null
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

  // Keyed by Airtable record id (not name) — see fetchClassAttendance for why.
  const enrolledById = new Map(
    enrolledStudents.map(s => [
      s.id,
      { preferredName: (s.fields['Preferred Name'] as string) || null, airtableStudentId: extractCode(s.fields) },
    ]),
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
    airtableStudentId: string | null
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

    const studentIds = r.fields['Student'] as string[] | undefined
    const studentId = studentIds?.[0]
    const enrolled = studentId ? enrolledById.get(studentId) : undefined
    if (!studentId || !enrolled?.preferredName) continue

    if (!map[studentId]) {
      map[studentId] = {
        preferredName: enrolled.preferredName,
        airtableStudentId: enrolled.airtableStudentId,
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
      map[studentId].totalBlocks++
      if (inThisWeek) map[studentId].blocksThisWeek++

      if (s.includes('Absent')) {
        map[studentId].totalAbsences++
        if (inThisWeek) map[studentId].absencesThisWeek++
        if (inLastWeek) map[studentId].absencesLastWeek++
      } else if (s.includes('Tardy')) {
        map[studentId].totalTardies++
      }
    }
  }

  const ids = Object.keys(map)
  if (!ids.length) return []

  return ids
    .map(id => ({
      ...map[id],
      percentMissed: map[id].totalBlocks > 0
        ? (map[id].totalAbsences / map[id].totalBlocks) * 100
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
