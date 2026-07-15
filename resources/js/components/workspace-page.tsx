import { Head } from '@inertiajs/react';

type Props = {
    title: string;
    description: string;
};

export default function WorkspacePage({ title, description }: Props) {
    return (
        <>
            <Head title={title} />
            <main className="flex flex-1 flex-col gap-6 p-6">
                <header>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {title}
                    </h1>
                    <p className="mt-1 text-muted-foreground">{description}</p>
                </header>
                <section className="min-h-72 rounded-xl border border-sidebar-border/70 bg-card p-6">
                    <p className="text-sm text-muted-foreground">
                        This workspace is ready for its {title.toLowerCase()}{' '}
                        content.
                    </p>
                </section>
            </main>
        </>
    );
}
