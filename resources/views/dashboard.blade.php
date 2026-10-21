<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Monitor sales orders across branches with Branchline.">
    <title>Sales orders · SOM</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='12' fill='%23225848'/%3E%3Cpath d='M10 28V18h5v10m3 0V12h5v16m3 0V8h5v20' stroke='white' stroke-width='2'/%3E%3C/svg%3E">
    <link rel="stylesheet" href="{{ asset('app.css') }}?v={{ filemtime(public_path('app.css')) }}">
    <script src="{{ asset('app.js') }}?v={{ filemtime(public_path('app.js')) }}" defer></script>
</head>
<body>
<aside class="sidebar">
    <a class="brand" href="/" aria-label="sOM home"><span class="brand-icon">▥</span> SOM<span class="brand-dot">.</span></a>
    <div class="workspace"><span class="workspace-icon">H</span><div>Harrisons<span>Sales workspace</span></div><span class="workspace-arrow">⌄</span></div>
    <p class="nav-caption">WORKSPACE</p>
    <a class="nav-item active" href="/" aria-current="page"><span aria-hidden="true">▦</span> Sales overview <span class="nav-mark"></span></a>
    <div class="sidebar-bottom"><span class="fixture-dot"></span> Sales workspace<p>Read-only access</p><div class="profile"><span class="avatar">ST</span><div>Sales team<span>Branch operations</span></div></div></div>
</aside>
<div class="app-shell">
    <header class="topbar"><div class="breadcrumb">Workspace <span>/</span> <strong>Sales overview</strong></div></header>
    <main>
        <div class="page-heading"><div><h1>Sales overview</h1><p>Technical Assesment ( Sales Order Monitoring System).</p></div><button class="button refresh" id="refresh" type="button" aria-label="Refresh data" title="Refresh data"><span aria-hidden="true">↻</span> Refresh data</button></div>
        <div class="overview-label"><h2>Order snapshot</h2><span><span class="fixture-dot"></span> All branches · All orders</span></div>
        <section class="metrics" aria-label="All-order dashboard totals" aria-busy="true" id="metrics">
            <article class="metric"><div class="metric-label">Total orders <span aria-hidden="true">▦</span></div><strong data-metric="total_orders">—</strong><span class="metric-note">Across all branches</span></article>
            <article class="metric"><div class="metric-label">Open orders <span class="amber-text" aria-hidden="true">◷</span></div><strong data-metric="open_orders">—</strong><span class="metric-note"><i class="dot amber"></i> Awaiting fulfilment</span></article>
            <article class="metric"><div class="metric-label">Completed <span class="green-text" aria-hidden="true">✓</span></div><strong data-metric="completed">—</strong><span class="metric-note">Invoiced + delivered</span></article>
            <article class="metric"><div class="metric-label">Cancelled <span class="red-text" aria-hidden="true">⊘</span></div><strong data-metric="cancelled_orders">—</strong><span class="metric-note">Cancelled orders</span></article>
            <article class="metric value-card"><div class="metric-label">Total order value <span aria-hidden="true">↗</span></div><strong data-metric="total_order_value">—</strong><span class="metric-note">MYR · Includes all statuses</span></article>
        </section>
        <section class="orders-panel" aria-labelledby="orders-title">
            <div class="panel-heading"><div><h2 id="orders-title">Sales orders <span id="order-count" class="count-badge">—</span></h2><p>Track and explore your branch orders.</p></div><span class="read-only"><span aria-hidden="true">◉</span> Read-only</span></div>
            <form id="filters" class="filters" role="search">
                <label class="search-field"><span aria-hidden="true">⌕</span><input id="search" name="q" type="search" maxlength="150" placeholder="Search order, customer or reference…" aria-label="Search orders"></label>
                <label class="select-field"><span>Branch</span><select id="site" name="site" aria-label="Filter by branch"><option value="">All branches</option></select></label>
                <label class="select-field"><span>Status</span><select id="status" name="status" aria-label="Filter by status"><option value="">All statuses</option></select></label>
                <label class="select-field mobile-sort"><span>Sort</span><select id="mobile-sort" aria-label="Sort orders">
                    <option value="CreatedDateTime1:desc">Newest first</option><option value="CreatedDateTime1:asc">Oldest first</option>
                    <option value="HAR_TotalSOAmount:desc">Highest amount</option><option value="HAR_TotalSOAmount:asc">Lowest amount</option>
                    <option value="SalesId:asc">Order number: A–Z</option><option value="SalesId:desc">Order number: Z–A</option>
                    <option value="InventSiteId:asc">Branch: A–Z</option><option value="InventSiteId:desc">Branch: Z–A</option>
                    <option value="SalesStatus:asc">Status: A–Z</option><option value="SalesStatus:desc">Status: Z–A</option>
                </select></label>
                <button type="button" id="clear" class="clear-button" hidden>Clear filters</button>
            </form>
            <div id="meta-error" class="meta-error" hidden>Filter options could not load. <button id="retry-meta" type="button">Retry filters</button></div>
            <div class="table-scroll" id="results" aria-busy="true">
                <table><thead><tr>
                    <th><button class="sort" data-sort="SalesId">Order number <span aria-hidden="true">↕</span></button></th>
                    <th>Customer</th>
                    <th><button class="sort" data-sort="InventSiteId">Branch <span aria-hidden="true">↕</span></button></th>
                    <th aria-sort="descending"><button class="sort" data-sort="CreatedDateTime1">Order date <span aria-hidden="true">↓</span></button></th>
                    <th><button class="sort" data-sort="SalesStatus">Status <span aria-hidden="true">↕</span></button></th>
                    <th class="amount"><button class="sort" data-sort="HAR_TotalSOAmount">Amount (MYR) <span aria-hidden="true">↕</span></button></th>
                </tr></thead><tbody id="order-rows"></tbody></table>
                <div id="table-state" class="table-state" role="status"><span class="spinner"></span><h3>Loading your orders</h3><p>Getting the latest data from the order service.</p></div>
            </div>
            <div class="pagination"><span id="range" role="status" aria-live="polite">Fetching orders…</span><div class="pagination-controls"><label>Rows per page <select id="page-size" aria-label="Rows per page"><option>10</option><option selected>25</option><option>50</option><option>100</option></select></label><span class="pagination-divider"></span><button id="previous" type="button" aria-label="Previous page" disabled>←</button><span id="page-label">Page —</span><button id="next" type="button" aria-label="Next page" disabled>→</button></div></div>
        </section>
        <footer class="page-footer"><span><span class="fixture-dot"></span> Harrisons · Sales operations</span><span id="last-updated"></span></footer>
        <noscript><p class="meta-error">Enable JavaScript to load the dashboard.</p></noscript>
    </main>
</div>
</body>
</html>
