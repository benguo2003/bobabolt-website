/* rachel rates — shared page script.
 *
 * 1. Cards: fill the stars, dim unused price marks, fade photos in on load.
 * 2. Tabs: coffee <-> restaurants without a page reload. The other page is
 *    fetched in the background, so a click swaps instantly; the swap runs
 *    inside a View Transition where the new page blooms out of the click
 *    point as a widening circle with a soft glow riding its edge, while the
 *    old page sinks (into evening) or washes out (into morning).
 */
(function () {
    'use strict';

    var PATHS = { coffee: '/', restaurants: '/restaurants' };
    var REVEAL_MS = 1050;
    var REVEAL_EASE = 'cubic-bezier(0.76, 0, 0.24, 1)';
    var RING_SIZE = 200; // .vt-ring is drawn at this size, then scaled up

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function sectionOf(path) {
        return /^\/restaurants/.test(path) ? 'restaurants' : 'coffee';
    }

    /* ------------------------------------------------------------------
       Cards
       ------------------------------------------------------------------ */

    function initCards(scope) {
        scope.querySelectorAll('.stars').forEach(function (container) {
            var rating = parseFloat(container.dataset.rating);
            container.querySelectorAll('.star').forEach(function (star, i) {
                if (rating >= i + 1) {
                    star.classList.add('filled');
                } else if (rating > i) {
                    star.classList.add('partial');
                    star.style.setProperty('--fill-percentage', (rating - i) * 100 + '%');
                }
            });
        });

        // "$$" -> $$ plus a faded $ so price reads on a fixed scale
        scope.querySelectorAll('.price[data-price]').forEach(function (el) {
            var n = parseInt(el.dataset.price, 10) || 0;
            var scale = Math.max(3, n);
            el.innerHTML = '<span>' + '$'.repeat(n) + '</span>' +
                '<span class="price-off" aria-hidden="true">' + '$'.repeat(scale - n) + '</span>';
        });

        scope.querySelectorAll('.coffee-card img').forEach(function (img) {
            var show = function () { img.classList.add('loaded'); };
            if (img.complete) show();
            else {
                img.addEventListener('load', show, { once: true });
                img.addEventListener('error', show, { once: true });
            }
        });
    }

    /* ------------------------------------------------------------------
       Page cache — each section's swappable parts, parsed once
       ------------------------------------------------------------------ */

    var current = sectionOf(location.pathname);
    var pages = {};

    function capture(doc) {
        var meta = doc.querySelector('meta[name="theme-color"]');
        return {
            title: doc.title,
            bodyClass: doc.body.className,
            tagline: doc.querySelector('.tagline').textContent,
            themeColor: meta ? meta.content : '',
            main: doc.querySelector('main').cloneNode(true)
        };
    }

    // snapshot this page before initCards decorates it
    pages[current] = Promise.resolve(capture(document));

    function load(section) {
        if (!pages[section]) {
            pages[section] = fetch(PATHS[section], { credentials: 'same-origin' })
                .then(function (res) {
                    if (!res.ok) throw new Error(res.status);
                    return res.text();
                })
                .then(function (html) {
                    var page = capture(new DOMParser().parseFromString(html, 'text/html'));
                    warmImages(page.main);
                    return page;
                });
            pages[section].catch(function () { delete pages[section]; });
        }
        return pages[section];
    }

    // pull the first row of photos into cache so they're there on arrival
    function warmImages(main) {
        var c = navigator.connection;
        if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
        main.querySelectorAll('img').forEach(function (img, i) {
            if (i < 4) new Image().src = img.getAttribute('src');
        });
    }

    /* ------------------------------------------------------------------
       Swap
       ------------------------------------------------------------------ */

    function apply(section, page) {
        document.title = page.title;
        document.body.className = page.bodyClass;
        document.querySelector('.tagline').textContent = page.tagline;
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta && page.themeColor) meta.content = page.themeColor;

        document.querySelectorAll('.tabs .tab').forEach(function (tab) {
            if (tab.dataset.section === section) tab.setAttribute('aria-current', 'page');
            else tab.removeAttribute('aria-current');
        });

        // a fresh <main> replays the cards' CSS rise-in on insertion
        var main = page.main.cloneNode(true);
        document.querySelector('main').replaceWith(main);
        initCards(main);

        window.scrollTo(0, 0);
        current = section;
    }

    var busy = false;

    // back/forward pressed mid-transition: catch up once it lands
    function settle() {
        busy = false;
        var section = sectionOf(location.pathname);
        if (section !== current) go(section, tabCentre(section), false);
    }

    function go(section, origin, push) {
        if (busy || section === current) return;
        busy = true;

        load(section).then(function (page) {
            var commit = function () {
                apply(section, page);
                if (push) history.pushState({ section: section }, '', PATHS[section]);
            };

            if (!document.startViewTransition || reduceMotion.matches) {
                commit();
                settle();
                return;
            }

            var x = origin.x, y = origin.y;
            var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
            var root = document.documentElement;
            root.dataset.vt = section;

            var ring = document.createElement('div');
            ring.className = 'vt-ring';
            ring.style.left = x + 'px';
            ring.style.top = y + 'px';

            var t = document.startViewTransition(function () {
                commit();
                document.body.appendChild(ring);
            });

            t.ready.then(function () {
                var timing = { duration: REVEAL_MS, easing: REVEAL_EASE, fill: 'both' };
                var circle = function (radius) {
                    return 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)';
                };

                root.animate(
                    { clipPath: [circle(0), circle(r)] },
                    Object.assign({ pseudoElement: '::view-transition-new(root)' }, timing)
                );

                // dusk falls on the way to dinner; morning light on the way back
                var into = section === 'restaurants'
                    ? 'scale(0.94)' : 'scale(1.04)';
                var tone = section === 'restaurants'
                    ? 'brightness(0.45) saturate(0.7)' : 'brightness(1.25) saturate(0.8)';
                root.animate(
                    { transform: ['none', into], filter: ['none', tone] },
                    Object.assign({ pseudoElement: '::view-transition-old(root)' }, timing)
                );

                var s = r / (RING_SIZE / 2);
                root.animate(
                    {
                        transform: ['scale(0)', 'scale(' + s * 0.6 + ')', 'scale(' + s + ')'],
                        opacity: [1, 1, 0],
                        offset: [0, 0.6, 1]
                    },
                    Object.assign({ pseudoElement: '::view-transition-new(vt-ring)' }, timing)
                );
            }).catch(function () {});

            t.finished.finally(function () {
                ring.remove();
                delete root.dataset.vt;
                settle();
            });
        }).catch(function () {
            busy = false;
            // network trouble: fall back to a normal page load
            location.href = PATHS[section];
        });
    }

    function tabCentre(section) {
        var tab = document.querySelector('.tab[data-section="' + section + '"]');
        var b = tab.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }

    document.addEventListener('click', function (e) {
        var tab = e.target.closest('.tabs .tab');
        if (!tab || e.defaultPrevented || e.button !== 0 ||
            e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        var section = tab.dataset.section;
        // keyboard activation reports 0,0 — bloom from the tab instead
        var origin = e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : tabCentre(section);
        go(section, origin, true);
    });

    // start fetching as soon as the pointer heads for a tab
    ['pointerenter', 'focusin', 'touchstart'].forEach(function (type) {
        document.addEventListener(type, function (e) {
            var tab = e.target.closest && e.target.closest('.tabs .tab');
            if (tab) load(tab.dataset.section).catch(function () {});
        }, { capture: true, passive: true });
    });

    window.addEventListener('popstate', function () {
        var section = sectionOf(location.pathname);
        if (section !== current) go(section, tabCentre(section), false);
    });

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    history.replaceState({ section: current }, '');

    initCards(document);

    // the other tab's page is tiny — fetch it once the browser is idle
    var idle = window.requestIdleCallback || function (fn) { setTimeout(fn, 1200); };
    window.addEventListener('load', function () {
        idle(function () {
            load(current === 'coffee' ? 'restaurants' : 'coffee').catch(function () {});
        });
    });
})();
