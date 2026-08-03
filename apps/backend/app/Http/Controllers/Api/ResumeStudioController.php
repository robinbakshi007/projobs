<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\ResumeProfile;
use App\Models\ResumeShareLink;
use App\Models\ResumeVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ResumeStudioController extends Controller
{
    use ResolvesApiUser;

    public function profile(Request $request): JsonResponse
    {
        $profile = ResumeProfile::firstOrCreate(
            [
                'tenant_id' => $this->currentTenantId(),
                'user_id' => $this->resolveApiUserId(),
            ],
            [
                'template_style' => 'modern',
                'structured_resume_json' => [],
                'design_tokens_json' => [],
                'selected_sections_json' => [],
            ]
        );

        return response()->json(['data' => $profile]);
    }

    public function saveProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:190'],
            'target_title' => ['nullable', 'string', 'max:190'],
            'template_style' => ['required', 'string', 'max:40'],
            'structured_resume_json' => ['nullable', 'array'],
            'design_tokens_json' => ['nullable', 'array'],
            'selected_sections_json' => ['nullable', 'array'],
            'cv_text' => ['nullable', 'string'],
            'cover_letter_text' => ['nullable', 'string'],
            'profile_photo_data' => ['nullable', 'string'],
        ]);

        $profile = ResumeProfile::updateOrCreate(
            [
                'tenant_id' => $this->currentTenantId(),
                'user_id' => $this->resolveApiUserId(),
            ],
            $validated
        );

        return response()->json(['data' => $profile, 'message' => 'Resume studio profile saved.']);
    }

    public function variants(): JsonResponse
    {
        $variants = ResumeVariant::where('tenant_id', $this->currentTenantId())
            ->where('user_id', $this->resolveApiUserId())
            ->latest()
            ->get();

        return response()->json(['data' => $variants]);
    }

    public function storeVariant(Request $request): JsonResponse
    {
        $validated = $this->validateVariant($request);

        $variant = ResumeVariant::create([
            ...$validated,
            'tenant_id' => $this->currentTenantId(),
            'user_id' => $this->resolveApiUserId(),
        ]);

        return response()->json(['data' => $variant], 201);
    }

    public function updateVariant(Request $request, ResumeVariant $variant): JsonResponse
    {
        $this->authorizeVariant($variant);
        $variant->update($this->validateVariant($request, false));

        return response()->json(['data' => $variant]);
    }

    public function destroyVariant(ResumeVariant $variant): JsonResponse
    {
        $this->authorizeVariant($variant);
        $variant->delete();

        return response()->json(['message' => 'Variant deleted.']);
    }

    public function shareLinks(): JsonResponse
    {
        $links = ResumeShareLink::where('tenant_id', $this->currentTenantId())
            ->where('user_id', $this->resolveApiUserId())
            ->latest()
            ->get();

        return response()->json(['data' => $links]);
    }

    public function createShareLink(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'resume_variant_id' => ['nullable', 'integer', 'exists:resume_variants,id'],
            'title' => ['nullable', 'string', 'max:190'],
            'template_style' => ['required', 'string', 'max:40'],
            'structured_resume_json' => ['nullable', 'array'],
            'design_tokens_json' => ['nullable', 'array'],
            'selected_sections_json' => ['nullable', 'array'],
            'cv_text' => ['nullable', 'string'],
            'cover_letter_text' => ['nullable', 'string'],
            'profile_photo_data' => ['nullable', 'string'],
        ]);

        if (!empty($validated['resume_variant_id'])) {
            $variant = ResumeVariant::findOrFail($validated['resume_variant_id']);
            $this->authorizeVariant($variant);
        }

        $link = ResumeShareLink::create([
            ...$validated,
            'tenant_id' => $this->currentTenantId(),
            'user_id' => $this->resolveApiUserId(),
            'token' => Str::random(40),
            'is_public' => true,
        ]);

        return response()->json([
            'data' => $link,
            'url' => url('/resume-share/'.$link->token),
        ], 201);
    }

    public function exportDoc(Request $request)
    {
        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:190'],
            'document_html' => ['required', 'string'],
            'document_css' => ['nullable', 'string'],
            'file_name' => ['nullable', 'string', 'max:190'],
        ]);

        $title = $validated['title'] ?? 'Resume';
        $css = $validated['document_css'] ?? '';
        $html = <<<HTML
<html>
<head>
<meta charset="utf-8" />
<title>{$title}</title>
<style>{$css}</style>
</head>
<body>{$validated['document_html']}</body>
</html>
HTML;

        $fileName = Str::slug($validated['file_name'] ?? $title ?: 'resume').'.doc';

        return response($html, 200, [
            'Content-Type' => 'application/msword',
            'Content-Disposition' => 'attachment; filename="'.$fileName.'"',
        ]);
    }

    public function publicShare(string $token)
    {
        $link = ResumeShareLink::where('token', $token)->firstOrFail();
        abort_unless($link->is_public, 404);

        if ($link->expires_at && $link->expires_at->isPast()) {
            abort(410, 'This resume share link has expired.');
        }

        $link->increment('view_count');
        $tokens = $link->design_tokens_json ?? [];
        $title = e($link->title ?: 'Shared Resume');
        $textColor = e((string) ($tokens['textColor'] ?? '#24384b'));
        $paperColor = e((string) ($tokens['paperColor'] ?? '#ffffff'));
        $accentColor = e((string) ($tokens['accentColor'] ?? '#2563eb'));
        $headingFont = e((string) ($tokens['selectedHeadingFont'] ?? 'Inter'));
        $bodyFont = e((string) ($tokens['selectedBodyFont'] ?? 'Inter'));
        $content = nl2br(e((string) ($link->cv_text ?? 'Resume unavailable.')));

        return response(<<<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{$title}</title>
  <style>
    body { margin: 0; background: #e2e8f0; font-family: {$bodyFont}, Arial, sans-serif; color: {$textColor}; }
    .page { max-width: 960px; margin: 32px auto; background: {$paperColor}; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12); border-radius: 12px; overflow: hidden; }
    .bar { height: 8px; background: {$accentColor}; }
    .content { padding: 40px 48px; line-height: 1.65; white-space: normal; }
    h1, h2, h3 { font-family: {$headingFont}, Arial, sans-serif; color: {$accentColor}; }
  </style>
</head>
<body>
  <div class="page">
    <div class="bar"></div>
    <div class="content">{$content}</div>
  </div>
</body>
</html>
HTML, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    private function validateVariant(Request $request, bool $requireName = true): array
    {
        return $request->validate([
            'name' => [$requireName ? 'required' : 'sometimes', 'string', 'max:190'],
            'template_style' => [$requireName ? 'required' : 'sometimes', 'string', 'max:40'],
            'structured_resume_json' => ['sometimes', 'array'],
            'design_tokens_json' => ['sometimes', 'array'],
            'selected_sections_json' => ['sometimes', 'array'],
            'cv_text' => ['sometimes', 'nullable', 'string'],
            'cover_letter_text' => ['sometimes', 'nullable', 'string'],
            'profile_photo_data' => ['sometimes', 'nullable', 'string'],
            'is_primary' => ['sometimes', 'boolean'],
        ]);
    }

    private function authorizeVariant(ResumeVariant $variant): void
    {
        abort_unless(
            (int) $variant->tenant_id === $this->currentTenantId() && (int) $variant->user_id === $this->resolveApiUserId(),
            403,
            'Unauthorized'
        );
    }
}
