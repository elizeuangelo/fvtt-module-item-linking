import { getSetting, setSetting } from '../module/settings.js';
import { rebuildArchiveLinks } from '../module/archive-links.js';
import { fix1 } from './fix1.js';

const LAST_UPDATE = 2;
export function checkFixes() {
	return getSetting('update') < LAST_UPDATE;
}
async function fix2() {
	try {
		await rebuildArchiveLinks();
	} catch (err) {
		console.error(err);
		ui.notifications.warn('Item Linking: archived actors could not be indexed. Use "Fix Item Links" to retry.');
	}
}
export async function applyFixes() {
	if (getSetting('update') < 1) await fix1();
	if (getSetting('update') < 2) await fix2();
	return setSetting('update', LAST_UPDATE);
}

