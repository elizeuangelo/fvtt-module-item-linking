export class ProcessingDialog {
	constructor(dialog, buttonId) {
		this.dialog = dialog;
		this.buttonId = buttonId ?? Object.keys(dialog.data.buttons)[0];
		this.buttonData = dialog.data.buttons[this.buttonId];
		this.#replaceSubmit();
	}

	#disableButtons() {
		this.dialog.element.find('button').prop('disabled', true);
	}
	#disableCloseButton() {
		this.dialog.element.find('a.header-button').remove();
	}
	_newSubmit(button, event) {
		if (this.buttonData === button) {
			const target = this.dialog.options.jQuery ? this.dialog.element : this.dialog.element[0];
			try {
				if (button.callback) button.callback.call(this.dialog, target, event, this);
			} catch (err) {
				ui.notifications.error(err);
			}
			return;
		}
		return Dialog.prototype.submit.call(this.dialog, button, event);
	}
	#replaceSubmit() {
		this.dialog.submit = this._newSubmit.bind(this);
	}

	get button() {
		return this.dialog.element.find(`button[data-button="${this.buttonId}"]`);
	}

	process(label) {
		this.#disableButtons();
		this.#disableCloseButton();
		this.icon = 'fa-solid fa-spinner fa-spin-pulse';
		if (label) this.label = label;
	}

	get icon() {
		return this.button.find('i')[0].classList.value;
	}
	set icon(value) {
		this.button.find('i')[0].classList.value = value;
	}

	get label() {
		return this.button[0].childNodes[2].textContent;
	}
	set label(value) {
		this.button[0].childNodes[2].textContent = value;
	}

	close() {
		this.dialog.close();
	}
}
