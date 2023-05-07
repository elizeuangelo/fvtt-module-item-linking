import { getFlag } from './flags.js';
import { findItemFromUUID } from './packs.js';
import { systems } from './system.js';

export let derivations = 0;
function prepareDerivedData() {
	original.call(this);
	if (getFlag(this, 'isLinked') !== true) return;

	findItemFromUUID(getFlag(this, 'baseItem')!).then((baseItem) => {
		if (baseItem === null) return;
		const system = mergeObject({}, baseItem._source.system);
		const keep = systems[game.system.id];
		if (keep !== undefined) {
			const map = Object.fromEntries(keep.map((k) => [k, foundry.utils.getProperty(this._source, k)]));
			mergeObject(system, map);
		}
		this.system = system;
		derivations++;
	});
}

let original;
Hooks.once('setup', () => {
	original = CONFIG.Item.documentClass.prototype.prepareDerivedData;
	CONFIG.Item.documentClass.prototype.prepareDerivedData = prepareDerivedData;
});
