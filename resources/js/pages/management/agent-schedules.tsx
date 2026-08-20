import { Head, useForm } from '@inertiajs/react';
import { CalendarClock, Users } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import '@/../css/agent-schedules.css';

type Day = { weekday: number; is_working: boolean; shift_start: string; shift_end: string; lunch_start: string; lunch_end: string };
const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const blank = (weekday: number): Day => ({ weekday, is_working: weekday > 0 && weekday < 6, shift_start: '09:00', shift_end: '18:00', lunch_start: '13:00', lunch_end: '14:00' });

export default function AgentSchedules({ schedules, activeAgentCount }: { schedules: Record<string, Partial<Day>>; activeAgentCount: number }) {
    const form = useForm<{ schedules: Day[] }>({ schedules: Array.from({ length: 7 }, (_, weekday) => ({ ...blank(weekday), ...(schedules[String(weekday)] ?? {}) })) });
    const change = (index: number, key: keyof Day, value: string | boolean) => form.setData('schedules', form.data.schedules.map((day, current) => current === index ? { ...day, [key]: value } : day));

    return <AppLayout><Head title="Agent Schedules" /><section className="schedule-page">
        <header><span><CalendarClock /></span><div><small>ATTENDANCE</small><h1>Shared Agent Schedule</h1><p>Set the working days, shifts, and lunches once for every active agent.</p></div></header>
        <div className="schedule-shell"><main>
            <h2><Users /> Company schedule <small>{activeAgentCount} active agents</small></h2>
            <div className="schedule-days">{form.data.schedules.map((day, index) => <article className={day.is_working ? 'working' : ''} key={day.weekday}>
                <div><strong>{names[day.weekday]}</strong><label><input type="checkbox" checked={day.is_working} onChange={(event) => change(index, 'is_working', event.target.checked)} /> Working day</label></div>
                {day.is_working && <section>
                    <label>Clock in<input type="time" value={day.shift_start} onChange={(event) => change(index, 'shift_start', event.target.value)} /></label>
                    <label>Lunch out<input type="time" value={day.lunch_start} onChange={(event) => change(index, 'lunch_start', event.target.value)} /></label>
                    <label>Lunch in<input type="time" value={day.lunch_end} onChange={(event) => change(index, 'lunch_end', event.target.value)} /></label>
                    <label>Clock out<input type="time" value={day.shift_end} onChange={(event) => change(index, 'shift_end', event.target.value)} /></label>
                </section>}
            </article>)}</div>
            <button className="save" disabled={form.processing || activeAgentCount === 0} onClick={() => form.put('/management/agent-schedules')}>{form.processing ? 'Saving...' : `Save for all ${activeAgentCount} agents`}</button>
        </main></div>
    </section></AppLayout>;
}
