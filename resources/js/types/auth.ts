export type User = {
    id?: number;
    acc_id?: number;
    name: string;
    email: string;
    username?: string;
    role?: string;
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
    permissions?: Record<string, 'none' | 'view' | 'edit'>;
};
