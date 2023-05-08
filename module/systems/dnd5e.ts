import { getFlag } from '../flags.js';
import { PACKS, createUuidFromIndex, findItemFromUUID, getItemsFromCompendiumsByType } from '../packs.js';
import { MODULE, getSetting } from '../settings.js';

export const KEEP = [
	'uses.value',
	'recharge.charged',
	'quantity',
	'proficient',
	'identified',
	'equipped',
	'attunement',
	'hp.value',
	'hp.conditions',
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
	if (item.compendium) return;

	const linked = getFlag(item, 'isLinked');
	const baseItemId = getFlag(item, 'baseItem');
	const brokenLink = baseItemId ? !Boolean(fromUuidSync(baseItemId)) : true;

	// Append to Header
	// Hide linking if user is not GM and item is unlinked
	if (game.user!.isGM === false && !linked) return;
	const linkText = ['Not Linked', 'Linked', 'Broken Link'];
	const row = $(/*html*/ `
            <ul class="summary link flexrow">
                <li class="item-link">${linkText[+linked + +(brokenLink && linked)]}</li>
                ${linked ? '<input type="search" name="search" placeholder="Filter" />' : ''}
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
			link.on('contextmenu', async () => {
				const baseItem = await findItemFromUUID(baseItemId);
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
	const rgx = /^system\./;
	const KEEP_PROP = KEEP.map((k) => 'system.' + k);
	const filter = (input: HTMLInputElement | HTMLSelectElement) => !(!rgx.exec(input.name) || KEEP_PROP.includes(input.name));

	$([...html.find('input'), ...html.find('select')].filter(filter)).attr('disabled', '');

	// Disable headers if configured so
	if (getSetting('linkHeader')) {
		html.find('input[name="name"]').attr('disabled', '');
		html.find('img.profile').off('click');
	}

	// Delete problematic fields
	const deletions = ['a.editor-edit', 'div.item-controls'];
	deletions.forEach((deletion) => html.find(deletion).remove());

	// Delete Useless Fields, if configured so
	if (getSetting('hideUselessInformation')) {
		//const deletions = ['input[type=checkbox][disabled]:not(:checked)'];
		//deletions.forEach((deletion) => html.find(deletion).parent().remove());

		// Remove Properties Checkboxes
		html.find('input[type=checkbox][disabled]:not(:checked)').parent().remove();

		// If there are no properties, remove the section
		if (item.type === 'weapon') {
			const weaponProperties = html.find('div.weapon-properties');
			if (weaponProperties[0].childElementCount < 2) weaponProperties.remove();
		}

		// For every Form Group, remove if empty content
		html[0].querySelectorAll('.form-group').forEach((v, idx) => {
			const input = v.querySelector('input:not([value=""])');
			const selection = v.querySelector('select option[selected][value]:not([value=""])');
			const tag = v.querySelector('li.tag');
			if (input || selection || tag) return;
			v.remove();
		});
	}
}

/** -------------------------------------------- */
Hooks.on('renderItemSheet', renderItemSheet);
