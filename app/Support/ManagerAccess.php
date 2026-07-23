<?php

namespace App\Support;

class ManagerAccess
{
    public const TYPES = ['Leads Manager', 'Quality Control Manager', 'Project Manager', 'Task Manager', 'Tele Manager'];

    public const MODULES = [
        'dashboard' => 'Dashboard',
        'lead_card' => 'Lead Card', 'leads_shop' => 'Leads Shop',
        'confirm_leads' => 'Confirm Leads', 'dispatch_leads' => 'Dispatch Leads',
        'reschedule' => 'Reschedule', 'rehash' => 'Rehash', '555' => '555',
        'la' => 'LA', 'his' => 'HIS', 'keep_in_touch' => 'Keep in Touch',
        'data' => 'Data', 'booking_board' => 'Booking Board', 'tele_hours' => 'Tele Hours',
        'quality_control' => 'Quality Control', 'projects' => 'Projects',
        'contacts_users' => 'Contacts & Users',
    ];
}
