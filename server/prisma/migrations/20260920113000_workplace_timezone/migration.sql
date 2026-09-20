ALTER TABLE "Workplace"
ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Europe/Moscow';

UPDATE "Workplace"
SET "timeZone" = CASE "city"
  WHEN 'Москва' THEN 'Europe/Moscow'
  WHEN 'Санкт-Петербург' THEN 'Europe/Moscow'
  WHEN 'Казань' THEN 'Europe/Moscow'
  WHEN 'Нижний Новгород' THEN 'Europe/Moscow'
  WHEN 'Екатеринбург' THEN 'Asia/Yekaterinburg'
  WHEN 'Новосибирск' THEN 'Asia/Novosibirsk'
  WHEN 'Самара' THEN 'Europe/Samara'
  WHEN 'Ростов-на-Дону' THEN 'Europe/Moscow'
  WHEN 'Краснодар' THEN 'Europe/Moscow'
  WHEN 'Сочи' THEN 'Europe/Moscow'
  WHEN 'Уфа' THEN 'Asia/Yekaterinburg'
  WHEN 'Воронеж' THEN 'Europe/Moscow'
  WHEN 'Пермь' THEN 'Asia/Yekaterinburg'
  WHEN 'Волгоград' THEN 'Europe/Volgograd'
  WHEN 'Омск' THEN 'Asia/Omsk'
  WHEN 'Тула' THEN 'Europe/Moscow'
  WHEN 'Калининград' THEN 'Europe/Kaliningrad'
  ELSE "timeZone"
END;
