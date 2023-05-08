import { getFlag } from '../flags.js';
import { PACKS, createUuidFromIndex, findItemFromUUID, getItemsFromCompendiumsByType } from '../packs.js';
import { MODULE, getSetting } from '../settings.js';
export const KEEP = [
    'uses.value',
    'recharge.charged',
    'quantity',
    'proficient',
    'identified',
    'equipped',
    'attunement',
    'hp.value',
    'hp.conditions',
];
function createOptionsFromPack(pack, type, selected) {
    function createOption(value, title, selected) {
        return `<option value="${value}" ${selected ? 'selected' : ''}>${title}</option>`;
    }
    const options = getItemsFromCompendiumsByType(pack, type);
    return `
        <optgroup label="${pack.metadata.label}">
            ${options
        .map((op) => {
        const uuid = createUuidFromIndex(pack, op._id);
        return createOption(uuid, op.name, selected === uuid);
    })
        .join('')}
        </optgroup>
    `;
}
function onSearchFilter(event, query, rgx, html) {
    const visibleGroups = new Set();
    for (const entry of html.querySelectorAll('option')) {
        if (!query) {
            entry.classList.remove('hidden');
            continue;
        }
        const label = entry.textContent;
        const match = rgx.test(SearchFilter.cleanQuery(label));
        entry.classList.toggle('hidden', !match);
        if (match)
            visibleGroups.add(entry.parentElement);
    }
    for (const group of html.querySelectorAll('optgroup')) {
        group.classList.toggle('hidden', query && !visibleGroups.has(group));
    }
}
function renderItemSheet(sheet, html) {
    const item = sheet.document;
    if (item.compendium)
        return;
    const linked = getFlag(item, 'isLinked');
    const baseItemId = getFlag(item, 'baseItem');
    const brokenLink = baseItemId ? !Boolean(fromUuidSync(baseItemId)) : true;
    if (game.user.isGM === false && !linked)
        return;
    const linkText = ['Not Linked', 'Linked', 'Broken Link'];
    const row = $(`
            <ul class="summary link flexrow">
                <li class="item-link">${linkText[+linked + +(brokenLink && linked)]}</li>
                ${linked ? '<input type="search" name="search" placeholder="Filter" />' : ''}
                <input type="checkbox" name="flags.${MODULE}.isLinked" style="display:none" ${linked ? 'checked' : ''} />
                <li>
                    <select name="flags.${MODULE}.baseItem" ${game.user.isGM && linked ? '' : 'disabled'}>
                        ${brokenLink
        ? `<optgroup label="Broken Link"><option value="" selected}>Unknown item</option></optgroup>`
        : ''}
                        ${PACKS.map((pack) => createOptionsFromPack(pack, item.type, getFlag(item, 'baseItem'))).join('')}
                    </select>
                </li>
            </ul>
    `);
    html.find('div.header-details').append(row);
    if (game.user.isGM) {
        const link = row.find('.item-link');
        const checkbox = row.find(`input[name="flags.${MODULE}.isLinked"]`);
        link.on('click', () => checkbox.trigger('click'));
        if (baseItemId && brokenLink === false) {
            link.on('contextmenu', async () => {
                const baseItem = await findItemFromUUID(baseItemId);
                baseItem?.sheet.render(true);
            });
        }
        new SearchFilter({
            inputSelector: 'input[name="search"]',
            contentSelector: `select[name="flags.${MODULE}.baseItem"]`,
            callback: onSearchFilter,
        }).bind(html[0]);
    }
    if (!linked)
        return;
    const rgx = /^system\./;
    const KEEP_PROP = KEEP.map((k) => 'system.' + k);
    const filter = (input) => !(!rgx.exec(input.name) || KEEP_PROP.includes(input.name));
    $([...html.find('input'), ...html.find('select')].filter(filter)).attr('disabled', '');
    if (getSetting('linkHeader')) {
        html.find('input[name="name"]').attr('disabled', '');
        html.find('img.profile').off('click');
    }
    const deletions = ['a.editor-edit', 'a.effect-control'];
    deletions.forEach((deletion) => html.find(deletion).remove());
    if (getSetting('hideUselessInformation')) {
        const deletions = ['input[type=checkbox][disabled]:not(:checked)'];
        deletions.forEach((deletion) => html.find(deletion).parent().remove());
    }
}
Hooks.on('renderItemSheet', renderItemSheet);
