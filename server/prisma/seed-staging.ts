import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function dateOffset(days: number) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function main() {
  const email = String(process.env.OWNER_EMAIL || 'staging@book.local').trim().toLowerCase();
  const owner = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true },
  });
  if (!owner?.memberships?.[0]) {
    throw new Error('Run seed:owner before seed:staging');
  }

  const tenantId = owner.memberships[0].tenantId;
  const marker = await prisma.businessPerson.findUnique({
    where: { tenantId_key: { tenantId, key: 'staging-client-anna' } },
  });
  if (marker) {
    console.log('Staging fixtures already exist; preserving current test data.');
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const today = dateOffset(0);
  const tomorrow = dateOffset(1);
  const profileKey = 'profile';
  const workplaceKey = 'studio-test';

  const people = [
    {
      key: 'staging-client-anna',
      id: 'STG-001',
      name: 'Анна',
      surname: 'Тест',
      gender: 'female',
      birthDate: '',
      phones: ['+79990000101'],
      telegrams: [],
      emails: ['anna.test@example.invalid'],
      accounts: [],
      links: [],
      tags: ['tag-vip'],
      discountPercent: 10,
      agreements: {},
      visits: 1,
      totalSpent: 4500,
      lastVisit: today,
      programs: [],
      createdAt: nowIso,
    },
    {
      key: 'staging-client-irina',
      id: 'STG-002',
      name: 'Ирина',
      surname: 'Демо',
      gender: 'female',
      birthDate: '',
      phones: ['+79990000102'],
      telegrams: [],
      emails: ['irina.demo@example.invalid'],
      accounts: [],
      links: [],
      tags: [],
      discountPercent: 0,
      agreements: {},
      visits: 0,
      totalSpent: 0,
      lastVisit: '',
      programs: [],
      createdAt: nowIso,
    },
  ];

  const paidFinance = {
    items: [{
      sourceType: 'procedure',
      sourceId: 'procedure-cut',
      name: 'Стрижка',
      price: 5000,
      discountMode: 'percent',
      discountPercent: 10,
      discountMoney: 500,
      planAmount: 4500,
    }],
    serviceTotal: 5000,
    discountPercent: 10,
    discountTotal: 500,
    planTotal: 4500,
  };

  const futureFinance = {
    items: [{
      sourceType: 'procedure',
      sourceId: 'procedure-color',
      name: 'Окрашивание',
      price: 8000,
      discountMode: 'none',
      discountPercent: 0,
      discountMoney: 0,
      planAmount: 8000,
    }],
    serviceTotal: 8000,
    discountPercent: 0,
    discountTotal: 0,
    planTotal: 8000,
  };

  const records = [
    {
      id: 'staging-record-paid',
      date: today,
      workplaceId: workplaceKey,
      from: '10:00',
      to: '11:00',
      client: {
        key: 'staging-client-anna',
        name: 'Анна',
        surname: 'Тест',
        phone: '+79990000101',
        discountPercent: 10,
      },
      procedures: [{ id: 'procedure-cut', name: 'Стрижка', cost: 5000, duration: 60 }],
      products: [],
      finance: paidFinance,
      attendance: 'arrived',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'staging-record-future',
      date: tomorrow,
      workplaceId: workplaceKey,
      from: '15:00',
      to: '16:30',
      client: {
        key: 'staging-client-irina',
        name: 'Ирина',
        surname: 'Демо',
        phone: '+79990000102',
        discountPercent: 0,
      },
      procedures: [{ id: 'procedure-color', name: 'Окрашивание', cost: 8000, duration: 90 }],
      products: [],
      finance: futureFinance,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const recordEvents = records.map((record, index) => ({
    id: `staging-record-event-${index + 1}`,
    recordId: record.id,
    type: 'created',
    at: nowIso,
    payload: {},
  }));

  const operational = {
    days: [
      { date: today, workplaceId: workplaceKey, from: '09:00', to: '20:00' },
      { date: tomorrow, workplaceId: workplaceKey, from: '09:00', to: '20:00' },
    ],
    breaks: [],
    procedures: [
      {
        id: 'procedure-cut',
        name: 'Стрижка',
        duration: 60,
        cost: { mode: 'amount', amount: 5000, free: false },
        workplaces: [{ workplaceId: workplaceKey, name: 'Тестовая студия' }],
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'procedure-color',
        name: 'Окрашивание',
        duration: 90,
        cost: { mode: 'amount', amount: 8000, free: false },
        workplaces: [{ workplaceId: workplaceKey, name: 'Тестовая студия' }],
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    procedureHistory: [],
    bookingSettings: null,
  };

  const auxiliary = {
    finance: {
      version: 5,
      income: [{
        id: 'staging-payment-1',
        status: 'completed',
        movementType: 'income',
        incomeType: 'payment',
        source: { type: 'record', id: 'staging-record-paid' },
        workplace: 'Тестовая студия',
        client: { key: 'staging-client-anna', name: 'Анна Тест' },
        allocations: [{
          id: 'staging-allocation-1',
          walletId: 'cashless',
          walletName: 'Безналичные',
          amount: 4500,
        }],
        walletId: 'cashless',
        walletName: 'Безналичные',
        total: 4500,
        serviceAmount: 4500,
        tips: 0,
        finance: paidFinance,
        createdAt: nowIso,
        paidAt: nowIso,
      }],
      expense: [],
    },
    wallets: [
      { id: 'cash', name: 'Наличные', photo: '', system: true },
      { id: 'cashless', name: 'Безналичные', photo: '', system: true },
    ],
    tags: [{ id: 'tag-vip', name: 'VIP', color: '#D6C6E1', createdAt: nowIso, updatedAt: nowIso }],
    products: [],
    productHistory: [],
  };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: owner.id },
      data: { workspaceUnlocked: true, onboardingStep: 99 },
    });

    const profile = await tx.profile.upsert({
      where: { tenantId_userId: { tenantId, userId: owner.id } },
      create: {
        tenantId,
        userId: owner.id,
        key: profileKey,
        name: 'Тестовый',
        surname: 'Мастер',
        phone: '+79990000001',
        phones: json(['+79990000001']),
        telegrams: json([]),
        emails: json([email]),
        about: 'Изолированный staging-профиль Book',
        photo: '',
        profession: 'Парикмахер',
        experience: '10+ лет',
        professionAbout: '',
        customProfessions: json([]),
        migrationVerifiedAt: now,
      },
      update: { migrationVerifiedAt: now },
    });

    await tx.workplace.upsert({
      where: { tenantId_key: { tenantId, key: workplaceKey } },
      create: {
        tenantId,
        profileId: profile.id,
        key: workplaceKey,
        position: 0,
        photo: '',
        name: 'Тестовая студия',
        color: '#E6E4E1',
        city: 'Москва',
        address: 'Тестовый адрес',
        phone: '+79990000002',
        currency: 'RUB',
        from: '09:00',
        to: '20:00',
        links: json([]),
        about: 'Только для staging',
        sourceCreatedAt: nowIso,
        sourceUpdatedAt: nowIso,
      },
      update: { profileId: profile.id, position: 0 },
    });

    await tx.businessStateMeta.upsert({
      where: { tenantId },
      create: { tenantId, migrationVerifiedAt: now },
      update: { migrationVerifiedAt: now },
    });
    await tx.businessIdentityState.upsert({
      where: { tenantId },
      create: { tenantId, data: json({ entities: {}, relations: {}, revoked: [] }) },
      update: { data: json({ entities: {}, relations: {}, revoked: [] }) },
    });

    for (const [position, person] of people.entries()) {
      await tx.businessPerson.upsert({
        where: { tenantId_key: { tenantId, key: person.key } },
        create: { tenantId, key: person.key, position, data: json(person) },
        update: { position, data: json(person) },
      });
    }

    for (const [position, record] of records.entries()) {
      await tx.businessRecord.upsert({
        where: { tenantId_recordId: { tenantId, recordId: record.id } },
        create: { tenantId, recordId: record.id, position, data: json(record) },
        update: { position, data: json(record) },
      });
    }

    for (const [position, event] of recordEvents.entries()) {
      await tx.businessRecordEvent.upsert({
        where: { tenantId_eventId: { tenantId, eventId: event.id } },
        create: { tenantId, eventId: event.id, recordId: event.recordId, position, data: json(event) },
        update: { recordId: event.recordId, position, data: json(event) },
      });
    }

    await tx.businessOperationalState.upsert({
      where: { tenantId },
      create: { tenantId, data: json(operational), migrationVerifiedAt: now },
      update: { data: json(operational), migrationVerifiedAt: now },
    });
    await tx.businessDocumentState.upsert({
      where: { tenantId },
      create: { tenantId, data: json({ documents: [], consents: [], history: [] }), migrationVerifiedAt: now },
      update: { migrationVerifiedAt: now },
    });
    await tx.businessAuxiliaryState.upsert({
      where: { tenantId },
      create: { tenantId, data: json(auxiliary), migrationVerifiedAt: now },
      update: { data: json(auxiliary), migrationVerifiedAt: now },
    });
  });

  console.log('Staging fixtures created: profile, workplace, clients, records, payment and wallets.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
