import { Head, router, useForm } from '@inertiajs/react';
import { Package, Save, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/products.css';
import DirectoryNavigation from '@/components/directory-navigation';
import { useSystemModal } from '@/components/system-modal-provider';

type Product = {
    prod_id: number;
    product_name: string;
};

export default function Products({ products }: { products: Product[] }) {
    const { confirm } = useSystemModal();
    const [selected, setSelected] = useState<Product | null>(null);
    const [search, setSearch] = useState('');
    const form = useForm({ product_name: '' });

    const filteredProducts = useMemo(() => {
        const query = search.trim().toLowerCase();

        return query
            ? products.filter((product) =>
                  product.product_name.toLowerCase().includes(query),
              )
            : products;
    }, [products, search]);

    const selectProduct = (product: Product) => {
        setSelected(product);
        form.setData('product_name', product.product_name);
        form.clearErrors();
    };

    const resetForm = () => {
        setSelected(null);
        form.setData('product_name', '');
        form.clearErrors();
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: resetForm,
        };

        if (selected) {
            form.put(`/management/products/${selected.prod_id}`, options);

            return;
        }

        form.post('/management/products', options);
    };

    const deleteProduct = async () => {
        if (!selected) {
            return;
        }

        const confirmed = await confirm({
            title: 'Delete product?',
            message: `${selected.product_name} will be permanently removed from the product directory.`,
            confirmLabel: 'Delete product',
            tone: 'danger',
        });

        if (!confirmed) {
            return;
        }

        router.delete(`/management/products/${selected.prod_id}`, {
            preserveScroll: true,
            onSuccess: resetForm,
        });
    };

    return (
        <>
            <Head title="Products" />
            <main className="products-page">
                <header className="products-header">
                    <div>
                        <span>Contacts &amp; Users</span>
                        <h1>Products</h1>
                        <p>
                            Create and maintain the products offered in Weiss
                            CRM.
                        </p>
                    </div>
                </header>

                <section className="products-summary">
                    <div className="products-summary__icon">
                        <Package />
                    </div>
                    <div>
                        <strong>{products.length}</strong>
                        <span>Total products</span>
                    </div>
                </section>

                <div className="products-workspace">
                    <DirectoryNavigation active="Products">
                        <div className="products-directory-heading">
                            <h2>Product catalog</h2>
                            <p>Select a product to edit</p>
                        </div>

                        <label className="products-search">
                            <Search />
                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search products"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    aria-label="Clear search"
                                >
                                    <X />
                                </button>
                            )}
                        </label>

                        <div className="products-directory-list directory-navigation__scroll-list">
                            {filteredProducts.map((product) => (
                                <button
                                    type="button"
                                    key={product.prod_id}
                                    className={
                                        selected?.prod_id === product.prod_id
                                            ? 'product-directory-item product-directory-item--active'
                                            : 'product-directory-item'
                                    }
                                    onClick={() => selectProduct(product)}
                                >
                                    <span className="product-directory-icon">
                                        <Package />
                                    </span>
                                    <span>
                                        <strong>{product.product_name}</strong>
                                        <small>
                                            Product #{product.prod_id}
                                        </small>
                                    </span>
                                </button>
                            ))}

                            {filteredProducts.length === 0 && (
                                <div className="products-empty">
                                    <Package />
                                    <strong>No products found</strong>
                                    <span>
                                        {search
                                            ? 'Try a different search.'
                                            : 'Create your first product.'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </DirectoryNavigation>

                    <section className="products-card products-form-card">
                        <div>
                            <h2>
                                {selected ? 'Edit product' : 'Create product'}
                            </h2>
                            <p>
                                {selected
                                    ? `Updating product #${selected.prod_id}`
                                    : 'Add a product to the catalog.'}
                            </p>
                        </div>

                        <form onSubmit={submit} className="products-form">
                            <label>
                                <span>Product name</span>
                                <div className="products-input">
                                    <Package />
                                    <input
                                        value={form.data.product_name}
                                        onChange={(event) =>
                                            form.setData(
                                                'product_name',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Enter a product name"
                                        autoFocus
                                    />
                                </div>
                                {form.errors.product_name && (
                                    <small>{form.errors.product_name}</small>
                                )}
                            </label>

                            <div className="products-form__actions">
                                {selected && (
                                    <>
                                        <button
                                            type="button"
                                            className="products-delete-button"
                                            onClick={deleteProduct}
                                        >
                                            <Trash2 />
                                            Delete
                                        </button>
                                        <button
                                            type="button"
                                            className="products-cancel-button"
                                            onClick={resetForm}
                                        >
                                            New product
                                        </button>
                                    </>
                                )}
                                <button
                                    type="submit"
                                    className="products-primary-button"
                                    disabled={form.processing}
                                >
                                    <Save />
                                    {form.processing
                                        ? 'Saving…'
                                        : selected
                                          ? 'Save changes'
                                          : 'Create product'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            </main>
        </>
    );
}
