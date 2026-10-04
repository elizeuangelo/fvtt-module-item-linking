import { getFlag, setFlag } from './flags.js';
import { findDerived } from './item.js';

/** Find world derivations and linked inventory items in unlocked world Actor packs. */
export async function findMoveDerivations(baseUuids) {
	const worldDerivations = findDerived();
	const derivations = new Map([...baseUuids].map((uuid) => [
		uuid, (worldDerivations[uuid] ?? []).map((item) => ({ item, pack: null })),
	]));
	for (const pack of game.packs.values()) {
		if (pack.documentName !== 'Actor' || pack.metadata.packageType !== 'world' || pack.locked) continue;
		for (const actor of await pack.getDocuments()) {
			for (const item of actor.items.contents) {
				if (!getFlag(item, 'isLinked')) continue;
				const matches = derivations.get(getFlag(item, 'baseItem'));
				if (matches) matches.push({ item, pack });
			}
		}
	}
	return derivations;
}

/** Persist replacement UUIDs without changing any compendium's lock state. */
export async function relinkMoveDerivations(derivations, replacements, onUpdate = () => {}) {
	const batches = new Map();
	for (const [oldUuid, newUuid] of replacements) {
		for (const { item, pack } of derivations.get(oldUuid) ?? []) {
			if (!batches.has(pack)) batches.set(pack, []);
			batches.get(pack).push({ item, newUuid });
		}
	}
	for (const [pack, updates] of batches) {
		if (pack?.locked) {
			throw new Error(`Item Linking: ${pack.collection} was locked during the move. Source was not deleted.`);
		}
		for (const { item, newUuid } of updates) {
			await setFlag(item, 'baseItem', newUuid);
			onUpdate();
		}
	}
}
