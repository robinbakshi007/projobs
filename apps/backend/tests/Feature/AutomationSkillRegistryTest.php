<?php

namespace Tests\Feature;

use App\Models\AutomationSkill;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AutomationSkillRegistryTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_create_and_publish_skill(): void
    {
        $tenant = Tenant::create([
            'slug' => 'tenant-skills-owner',
            'name' => 'Tenant Skills Owner',
            'plan' => 'pro',
            'daily_apply_limit' => 25,
            'active' => true,
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Owner',
            'email' => 'skills-owner@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'owner',
        ]);

        Sanctum::actingAs($user);

        $create = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->postJson('/api/v1/automation/skills', [
                'provider' => 'seek',
                'skill_code' => 'seek.apply',
                'version' => '1.0.0',
                'status' => 'draft',
                'allowed_tools_json' => ['playwright'],
                'selector_bundle_json' => ['login_button' => '#login'],
                'runbook_json' => ['steps' => ['login', 'submit']],
            ]);

        $create->assertCreated()
            ->assertJsonPath('data.provider', 'seek')
            ->assertJsonPath('data.skill_code', 'seek.apply')
            ->assertJsonPath('data.version', '1.0.0')
            ->assertJsonPath('data.status', 'draft');

        $skillId = (int) $create->json('data.id');

        $publish = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->postJson('/api/v1/automation/skills/'.$skillId.'/publish');

        $publish->assertOk()
            ->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('automation_skills', [
            'id' => $skillId,
            'tenant_id' => $tenant->id,
            'provider' => 'seek',
            'skill_code' => 'seek.apply',
            'version' => '1.0.0',
            'status' => 'active',
        ]);
    }

    public function test_member_cannot_create_skill(): void
    {
        $tenant = Tenant::create([
            'slug' => 'tenant-skills-member',
            'name' => 'Tenant Skills Member',
            'plan' => 'starter',
            'daily_apply_limit' => 10,
            'active' => true,
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Member',
            'email' => 'skills-member@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'member',
        ]);

        Sanctum::actingAs($user);

        $response = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->postJson('/api/v1/automation/skills', [
                'provider' => 'seek',
                'skill_code' => 'seek.apply',
                'version' => '1.0.0',
            ]);

        $response->assertStatus(403);
    }

    public function test_admin_cannot_access_other_tenant_skill(): void
    {
        $tenantA = Tenant::create([
            'slug' => 'tenant-skills-a',
            'name' => 'Tenant Skills A',
            'plan' => 'pro',
            'daily_apply_limit' => 25,
            'active' => true,
        ]);

        $tenantB = Tenant::create([
            'slug' => 'tenant-skills-b',
            'name' => 'Tenant Skills B',
            'plan' => 'pro',
            'daily_apply_limit' => 25,
            'active' => true,
        ]);

        $user = User::create([
            'tenant_id' => $tenantA->id,
            'name' => 'Owner A',
            'email' => 'skills-owner-a@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'owner',
        ]);

        $skill = AutomationSkill::create([
            'tenant_id' => $tenantB->id,
            'provider' => 'seek',
            'skill_code' => 'seek.apply',
            'version' => '1.0.0',
            'status' => 'draft',
        ]);

        Sanctum::actingAs($user);

        $show = $this->withHeader('X-Tenant-Id', (string) $tenantA->id)
            ->getJson('/api/v1/automation/skills/'.$skill->id);

        $show->assertStatus(404);
    }
}
