export let KEEP_PROPERTIES: string[] = [];

/** -------------------------------------------- */
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
