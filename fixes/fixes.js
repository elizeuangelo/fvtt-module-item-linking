import { getSetting, setSetting } from '../module/settings.js';
import { fix1 } from './fix1.js';
const LAST_UPDATE = 1;
export function checkFixes() {
    return getSetting('update') < LAST_UPDATE;
}
export async function applyFixes() {
    if (getSetting('update') < 1)
        await fix1();
    return setSetting('update', LAST_UPDATE);
}
