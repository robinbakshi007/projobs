<?php

namespace Database\Seeders;

use App\Models\JobListing;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        $user = User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'timezone' => 'Australia/Sydney',
        ]);

        JobListing::create([
            'source' => 'seek',
            'external_job_id' => 'sample-seek-1',
            'source_url' => 'https://www.seek.com.au/job/123456789',
            'title' => 'Software Engineer',
            'company' => 'Example Co',
            'location_text' => 'Sydney, NSW',
            'remote_flag' => false,
            'job_type_text' => 'full_time',
            'description_text' => 'Sample seeded job listing for API smoke testing.',
            'first_seen_at' => now(),
            'last_seen_at' => now(),
        ]);
    }
}
