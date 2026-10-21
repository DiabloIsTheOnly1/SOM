<?php

require_once __DIR__.'/../vendor/autoload.php';

use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\Http;

final class DashboardTest extends TestCase
{
    public function createApplication()
    {
        $app = require __DIR__.'/../bootstrap/app.php';
        $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

        return $app;
    }

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    public function test_dashboard_renders_without_calling_upstream(): void
    {
        $this->get('/')->assertOk()->assertSee('Sales overview')->assertSee('All branches · All orders');
        Http::assertNothingSent();
    }

    public function test_filters_and_authentication_are_forwarded_as_get_only(): void
    {
        Http::fake(['hiring.harrisons.my/*' => Http::response([
            'summary' => ['total_orders' => 1200, 'filtered_orders' => 0],
            'data' => [], 'total' => 0, 'totalPages' => 0,
        ])]);

        $this->getJson('/api/orders?q=Siti&site=B20&status=Open%20order&page=2&pageSize=10&sort=HAR_TotalSOAmount&order=asc&unexpected=ignored')
            ->assertOk()->assertJsonPath('summary.total_orders', 1200)->assertJsonPath('total', 0);

        Http::assertSent(fn ($request) => $request->method() === 'GET'
            && $request->hasHeader('x-assessment-key', 'hssb-assessment-mock-2026')
            && $request['site'] === 'B20' && $request['q'] === 'Siti'
            && $request['status'] === 'Open order' && (int) $request['page'] === 2
            && (int) $request['pageSize'] === 10 && $request['sort'] === 'HAR_TotalSOAmount'
            && $request['order'] === 'asc' && ! isset($request['unexpected']));
        Http::assertSentCount(1);
    }

    public function test_invalid_pagination_and_sort_are_rejected_before_upstream(): void
    {
        foreach (['page=0', 'pageSize=101', 'sort=invalid', 'order=invalid', 'q[]=invalid'] as $query) {
            $this->getJson('/api/orders?'.$query)->assertUnprocessable();
        }
        Http::assertNothingSent();
    }

    public function test_metadata_comes_from_the_required_api(): void
    {
        Http::fake(['hiring.harrisons.my/api/mock/sales-orders/meta' => Http::response([
            'facets' => ['sites' => [['value' => 'B20', 'count' => 150]], 'statuses' => [['value' => 'Open order', 'count' => 420]]],
        ])]);
        $this->getJson('/api/orders/meta')->assertOk()->assertJsonPath('facets.sites.0.value', 'B20');
        Http::assertSentCount(1);
    }

    public function test_upstream_errors_are_sanitized(): void
    {
        Http::fake(['*' => Http::response('Sensitive upstream response', 503)]);
        $this->getJson('/api/orders')->assertStatus(502)->assertJsonPath('message', 'The order service is temporarily unavailable. Please try again.')->assertDontSee('Sensitive');
    }

    public function test_connection_failure_returns_recoverable_error(): void
    {
        Http::fake(['*' => Http::failedConnection()]);
        $this->getJson('/api/orders')->assertStatus(502)->assertJsonStructure(['message']);
    }

    public function test_malformed_success_response_is_not_treated_as_empty_orders(): void
    {
        Http::fake(['*' => Http::response('<html>not JSON</html>', 200)]);
        $this->getJson('/api/orders')->assertStatus(502);
        $this->getJson('/api/orders/meta')->assertStatus(502);
    }

    public function test_write_methods_are_not_available(): void
    {
        $this->postJson('/api/orders')->assertStatus(405);
        $this->deleteJson('/api/orders')->assertStatus(405);
        Http::assertNothingSent();
    }
}
