import { accordion, initAccordions } from './accordion/accordion.js';
import { bottomNavigation } from './navigation/navigation.js';
import { viewNavigation, initViewNavigation } from './view-navigation/view-navigation.js';
import { calendar, initCalendar, dateNavigator, initDateNavigator } from './calendar/index.js?v=journal-day-20260903';
import { initMultiSelect } from './selection/index.js?v=graph-lifecycle-20260903';
import { entityCard } from './cards/index.js';
import { select, searchableSelect } from './selectors/index.js';
import { workLinks, initWorkLinks, collectWorkLinks } from './links/index.js';
import { costField, initCostFields, collectCost } from './cost/index.js';
import { durationPicker, initDurationPickers } from './duration/index.js';
import { timePicker, initTimePickers } from './time/index.js';
import { journalDayTimeline, initJournalDayTimeline } from './time/journal-day.js';
import { workplaceSelector, initWorkplaceSelectors, collectWorkplaceSelections, workplaceHeaderButton } from './workplaces/index.js?v=workplace-header-20260903';
import { modal, mountModal } from './modals/index.js';
import { button, iconButton } from './buttons/index.js';
import { field, phoneField, textareaField } from './inputs/index.js';
import { emptyState } from './states/index.js';
import { colorPicker, initColorPickers } from './colors/index.js';
import { escapeHtml } from './utils/escape-html.js';

export { accordion, initAccordions, bottomNavigation, viewNavigation, initViewNavigation, calendar, initCalendar, dateNavigator, initDateNavigator, initMultiSelect, entityCard, select, searchableSelect, workLinks, initWorkLinks, collectWorkLinks, costField, initCostFields, collectCost, durationPicker, initDurationPickers, timePicker, initTimePickers, journalDayTimeline, initJournalDayTimeline, workplaceSelector, initWorkplaceSelectors, collectWorkplaceSelections, workplaceHeaderButton, modal, mountModal, button, iconButton, field, phoneField, textareaField, emptyState, colorPicker, initColorPickers, escapeHtml };

export function pageHeader(title, subtitle = '', meta = '') { return `<header class="page-header"><div class="page-header__main"><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>${meta ? `<div class="page-header__meta">${meta}</div>` : ''}</header>`; }
export function timeInput({ label, name, value = '', minuteStep = 15 } = {}) { return timePicker({ label, name, value, minuteStep }); }
export function photoField({ name = 'photo', value = '' } = {}) { const preview = value ? `<div class="photo-field__preview" style="background-image:url('${escapeHtml(value)}')" aria-hidden="true"></div>` : '<div class="photo-field__preview photo-field__preview--empty" aria-hidden="true">Фото</div>'; return `<div class="photo-field" data-photo-field><span class="photo-field__label">Фото</span><label class="photo-field__control">${preview}<span class="photo-field__action">${value ? 'Изменить фото' : 'Добавить фото'}</span><input type="file" accept="image/*" data-photo-input></label>${value ? '<button type="button" class="ui-button ui-button--small photo-field__remove" data-photo-remove>Удалить фото</button>' : ''}<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" data-photo-value></div>`; }
export function initPhotoField(root) { root.querySelectorAll('[data-photo-field]').forEach((fieldRoot) => { const input = fieldRoot.querySelector('[data-photo-input]'), value = fieldRoot.querySelector('[data-photo-value]'), preview = fieldRoot.querySelector('.photo-field__preview'), action = fieldRoot.querySelector('.photo-field__action'); if (!input || !value || !preview || !action) return; input.onchange = () => { const file = input.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const src = String(reader.result || ''); value.value = src; preview.classList.remove('photo-field__preview--empty'); preview.style.backgroundImage = `url('${src.replaceAll("'", '%27')}')`; preview.textContent = ''; action.textContent = 'Изменить фото'; if (!fieldRoot.querySelector('[data-photo-remove]')) fieldRoot.insertAdjacentHTML('beforeend', '<button type="button" class="ui-button ui-button--small photo-field__remove" data-photo-remove>Удалить фото</button>'); }; reader.readAsDataURL(file); }; fieldRoot.onclick = (event) => { if (!event.target.closest('[data-photo-remove]')) return; value.value = ''; input.value = ''; preview.style.backgroundImage = ''; preview.classList.add('photo-field__preview--empty'); preview.textContent = 'Фото'; action.textContent = 'Добавить фото'; event.target.closest('[data-photo-remove]')?.remove(); }; }); }
