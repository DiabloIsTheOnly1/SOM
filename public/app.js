(() => {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const allowedSorts = ['SalesId', 'CreatedDateTime1', 'HAR_TotalSOAmount', 'SalesStatus', 'InventSiteId'];
    const params = new URLSearchParams(location.search);
    const positive = (value, fallback) => /^\d+$/.test(value || '') && Number(value) > 0 && Number(value) <= 100000 ? Number(value) : fallback;
    const state = {
        page: positive(params.get('page'), 1),
        pageSize: [10, 25, 50, 100].includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : 25,
        q: (params.get('q') || '').slice(0, 150), site: (params.get('site') || '').slice(0, 30),
        status: (params.get('status') || '').slice(0, 50),
        sort: allowedSorts.includes(params.get('sort')) ? params.get('sort') : 'CreatedDateTime1',
        order: params.get('order') === 'asc' ? 'asc' : 'desc',
    };
    // Accept existing bookmarked filters once, then keep the address bar clean.
    // Further filter changes live in this page; refreshing starts from defaults.
    if (location.search) history.replaceState(null, '', location.pathname + location.hash);
    const number = new Intl.NumberFormat('en-MY');
    const money = new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const date = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' });
    let requestController, debounce, totalPages = 0, busy = false, hasSummary = false;
    $('search').value = state.q;
    $('page-size').value = state.pageSize;

    function syncControls() {
        $('clear').hidden = !(state.q || state.site || state.status);
        $('mobile-sort').value = `${state.sort}:${state.order}`;
        document.querySelectorAll('.sort').forEach((button) => {
            const active = button.dataset.sort === state.sort;
            if (active) button.closest('th').setAttribute('aria-sort', state.order === 'asc' ? 'ascending' : 'descending');
            else button.closest('th').removeAttribute('aria-sort');
            button.querySelector('span').textContent = active ? (state.order === 'asc' ? '↑' : '↓') : '↕';
        });
    }

    async function getJson(url, signal) {
        const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
        if (!response.ok) throw new Error('Order service unavailable');
        return response.json();
    }

    function controls() {
        $('previous').disabled = busy || state.page <= 1;
        $('next').disabled = busy || state.page >= totalPages;
        $('refresh').disabled = busy;
    }

    function showState(title, description, mode) {
        const panel = $('table-state');
        panel.replaceChildren();
        const icon = document.createElement('span');
        icon.className = mode === 'loading' ? 'spinner' : 'state-icon';
        icon.textContent = mode === 'loading' ? '' : mode === 'error' ? '⊘' : '⌕';
        icon.setAttribute('aria-hidden', 'true');
        const heading = document.createElement('h3'); heading.textContent = title;
        const copy = document.createElement('p'); copy.textContent = description;
        panel.append(icon, heading, copy);
        if (mode !== 'loading') {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'button';
            button.textContent = mode === 'error' ? 'Try again' : 'Clear filters';
            button.addEventListener('click', mode === 'error' ? loadOrders : clearFilters);
            panel.append(button);
        }
        panel.hidden = false;
    }

    function cell(row, text, className = '', label = '') {
        const td = document.createElement('td');
        td.textContent = text; td.className = className; td.dataset.label = label;
        row.append(td); return td;
    }

    function renderOrders(orders) {
        const fragment = document.createDocumentFragment();
        for (const order of orders) {
            const row = document.createElement('tr');
            cell(row, order.SalesId, 'order-id', 'Order number');
            const customer = cell(row, '', 'customer-cell', 'Customer');
            const name = document.createElement('span'); name.className = 'customer-name'; name.textContent = order.SalesName || '—';
            const account = document.createElement('span'); account.className = 'customer-account'; account.textContent = order.CustAccount || '—';
            customer.append(name, account);
            const site = cell(row, '', 'branch-cell', 'Branch');
            const code = document.createElement('span'); code.className = 'site-code'; code.textContent = order.InventSiteId || '—'; site.append(code);
            const created = new Date(order.CreatedDateTime1);
            cell(row, Number.isNaN(created.getTime()) ? '—' : date.format(created), 'date-cell', 'Order date');
            const status = cell(row, '', 'status-cell', 'Status');
            const badge = document.createElement('span');
            const types = { 'Open order': 'open', Invoiced: 'invoiced', Delivered: 'delivered', Cancelled: 'cancelled' };
            badge.className = `status-pill status-${types[order.SalesStatus] || 'other'}`;
            badge.textContent = order.SalesStatus || 'Unknown'; status.append(badge);
            cell(row, money.format(order.HAR_TotalSOAmount), 'amount amount-value', 'Amount (MYR)');
            fragment.append(row);
        }
        $('order-rows').replaceChildren(fragment);
    }

    async function loadOrders() {
        clearTimeout(debounce);
        requestController?.abort();
        const controller = new AbortController(); requestController = controller;
        busy = true; controls(); syncControls();
        $('results').setAttribute('aria-busy', 'true');
        $('metrics').setAttribute('aria-busy', 'true');
        $('order-rows').replaceChildren();
        $('range').textContent = 'Fetching orders…';
        showState('Loading your orders', 'Getting the latest data from the order service.', 'loading');
        try {
            const query = new URLSearchParams(Object.entries(state).filter(([, value]) => value !== ''));
            const result = await getJson(`/api/orders?${query}`, controller.signal);
            if (controller.signal.aborted) return;
            if (state.page > Math.max(1, result.totalPages)) {
                state.page = Math.max(1, result.totalPages); loadOrders(); return;
            }
            const summary = { ...result.summary, completed: result.summary.invoiced_orders + result.summary.delivered_orders };
            document.querySelectorAll('[data-metric]').forEach((el) => {
                const key = el.dataset.metric;
                el.textContent = key === 'total_order_value' ? money.format(summary[key]) : number.format(summary[key]);
            });
            hasSummary = true;
            totalPages = result.totalPages;
            $('order-count').textContent = number.format(result.total);
            renderOrders(result.data);
            $('table-state').hidden = result.data.length > 0;
            if (!result.data.length) showState('No orders found', 'Try a different search or clear your filters to see all orders.', 'empty');
            const start = result.total ? (state.page - 1) * state.pageSize + 1 : 0;
            const end = Math.min(state.page * state.pageSize, result.total);
            $('range').textContent = `Showing ${number.format(start)}–${number.format(end)} of ${number.format(result.total)} orders`;
            $('page-label').textContent = `Page ${state.page} of ${Math.max(1, totalPages)}`;
            $('last-updated').textContent = `Updated ${new Intl.DateTimeFormat('en-MY', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date())} MYT`;
        } catch (error) {
            if (error.name === 'AbortError') return;
            totalPages = 0;
            showState('We couldn’t load your orders', 'The order service may be temporarily unavailable. Please try again.', 'error');
            $('range').textContent = 'Orders unavailable';
            $('page-label').textContent = 'Page —';
            $('order-count').textContent = '—';
            if (hasSummary) $('last-updated').textContent = 'Refresh failed · Snapshot shows last successful totals';
        } finally {
            if (requestController === controller) {
                busy = false; controls();
                $('results').setAttribute('aria-busy', 'false');
                $('metrics').setAttribute('aria-busy', 'false');
            }
        }
    }

    async function loadMeta() {
        $('site').disabled = $('status').disabled = true;
        try {
            const meta = await getJson('/api/orders/meta');
            for (const [id, values] of [['site', meta.facets.sites], ['status', meta.facets.statuses]]) {
                const select = $(id);
                select.replaceChildren(new Option(id === 'site' ? 'All branches' : 'All statuses', ''));
                for (const item of values) select.add(new Option(item.value, item.value));
                if (state[id] && !values.some((item) => item.value === state[id])) select.add(new Option(state[id], state[id]));
                select.value = state[id];
            }
            $('meta-error').hidden = true;
            $('site').disabled = $('status').disabled = false;
        } catch {
            $('meta-error').hidden = false;
        }
    }

    function clearFilters() {
        state.q = state.site = state.status = '';
        state.page = 1;
        $('search').value = $('site').value = $('status').value = '';
        loadOrders();
    }

    $('search').addEventListener('input', () => {
        clearTimeout(debounce);
        // Cancel the previous search immediately so old results cannot win the race.
        requestController?.abort();
        state.q = $('search').value.trim(); state.page = 1;
        debounce = setTimeout(loadOrders, 350);
    });
    $('filters').addEventListener('submit', (event) => { event.preventDefault(); loadOrders(); });
    for (const id of ['site', 'status']) $(id).addEventListener('change', () => { state[id] = $(id).value; state.page = 1; loadOrders(); });
    $('page-size').addEventListener('change', () => { state.pageSize = Number($('page-size').value); state.page = 1; loadOrders(); });
    $('mobile-sort').addEventListener('change', () => {
        [state.sort, state.order] = $('mobile-sort').value.split(':');
        state.page = 1; loadOrders();
    });
    $('clear').addEventListener('click', clearFilters);
    $('previous').addEventListener('click', () => { if (state.page > 1) { state.page--; loadOrders(); } });
    $('next').addEventListener('click', () => { if (state.page < totalPages) { state.page++; loadOrders(); } });
    $('refresh').addEventListener('click', loadOrders);
    $('retry-meta').addEventListener('click', loadMeta);
    document.querySelectorAll('.sort').forEach((button) => button.addEventListener('click', () => {
        const key = button.dataset.sort;
        state.order = state.sort === key && state.order === 'asc' ? 'desc' : 'asc';
        state.sort = key; state.page = 1; loadOrders();
    }));
    loadMeta(); loadOrders();
})();
