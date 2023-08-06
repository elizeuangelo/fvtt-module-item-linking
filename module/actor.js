import { getFlag } from './flags.js';
import { createChanges } from './item.js';
function preCreateActor(actor, data, options) {
    if (!options.fromCompendium || options.linkedUpdate)
        return;
    const linked = actor.items.contents.filter((i) => getFlag(i, 'isLinked') && getFlag(i, 'baseItem'));
    if (linked.length) {
        Promise.all(linked.map((i) => fromUuid(getFlag(i, 'baseItem')))).then((items) => {
            items.forEach((baseItem, idx) => {
                if (baseItem === null)
                    return;
                const item = linked[idx];
                const dataSource = data.items.find((i) => i._id === item.id);
                const changes = createChanges(item, baseItem);
                mergeObject(dataSource, changes);
            });
            delete data._id;
            Actor.create(data, { ...options, linkedUpdate: true });
        });
    }
    return !linked.length;
}
Hooks.on('preCreateActor', preCreateActor);
