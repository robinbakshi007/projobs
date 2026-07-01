<?php

use App\Http\Controllers\Api\ApplicationSessionController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\CredentialController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\JobListingController;
use App\Http\Controllers\Api\PlatformController;
use App\Http\Controllers\Api\ProductActivationController;
use App\Http\Controllers\Api\QuotaController;
use App\Http\Controllers\Api\ResilienceController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\ReviewIntelligenceController;
use App\Http\Controllers\Api\ResumeStudioController;
use App\Http\Controllers\Api\SecurityController;
use App\Http\Controllers\Api\SuperAdminController;
use App\Http\Controllers\Api\WorkerTaskController;
use App\Http\Controllers\Api\InterviewBuddyController;
use App\Http\Controllers\Api\ResumeScanController;
use App\Http\Controllers\Api\AgentController;
use App\Http\Controllers\Api\JobDiscoveryController;
use App\Http\Controllers\Api\BillingController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', [HealthController::class, 'show']);

    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
    Route::post('/auth/verify-email', [AuthController::class, 'verifyEmail']);
    Route::post('/auth/super-admin-login', [AuthController::class, 'superAdminLogin']);
    Route::get('/platform/capabilities', [PlatformController::class, 'capabilities']);
    Route::post('/billing/stripe/webhook', [BillingController::class, 'stripeWebhook']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/send-verification', [AuthController::class, 'sendVerification']);

        Route::get('/jobs', [JobListingController::class, 'index']);

        Route::get('/quotas/today', [QuotaController::class, 'showToday']);
        Route::put('/quotas/today', [QuotaController::class, 'updateToday']);

        Route::post('/application-sessions/start', [ApplicationSessionController::class, 'start']);
        Route::get('/application-sessions/{session}', [ApplicationSessionController::class, 'show']);
        Route::post('/application-sessions/{session}/stop', [ApplicationSessionController::class, 'stop']);

        Route::get('/review-queue', [ReviewController::class, 'queue']);
        Route::post('/applications/{application}/approve', [ReviewController::class, 'approve']);
        Route::post('/applications/{application}/skip', [ReviewController::class, 'skip']);

        Route::get('/worker-tasks', [WorkerTaskController::class, 'index']);
        Route::get('/worker-tasks/metrics', [WorkerTaskController::class, 'metrics']);
        Route::get('/worker-tasks/{task}/events', [WorkerTaskController::class, 'events']);
        Route::get('/analytics/overview', [AnalyticsController::class, 'overview']);
        Route::get('/analytics/funnel', [AnalyticsController::class, 'funnel']);
        Route::get('/analytics/cohorts', [AnalyticsController::class, 'cohorts']);

        Route::get('/onboarding/milestones', [ProductActivationController::class, 'milestones']);
        Route::put('/onboarding/milestones/{code}', [ProductActivationController::class, 'updateMilestone']);

        Route::post('/security/mfa/request', [SecurityController::class, 'requestMfaCode']);
        Route::post('/security/mfa/verify', [SecurityController::class, 'verifyMfaCode']);
        Route::get('/security/events', [SecurityController::class, 'events']);
        Route::post('/security/anomaly-alert', [SecurityController::class, 'anomalyAlert']);

        Route::get('/review/intelligence', [ReviewIntelligenceController::class, 'index']);
        Route::post('/review/intelligence', [ReviewIntelligenceController::class, 'store']);

        Route::get('/resilience/checkpoints', [ResilienceController::class, 'index']);
        Route::post('/resilience/checkpoints', [ResilienceController::class, 'store']);
        Route::post('/resilience/checkpoints/canary', [ResilienceController::class, 'canary']);

        Route::post('/interview/sessions', [InterviewBuddyController::class, 'startSession']);
        Route::get('/interview/sessions/{session}', [InterviewBuddyController::class, 'showSession']);
        Route::post('/interview/sessions/{session}/end', [InterviewBuddyController::class, 'endSession']);
        Route::post('/interview/questions/{question}/respond', [InterviewBuddyController::class, 'submitResponse']);
        Route::get('/interview/history', [InterviewBuddyController::class, 'history']);

        Route::post('/resume-scans', [ResumeScanController::class, 'store']);
        Route::get('/resume-scans', [ResumeScanController::class, 'index']);
        Route::get('/resume-scans/{scan}', [ResumeScanController::class, 'show']);
        Route::get('/resume-scans/{scan}/diff', [ResumeScanController::class, 'diff']);

        Route::post('/agent-tasks', [AgentController::class, 'dispatchTask']);
        Route::get('/agent-tasks', [AgentController::class, 'index']);
        Route::get('/agent-tasks/{task}', [AgentController::class, 'show']);
        Route::put('/agent-tasks/{task}', [AgentController::class, 'updateResult']);
        Route::post('/agent-tasks/orchestrate', [AgentController::class, 'orchestrate']);

        Route::post('/job-discovery/preferences', [JobDiscoveryController::class, 'storePreference']);
        Route::get('/job-discovery/preferences', [JobDiscoveryController::class, 'preferences']);
        Route::post('/job-discovery/search', [JobDiscoveryController::class, 'searchJobs']);
        Route::get('/job-discovery/results', [JobDiscoveryController::class, 'results']);
        Route::put('/job-discovery/results/{result}', [JobDiscoveryController::class, 'updateResultStatus']);
        Route::get('/resume-studio/profile', [ResumeStudioController::class, 'profile']);
        Route::put('/resume-studio/profile', [ResumeStudioController::class, 'saveProfile']);
        Route::get('/resume-studio/variants', [ResumeStudioController::class, 'variants']);
        Route::post('/resume-studio/variants', [ResumeStudioController::class, 'storeVariant']);
        Route::put('/resume-studio/variants/{variant}', [ResumeStudioController::class, 'updateVariant']);
        Route::delete('/resume-studio/variants/{variant}', [ResumeStudioController::class, 'destroyVariant']);
        Route::get('/resume-studio/share-links', [ResumeStudioController::class, 'shareLinks']);
        Route::post('/resume-studio/share-links', [ResumeStudioController::class, 'createShareLink']);
        Route::post('/resume-studio/export/doc', [ResumeStudioController::class, 'exportDoc']);
        Route::get('/billing/plans', [BillingController::class, 'plans']);

        // Credential management (encrypted at rest)
        Route::get('/credentials', [CredentialController::class, 'index']);
        Route::post('/credentials', [CredentialController::class, 'store']);
        Route::put('/credentials/{provider}', [CredentialController::class, 'update'])->middleware('tenant.admin');
        Route::post('/credentials/{provider}/validate', [CredentialController::class, 'validateCredential']);
        Route::post('/credentials/{provider}/rotate-key', [CredentialController::class, 'rotateKey'])->middleware('tenant.admin');
        Route::get('/credentials/{provider}', [CredentialController::class, 'show']);
        Route::delete('/credentials/{provider}', [CredentialController::class, 'destroy']);

        Route::middleware('super.admin')->group(function (): void {
            Route::get('/super-admin/tenants', [SuperAdminController::class, 'tenants']);
            Route::get('/super-admin/users', [SuperAdminController::class, 'users']);
            Route::get('/super-admin/billing/stripe', [BillingController::class, 'stripeSettings']);
            Route::put('/super-admin/billing/stripe', [BillingController::class, 'saveStripeSettings']);
            Route::post('/super-admin/billing/subscribe', [BillingController::class, 'subscribe']);
            Route::post('/super-admin/billing/portal', [BillingController::class, 'portal']);
            Route::get('/super-admin/billing/subscription-status', [BillingController::class, 'subscriptionStatus']);
        });
    });

    // Internal worker callbacks — used by Python worker to report back
    Route::prefix('internal/worker')->middleware(['worker.signature', 'throttle:120,1'])->group(function (): void {
        Route::post('/scrape-complete', [\App\Http\Controllers\Api\Internal\WorkerCallbackController::class, 'scrapeComplete']);
        Route::post('/apply-progress', [\App\Http\Controllers\Api\Internal\WorkerCallbackController::class, 'applyProgress']);
        Route::post('/apply-complete', [\App\Http\Controllers\Api\Internal\WorkerCallbackController::class, 'applyComplete']);
    });
});
