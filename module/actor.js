import { createChanges } from './item.js';
import { MODULE_ID, getSetting } from './settings.js';

/**
 * Substitutes the create Actor method for a version wich:
 * 1 - ensures all linked items are properly updated
 * 2 - ensures active effect data is kept in sync with the base item
 * @param {Object|Object[]} data - The data used to create the actors.
 * @param {Object} context - The context object.
 * @returns {Promise<Object|Object[]>} - A promise that resolves to the created actors.
 */
async function create(data, context) {
	const createData = [];
	const baseData = data instanceof Array ? data : [data];
	for (const actor of baseData) {
		const data = actor.toObject?.() ?? actor;
		createData.push(data);
		if (!data.items?.length) continue;
		data._id = randomID();
		context.keepId = true;
		const linked = data.items.filter((i) => MODULE_ID in i.flags && i.flags[MODULE_ID].isLinked);
		for (const itemData of linked) {
			const baseItem = await fromUuid(itemData.flags[MODULE_ID].baseItem);
			if (!baseItem) continue;
			const changes = createChanges(itemData, baseItem._source, false);
			mergeObject(itemData, changes);
			if (getSetting('enforceActorsFXs')) {
				for (const collection of Object.values(CONFIG.Item.documentClass.metadata.embedded)) {
					if (!(collection in data)) continue;
					for (const fx of itemData[collection]) {
						const actorFxsIds = data[collection].map((fx) => fx._id);
						const target = actorFxsIds.includes(fx._id)
							? data[collection].find((x) => x._id === fx._id)
							: deepClone(fx);
						if ('origin' in target) target.origin = `Actor.${data._id}.Item.${itemData._id}`;
						if (!actorFxsIds.includes(fx._id)) {
							data[collection].push(target);
						}
					}
				}
			}
		}
	}
	const created = await this.createDocuments(createData, context);
	return data instanceof Array ? created : created.shift();
}

/** -------------------------------------------- */
Hooks.on('ready', () => {
	CONFIG.Actor.documentClass.prototype._oldCreate = CONFIG.Actor.documentClass.prototype.create;
	CONFIG.Actor.documentClass.create = create;
});

