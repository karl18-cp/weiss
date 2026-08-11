<?php

namespace App\Support;

use App\Models\Account;

class ManagerAccess
{
    public const TYPES = ['Leads Manager', 'Quality Control Manager', 'Project Manager', 'Task Manager', 'Tele Manager'];

    public const MODULES = [
        'dashboard' => 'Dashboard',
        'team_dashboard' => 'Team Dashboard',
        'lead_card' => 'Lead Card', 'leads_shop' => 'Leads Shop',
        'confirm_leads' => 'Confirm Leads', 'dispatch_leads' => 'Dispatch Leads', 'sag' => 'SAG',
        'reschedule' => 'Reschedule', 'rehash' => 'Rehash', '555' => '555',
        'la' => 'LA', 'his' => 'HIS', 'toss_leads' => 'TOSS Leads', 'keep_in_touch' => 'Keep in Touch',
        'data' => 'Data', 'booking_board' => 'Booking Board', 'tele_hours' => 'Tele Report',
        'quality_control' => 'Quality Control', 'projects' => 'Projects',
        'manager_history' => 'View All Manager Activity',
        'contacts_users' => 'Contacts & Users',
        'view_all_kit_managers' => "View All Managers' Keep in Touch Leads",
        'view_all_callbacks' => "View All Managers' Callbacks",
        'queue_action_buttons' => 'Use Workflow Action Buttons',
        'toss_action' => 'Move Leads to TOSS',
        'dial_raw_only' => 'Leads Shop Dialing: Raw & Verify Only',
        'full_phone_numbers' => 'View Full Phone Numbers',
    ];

    public const MODULE_PATHS = [
        'dashboard' => '/dashboard',
        'team_dashboard' => '/team-dashboard',
        'lead_card' => '/lead-workflow/lead-card',
        'leads_shop' => '/lead-workflow/leads-shop',
        'confirm_leads' => '/lead-workflow/confirm-leads',
        'dispatch_leads' => '/lead-workflow/dispatch-leads',
        'sag' => '/lead-workflow/sag',
        'reschedule' => '/lead-workflow/reschedule',
        'rehash' => '/lead-workflow/rehash',
        '555' => '/lead-workflow/555',
        'la' => '/lead-workflow/la',
        'his' => '/lead-workflow/his',
        'toss_leads' => '/lead-workflow/toss-leads',
        'keep_in_touch' => '/lead-workflow/keep-in-touch',
        'data' => '/lead-workflow/data',
        'booking_board' => '/lead-workflow/booking-board',
        'tele_hours' => '/lead-workflow/tele-hours',
        'quality_control' => '/management/quality-control',
        'projects' => '/management/projects',
        'contacts_users' => '/management/contacts-users',
    ];

    public static function canEdit(Account $user, string $module): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        $profile = match ($user->role) {
            'manager' => $user->manager,
            'agent' => $user->agent,
            'salesman' => $user->salesman,
            default => null,
        };

        return $profile?->permissions()
            ->where('module', $module)
            ->where('access_level', 'edit')
            ->exists() ?? false;
    }

    public static function hasEnabledFlag(Account $user, string $module): bool
    {
        if ($user->role === 'admin') {
            return false;
        }

        $profile = match ($user->role) {
            'manager' => $user->manager,
            'agent' => $user->agent,
            'salesman' => $user->salesman,
            default => null,
        };

        return $profile?->permissions()
            ->where('module', $module)
            ->where('access_level', 'edit')
            ->exists() ?? false;
    }

    public static function firstAllowedPath(Account $user): ?string
    {
        if (! in_array($user->role, ['manager', 'agent', 'salesman'], true)) {
            return self::MODULE_PATHS['dashboard'];
        }

        $profile = match ($user->role) {
            'manager' => $user->manager,
            'agent' => $user->agent,
            'salesman' => $user->salesman,
        };
        $permissions = $profile?->permissions()
            ->whereIn('access_level', ['view', 'edit'])
            ->pluck('access_level', 'module') ?? collect();

        foreach (self::MODULE_PATHS as $module => $path) {
            if ($permissions->has($module)) {
                return $path;
            }
        }

        return null;
    }
}
