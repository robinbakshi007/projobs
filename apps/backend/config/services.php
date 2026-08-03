<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'worker' => [
        'url' => env('WORKER_BASE_URL', 'http://localhost:8001'),
        'callback_key' => env('WORKER_INTERNAL_KEY', 'local-worker'),
        'callback_secret' => env('WORKER_INTERNAL_SECRET', ''),
        'auto_submit_enabled' => (bool) env('WORKER_AUTO_SUBMIT_ENABLED', false),
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'model'   => env('OPENAI_MODEL', 'gpt-4o'),
    ],

    'super_admin' => [
        'quick_login_enabled' => (bool) env('SUPER_ADMIN_QUICK_LOGIN_ENABLED', false),
        'email' => env('SUPER_ADMIN_EMAIL', 'superadmin@local.dev'),
        'password' => env('SUPER_ADMIN_PASSWORD', 'change-me'),
    ],

    'sms' => [
        'default_provider' => env('SMS_DEFAULT_PROVIDER', 'twilio'),
    ],

    'twilio' => [
        'account_sid' => env('TWILIO_ACCOUNT_SID'),
        'auth_token' => env('TWILIO_AUTH_TOKEN'),
        'from' => env('TWILIO_FROM'),
    ],

    'sinch' => [
        'service_plan_id' => env('SINCH_SERVICE_PLAN_ID'),
        'api_token' => env('SINCH_API_TOKEN'),
        'from' => env('SINCH_FROM'),
    ],

];
