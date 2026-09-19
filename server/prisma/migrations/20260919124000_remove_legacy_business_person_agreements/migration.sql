UPDATE "BusinessPerson"
SET "data" = "data" - 'agreements'
WHERE "data" ? 'agreements';
