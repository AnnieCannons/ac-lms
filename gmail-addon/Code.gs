// AC Partnerships Gmail Add-on
//
// SETUP (one-time):
// 1. In Apps Script editor → Project Settings → Script Properties, add:
//      API_BASE   →  https://your-lms-url.com   (no trailing slash)
//      API_KEY    →  the value of ADDON_API_KEY from your .env.local
// 2. Deploy → Test deployments → Install for yourself
// 3. In Gmail, open any email — the sidebar appears automatically.

// ─── Config ───────────────────────────────────────────────────────────────────

function getConfig_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  return {
    apiBase: (props['API_BASE'] || '').replace(/\/$/, ''),
    apiKey: props['API_KEY'] || '',
  };
}

// ─── Main trigger ─────────────────────────────────────────────────────────────

function buildAddOn(e) {
  var userEmail = Session.getActiveUser().getEmail();

  try {
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    var message = GmailApp.getMessageById(e.gmail.messageId);
    var recipientEmails = getRecipientEmails_(message, userEmail);
    var subject = message.getSubject() || '';

    var partners = searchByEmails_(recipientEmails);

    if (partners.length > 0) {
      return [buildLogCard_(partners[0], subject, userEmail)];
    } else {
      return [buildNoMatchCard_(recipientEmails, subject, userEmail)];
    }
  } catch (err) {
    return [buildErrorCard_('Could not load message: ' + err.message)];
  }
}

function buildHomepageCard() {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle('AC Partnerships'));
  var section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText(
    'Open an email to log an interaction or add a new partner.'
  ));
  card.addSection(section);
  return [card.build()];
}

// ─── Card builders ────────────────────────────────────────────────────────────

function buildLogCard_(partner, subject, userEmail) {
  var location = [partner.city, partner.state].filter(Boolean).join(', ');

  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle('Log Interaction'));

  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newTextParagraph().setText(
      '<b>' + htmlEscape_(partner.name) + '</b>' + (location ? ' · ' + htmlEscape_(location) : '')
    )
  );

  if (partner.matched_contact) {
    section.addWidget(
      CardService.newTextParagraph().setText(
        htmlEscape_(partner.matched_contact.name) + ' &lt;' + htmlEscape_(partner.matched_contact.email) + '&gt;'
      )
    );
  }

  section.addWidget(CardService.newDivider());

  section.addWidget(
    CardService.newTextInput()
      .setFieldName('note')
      .setTitle('Note')
      .setHint('What happened in this interaction?')
      .setMultiline(true)
      .setValue(subject ? 'Subject line: ' + subject : '')
  );

  var defaultDept = (partner.matched_contact && partner.matched_contact.primary_departments && partner.matched_contact.primary_departments.length > 0)
    ? partner.matched_contact.primary_departments[0]
    : '';
  section.addWidget(buildDepartmentInput_(defaultDept));

  section.addWidget(
    CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.RADIO_BUTTON)
      .setTitle('Follow-up reminder')
      .setFieldName('remind_days')
      .addItem('No reminder', '0', true)
      .addItem('In 3 days', '3', false)
      .addItem('In 1 week', '7', false)
      .addItem('In 2 weeks', '14', false)
      .addItem('In 1 month', '30', false)
  );

  section.addWidget(
    CardService.newTextButton()
      .setText('Log Interaction')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('logInteraction')
          .setParameters({
            partnerId: partner.id,
            partnerName: partner.name,
            contactId: (partner.matched_contact && partner.matched_contact.id) ? partner.matched_contact.id : '',
            userEmail: userEmail,
          })
      )
  );

  section.addWidget(
    CardService.newTextButton()
      .setText('Not this partner →')
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('navigateToSearch')
          .setParameters({ userEmail: userEmail, subject: subject })
      )
  );

  card.addSection(section);
  return card.build();
}

function buildNoMatchCard_(recipientEmails, subject, userEmail) {
  var firstEmail = recipientEmails.length > 0 ? recipientEmails[0] : '';

  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle('Log Partner Interaction'));

  var section = CardService.newCardSection();
  section.setHeader('No matching partner found');

  section.addWidget(
    CardService.newTextInput()
      .setFieldName('search_query')
      .setTitle('Search by organization name')
  );

  section.addWidget(
    CardService.newTextButton()
      .setText('Search')
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('performNameSearch')
          .setParameters({ userEmail: userEmail, subject: subject })
      )
  );

  section.addWidget(CardService.newDivider());

  section.addWidget(
    CardService.newTextButton()
      .setText('+ Add New Partner')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('navigateToQuickAdd')
          .setParameters({ userEmail: userEmail, contactEmail: firstEmail, subject: subject, orgNameHint: '' })
      )
  );

  card.addSection(section);
  return card.build();
}

function buildQuickAddCard_(userEmail, contactEmail, subject, orgNameHint) {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle('Add New Partner'));

  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newTextInput()
      .setFieldName('org_name')
      .setTitle('Organization name')
      .setValue(orgNameHint || '')
  );

  section.addWidget(
    CardService.newTextInput()
      .setFieldName('contact_name')
      .setTitle('Contact name')
  );

  section.addWidget(
    CardService.newTextInput()
      .setFieldName('contact_email')
      .setTitle('Contact email')
      .setValue(contactEmail || '')
  );

  section.addWidget(
    CardService.newTextInput()
      .setFieldName('note')
      .setTitle('Interaction note')
      .setMultiline(true)
      .setValue(subject ? 'Subject line: ' + subject : '')
  );

  section.addWidget(buildDepartmentInput_(''));

  section.addWidget(
    CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.RADIO_BUTTON)
      .setTitle('Follow-up reminder')
      .setFieldName('remind_days')
      .addItem('No reminder', '0', true)
      .addItem('In 3 days', '3', false)
      .addItem('In 1 week', '7', false)
      .addItem('In 2 weeks', '14', false)
      .addItem('In 1 month', '30', false)
  );

  section.addWidget(
    CardService.newTextButton()
      .setText('Add Partner & Log')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('quickAddPartner')
          .setParameters({ userEmail: userEmail })
      )
  );

  card.addSection(section);
  return card.build();
}

function buildSuccessCard_(title, body, linkUrl, linkLabel) {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle(title));
  var section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText(body));
  if (linkUrl) {
    section.addWidget(
      CardService.newTextButton()
        .setText(linkLabel || 'View in Partnerships →')
        .setOpenLink(CardService.newOpenLink().setUrl(linkUrl))
    );
  }
  card.addSection(section);
  return card.build();
}

function buildErrorCard_(message) {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle('Something went wrong'));
  var section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText(message));
  card.addSection(section);
  return card.build();
}

// ─── Action handlers ──────────────────────────────────────────────────────────

function logInteraction(e) {
  var params = e.parameters;
  var formInput = e.formInput || {};
  var note = (formInput['note'] || '').trim();
  var remindDays = parseInt(formInput['remind_days'] || '0', 10);
  var today = new Date().toISOString().split('T')[0];

  if (!note) {
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(buildErrorCard_('Please add a note before logging.')))
      .build();
  }

  var department = (formInput['department'] || '').trim() || null;

  var result = callApi_('/api/partnerships/log-interaction', 'POST', {
    partner_id: params['partnerId'],
    note: note,
    interaction_date: today,
    remind_in_days: remindDays,
    contact_id: params['contactId'] || null,
    department: department,
    user_email: params['userEmail'],
  });

  if (result && result.success) {
    var config = getConfig_();
    var partnerUrl = config.apiBase + '/instructor/partnerships/' + params['partnerId'];
    var reminder = remindDays > 0 ? " You'll get a Slack reminder." : '';
    var card = buildSuccessCard_(
      'Logged!',
      'Interaction with ' + params['partnerName'] + ' has been recorded.' + reminder,
      partnerUrl,
      'View ' + params['partnerName'] + ' →'
    );
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().updateCard(card))
      .build();
  }

  var errorMsg = (result && result.error) ? result.error : 'Request failed. Check your connection.';
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(buildErrorCard_(errorMsg)))
    .build();
}

function quickAddPartner(e) {
  var params = e.parameters;
  var formInput = e.formInput || {};
  var orgName = (formInput['org_name'] || '').trim();
  var contactName = (formInput['contact_name'] || '').trim();
  var contactEmail = (formInput['contact_email'] || '').trim();
  var note = (formInput['note'] || '').trim();
  var remindDays = parseInt(formInput['remind_days'] || '0', 10);
  var today = new Date().toISOString().split('T')[0];

  if (!orgName) {
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(buildErrorCard_('Organization name is required.')))
      .build();
  }
  if (!note) {
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(buildErrorCard_('Please add an interaction note.')))
      .build();
  }

  var department = (formInput['department'] || '').trim() || null;

  var result = callApi_('/api/partnerships/quick-add', 'POST', {
    name: orgName,
    contact_name: contactName || null,
    contact_email: contactEmail || null,
    note: note,
    interaction_date: today,
    remind_in_days: remindDays,
    department: department,
    user_email: params['userEmail'],
  });

  if (result && result.success) {
    var config = getConfig_();
    var partnerUrl = config.apiBase + '/instructor/partnerships/' + result.partnerId;
    var card = buildSuccessCard_(
      'Partner Added!',
      orgName + ' has been added as a prospect. Check Slack for the link to complete their profile.',
      partnerUrl,
      'View ' + orgName + ' →'
    );
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().updateCard(card))
      .build();
  }

  var errorMsg = (result && result.error) ? result.error : 'Request failed. Check your connection.';
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(buildErrorCard_(errorMsg)))
    .build();
}

function navigateToSearch(e) {
  var params = e.parameters;
  var card = buildNoMatchCard_([], params['subject'] || '', params['userEmail']);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

function navigateToQuickAdd(e) {
  var params = e.parameters;
  var card = buildQuickAddCard_(
    params['userEmail'],
    params['contactEmail'] || '',
    params['subject'] || '',
    params['orgNameHint'] || ''
  );
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

function performNameSearch(e) {
  var params = e.parameters;
  var query = ((e.formInput || {})['search_query'] || '').trim();

  if (query.length < 2) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Enter at least 2 characters to search.'))
      .build();
  }

  var result = callApi_('/api/partnerships/search?q=' + encodeURIComponent(query), 'GET', null);
  var partners = (result && result.partners) ? result.partners : [];

  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle('Search Results'));
  var section = CardService.newCardSection();

  if (partners.length === 0) {
    section.addWidget(CardService.newTextParagraph().setText('No partners found for "' + htmlEscape_(query) + '".'));
    section.addWidget(
      CardService.newTextButton()
        .setText('+ Add "' + query + '" as new partner')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('navigateToQuickAdd')
            .setParameters({
              userEmail: params['userEmail'],
              contactEmail: '',
              subject: params['subject'] || '',
              orgNameHint: query,
            })
        )
    );
  } else {
    for (var i = 0; i < partners.length; i++) {
      var p = partners[i];
      var location = [p.city, p.state].filter(Boolean).join(', ');
      var label = p.name + (location ? ' (' + location + ')' : '');
      section.addWidget(
        CardService.newTextButton()
          .setText(label)
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName('selectPartnerFromSearch')
              .setParameters({
                partnerId: p.id,
                partnerName: p.name,
                userEmail: params['userEmail'],
                subject: params['subject'] || '',
              })
          )
      );
    }
  }

  card.addSection(section);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card.build()))
    .build();
}

function selectPartnerFromSearch(e) {
  var params = e.parameters;
  var partner = {
    id: params['partnerId'],
    name: params['partnerName'],
    city: null,
    state: null,
    matched_contact: null,
  };
  var card = buildLogCard_(partner, params['subject'] || '', params['userEmail']);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRecipientEmails_(message, currentUserEmail) {
  var fields = [message.getTo(), message.getCc(), message.getFrom()];
  var seen = {};
  var emails = [];
  var myEmail = currentUserEmail.toLowerCase();

  fields.forEach(function(field) {
    if (!field) return;
    field.split(',').forEach(function(part) {
      var email = extractEmail_(part.trim());
      if (!email) return;
      var key = email.toLowerCase();
      if (key === myEmail || seen[key]) return;
      seen[key] = true;
      emails.push(email);
    });
  });

  return emails;
}

function extractEmail_(str) {
  var match = str.match(/<([^>]+)>/);
  return match ? match[1].trim() : str.trim();
}

function searchByEmails_(emails) {
  for (var i = 0; i < emails.length; i++) {
    var result = callApi_('/api/partnerships/search?email=' + encodeURIComponent(emails[i]), 'GET', null);
    if (result && result.partners && result.partners.length > 0) {
      return result.partners;
    }
  }
  return [];
}

function callApi_(path, method, body) {
  var config = getConfig_();
  if (!config.apiBase || !config.apiKey) {
    throw new Error('API_BASE and API_KEY must be set in Script Properties.');
  }

  var options = {
    method: method.toLowerCase(),
    headers: {
      'x-addon-api-key': config.apiKey,
      'ngrok-skip-browser-warning': 'true',
    },
    muteHttpExceptions: true,
  };

  if (body !== null && method !== 'GET') {
    options['headers']['Content-Type'] = 'application/json';
    options['payload'] = JSON.stringify(body);
  }

  try {
    var response = UrlFetchApp.fetch(config.apiBase + path, options);
    var code = response.getResponseCode();
    var text = response.getContentText();

    if (code >= 200 && code < 300) {
      return JSON.parse(text);
    }
    var parsed = {};
    try { parsed = JSON.parse(text); } catch (_) {}
    return { error: parsed['error'] || ('HTTP ' + code) };
  } catch (err) {
    return { error: err.message };
  }
}

function buildDepartmentInput_(defaultDept) {
  var input = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.RADIO_BUTTON)
    .setTitle('Department')
    .setFieldName('department');
  var depts = [
    ['', 'None'],
    ['student_success', 'Student Success'],
    ['career_development', 'Career Development'],
    ['resourcefull', 'ResourceFull'],
    ['funding_partnerships', 'Funding Partnerships'],
    ['admissions', 'Admissions'],
  ];
  for (var i = 0; i < depts.length; i++) {
    input.addItem(depts[i][1], depts[i][0], depts[i][0] === defaultDept);
  }
  return input;
}

function htmlEscape_(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
