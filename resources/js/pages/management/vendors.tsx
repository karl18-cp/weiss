import { Head, router, useForm } from '@inertiajs/react';
import { BadgeCheck, CalendarDays, Mail, MapPin, Phone, Save, Search, Store, Trash2, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/contractors.css';
import DirectoryNavigation from '@/components/directory-navigation';
import { useSystemModal } from '@/components/system-modal-provider';

type Vendor = { vendor_id: number; vendor: string; point_of_contact: string | null; address: string | null; zip: number | string | null; city: string | null; state: string | null; email: string | null; phone: string | null; license: number | string | null; lic_expire: string | null; worker_comp: string | null; insurance_expire: string | null };
type VendorForm = Omit<Vendor, 'vendor_id'>;
const emptyForm: VendorForm = { vendor: '', point_of_contact: '', address: '', zip: '', city: '', state: '', email: '', phone: '', license: '', lic_expire: '', worker_comp: '', insurance_expire: '' };

export default function Vendors({ vendors }: { vendors: Vendor[] }) {
    const { confirm } = useSystemModal();
    const [selected, setSelected] = useState<Vendor | null>(null);
    const [search, setSearch] = useState('');
    const form = useForm<VendorForm>(emptyForm);
    const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return query ? vendors.filter((item) => [item.vendor, item.point_of_contact, item.city, item.email].join(' ').toLowerCase().includes(query)) : vendors; }, [search, vendors]);
    const reset = () => { setSelected(null); form.setData(emptyForm); form.clearErrors(); };
    const select = (item: Vendor) => { setSelected(item); form.setData({ vendor: item.vendor, point_of_contact: item.point_of_contact ?? '', address: item.address ?? '', zip: item.zip ?? '', city: item.city ?? '', state: item.state ?? '', email: item.email ?? '', phone: item.phone ?? '', license: item.license ?? '', lic_expire: item.lic_expire ?? '', worker_comp: item.worker_comp ?? '', insurance_expire: item.insurance_expire ?? '' }); form.clearErrors(); };
    const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const options = { preserveScroll: true, onSuccess: reset }; selected ? form.put(`/management/vendors/${selected.vendor_id}`, options) : form.post('/management/vendors', options); };
    const remove = async () => { if (!selected || !await confirm({ title: 'Delete vendor?', message: `${selected.vendor} will be permanently removed.`, confirmLabel: 'Delete vendor', tone: 'danger' })) return; router.delete(`/management/vendors/${selected.vendor_id}`, { preserveScroll: true, onSuccess: reset }); };
    const field = (name: keyof VendorForm, label: string, placeholder: string, icon: React.ReactNode, type = 'text') => <label className="contractor-field"><span>{label}</span><div className="contractor-input">{icon}<input type={type} value={String(form.data[name] ?? '')} onChange={(e) => form.setData(name, e.target.value)} placeholder={placeholder} /></div>{form.errors[name] && <small>{form.errors[name]}</small>}</label>;

    return <><Head title="Vendors" /><main className="contractors-page">
        <header className="contractors-header directory-heading-with-total"><div><span>Contacts &amp; Users</span><h1>Vendors</h1><p>Create and maintain the vendors available for invoices.</p></div><section className="contractors-count directory-heading-total"><div className="contractors-count__icon"><Store /></div><div><strong>{vendors.length}</strong><span>Total vendors</span></div></section></header>
        <div className="contractors-workspace"><DirectoryNavigation active="Vendors"><div className="contractors-directory-heading"><div className="directory-heading-title-row"><h2>Vendor directory</h2><span className="directory-inline-count">{filtered.length}</span></div><p>Select a vendor to edit</p></div><label className="contractors-search"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X /></button>}</label><div className="contractors-list directory-navigation__scroll-list">{filtered.map((item) => <button type="button" key={item.vendor_id} className={selected?.vendor_id === item.vendor_id ? 'contractor-list-item contractor-list-item--active' : 'contractor-list-item'} onClick={() => select(item)}><span className="contractor-avatar">{item.vendor.charAt(0).toUpperCase()}</span><span><strong>{item.vendor}</strong><small>{item.point_of_contact ? `Point of Contact: ${item.point_of_contact}` : 'Vendor'}</small></span></button>)}{filtered.length === 0 && <div className="contractors-empty"><Store /><strong>No vendors found</strong></div>}</div></DirectoryNavigation>
            <section className="contractors-form-panel"><div className="contractors-form-title"><div><h2>{selected ? 'Edit vendor' : 'Create vendor'}</h2><p>{selected ? `Updating vendor #${selected.vendor_id}` : 'Add a vendor to your directory'}</p></div></div><form onSubmit={submit} className="contractors-form">
                {field('vendor', 'Vendor name', 'Vendor or business name', <Store />)} {field('point_of_contact', 'Point of Contact', 'Primary contact person', <UserRound />)}
                {field('email', 'Email', 'name@company.com', <Mail />, 'email')} {field('address', 'Address', 'Street address', <MapPin />)}
                {field('city', 'City', 'City', <MapPin />)} {field('state', 'State', 'State', <MapPin />)} {field('zip', 'ZIP code', 'ZIP', <MapPin />, 'number')} {field('phone', 'Phone', 'Phone number', <Phone />, 'tel')}
                {field('license', 'License number (optional)', 'License', <BadgeCheck />, 'number')} {field('lic_expire', 'License expires (optional)', '', <CalendarDays />, 'date')} {field('worker_comp', 'Workers’ comp expires (optional)', '', <CalendarDays />, 'date')} {field('insurance_expire', 'Insurance expires (optional)', '', <CalendarDays />, 'date')}
                <div className="contractors-form-actions">{selected && <><button type="button" className="contractors-delete-button" onClick={remove}><Trash2 />Delete</button><button type="button" className="contractors-reset-button" onClick={reset}>New vendor</button></>}<button type="submit" className="contractors-save-button" disabled={form.processing}><Save />{form.processing ? 'Saving…' : selected ? 'Save changes' : 'Create vendor'}</button></div>
            </form></section></div>
    </main></>;
}
