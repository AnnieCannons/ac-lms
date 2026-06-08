'use client'

import { useState } from 'react'
import { updateEmailList, deleteEmailList } from '@/lib/email-list-actions'

interface Recipient {
  id: string
  email: string
  partner_name: string
  contact_name: string | null
  is_primary: boolean
  partner_id: string
}

interface EmailList {
  id: string
  name: string
  subject: string
  department: string
  sent_at: string | null
  notes: string | null
  created_at: string
  users: { name: string } | null
  email_list_recipients: Recipient[]
}

interface Props {
  lists: EmailList[]
  deptBadge: Record<string, string>
  deptLabels: Record<string, string>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ListCard({ list, deptBadge, deptLabels }: { list: EmailList; deptBadge: Record<string, string>; deptLabels: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState(list.name)
  const [editingName, setEditingName] = useState(false)
  const [notes, setNotes] = useState(list.notes ?? '')
  const [editingNotes, setEditingNotes] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)

  const emailString = list.email_list_recipients.map(r => r.email).join(', ')
  const uniquePartners = new Set(list.email_list_recipients.map(r => r.partner_id)).size

  const saveName = async () => {
    if (!name.trim() || name === list.name) { setEditingName(false); return }
    setSaving(true)
    await updateEmailList(list.id, { name: name.trim() })
    setSaving(false)
    setEditingName(false)
  }

  const saveNotes = async () => {
    setSaving(true)
    await updateEmailList(list.id, { notes: notes.trim() || null as unknown as string })
    setSaving(false)
    setEditingNotes(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(emailString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await deleteEmailList(list.id)
    setDeleted(true)
  }

  if (deleted) return null

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header row */}
      <div className="px-5 py-4 flex items-start gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Name */}
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setName(list.name); setEditingName(false) } }}
                className="flex-1 px-2 py-1 text-sm border border-teal-primary rounded-lg bg-background text-dark-text focus:outline-none"
              />
              <button onClick={saveName} disabled={saving} className="text-xs text-teal-primary hover:underline disabled:opacity-50">Save</button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-left text-sm font-semibold text-dark-text hover:text-teal-primary transition-colors truncate"
              title="Click to rename"
            >
              {name}
            </button>
          )}
          {list.subject && (
            <p className="text-xs text-muted-text truncate">Subject: <span className="text-dark-text">{list.subject}</span></p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-text">
            {list.department && (
              <span className={`rounded-full px-2.5 py-0.5 font-medium ${deptBadge[list.department] ?? 'bg-gray-100 text-gray-600'}`}>
                {deptLabels[list.department] ?? list.department}
              </span>
            )}
            <span>{list.email_list_recipients.length} contact{list.email_list_recipients.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{uniquePartners} partner{uniquePartners !== 1 ? 's' : ''}</span>
            {list.sent_at && <><span>·</span><span>Sent {formatDate(list.sent_at)}</span></>}
            {list.users?.name && <><span>·</span><span>by {list.users.name}</span></>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="px-2.5 py-1.5 rounded border border-border text-xs text-muted-text hover:text-dark-text hover:border-teal-primary transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy emails'}
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="px-2.5 py-1.5 rounded border border-border text-xs text-muted-text hover:text-dark-text hover:border-teal-primary transition-colors"
          >
            {expanded ? 'Collapse' : 'Details'}
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-text">Delete?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1 rounded text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? '…' : 'Yes'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 rounded text-xs border border-border text-muted-text hover:text-dark-text transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-2.5 py-1.5 rounded border border-border text-xs text-muted-text hover:text-red-500 hover:border-red-300 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-border px-5 py-4 flex flex-col gap-4">
          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-muted-text">Notes</p>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="text-xs text-teal-primary hover:underline">
                  {notes ? 'Edit' : '+ Add note'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add notes about this email blast…"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-dark-text focus:outline-none focus:border-teal-primary resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={saveNotes} disabled={saving} className="px-3 py-1.5 rounded-lg bg-teal-primary text-white text-xs font-medium disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setNotes(list.notes ?? ''); setEditingNotes(false) }} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-text hover:text-dark-text">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-dark-text whitespace-pre-wrap">{notes || <span className="text-muted-text italic">No notes</span>}</p>
            )}
          </div>

          {/* Recipients */}
          <div>
            <p className="text-xs font-medium text-muted-text mb-2">Recipients</p>
            <div className="flex flex-col gap-1">
              {list.email_list_recipients.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background border border-border text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="text-dark-text font-medium">{r.email}</span>
                    {r.is_primary && <span className="ml-2 bg-teal-light text-teal-primary rounded px-1.5 py-0.5">Primary</span>}
                  </div>
                  <span className="text-muted-text truncate">{r.partner_name}{r.contact_name ? ` · ${r.contact_name}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EmailListHistory({ lists, deptBadge, deptLabels }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {lists.map(list => (
        <ListCard key={list.id} list={list} deptBadge={deptBadge} deptLabels={deptLabels} />
      ))}
    </div>
  )
}
