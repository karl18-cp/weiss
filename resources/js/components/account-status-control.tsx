import { ShieldAlert, ShieldCheck } from 'lucide-react';

export default function AccountStatusControl({
    suspended,
    disabled = false,
    onChange,
}: {
    suspended: boolean;
    disabled?: boolean;
    onChange: (suspended: boolean) => void;
}) {
    return (
        <section
            className={`col-span-full rounded-xl border p-4 ${
                suspended
                    ? 'border-red-200 bg-red-50'
                    : 'border-emerald-200 bg-emerald-50'
            }`}
        >
            <label className={`flex items-start gap-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                    type="checkbox"
                    checked={suspended}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.checked)}
                    className="mt-1 size-4 accent-red-600"
                />
                {suspended ? (
                    <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600" />
                ) : (
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                )}
                <span>
                    <strong className="block text-sm text-slate-800">
                        {suspended
                            ? 'Account inactive'
                            : 'Account active'}
                    </strong>
                    <small className="mt-1 block text-xs leading-5 text-slate-600">
                        {suspended
                            ? 'This user is inactive and cannot sign in. Uncheck this option and save to return them to Active.'
                            : 'Check this option and save to move this user to Inactive and prevent sign-in.'}
                        {' '}Enter a new password above and save whenever you need to change their password.
                    </small>
                </span>
            </label>
        </section>
    );
}
