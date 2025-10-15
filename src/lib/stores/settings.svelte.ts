import type { ReaderSettings } from '$lib/types';
import { saveSettings, loadSettings } from '$lib/utils/storage';

class SettingsStore {
	settings = $state<ReaderSettings>({
		fontSize: 'md',
		fontFamily: 'serif',
		lineHeight: 'relaxed',
		theme: 'system'
	});

	async init() {
		this.settings = await loadSettings();
		this.applyTheme();
	}

	async setFontSize(size: ReaderSettings['fontSize']) {
		this.settings.fontSize = size;
		await saveSettings(this.settings);
	}

	async setFontFamily(family: ReaderSettings['fontFamily']) {
		this.settings.fontFamily = family;
		await saveSettings(this.settings);
	}

	async setLineHeight(lineHeight: ReaderSettings['lineHeight']) {
		this.settings.lineHeight = lineHeight;
		await saveSettings(this.settings);
	}

	async setTheme(theme: ReaderSettings['theme']) {
		this.settings.theme = theme;
		await saveSettings(this.settings);
		this.applyTheme();
	}

	applyTheme() {
		const root = document.documentElement;
		const theme = this.settings.theme;

		if (theme === 'dark') {
			root.classList.add('dark');
		} else if (theme === 'light') {
			root.classList.remove('dark');
		} else {
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			if (prefersDark) {
				root.classList.add('dark');
			} else {
				root.classList.remove('dark');
			}
		}
	}
}

export const settingsStore = new SettingsStore();
