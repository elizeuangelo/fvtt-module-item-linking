import { createChanges } from './item.js';
import { MODULE, getSetting } from './settings.js';

interface Options {
	keepId?: boolean;
	temporary: boolean;
	renderSheet: boolean;
	render: boolean;
	fromCompendium: boolean;
	linkedUpdate?: boolean;
}

async function create(data: Actor['data'] & Record<string, unknown>, context: Options): Promise<Actor | Actor[] | undefined> {
	const createData: any[] = [];
	const baseData: any = data instanceof Array ? data : [data];

	for (const actor of baseData) {
		const data = actor.toObject?.() ?? actor;
		createData.push(data);
		data._id = randomID();
		context.keepId = true;
		const linked = data.items.filter((i) => MODULE in i.flags && i.flags[MODULE].isLinked);
		for (const itemData of linked) {
			const baseItem = (await fromUuid(itemData.flags[MODULE].baseItem)) as ItemExtended | null;
			if (!baseItem) continue;

			// Update Item
			const changes = createChanges(itemData, baseItem._source, false);
			mergeObject(itemData, changes);

			// Update Actor FXs
			if (getSetting('enforceActorsFXs')) {
				for (const collection of Object.values(CONFIG.Item.documentClass.metadata.embedded)) {
					if (!(collection in data)) continue;
					for (const fx of itemData[collection]) {
						const actorFxsIds = (data[collection] as any[]).map((fx) => fx._id);
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

	const created = (await this.createDocuments(createData, context)) as Actor[];
	return data instanceof Array ? created : created.shift();
}

/** -------------------------------------------- */
Hooks.on('ready', () => {
	//@ts-ignore
	CONFIG.Actor.documentClass.prototype._oldCreate = CONFIG.Actor.documentClass.prototype.create;
	//@ts-ignore
	CONFIG.Actor.documentClass.create = create;
});
