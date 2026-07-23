import { ShieldCheck } from 'lucide-react';

export type PermissionAccess = 'none' | 'view' | 'edit';

export default function ModulePermissionsEditor({
    roleLabel,
    modules,
    permissions,
    onChange,
}: {
    roleLabel: string;
    modules: Record<string, string>;
    permissions: Record<string, PermissionAccess>;
    onChange: (permissions: Record<string, PermissionAccess>) => void;
}) {
    const visible = Object.values(permissions).filter(
        (level) => level !== 'none',
    ).length;
    const editable = Object.values(permissions).filter(
        (level) => level === 'edit',
    ).length;

    return (
        <section className="module-permissions">
            <header>
                <div>
                    <ShieldCheck />
                    <span>
                        <strong>Tab permissions</strong>
                        <small>
                            Choose what this {roleLabel} can view or edit.
                        </small>
                    </span>
                </div>
                <b>
                    {visible} visible, {editable} editable
                </b>
            </header>
            <div className="module-permission-grid">
                {Object.entries(modules).map(([module, label]) => (
                    <label key={module}>
                        <span>{label}</span>
                        <select
                            value={permissions[module] ?? 'none'}
                            onChange={(event) =>
                                onChange({
                                    ...permissions,
                                    [module]: event.target
                                        .value as PermissionAccess,
                                })
                            }
                        >
                            <option value="none">No access</option>
                            <option value="view">View</option>
                            <option value="edit">Edit</option>
                        </select>
                    </label>
                ))}
            </div>
        </section>
    );
}
