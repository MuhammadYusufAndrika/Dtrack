<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/login', fn () => Inertia::render('Login'))->name('login');

Route::get('/admin', fn () => Inertia::render('Admin/Dashboard'))->name('admin.dashboard');
Route::get('/admin/fleet', fn () => Inertia::render('Admin/Fleet'))->name('admin.fleet');
Route::get('/admin/fleet/{id}', fn ($id) => Inertia::render('Admin/FleetShow', ['id' => (int) $id]))->name('admin.fleet.show');
Route::get('/admin/drivers', fn () => Inertia::render('Admin/Drivers'))->name('admin.drivers');
Route::get('/admin/drivers/{id}', fn ($id) => Inertia::render('Admin/DriversShow', ['id' => (int) $id]))->name('admin.drivers.show');
Route::get('/admin/trips', fn () => Inertia::render('Admin/Trips'))->name('admin.trips');
Route::get('/admin/alerts', fn () => Inertia::render('Admin/Alerts'))->name('admin.alerts');
Route::get('/admin/settings', fn () => Inertia::render('Admin/Settings'))->name('admin.settings');

Route::get('/driver', fn () => Inertia::render('Driver/Dashboard'))->name('driver.dashboard');
Route::get('/driver/trips', fn () => Inertia::render('Driver/Trips'))->name('driver.trips');
Route::get('/driver/alerts', fn () => Inertia::render('Driver/Alerts'))->name('driver.alerts');

Route::get('/', fn () => redirect('/login'));
