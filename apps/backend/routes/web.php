<?php

use App\Http\Controllers\Api\ResumeStudioController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/resume-share/{token}', [ResumeStudioController::class, 'publicShare']);
