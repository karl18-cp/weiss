<?php

use App\Http\Controllers\AgentAttendanceController;
use App\Http\Controllers\AgentScheduleController;
use App\Http\Controllers\AgentController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\ContractorController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DataTeleHoursController;
use App\Http\Controllers\GoogleDriveStatusController;
use App\Http\Controllers\LeadCardController;
use App\Http\Controllers\LeadDataController;
use App\Http\Controllers\LeadImportController;
use App\Http\Controllers\LeadQueueController;
use App\Http\Controllers\LeadSearchController;
use App\Http\Controllers\LeadsShopController;
use App\Http\Controllers\ManagerActivityController;
use App\Http\Controllers\ManagerController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\QualityControlController;
use App\Http\Controllers\RingCentralCallController;
use App\Http\Controllers\RingCentralCallIntentController;
use App\Http\Controllers\RingCentralCallStatusController;
use App\Http\Controllers\RingCentralRecordingController;
use App\Http\Controllers\SalesmanController;
use App\Http\Controllers\SalesmanPortalController;
use App\Http\Controllers\SalesmanPushSubscriptionController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\TeamDashboardController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\VendorController;
use App\Http\Controllers\TeleHoursController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified', 'manager.permission'])->group(function () {
    Route::get('agent/dashboard', [AgentAttendanceController::class, 'index'])
        ->name('agent.dashboard');
    Route::post('agent/time-in', [AgentAttendanceController::class, 'clockIn'])
        ->middleware('throttle:10,1')
        ->name('agent.time-in');
    Route::post('agent/time-out', [AgentAttendanceController::class, 'clockOut'])
        ->middleware('throttle:10,1')
        ->name('agent.time-out');
    Route::post('agent/lunch-out', [AgentAttendanceController::class, 'lunchOut'])->middleware('throttle:10,1')->name('agent.lunch-out');
    Route::post('agent/lunch-in', [AgentAttendanceController::class, 'lunchIn'])->middleware('throttle:10,1')->name('agent.lunch-in');
    Route::get('dashboard', DashboardController::class)->name('dashboard');
    Route::get('team-dashboard', TeamDashboardController::class)->name('team-dashboard');
    Route::redirect('salesman', '/salesman/booking-board')->name('salesman.home');
    Route::get('salesman/booking-board', [LeadQueueController::class, 'salesmanBookingBoard'])
        ->name('salesman.booking-board');
    Route::get('salesman/leads', [SalesmanPortalController::class, 'leads'])
        ->name('salesman.leads');
    Route::get('salesman/follow-ups', [SalesmanPortalController::class, 'followUps'])
        ->name('salesman.follow-ups');
    Route::get('salesman/sold', [SalesmanPortalController::class, 'sold'])
        ->name('salesman.sold');
    Route::get('salesman/sold/{project}', [SalesmanPortalController::class, 'soldProject'])->name('salesman.sold.project');
    Route::post('salesman/sold/{project}/documents', [SalesmanPortalController::class, 'storeProjectDocument'])->name('salesman.sold.documents.store');
    Route::get('salesman/sold/{project}/documents/{document}', [SalesmanPortalController::class, 'showProjectDocument'])->name('salesman.sold.documents.show');
    Route::get('salesman/lead-information', [SalesmanPortalController::class, 'leadInformation'])
        ->name('salesman.lead-information');
    Route::get('salesman/session/keep-alive', [SalesmanPortalController::class, 'keepAlive'])
        ->middleware('throttle:20,1')
        ->name('salesman.session.keep-alive');
    Route::put('salesman/location', [SalesmanPortalController::class, 'updateLocation'])
        ->middleware('throttle:10,1')
        ->name('salesman.location.update');
    Route::post('salesman/leads/{lead}/appointment-result-notes', [SalesmanPortalController::class, 'storeAppointmentResultNote'])
        ->name('salesman.leads.appointment-result-notes.store');
    Route::post('salesman/push-subscriptions', [SalesmanPushSubscriptionController::class, 'store'])
        ->name('salesman.push-subscriptions.store');
    Route::delete('salesman/push-subscriptions', [SalesmanPushSubscriptionController::class, 'destroy'])
        ->name('salesman.push-subscriptions.destroy');
    Route::post('salesman/push-subscriptions/test', [SalesmanPushSubscriptionController::class, 'test'])
        ->name('salesman.push-subscriptions.test');
    Route::get('lead-search', LeadSearchController::class)->name('lead-search');
    Route::get('integrations/google-drive/status', GoogleDriveStatusController::class)
        ->name('integrations.google-drive.status');
    Route::post('integrations/ringcentral/calls', RingCentralCallController::class)
        ->middleware('throttle:10,1')
        ->name('integrations.ringcentral.calls.store');
    Route::get('integrations/ringcentral/calls/{callId}', RingCentralCallStatusController::class)
        ->where('callId', '[A-Za-z0-9_-]+')
        ->middleware('throttle:60,1')
        ->name('integrations.ringcentral.calls.show');

    Route::prefix('lead-workflow')->name('lead-workflow.')->group(function () {
        Route::get('lead-card', [LeadCardController::class, 'index'])->name('lead-card');
        Route::post('lead-card', [LeadCardController::class, 'store'])->name('lead-card.store');
        Route::get('leads-shop/latest-marker', [LeadsShopController::class, 'latestMarker'])
            ->name('leads-shop.latest-marker');
        Route::get('sidebar-alerts', [LeadsShopController::class, 'sidebarAlerts'])
            ->name('sidebar-alerts');
        Route::get('leads-shop', [LeadsShopController::class, 'index'])->name('leads-shop');
        Route::put('leads-shop/{lead}', [LeadsShopController::class, 'update'])->name('leads-shop.update');
        Route::delete('leads-shop/{lead}', [LeadsShopController::class, 'destroy'])->name('leads-shop.destroy');
        Route::post('leads-shop/{lead}/duplicate/merge', [LeadsShopController::class, 'mergeDuplicate'])->name('leads-shop.duplicate.merge');
        Route::delete('leads-shop/{lead}/duplicate', [LeadsShopController::class, 'deleteDuplicate'])->name('leads-shop.duplicate.destroy');
        Route::post('leads-shop/{lead}/notes', [LeadsShopController::class, 'storeNote'])->name('leads-shop.notes.store');
        Route::post('leads-shop/{lead}/ringcentral-calls', RingCentralCallIntentController::class)->name('leads-shop.ringcentral-calls.store');
        Route::get('leads-shop/{lead}/ringcentral-calls/{ringCentralCall}/recording', RingCentralRecordingController::class)->name('leads-shop.ringcentral-calls.recording');
        Route::patch('leads-shop/{lead}/status', [LeadsShopController::class, 'updateStatus'])->name('leads-shop.status.update');
        Route::patch('leads-shop/{lead}/salesmen', [LeadsShopController::class, 'assignSalesmen'])->name('leads-shop.salesmen.update');
        Route::patch('leads-shop/{lead}/appointment-result', [LeadsShopController::class, 'updateAppointmentResult'])->name('leads-shop.appointment-result.update');
        Route::patch('leads-shop/{lead}/appointment', [LeadsShopController::class, 'updateAppointment'])->name('leads-shop.appointment.update');
        Route::patch('leads-shop/{lead}/product', [LeadsShopController::class, 'updateProduct'])->name('leads-shop.product.update');
        Route::post('leads-shop/{lead}/sale', [LeadsShopController::class, 'sell'])->name('leads-shop.sale');
        Route::get('confirm-leads', [LeadQueueController::class, 'confirm'])->name('confirm-leads');
        Route::get('dispatch-leads', [LeadQueueController::class, 'dispatch'])->name('dispatch-leads');
        Route::get('sag', [LeadQueueController::class, 'sag'])->name('sag');
        Route::get('reschedule', [LeadQueueController::class, 'reschedule'])->name('reschedule');
        Route::get('rehash', [LeadQueueController::class, 'rehash'])->name('rehash');
        Route::get('555', [LeadQueueController::class, 'fiveFiveFive'])->name('five-five-five');
        Route::get('la', [LeadQueueController::class, 'la'])->name('la');
        Route::get('his', [LeadQueueController::class, 'his'])->name('his');
        Route::get('toss-leads', [LeadQueueController::class, 'toss'])->name('toss-leads');
        Route::get('keep-in-touch', [LeadQueueController::class, 'keepInTouch'])->name('keep-in-touch');
        Route::get('data', [LeadDataController::class, 'index'])->name('data');
        Route::redirect('data/vendor-invoices', '/management/invoices');
        Route::redirect('data/receivables', '/management/receivables');
        Route::redirect('data/payables', '/management/payables');
        Route::redirect('data/manager-activity', '/lead-workflow/call-logs')->name('data.manager-activity');
        Route::patch('data/{lead}/original-agent', [LeadDataController::class, 'updateOriginalAgent'])->name('data.original-agent.update');
        Route::post('data/import', LeadImportController::class)->name('data.import');
        Route::get('data/tele-hours', [DataTeleHoursController::class, 'index'])->name('data.tele-hours');
        Route::post('data/tele-hours', [DataTeleHoursController::class, 'store'])->name('data.tele-hours.store');
        Route::patch('data/tele-hours/{agentId}/{workDate}', [DataTeleHoursController::class, 'update'])->name('data.tele-hours.update');
        Route::delete('data/tele-hours/{agentId}/{workDate}', [DataTeleHoursController::class, 'destroy'])->name('data.tele-hours.destroy');
        Route::get('booking-board', [LeadQueueController::class, 'bookingBoard'])->name('booking-board');
        Route::get('tele-hours', TeleHoursController::class)->name('tele-hours');
        Route::get('call-logs', ManagerActivityController::class)->name('call-logs');
    });

    Route::prefix('management')->name('management.')->group(function () {
        Route::get('tasks', [TaskController::class, 'index'])->name('tasks');
        Route::post('tasks', [TaskController::class, 'store'])->name('tasks.store');
        Route::put('tasks/{systemTask}', [TaskController::class, 'update'])->name('tasks.update');
        Route::delete('tasks/{systemTask}', [TaskController::class, 'destroy'])->name('tasks.destroy');
        Route::get('agent-schedules', [AgentScheduleController::class, 'index'])->name('agent-schedules');
        Route::put('agent-schedules', [AgentScheduleController::class, 'update'])->name('agent-schedules.update');
        Route::get('invoices', [LeadDataController::class, 'vendorInvoices'])->name('invoices');
        Route::get('receivables', [LeadDataController::class, 'receivables'])->name('receivables');
        Route::get('payables', [LeadDataController::class, 'payables'])->name('payables');
        Route::post('accounting-transactions', [LeadDataController::class, 'storeAccountingTransaction'])->name('accounting-transactions.store');
        Route::patch('accounting-transactions/{accountingTransaction}/status', [LeadDataController::class, 'updateAccountingStatus'])->name('accounting-transactions.status');
        Route::redirect('manager-history', '/lead-workflow/call-logs')->name('manager-history');
        Route::get('quality-control', [QualityControlController::class, 'index'])->name('quality-control');
        Route::patch('quality-control/{project}/return-to-dispatch', [QualityControlController::class, 'returnToDispatch'])
            ->name('quality-control.return-to-dispatch');
        Route::get('projects', [ProjectController::class, 'index'])->name('projects');
        Route::post('projects', [ProjectController::class, 'store'])->name('projects.store');
        Route::patch('projects/{project}/contractors', [ProjectController::class, 'updateContractors'])->name('projects.contractors.update');
        Route::patch('projects/tele-lead-visibility/bulk', [ProjectController::class, 'bulkUpdateTeleLeadVisibility'])
            ->name('projects.tele-lead-visibility.bulk-update');
        Route::patch('projects/{project}/tele-lead-visibility', [ProjectController::class, 'updateTeleLeadVisibility'])
            ->name('projects.tele-lead-visibility.update');
        Route::post('projects/sync-drive-folders', [ProjectController::class, 'syncDriveFolders'])->name('projects.sync-drive-folders');
        Route::put('projects/{project}', [ProjectController::class, 'updateDetails'])->name('projects.update');
        Route::post('projects/{project}/sales', [ProjectController::class, 'storeReferral'])->name('projects.sales.store');
        Route::match(['post', 'put'], 'projects/{project}/sales/{sale}', [ProjectController::class, 'updateSale'])->name('projects.sales.update');
        Route::delete('projects/{project}/sales/{sale}', [ProjectController::class, 'destroySale'])->name('projects.sales.destroy');
        Route::post('projects/{project}/scheduled-payments', [ProjectController::class, 'storeScheduledPayment'])->name('projects.scheduled-payments.store');
        Route::put('projects/{project}/scheduled-payments/{scheduledPayment}', [ProjectController::class, 'updateScheduledPayment'])->name('projects.scheduled-payments.update');
        Route::delete('projects/{project}/scheduled-payments/{scheduledPayment}', [ProjectController::class, 'destroyScheduledPayment'])->name('projects.scheduled-payments.destroy');
        Route::post('projects/{project}/invoices', [ProjectController::class, 'storeInvoice'])->name('projects.invoices.store');
        Route::post('projects/{project}/invoices/{invoice}', [ProjectController::class, 'updateInvoice'])->name('projects.invoices.update');
        Route::delete('projects/{project}/invoices/{invoice}', [ProjectController::class, 'destroyInvoice'])->name('projects.invoices.destroy');
        Route::get('projects/{project}/invoices/{invoice}/file', [ProjectController::class, 'showInvoiceFile'])->name('projects.invoices.file');
        Route::get('projects/{project}/contract-file', [ProjectController::class, 'showContractFile'])->name('projects.contract-file');
        Route::get('projects/{project}/documents/{document}/file', [ProjectController::class, 'showProjectDocument'])->name('projects.documents.file');
        Route::post('projects/{project}/documents', [ProjectController::class, 'storeProjectDocuments'])->name('projects.documents.store');
        Route::post('projects/{project}/accounting-transactions', [ProjectController::class, 'storeAccountingTransaction'])->name('projects.accounting-transactions.store');
        Route::match(['post', 'put'], 'projects/{project}/accounting-transactions/{accountingTransaction}', [ProjectController::class, 'updateAccountingTransaction'])->name('projects.accounting-transactions.update');
        Route::patch('projects/{project}/accounting-transactions/{accountingTransaction}/qb', [ProjectController::class, 'updateReceivableQuickBooks'])->name('projects.accounting-transactions.qb');
        Route::delete('projects/{project}/accounting-transactions/{accountingTransaction}', [ProjectController::class, 'destroyAccountingTransaction'])->name('projects.accounting-transactions.destroy');
        Route::get('projects/{project}/accounting-transactions/{accountingTransaction}/file', [ProjectController::class, 'showAccountingTransactionFile'])->name('projects.accounting-transactions.file');
        Route::get('salesmen', [SalesmanController::class, 'index'])->name('salesmen');
        Route::get('salesmen/{salesman}/report', [SalesmanController::class, 'report'])->name('salesmen.report');
        Route::post('salesmen', [SalesmanController::class, 'store'])->name('salesmen.store');
        Route::put('salesmen/{salesman}', [SalesmanController::class, 'update'])->name('salesmen.update');
        Route::delete('salesmen/{salesman}', [SalesmanController::class, 'destroy'])->name('salesmen.destroy');
        Route::get('agents', [AgentController::class, 'index'])->name('agents');
        Route::get('agents/{agent}/report', [AgentController::class, 'report'])->name('agents.report');
        Route::post('agents', [AgentController::class, 'store'])->name('agents.store');
        Route::put('agents/{agent}', [AgentController::class, 'update'])->name('agents.update');
        Route::delete('agents/{agent}', [AgentController::class, 'destroy'])->name('agents.destroy');
        Route::get('managers', [ManagerController::class, 'index'])->name('managers');
        Route::get('managers/{manager}/report', [ManagerController::class, 'report'])->name('managers.report');
        Route::post('managers', [ManagerController::class, 'store'])->name('managers.store');
        Route::put('managers/{manager}', [ManagerController::class, 'update'])->name('managers.update');
        Route::delete('managers/{manager}', [ManagerController::class, 'destroy'])->name('managers.destroy');
        Route::get('teams', [TeamController::class, 'index'])->name('teams');
        Route::post('teams', [TeamController::class, 'store'])->name('teams.store');
        Route::put('teams/{team}', [TeamController::class, 'update'])->name('teams.update');
        Route::delete('teams/{team}', [TeamController::class, 'destroy'])->name('teams.destroy');
        Route::inertia('directory', 'management/directory')->name('directory');
        Route::get('contacts-users', [CompanyController::class, 'index'])->name('contacts-users');
        Route::post('contacts-users', [CompanyController::class, 'store'])->name('contacts-users.store');
        Route::put('contacts-users/{company}', [CompanyController::class, 'update'])->name('contacts-users.update');
        Route::patch('contacts-users/{company}/archive', [CompanyController::class, 'archive'])->name('contacts-users.archive');
        Route::patch('contacts-users/{company}/restore', [CompanyController::class, 'restore'])->name('contacts-users.restore');
        Route::delete('contacts-users/{company}', [CompanyController::class, 'destroy'])->name('contacts-users.destroy');
        Route::get('contractors', [ContractorController::class, 'index'])->name('contractors');
        Route::get('contractors/{contractor}/report', [ContractorController::class, 'report'])->name('contractors.report');
        Route::post('contractors', [ContractorController::class, 'store'])->name('contractors.store');
        Route::put('contractors/{contractor}', [ContractorController::class, 'update'])->name('contractors.update');
        Route::delete('contractors/{contractor}', [ContractorController::class, 'destroy'])->name('contractors.destroy');
        Route::get('vendors', [VendorController::class, 'index'])->name('vendors');
        Route::post('vendors', [VendorController::class, 'store'])->name('vendors.store');
        Route::post('vendors/import-contractors', [VendorController::class, 'importContractors'])->name('vendors.import-contractors');
        Route::put('vendors/{vendor}', [VendorController::class, 'update'])->name('vendors.update');
        Route::delete('vendors/{vendor}', [VendorController::class, 'destroy'])->name('vendors.destroy');
        Route::get('products', [ProductController::class, 'index'])->name('products');
        Route::post('products', [ProductController::class, 'store'])->name('products.store');
        Route::put('products/{product}', [ProductController::class, 'update'])->name('products.update');
        Route::delete('products/{product}', [ProductController::class, 'destroy'])->name('products.destroy');
    });
});

require __DIR__.'/settings.php';
