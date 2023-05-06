export const TITLE = 'Item Linking';
export const MODULE = 'item-linking';
const settings = {};
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
