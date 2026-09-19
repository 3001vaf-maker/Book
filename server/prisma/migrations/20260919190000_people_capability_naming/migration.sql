UPDATE "Capability"
SET "key" = 'people.access',
    "groupKey" = 'people',
    "name" = 'Люди',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'clients.access';

UPDATE "Plan"
SET "key" = 'starter-people',
    "name" = 'Старт',
    "description" = 'Профиль, услуги, люди и одно рабочее пространство',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'starter-clients';
