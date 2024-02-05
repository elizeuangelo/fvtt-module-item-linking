export let KEEP_PROPERTIES = [];

/**
 * Import the current system, if supported, and get the its keep properties
 * Currently only supports dnd5e
 */
Hooks.once('ready', async () => {
	let system = '';
	switch (game.system.id) {
		case 'dnd5e':
			system = './systems/dnd5e.js';
	}
	if (system === '') return;
	const { KEEP } = await import(system);
	return (KEEP_PROPERTIES = KEEP);
});

