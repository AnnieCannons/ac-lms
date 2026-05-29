'use client'

import { useState } from 'react'
import FormEmbedModal from './FormEmbedModal'

type ProgramTag = 'All' | 'ITP' | 'Adv. Frontend' | 'Adv. Backend'
type FormType = 'General' | 'Anonymous' | 'Growth Goals'

interface FormEntry {
  name: string
  program: ProgramTag
  type: FormType
  embedUrl: string
}

const FORMS: FormEntry[] = [
  {
    name: 'Post ITP Survey — Anonymous',
    program: 'ITP',
    type: 'Anonymous',
    embedUrl: 'https://airtable.com/embed/app4qZ9NIMIXXgX59/pagbcVSjVLnHamYa9/form',
  },
  {
    name: 'Post ITP Survey — Growth Goals',
    program: 'ITP',
    type: 'Growth Goals',
    embedUrl: 'https://airtable.com/embed/app4qZ9NIMIXXgX59/pagFq2bJXyOMW9zrh/form',
  },
  {
    name: 'Post Advanced Frontend — Anonymous',
    program: 'Adv. Frontend',
    type: 'Anonymous',
    embedUrl: 'https://airtable.com/embed/app4qZ9NIMIXXgX59/pagddG1Q1W3SlBdAf/form',
  },
  {
    name: 'Post Advanced Frontend — Growth Goals',
    program: 'Adv. Frontend',
    type: 'Growth Goals',
    embedUrl: 'https://airtable.com/embed/app4qZ9NIMIXXgX59/pag3OGtcZDtfqf5Yi/form',
  },
  {
    name: 'Post Advanced Backend — Anonymous',
    program: 'Adv. Backend',
    type: 'Anonymous',
    embedUrl: 'https://airtable.com/embed/app4qZ9NIMIXXgX59/pagzekIX6s02Utfb5/form',
  },
  {
    name: 'Post Advanced Backend — Growth Goals',
    program: 'Adv. Backend',
    type: 'Growth Goals',
    embedUrl: 'https://airtable.com/embed/app4qZ9NIMIXXgX59/pagTPhnOMJTz6Pssk/form',
  },
]

const PROGRAM_COLORS: Record<ProgramTag, string> = {
  All: 'bg-gray-100 text-gray-700',
  ITP: 'bg-blue-50 text-blue-700',
  'Adv. Frontend': 'bg-purple-50 text-purple-700',
  'Adv. Backend': 'bg-teal-50 text-teal-700',
}

const TYPE_COLORS: Record<FormType, string> = {
  General: 'bg-yellow-50 text-yellow-700',
  Anonymous: 'bg-orange-50 text-orange-700',
  'Growth Goals': 'bg-green-50 text-green-700',
}

export default function FormsGrid() {
  const [open, setOpen] = useState<FormEntry | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FORMS.map((form) => (
          <div
            key={form.name}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
          >
            <div>
              <p className="text-base font-semibold text-dark-text">{form.name}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`text-xs font-medium rounded px-2 py-0.5 ${PROGRAM_COLORS[form.program]}`}>
                  {form.program}
                </span>
                <span className={`text-xs font-medium rounded px-2 py-0.5 ${TYPE_COLORS[form.type]}`}>
                  {form.type}
                </span>
              </div>
            </div>
            <button
              onClick={() => setOpen(form)}
              className="mt-auto self-start text-sm font-medium text-teal-primary hover:underline"
            >
              Open Form
            </button>
          </div>
        ))}
      </div>

      {open && (
        <FormEmbedModal
          name={open.name}
          embedUrl={open.embedUrl}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}
