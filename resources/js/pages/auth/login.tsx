import { Form, Head } from '@inertiajs/react';
import LoginPasswordField from '@/components/auth/login-password-field';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function Login({ status }: Props) {
    return (
        <>
            <Head title="Log in" />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="auth-login-form"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="auth-login-fields">
                            <div className="auth-login-field">
                                <Label
                                    htmlFor="username"
                                    className="auth-login-label"
                                >
                                    Username
                                </Label>
                                <Input
                                    id="username"
                                    type="text"
                                    name="username"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="username"
                                    placeholder="Enter your username"
                                    className="auth-login-input"
                                />
                                <InputError message={errors.username} />
                            </div>

                            <LoginPasswordField error={errors.password} />

                            <button
                                type="submit"
                                className="auth-login-submit"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                Login
                            </button>
                        </div>
                    </>
                )}
            </Form>

            {status && <div className="auth-login-status">{status}</div>}
        </>
    );
}

Login.layout = {
    title: 'Welcome to WEISS',
    description: 'Login to your contractor CRM workspace.',
};
