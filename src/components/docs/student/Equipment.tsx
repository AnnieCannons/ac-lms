import { DocH3, DocP, DocList, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion, type DocAccordionItem } from '@/components/docs/DocAccordion'
import { RETURN_STEPS } from '@/lib/hardware-reminders'

export default function Equipment() {
  const items: DocAccordionItem[] = [
    {
      id: 'my-equipment',
      title: 'My Equipment',
      content: (
        <>
          <DocP>
            <strong>My Equipment</strong> in your course sidebar (and on your Profile page) shows the AnnieCannons equipment
            you have: your MacBook, hotspot or wifi booster. Each item has a tag like <strong>LAP-014</strong> and says
            whether it&apos;s:
          </DocP>
          <DocList>
            <li><strong>On loan from AnnieCannons</strong> — ours, for you to use while you&apos;re in the program.</li>
            <li><strong>Yours to keep</strong> — your laptop becomes yours once you&apos;ve completed Tech Career Foundations and Intro to Programming.</li>
            <li><strong>Please send this back</strong> — we need it returned (see below).</li>
          </DocList>
          <DocP>
            It also shows whether your one laptop replacement and one charger replacement are still available. AnnieCannons
            replaces a laptop and a charger once each.
          </DocP>
          <DocNote>
            If your booster doesn&apos;t have a label, write its tag (like BOOST-007) on it so we can tell it apart.
          </DocNote>
        </>
      ),
    },
    {
      id: 'check-in',
      title: 'The Equipment Check-In',
      content: (
        <>
          <DocP>
            Sometimes we&apos;ll ask you to fill out a short <strong>equipment check-in</strong>. You&apos;ll get a Slack
            message and a bell notification, and a banner on My Courses until you&apos;ve done it. It takes about 2 minutes:
          </DocP>
          <DocList>
            <li><strong>MacBook serial number:</strong> click the Apple menu (top-left corner) → <strong>About This Mac</strong>, and copy the serial number. It&apos;s also printed in small text on the bottom of the MacBook.</li>
            <li><strong>Hotspot IMEI or phone number:</strong> connect to the hotspot&apos;s Wi-Fi, go to <strong>mobile.hotspot</strong> in a browser, log in, and click <strong>About</strong>. The IMEI is also on the label under the battery and on the box.</li>
            <li>Whether you have a <strong>wifi booster</strong>, and whether we&apos;ve ever replaced your laptop or charger.</li>
          </DocList>
          <DocP>You can change your answers until we&apos;ve reviewed them.</DocP>
        </>
      ),
    },
    {
      id: 'sending-back',
      title: 'Sending Equipment Back',
      content: (
        <>
          <DocP>
            If we need something back (for example, when you finish or leave the program), you&apos;ll see{' '}
            <strong>Please send this back</strong> on My Equipment, an orange <strong>Send back</strong> badge in your
            sidebar, and a banner on My Courses. You&apos;ll also get reminders by Slack, email and the bell until it arrives.
          </DocP>
          <DocH3>How to send it back</DocH3>
          {RETURN_STEPS.map((step, i) => <DocStep key={i} number={i + 1}>{step}</DocStep>)}
        </>
      ),
    },
    {
      id: 'problems',
      title: 'Something Wrong With Your Equipment?',
      content: (
        <>
          <DocP>
            On My Equipment, click <strong>Report a problem with my equipment</strong>. It opens the Equipment Support Form;
            use the same email you use for the LMS, so we can see which device it&apos;s about. We&apos;ll get back to you.
          </DocP>
        </>
      ),
    },
  ]

  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">My Equipment</h1>
      <p className="text-sm text-muted-text mb-8">The laptop, hotspot or wifi booster AnnieCannons has given you, and how to return it.</p>

      <DocAccordion items={items} />
    </>
  )
}
