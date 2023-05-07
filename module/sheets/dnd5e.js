import { getFlag } from '../flags.js';
import { PACKS, createUuidFromIndex, getItemsFromCompendiumsByType } from '../packs.js';
import { MODULE } from '../settings.js';
export const KEEP = ['uses.value', 'recharge.charged', 'quantity', 'proficient', 'identified', 'equipped', 'attunement', 'hp.value', 'hp.conditions'];
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
function renderItemSheet(sheet, html) {
    const item = sheet.document;
    if (item.compendium)
        return;
    const linked = getFlag(item, 'isLinked');
    if (game.user.isGM === false && !linked)
        return;
    const linkText = ['Not Linked', 'Linked'];
    const row = $(`
            <ul class="summary flexrow">
                <li class="item-link">${linkText[+linked]}</li>
                <input type="checkbox" name="flags.${MODULE}.isLinked" style="display:none" ${linked ? 'checked' : ''} />
                <li>
                    <select name="flags.${MODULE}.baseItem" ${game.user.isGM && linked ? '' : 'disabled'}>
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
    }
    if (!linked)
        return;
    const rgx = /^system\./;
    const KEEP_PROP = KEEP.map((k) => 'system.' + k);
    const filter = (input) => !(!rgx.exec(input.name) || KEEP_PROP.includes(input.name));
    $([...html.find('input'), ...html.find('select')].filter(filter)).attr('disabled', '');
    const deletions = ['a.editor-edit', 'a.effect-control'];
    deletions.forEach((deletion) => html.find(deletion).remove());
}
Hooks.on('renderItemSheet', renderItemSheet);
