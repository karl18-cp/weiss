import { Link } from '@inertiajs/react';
import { home } from '@/routes';

export default function WeissBrand() {
    return (
        <Link href={home()} className="weiss-brand" aria-label="WEISS home">
            <img
                src="/images/weiss-logo.png"
                alt="WEISS"
                className="weiss-brand__image"
            />
        </Link>
    );
}
