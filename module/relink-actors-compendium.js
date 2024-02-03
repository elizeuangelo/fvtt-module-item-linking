export async function relinkActorsCompendiumApp() {
    function addListeners(html) { }
    const packs = game.packs.filter((p) => p.documentName === 'Item');
    if (!packs.length) {
        return ui.notifications.warn(game.i18n.format('FOLDER.ExportWarningNone', { type: this.type }));
    }
    const folders = game.folders.filter((f) => f.type === 'Actor');
    const content = await renderTemplate('modules/item-linking/templates/relink-actors.hbs', {
        packs: packs.map((p) => ({ id: p.metadata.id, name: p.metadata.label })),
        folders,
    });
    new Dialog({
        title: `Relink Actors Links to Compendiums`,
        content,
        render: (html) => addListeners(html),
        default: 'yes',
        close: () => null,
        buttons: {
            yes: {
                icon: '<i class="fas fa-magnifying-glass"></i>',
                label: game.i18n.localize('Search'),
                callback: (html) => {
                    const form = html[0].querySelector('form');
                    const data = new FormDataExtended(form);
                    if (form.checkValidity() === false) {
                        throw new Error(game.i18n.localize('You must select at least one pack and one folder'));
                    }
                    searchInventory(data.object);
                },
            },
        },
    }, { classes: ['dialog', 'item-linking-dialog'], width: 500 }).render(true);
}
async function searchInventory(data) {
    const subfolders = data.subfolders;
    const packs = data.packs.map((p) => game.packs.get(p));
    const folders = [];
    const packsItems = (await Promise.all(packs.map((p) => p.getDocuments()))).flat();
    for (const id of data.folders) {
        const folder = game.folders.get(id);
        if (!folder)
            continue;
        folders.push(folder);
        if (subfolders) {
            folders.push(...folder.getSubfolders(true));
        }
    }
    const entries = [];
    const actors = game.actors.filter((a) => folders.includes(a.folder));
    for (const actor of actors) {
        for (const item of actor.items) {
            const flags = item.flags['item-linking'];
            if (!flags)
                continue;
            const baseItem = flags.baseItem ? await fromUuid(flags.baseItem) : null;
            const isLinked = flags.isLinked ?? false;
            if (isLinked && baseItem)
                continue;
            const similarItems = await findSimilarItemsInCompendiums(item.name, item.type, packsItems);
            entries.push({ label: CONFIG.Item.typeLabels[item.type], actor, item, similarItems, baseItem, isLinked });
        }
    }
    const content = await renderTemplate('modules/item-linking/templates/relink-inventory.hbs', { entries });
    function addEventListeners(html) {
        html.find('.btn-update').on('click', async (event) => {
            const button = event.currentTarget;
            const row = button.closest('tr');
            const select = row.querySelector('select');
            const selectedUuid = select.value;
            if (selectedUuid) {
                const item = await fromUuid(button.dataset.uuid);
                await item.update({
                    'flags.item-linking.baseItem': selectedUuid,
                    'flags.item-linking.isLinked': true,
                });
                button.classList.add('btn-disabled');
                select.disabled = true;
                const dot = row.querySelector('.dot');
                if (dot)
                    dot.classList.add('green');
            }
        });
        html.find('select').on('change', (event) => {
            const select = event.currentTarget;
            const row = select.closest('tr');
            const compendiumItemEl = row.querySelector('.compendium-item');
            const resyncItemEl = row.querySelector('.resync-item');
            compendiumItemEl.dataset.uuid = select.value;
            compendiumItemEl.classList.toggle('btn-disabled', !select.value);
            resyncItemEl.classList.toggle('btn-disabled', !select.value);
        });
        html.find('[data-action="render"]').on('click', async (event) => {
            const button = event.currentTarget;
            const uuid = button.dataset.uuid;
            const item = await fromUuid(uuid);
            item?.sheet?.render(true);
        });
    }
    new Dialog({
        title: 'Inventory Check',
        content,
        buttons: {
            ok: {
                label: 'Close',
            },
        },
        render: (html) => addEventListeners(html),
    }, { classes: ['dialog', 'item-linking-dialog'], width: 800, resizable: true }).render(true);
}
async function findSimilarItemsInCompendiums(itemName, itemType, packsItems) {
    const rows = [];
    const filteredItems = packsItems.filter((i) => i.name === itemName && i.type === itemType);
    for (const item of filteredItems) {
        if (item && item.type === itemType) {
            rows.push({ name: `${item.name} - ${item.compendium.metadata.label}`, uuid: item.uuid });
        }
    }
    return rows;
}
