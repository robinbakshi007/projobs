<?php

namespace App\Console\Commands;

use App\Models\ApplicationQuota;
use App\Models\User;
use Illuminate\Console\Command;

class ResetDailyQuotasCommand extends Command
{
    protected $signature = 'quota:reset-daily';

    protected $description = 'Reset daily quotas for all users and carry tenant limits';

    public function handle(): int
    {
        $today = now()->toDateString();
        $count = 0;

        User::query()->with('tenant')->chunk(200, function ($users) use ($today, &$count): void {
            foreach ($users as $user) {
                if (! $user->tenant_id) {
                    continue;
                }

                ApplicationQuota::updateOrCreate(
                    [
                        'tenant_id' => $user->tenant_id,
                        'user_id' => $user->id,
                        'date_key' => $today,
                    ],
                    [
                        'max_applications' => $user->tenant?->daily_apply_limit ?? 10,
                        'applied_count' => 0,
                        'reserved_count' => 0,
                        'updated_at' => now(),
                    ]
                );
                $count++;
            }
        });

        $this->info("Reset quotas for {$count} users");

        return self::SUCCESS;
    }
}
