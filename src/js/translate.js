import {negotiateLanguages} from '@fluent/langneg';
import jsyaml from "js-yaml";
import 'whatwg-fetch';
import "./closest";

const defaultLocale = document.documentElement.lang;
const localeSelect = document.getElementById("locale-select");
const options = localeSelect.getElementsByTagName("option");
const locales = {};

window.locales = locales;

function dispatchEvent() {
	const event = document.createEvent('Event');
	event.initEvent('locale-change', true, true);
	document.dispatchEvent(event);
}

function setValue(object, path, value) {
	// Function that changes the value of an object based on a path contained in an array
	// For example: "setValue(obj, ["foo", "bar"], 123)" is the same as "obj.foo.bar = 123;"

	const property = path.pop();

	for (const key of path) {
		if (!(key in object)) {
			object[key] = {};
		}

		object = object[key];
	}

	object[property] = value;
}

function generateTranslationTable() {
	// Function that uses the page's content to generate a translation table

	const translatedElements = document.querySelectorAll("[i18n]");
	const translationTable = {};

	for (let element of translatedElements) {
		const path = [element.getAttribute("i18n")];
		const text = element.innerHTML
				.replace(/[\n\r\t]/g, '')
				.replace(/<br\/?>/g, "<br />");

		let groupNode;

		while (groupNode = element.closest("[i18n-group]")) {
			path.unshift(groupNode.getAttribute("i18n-group"));
			element = groupNode.parentElement;
		}

		setValue(translationTable, path, text);
	}

	translationTable._javascriptLocales = javascriptLocales;

	return translationTable;
}

locales[defaultLocale] = generateTranslationTable();

function changeLocale(localeName, skipReset) {
	// Changes the locale, but reset it first, in case some text in a locale aren't translated in another one
	// Example: changeLocale("fr")
	if(!skipReset) {
		changeLocale(defaultLocale, true);
	}

	function handleObject(locale, element) {
		for (let value in locale) {
			if(typeof locale[value] === "string") {
				const match = element.querySelector("[i18n=" + value + "]");

				if (match && !match.closest("[i18n-skip]")) {
					match.innerHTML = locale[value];
				}
			} else {
				const match = element.querySelector("[i18n-group=" + value + "]");

				if (match) {
					handleObject(locale[value], match);
				}
			}
		}
	}

	handleObject(locales[localeName], document.body);

	const reformat = document.querySelectorAll("[i18n-reformat]");

	for (const elem of reformat) {
		const num = parseFloat(elem.getAttribute("i18n-reformat"));
		elem.innerText = num.toLocaleString(localeName);
	}

	window.javascriptLocales = locales[localeName]._javascriptLocales;
	document.documentElement.lang = localeName;

	if (!skipReset) {
		if (localeName === defaultLocale) {
			window.history.pushState('', '', window.location.pathname)
		} else {
			window.location.hash = localeName;
		}
	}

	dispatchEvent();
}

const bestLocale = negotiateLanguages(
	navigator.languages || [window.navigator.userLanguage || window.navigator.language],
	[...options].map(option => option.lang)
)[0];

const languageProtip = document.getElementById('language-protip');

for (const option of options) {
	// If we should switch to the locale as soon as it's loaded
	let shouldSwitch = false;

	// Switch if the hash of the URL is the locale's name
	if (window.location.hash.replace(/^\#/g, "") === option.value) {
		localeSelect.value = option.value;
		shouldSwitch = true;
	}

	(async () => {
		if (option.value !== defaultLocale) {
			const res = await fetch(`locales/${option.value}.json`);
			const translation = await res.json();

			locales[option.value] = translation;
		}

		option.disabled = false;

		if (shouldSwitch) {
			changeLocale(option.value);
		}

		if (option.value === bestLocale && localeSelect.value !== option.value) {
			// Displays the language switch pro tip if this language is more appropriated
			const translation = locales[bestLocale]['main-intro']['language-protip'];

			if (translation) {
				languageProtip.querySelector('#language-protip-text').innerHTML = translation;
				languageProtip.lang = option.value;
				languageProtip.style.display = "block";
			}
		}
	})();
}

localeSelect.addEventListener("change", event => {
	changeLocale(event.target.value);
}),

localeSelect.addEventListener("click", () => {
	languageProtip.style.display = "none";
}),

function prettyYAML(yaml) {
	return yaml
		.replace(/^(\S.*)$/gm, "\n$1")
		.replace(/\r\n|\r|\n/g, "\r\n");
}

document.getElementById("download").addEventListener("click", () => {
	const formatSelect = document.getElementById("format");
	const download = document.createElement("A");
	const isYAML = formatSelect.value === "yaml";
	const content = isYAML
			? prettyYAML(jsyaml.safeDump(locales[defaultLocale]))
			: JSON.stringify(locales[defaultLocale], null, "\t");
		
	download.href = URL.createObjectURL(new Blob(
		[content],
		{
			type : isYAML ? " application/x-yaml" : "application/json"
		}
	));
	download.download = isYAML ? "locale.yaml" : "locale.json";

	document.body.appendChild(download);
	download.click();
	document.body.removeChild(download);
});

function selectFile(options = {}) {
	return new Promise((resolve, reject) => {
		const upload = document.createElement("input");

		upload.type = "file";
		upload.accept = options.accept || "";
		upload.multiple = options.multiple || false;
		upload.webkitdirectory = options.directory || false;
		upload.setAttribute("style",
			"position:absolute !important;" +
			"top:-9999vh !important;" +
			"opacity:0 !important;" +
			"height:0 !important;" +
			"width:0 !important; " +
			"z-index:-9999 !important;");

		document.body.appendChild(upload);

		upload.click();

		upload.addEventListener("change", () => {
			let files = upload.files;
			document.body.removeChild(upload);
	
			if (typeof options.array === "undefined" || options.array) {
				files = [...files];
			}
	
			resolve(files);
		});

		upload.addEventListener("error", reject)
	});
}

function blobToString(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.addEventListener("loadend", event => resolve(event.target.result));
		reader.addEventListener("error", reject);
		reader.readAsText(blob);
	});
}

document.getElementById("upload").addEventListener("click", () => {
	selectFile({
		accept: ".json, .yaml"
	}).then(files => {
		blobToString(files[0]).then(content => {
			locales["translator-mode"] = (files[0].type === "application/json") ? JSON.parse(content): jsyaml.safeLoad(content);
			changeLocale("translator-mode");
		});
	});
});
