// Thanks Mozilla <3 https://developer.mozilla.org/en-US/docs/Web/API/Element/closest
// Polyfill for the closest function, since a lot of browsers don't support it
// Well actually that has since changed but idk im keeping this

if (!Element.prototype.matches) {
	Element.prototype.matches =
		Element.prototype.msMatchesSelector ||
		Element.prototype.webkitMatchesSelector;
}

if (!Element.prototype.closest) {
	Element.prototype.closest = function (s) {
		var el = this;

		do {
			if (el.matches(s)) return el;
			el = el.parentElement || el.parentNode;
		} while (el !== null && el.nodeType === 1);
		return null;
	};
}