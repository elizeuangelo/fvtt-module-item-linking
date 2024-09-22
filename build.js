// Usage: node build.mjs
import fs from 'fs';
import { exec } from 'child_process';
import { createInterface } from 'readline';

const manifestFile = JSON.parse(fs.readFileSync('./module.json', 'utf-8'));

const { title, version } = manifestFile;
const newVersion = bumpVersion(version);

const readline = createInterface({
	input: process.stdin,
	output: process.stdout,
});

async function awaitUserInput(msg) {
	return new Promise((resolve) => {
		readline.question(msg + ' ', (answer) => {
			resolve(answer);
		});
	});
}

function bumpVersion(version) {
	const arr = version.split('.');
	arr[arr.length - 1] = parseInt(arr[arr.length - 1]) + 1;
	return arr.join('.');
}

function updateVersionInManifest() {
	manifestFile.version = newVersion;
	fs.writeFileSync('./module.json', JSON.stringify(manifestFile, null, 4).replace(/\n/g, '\r\n'));
}

function execCommandAsPromise(command) {
	return new Promise((resolve, reject) => {
		exec(command, async (error, stdout, stderr) => {
			if (error) {
				reject(error);
				return;
			}
			if (stderr) {
				console.log(stderr.trimEnd());
			}
			if (stdout) console.log(stdout.trimEnd());
			resolve(stdout);
		});
	});
}

console.log(`Building ${title} \x1b[31mv${version}\x1b[0m -> \x1b[32mv${newVersion}\x1b[0m`);

// Do you want to proceed?
const proceed = await awaitUserInput('Do you want to proceed? (y/n)');
if (proceed.toLowerCase() !== 'y') {
	console.log('Aborted');
	process.exit(0);
}

updateVersionInManifest();
console.log('Updated manifest version');

try {
	await execCommandAsPromise('git add module.json');
	console.log('Added module.json to git');
	await execCommandAsPromise(`git commit -m "New release v${newVersion}"`);
	console.log('Committed new release');
	await execCommandAsPromise(`git tag v${newVersion}`);
	console.log('Created new tag');
	await execCommandAsPromise('git push');
	console.log('Pushed changes');
	await execCommandAsPromise('git push --tags');
	console.log('Pushed tags');
	console.log('✅ Build successful');
	process.exit(0);
} catch (error) {
	console.error(error);
	console.error('❌ Build failed');
	process.exit(1);
}
