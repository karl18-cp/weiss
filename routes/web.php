<?php

use App\Http\Controllers\AgentController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\ContractorController;
use App\Http\Controllers\LeadCardController;
use App\Http\Controllers\LeadQueueController;
use App\Http\Controllers\LeadsShopController;
use App\Http\Controllers\ManagerController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\SalesmanController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified', 'manager.permission'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::prefix('lead-workflow')->name('lead-workflow.')->group(function () {
        Route::get('lead-card', [LeadCardController::class, 'index'])->name('lead-card');
        Route::post('lead-card', [LeadCardController::class, 'store'])->name('lead-card.store');
        Route::get('leads-shop', [LeadsShopController::class, 'index'])->name('leads-shop');
        Route::put('leads-shop/{lead}', [LeadsShopController::class, 'update'])->name('leads-shop.update');
        Route::post('leads-shop/{lead}/notes', [LeadsShopController::class, 'storeNote'])->name('leads-shop.notes.store');
        Route::patch('leads-shop/{lead}/status', [LeadsShopController::class, 'updateStatus'])->name('leads-shop.status.update');
        Route::patch('leads-shop/{lead}/salesmen', [LeadsShopController::class, 'assignSalesmen'])->name('leads-shop.salesmen.update');
        Route::patch('leads-shop/{lead}/appointment-result', [LeadsShopController::class, 'updateAppointmentResult'])->name('leads-shop.appointment-result.update');
        Route::patch('leads-shop/{lead}/second-agent', [LeadsShopController::class, 'assignSecondAgent'])->name('leads-shop.second-agent.update');
        Route::get('confirm-leads', [LeadQueueController::class, 'confirm'])->name('confirm-leads');
        Route::get('dispatch-leads', [LeadQueueController::class, 'dispatch'])->name('dispatch-leads');
        Route::get('reschedule', [LeadQueueController::class, 'reschedule'])->name('reschedule');
        Route::get('rehash', [LeadQueueController::class, 'rehash'])->name('rehash');
        Route::get('555', [LeadQueueController::class, 'fiveFiveFive'])->name('five-five-five');
        Route::get('la', [LeadQueueController::class, 'la'])->name('la');
        Route::get('his', [LeadQueueController::class, 'his'])->name('his');
        Route::get('keep-in-touch', [LeadQueueController::class, 'keepInTouch'])->name('keep-in-touch');
        Route::inertia('data', 'lead-workflow/data')->name('data');
        Route::inertia('booking-board', 'lead-workflow/booking-board')->name('booking-board');
        Route::inertia('tele-hours', 'lead-workflow/tele-hours')->name('tele-hours');
    });

    Route::prefix('management')->name('management.')->group(function () {
        Route::inertia('quality-control', 'management/quality-control')->name('quality-control');
        Route::inertia('projects', 'management/projects')->name('projects');
        Route::get('salesmen', [SalesmanController::class, 'index'])->name('salesmen');
        Route::post('salesmen', [SalesmanController::class, 'store'])->name('salesmen.store');
        Route::put('salesmen/{salesman}', [SalesmanController::class, 'update'])->name('salesmen.update');
        Route::delete('salesmen/{salesman}', [SalesmanController::class, 'destroy'])->name('salesmen.destroy');
        Route::get('agents', [AgentController::class, 'index'])->name('agents');
        Route::post('agents', [AgentController::class, 'store'])->name('agents.store');
        Route::put('agents/{agent}', [AgentController::class, 'update'])->name('agents.update');
        Route::delete('agents/{agent}', [AgentController::class, 'destroy'])->name('agents.destroy');
        Route::get('managers', [ManagerController::class, 'index'])->name('managers');
        Route::post('managers', [ManagerController::class, 'store'])->name('managers.store');
        Route::put('managers/{manager}', [ManagerController::class, 'update'])->name('managers.update');
        Route::delete('managers/{manager}', [ManagerController::class, 'destroy'])->name('managers.destroy');
        Route::inertia('directory', 'management/directory')->name('directory');
        Route::get('contacts-users', [CompanyController::class, 'index'])->name('contacts-users');
        Route::post('contacts-users', [CompanyController::class, 'store'])->name('contacts-users.store');
        Route::put('contacts-users/{company}', [CompanyController::class, 'update'])->name('contacts-users.update');
        Route::delete('contacts-users/{company}', [CompanyController::class, 'destroy'])->name('contacts-users.destroy');
        Route::get('contractors', [ContractorController::class, 'index'])->name('contractors');
        Route::post('contractors', [ContractorController::class, 'store'])->name('contractors.store');
        Route::put('contractors/{contractor}', [ContractorController::class, 'update'])->name('contractors.update');
        Route::delete('contractors/{contractor}', [ContractorController::class, 'destroy'])->name('contractors.destroy');
        Route::get('products', [ProductController::class, 'index'])->name('products');
        Route::post('products', [ProductController::class, 'store'])->name('products.store');
        Route::put('products/{product}', [ProductController::class, 'update'])->name('products.update');
        Route::delete('products/{product}', [ProductController::class, 'destroy'])->name('products.destroy');
        Route::inertia('roles-permission', 'management/roles-permission')->name('roles-permission');
    });
});

require __DIR__.'/settings.php';
