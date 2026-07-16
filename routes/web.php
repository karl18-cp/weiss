<?php

use App\Http\Controllers\AgentController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\ContractorController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LeadCardController;
use App\Http\Controllers\LeadDataController;
use App\Http\Controllers\LeadQueueController;
use App\Http\Controllers\LeadsShopController;
use App\Http\Controllers\ManagerController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\QualityControlController;
use App\Http\Controllers\SalesmanController;
use App\Http\Controllers\TeleHoursController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified', 'manager.permission'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::prefix('lead-workflow')->name('lead-workflow.')->group(function () {
        Route::get('lead-card', [LeadCardController::class, 'index'])->name('lead-card');
        Route::post('lead-card', [LeadCardController::class, 'store'])->name('lead-card.store');
        Route::get('leads-shop', [LeadsShopController::class, 'index'])->name('leads-shop');
        Route::put('leads-shop/{lead}', [LeadsShopController::class, 'update'])->name('leads-shop.update');
        Route::post('leads-shop/{lead}/notes', [LeadsShopController::class, 'storeNote'])->name('leads-shop.notes.store');
        Route::patch('leads-shop/{lead}/status', [LeadsShopController::class, 'updateStatus'])->name('leads-shop.status.update');
        Route::patch('leads-shop/{lead}/salesmen', [LeadsShopController::class, 'assignSalesmen'])->name('leads-shop.salesmen.update');
        Route::patch('leads-shop/{lead}/appointment-result', [LeadsShopController::class, 'updateAppointmentResult'])->name('leads-shop.appointment-result.update');
        Route::post('leads-shop/{lead}/sale', [LeadsShopController::class, 'sell'])->name('leads-shop.sale');
        Route::patch('leads-shop/{lead}/second-agent', [LeadsShopController::class, 'assignSecondAgent'])->name('leads-shop.second-agent.update');
        Route::get('confirm-leads', [LeadQueueController::class, 'confirm'])->name('confirm-leads');
        Route::get('dispatch-leads', [LeadQueueController::class, 'dispatch'])->name('dispatch-leads');
        Route::get('reschedule', [LeadQueueController::class, 'reschedule'])->name('reschedule');
        Route::get('rehash', [LeadQueueController::class, 'rehash'])->name('rehash');
        Route::get('555', [LeadQueueController::class, 'fiveFiveFive'])->name('five-five-five');
        Route::get('la', [LeadQueueController::class, 'la'])->name('la');
        Route::get('his', [LeadQueueController::class, 'his'])->name('his');
        Route::get('keep-in-touch', [LeadQueueController::class, 'keepInTouch'])->name('keep-in-touch');
        Route::get('data', [LeadDataController::class, 'index'])->name('data');
        Route::get('data/vendor-invoices', [LeadDataController::class, 'vendorInvoices'])->name('data.vendor-invoices');
        Route::get('data/receivables', [LeadDataController::class, 'receivables'])->name('data.receivables');
        Route::get('data/payables', [LeadDataController::class, 'payables'])->name('data.payables');
        Route::get('booking-board', [LeadQueueController::class, 'bookingBoard'])->name('booking-board');
        Route::get('tele-hours', TeleHoursController::class)->name('tele-hours');
    });

    Route::prefix('management')->name('management.')->group(function () {
        Route::get('quality-control', [QualityControlController::class, 'index'])->name('quality-control');
        Route::get('projects', [ProjectController::class, 'index'])->name('projects');
        Route::post('projects/{project}/sales', [ProjectController::class, 'storeReferral'])->name('projects.sales.store');
        Route::put('projects/{project}/sales/{sale}', [ProjectController::class, 'updateSale'])->name('projects.sales.update');
        Route::delete('projects/{project}/sales/{sale}', [ProjectController::class, 'destroySale'])->name('projects.sales.destroy');
        Route::post('projects/{project}/scheduled-payments', [ProjectController::class, 'storeScheduledPayment'])->name('projects.scheduled-payments.store');
        Route::put('projects/{project}/scheduled-payments/{scheduledPayment}', [ProjectController::class, 'updateScheduledPayment'])->name('projects.scheduled-payments.update');
        Route::delete('projects/{project}/scheduled-payments/{scheduledPayment}', [ProjectController::class, 'destroyScheduledPayment'])->name('projects.scheduled-payments.destroy');
        Route::post('projects/{project}/invoices', [ProjectController::class, 'storeInvoice'])->name('projects.invoices.store');
        Route::post('projects/{project}/invoices/{invoice}', [ProjectController::class, 'updateInvoice'])->name('projects.invoices.update');
        Route::patch('projects/{project}/invoices/{invoice}/status', [ProjectController::class, 'updateInvoiceStatus'])->name('projects.invoices.status');
        Route::delete('projects/{project}/invoices/{invoice}', [ProjectController::class, 'destroyInvoice'])->name('projects.invoices.destroy');
        Route::get('projects/{project}/invoices/{invoice}/file', [ProjectController::class, 'showInvoiceFile'])->name('projects.invoices.file');
        Route::post('projects/{project}/accounting-transactions', [ProjectController::class, 'storeAccountingTransaction'])->name('projects.accounting-transactions.store');
        Route::match(['post', 'put'], 'projects/{project}/accounting-transactions/{accountingTransaction}', [ProjectController::class, 'updateAccountingTransaction'])->name('projects.accounting-transactions.update');
        Route::delete('projects/{project}/accounting-transactions/{accountingTransaction}', [ProjectController::class, 'destroyAccountingTransaction'])->name('projects.accounting-transactions.destroy');
        Route::get('projects/{project}/accounting-transactions/{accountingTransaction}/file', [ProjectController::class, 'showAccountingTransactionFile'])->name('projects.accounting-transactions.file');
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
        Route::patch('contacts-users/{company}/archive', [CompanyController::class, 'archive'])->name('contacts-users.archive');
        Route::patch('contacts-users/{company}/restore', [CompanyController::class, 'restore'])->name('contacts-users.restore');
        Route::delete('contacts-users/{company}', [CompanyController::class, 'destroy'])->name('contacts-users.destroy');
        Route::get('contractors', [ContractorController::class, 'index'])->name('contractors');
        Route::post('contractors', [ContractorController::class, 'store'])->name('contractors.store');
        Route::put('contractors/{contractor}', [ContractorController::class, 'update'])->name('contractors.update');
        Route::delete('contractors/{contractor}', [ContractorController::class, 'destroy'])->name('contractors.destroy');
        Route::get('products', [ProductController::class, 'index'])->name('products');
        Route::post('products', [ProductController::class, 'store'])->name('products.store');
        Route::put('products/{product}', [ProductController::class, 'update'])->name('products.update');
        Route::delete('products/{product}', [ProductController::class, 'destroy'])->name('products.destroy');
    });
});

require __DIR__.'/settings.php';
