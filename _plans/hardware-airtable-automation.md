# Equipment Support Form → LMS (Airtable automation setup)

When a student submits the Equipment Support Form, an Airtable automation sends the issue to the LMS. The LMS matches the student (by **Student Email**) and their device, saves a ticket, and posts it in **#student-hardware** with links to the ticket and the Airtable record.

**The shipping address never leaves Airtable.** The script only sends the fields listed in it, and the LMS ignores anything else.

Set this up **after** the Phase 8 PR is merged and deployed, since the LMS address below has to exist first.

## 1. Make a secret and add it to Vercel

The secret proves to the LMS that a request really came from your Airtable. Generate one (any long random string works):

```bash
openssl rand -hex 32
```

In Vercel → the ac-lms project → **Settings → Environment Variables**, add:

- **Name:** `HARDWARE_TICKET_WEBHOOK_SECRET`
- **Value:** the string you just generated
- **Environments:** Production

Then redeploy (Deployments → the latest → **Redeploy**) so the LMS picks it up. Until this is set, the LMS refuses every request.

## 2. Create the automation in Airtable

1. Open the **Student Hardware** base → **Automations** → **+ Create automation**. Name it "Send support form to LMS".
2. **Trigger:** **When a form is submitted** and choose the Equipment Support Form. (Or **When a record is created** in the **Hardware Replacements** table.)
3. **Action:** **+ Add advanced logic or action** → **Run a script**.
4. In the script's left panel, under **Input variables**, click **+ Add input variable**:
   - **Name:** `recordId`
   - **Value:** click **+** → the trigger's record → **Airtable record ID**
5. Paste the script below into the code editor, then replace `PASTE-THE-SECRET-HERE` with the same secret you put in Vercel.
6. **Check the field names.** The form shows questions, but the script needs the **field names** from the table, which can be different. Open the **Hardware Replacements** table, look at the column headers, and fix any of the five names in `FIELDS` that don't match exactly.
7. Click **Test** (submit a test form first if it asks for a record). A success shows `{"ok":true,…}` under Output, and a post appears in #student-hardware.
8. Turn the automation **on**.

## The script

```js
// Equipment Support Form → AnnieCannons LMS
// Sends the issue (never the shipping address) to the LMS, which posts it in #student-hardware.

const LMS_URL = 'https://ac-lms.vercel.app/api/webhooks/hardware-ticket'
const SECRET = 'PASTE-THE-SECRET-HERE'

// Field (column) names in the Hardware Replacements table. Fix any that don't match exactly.
const FIELDS = {
  email: 'Student Email',
  name: 'Name',
  equipment: 'Please indicate the equipment you are having an issue with:',
  issue: 'Please describe the issue.',
  otherInfo: 'Any other information we should know?',
}

const { recordId } = input.config()
const table = base.getTable('Hardware Replacements')
const record = await table.selectRecordAsync(recordId)
if (!record) throw new Error(`Record not found: ${recordId}`)

const read = field => {
  try {
    return record.getCellValueAsString(field) || null
  } catch (e) {
    console.log(`Field not found: "${field}". Check the FIELDS names at the top.`)
    return null
  }
}

const body = {
  recordId,
  recordUrl: `https://airtable.com/${base.id}/${table.id}/${recordId}`,
  email: read(FIELDS.email),
  name: read(FIELDS.name),
  equipment: read(FIELDS.equipment),
  issue: read(FIELDS.issue),
  otherInfo: read(FIELDS.otherInfo),
}

const res = await fetch(LMS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-webhook-secret': SECRET },
  body: JSON.stringify(body),
})
const text = await res.text()
if (!res.ok) throw new Error(`The LMS said ${res.status}: ${text}`)
output.set('result', text)
```

## If something goes wrong

- **401 Unauthorized:** the secret in the script doesn't match `HARDWARE_TICKET_WEBHOOK_SECRET` in Vercel, or Vercel hasn't been redeployed since you added it.
- **400:** the script didn't send a record ID. Check the `recordId` input variable (step 4).
- **The post says "Couldn't match … to a student":** the email on the form isn't the one they use in the LMS. Open the ticket and use **Which student is this?** to match it by hand.
- **Running the same record twice** is safe: the LMS only makes one ticket per Airtable record.
- If the LMS ever moves to a different web address, update `LMS_URL`.
