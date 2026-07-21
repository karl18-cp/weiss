import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
    error?: string;
};

export default function LoginPasswordField({ error }: Props) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="auth-login-field">
            <Label htmlFor="password" className="auth-login-label">
                Password
            </Label>
            <div className="auth-password-field">
                <LockKeyhole className="auth-input-icon" aria-hidden="true" />
                <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    tabIndex={2}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="auth-login-input"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    className="auth-password-toggle"
                    aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                    }
                >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
            </div>
            <InputError message={error} />
        </div>
    );
}
