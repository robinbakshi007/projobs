<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JobListing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobListingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source' => ['nullable', 'string', 'max:40'],
            'keyword' => ['nullable', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'string', 'max:40'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = JobListing::query()->orderByDesc('posted_at')->orderByDesc('id');

        if (! empty($validated['source'])) {
            $query->where('source', $validated['source']);
        }

        if (! empty($validated['keyword'])) {
            $kw = '%'.$validated['keyword'].'%';
            $query->where(function ($inner) use ($kw): void {
                $inner->where('title', 'like', $kw)
                    ->orWhere('company', 'like', $kw)
                    ->orWhere('description_text', 'like', $kw);
            });
        }

        if (! empty($validated['location'])) {
            $query->where('location_text', 'like', '%'.$validated['location'].'%');
        }

        $jobs = $query->paginate($validated['per_page'] ?? 20);

        return response()->json($jobs);
    }
}
