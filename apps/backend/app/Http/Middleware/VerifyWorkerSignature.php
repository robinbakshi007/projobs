<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class VerifyWorkerSignature
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = (string) config('services.worker.callback_secret', '');
        $expectedKey = (string) config('services.worker.callback_key', 'local-worker');

        if ($secret === '') {
            return response()->json(['error' => 'Worker callback secret not configured'], 500);
        }

        $key = (string) $request->header('X-Worker-Key', '');
        $timestamp = (string) $request->header('X-Worker-Timestamp', '');
        $nonce = (string) $request->header('X-Worker-Nonce', '');
        $signature = (string) $request->header('X-Worker-Signature', '');

        if ($key === '' || $timestamp === '' || $nonce === '' || $signature === '') {
            return response()->json(['error' => 'Missing worker signature headers'], 401);
        }

        if (! hash_equals($expectedKey, $key)) {
            return response()->json(['error' => 'Invalid worker key'], 401);
        }

        $ts = (int) $timestamp;
        if (abs(time() - $ts) > 300) {
            return response()->json(['error' => 'Stale worker timestamp'], 401);
        }

        $nonceCacheKey = 'worker_nonce:'.$nonce;
        if (! Cache::add($nonceCacheKey, true, now()->addMinutes(10))) {
            return response()->json(['error' => 'Replay detected'], 409);
        }

        $body = $request->getContent();
        $base = $timestamp."\n".$nonce."\n".$body;
        $expectedSig = hash_hmac('sha256', $base, $secret);

        if (! hash_equals($expectedSig, $signature)) {
            return response()->json(['error' => 'Invalid worker signature'], 401);
        }

        return $next($request);
    }
}
