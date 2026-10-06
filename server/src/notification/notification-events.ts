export type NotificationEventDefinition = {
  type: string;
  group: string;
  title: string;
  description: string;
  defaultTitle: string;
  defaultBody: string;
  variables: string[];
};

export const NOTIFICATION_EVENT_CATALOG: readonly NotificationEventDefinition[] = Object.freeze([
  {
    type: 'booking.created',
    group: 'Запись',
    title: 'Запись создана',
    description: 'После создания записи',
    defaultTitle: 'Запись создана',
    defaultBody: 'Запись создана на {{date}} в {{time}}.',
    variables: ['date', 'time', 'workplace', 'person.name', 'person.surname'],
  },
  {
    type: 'booking.rescheduled',
    group: 'Запись',
    title: 'Запись перенесена',
    description: 'После изменения даты или времени',
    defaultTitle: 'Запись перенесена',
    defaultBody: 'Запись перенесена на {{date}} в {{time}}.',
    variables: ['date', 'time', 'workplace', 'person.name', 'person.surname'],
  },
  {
    type: 'booking.cancelled',
    group: 'Запись',
    title: 'Запись отменена',
    description: 'После отмены записи',
    defaultTitle: 'Запись отменена',
    defaultBody: 'Запись на {{date}} в {{time}} отменена.',
    variables: ['date', 'time', 'workplace', 'person.name', 'person.surname'],
  },
  {
    type: 'booking.confirmed',
    group: 'Запись',
    title: 'Запись подтверждена',
    description: 'После подтверждения записи',
    defaultTitle: 'Запись подтверждена',
    defaultBody: 'Запись на {{date}} в {{time}} подтверждена.',
    variables: ['date', 'time', 'workplace', 'person.name', 'person.surname'],
  },
  {
    type: 'booking.no-show',
    group: 'Запись',
    title: 'Неявка на запись',
    description: 'После отметки неявки',
    defaultTitle: 'Запись не состоялась',
    defaultBody: 'Запись {{date}} в {{time}} отмечена как не состоявшаяся.',
    variables: ['date', 'time', 'workplace', 'person.name', 'person.surname'],
  },
  {
    type: 'booking.reminder',
    group: 'Запись',
    title: 'Напоминание о записи',
    description: 'Перед предстоящей записью',
    defaultTitle: 'Напоминание о записи',
    defaultBody: 'Напоминаем о записи {{date}} в {{time}}.',
    variables: ['date', 'time', 'workplace', 'person.name', 'person.surname'],
  },
  {
    type: 'finance.payment',
    group: 'Финансы',
    title: 'Оплата проведена',
    description: 'После оплаты услуги или продажи',
    defaultTitle: 'Оплата проведена',
    defaultBody: 'Оплата на сумму {{amount}} проведена.',
    variables: ['amount', 'date', 'person.name', 'person.surname'],
  },
  {
    type: 'finance.refund',
    group: 'Финансы',
    title: 'Возврат проведён',
    description: 'После возврата оплаты',
    defaultTitle: 'Возврат проведён',
    defaultBody: 'Возврат на сумму {{amount}} проведён.',
    variables: ['amount', 'date', 'person.name', 'person.surname'],
  },
  {
    type: 'loan.received',
    group: 'Займы',
    title: 'Займ получен',
    description: 'После операции получения займа',
    defaultTitle: 'Займ получен',
    defaultBody: 'Получение займа на сумму {{amount}} проведено.',
    variables: ['amount', 'date', 'person.name', 'person.surname'],
  },
  {
    type: 'loan.repaid',
    group: 'Займы',
    title: 'Займ возвращён',
    description: 'После операции возврата займа',
    defaultTitle: 'Займ возвращён',
    defaultBody: 'Возврат займа на сумму {{amount}} проведён.',
    variables: ['amount', 'date', 'person.name', 'person.surname'],
  },
  {
    type: 'investment.received',
    group: 'Инвестиции',
    title: 'Инвестиция получена',
    description: 'После получения инвестиции',
    defaultTitle: 'Инвестиция получена',
    defaultBody: 'Инвестиция на сумму {{amount}} получена.',
    variables: ['amount', 'date', 'person.name', 'person.surname'],
  },
  {
    type: 'investment.returned',
    group: 'Инвестиции',
    title: 'Инвестиция возвращена',
    description: 'После возврата инвестиции',
    defaultTitle: 'Инвестиция возвращена',
    defaultBody: 'Возврат инвестиции на сумму {{amount}} проведён.',
    variables: ['amount', 'date', 'person.name', 'person.surname'],
  },
  {
    type: 'investment.income',
    group: 'Инвестиции',
    title: 'Доход по инвестиции',
    description: 'После выплаты или получения инвестиционного дохода',
    defaultTitle: 'Доход по инвестиции',
    defaultBody: 'Операция по доходу инвестиции на сумму {{amount}} проведена.',
    variables: ['amount', 'date', 'person.name', 'person.surname'],
  },
  {
    type: 'consent.accepted',
    group: 'Документы и согласия',
    title: 'Согласие принято',
    description: 'После принятия согласия',
    defaultTitle: 'Согласие принято',
    defaultBody: 'Согласие «{{document}}» принято.',
    variables: ['document', 'date', 'person.name', 'person.surname'],
  },
  {
    type: 'consent.revoked',
    group: 'Документы и согласия',
    title: 'Согласие отозвано',
    description: 'После отзыва согласия',
    defaultTitle: 'Согласие отозвано',
    defaultBody: 'Согласие «{{document}}» отозвано. Дальнейший контакт может быть ограничен.',
    variables: ['document', 'date', 'person.name', 'person.surname'],
  },
  {
    type: 'document.assigned',
    group: 'Документы и согласия',
    title: 'Документ назначен',
    description: 'Когда человеку назначен документ',
    defaultTitle: 'Новый документ',
    defaultBody: 'Вам назначен документ «{{document}}».',
    variables: ['document', 'date', 'person.name', 'person.surname'],
  },
  {
    type: 'person.birthday',
    group: 'Люди',
    title: 'День рождения',
    description: 'Поздравление с днём рождения',
    defaultTitle: 'С днём рождения!',
    defaultBody: '{{person.name}}, поздравляем вас с днём рождения!',
    variables: ['person.name', 'person.surname'],
  },
]);

export const NOTIFICATION_EVENT_TYPES = Object.freeze(NOTIFICATION_EVENT_CATALOG.map((event) => event.type));

export function notificationEventDefinition(eventType: string) {
  return NOTIFICATION_EVENT_CATALOG.find((event) => event.type === eventType) || null;
}
