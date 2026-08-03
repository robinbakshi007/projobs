<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ResumeStudioApiTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create([
            'slug' => 'resume-tenant',
            'name' => 'Resume Tenant',
            'plan' => 'pro',
            'daily_apply_limit' => 20,
            'active' => true,
        ]);

        $user = User::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Resume User',
            'email' => 'resume@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'owner',
        ]);

        Sanctum::actingAs($user);
    }

    public function test_profile_variant_share_and_export_flow(): void
    {
        $profile = $this->withHeader('X-Tenant-Id', (string) $this->tenant->id)
            ->putJson('/api/v1/resume-studio/profile', [
                'name' => 'Robin Bakshi',
                'target_title' => 'Senior Business Analyst',
                'template_style' => 'modern',
                'structured_resume_json' => [
                    'name' => 'Robin Bakshi',
                    'title' => 'Senior Business Analyst',
                    'summary' => ['Truthful summary'],
                ],
                'design_tokens_json' => [
                    'selectedHeadingFont' => 'Inter',
                    'selectedBodyFont' => 'Inter',
                    'textColor' => '#24384b',
                    'accentColor' => '#2563eb',
                    'paperColor' => '#ffffff',
                ],
                'cv_text' => "Robin Bakshi\nSenior Business Analyst\n\nProfessional Summary\nTruthful summary",
                'cover_letter_text' => 'Dear Hiring Manager',
            ]);

        $profile->assertOk()->assertJsonPath('data.template_style', 'modern');

        $variant = $this->withHeader('X-Tenant-Id', (string) $this->tenant->id)
            ->postJson('/api/v1/resume-studio/variants', [
                'name' => 'ATS Safe Variant',
                'template_style' => 'classic',
                'structured_resume_json' => ['name' => 'Robin Bakshi'],
                'design_tokens_json' => ['accentColor' => '#342b24'],
                'selected_sections_json' => ['Professional Summary', 'Professional Experience'],
                'cv_text' => "Robin Bakshi\nExecutive Title",
            ]);

        $variant->assertCreated()->assertJsonPath('data.name', 'ATS Safe Variant');
        $variantId = (int) $variant->json('data.id');

        $share = $this->withHeader('X-Tenant-Id', (string) $this->tenant->id)
            ->postJson('/api/v1/resume-studio/share-links', [
                'resume_variant_id' => $variantId,
                'title' => 'Robin Resume',
                'template_style' => 'classic',
                'structured_resume_json' => ['name' => 'Robin Bakshi'],
                'design_tokens_json' => ['accentColor' => '#342b24'],
                'selected_sections_json' => ['Professional Summary'],
                'cv_text' => "Robin Bakshi\nExecutive Title",
            ]);

        $share->assertCreated()->assertJsonStructure(['data', 'url']);
        $token = (string) $share->json('data.token');

        $this->get('/resume-share/'.$token)
            ->assertOk()
            ->assertSee('Robin Bakshi');

        $export = $this->withHeader('X-Tenant-Id', (string) $this->tenant->id)
            ->postJson('/api/v1/resume-studio/export/doc', [
                'title' => 'Robin Resume',
                'file_name' => 'robin-resume',
                'document_html' => '<div><h1>Robin Bakshi</h1><p>Senior Business Analyst</p></div>',
                'document_css' => 'body { font-family: Inter; }',
            ]);

        $export->assertOk();
        $this->assertStringContainsString('application/msword', (string) $export->headers->get('content-type'));
    }
}
