import { findCompendiumFromItemID } from './packs.js';
import { MODULE } from './settings.js';

export function getFlag<T extends keyof ModuleFlags>(item, name: T) {
	return item.getFlag(MODULE, name) as unknown as ModuleFlags[T];
}

export function setFlag<T extends keyof ModuleFlags>(item, name: T, value: ModuleFlags[T]) {
	return item.setFlag(MODULE, name, value);
}

function preCreateItem(item: ItemExtended) {
	const baseFlags: ModuleFlags = {
		baseItem: null,
		isLinked: false,
		embedded: {},
	};

	const isCompendium = Boolean(item.compendium);
	const itemFlags: ModuleFlags = isCompendium ? baseFlags : item._source.flags['item-linking'] || baseFlags;

	if (isCompendium === false && item.id) {
		if (!itemFlags.isLinked && !itemFlags.baseItem) {
			const compendium = findCompendiumFromItemID(item.id);
			if (compendium) {
				itemFlags.baseItem = 'Compendium.' + compendium.metadata.id + '.Item.' + item.id;
				itemFlags.isLinked = true;
			}
		}
	}

	item.updateSource({ 'flags.item-linking': itemFlags });
}

/** -------------------------------------------- */
Hooks.on('preCreateItem', preCreateItem);
