<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resume_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name')->nullable();
            $table->string('target_title')->nullable();
            $table->string('template_style', 40)->default('modern');
            $table->json('structured_resume_json')->nullable();
            $table->json('design_tokens_json')->nullable();
            $table->json('selected_sections_json')->nullable();
            $table->longText('cv_text')->nullable();
            $table->longText('cover_letter_text')->nullable();
            $table->longText('profile_photo_data')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'user_id']);
        });

        Schema::create('resume_variants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('template_style', 40)->default('modern');
            $table->json('structured_resume_json')->nullable();
            $table->json('design_tokens_json')->nullable();
            $table->json('selected_sections_json')->nullable();
            $table->longText('cv_text')->nullable();
            $table->longText('cover_letter_text')->nullable();
            $table->longText('profile_photo_data')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
        });

        Schema::create('resume_share_links', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('resume_variant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('token', 80)->unique();
            $table->string('title')->nullable();
            $table->string('template_style', 40)->default('modern');
            $table->json('structured_resume_json')->nullable();
            $table->json('design_tokens_json')->nullable();
            $table->json('selected_sections_json')->nullable();
            $table->longText('cv_text')->nullable();
            $table->longText('cover_letter_text')->nullable();
            $table->longText('profile_photo_data')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_public')->default(true);
            $table->unsignedBigInteger('view_count')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resume_share_links');
        Schema::dropIfExists('resume_variants');
        Schema::dropIfExists('resume_profiles');
    }
};
