<?php

use App\Http\Controllers\OrderController;
use Illuminate\Support\Facades\Route;

Route::view('/', 'dashboard')->name('dashboard');
Route::get('/api/orders/meta', [OrderController::class, 'meta']);
Route::get('/api/orders', [OrderController::class, 'index']);
