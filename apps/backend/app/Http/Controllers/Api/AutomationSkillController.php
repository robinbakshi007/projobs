<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\AutomationSkill;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AutomationSkillController extends Controller
{
    use ResolvesApiUser;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => ['nullable', 'string', 'max:32'],
            'skill_code' => ['nullable', 'string', 'max:80'],
            'status' => ['nullable', 'in:draft,active,deprecated,disabled'],
        ]);

        $rows = AutomationSkill::query()
            ->where('tenant_id', $this->currentTenantId())
            ->when(isset($validated['provider']), fn ($query) => $query->where('provider', $validated['provider']))
            ->when(isset($validated['skill_code']), fn ($query) => $query->where('skill_code', $validated['skill_code']))
            ->when(isset($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateSkillPayload($request);

        $skill = AutomationSkill::create([
            ...$validated,
            'tenant_id' => $this->currentTenantId(),
        ]);

        $this->audit('automation.skill.created', $skill);

        return response()->json(['data' => $skill], 201);
    }

    public function show(AutomationSkill $skill): JsonResponse
    {
        $this->authorizeSkill($skill);

        return response()->json(['data' => $skill]);
    }

    public function update(Request $request, AutomationSkill $skill): JsonResponse
    {
        $this->authorizeSkill($skill);
        $validated = $this->validateSkillPayload($request, true);

        $skill->fill($validated);
        $skill->save();

        $this->audit('automation.skill.updated', $skill);

        return response()->json(['data' => $skill]);
    }

    public function publish(AutomationSkill $skill): JsonResponse
    {
        $this->authorizeSkill($skill);

        $skill->status = 'active';
        $skill->published_at = now();
        $skill->save();

        $this->audit('automation.skill.published', $skill);

        return response()->json([
            'message' => 'Automation skill published.',
            'data' => $skill,
        ]);
    }

    private function authorizeSkill(AutomationSkill $skill): void
    {
        abort_unless((int) $skill->tenant_id === $this->currentTenantId(), 404);
    }

    private function validateSkillPayload(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'provider' => [$required, 'string', 'max:32'],
            'skill_code' => [$required, 'string', 'max:80'],
            'version' => [$required, 'string', 'max:32'],
            'status' => ['sometimes', 'in:draft,active,deprecated,disabled'],
            'allowed_tools_json' => ['nullable', 'array'],
            'selector_bundle_json' => ['nullable', 'array'],
            'runbook_json' => ['nullable', 'array'],
            'stop_conditions_json' => ['nullable', 'array'],
            'retry_policy_json' => ['nullable', 'array'],
            'escalation_policy_json' => ['nullable', 'array'],
        ]);
    }

    private function audit(string $action, AutomationSkill $skill): void
    {
        DB::table('audit_events')->insert([
            'tenant_id' => $skill->tenant_id,
            'user_id' => $this->resolveApiUserId(),
            'actor_type' => 'user',
            'action' => $action,
            'entity_type' => 'automation_skill',
            'entity_id' => $skill->id,
            'metadata_json' => json_encode([
                'provider' => $skill->provider,
                'skill_code' => $skill->skill_code,
                'version' => $skill->version,
                'status' => $skill->status,
            ]),
            'created_at' => now(),
        ]);
    }
}
