<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;

class OrderController
{
    public function index(Request $request): JsonResponse
    {
        $query = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1', 'max:100000'],
            'pageSize' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'q' => ['nullable', 'string', 'max:150'],
            'site' => ['nullable', 'string', 'max:30'],
            'status' => ['nullable', 'string', 'max:50'],
            'sort' => ['sometimes', Rule::in(['SalesId', 'CreatedDateTime1', 'HAR_TotalSOAmount', 'SalesStatus', 'InventSiteId'])],
            'order' => ['sometimes', Rule::in(['asc', 'desc'])],
        ]);

        return $this->fetch('', $query + ['page' => 1, 'pageSize' => 25, 'sort' => 'CreatedDateTime1', 'order' => 'desc']);
    }

    public function meta(): JsonResponse
    {
        return $this->fetch('/meta');
    }

    private function fetch(string $path, array $query = []): JsonResponse
    {
        try {
            // This fixed upstream is the only data source; incoming URLs are never accepted.
            $response = Http::acceptJson()
                ->withHeaders(['x-assessment-key' => config('assessment.key')])
                ->withOptions(['verify' => config('assessment.ca_bundle') ?: true])
                ->connectTimeout(5)->timeout(15)
                ->get(config('assessment.url').$path, $query)
                ->throw();
            $data = $response->json();

            if (! is_array($data) || ($path === '' && (! isset($data['data'], $data['summary'], $data['total'], $data['totalPages']) || ! is_array($data['data']) || ! is_array($data['summary']))) || ($path === '/meta' && ! isset($data['facets']['sites'], $data['facets']['statuses']))) {
                return response()->json(['message' => 'The order service returned an unexpected response. Please try again.'], 502);
            }

            return response()->json($data)->header('Cache-Control', 'no-store');
        } catch (ConnectionException|RequestException $exception) {
            report($exception);

            return response()->json(['message' => 'The order service is temporarily unavailable. Please try again.'], 502);
        }
    }
}
