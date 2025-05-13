import { getFlag } from './flags.js';

function getCompendiumFromLinkedItem(item) {
	const baseItem = getFlag(item, 'baseItem');
	if (!baseItem) return null;
	const baseData = fromUuidSync(baseItem);
	if (!baseData) return null;
	return game.packs.get(baseData.pack);
}

function createOpenCompendiumButton(sheet, buttons) {
	if (!game.user.isGM) return;
	if (sheet.item.compendium) return;
	const compendium = getCompendiumFromLinkedItem(sheet.item);
	if (!compendium) return;
	buttons.unshift({
		label: 'Open Linked Item Compendium',
		class: 'open-item-compendium',
		icon: 'fas fa-book-section',
		onclick: () => compendium.render(true),
	});
}

/** -------------------------------------------- */
Hooks.on('getItemSheetHeaderButtons', createOpenCompendiumButton);
