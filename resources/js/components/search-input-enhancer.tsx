import { useEffect } from 'react';

const searchTerms = /\b(search|filter)\b/i;

const enhanceSearchInputs = (root: ParentNode) => {
    root.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
        if (input.closest('.lead-global-search')) return;

        const description = [
            input.placeholder,
            input.getAttribute('aria-label') ?? '',
        ].join(' ');

        if (!searchTerms.test(description)) return;

        input.type = 'search';
        input.classList.add('global-clearable-search');
    });
};

export function SearchInputEnhancer() {
    useEffect(() => {
        enhanceSearchInputs(document);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) return;

                    if (node instanceof HTMLInputElement) {
                        if (node.closest('.lead-global-search')) return;

                        const description = [
                            node.placeholder,
                            node.getAttribute('aria-label') ?? '',
                        ].join(' ');

                        if (searchTerms.test(description)) {
                            node.type = 'search';
                            node.classList.add('global-clearable-search');
                        }
                    }

                    enhanceSearchInputs(node);
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, []);

    return null;
}
