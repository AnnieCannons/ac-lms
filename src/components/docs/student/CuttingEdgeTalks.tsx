import { DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion, type DocAccordionItem } from '@/components/docs/DocAccordion'

export default function CuttingEdgeTalks() {
  const items: DocAccordionItem[] = [
    {
      id: 'overview',
      title: 'What Are Cutting Edge Talks?',
      content: (
        <>
          <DocP>
            Cutting Edge Talks are guest speakers from across tech. Find them under <strong>Cutting Edge Talks</strong> in
            your course sidebar, split into <strong>Upcoming</strong> and <strong>Past</strong>.
          </DocP>
          <DocP>
            Talk times are shown in <strong>your own timezone</strong>. Some talks also show a block (A–D) — the part of
            the day it happens in.
          </DocP>
        </>
      ),
    },
    {
      id: 'rsvp',
      title: 'RSVPing',
      content: (
        <>
          <DocStep number={1}>Open a talk and answer <strong>Are you coming?</strong> — Yes or No.</DocStep>
          <DocStep number={2}>If you say yes, you&apos;ll go straight to <strong>Submit Your Question in Advance</strong>.</DocStep>
          <DocTip>
            You can change your answer any time before the talk starts — please do if your plans change. RSVPs close
            when the talk begins.
          </DocTip>
        </>
      ),
    },
    {
      id: 'assignments',
      title: 'The Two Assignments',
      content: (
        <>
          <DocP>If you RSVP yes, you have two short tasks:</DocP>
          <DocList>
            <li>
              <strong>💬 Submit Your Question in Advance</strong> — post one question for the speaker on the Padlet, then
              check <strong>I submitted my question on the Padlet</strong>. Due before the talk.
            </li>
            <li>
              <strong>🌉 Say Thank You &amp; Build Bridges</strong> — opens after the talk. Add a thank-you on the Padlet, then
              check <strong>I added my thank-you to the Padlet</strong>.
            </li>
          </DocList>
          <DocP>
            Said yes but couldn&apos;t make it? On the thank-you, check <strong>I did not make it to the talk</strong> instead.
          </DocP>
          <DocNote>
            These don&apos;t count toward your grades. If you RSVP no, neither one is required.
          </DocNote>
        </>
      ),
    },
    {
      id: 'reminders',
      title: 'Reminders',
      content: (
        <>
          <DocList>
            <li>An orange <strong>Tasks due</strong> badge appears next to Cutting Edge Talks in your sidebar while you have something to do.</li>
            <li>You&apos;ll get a bell notification and a Slack message when a new talk is posted, 2 days before your question is due, and the morning after the talk if you haven&apos;t said thank you yet.</li>
          </DocList>
          <DocP>Already done? You won&apos;t get the reminder.</DocP>
        </>
      ),
    },
  ]

  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Cutting Edge Talks</h1>
      <p className="text-sm text-muted-text mb-8">RSVP to guest speakers, send your question in advance, and say thank you afterward.</p>

      <DocAccordion items={items} />
    </>
  )
}
