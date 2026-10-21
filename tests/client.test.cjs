const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

// Small DOM doubles exercise client behaviour without adding npm dependencies.
class Element {
    constructor(tagName = 'div') {
        Object.assign(this, { tagName, children: [], dataset: {}, attributes: {}, listeners: {}, value: '', hidden: false, textContent: '' });
    }
    append(...items) { for (const item of items) this.children.push(...(item.tagName === 'fragment' ? item.children : [item])); }
    replaceChildren(...items) { this.children = []; this.append(...items); }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    add(option) { this.append(option); }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    fire(name) { this.listeners[name]?.({ preventDefault() {} }); }
    closest() { return this.parent; }
    querySelector() { return this.children[0]; }
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
async function start(search = '') {
    const elements = new Map();
    const element = (id) => {
        if (!elements.has(id)) elements.set(id, new Element());
        return elements.get(id);
    };
    const sorts = ['SalesId', 'CreatedDateTime1', 'HAR_TotalSOAmount', 'SalesStatus', 'InventSiteId'].map((key) => {
        const button = new Element('button'); button.dataset.sort = key;
        button.parent = new Element('th'); button.append(new Element('span')); return button;
    });
    const metrics = ['total_orders', 'open_orders', 'completed', 'cancelled_orders', 'total_order_value'].map((key) => {
        const strong = new Element('strong'); strong.dataset.metric = key; return strong;
    });
    const calls = [], history = [];
    const fixture = {
        summary: { total_orders: 1200, open_orders: 420, invoiced_orders: 360, delivered_orders: 300, cancelled_orders: 120, total_order_value: 998244.3 },
        total: 1200, totalPages: 48,
        data: [{ SalesId: 'SO-MOCK-00001', SalesName: 'Siti Mart Sdn Bhd', CustAccount: 'C10001', InventSiteId: 'B20', CreatedDateTime1: '2026-09-30T03:07:00.000Z', SalesStatus: 'Open order', HAR_TotalSOAmount: 162.35 }],
    };
    let fail = false;
    vm.runInNewContext(readFileSync('public/app.js', 'utf8'), {
        document: {
            getElementById: element,
            createElement: (tag) => new Element(tag),
            createDocumentFragment: () => new Element('fragment'),
            querySelectorAll: (selector) => selector === '.sort' ? sorts : metrics,
        },
        location: { search, pathname: '/', hash: '' },
        history: { replaceState: (_data, _title, url) => history.push(url) },
        Option: class extends Element { constructor(text, value) { super('option'); this.textContent = text; this.value = value; } },
        fetch: async (url) => {
            calls.push(url);
            const meta = url.endsWith('/meta');
            return { ok: meta || !fail, json: async () => meta ? { facets: { sites: [{ value: 'A10' }, { value: 'B20' }], statuses: [{ value: 'Open order' }] } } : fixture };
        },
        URLSearchParams, Intl, Date, AbortController, setTimeout, clearTimeout,
    });
    await tick();
    return { element, calls, history, sorts, fixture, setFailure: (value) => { fail = value; }, query: () => new URL(calls.filter((url) => !url.endsWith('/meta')).at(-1), 'https://example.test').searchParams };
}

test('existing filter links work and the address bar is cleaned only once', async () => {
    const app = await start('?page=1&pageSize=25&site=A10&sort=CreatedDateTime1&order=desc');
    assert.deepEqual(app.history, ['/']);
    assert.equal(app.query().get('site'), 'A10');
    assert.equal(app.element('site').value, 'A10');
    app.element('site').value = 'B20'; app.element('site').fire('change'); await tick();
    assert.equal(app.query().get('site'), 'B20');
    assert.deepEqual(app.history, ['/']);
});

test('the clean homepage never gains query parameters', async () => {
    const app = await start();
    app.element('next').fire('click'); await tick();
    assert.equal(app.query().get('page'), '2');
    assert.equal(app.element('page-label').textContent, 'Page 2 of 48');
    assert.deepEqual(app.history, []);
});

test('mobile sorting resets pagination and stays in sync with table sorting', async () => {
    const app = await start('?page=3');
    app.element('mobile-sort').value = 'HAR_TotalSOAmount:desc';
    app.element('mobile-sort').fire('change'); await tick();
    assert.equal(app.query().get('sort'), 'HAR_TotalSOAmount');
    assert.equal(app.query().get('order'), 'desc');
    assert.equal(app.query().get('page'), '1');
    assert.equal(app.sorts[2].parent.attributes['aria-sort'], 'descending');
    app.sorts[2].fire('click'); await tick();
    assert.equal(app.element('mobile-sort').value, 'HAR_TotalSOAmount:asc');
});

test('order rows provide the six labelled fields for mobile cards', async () => {
    const app = await start();
    const row = app.element('order-rows').children[0];
    assert.deepEqual(row.children.map((cell) => cell.dataset.label), ['Order number', 'Customer', 'Branch', 'Order date', 'Status', 'Amount (MYR)']);
    assert.equal(row.children[0].textContent, 'SO-MOCK-00001');
    assert.equal(row.children[1].children[0].textContent, 'Siti Mart Sdn Bhd');
    assert.equal(row.children[5].textContent, '162.35');
});

test('clear filters restores defaults without changing the address bar', async () => {
    const app = await start('?q=Siti&site=B20&status=Open%20order');
    app.element('clear').fire('click'); await tick();
    for (const key of ['q', 'site', 'status']) assert.equal(app.query().has(key), false);
    assert.equal(app.element('clear').hidden, true);
    assert.deepEqual(app.history, ['/']);
});

test('request failures offer a working retry and empty results offer clear filters', async () => {
    const app = await start();
    app.setFailure(true); app.element('refresh').fire('click'); await tick();
    assert.equal(app.element('range').textContent, 'Orders unavailable');
    app.setFailure(false);
    app.element('table-state').children.find((child) => child.tagName === 'button').fire('click'); await tick();
    assert.equal(app.element('table-state').hidden, true);
    app.fixture.data = []; app.fixture.total = 0; app.fixture.totalPages = 0;
    app.element('refresh').fire('click'); await tick();
    assert.equal(app.element('table-state').hidden, false);
    assert.equal(app.element('table-state').children.find((child) => child.tagName === 'button').textContent, 'Clear filters');
    assert.equal(app.element('next').disabled, true);
});
