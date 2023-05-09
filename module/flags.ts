import { findCompendiumFromItemID } from './packs.js';
import { MODULE } from './settings.js';

export function getFlag<T extends keyof ModuleFlags>(item, name: T) {
	return item.getFlag(MODULE, name) as unknown as ModuleFlags[T];
}

export function setFlag<T extends keyof ModuleFlags>(item, name: T, value: ModuleFlags[T]) {
	return game.settings.set(MODULE, name, value);
}

function preCreateItem(item: ItemExtended) {
	const moduleFlags: ModuleFlags = item._source.flags['item-linking'] || {
		baseItem: null,
		isLinked: false,
	};
	const isLinked = moduleFlags.isLinked;
	const isCompendium = Boolean(item.compendium);

	if (isCompendium === false && item.id) {
		if (isLinked === undefined) {
			const compendium = findCompendiumFromItemID(item.id);
			if (compendium) {
				moduleFlags.baseItem = 'Compendium.' + compendium.metadata.id + '.' + item.id;
				moduleFlags.isLinked = true;
			}
		}
	}

	item.updateSource({ 'flags.item-linking': moduleFlags });
}

/** -------------------------------------------- */
Hooks.on('preCreateItem', preCreateItem);
