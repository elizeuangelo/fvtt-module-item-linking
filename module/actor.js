import { createChanges } from './item.js';
import { MODULE, getSetting } from './settings.js';
async function create(data, context) {
    const createData = [];
    const baseData = data instanceof Array ? data : [data];
    for (const actor of baseData) {
        const data = actor.toObject?.() ?? actor;
        createData.push(data);
        data._id = randomID();
        context.keepId = true;
        const linked = data.items.filter((i) => MODULE in i.flags && i.flags[MODULE].isLinked);
        for (const itemData of linked) {
            const baseItem = (await fromUuid(itemData.flags[MODULE].baseItem));
            if (!baseItem)
                continue;
            const changes = createChanges(itemData, baseItem._source, false);
            mergeObject(itemData, changes);
            if (getSetting('enforceActorsFXs')) {
                for (const collection of Object.values(CONFIG.Item.documentClass.metadata.embedded)) {
                    if (!(collection in data))
                        continue;
                    for (const fx of itemData[collection]) {
                        const actorFxsIds = data[collection].map((fx) => fx._id);
                        const target = actorFxsIds.includes(fx._id)
                            ? data[collection].find((x) => x._id === fx._id)
                            : deepClone(fx);
                        if ('origin' in target)
                            target.origin = `Actor.${data._id}.Item.${itemData._id}`;
                        if (!actorFxsIds.includes(fx._id)) {
                            data[collection].push(target);
                        }
                    }
                }
            }
        }
    }
    const created = (await this.createDocuments(createData, context));
    return data instanceof Array ? created : created.shift();
}
Hooks.on('ready', () => {
    CONFIG.Actor.documentClass.prototype._oldCreate = CONFIG.Actor.documentClass.prototype.create;
    CONFIG.Actor.documentClass.create = create;
});
