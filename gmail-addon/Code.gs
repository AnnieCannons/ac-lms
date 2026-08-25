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
    var thread = message.getThread();
    var threadInfo = getThreadInfo_(thread, message);

    var partners = searchByEmails_(recipientEmails);

    if (partners.length > 0) {
      return [buildLogCard_(partners[0], subject, userEmail, threadInfo)];
    } else {
      return [buildNoMatchCard_(recipientEmails, subject, userEmail, e.gmail.messageId)];
    }
  } catch (err) {
    return [buildErrorCard_('Could not load message: ' + err.message)];
  }
}

function getThreadInfo_(thread, message) {
  var messages = thread.getMessages();
  var currentId = message.getId();
  var index = 0;
  var others = [];

  for (var i = 0; i < messages.length; i++) {
    if (messages[i].getId() === currentId) {
      index = i;
    } else {
      others.push(messages[i]);
    }
  }

  return {
    threadId: thread.getId(),
    messageId: currentId,
    messageDate: message.getDate(),
    messageIndex: index + 1,
    messageCount: messages.length,
    otherMessages: others,
  };
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

function buildLogCard_(partner, subject, userEmail, threadInfo) {
  var location = [partner.city, partner.state].filter(Boolean).join(', ');

  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle('Log Interaction'));

  var infoSection = CardService.newCardSection();

  infoSection.addWidget(
    CardService.newTextParagraph().setText(
      '<b>' + htmlEscape_(partner.name) + '</b>' + (location ? ' · ' + htmlEscape_(location) : '')
    )
  );

  if (partner.matched_contact) {
    infoSection.addWidget(
      CardService.newTextParagraph().setText(
        htmlEscape_(partner.matched_contact.name) + ' &lt;' + htmlEscape_(partner.matched_contact.email) + '&gt;'
      )
    );
  } else if (partner.searched_email) {
    // Matched by organization domain only — no specific contact on file for
    // this address, so show the real address instead of guessing a name.
    infoSection.addWidget(
      CardService.newTextParagraph().setText(
        '<font color="#666666">' + htmlEscape_(partner.searched_email) + ' (not on file as a contact yet)</font>'
      )
    );
  }

  if (threadInfo) {
    var dateLabel = formatDateLabel_(threadInfo.messageDate);
    var positionLabel = threadInfo.messageCount > 1
      ? ' · Message ' + threadInfo.messageIndex + ' of ' + threadInfo.messageCount + ' in this thread'
      : '';
    infoSection.addWidget(
      CardService.newTextParagraph().setText('<font color="#666666">' + dateLabel + positionLabel + '</font>')
    );
  }

  card.addSection(infoSection);

  var threadSection = buildThreadChecklistSection_(partner, userEmail, threadInfo, {
    departmentField: 'department',
    remindDaysField: 'remind_days',
  });
  if (threadSection) card.addSection(threadSection);

  var formSection = CardService.newCardSection();

  formSection.addWidget(CardService.newDivider());

  formSection.addWidget(
    CardService.newTextInput()
      .setFieldName('note')
      .setTitle('Note')
      .setHint('What happened in this interaction?')
      .setMultiline(true)
      .setValue(subject ? 'Subject line: ' + subject : '')
  );

  var defaultDepts = (partner.matched_contact && partner.matched_contact.primary_departments) || [];
  formSection.addWidget(buildDepartmentInput_('department', defaultDepts));
  formSection.addWidget(buildReminderInput_('remind_days'));

  formSection.addWidget(
    CardService.newDateTimePicker()
      .setTitle('Or pick an exact date & time (optional, overrides the checkboxes above)')
      .setFieldName('remind_at')
  );

  formSection.addWidget(
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
            messageDate: threadInfo ? formatDateIso_(threadInfo.messageDate) : '',
          })
      )
  );

  formSection.addWidget(
    CardService.newTextButton()
      .setText('Not this partner →')
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('navigateToSearch')
          .setParameters({ userEmail: userEmail, subject: subject, messageId: threadInfo ? threadInfo.messageId : '' })
      )
  );

  card.addSection(formSection);

  return card.build();
}

function buildThreadChecklistSection_(partner, userEmail, threadInfo, sharedFields) {
  if (!threadInfo || !threadInfo.otherMessages || threadInfo.otherMessages.length === 0) return null;

  var domain = partner.matched_contact ? domainOf_(partner.matched_contact.email) : null;
  var departmentField = (sharedFields && sharedFields.departmentField) || 'thread_department';
  var remindDaysField = (sharedFields && sharedFields.remindDaysField) || 'thread_remind_days';

  var section = CardService.newCardSection();
  section.setHeader('Other messages in this thread');

  var checkbox = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName('selected_thread_ids');

  for (var i = 0; i < threadInfo.otherMessages.length; i++) {
    var msg = threadInfo.otherMessages[i];
    var isMatch = domain ? messageMatchesDomain_(msg, domain, userEmail) : false;
    var label = formatDateLabel_(msg.getDate()) + ' — ' + (msg.getSubject() || '(no subject)') +
      (isMatch ? '' : '  ·  not matched to partner');
    checkbox.addItem(label, msg.getId(), false);
  }

  section.addWidget(checkbox);

  if (sharedFields) {
    section.addWidget(CardService.newTextParagraph().setText(
      '<font color="#666666">Checked messages are logged with the department and reminder chosen below.</font>'
    ));
  } else {
    section.addWidget(buildDepartmentInput_(departmentField, []));
    section.addWidget(buildReminderInput_(remindDaysField));
  }

  section.addWidget(
    CardService.newTextButton()
      .setText('Log Selected Messages')
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('logThreadMessages')
          .setParameters({
            partnerId: partner.id,
            partnerName: partner.name,
            contactId: (partner.matched_contact && partner.matched_contact.id) ? partner.matched_contact.id : '',
            userEmail: userEmail,
            threadId: threadInfo.threadId,
            departmentField: departmentField,
            remindDaysField: remindDaysField,
          })
      )
  );

  return section;
}

function buildNoMatchCard_(recipientEmails, subject, userEmail, messageId) {
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
          .setParameters({ userEmail: userEmail, subject: subject, messageId: messageId })
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
          .setParameters({ userEmail: userEmail, contactEmail: firstEmail, subject: subject, orgNameHint: '', messageId: messageId })
      )
  );

  card.addSection(section);
  return card.build();
}

function buildQuickAddCard_(userEmail, contactEmail, subject, orgNameHint, messageId, threadInfo) {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle('Add New Partner'));

  var section = CardService.newCardSection();

  if (threadInfo) {
    var dateLabel = formatDateLabel_(threadInfo.messageDate);
    var positionLabel = threadInfo.messageCount > 1
      ? ' · Message ' + threadInfo.messageIndex + ' of ' + threadInfo.messageCount + ' in this thread'
      : '';
    section.addWidget(
      CardService.newTextParagraph().setText('<font color="#666666">' + dateLabel + positionLabel + '</font>')
    );
  }

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

  section.addWidget(buildDepartmentInput_('department', []));
  section.addWidget(buildReminderInput_('remind_days'));

  section.addWidget(
    CardService.newDateTimePicker()
      .setTitle('Or pick an exact date & time (optional, overrides the checkboxes above)')
      .setFieldName('remind_at')
  );

  section.addWidget(
    CardService.newTextButton()
      .setText('Add Partner & Log')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('quickAddPartner')
          .setParameters({ userEmail: userEmail, messageId: messageId })
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

function buildQuickAddSuccessCard_(title, body, linkUrl, linkLabel, partner, userEmail, threadInfo) {
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

  var threadSection = buildThreadChecklistSection_(partner, userEmail, threadInfo, null);
  if (threadSection) card.addSection(threadSection);

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
  var departments = (e.formInputs && e.formInputs['department']) || [];
  var remindDaysList = ((e.formInputs && e.formInputs['remind_days']) || []).map(function(d) { return parseInt(d, 10); });
  var remindAt = remindAtFromFormInput_(formInput);
  var interactionDate = params['messageDate'] || new Date().toISOString().split('T')[0];

  if (!note) {
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(buildErrorCard_('Please add a note before logging.')))
      .build();
  }

  var result = callApi_('/api/partnerships/log-interaction', 'POST', {
    partner_id: params['partnerId'],
    note: note,
    interaction_date: interactionDate,
    remind_in_days: remindDaysList,
    remind_at: remindAt,
    contact_id: params['contactId'] || null,
    departments: departments,
    user_email: params['userEmail'],
  });

  if (result && result.success) {
    var config = getConfig_();
    var partnerUrl = config.apiBase + '/instructor/partnerships/' + params['partnerId'];
    var reminder = (remindAt || remindDaysList.length > 0) ? " You'll get a Slack reminder." : '';
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
  var departments = (e.formInputs && e.formInputs['department']) || [];
  var remindDaysList = ((e.formInputs && e.formInputs['remind_days']) || []).map(function(d) { return parseInt(d, 10); });
  var remindAt = remindAtFromFormInput_(formInput);
  var interactionDate = loadMessageDateIso_(e, params['messageId']) || new Date().toISOString().split('T')[0];

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

  var result = callApi_('/api/partnerships/quick-add', 'POST', {
    name: orgName,
    contact_name: contactName || null,
    contact_email: contactEmail || null,
    note: note,
    interaction_date: interactionDate,
    remind_in_days: remindDaysList,
    remind_at: remindAt,
    departments: departments,
    user_email: params['userEmail'],
  });

  if (result && result.success) {
    var config = getConfig_();
    var partnerUrl = config.apiBase + '/instructor/partnerships/' + result.partnerId;
    var newPartner = {
      id: result.partnerId,
      name: orgName,
      matched_contact: contactEmail ? { id: null, email: contactEmail } : null,
    };
    var threadInfo = loadThreadInfoByMessageId_(e, params['messageId']);
    var card = buildQuickAddSuccessCard_(
      'Partner Added!',
      orgName + ' has been added as a prospect. Check Slack for the link to complete their profile.',
      partnerUrl,
      'View ' + orgName + ' →',
      newPartner,
      params['userEmail'],
      threadInfo
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

function logThreadMessages(e) {
  var params = e.parameters;
  var selectedIds = (e.formInputs && e.formInputs['selected_thread_ids']) || [];

  if (selectedIds.length === 0) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Select at least one message to log.'))
      .build();
  }

  try {
    if (e.gmail && e.gmail.accessToken) {
      GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    }
    var thread = GmailApp.getThreadById(params['threadId']);
    var messages = thread.getMessages();
    var selectedSet = {};
    selectedIds.forEach(function(id) { selectedSet[id] = true; });

    var interactions = [];
    messages.forEach(function(message) {
      if (!selectedSet[message.getId()]) return;
      interactions.push({
        note: 'Subject line: ' + (message.getSubject() || ''),
        interaction_date: formatDateIso_(message.getDate()),
      });
    });

    if (interactions.length === 0) {
      return CardService.newActionResponseBuilder()
        .setNavigation(CardService.newNavigation().pushCard(buildErrorCard_('Could not find the selected messages.')))
        .build();
    }

    var formInput = e.formInput || {};
    var departmentField = params['departmentField'] || 'thread_department';
    var remindDaysField = params['remindDaysField'] || 'thread_remind_days';
    var departments = (e.formInputs && e.formInputs[departmentField]) || [];
    var remindDaysList = ((e.formInputs && e.formInputs[remindDaysField]) || []).map(function(d) { return parseInt(d, 10); });
    var remindAt = remindAtFromFormInput_(formInput);

    var result = callApi_('/api/partnerships/log-interactions-bulk', 'POST', {
      partner_id: params['partnerId'],
      contact_id: params['contactId'] || null,
      departments: departments,
      remind_in_days: remindDaysList,
      remind_at: remindAt,
      user_email: params['userEmail'],
      interactions: interactions,
    });

    if (result && result.success) {
      var config = getConfig_();
      var partnerUrl = config.apiBase + '/instructor/partnerships/' + params['partnerId'];
      var reminder = (remindAt || remindDaysList.length > 0) ? " You'll get a Slack reminder." : '';
      var card = buildSuccessCard_(
        'Logged!',
        result.count + ' interaction' + (result.count === 1 ? '' : 's') + ' with ' + params['partnerName'] + ' recorded.' + reminder,
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
  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(buildErrorCard_('Could not load thread: ' + err.message)))
      .build();
  }
}

function navigateToSearch(e) {
  var params = e.parameters;
  var card = buildNoMatchCard_([], params['subject'] || '', params['userEmail'], params['messageId'] || '');
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

function navigateToQuickAdd(e) {
  var params = e.parameters;
  var threadInfo = loadThreadInfoByMessageId_(e, params['messageId'] || '');
  var card = buildQuickAddCard_(
    params['userEmail'],
    params['contactEmail'] || '',
    params['subject'] || '',
    params['orgNameHint'] || '',
    params['messageId'] || '',
    threadInfo
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
              messageId: params['messageId'] || '',
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
                messageId: params['messageId'] || '',
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
  var threadInfo = loadThreadInfoByMessageId_(e, params['messageId']);
  var card = buildLogCard_(partner, params['subject'] || '', params['userEmail'], threadInfo);
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

function domainOf_(email) {
  if (!email) return null;
  var at = email.indexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : null;
}

function messageMatchesDomain_(message, domain, selfEmail) {
  if (!domain) return false;
  var emails = getRecipientEmails_(message, selfEmail);
  for (var i = 0; i < emails.length; i++) {
    if (domainOf_(emails[i]) === domain) return true;
  }
  return false;
}

function formatDateIso_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatDateLabel_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMM d, yyyy');
}

// DatetimePicker's formInput value is epoch millis as a string. Returns an ISO
// datetime string, or null if the picker was left empty.
function remindAtFromFormInput_(formInput) {
  var raw = formInput['remind_at'];
  if (!raw) return null;
  var ms = parseInt(raw, 10);
  if (!ms) return null;
  return new Date(ms).toISOString();
}

function loadThreadInfoByMessageId_(e, messageId) {
  if (!messageId) return null;
  try {
    if (e.gmail && e.gmail.accessToken) {
      GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    }
    var message = GmailApp.getMessageById(messageId);
    return getThreadInfo_(message.getThread(), message);
  } catch (err) {
    return null;
  }
}

function loadMessageDateIso_(e, messageId) {
  var threadInfo = loadThreadInfoByMessageId_(e, messageId);
  return threadInfo ? formatDateIso_(threadInfo.messageDate) : null;
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

function buildDepartmentInput_(fieldName, defaultDepts) {
  var input = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setTitle('Department')
    .setFieldName(fieldName);
  var depts = [
    ['student_success', 'Student Success'],
    ['career_development', 'Career Development'],
    ['resourcefull', 'ResourceFull'],
    ['funding_partnerships', 'Funding Partnerships'],
    ['admissions', 'Admissions'],
  ];
  var defaults = defaultDepts || [];
  for (var i = 0; i < depts.length; i++) {
    input.addItem(depts[i][1], depts[i][0], defaults.indexOf(depts[i][0]) !== -1);
  }
  return input;
}

function buildReminderInput_(fieldName) {
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setTitle('Follow-up reminder')
    .setFieldName(fieldName)
    .addItem('In 3 days', '3', false)
    .addItem('In 1 week', '7', false)
    .addItem('In 2 weeks', '14', false)
    .addItem('In 1 month', '30', false);
}

function htmlEscape_(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
