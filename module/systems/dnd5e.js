import { getFlag } from '../flags.js';
import { PACKS, createUuidFromIndex, getItemsFromCompendiumsByType } from '../packs.js';
import { MODULE_ID, getSetting } from '../settings.js';
import { sleep } from '../utils.js';
import { keepPropertiesOverride } from '../system.js';

export const KEEP = [
	'flags.item-linking.isLinked',
	'flags.item-linking.baseItem',
	'system.consume.amount',
	'system.consume.target',
	'system.consume.type',
	'system.uses.value',
	'system.recharge.charged',
	'system.quantity',
	'system.proficient',
	'system.identified',
	'system.equipped',
	'system.attunement',
	'system.hp.value',
	'system.hp.conditions',
	'system.isOriginalClass',
	'system.skills.value',
	'system.preparation.mode',
	'system.preparation.prepared',
];

function createOptionsFromPack(pack, type, selected) {
	function createOption(value, title, selected) {
		return `<option value="${value}" ${selected ? 'selected' : ''}>${title}</option>`;
	}
	const options = getItemsFromCompendiumsByType(pack, type);
	if (options.length === 0) return '';
	return `
        <optgroup label="${pack.metadata.label}">
            ${options
					.map((op) => {
						const uuid = createUuidFromIndex(pack, op._id);
						return createOption(uuid, op.name, selected === uuid);
					})
					.join('')}
        </optgroup>
    `;
}

function onSearchFilter(event, query, rgx, html) {
	const visibleGroups = new Set();
	for (const entry of html.querySelectorAll('option')) {
		if (!query) {
			entry.classList.remove('hidden');
			continue;
		}
		const label = entry.textContent;
		const match = rgx.test(SearchFilter.cleanQuery(label));
		entry.classList.toggle('hidden', !match);
		if (match) visibleGroups.add(entry.parentElement);
	}
	for (const group of html.querySelectorAll('optgroup')) {
		group.classList.toggle('hidden', query && !visibleGroups.has(group));
	}
}

function renderItemSheet(sheet, html) {
	if (!html.jquery) html = $(html);
	const item = sheet.document;
	if (item.compendium && !item.isEmbedded) return;
	html.find('.summary.link').remove();
	const linked = getFlag(item, 'isLinked') ?? false;
	const baseItemId = getFlag(item, 'baseItem') ?? null;
	const brokenLink = baseItemId ? !Boolean(fromUuidSync(baseItemId)) : true;
	if (game.user.isGM === false && !linked) return;
	const linkText = ['Not Linked', 'Linked', 'Broken Link'];
	const row = $(`
            <ul class="summary link flexrow">
                <li class="item-link">${linkText[+linked + +(brokenLink && linked)]}</li>
                ${linked && game.user.isGM ? '<input type="search" name="search" placeholder="Filter" />' : ''}
                <input type="checkbox" name="flags.${MODULE_ID}.isLinked" style="display:none" ${
		linked ? 'checked' : ''
	} />
                <li>
                    <select name="flags.${MODULE_ID}.baseItem" ${game.user.isGM && linked ? '' : 'disabled'}>
                        ${
									brokenLink
										? `<optgroup label="Broken Link"><option value="" selected}>Unknown item</option></optgroup>`
										: ''
								}
                        ${PACKS.map((pack) => createOptionsFromPack(pack, item.type, getFlag(item, 'baseItem'))).join(
									''
								)}
                    </select>
                </li>
            </ul>
    `);
	html.find('div.header-details').append(row);
	if (game.user.isGM) {
		const link = row.find('.item-link');
		const checkbox = row.find(`input[name="flags.${MODULE_ID}.isLinked"]`);
		link.on('click', () => checkbox.trigger('click'));
		if (baseItemId && brokenLink === false) {
			html.find(`select[name="flags.${MODULE_ID}.baseItem"]`).on('contextmenu', async () => {
				const baseItem = await fromUuid(baseItemId);
				baseItem?.sheet.render(true);
			});
		}
		new SearchFilter({
			inputSelector: 'input[name="search"]',
			contentSelector: `select[name="flags.${MODULE_ID}.baseItem"]`,
			callback: onSearchFilter,
		}).bind(html[0]);
	}
	if (!linked) return;
	const rgx = /^system\.|^flags\./;
	const KEEP = keepPropertiesOverride(sheet.item);
	const filter = (_idx, element) =>
		!(
			(element.name && !rgx.exec(element.name)) ||
			KEEP.includes(element.name) ||
			(element.dataset.target && KEEP.includes(element.dataset.target)) ||
			element.hasAttribute('data-link-keep') ||
			(element.type === 'color' && element.previousElementSibling?.disabled)
		);

	html.find('input,select,textarea,[data-target]').filter(filter).attr('disabled', '');
	if (getSetting('linkHeader')) {
		if (!KEEP.includes('name')) html.find('input[name="name"]').attr('disabled', '');
		if (!KEEP.includes('img')) {
			html.find('img.profile').off('click');
		}
	}

	html.find('a.editor-edit,div.item-controls,.damage-control,a[disabled]').remove();
	if (!KEEP.includes('system.description.value')) html.find('button.edit-item-description').remove();

	const fixes = [{ sel: 'input[name="system.uses.max"]', val: sheet.item.system.uses?.max ?? '' }];
	fixes.forEach((f) => html.find(f.sel).val(f.val));
	if (getSetting('hideUselessInformation')) {
		html.find('input[type=checkbox][disabled]:only-of-type:not(:checked)').parent().remove();
		if (item.type === 'weapon') {
			const weaponProperties = html.find('div.weapon-properties');
			if (weaponProperties[0]?.childElementCount < 2) weaponProperties.remove();
		}
		html[0].querySelectorAll('.form-group:not(:has(button:only-child))').forEach((v, idx) => {
			const input = v.querySelector('input:not([value=""])');
			const inputNotDisabled = v.querySelector('input:not([disabled])');
			const selection = v.querySelector('select option[selected][value]:not([value=""])');
			const selectionNotDisabled = v.querySelector('selection:not([disabled])');
			const tag = v.querySelector('li.tag');
			const color = v.querySelector('input[type=color]');
			if (color && color.previousElementSibling?.disabled) return v.remove();
			const textarea = v.querySelector('textarea');
			if (textarea) {
				if (textarea.disabled && !textarea.textContent) v.remove();
				return;
			}
			if (
				input ||
				(selection && !['spell', 'self'].includes(selection.value)) ||
				tag ||
				(inputNotDisabled && inputNotDisabled.name !== 'system.uses.value') ||
				selectionNotDisabled
			)
				return;
			v.remove();
		});
		const dmgHeader = html.find('.damage-header')[0];
		if (dmgHeader && !dmgHeader.nextElementSibling?.classList.contains('damage-parts')) {
			dmgHeader.remove();
		}
		[...html.find('h3.form-header')].forEach((el) => {
			const next = el.nextElementSibling;
			if (next === null || next.tagName === 'H3') el.remove();
		});
		sheet.setPosition({ height: 'auto' });
	}
}

function renderActorSheet(sheet, html) {
	if (!getSetting('enforceActorsFXs')) return;
	const fxs = html.find('li.item.effect');
	[...fxs].forEach((li) => {
		const fx = sheet.actor.effects.get(li.dataset.effectId ?? '');
		if (!fx) return;
		fromUuid(fx.origin).then((item) => {
			if (item === null) return;
			if (!getFlag(item, 'isLinked')) return;
			li.querySelector('a[data-action="edit"]')?.remove();
			li.querySelector('a[data-action="delete"]')?.remove();
			const source = li.querySelector('div.effect-source');
			if (source) {
				source.textContent = source.textContent + ' (linked)';
			}
		});
	});
}

function AFXcontextOptions(fx, buttons) {
	if (!getSetting('enforceActorsFXs') || !fx.transfer) return;
	const rgx = /Item.([A-Za-z0-9]+)/;
	const match = rgx.exec(fx.origin);
	if (match === null) return;
	const item = fx.parent.items.get(match[1]);
	if (!item) return;
	const keep = ['DND5E.ContextMenuActionDisable', 'DND5E.ContextMenuActionEnable'];
	for (let i = buttons.length - 1; i >= 0; i--) {
		const btn = buttons[i];
		if (keep.includes(btn.name)) continue;
		buttons.splice(i, 1);
	}
}

async function magicItems2Hook(sheet, html) {
	if (!html.jquery) html = $(html);
	const tab = html.find('.tab.magic-items');
	if (tab.length) {
		const item = sheet.item;
		const linked = getFlag(item, 'isLinked');
		if (linked && (!item.compendium || item.isEmbedded)) {
			for (let i = 0; i < 20; i++) {
				if (html.find('.magic-items-content').length) break;
				await sleep(100);
			}
			tab.find('.spell-drag-content').remove();
			const drop = sheet._dragDrop.filter((list) => list.dropSelector === '.tab.magic-items');
			drop.forEach((drop) => {
				Object.entries(drop.callbacks).forEach(([ev, fn]) => {
					drop.callbacks[ev] = function () {};
				});
			});
		}
	}
	renderItemSheet(sheet, html);
}

/** -------------------------------------------- */
Hooks.on('renderActorSheet5e', renderActorSheet);
Hooks.on('dnd5e.getActiveEffectContextOptions', AFXcontextOptions);
if (game.modules.get('magic-items-2')?.active) {
	Hooks.on('renderItemSheet', magicItems2Hook);
	Hooks.on('tidy5e-sheet.renderItemSheet', magicItems2Hook);
} else {
	Hooks.on('renderItemSheet', renderItemSheet);
	Hooks.on('tidy5e-sheet.renderItemSheet', renderItemSheet);
}

