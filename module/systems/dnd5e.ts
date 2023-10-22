import { getFlag } from '../flags.js';
import { PACKS, createUuidFromIndex, getItemsFromCompendiumsByType } from '../packs.js';
import { MODULE, getSetting } from '../settings.js';
import { sleep } from '../utils.js';

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

function createOptionsFromPack(pack, type: string, selected: string | null) {
	function createOption(value: string, title: string, selected: boolean) {
		return /*html*/ `<option value="${value}" ${selected ? 'selected' : ''}>${title}</option>`;
	}
	const options = getItemsFromCompendiumsByType(pack, type);
	if (options.length === 0) return '';
	return /*html*/ `
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

	// Hide entries
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

	// Hide groups which have no visible children
	for (const group of html.querySelectorAll('optgroup')) {
		group.classList.toggle('hidden', query && !visibleGroups.has(group));
	}
}

function renderItemSheet(sheet: ItemSheet, html: JQuery) {
	const item = sheet.document;
	if (item.compendium && !item.isEmbedded) return;

	const linked = getFlag(item, 'isLinked') ?? false;
	const baseItemId = getFlag(item, 'baseItem') ?? null;
	const brokenLink = baseItemId ? !Boolean(fromUuidSync(baseItemId)) : true;

	// Append to Header
	// Hide linking if user is not GM and item is unlinked
	if (game.user!.isGM === false && !linked) return;
	const linkText = ['Not Linked', 'Linked', 'Broken Link'];
	const row = $(/*html*/ `
            <ul class="summary link flexrow">
                <li class="item-link">${linkText[+linked + +(brokenLink && linked)]}</li>
                ${linked && game.user!.isGM ? '<input type="search" name="search" placeholder="Filter" />' : ''}
                <input type="checkbox" name="flags.${MODULE}.isLinked" style="display:none" ${linked ? 'checked' : ''} />
                <li>
                    <select name="flags.${MODULE}.baseItem" ${game.user!.isGM && linked ? '' : 'disabled'}>
                        ${
							brokenLink
								? `<optgroup label="Broken Link"><option value="" selected}>Unknown item</option></optgroup>`
								: ''
						}
                        ${PACKS.map((pack) => createOptionsFromPack(pack, item.type, getFlag(item, 'baseItem'))).join('')}
                    </select>
                </li>
            </ul>
    `);
	html.find('div.header-details').append(row);

	if (game.user!.isGM) {
		const link = row.find('.item-link');
		const checkbox = row.find(`input[name="flags.${MODULE}.isLinked"]`);
		link.on('click', () => checkbox.trigger('click'));

		if (baseItemId && brokenLink === false) {
			html.find(`select[name="flags.${MODULE}.baseItem"]`).on('contextmenu', async () => {
				const baseItem = (await fromUuid(baseItemId)) as Item;
				baseItem?.sheet!.render(true);
			});
		}

		// Creates Search Filter
		new SearchFilter({
			inputSelector: 'input[name="search"]',
			contentSelector: `select[name="flags.${MODULE}.baseItem"]`,
			callback: onSearchFilter,
		}).bind(html[0]);
	}

	// If Item is not linked, workflow ends
	if (!linked) return;

	// Disable all non editable fields
	const rgx = /^system\.|^flags\./;
	const filter = (input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) =>
		!(
			!rgx.exec(input.name) ||
			KEEP.includes(input.name) ||
			input.hasAttribute('data-link-keep') ||
			(input.type === 'color' && (input.previousElementSibling as HTMLInputElement)?.disabled)
		);

	$([...html.find('input'), ...html.find('select'), ...html.find('textarea')].filter(filter)).attr('disabled', '');

	// Disable headers if configured so
	if (getSetting('linkHeader')) {
		html.find('input[name="name"]').attr('disabled', '');
		html.find('img.profile').off('click');
	}

	// Delete problematic fields
	const deletions = ['a.editor-edit', 'div.item-controls', '.damage-control'];
	deletions.forEach((deletion) => html.find(deletion).remove());

	// Fix Broken Fields
	const fixes = [{ sel: 'input[name="system.uses.max"]', val: (sheet.item as ItemExtended).system.uses?.max ?? '' }];
	fixes.forEach((f) => html.find(f.sel).val(f.val));

	// Delete Useless Fields, if configured so
	if (getSetting('hideUselessInformation')) {
		//const deletions = ['input[type=checkbox][disabled]:not(:checked)'];
		//deletions.forEach((deletion) => html.find(deletion).parent().remove());

		// Remove Properties Checkboxes
		html.find('input[type=checkbox][disabled]:only-of-type:not(:checked)').parent().remove();

		// If there are no properties, remove the section
		if (item.type === 'weapon') {
			const weaponProperties = html.find('div.weapon-properties');
			if (weaponProperties[0].childElementCount < 2) weaponProperties.remove();
		}

		// For every Form Group, remove if empty content
		html[0].querySelectorAll('.form-group:not(:has(button:only-child))').forEach((v, idx) => {
			const input = v.querySelector('input:not([value=""])');
			const inputNotDisabled = v.querySelector('input:not([disabled])');
			const selection = v.querySelector('select option[selected][value]:not([value=""])');
			const selectionNotDisabled = v.querySelector('selection:not([disabled])');
			const tag = v.querySelector('li.tag');
			const color = v.querySelector('input[type=color]');
			if (color && (color.previousElementSibling as HTMLInputElement | null)?.disabled) return v.remove();
			const textarea = v.querySelector('textarea');
			if (textarea) {
				if (textarea.disabled && !textarea.textContent) v.remove();
				return;
			}
			if (
				input ||
				(selection && !['spell', 'self'].includes((selection as HTMLOptionElement).value)) ||
				tag ||
				(inputNotDisabled && (inputNotDisabled as HTMLInputElement).name !== 'system.uses.value') ||
				selectionNotDisabled
			)
				return;
			v.remove();
		});

		// Delete Empty Damage Header
		const dmgHeader = html.find('.damage-header')[0];
		if (dmgHeader && !dmgHeader.nextElementSibling?.classList.contains('damage-parts')) {
			dmgHeader.remove();
		}

		// Delete Empty Headers
		[...html.find('h3.form-header')].forEach((el) => {
			const next = el.nextElementSibling;
			if (next === null || next.tagName === 'H3') el.remove();
		});

		sheet.setPosition({ height: 'auto' });
	}
}

function renderActorSheet(sheet: ActorSheet, html: JQuery) {
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

function AFXcontextOptions(fx: ActiveEffect, buttons: { name: string; icon: string; callback: Function }[]) {
	if (!getSetting('enforceActorsFXs') || !fx.transfer) return;
	const rgx = /Item.([A-Za-z0-9]+)/;
	const match = rgx.exec(fx.origin);
	if (match === null) return;
	const item = (fx.parent! as Actor).items.get(match[1]);
	if (!item) return;

	const keep = ['DND5E.ContextMenuActionDisable', 'DND5E.ContextMenuActionEnable'];
	for (let i = buttons.length - 1; i >= 0; i--) {
		const btn = buttons[i];
		if (keep.includes(btn.name)) continue;
		buttons.splice(i, 1);
	}
}

/** -------------------------------------------- */
Hooks.on('renderActorSheet5e', renderActorSheet);
Hooks.on('dnd5e.getActiveEffectContextOptions', AFXcontextOptions);

if (game.modules.get('magic-items-2')?.active) {
	Hooks.on('renderItemSheet', async (sheet: ItemSheet, html: JQuery<HTMLElement>) => {
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
				//@ts-ignore
				const drop = sheet._dragDrop.filter((list) => list.dropSelector === '.tab.magic-items');
				drop.forEach((drop) => {
					Object.entries(drop.callbacks).forEach(([ev, fn]) => {
						drop.callbacks[ev] = function () {};
					});
				});
			}
		}

		renderItemSheet(sheet, html);
	});
} else {
	Hooks.on('renderItemSheet', renderItemSheet);
}
