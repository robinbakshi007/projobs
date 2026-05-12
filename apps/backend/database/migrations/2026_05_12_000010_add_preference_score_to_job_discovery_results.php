<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_discovery_results', function (Blueprint $table): void {
            if (!Schema::hasColumn('job_discovery_results', 'preference_score_10')) {
                $table->decimal('preference_score_10', 4, 2)
                    ->nullable()
                    ->after('match_score');
            }

            if (!Schema::hasColumn('job_discovery_results', 'score_breakdown_json')) {
                $table->json('score_breakdown_json')
                    ->nullable()
                    ->after('metadata_json');
            }
        });
    }

    public function down(): void
    {
        Schema::table('job_discovery_results', function (Blueprint $table): void {
            if (Schema::hasColumn('job_discovery_results', 'score_breakdown_json')) {
                $table->dropColumn('score_breakdown_json');
            }

            if (Schema::hasColumn('job_discovery_results', 'preference_score_10')) {
                $table->dropColumn('preference_score_10');
            }
        });
    }
};
