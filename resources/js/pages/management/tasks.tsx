import { Head, router, useForm } from '@inertiajs/react';
import { CheckCircle2, ClipboardList, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { useSystemModal } from '@/components/system-modal-provider';
import '@/../css/tasks.css';

type Status = 'Pending' | 'Finished' | 'Cancelled';
type Task = { id: number; title: string; description: string | null; status: Status; created_by: string | null; updated_by: string | null; updated_at: string | null };

export default function Tasks({ tasks, statuses, canEdit }: { tasks: Task[]; statuses: Status[]; canEdit: boolean }) {
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<'All' | Status>('All');
    const [editing, setEditing] = useState<Task | null>(null);
    const { confirm } = useSystemModal();
    const create = useForm({ title: '', description: '', status: 'Pending' as Status });
    const edit = useForm({ title: '', description: '', status: 'Pending' as Status });
    const visible = useMemo(() => tasks.filter((task) => {
        const matchesStatus = filter === 'All' || task.status === filter;
        const needle = query.trim().toLowerCase();
        return matchesStatus && (!needle || `${task.title} ${task.description ?? ''} ${task.created_by ?? ''}`.toLowerCase().includes(needle));
    }), [tasks, filter, query]);

    const submitCreate = (event: React.FormEvent) => {
        event.preventDefault();
        create.post('/management/tasks', { preserveScroll: true, onSuccess: () => create.reset() });
    };
    const openEdit = (task: Task) => {
        setEditing(task);
        edit.setData({ title: task.title, description: task.description ?? '', status: task.status });
        edit.clearErrors();
    };
    const submitEdit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!editing) return;
        edit.put(`/management/tasks/${editing.id}`, { preserveScroll: true, onSuccess: () => setEditing(null) });
    };
    const changeStatus = (task: Task, status: Status) => router.put(`/management/tasks/${task.id}`, {
        title: task.title, description: task.description ?? '', status,
    }, { preserveScroll: true });
    const remove = async (task: Task) => {
        if (await confirm({ title: 'Delete task?', message: `Delete “${task.title}”? This cannot be undone.`, confirmLabel: 'Delete', tone: 'danger' })) {
            router.delete(`/management/tasks/${task.id}`, { preserveScroll: true });
        }
    };

    return <AppLayout hideSidebar><Head title="Tasks" /><main className="tasks-page">
        <header className="tasks-hero"><span><ClipboardList /></span><div><small>MANAGEMENT</small><h1>Tasks</h1><p>Create and track shared system tasks for permitted managers.</p></div></header>

        {canEdit && <form className="task-create" onSubmit={submitCreate}>
            <div><h2><Plus /> Add task</h2><p>Send a new task to the permitted management team.</p></div>
            <label>Task title<input value={create.data.title} onChange={(e) => create.setData('title', e.target.value)} placeholder="What needs to be done?" required />{create.errors.title && <em>{create.errors.title}</em>}</label>
            <label>Description<textarea value={create.data.description} onChange={(e) => create.setData('description', e.target.value)} placeholder="Add instructions or details" rows={3} /></label>
            <button disabled={create.processing}><Plus /> {create.processing ? 'Adding...' : 'Add task'}</button>
        </form>}

        <section className="task-board">
            <div className="task-toolbar"><div><h2>Task list <b>{tasks.length}</b></h2><p>{canEdit ? 'You can create and modify tasks.' : 'You have read-only access.'}</p></div><label><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" /></label></div>
            <nav>{(['All', ...statuses] as const).map((status) => <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status}<b>{status === 'All' ? tasks.length : tasks.filter((task) => task.status === status).length}</b></button>)}</nav>
            <div className="task-list">{visible.map((task) => <article key={task.id}>
                <span className={`task-state ${task.status.toLowerCase()}`}>{task.status === 'Finished' && <CheckCircle2 />}{task.status}</span>
                <div className="task-copy"><h3>{task.title}</h3><p>{task.description || 'No description provided.'}</p><small>Created by {task.created_by || 'Unknown'} · Updated {task.updated_at ? new Date(task.updated_at).toLocaleString() : '—'}{task.updated_by ? ` by ${task.updated_by}` : ''}</small></div>
                {canEdit && <div className="task-actions"><select value={task.status} onChange={(e) => changeStatus(task, e.target.value as Status)} aria-label={`Status for ${task.title}`}>{statuses.map((status) => <option key={status}>{status}</option>)}</select><button onClick={() => openEdit(task)} title="Edit task"><Pencil /></button><button className="delete" onClick={() => remove(task)} title="Delete task"><Trash2 /></button></div>}
            </article>)}{visible.length === 0 && <div className="task-empty"><ClipboardList /><h3>No tasks found</h3><p>Try another search or status.</p></div>}</div>
        </section>

        {editing && <div className="task-modal"><form onSubmit={submitEdit}><button type="button" className="close" onClick={() => setEditing(null)}><X /></button><h2>Edit task</h2><label>Task title<input value={edit.data.title} onChange={(e) => edit.setData('title', e.target.value)} required /></label><label>Description<textarea rows={5} value={edit.data.description} onChange={(e) => edit.setData('description', e.target.value)} /></label><label>Status<select value={edit.data.status} onChange={(e) => edit.setData('status', e.target.value as Status)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><footer><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary" disabled={edit.processing}>{edit.processing ? 'Saving...' : 'Save changes'}</button></footer></form></div>}
    </main></AppLayout>;
}
