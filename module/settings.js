export const TITLE = 'Item Linking';
export const MODULE = 'item-linking';
const settings = {
    linkHeader: {
        name: 'Link Header',
        hint: 'Linked items will also have their names and images linked.',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
    },
    hideUselessInformation: {
        name: 'Hide Useless Information',
        hint: 'Will hide empty information on linked items.',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
    },
};
export function getSetting(name) {
    return game.settings.get(MODULE, name);
}
export function setSetting(name, value) {
    return game.settings.set(MODULE, name, value);
}
Hooks.once('setup', () => {
    for (const [key, setting] of Object.entries(settings)) {
        game.settings.register(MODULE, key, setting);
    }
});
