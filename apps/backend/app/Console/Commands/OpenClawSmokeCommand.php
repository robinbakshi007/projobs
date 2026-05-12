<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class OpenClawSmokeCommand extends Command
{
    protected $signature = 'openclaw:smoke';

    protected $description = 'Smoke-check OpenClaw skill registry and agent allowlist files';

    public function handle(): int
    {
        $root = base_path('../..');
        $skillFile = $root.'/.openclaw/skills/search-and-apply/SKILL.md';
        $agentFile = $root.'/.openclaw/agents.json';
        $toolFile = $root.'/.openclaw/skills/search-and-apply/tools.py';

        $missing = [];
        foreach ([$skillFile, $agentFile, $toolFile] as $path) {
            if (! file_exists($path)) {
                $missing[] = $path;
            }
        }

        if ($missing !== []) {
            $this->error('OpenClaw smoke check failed. Missing:');
            foreach ($missing as $path) {
                $this->line(' - '.$path);
            }

            return self::FAILURE;
        }

        $this->info('OpenClaw smoke check passed.');
        return self::SUCCESS;
    }
}
