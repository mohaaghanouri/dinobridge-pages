// Everything the home page needs a browser to do, in one small file. The page
// itself is prerendered with no framework runtime (csr = false in +page.js), so
// this is the whole client-side story: about 2 KB instead of the 220 KB SvelteKit
// bundle the same four behaviours used to ride in on.
//
// Every behaviour degrades: without this file the menu is a native popover, the
// booking links open cal.com in a new tab, the form posts to Formspree's own
// thank-you page, and the nav simply has no active state.

// Menu: the sheet is a native popover; the burger opens it with popovertarget
// and clicking outside closes it. Following a link inside should close it too.
const menu = document.getElementById('menu');
menu?.addEventListener('click', (e) => {
	if (e.target.closest('a')) menu.hidePopover();
});

// Scroll-spy: whichever tracked section owns the middle of the viewport wins.
const links = [...document.querySelectorAll('.desk a[href^="#"]')];
if (links.length && 'IntersectionObserver' in window) {
	const io = new IntersectionObserver(
		(entries) => {
			for (const en of entries) {
				if (!en.isIntersecting) continue;
				for (const a of links) {
					const on = a.hash === '#' + en.target.id;
					a.classList.toggle('on', on);
					if (on) a.setAttribute('aria-current', 'true');
					else a.removeAttribute('aria-current');
				}
			}
		},
		{ rootMargin: '-45% 0px -50% 0px' }
	);
	for (const a of links) {
		const el = document.getElementById(a.hash.slice(1));
		if (el) io.observe(el);
	}
}

// Booking: the links point at cal.com and work as links. With JavaScript they
// open the <dialog> instead and mount Cal's inline embed on first open, so the
// third-party script never loads for anyone who does not book.
const dialog = document.getElementById('book');
if (dialog && typeof dialog.showModal === 'function') {
	const { cal, event } = dialog.dataset;
	let warmed = false;
	let mounted = false;

	// Warm the connection on hover, so the click-to-calendar wait loses a round trip.
	const warm = () => {
		if (warmed) return;
		warmed = true;
		document.head.append(
			Object.assign(document.createElement('link'), {
				rel: 'preconnect',
				href: 'https://app.cal.com',
				crossOrigin: 'anonymous'
			})
		);
	};

	// embed.js drains a queue that must exist when it arrives, so install the
	// queueing stub, push the calls, and let embed.js replay them.
	const mount = () => {
		if (!window.Cal) {
			const q = (...args) => {
				if (!q.loaded) {
					q.ns = {};
					q.q = q.q || [];
					document.head.appendChild(
						Object.assign(document.createElement('script'), {
							src: 'https://app.cal.com/embed/embed.js',
							async: true
						})
					);
					q.loaded = true;
				}
				q.q.push(args);
			};
			window.Cal = q;
		}
		// The embed follows the site theme at the moment the drawer first opens.
		const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
		window.Cal('init', { origin: 'https://cal.com' });
		window.Cal('inline', {
			elementOrSelector: '#cal-inline',
			calLink: `${cal}/${event}`,
			config: { theme, layout: 'month_view' }
		});
		window.Cal('ui', {
			theme,
			cssVarsPerTheme: { light: { 'cal-brand': '#12264a' }, dark: { 'cal-brand': '#e4a62b' } },
			hideEventTypeDetails: false
		});
	};

	// The business cards' QR code points at /#book: open the drawer on arrival.
	if (location.hash === '#book') {
		mount();
		mounted = true;
		dialog.showModal();
	}

	for (const b of document.querySelectorAll('[data-book]')) {
		b.addEventListener('pointerenter', warm, { once: true });
		b.addEventListener('click', (e) => {
			e.preventDefault();
			menu?.matches(':popover-open') && menu.hidePopover();
			dialog.showModal();
			if (!mounted) {
				mount();
				mounted = true;
			}
		});
	}
}

// Contact form: post in place and report inline; the labels come from the copy
// via data attributes so this file holds no words.
const form = document.querySelector('form[data-ajax]');
if (form) {
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const btn = form.querySelector('button[type="submit"]');
		const status = form.querySelector('.form-status');
		btn.disabled = true;
		btn.textContent = form.dataset.sending;
		try {
			const res = await fetch(form.action, {
				method: 'POST',
				body: new FormData(form),
				headers: { Accept: 'application/json' }
			});
			if (!res.ok) throw new Error(String(res.status));
			form.replaceWith(
				Object.assign(document.createElement('p'), {
					className: 'form-status ok',
					textContent: form.dataset.success
				})
			);
		} catch {
			status.textContent = form.dataset.error;
			btn.disabled = false;
			btn.textContent = form.dataset.send;
		}
	});
}
