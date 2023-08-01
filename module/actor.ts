import { getFlag } from './flags.js';
import { createChanges } from './item.js';

interface Options {
	temporary: boolean;
	renderSheet: boolean;
	render: boolean;
	fromCompendium: boolean;
	linkedUpdate?: boolean;
}

function preCreateActor(actor: Actor, data, options: Options) {
	if (!options.fromCompendium || options.linkedUpdate) return;
	const linked = actor.items.contents.filter((i) => getFlag(i, 'isLinked') && getFlag(i, 'baseItem'));
	Promise.all(linked.map((i) => fromUuid(getFlag(i, 'baseItem')!))).then((items: (Item | null)[]) => {
		items.forEach((baseItem: ItemExtended | null, idx) => {
			if (baseItem === null) return;
			const item = linked[idx] as ItemExtended;
			const dataSource = data.items.find((i) => i._id === item.id);
			const changes = createChanges(item, baseItem);
			mergeObject(dataSource, changes);
		});
		delete data._id;
		Actor.create(data, { ...options, linkedUpdate: true });
	});
	return !linked.length;
}

/** -------------------------------------------- */
Hooks.on('preCreateActor', preCreateActor);
