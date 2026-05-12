<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'tenant_id')) {
                $table->foreignId('tenant_id')->nullable()->after('id')->constrained('tenants')->nullOnDelete();
                $table->index(['tenant_id']);
            }

            if (! Schema::hasColumn('users', 'role')) {
                $table->string('role', 32)->default('member')->after('timezone');
            }
        });

        Schema::table('worker_tasks', function (Blueprint $table): void {
            if (! Schema::hasColumn('worker_tasks', 'payload_json')) {
                $table->json('payload_json')->nullable()->after('foreign_ref_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('worker_tasks', function (Blueprint $table): void {
            if (Schema::hasColumn('worker_tasks', 'payload_json')) {
                $table->dropColumn('payload_json');
            }
        });

        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'tenant_id')) {
                $table->dropIndex(['tenant_id']);
                $table->dropConstrainedForeignId('tenant_id');
            }
            if (Schema::hasColumn('users', 'role')) {
                $table->dropColumn('role');
            }
        });
    }
};
