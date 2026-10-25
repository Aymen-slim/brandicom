import { Type } from '@google/genai';

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[] = []) {
  return {
    name,
    description,
    parameters: {
      type: Type.OBJECT,
      properties,
      required,
    },
  };
}

function text(description: string) {
  return { type: Type.STRING, description };
}

function optionalText(description: string) {
  return { type: Type.STRING, description };
}

function enumText(values: readonly string[], description: string) {
  return { type: Type.STRING, enum: [...values], description };
}

function actionDeclaration(admin: boolean) {
  const actionTypes = [
    'create_client',
    'create_deliverable',
    'update_deliverable_status',
    'update_client',
    'add_client_note',
    'book_partner',
    ...(admin
      ? ['upsert_goal', 'create_expense', 'create_invoice', 'record_payment', 'update_contract']
      : []),
  ];

  return {
    type: Type.OBJECT,
    properties: {
      type: enumText(actionTypes, 'Action type. Only use an allowed type.'),
      clientId: optionalText('Client UUID for actions that target a client.'),
      deliverableId: optionalText('Deliverable UUID for status updates or partner bookings.'),
      name: optionalText('Client name for create_client.'),
      location: optionalText('Client location.'),
      status: optionalText(
        'Client status active|starting|one_time|paused, or deliverable status idea|scripted|filmed|editing|scheduled|published depending on the action.'
      ),
      services: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Client services.' },
      notes: optionalText('Client notes, up to 2000 characters.'),
      industry: optionalText('Client industry.'),
      website: optionalText('Client website.'),
      contactName: optionalText('Primary contact name.'),
      contactEmail: optionalText('Primary contact email.'),
      contactPhone: optionalText('Primary contact phone.'),
      startDate: optionalText('Date in YYYY-MM-DD format.'),
      leadSource: optionalText('How the client was acquired.'),
      tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Client tags.' },
      monthlyFee: { type: Type.NUMBER, description: 'Admin only: monthly retainer in TND.' },
      contractType: optionalText('Admin only: retainer|project|one_off.'),
      assignedUserIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Admin only: user UUIDs to assign.',
      },
      fields: {
        type: Type.OBJECT,
        description:
          'Fields to update for update_client. Use name, location, status, services, notes, industry, website, contactName, contactEmail, contactPhone, startDate, endDate, leadSource, churnReason, tags, assetsUrl, logoUrl.',
        properties: {
          name: text('Client name.'),
          location: text('Location.'),
          status: enumText(['active', 'starting', 'one_time', 'paused'], 'Client status.'),
          services: { type: Type.ARRAY, items: { type: Type.STRING } },
          notes: text('Notes.'),
          industry: text('Industry.'),
          website: text('Website.'),
          contactName: text('Contact name.'),
          contactEmail: text('Contact email.'),
          contactPhone: text('Contact phone.'),
          startDate: text('YYYY-MM-DD.'),
          endDate: text('YYYY-MM-DD.'),
          leadSource: text('Lead source.'),
          churnReason: text('Churn reason.'),
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          assetsUrl: text('Assets URL.'),
          logoUrl: text('Logo URL.'),
        },
      },
      idea: optionalText('Deliverable idea or title for create_deliverable.'),
      format: enumText(['reel', 'photo', 'story', 'carousel', 'ad', 'photoshoot'], 'Deliverable format.'),
      platform: enumText(['instagram', 'tiktok', 'facebook', 'youtube', 'both'], 'Publishing platform.'),
      filmingDate: optionalText('Filming date YYYY-MM-DD.'),
      publishDate: optionalText('Publish date YYYY-MM-DD.'),
      note: optionalText('Note to append for add_client_note.'),
      partnerId: optionalText('Creator/partner UUID for book_partner.'),
      scheduledDate: optionalText('Booking date YYYY-MM-DD.'),
      periodType: enumText(['month', 'year'], 'Goal period type.'),
      periodValue: optionalText('Goal period, e.g. 2026-10 or 2026.'),
      metric: optionalText('Goal metric, e.g. deliverables, views, followers_gained.'),
      target: { type: Type.NUMBER, description: 'Goal target value.' },
      date: optionalText('Expense or payment date YYYY-MM-DD.'),
      amount: { type: Type.NUMBER, description: 'Money amount in TND. Admin only.' },
      category: optionalText('Expense category. Admin only.'),
      description: optionalText('Expense description. Admin only.'),
      subtotal: { type: Type.NUMBER, description: 'Invoice subtotal before VAT. Admin only.' },
      periodLabel: optionalText('Invoice period label. Admin only.'),
      invoiceId: optionalText('Invoice UUID. Admin only.'),
    },
    required: ['type'],
  };
}

export function toolDeclarations(isAdminUser: boolean) {
  const read = [
    tool(
      'get_agency_overview',
      'KPI snapshot for a month (YYYY-MM) or year (YYYY). Members receive non-financial metrics only.',
      {
        period: text('Month YYYY-MM or year YYYY. Defaults to the current month.'),
      }
    ),
    tool('list_clients', 'List clients with status and current health, optionally filtered by status or search text.', {
      status: text('active|starting|one_time|paused'),
      search: text('Search by client name or location.'),
      limit: { type: Type.NUMBER, description: 'Maximum results, default 30, max 60.' },
    }),
    tool(
      'get_client',
      'Compact client profile: status, services, goals, socials, health, follower history and top content. Use this before answering client-specific questions.',
      { clientId: text('Client UUID.') },
      ['clientId']
    ),
    tool(
      'get_client_health',
      'Current health score, risk level, factors and recommended action for a client.',
      {
        clientId: text('Client UUID.'),
      },
      ['clientId']
    ),
    tool(
      'get_client_engagement',
      'Engagement totals for a client in a period (YYYY-MM, YYYY or all time).',
      {
        clientId: text('Client UUID.'),
        period: text('Month YYYY-MM, year YYYY, or all.'),
      },
      ['clientId']
    ),
    tool(
      'get_follower_growth',
      'Follower history and current audience size for a client.',
      {
        clientId: text('Client UUID.'),
      },
      ['clientId']
    ),
    tool(
      'get_top_posts',
      'Best performing posts for a client, ordered by views.',
      {
        clientId: text('Client UUID.'),
        limit: { type: Type.NUMBER, description: 'Maximum results, default 5, max 15.' },
      },
      ['clientId']
    ),
    tool(
      'list_deliverables',
      'Deliverables for a client, optionally filtered by status.',
      {
        clientId: text('Client UUID.'),
        status: text('idea|scripted|filmed|editing|scheduled|published'),
        limit: { type: Type.NUMBER, description: 'Maximum results, default 40, max 80.' },
      },
      ['clientId']
    ),
    tool('get_upcoming', 'Upcoming filming and publishing schedule, optionally for one client.', {
      clientId: text('Client UUID.'),
      days: { type: Type.NUMBER, description: 'Look-ahead window in days, default 14, max 60.' },
    }),
    tool('list_partners', 'Partner/talent directory with role, availability, rate (admin only) and style tags.', {
      role: text('photographer|videographer|ugc|presenter|influencer|agency|editor|designer|model'),
      search: text('Search by name or Instagram handle.'),
    }),
    tool('get_goals', 'Goal targets vs actuals for a month or year.', {
      period: text('Month YYYY-MM or year YYYY.'),
    }),
    tool(
      'search',
      'Search clients, partners, deliverables and invoices by text.',
      {
        query: text('Search term.'),
      },
      ['query']
    ),
    tool(
      'get_report',
      'Saved monthly client report, if one exists.',
      {
        clientId: text('Client UUID.'),
        month: text('Month YYYY-MM.'),
      },
      ['clientId', 'month']
    ),
    tool(
      'propose_changes',
      [
        'Propose data changes. Low-risk actions (create_deliverable, update_deliverable_status) may be applied automatically with an Undo action. All other actions require user confirmation. Never claim a confirmed write succeeded before the user confirms it.',
        'Required fields by type:',
        'create_client: name. create_deliverable: clientId, idea. update_deliverable_status: deliverableId, status. update_client: clientId, fields (put changed fields inside fields). add_client_note: clientId, note. book_partner: clientId, partnerId. upsert_goal: periodType, periodValue, metric, target.',
        'Admin only: create_expense: date, amount, category. create_invoice: clientId, subtotal. record_payment: invoiceId, amount. update_contract: clientId, monthlyFee.',
      ].join(' '),
      {
        actions: {
          type: Type.ARRAY,
          items: actionDeclaration(isAdminUser),
          description: '1 to 10 actions. Keep related changes in one proposal.',
        },
        summary: text('Short human-readable summary of the proposed changes.'),
      },
      ['actions']
    ),
  ];

  if (!isAdminUser) return read;

  return [
    ...read,
    tool('get_finance_summary', 'P&L, cash received and outstanding invoices for a period (admin).', {
      period: text('Month YYYY-MM or year YYYY.'),
    }),
    tool('list_invoices', 'List invoices (admin).', {
      status: text('draft|sent|paid|partially_paid|overdue|cancelled'),
      clientId: text('Client UUID.'),
    }),
    tool('list_expenses', 'List expenses (admin).', {
      category: text('Expense category.'),
      clientId: text('Client UUID.'),
    }),
    tool('get_contact_submissions', 'Website contact-form leads, newest first (admin).', {
      limit: { type: Type.NUMBER, description: 'Default 10, max 30.' },
    }),
  ];
}
