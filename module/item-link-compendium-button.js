import { getFlag } from './flags.js';

function getCompendiumFromLinkedItem(item) {
	const baseItem = getFlag(item, 'baseItem');
	if (!baseItem) return null;
	const baseData = fromUuidSync(baseItem);
	if (!baseData) return null;
	return game.packs.get(baseData.pack);
}

function canCreateCompendiumButton(sheet) {
	if (!game.user.isGM) return false;
	if (sheet.item.compendium) return false;
	return true;
}

function createOpenCompendiumButton(sheet, buttons) {
	if (!canCreateCompendiumButton(sheet)) return;
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
Hooks.on('tidy5e-sheet.ready', (api) => {
	api.registerItemHeaderControls({
		controls: [
			{
				icon: 'fas fa-book-section',
				label: 'Open Linked Item Compendium',
				visible() {
					return canCreateCompendiumButton(this) && !!getCompendiumFromLinkedItem(this.item);
				},
				onClickAction() {
					const compendium = getCompendiumFromLinkedItem(this.item);
					compendium.render(true)
				}
			}
		]
	})
});
